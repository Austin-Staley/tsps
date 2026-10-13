export type TimeUnit = "MILLISECONDS" | "SECONDS" | "MINUTES" | "HOURS";
function millis(period: number, unit: TimeUnit): number {
    const factor = { MILLISECONDS: 1, SECONDS: 1000, MINUTES: 60000, HOURS: 3600000 }[unit];
    if (!Number.isFinite(period) || factor === undefined)
        throw new RangeError("Invalid timer period or unit");
    return period * factor;
}
export class CancellationException extends Error {
    constructor() { super("Task was canceled"); this.name = "CancellationException"; }
}
export class ScheduledFuture<T = void> {
    private done = false;
    private canceled = false;
    private resolveResult!: (value: T | PromiseLike<T>) => void;
    private rejectResult!: (error: unknown) => void;
    readonly result: Promise<T>;
    constructor(private readonly cancelTask: () => void) { this.result = new Promise<T>((resolve, reject) => { this.resolveResult = resolve; this.rejectResult = reject; }); void this.result.catch(() => { }); }
    cancel(_mayInterruptIfRunning = false): boolean {
        if (this.done)
            return false;
        this.canceled = this.done = true;
        this.cancelTask();
        this.rejectResult(new CancellationException());
        return true;
    }
    isCancelled(): boolean { return this.canceled; }
    isDone(): boolean { return this.done; }
    get(): Promise<T> { return this.result; }
    complete(value: T): void {
        if (this.done)
            return;
        this.done = true;
        this.resolveResult(value);
    }
    fail(error: unknown): void {
        if (this.done)
            return;
        this.done = true;
        this.rejectResult(error);
    }
}
export class ScheduledExecutorService {
    private readonly pending = new Map<ScheduledFuture<unknown>, boolean>();
    private stopped = false;
    submit<T>(task: () => T | Promise<T>): ScheduledFuture<T> { return this.schedule(task, 0, "MILLISECONDS"); }
    execute(task: () => void | Promise<void>): void {
        void this.submit(task).result.catch(error => {
            if (!(error instanceof CancellationException))
                console.error("[ScheduledExecutorService]", error);
        });
    }
    schedule<T>(task: () => T | Promise<T>, delay: number, unit: TimeUnit): ScheduledFuture<T> {
        if (this.stopped)
            throw new Error("Executor is shut down");
        const duration = Math.max(0, millis(delay, unit));
        let timer: ReturnType<typeof setTimeout>;
        const future = new ScheduledFuture<T>(() => { clearTimeout(timer); this.pending.delete(future as ScheduledFuture<unknown>); });
        this.pending.set(future as ScheduledFuture<unknown>, false);
        timer = setTimeout(async () => {
            if (future.isDone())
                return;
            try {
                future.complete(await task());
            }
            catch (error) {
                future.fail(error);
            }
            finally {
                this.pending.delete(future as ScheduledFuture<unknown>);
            }
        }, duration);
        return future;
    }
    scheduleAtFixedRate(task: () => void, initialDelay: number, period: number, unit: TimeUnit): ScheduledFuture<void> { return this.repeat(task, initialDelay, period, unit, false); }
    scheduleWithFixedDelay(task: () => void | Promise<void>, initialDelay: number, delay: number, unit: TimeUnit): ScheduledFuture<void> { return this.repeat(task, initialDelay, delay, unit, true); }
    private repeat(task: () => void | Promise<void>, initialDelay: number, period: number, unit: TimeUnit, fixedDelay: boolean): ScheduledFuture<void> {
        if (this.stopped)
            throw new Error("Executor is shut down");
        if (period <= 0)
            throw new RangeError("Non-positive repeat period");
        const interval = millis(period, unit);
        let timer: ReturnType<typeof setTimeout>, next = Date.now() + Math.max(0, millis(initialDelay, unit));
        const future = new ScheduledFuture<void>(() => { clearTimeout(timer); this.pending.delete(future as ScheduledFuture<unknown>); });
        const run = async () => {
            if (future.isDone())
                return;
            try {
                await task();
                if (future.isDone())
                    return;
                next = fixedDelay ? Date.now() + interval : next + interval;
                timer = setTimeout(run, Math.max(0, next - Date.now()));
            }
            catch (error) {
                future.fail(error);
                this.pending.delete(future as ScheduledFuture<unknown>);
            }
        };
        this.pending.set(future as ScheduledFuture<unknown>, true);
        timer = setTimeout(run, Math.max(0, next - Date.now()));
        return future;
    }
    shutdown(): void {
        this.stopped = true;
        for (const [future, periodic] of this.pending)
            if (periodic)
                future.cancel();
    }
    shutdownNow(): void {
        this.stopped = true;
        for (const future of this.pending.keys())
            future.cancel();
        this.pending.clear();
    }
    isShutdown(): boolean { return this.stopped; }
}
