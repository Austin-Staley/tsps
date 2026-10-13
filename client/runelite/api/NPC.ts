import type { Actor } from "./Actor";
import type { NPCComposition } from "./NPCComposition";
import type { NpcOverrides } from "./NpcOverrides";
export interface NPC extends Actor { getIndex(): number; getId(): number; getComposition(): NPCComposition; getTransformedComposition(): NPCComposition | null; getModelOverrides():NpcOverrides|null; getChatheadOverrides():NpcOverrides|null; getOverheadArchiveIds():number[]|null; getOverheadSpriteIds():number[]|null; }
