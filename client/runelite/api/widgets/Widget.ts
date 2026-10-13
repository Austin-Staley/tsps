import type { WidgetItem } from "./WidgetItem";
import type { Rectangle } from "../../awt/Rectangle";
import type { Point } from "../../awt/Point";
export interface Widget {
    getWidgetItems():WidgetItem[]; getWidgetItem(index:number):WidgetItem|null;
    getId(): number; getParentId(): number; getParent(): Widget | null; getIndex(): number; getType(): number;
    getChildren(): (Widget | null)[] | null; getDynamicChildren(): Widget[]; getStaticChildren(): Widget[]; getNestedChildren(): Widget[];
    getChild(index:number): Widget | null; getBounds(): Rectangle; getCanvasLocation(): Point; getRelativeX():number; getRelativeY():number;
    getWidth():number; getHeight():number; getScrollX():number; getScrollY():number; getScrollWidth():number; getScrollHeight():number;
    isHidden():boolean; isSelfHidden():boolean; getText():string; getName():string; getItemId():number; getItemQuantity():number;
    getSpriteId():number; getTextColor():number; getFontId():number; getActions(): (string|null)[] | null;
    setHidden(hidden:boolean):Widget; setText(text:string):Widget; setTextColor(color:number):Widget; setName(name:string):Widget;
    setSpriteId(sprite:number):Widget; setScrollY(y:number):Widget; setScrollX(x:number):Widget; setAction(index:number,action:string):Widget;
    setPos(x:number,y:number):Widget; setSize(width:number,height:number):Widget; revalidate():void; revalidateScroll():void;
}
