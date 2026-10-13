import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Plugin } from "../runelite/client/plugins/Plugin";
import { PluginManager } from "../runelite/client/plugins/PluginManager";
import { ConfigManager } from "../runelite/client/config/ConfigManager";
import { EventBus } from "../runelite/client/eventbus/EventBus";
import { ClientThread } from "../runelite/client/callback/ClientThread";
import { CallbacksImpl } from "../runelite/impl/CallbacksImpl";
import { KeyManager } from "../runelite/client/input/KeyManager";
import { MouseManager } from "../runelite/client/input/MouseManager";
import { bindQueuedChanges, queueChangedSkill, queueChangedVarp } from "../runelite/impl/events/queuedChanges";
import { ClientTick, StatChanged, VarbitChanged } from "../runelite/api/events";
import { Skill } from "../runelite/api/Skill";
import type { ClientImpl } from "../runelite/impl/ClientImpl";

async function main() {
    // Desktop GL plugin modules expect a worker/browser self even though no renderer is constructed.
    (globalThis as any).self = globalThis;
    require.extensions[".glsl"] = (module, file) => { module.exports = readFileSync(file, "utf8"); };
    for (const extension of [".png", ".jpg", ".webp"]) require.extensions[extension] = (module, file) => { module.exports = file; };
    const { RuneLite } = await import("../runelite/client/RuneLite");
    const bus = new EventBus(), clientThread = new ClientThread();
    const facade = { getVarpValue: (id: number) => id * 10, getSkillExperience: () => 1000, getRealSkillLevel: () => 9, getBoostedSkillLevel: () => 10 } as unknown as ClientImpl;
    const queued = bindQueuedChanges(facade, bus);
    const callbacks = new CallbacksImpl(bus, new MouseManager(), new KeyManager(), { tick() {}, tickEnd() {}, frame() {}, serverTick() {}, openUrl() {}, isOutdated: () => false });
    const runtime: any = Object.create(RuneLite.prototype);
    Object.assign(runtime, { services: { clientThread }, callbacks, bridge: { prepareQueued: () => queued.prepare() }, eventBus: bus });
    let tick = 0;
    const seen: string[] = [];
    class Deferred {}
    bus.subscribe(Deferred, () => { seen.push(`deferred:${tick}:${clientThread.isClientThread()}`); queueChangedVarp(2); });
    bus.subscribe(StatChanged, () => seen.push(`skill:${tick}`));
    bus.subscribe(VarbitChanged, e => seen.push(`varp${e.getVarpId()}:${tick}`));
    bus.subscribe(ClientTick, () => seen.push(`tick:${tick}`));
    clientThread.invokeLater(() => { callbacks.postDeferred(new Deferred()); queueChangedSkill(Skill.ATTACK); queueChangedVarp(1); });
    tick = 1; runtime.postClientTick(); clientThread.endClientTick();
    assert.deepEqual(seen, ["tick:1"], "start-of-tick tasks defer their events until the following tick");
    tick = 2; runtime.postClientTick(); clientThread.endClientTick();
    assert.deepEqual(seen, ["tick:1", "deferred:2:true", "varp1:2", "skill:2", "tick:2"], "both queues were captured before deferred subscribers queue additional work");
    tick = 3; runtime.postClientTick(); clientThread.endClientTick();
    assert.deepEqual(seen.slice(-2), ["varp2:3", "tick:3"]);
    callbacks.postDeferred(new Deferred()); const captured = callbacks.prepareDeferred(); callbacks.dispose(); captured();
    queued.dispose(); clientThread.dispose();
    clientThread.invokeLater(() => seen.push("disposed task")); clientThread.beginClientTick();
    assert.equal(seen.includes("disposed task"), false);

    const stoppingThread = new ClientThread();
    stoppingThread.beginClientTick(); stoppingThread.invokeAtTickEnd(() => stoppingThread.dispose()); stoppingThread.runTickEnd();
    assert.equal(stoppingThread.isClientThread(), false, "tick-end finally does not restore a disposed thread to active");

    const lifecycle: string[] = [], resources = new Set<string>();
    let finishStart!: () => void, finishStop!: () => void;
    const startGate = new Promise<void>(resolve => { finishStart = resolve; });
    const stopGate = new Promise<void>(resolve => { finishStop = resolve; });
    class SlowPlugin extends Plugin {
        static descriptor = { name: "Slow shutdown fixture" };
        protected async startUp() { await startGate; resources.add("late startup resource"); lifecycle.push("startup finished"); }
        protected async shutDown() { lifecycle.push("shutdown started"); await stopGate; resources.clear(); lifecycle.push("shutdown finished"); }
        onClientTick() { lifecycle.push("stale subscriber"); }
    }
    const shutdownBus = new EventBus(), config = new ConfigManager(shutdownBus), manager = new PluginManager(shutdownBus, config);
    manager.loadCorePlugins([SlowPlugin]);
    const disposal: any = Object.create(RuneLite.prototype);
    Object.assign(disposal, {
        pluginManager: manager, disposers: [], callbacks: { dispose() {} }, bridge: { dispose() {} },
        services: { clientThread: new ClientThread(), dispose: () => lifecycle.push("services disposed") },
        overlayCanvas: { dispose: () => lifecycle.push("overlay disposed") }, configManager: config,
    });
    RuneLite.instance = disposal;
    const shutdown = disposal.destroy();
    disposal.onCacheReady({}); // An old cache request must not reinstall hooks after teardown.
    assert.equal(disposal.destroy(), shutdown, "runtime destruction is idempotent while cleanup is pending");
    assert.equal(manager.isEnabled(SlowPlugin), false);
    assert.equal(RuneLite.instance, undefined, "replacement runtime can start during old cleanup");
    await manager.setPluginEnabled(SlowPlugin, true);
    assert.equal(manager.isEnabled(SlowPlugin), false, "shutdown blocks new plugin starts");
    assert.deepEqual(lifecycle, [], "services survive pending startup until it can be cleaned");
    finishStart();
    for (let i = 0; i < 12; i++) await Promise.resolve();
    assert.deepEqual(lifecycle, ["startup finished", "shutdown started"]);
    shutdownBus.post(new ClientTick());
    assert.equal(lifecycle.includes("stale subscriber"), false, "an old startup cannot register after destruction");
    finishStop(); await shutdown;
    assert.equal(resources.size, 0);
    assert.deepEqual(lifecycle, ["startup finished", "shutdown started", "shutdown finished", "services disposed", "overlay disposed"]);
    assert.equal(manager.getPlugin(SlowPlugin)!.isStarted(), false);
    // A plugin can synchronously initiate teardown from startup itself. It must already
    // be tracked before its callback executes, so late resources receive shutdown cleanup.
    let releaseSelf!: () => void, selfShutdown!: Promise<void>, reentrantCleaned = false;
    const selfGate = new Promise<void>(resolve => { releaseSelf = resolve; });
    const reentrantManager = new PluginManager(new EventBus(), new ConfigManager());
    class ReentrantPlugin extends Plugin {
        static descriptor = { name: "Reentrant shutdown fixture" };
        protected async startUp() { selfShutdown = reentrantManager.shutdown(); await selfGate; }
        protected async shutDown() { reentrantCleaned = true; }
    }
    reentrantManager.loadCorePlugins([ReentrantPlugin]);
    releaseSelf(); await selfShutdown;
    assert.equal(reentrantCleaned, true, "synchronous teardown inside startup waits for its cleanup");

    runtime.destroyed = true; runtime.postClientTick(); assert.equal(seen.at(-1), "tick:3");
    console.log("RuneLite next-tick queue snapshots and in-flight startup/shutdown teardown passed");
}
void main();
