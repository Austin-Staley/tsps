import type { OsrsClient } from "../../game/OsrsClient";
import type { ClientImpl } from "../impl/ClientImpl";
import { createGameServices } from "../impl/EngineServices";
import { Client } from "../api/Client";
import { ClientThread } from "./callback/ClientThread";
import { ItemManager } from "./game/ItemManager";
import { SpriteManager } from "./game/SpriteManager";
import { SkillIconManager } from "./game/SkillIconManager";
import { ChatMessageManager } from "./chat/ChatMessageManager";
import { KeyManager } from "./input/KeyManager";
import { MouseManager } from "./input/MouseManager";
import { OverlayManager } from "./ui/overlay/OverlayManager";
import { TooltipManager } from "./ui/overlay/tooltip/TooltipManager";
import { InfoBoxManager } from "./ui/overlay/infobox/InfoBoxManager";
import { FontManager } from "./ui/FontManager";
import type { PluginInjector } from "./plugins/PluginInjector";
import type { EventBus } from "./eventbus/EventBus";
import { ConfigManager } from "./config/ConfigManager";
import { DrawManager } from "./ui/DrawManager";
import { Notifier } from "./Notifier";
import { ScheduledExecutorService } from "./util/ScheduledExecutorService";
import { Gson } from "./util/Gson";
import { ChatboxPanelManager } from "./game/chatbox/ChatboxPanelManager";
import { createChatboxSource } from "../impl/ChatboxSource";
import { ChatboxOverlay } from "./game/chatbox/ChatboxOverlay";
import { WorldMapPointManager } from "./ui/overlay/worldmap/WorldMapPointManager";
import { WorldMapOverlay } from "./ui/overlay/worldmap/WorldMapOverlay";
import { getWorldMapFrame } from "../impl/WorldMapFrame";
import { getOverlayFrame } from "../impl/OverlayCanvas";
import { OverlayInteraction } from "./ui/overlay/OverlayInteraction";

export function bindServices(engine: OsrsClient, facade: ClientImpl, injector: PluginInjector, bus: EventBus) {
    const clientThread = new ClientThread();
    facade.setClientThreadProvider(() => clientThread.isClientThread());
    const game = createGameServices(engine, facade, clientThread);
    const overlayManager = new OverlayManager(injector.get(ConfigManager));
    const tooltipManager = new TooltipManager();
    const infoBoxManager = new InfoBoxManager();
    const keyManager = new KeyManager(facade);
    const mouseManager = new MouseManager();
    let capture: HTMLCanvasElement | undefined;
    const drawManager = new DrawManager(() => {
        const scene = facade.getCanvas();
        const canvas = capture ??= document.createElement("canvas");
        canvas.width = scene.width; canvas.height = scene.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Screenshot canvas is unavailable");
        context.drawImage(scene, 0, 0);
        const host = engine.renderer as unknown as { widgetsOverlay?: { getGLCanvas(): HTMLCanvasElement | undefined } };
        const widgets = host.widgetsOverlay?.getGLCanvas();
        if (widgets) context.drawImage(widgets, 0, 0, canvas.width, canvas.height);
        return canvas;
    }, (fps) => { engine.renderer.fpsLimit = fps ?? (engine.targetFps || 120); });
    const notifier = new Notifier(facade);
    const executor = new ScheduledExecutorService();
    const gson = new Gson();
    const chatboxPanelManager = new ChatboxPanelManager(clientThread, keyManager, createChatboxSource(engine));
    const chatboxOverlay = new ChatboxOverlay(chatboxPanelManager, () => getOverlayFrame(engine, facade).chatbox ?? null);
    const worldMapPointManager = new WorldMapPointManager();
    const worldMapOverlay = new WorldMapOverlay(worldMapPointManager, () => getWorldMapFrame(engine, facade), tooltipManager);
    const overlayInteraction = new OverlayInteraction(overlayManager, () => getOverlayFrame(engine, facade));
    injector.provide(Client, facade).provide(ClientThread, clientThread)
        .provide(ItemManager, game.itemManager).provide(SpriteManager, game.spriteManager)
        .provide(SkillIconManager, game.skillIconManager).provide(ChatMessageManager, game.chatMessageManager)
        .provide(OverlayManager, overlayManager).provide(TooltipManager, tooltipManager)
        .provide(InfoBoxManager, infoBoxManager).provide(KeyManager, keyManager).provide(MouseManager, mouseManager)
        .provide(DrawManager, drawManager).provide(Notifier, notifier).provide(ScheduledExecutorService, executor)
        .provide(Gson, gson).provide(ChatboxPanelManager, chatboxPanelManager).provide(WorldMapPointManager, worldMapPointManager);
    bus.register(keyManager);
    bus.register(chatboxPanelManager);
    mouseManager.registerMouseListener(worldMapOverlay);
    mouseManager.registerMouseListener(overlayInteraction);
    overlayManager.add(chatboxOverlay); overlayManager.add(worldMapOverlay);
    const unkeys = keyManager.bind(engine.inputManager);
    const unmouse = mouseManager.bind(engine.inputManager);
    void FontManager.load().catch((error) => console.warn("[RuneLite] Could not load fonts", error));
    return { ...game, clientThread, overlayManager, tooltipManager, infoBoxManager, drawManager, notifier, executor, keyManager, mouseManager,
        chatboxPanelManager, chatboxOverlay, worldMapPointManager, worldMapOverlay,
        dispose() { unkeys(); unmouse(); bus.unregister(keyManager); bus.unregister(chatboxPanelManager); chatboxPanelManager.close(); executor.shutdownNow(); } };
}
