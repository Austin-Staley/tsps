import assert from "node:assert/strict";
import { MapManager } from "../game/MapManager";
import { SceneRegistry } from "../runelite/impl/SceneRegistry";
import { bindSceneEvents } from "../runelite/impl/events/scene";
import { EventBus } from "../runelite/client/eventbus/EventBus";
import { GameObjectSpawned, PreMapLoad } from "../runelite/api/events";
const bus = new EventBus(), manager = new MapManager<any>(8, () => {});
const client: any = {
    engine: { worldViewManager: { getWorldViewByOverlayMapId: () => undefined } },
    getWorldView: () => ({ getScene: () => ({}) }),
    getObjectDefinition: () => ({ getSizeX: () => 1, getSizeY: () => 1 }),
    getSceneTile: () => ({}),
};
client.sceneRegistry = new SceneRegistry(client);
const square: any = { mapX: 50, mapY: 50, delete() {}, canRender: () => true, tileLocOffsetsByLevel: [Uint32Array.from([0, 1])], tileLocIdsByLevel: [Int32Array.from([100])], tileLocTypeRotByLevel: [Uint8Array.from([10])] };
manager.addMap(50, 50, square);
const cleanup = bindSceneEvents(manager, client, bus);
const queries = bus.subscribe(PreMapLoad, () => client.sceneRegistry.update(manager.getMap(50, 50)!));
const incoming = { ...square, tileLocIdsByLevel: [Int32Array.from([102])] };
bus.subscribe(GameObjectSpawned, e => assert.equal(e.getGameObject(), client.sceneRegistry.objectsAt(3200, 3200, 0)[0], "event objects match scene queries after residency commit"));
manager.addMap(50, 50, incoming);
assert.equal(client.sceneRegistry.hasMap(incoming), true, "preload queries cannot leave old residency in registry");
assert.equal(client.sceneRegistry.objectsAt(3200, 3200, 0)[0].getId(), 102);
queries(); cleanup();
console.log("RuneLite preload scene queries preserve committed source and event identity");
