import type { OsrsClient } from "../../game/OsrsClient";
import type { ObjType } from "../../rs/config/objtype/ObjType";
import type { ItemComposition } from "../api/ItemComposition";
import { CompositionImpl } from "./CompositionImpl";
export class ItemCompositionImpl extends CompositionImpl implements ItemComposition {
    constructor(engine:OsrsClient, protected readonly value:ObjType) { super(engine,value); }
    getName():string { return this.value.name; } getPrice():number { return this.value.price; }
    isMembers():boolean { return this.value.isMembers; } isStackable():boolean { return this.value.stackability !== 0; }
    isTradeable():boolean { return this.value.isTradable; }
    getInventoryActions(): (string|null)[] { return this.value.inventoryActions; } getGroundActions(): (string|null)[] { return this.value.groundActions; }
    getNote():number { return this.value.noteTemplate; } getLinkedNoteId():number { return this.value.note; }
    getPlaceholderId():number { return this.value.placeholder; } getPlaceholderTemplateId():number { return this.value.placeholderTemplate; }
    getHaPrice():number { return Math.floor(this.value.price * .6); }
    getShiftClickActionIndex():number { const i=this.value.shiftClickIndex; return i === -2 ? (this.value.inventoryActions[4]?.toLowerCase()==="drop" ? 4 : -1) : i; }
    setShiftClickActionIndex(i:number):void { this.value.shiftClickIndex=i; }
    getMaleModel():number { return this.value.maleModel; } getFemaleModel():number { return this.value.femaleModel; }
}
