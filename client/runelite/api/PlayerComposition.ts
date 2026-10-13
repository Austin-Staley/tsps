import type { KitType } from "./kit/KitType";
import type { ColorTextureOverride } from "./ColorTextureOverride";
export interface PlayerComposition {
    isFemale():boolean; getGender():number; getColors():number[]; getEquipmentIds():number[];
    getEquipmentId(type:KitType):number; getKitId(type:KitType):number; setHash():void;
    getTransformedNpcId():number; setTransformedNpcId(id:number):void;
    getColorTextureOverrides():(ColorTextureOverride|null)[]; getColorTextureOverride(kit:KitType):ColorTextureOverride|null;
    createColorTextureOverride(kit:KitType,itemId:number):ColorTextureOverride; removeColorTextureOverride(kit:KitType):void;
}
export namespace PlayerComposition { export const KIT_OFFSET=256; export const ITEM_OFFSET=2048; }
