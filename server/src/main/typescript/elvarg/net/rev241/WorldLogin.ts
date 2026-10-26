/**
 * Attaches a rev 241 TCP connection to the existing player session.
 * The browser WebSocket path is unchanged. This file is the only place the
 * bridge constructs a ClientConnection.
 */
import { Appearance } from "../../game/model/Appearance";
import { CacheDefinitions } from "../../game/cache/CacheDefinitions";
import { HitMask } from "../../game/content/combat/hit/HitMask";
import type { Player } from "../../game/entity/impl/player/Player";
import { Equipment } from "../../game/model/container/impl/Equipment";
import { ClientConnection } from "../NetworkBuilder";
import type { DecodedLogin } from "./LoginBlock";
import type { NpcView } from "./NpcInfo";
import type { AppearanceView, PlayerHitView, PlayerSpotView } from "./PlayerInfo";
import { loadOrCreateRsa, rsaKeyPath } from "./RsaKeys";
import { Rev241Server, readCacheGroup, rev241Enabled, rev241Host, rev241Port, type Rev241Link } from "./Rev241Server";
import type { VarpBit } from "./Packets";
import type { ObservedPlayer } from "./Translate";

const WEARPOS: Record<number, number> = {
  [Equipment.HEAD_SLOT]: 0,
  [Equipment.CAPE_SLOT]: 1,
  [Equipment.AMULET_SLOT]: 2,
  [Equipment.WEAPON_SLOT]: 3,
  [Equipment.BODY_SLOT]: 4,
  [Equipment.SHIELD_SLOT]: 5,
  [Equipment.LEG_SLOT]: 7,
  [Equipment.HANDS_SLOT]: 9,
  [Equipment.FEET_SLOT]: 10,
};

function hitsplatType(mask: HitMask, mine: boolean): number {
  // Same cache hitsplat ids PlayerSession already sends to the browser client.
  if (mask === HitMask.BLUE) return mine ? 12 : 13;
  if (mask === HitMask.GREEN) return mine ? 65 : 66;
  if (mask === HitMask.YELLOW) return mine ? 22 : 23;
  return mine ? 16 : 17;
}

function appearanceOf(player: Player): AppearanceView {
  const look = player.getAppearance().getLook();
  const kits = [
    look[Appearance.HEAD], look[Appearance.BEARD], look[Appearance.CHEST], look[Appearance.ARMS],
    look[Appearance.HANDS], look[Appearance.LEGS], look[Appearance.FEET],
  ].map((value) => value ?? 0);
  const equipment = new Array<number>(12).fill(-1);
  const worn = player.getAppearanceEquipmentIds();
  for (const [slot, wearpos] of Object.entries(WEARPOS)) {
    const id = worn[Number(slot)] ?? -1;
    if (id >= 0) equipment[wearpos] = id;
  }
  const anims = player.getRenderAnimations();
  return {
    gender: look[Appearance.GENDER] ?? 0,
    skull: player.getHeadSkullIcon(),
    overhead: player.getAppearance().getHeadHint(),
    kits,
    colours: [
      look[Appearance.HAIR_COLOUR], look[Appearance.TORSO_COLOUR], look[Appearance.LEG_COLOUR],
      look[Appearance.FEET_COLOUR], look[Appearance.SKIN_COLOUR],
    ].map((value) => value ?? 0),
    equipment,
    name: player.getUsername(),
    combatLevel: player.getSkillManager().getCombatLevel(),
    skillLevel: player.getSkillManager().getTotalLevel(),
    anims: anims?.length === 7 ? anims : undefined,
  };
}

function hitsOf(player: Player): PlayerHitView[] {
  return player.getTickHits().map((hit) => ({
    type: hit.getSplatType?.(true) ?? hitsplatType(hit.getHitmask(), true),
    value: hit.getDamage(),
    delay: 0,
  }));
}

function spotsOf(player: Player): PlayerSpotView[] {
  const spots: PlayerSpotView[] = [];
  const graphic = player.getGraphic?.();
  if (graphic) spots.push({ slot: 0, id: graphic.getId(), height: Number(graphic.getHeight()) || 0, delay: graphic.getDelay() });
  return spots;
}

function npcsOf(player: Player): NpcView[] {
  return player.getLocalNpcs().map((npc) => {
    const location = npc.getLocation();
    const animation = npc.getAnimation?.();
    const graphic = npc.getGraphic?.();
    return {
      index: npc.getIndex(),
      id: npc.getId(),
      x: location.getX(),
      y: location.getY(),
      z: location.getZ(),
      direction: npc.getFacingDirection?.().getId?.() ?? 0,
      teleport: npc.isTeleportingReturn?.() === true,
      say: npc.getForcedChat?.() || undefined,
      hits: npc.getTickHits?.().map((hit: { getHitmask(): HitMask; getDamage(): number; getSplatType?(own: boolean): number }) => ({
        type: hit.getSplatType?.(false) ?? hitsplatType(hit.getHitmask(), false),
        value: hit.getDamage(),
      })),
      sequence: animation && animation.getId() >= 0 ? { id: animation.getId(), delay: animation.getDelay() } : undefined,
      spotanims: graphic ? [{ slot: 0, id: graphic.getId(), height: Number(graphic.getHeight()) || 0, delay: graphic.getDelay() }] : undefined,
    };
  });
}

function observe(player: Player | undefined): ObservedPlayer | undefined {
  if (!player) return undefined;
  const location = player.getLocation();
  const animation = player.getAnimation?.();
  return {
    index: player.getIndex(),
    x: location.getX(),
    y: location.getY(),
    z: location.getZ(),
    name: player.getUsername(),
    member: true,
    appearance: appearanceOf(player),
    hits: hitsOf(player),
    sequence: animation && animation.getId() >= 0 ? { id: animation.getId(), delay: animation.getDelay() } : undefined,
    spotanims: spotsOf(player),
    say: player.getForcedChat?.() || undefined,
    teleport: player.isTeleportingReturn?.() === true,
    npcs: npcsOf(player),
  };
}

function varbit(id: number): VarpBit | undefined {
  try {
    const definition = CacheDefinitions.getVarbit(id);
    if (!definition) return undefined;
    return { baseVar: definition.baseVar, startBit: definition.startBit, endBit: definition.endBit };
  } catch {
    return undefined;
  }
}

export function acceptRev241Login(login: DecodedLogin, link: Rev241Link): void {
  const connection = new ClientConnection(link);
  link.bind(connection);
  link.setContext({
    observe: () => observe(connection.getPlayer()),
    varbit,
  });
  connection.inject([{
    type: "login",
    username: login.username,
    password: login.password,
    revision: 241,
    flags: login.flags,
  }]);
}

let running: Rev241Server | undefined;

/** Starts the bridge next to the browser listener. REV241_ENABLED=0 leaves it off. */
export function startRev241Bridge(): void {
  if (!rev241Enabled() || running) return;
  const server = new Rev241Server({
    host: rev241Host(),
    port: rev241Port(),
    material: loadOrCreateRsa(process.cwd()),
    onLogin: acceptRev241Login,
    readGroup: readCacheGroup,
  });
  running = server;
  server.listen().then((port) => {
    console.info(`[rev241] rsa ${rsaKeyPath(process.cwd())} (public exponent 65537)`);
    console.info(`[rev241] game and js5 on ${rev241Host()}:${port}`);
  }).catch((error) => {
    running = undefined;
    console.error("[rev241] failed to listen", error);
  });
}
