export class ConfigChanged {
    constructor(
        private readonly group: string,
        private readonly key: string,
        private readonly oldValue: string | undefined,
        private readonly newValue: string | undefined,
        private readonly profile?: string,
    ) {}

    getGroup(): string {
        return this.group;
    }
    getProfile(): string | null { return this.profile ?? null; }

    getKey(): string {
        return this.key;
    }

    getOldValue(): string | null {
        return this.oldValue ?? null;
    }

    getNewValue(): string | null {
        return this.newValue ?? null;
    }
}
