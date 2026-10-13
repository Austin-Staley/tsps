# RuneLite browser client API

This branch adds real engine adapters for RuneLite gameplay plugins translated from Java to TypeScript. It is **not yet a complete 1:1 drop-in API**. The generated [coverage inventory](runelite-api-coverage.md) lists missing Client methods, exported events, and upstream plugin dependencies without treating matching names as verified behavior.

The reference checkout is RuneLite `3bcd3ce4ddd3490394a9a3dec72b6aa3c4462e91`. Java plugins and Swing panels cannot execute in this browser runtime; panels require React translation. Original notices accompany translated code/assets, with the project license in `client/runelite/LICENSE.txt`.

## Runtime integration

`client/runelite/client/RuneLite.ts` owns the facade, dependency bindings, event-source subscriptions, client-thread queues, script patches, and renderer hooks. Plugins inject the abstract `Client` token; the old `CLIENT_TOKEN` still supplies `OsrsClient` to existing plugins.

Adapters expose real interpreter vars/stacks/scripts, server-var mirrors, inventory/skills/chat/social state, cache definitions/models/sprites, actors, scene objects, instances/world views, menus, input, cameras, hints, and world-map state. Actor/object identity survives unchanged updates; despawns retain the actor snapshot. Varc maps and player-menu arrays are writable native views. Scene arrays retain identity until rebasing, and object/tile adapters are allocated lazily when queried or subscribed to. WebGPU retains real collision metadata rather than returning empty maps.

Native sources emit game events. Packet actor changes and offer updates flush before GameTick. Deferred callbacks and explicit queued varp/skill changes flush at the next client cycle; work scheduled by those handlers waits another cycle. MenuEntryAdded runs during insertion, PostMenuSort after sorting, and consumed menu/input events stop native dispatch.

Widget dispatch preserves an unspecified operation for the native router's op-1 fallback and passes the original dynamic child to native plugins. Menu metadata also uses op one when no operation is supplied. The login flow does not automatically restore a stored username; remembered-username writes require an explicit preferences API call.

Java2D-style Canvas2D overlays are composited at native scene/widget/menu boundaries, including widget-item batches restricted to the requested subtree. Shared services cover client-thread invocation, images/items/sprites, tooltip/infobox/world-map overlays, input managers, notifications, chatbox editing, scheduling, and configuration. Config supports typed geometry, colors, keybinds and profile metadata; profile keys include the login endpoint/account to prevent cross-server collisions.

Regular overlay layers render once per frame and repaint their previous/current bounds through the widget renderer's dirty regions. Tooltips and infoboxes therefore do not require a full widget redraw. Widget/item draw hooks still require a full tree pass. An overlay that paints without reporting bounds conservatively damages its layer's full canvas; the FPS canary reports its top strip. These fallbacks preserve rendering while leaving further performance work explicit.

The actual `RUNELITE_EXECUTE` VM opcode (6599) exposes script callback stacks. The installer imports 33 upstream rs2asm patches and applies each only when its original cache SHA-256 and argument shape match. Incompatible or missing scripts remain unchanged, with an explicit status available as `RuneLite.scriptPatchStatus`. A class declaration does not prove a patch installed successfully.

## Canary and testing

FPS Control is translated from the upstream plugin and disabled by default. Enable it under Configuration, check the FPS indicator, set a global target of 50, and confirm the renderer follows it. Disabling restores normal pacing. Browser scheduling replaces the desktop plugin's thread sleep.

Unit suites cover live adapters, source-driven events, menu consumption/mutation/order, interpreter callbacks and patch compilation, world-view lifetime and moving-boat projection, collision refresh, configuration, drawing state, overlay editing, chatbox lifecycle, world-map data and scheduler disposal. Live testing confirmed the canary starts disabled, draws its indicator, limits rendering to 50 FPS, and restores 120 FPS after disabling. No exhaustive quest/plugin replay was performed.

## Remaining compatibility boundaries

- Client method and model contracts are still incomplete; use the inventory before translating another plugin. Custom RuneLiteObjects, graphics-object collection access, native rasterizer/framebuffer replacement, and several camera/UI controls need additional native integration.
- All directly declared Actor, NPC and PlayerComposition method names have adapters, but inherited Node/render-mode contracts are absent. Modern clan membership and NPC chathead/per-instance overhead-icon metadata have no decoded native source. Spot-animation phases follow the engine's existing clock; discrete posed-model getters do not promise identical GPU interpolation.
- DrawCallbacks exposes actual scene/frame and child-world despawn notifications for browser observers. Atomic scene load/swap and native tile/model/zone rasterizer overrides are rejected explicitly; progressive browser scene streaming cannot supply RuneLite's native GPU lifecycle.
- The server does not supply native OSRS clan/account-hash/world-list state. The login screen's mock numeric world selector is not treated as a world-list or world-change producer. Missing clan, account-hash, fake-XP and related events remain absent rather than fabricated.
- PreMapLoad occurs on the browser main thread when a completed map worker result is about to become resident, rather than the Java map-loader thread. GE offers adapt the same native state read by this client's CS2 market opcodes.
- Advanced overlay origin-relative anchoring/drop-target interactions and full chatbox clipboard/IME handling still differ. Child-world-view minimap projection currently returns null.
- CLEAR/DST drawing behavior was checked against Java AWT, but Canvas compositing coverage for some other rules and compound/transformed curved clip queries still differs. Sprite software drawing does not replace the native GPU scene rasterizer.
- Desktop injected-client version detection has no browser producer and throws an explicit unsupported-operation error. JVM/native socket, launcher, filesystem, OAuth and Swing behavior is outside the browser implementation.
- Cache-backed methods require initialized native cache state. Plugin startup currently follows the existing browser bootstrap rather than RuneLite's desktop initialization sequence.

These limitations are framework/platform gaps, not evidence that a server quest is broken. No quest stages, locations, journals or quest-specific workarounds are changed here.
