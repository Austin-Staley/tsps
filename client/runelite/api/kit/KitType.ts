/** RuneLite composition indices differ from equipment inventory indices. */
export enum KitType { HEAD, CAPE, AMULET, WEAPON, TORSO, SHIELD, ARMS, LEGS, HAIR, HANDS, BOOTS, JAW }
export namespace KitType { export function getIndex(type:KitType):number { return type; } }
