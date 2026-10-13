import { subscribePluginMessages } from "../../network/serverConnection/domain/pluginMessages";
import { PluginMessage } from "@runelite/api/events/PluginMessage";
import { GameStateChanged } from "@runelite/api/events";
import { ClientTick } from "@runelite/api/events/ClientTick";
import { CommandExecuted } from "@runelite/api/events/CommandExecuted";
import { FocusChanged } from "@runelite/api/events/FocusChanged";
import { GameTick } from "@runelite/api/events/GameTick";
import { PostClientTick } from "@runelite/api/events/PostClientTick";
import { BeforeRender } from "@runelite/api/events/BeforeRender";
import type { OsrsClient } from "../../game/OsrsClient";
import { subscribeTick } from "../../network/serverConnection/timing";
import { ConfigManager } from "./config/ConfigManager";
import { EventBus } from "./eventbus/EventBus";
import { PluginManager } from "./plugins/PluginManager";
import { ClientToolbar } from "./ui/ClientToolbar";
import { CLIENT_TOKEN } from "./plugins/PluginInjector";
import { CORE_PLUGINS, LEGACY_CONFIG_MIGRATIONS } from "./plugins";
import { toRuneLiteGameState } from "../impl/GameStateMapping";
import { runLegacyConfigMigrations } from "../impl/LegacyConfigMigration";
import { ClientImpl } from "../impl/ClientImpl";
import { bindRuneLiteEvents } from "../impl/events";
import { bindServices } from "./BootstrapServices";
import { MenuImpl } from "../impl/MenuImpl";
import { bindMenuEvents } from "../impl/MenuEventAdapter";
import { OverlayCanvas } from "../impl/OverlayCanvas";
import { OverlayLayer } from "./ui/overlay/OverlayLayer";
import { TooltipOverlay } from "./ui/overlay/tooltip/TooltipOverlay";
import { InfoBoxOverlay } from "./ui/overlay/infobox/InfoBoxOverlay";
import { Rectangle } from "../awt";
import type { GLRenderer } from "../../widgets/gl/renderer";
import type { ClientScriptLoader } from "../../game/cs2/ClientScriptLoader";
import { installRuneLiteScriptPatches, type PatchStatus } from "../impl/scripts/install";
import { CanvasSizeChanged } from "../api/events/CanvasSizeChanged";
import { UsernameChanged } from "../api/events/UsernameChanged";
import { RuneScapeProfileChanged } from "./events/RuneScapeProfileChanged";
import { GameState } from "../api/GameState";
import { Callbacks } from "../api/hooks/Callbacks";
import { CallbacksImpl } from "../impl/CallbacksImpl";
import { DrawCallbackDispatcher, bindDrawCallbackLifecycle } from "../impl/DrawCallbackDispatcher";
import { getWorldMapFrame } from "../impl/WorldMapFrame";
import { ResizeableChanged } from "../api/events/ResizeableChanged";
import type { WidgetNode } from "../../widgets/WidgetNode";
import type { WidgetItem } from "../api/widgets/WidgetItem";
import { WidgetItemOverlay } from "./ui/overlay/WidgetItemOverlay";
import { widgetItemsForHook } from "../impl/WidgetItemBatch";

/**
 * Boots the RuneLite-shaped plugin runtime around an OsrsClient: singletons,
 * injector bindings, engine event emitters, legacy config migration and the
 * core plugin list. OsrsClient calls `RuneLite.start(this)` once.
 */
export class RuneLite {
    static instance?: RuneLite;

    readonly eventBus = new EventBus();
    readonly configManager: ConfigManager;
    readonly pluginManager: PluginManager;
    /** The sidebar's buttons, added by plugins (`inject(ClientToolbar)`). */
    readonly clientToolbar: ClientToolbar;
    readonly clientApi: ClientImpl;
    readonly services: ReturnType<typeof bindServices>;
    readonly callbacks: CallbacksImpl;
    readonly drawCallbacks: DrawCallbackDispatcher;
    private readonly bridge: ReturnType<typeof bindRuneLiteEvents>;
    private readonly overlayCanvas: OverlayCanvas;
    private readonly tooltipOverlay: TooltipOverlay;
    private readonly infoBoxOverlay: InfoBoxOverlay;
    private readonly disposers: Array<() => void> = [];
    private pendingGameTicks = 0;
    private destroyed = false;
    private destroyPromise?: Promise<void>;
    private readonly overlayDrawHooks = new Set<number>();
    private readonly itemBatches = new Map<number, Map<WidgetNode, WidgetItem[]>>();
    private collectWidgetItems = false;
    private scriptPatches?: ReturnType<typeof installRuneLiteScriptPatches>;
    scriptPatchStatus: readonly PatchStatus[] = [];
    private resizeSource?: OsrsClient["renderer"];
    private readonly canvasResized = () => this.eventBus.post(new CanvasSizeChanged());

    private constructor(private readonly client: OsrsClient) {
        this.configManager = new ConfigManager(this.eventBus);
        this.pluginManager = new PluginManager(this.eventBus, this.configManager);
        this.clientToolbar = this.pluginManager.getInjector().get(ClientToolbar);
        this.clientApi = new ClientImpl(client);
        this.services = bindServices(client, this.clientApi, this.pluginManager.getInjector(), this.eventBus);
        this.callbacks = new CallbacksImpl(this.eventBus, this.services.mouseManager, this.services.keyManager, {
            tick: () => this.postClientTick(), tickEnd: () => this.postPostClientTick(),
            frame: () => this.postBeforeRender(), serverTick: () => { this.pendingGameTicks++; },
            openUrl: (url) => {
                const target = new URL(url, window.location.href);
                if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error("Only HTTP(S) links are supported");
                window.open(target.href, "_blank", "noopener,noreferrer");
            },
            isOutdated: () => { throw new Error("Desktop injected-client version detection is unavailable in the browser runtime"); },
        });
        this.clientApi.setCallbacks(this.callbacks);
        this.pluginManager.getInjector().provide(Callbacks, this.callbacks);
        this.drawCallbacks = new DrawCallbackDispatcher(this.clientApi);
        this.clientApi.setDrawCallbackProvider(this.drawCallbacks);
        this.disposers.push(bindDrawCallbackLifecycle(client.worldViewManager, this.clientApi, this.drawCallbacks));
        this.bridge = bindRuneLiteEvents(client, this.clientApi, this.eventBus);
        this.overlayCanvas = new OverlayCanvas(client, this.services.overlayManager);
        const mouse = () => this.clientApi.getMouseCanvasPosition();
        this.tooltipOverlay = new TooltipOverlay(this.services.tooltipManager, mouse,
            () => new Rectangle(0, 0, this.clientApi.getCanvasWidth(), this.clientApi.getCanvasHeight()));
        this.infoBoxOverlay = new InfoBoxOverlay(this.services.infoBoxManager, this.services.tooltipManager, mouse);
        this.services.overlayManager.add(this.tooltipOverlay);
        this.services.overlayManager.add(this.infoBoxOverlay);
        const menu = new MenuImpl(this.clientApi, () => {
            const renderer = client.renderer as unknown as { widgetsOverlay?: { getGLCanvas(): HTMLCanvasElement | undefined } };
            const canvas = renderer?.widgetsOverlay?.getGLCanvas() as (HTMLCanvasElement & { __ui?: { __menuRt?: { mainRect?: { x: number; y: number; w: number; h: number } } } }) | undefined;
            const rect = canvas?.__ui?.__menuRt?.mainRect;
            return { x: rect?.x ?? client.menuX, y: rect?.y ?? client.menuY, width: rect?.w ?? 0, height: rect?.h ?? 0 };
        });
        this.clientApi.setMenuService(menu);
        this.disposers.push(bindMenuEvents(this.clientApi, menu, this.eventBus));
    }

    static start(client: OsrsClient): RuneLite {
        if (RuneLite.instance) return RuneLite.instance;
        const instance = new RuneLite(client);
        RuneLite.instance = instance;
        instance.load();
        return instance;
    }

    /** Posts a CommandExecuted event; returns true when a subscriber consumed it. */
    postCommandExecuted(command: string): void {
        this.eventBus.post(new CommandExecuted(command));
    }

    postClientTick(): void {
        if (this.destroyed) return;
        // Snapshot both queues before callbacks or tick-start tasks can enqueue next-tick work.
        const deferred = this.callbacks.prepareDeferred();
        const queued = this.bridge.prepareQueued();
        this.services.clientThread.beginClientTick(() => { deferred(); queued(); });
        if (!this.destroyed) this.eventBus.post(new ClientTick());
    }

    postPostClientTick(): void {
        if (this.destroyed) return;
        this.bridge.flush();
        while (this.pendingGameTicks > 0) {
            this.pendingGameTicks--;
            this.clientApi.advanceTickCount();
            this.eventBus.post(new GameTick());
        }
        this.services.clientThread.runTickEnd();
        this.eventBus.post(new PostClientTick());
        this.services.clientThread.endClientTick();
    }

    postBeforeRender(): void {
        this.overlayCanvas.beginFrame();
        this.overlayDrawHooks.clear();
        this.itemBatches.clear();
        this.collectWidgetItems = this.services.overlayManager.anyMatch(overlay => overlay instanceof WidgetItemOverlay);
        for (const overlay of this.services.overlayManager.getOverlays()) for (const hook of overlay.getDrawHooks()) this.overlayDrawHooks.add(hook);
        this.eventBus.post(new BeforeRender());
    }

    onCacheReady(scripts: ClientScriptLoader): void {
        if (this.destroyed) return;
        this.bridge.sync();
        this.bindResizeSource();
        this.scriptPatches?.dispose();
        this.scriptPatches = installRuneLiteScriptPatches(scripts);
        const patches = this.scriptPatches;
        void patches.ready.then((status) => { if (this.scriptPatches === patches) this.scriptPatchStatus = status; }).catch((error) => console.error("[RuneLite] Script patch installation failed", error));
    }
    postDrawComplete(): void {
        this.bindResizeSource();
        this.services.drawManager.processDrawComplete();
        this.drawCallbacks.afterFrame(0);
    }
    postResizeableChanged(resized: boolean): void { this.eventBus.post(new ResizeableChanged(resized)); }
    private bindResizeSource(): void {
        if (this.resizeSource === this.client.renderer) return;
        this.resizeSource?.canvasResizeListeners.delete(this.canvasResized);
        this.resizeSource = this.client.renderer;
        this.resizeSource?.canvasResizeListeners.add(this.canvasResized);
    }
    hasPluginOverlays(): boolean {
        return this.services.overlayManager.anyMatch((overlay) => overlay !== this.tooltipOverlay && overlay !== this.infoBoxOverlay &&
                overlay !== this.services.chatboxOverlay && overlay !== this.services.worldMapOverlay) ||
            this.services.tooltipManager.getTooltips().length > 0 || this.services.infoBoxManager.getInfoBoxes().length > 0 ||
            this.services.chatboxPanelManager.getCurrentInput() !== null ||
            (this.services.worldMapPointManager.getWorldMapPoints().length > 0 && getWorldMapFrame(this.client, this.clientApi) !== null);
    }
    preparePluginOverlays(gl: GLRenderer) {
        return { rects: this.hasPluginOverlays() ? this.overlayCanvas.prepare(gl) : [],
            // shortcut: widget/item draw hooks need a full tree pass; use bounded hook batches when these are profiled.
            fullRedraw: this.overlayDrawHooks.size > 0 || this.collectWidgetItems };
    }
    drawPluginOverlays(gl: GLRenderer, layer: OverlayLayer, widgetId?: number, clip?: { x: number; y: number; w: number; h: number }): void {
        if (widgetId !== undefined && !this.overlayDrawHooks.has(widgetId)) return;
        const batches = widgetId === undefined ? undefined : this.itemBatches.get(widgetId >>> 16);
        const items = batches ? widgetItemsForHook(widgetId!, [...batches.values()].flat()) : [];
        this.overlayCanvas.draw(gl, layer, widgetId, items, clip);
    }
    afterWidgetDrawn(gl: GLRenderer, widget: WidgetNode): void {
        if (this.collectWidgetItems) {
            const wrapper = this.clientApi.wrapWidget(widget);
            const own = wrapper.ownItem();
            const items = widget.type === 2 ? wrapper.getWidgetItems() : own ? [own] : [];
            if (items.length) {
                const group = widget.uid >>> 16;
                let batch = this.itemBatches.get(group);
                if (!batch) this.itemBatches.set(group, batch = new Map());
                batch.set(widget, items);
            }
        }
        if (widget.fileId !== -1) this.drawPluginOverlays(gl, OverlayLayer.MANUAL, widget.uid);
    }
    destroy(): Promise<void> {
        if (this.destroyPromise) return this.destroyPromise;
        this.destroyed = true;
        // Stops new registration immediately. Pending startup finishes before plugin cleanup.
        const shutdown = this.pluginManager.shutdown();
        for (const dispose of this.disposers.splice(0)) dispose();
        this.scriptPatches?.dispose();
        this.callbacks.dispose();
        this.services.clientThread.dispose();
        this.resizeSource?.canvasResizeListeners.delete(this.canvasResized);
        this.bridge.dispose();
        if (RuneLite.instance === this) RuneLite.instance = undefined;
        this.destroyPromise = shutdown.then(() => {
            try { this.services.dispose(); }
            finally { try { this.overlayCanvas.dispose(); } finally { this.configManager.destroy(); } }
        });
        // The native owner's synchronous HMR teardown cannot await, but callers may do so.
        void this.destroyPromise.catch(error => console.error("[RuneLite] Runtime shutdown failed", error));
        return this.destroyPromise;
    }

    private load(): void {
        const injector = this.pluginManager.getInjector();
        injector.provide(CLIENT_TOKEN, this.client);

        this.disposers.push(this.client.stateMachine.subscribe((transition) => {
            const state = toRuneLiteGameState(transition.to);
            if (state === GameState.LOGGED_IN || state === GameState.LOGIN_SCREEN) {
                const login = this.client.loginState;
                const profile = state === GameState.LOGGED_IN ? encodeURIComponent(`${login.serverSignalUrl ?? login.serverAddress}/${login.serverWorldId ?? login.worldId}/${login.username.toLowerCase()}`).replace(/\./g, "%2E") : undefined;
                if (profile !== this.configManager.getRSProfileKey()) {
                    this.configManager.setRSProfileKey(profile);
                    this.eventBus.post(new RuneScapeProfileChanged());
                }
            }
            this.eventBus.post(new GameStateChanged(state));
        }));
        const usernameChanged = () => this.eventBus.post(new UsernameChanged());
        this.client.loginState.usernameChangedListeners.add(usernameChanged);
        this.disposers.push(() => { this.client.loginState.usernameChangedListeners.delete(usernameChanged); });

        this.disposers.push(subscribePluginMessages(({ channel, data }) => this.eventBus.post(new PluginMessage(channel, data))));

        // Flush packet-driven actor changes before the server tick reaches plugin handlers.
        this.disposers.push(subscribeTick(() => { this.pendingGameTicks++; }));

        if (typeof window !== "undefined") {
            const focus = () => this.eventBus.post(new FocusChanged(true));
            const blur = () => this.eventBus.post(new FocusChanged(false));
            window.addEventListener("focus", focus);
            window.addEventListener("blur", blur);
            this.disposers.push(() => { window.removeEventListener("focus", focus); window.removeEventListener("blur", blur); });
        }

        runLegacyConfigMigrations(LEGACY_CONFIG_MIGRATIONS, this.configManager);
        this.pluginManager.loadCorePlugins(CORE_PLUGINS);

        // Engine hooks (shader, camera, gameframe) follow each loaded plugin.
        for (const plugin of this.pluginManager.getPlugins()) {
            this.client.clientPlugins.add(plugin);
        }
    }
}
