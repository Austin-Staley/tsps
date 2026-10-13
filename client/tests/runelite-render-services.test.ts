import { strict as assert } from "node:assert";
import { AlphaComposite, Color, Point, Rectangle, Polygon, Dimension, Graphics2D, BasicStroke, Font, BufferedImage } from "../runelite/awt";
import { WidgetItemOverlay } from "@runelite/client/ui/overlay/WidgetItemOverlay";
import { WidgetItem } from "@runelite/api/widgets/WidgetItem";
import type { Widget } from "@runelite/api/widgets/Widget";
import { ItemManager } from "@runelite/client/game/ItemManager";
import type { ItemComposition } from "@runelite/api/ItemComposition";
import * as ItemID from "@runelite/api/gameval/ItemID";
import { ClientThread } from "@runelite/client/callback/ClientThread";
import { Overlay } from "@runelite/client/ui/overlay/Overlay";
import { OverlayManager } from "@runelite/client/ui/overlay/OverlayManager";
import { OverlayRenderer } from "@runelite/client/ui/overlay/OverlayRenderer";
import { OverlayPosition } from "@runelite/client/ui/overlay/OverlayPosition";
import { OverlayLayer } from "@runelite/client/ui/overlay/OverlayLayer";
import { LineComponent } from "@runelite/client/ui/overlay/components/LineComponent";
import { PanelComponent } from "@runelite/client/ui/overlay/components/PanelComponent";
import { TooltipManager } from "@runelite/client/ui/overlay/tooltip/TooltipManager";
import { TooltipOverlay } from "@runelite/client/ui/overlay/tooltip/TooltipOverlay";
import { Tooltip } from "@runelite/client/ui/overlay/tooltip/Tooltip";
import { Timer } from "@runelite/client/ui/overlay/infobox/Timer";
import type { Plugin } from "@runelite/client/plugins/Plugin";
import { Perspective } from "@runelite/api/Perspective";
import { LocalPoint } from "@runelite/api/coords/LocalPoint";
import type { Client } from "@runelite/api/Client";
import { AffineTransform } from "@runelite/awt/geom/AffineTransform";
import { ChatMessageManager } from "@runelite/client/chat/ChatMessageManager";
import { QueuedMessage } from "@runelite/client/chat/QueuedMessage";
import { ChatMessageBuilder } from "@runelite/client/chat/ChatMessageBuilder";
import { ChatColorType } from "@runelite/client/chat/ChatColorType";
import { ChatMessageType } from "@runelite/api/ChatMessageType";
import { OverlayCanvas } from "../runelite/impl/OverlayCanvas";
function recordingContext() {
    const calls: {
        method: string;
        args: unknown[];
    }[] = [];
    const state = { font: "12px sans-serif", fillStyle: "black", strokeStyle: "black", lineWidth: 1, globalAlpha: 1, globalCompositeOperation: "source-over", transform: new AffineTransform() };
    const stack: typeof state[] = [];
    const context = new Proxy(state as typeof state & Record<string, unknown>, {
        get(target, property) {
            if (property in target)
                return target[String(property)];
            const method = String(property);
            return (...args: unknown[]) => {
                calls.push({ method, args });
                if (method === "save")
                    stack.push({ ...state, transform: AffineTransform.from(state.transform) });
                if (method === "restore")
                    Object.assign(state, stack.pop()!);
                if (method === "getTransform")
                    return { a: state.transform.m00, b: state.transform.m10, c: state.transform.m01, d: state.transform.m11, e: state.transform.m02, f: state.transform.m12 };
                if (method === "setTransform")
                    state.transform = new AffineTransform(...args as [
                        number,
                        number,
                        number,
                        number,
                        number,
                        number
                    ]);
                if (method === "translate")
                    state.transform.translate(args[0] as number, args[1] as number);
                if (method === "scale")
                    state.transform.scale(args[0] as number, args[1] as number);
                if (method === "rotate")
                    state.transform.rotate(args[0] as number);
                if (method === "measureText")
                    return { width: String(args[0]).length * 6, fontBoundingBoxAscent: 9, fontBoundingBoxDescent: 3 };
            };
        },
    }) as unknown as CanvasRenderingContext2D;
    return { context, calls, state, stack };
}
assert.equal(new Color(0x123456).getRGB(), 0xff123456 | 0);
assert.equal(new Color(0x40123456, true).getAlpha(), 64);
assert.deepEqual(new Color(0, 0, 0).brighter(), new Color(3, 3, 3));
assert.throws(() => new Color(300, 0, 0), RangeError);
const rect = new Rectangle(new Point(5, 6), new Dimension(10, 20));
assert.deepEqual(rect, new Rectangle(5, 6, 10, 20));
assert.equal(rect.contains(15, 6), false);
assert.deepEqual(rect.intersection(new Rectangle(10, 10, 20, 20)), new Rectangle(10, 10, 5, 16));
const polygon = new Polygon([0, 10, 10, 0], [0, 0, 10, 10]);
assert.equal(polygon.contains(5, 5), true);
assert.equal(polygon.contains(20, 20), false);
const affine = new AffineTransform();
affine.translate(10, 20);
affine.scale(2, 3);
assert.equal(affine.getTranslateX(), 10);
assert.equal(affine.getScaleY(), 3);
const recorded = recordingContext(), graphics = new Graphics2D(recorded.context);
graphics.setColor(Color.RED);
graphics.setStroke(new BasicStroke(3));
graphics.setFont(new Font("RuneScape", Font.PLAIN, 16));
graphics.translate(4, 5);
const child = graphics.create();
child.setColor(Color.CYAN);
child.translate(10, 10);
child.clip(new Rectangle(1, 2, 3, 4));
child.draw(polygon);
child.dispose();
assert.equal(recorded.state.fillStyle, Color.RED.toCSS());
assert.equal(graphics.getTransform().getTranslateX(), 4);
assert.ok(recorded.calls.some(call => call.method === "clip"));
assert.ok(recorded.calls.some(call => call.method === "closePath"));
graphics.setComposite(AlphaComposite.getInstance(AlphaComposite.CLEAR,.25));graphics.setColor(new Color(1,2,3,0));assert.equal(recorded.state.globalCompositeOperation,"destination-out");assert.equal(recorded.state.globalAlpha,1);assert.equal(recorded.state.fillStyle,Color.BLACK.toCSS(),"CLEAR ignores sourcecolor alpha");const beforeClearImage=recorded.calls.length;graphics.drawImage(new BufferedImage({width:3,height:1} as HTMLCanvasElement),1,0,null);assert.ok(recorded.calls.slice(beforeClearImage).some(call=>call.method==="clearRect"&&call.args.join(",")==="1,0,3,1"),"CLEAR erases full image bounds, including transparent pixels, as AWT does");graphics.setComposite(AlphaComposite.getInstance(AlphaComposite.DST,.25));assert.equal(recorded.state.globalCompositeOperation,"source-over");assert.equal(recorded.state.globalAlpha,0,"DST contributes no source pixels");graphics.setComposite(AlphaComposite.SrcOver);assert.equal(recorded.state.globalAlpha,1);graphics.setBackground(new Color(5,6,7,128));assert.equal(graphics.getBackground().getAlpha(),128);graphics.clearRect(1,2,3,4);assert.equal(recorded.state.fillStyle,graphics.getColor().toCSS(),"clearRect restores the caller'spaint state");
assert.equal(graphics.getFontMetrics().stringWidth("hello"), 30);
graphics.setClip(new Rectangle(0, 0, 5, 5));
graphics.setClip(null);
assert.equal(graphics.getClip(), null);
assert.equal(graphics.getTransform().getTranslateY(), 5);
const errors: unknown[] = [], thread = new ClientThread(error => errors.push(error)), order: string[] = [];
thread.invoke(() => order.push("queued"));
assert.deepEqual(order, []);
let retries = 0;
thread.invokeLater(() => { order.push("retry"); return ++retries === 2; });
thread.beginClientTick();
thread.invoke(() => { order.push("immediate"); });
thread.invokeLater(() => { order.push("later"); });
thread.invokeAtTickEnd(() => { order.push("end"); });
thread.endClientTick();
assert.deepEqual(order, ["queued", "retry", "immediate"]);
thread.runTickEnd();
assert.equal(order.at(-1), "end");
thread.runClientTick(() => order.push("body"));
assert.deepEqual(order.slice(-3), ["retry", "later", "body"]);
thread.invokeLater(() => { throw new Error("failed"); });
thread.invokeLater(() => { order.push("survives"); });
thread.runClientTick(() => { });
assert.equal(errors.length, 1);
assert.equal(order.at(-1), "survives");
const manager = new OverlayManager(), renderer = new OverlayRenderer(manager), renders: string[] = [];
class Box extends Overlay {
    constructor(readonly label: string, position: OverlayPosition, layer: OverlayLayer, priority: number) { super(); this.setPosition(position); this.setLayer(layer); this.setPriority(priority); this.setPreferredSize(new Dimension(40, 10)); }
    render(g: Graphics2D): Dimension { renders.push(this.label); g.fillRect(0, 0, 40, 10); return new Dimension(40, 10); }
    after(id: number): void { this.drawAfterInterface(id); }
}
const high = new Box("high", OverlayPosition.TOP_RIGHT, OverlayLayer.ABOVE_WIDGETS, .75), low = new Box("low", OverlayPosition.TOP_RIGHT, OverlayLayer.ABOVE_WIDGETS, .25);
manager.add(low);
manager.add(high);
assert.equal(manager.add(high), false);
const dynamicHigh = new Box("dynamic-high", OverlayPosition.DYNAMIC, OverlayLayer.UNDER_WIDGETS, .75), dynamicLow = new Box("dynamic-low", OverlayPosition.DYNAMIC, OverlayLayer.UNDER_WIDGETS, .25);
manager.add(dynamicHigh);
manager.add(dynamicLow);
const manual = new Box("manual", OverlayPosition.DYNAMIC, OverlayLayer.MANUAL, 0);
manual.after(12);
manager.add(manual);
const frame = { canvas: new Rectangle(0, 0, 900, 600), viewport: new Rectangle(100, 50, 600, 400) };
renderer.beginFrame();
renderer.renderLayer(graphics, OverlayLayer.UNDER_WIDGETS, frame);
assert.deepEqual(renders, ["dynamic-low", "dynamic-high"]);
renderer.renderLayer(graphics, OverlayLayer.ABOVE_WIDGETS, frame);
assert.deepEqual(high.getBounds(), new Rectangle(655, 55, 40, 10));
assert.deepEqual(low.getBounds(), new Rectangle(655, 67, 40, 10));
renderer.renderAfterWidget(graphics, (12 << 16) | 0xffff, frame);
assert.equal(renders.at(-1), "manual");
assert.equal(recorded.calls.filter(call => call.method === "clip").length >= 3, true, "dynamic overlays are clipped to the scene");
manager.removeIf(overlay => overlay === manual);
assert.equal(manager.anyMatch(overlay => overlay === manual), false);
const panel = new PanelComponent();
panel.getChildren().push(LineComponent.builder().left("Quest").right("1/3").build());
panel.setPreferredLocation(new Point(10, 20));
assert.deepEqual(panel.render(graphics), new Dimension(129, 20));
assert.deepEqual(panel.getBounds(), new Rectangle(10, 20, 129, 20));
const tips = new TooltipManager(), tooltip = new TooltipOverlay(tips, () => new Point(880, 580), () => frame.canvas);
tips.add(new Tooltip("<col=ff0000>hello</col>"));
assert.ok(tooltip.render(graphics));
assert.equal(tips.getTooltips().length, 0, "tooltips last one rendered frame");
// Overlay pixels are prepared once, then composited into bounded dirty regions.
{
    const oldDocument = (globalThis as any).document;
    const overlayManager = new OverlayManager();
    let count = 0;
    class CounterOverlay extends Overlay {
        render(g: Graphics2D) { count++; g.fillRect(0, 0, 40, 20); return new Dimension(40, 20); }
    }
    class EmptyOverlay extends Overlay { render() { return null; } }
    const empty = new EmptyOverlay(); empty.setLayer(OverlayLayer.ABOVE_WIDGETS); overlayManager.add(empty);
    const counter = new CounterOverlay();
    counter.setLayer(OverlayLayer.ABOVE_WIDGETS); counter.setPreferredLocation(new Point(100, 120));
    overlayManager.add(counter);
    const tipManager = new TooltipManager();
    const boundedTooltip = new TooltipOverlay(tipManager, () => new Point(700, 550), () => new Rectangle(0, 0, 800, 600));
    overlayManager.add(boundedTooltip);
    const engine: any = { isLoggedIn: () => true, renderer: {}, runeLite: { clientApi: { getCanvasWidth: () => 800, getCanvasHeight: () => 600 } } };
    const canvas = new OverlayCanvas(engine, overlayManager);
    let scissorEnabled = false, scissor = [0, 0, 800, 600], blits = 0;
    const gl: any = { width: 800, height: 600, textures: new Map(), flush() {}, drawTexture() { blits++; },
        updateTextureFromCanvas(key: string) { const texture = {}; this.textures.set(key, texture); return texture; },
        gl: { SCISSOR_BOX: 1, SCISSOR_TEST: 2, getParameter: () => scissor.slice(), isEnabled: () => scissorEnabled,
            enable() { scissorEnabled = true; }, disable() { scissorEnabled = false; }, scissor(...values: number[]) { scissor = values; } } };
    (globalThis as any).document = { createElement: () => ({ width: 800, height: 600, getContext: () => recordingContext().context }) };
    try {
        tipManager.add(new Tooltip("hello"));
        canvas.beginFrame();
        const dirty = canvas.prepare(gl);
        assert.ok(dirty.some(r => r.x === 99 && r.y === 119 && r.w === 42 && r.h === 22));
        assert.ok(dirty.every(r => r.w < 800 && r.h < 600), "an active overlay does not dirty the full widget canvas");
        assert.ok(boundedTooltip.getBounds().x > 600, "tooltip bounds track the pixels by the cursor");
        const clip = { x: 99, y: 119, w: 42, h: 22 };
        canvas.draw(gl, OverlayLayer.ABOVE_WIDGETS, undefined, [], clip);
        canvas.draw(gl, OverlayLayer.ABOVE_WIDGETS, undefined, [], clip);
        assert.equal(count, 1, "multiple dirty rectangles do not rerun the plugin render callback");
        assert.equal(blits, 2);
        assert.equal(scissorEnabled, false);
        assert.deepEqual(scissor, [0, 0, 800, 600], "composition restores native GL clipping");
        overlayManager.remove(counter); canvas.beginFrame();
        assert.deepEqual(canvas.prepare(gl), []);
        canvas.draw(gl, OverlayLayer.ABOVE_WIDGETS);
        assert.equal(blits, 2, "removed overlays cannot leave cached pixels active");
        class UnboundedOverlay extends Overlay { render(g: Graphics2D) { g.fillRect(50, 50, 10, 10); return null; } }
        const unbounded = new UnboundedOverlay(); unbounded.setLayer(OverlayLayer.ABOVE_WIDGETS); overlayManager.add(unbounded);
        canvas.beginFrame();
        assert.deepEqual(canvas.prepare(gl), [{ x: 0, y: 0, w: 800, h: 600 }], "unbounded draws remain visible instead of being silently dropped");
    } finally { canvas.dispose(); (globalThis as any).document = oldDocument; }
}
let now = 1000;
const fakeImage = new BufferedImage({ width: 1, height: 1 } as HTMLCanvasElement), timer = new Timer(10, "SECONDS", fakeImage, { constructor: { name: "Test" } } as unknown as Plugin, () => now);
assert.equal(timer.getText(), "0:10");
now = 10500;
assert.equal(timer.getTextColor().equals(Color.RED.brighter()), true);
now = 11000;
assert.equal(timer.cull(), true);
const fakeClient = {
    getWorldView: (id: number) => id === -1 ? { getPlane: () => 0, isTopLevel: () => true, getSizeX: () => 104, getSizeY: () => 104 } : null,
    getTileHeight: (x: number, y: number) => x + y,
    getMinimapZoom: () => 4, getMinimapBounds: () => new Rectangle(700, 0, 150, 150), getCameraYawTarget: () => 0,
    getLocalPlayer: () => ({ getLocalLocation: () => LocalPoint.fromScene(50, 50) }),
} as unknown as Client;
const points: number[][] = [];
Perspective.setProjector(fakeClient, (x, y, z) => { points.push([x, y, z]); return new Point(x, y); });
const poly = Perspective.getCanvasTilePoly(fakeClient, LocalPoint.fromScene(2, 3), 10)!;
assert.deepEqual(poly.xpoints, [256, 384, 384, 256]);
assert.deepEqual(poly.ypoints, [384, 384, 512, 512]);
assert.deepEqual(points[0], [256, 384, 630]);
assert.deepEqual(Perspective.localToMinimap(fakeClient, LocalPoint.fromScene(51, 50)), new Point(779, 75));
assert.equal(Perspective.localToMinimap(fakeClient, LocalPoint.fromScene(75, 50)), null, "default minimap distance follows RuneLite cutoff");
assert.equal(Perspective.getCanvasTilePoly(fakeClient, LocalPoint.fromScene(130, 3)), null, "outside extended scene does not project");
const posted: unknown[][] = [];
const chatClient = { addChatMessage: (...args: unknown[]) => { posted.push(args); return { setTimestamp: () => { } }; }, refreshChat: () => { } } as unknown as Client;
const chat = new ChatMessageManager(chatClient, thread);
chat.cacheColor(ChatMessageType.GAMEMESSAGE, ChatColorType.HIGHLIGHT, Color.RED, false);
const message = new ChatMessageBuilder().append(ChatColorType.HIGHLIGHT).append("Hello").build();
chat.queue(QueuedMessage.builder().type(ChatMessageType.GAMEMESSAGE).runeLiteFormattedMessage(message).build());
assert.equal(posted.length, 0);
thread.runClientTick(() => { });
assert.equal(posted[0][2], "<col=ff0000>Hello");
const clipRect = new Rectangle(10, 20, 30, 40);
graphics.setClip(clipRect);
clipRect.x = 999;
assert.equal(graphics.getClipBounds()!.x, 10, "clip uses a geometry snapshot");
graphics.translate(5, 6);
assert.equal(graphics.getClip()!.contains(6, 15), true, "clip coordinates follow the current transform");
graphics.setClip(null);
const widgetClips: (Rectangle | null)[] = [], itemIds: number[] = [];
class Items extends WidgetItemOverlay {
    constructor() { super(); this.showOnBank(); }
    renderItemOverlay(g: Graphics2D, id: number): void { itemIds.push(id); widgetClips.push(g.getClipBounds()); }
}
const itemsOverlay = new Items();
manager.add(itemsOverlay);
const parent = { getBounds: () => new Rectangle(5, 5, 50, 50) } as Widget, parent2 = { getBounds: () => new Rectangle(100, 100, 50, 50) } as Widget;
const widget = { getParent: () => parent } as Widget, widget2 = { getParent: () => parent2 } as Widget;
const items = [new WidgetItem(100, 1, new Rectangle(0, 0, 20, 20), widget, null), new WidgetItem(200, 1, new Rectangle(110, 110, 20, 20), widget2, null)];
renderer.renderAfterWidget(graphics, itemsOverlay.getDrawHooks()[0], frame, items);
assert.deepEqual(itemIds, [100, 200]);
assert.deepEqual(widgetClips[0], parent.getBounds());
assert.equal(widgetClips[1], null);
assert.equal(manager.getWidgetItems().length, 0);
assert.throws(() => itemsOverlay.setPosition(OverlayPosition.TOP_LEFT), /fixed/);
const oldDocument = globalThis.document;
let ready = false, loadedCalls = 0;
const iconThread = new ClientThread();
Object.assign(globalThis, { document: { createElement: () => ({ width: 0, height: 0, getContext: () => recorded.context }) } });
try {
    const icons = new ItemManager({ getItemComposition: () => ({ getNote: () => -1, getPlaceholderTemplateId: () => -1 } as ItemComposition), getItemPrice: id => id, getImage: () => ready ? new BufferedImage({ width: 36, height: 32 } as HTMLCanvasElement) : null }, iconThread);
    const icon = icons.getImage(100)!;
    icon.onLoaded(() => { loadedCalls++; });
    iconThread.runClientTick(() => { });
    assert.equal(icon.isLoaded(), false);
    assert.equal(icons.getImage(100), icon);
    ready = true;
    iconThread.runClientTick(() => { });
    assert.equal(icon.isLoaded(), true);
    assert.equal(loadedCalls, 1);
    icon.onLoaded(() => { loadedCalls++; });
    assert.equal(loadedCalls, 1);
    iconThread.runClientTick(() => { });
    assert.equal(loadedCalls, 2);
    assert.equal(icons.canonicalize(ItemID.IKOV_BOOTSOFLIGHTNESSWORN), ItemID.IKOV_BOOTSOFLIGHTNESS);
}
finally {
    if (oldDocument === undefined)
        delete (globalThis as typeof globalThis & {
            document?: Document;
        }).document;
    else
        globalThis.document = oldDocument;
}
graphics.dispose();
assert.equal(recorded.stack.length, 0, "graphics state balanced across layers and components");
console.log("RuneLite drawing, projection, overlay, infobox, chat and client-thread tests passed");
