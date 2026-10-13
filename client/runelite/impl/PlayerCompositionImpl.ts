import { PlayerComposition } from "../api/PlayerComposition";
import type { ColorTextureOverride } from "../api/ColorTextureOverride";
import type { KitType } from "../api/kit/KitType";
import type { PlayerAppearance } from "../../rs/config/player/PlayerAppearance";
import type { ObjTypeLoader } from "../../rs/config/objtype/ObjTypeLoader";

const equipmentSlots=[0,1,2,3,4,5,-1,6,-1,7,8,-1];
const kitParts=[-1,-1,-1,-1,2,-1,3,5,0,4,6,1];
export class PlayerCompositionImpl implements PlayerComposition {
    private readonly equipment:number[];
    private readonly overrideWrappers=new WeakMap<object,ColorTextureOverride>();
    private readonly overrides=new Proxy(new Array<ColorTextureOverride|null>(12).fill(null),{
        get:(target,key,receiver)=>{const slot=typeof key==="string" && /^\d+$/.test(key) ? Number(key):-1;return slot>=0 && slot<12 ? this.getColorTextureOverride(slot):Reflect.get(target,key,receiver);},
        set:(target,key,value)=>{const slot=typeof key==="string" && /^\d+$/.test(key) ? Number(key):-1;if(slot<0 || slot>=12)return Reflect.set(target,key,value);if(value===null)delete this.appearance.colorTextureOverrides[slot];else this.appearance.colorTextureOverrides[slot]={colors:value.getColorToReplaceWith(),textures:value.getTextureToReplaceWith()};return true;},
    });
    constructor(readonly appearance:PlayerAppearance,private readonly itemLoader:()=>ObjTypeLoader,private readonly changed:()=>void) {
        this.equipment=new Proxy(new Array<number>(12).fill(0),{
            get:(target,key,receiver)=>{
                const slot=typeof key==="string" && /^\d+$/.test(key) ? Number(key):-1;
                return slot>=0 && slot<12 ? this.encoded(slot):Reflect.get(target,key,receiver);
            },
            set:(target,key,value)=>{
                const slot=typeof key==="string" && /^\d+$/.test(key) ? Number(key):-1;
                if(slot<0 || slot>=12)return Reflect.set(target,key,value);
                const encoded=Number(value)|0,equip=equipmentSlots[slot],part=kitParts[slot];
                if(equip>=0)this.appearance.equip[equip]=encoded>=PlayerComposition.ITEM_OFFSET ? encoded-PlayerComposition.ITEM_OFFSET:-1;
                else if(encoded>=PlayerComposition.ITEM_OFFSET)this.appearance.compositionItems.set(slot,encoded-PlayerComposition.ITEM_OFFSET);
                else this.appearance.compositionItems.delete(slot);
                if(part>=0)this.appearance.kits[part]=encoded>=PlayerComposition.KIT_OFFSET && encoded<PlayerComposition.ITEM_OFFSET ? encoded-PlayerComposition.KIT_OFFSET:-1;
                return true;
            },
        });
    }
    private encoded(slot:number):number {
        const extra=this.appearance.compositionItems.get(slot);if(extra!==undefined)return extra+PlayerComposition.ITEM_OFFSET;
        const equip=equipmentSlots[slot],part=kitParts[slot];
        const item=equip>=0 ? this.appearance.equip[equip] ?? -1:-1;
        if(item>=0)return item+PlayerComposition.ITEM_OFFSET;
        const kit=part>=0 ? this.appearance.kits[part] ?? -1:-1;
        return kit>=0 ? kit+PlayerComposition.KIT_OFFSET:0;
    }
    isFemale():boolean { return this.appearance.gender===1; } getGender():number { return this.appearance.gender; }
    getColors():number[] { return this.appearance.colors; } getEquipmentIds():number[] { return this.equipment; }
    getEquipmentId(type:KitType):number { const v=this.encoded(type);return v>=PlayerComposition.ITEM_OFFSET ? v-PlayerComposition.ITEM_OFFSET:-1; }
    getKitId(type:KitType):number { const v=this.encoded(type);return v>=PlayerComposition.KIT_OFFSET && v<PlayerComposition.ITEM_OFFSET ? v-PlayerComposition.KIT_OFFSET:-1; }
    setHash():void { this.changed(); }
    getTransformedNpcId():number { return this.appearance.npcTransformationId; }
    setTransformedNpcId(id:number):void { this.appearance.npcTransformationId=id|0;this.setHash(); }
    getColorTextureOverrides():(ColorTextureOverride|null)[] { return this.overrides; }
    getColorTextureOverride(kit:KitType):ColorTextureOverride|null {
        const value=this.appearance.colorTextureOverrides[kit];
        if(!value)return null;let wrapper=this.overrideWrappers.get(value);if(!wrapper){wrapper={getColorToReplaceWith:()=>value.colors,getTextureToReplaceWith:()=>value.textures};this.overrideWrappers.set(value,wrapper);}return wrapper;
    }
    createColorTextureOverride(kit:KitType,itemId:number):ColorTextureOverride {
        const item=this.itemLoader().load(itemId);
        this.appearance.colorTextureOverrides[kit]={colors:item.recolorTo?.slice() ?? null,textures:item.retextureTo?.slice() ?? null};
        this.setHash();return this.getColorTextureOverride(kit)!;
    }
    removeColorTextureOverride(kit:KitType):void { delete this.appearance.colorTextureOverrides[kit];this.setHash(); }
}
