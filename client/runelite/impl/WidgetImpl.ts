import { WidgetItem } from "../api/widgets/WidgetItem";
import type { Widget } from "../api/widgets/Widget";
import { Point } from "../awt/Point";
import { Rectangle } from "../awt/Rectangle";
import type { WidgetNode } from "../../widgets/WidgetNode";
import type { ClientImpl } from "./ClientImpl";
export class WidgetImpl implements Widget {
    constructor(private readonly client:ClientImpl, readonly node:WidgetNode) {}
    getWidgetItems():WidgetItem[] {
        if(this.isHidden())return [];
        if(this.node.type===2 && this.node.itemIds)return this.node.itemIds.map((_,i)=>this.getWidgetItem(i)).filter((i):i is WidgetItem=>i!==null);
        const children=this.node.children?.filter((w):w is WidgetNode=>w!==null) ?? [];
        return children.map(w=>this.client.wrapWidget(w).ownItem()).filter((i):i is WidgetItem=>i!==null);
    }
    getWidgetItem(index:number):WidgetItem|null {
        if(this.node.type!==2)return this.getChild(index) instanceof WidgetImpl ? (this.getChild(index) as WidgetImpl).ownItem() : null;
        const id=(this.node.itemIds?.[index] ?? 0)-1;if(id<0)return null;
        const pos=this.getCanvasLocation(),sx=(this.node._absWidth ?? this.node.width)/Math.max(1,this.node.width),sy=(this.node._absHeight ?? this.node.height)/Math.max(1,this.node.height),cols=this.node.gridColumns ?? this.node.rawWidth ?? 1;
        const x=pos.x+(index%cols)*(this.node.gridXPitch ?? 32)*sx,y=pos.y+Math.floor(index/cols)*(this.node.gridYPitch ?? 32)*sy;
        return new WidgetItem(id,this.node.itemQuantities?.[index] ?? 0,new Rectangle(x,y,32*sx,32*sy),this,null);
    }
    ownItem():WidgetItem|null {
        if(this.getItemId()<0 || this.isHidden())return null;
        const node=this.node as WidgetNode & {_isDragActive?:boolean;_dragAbsX?:number;_dragAbsY?:number;_dragVisualX?:number;_dragVisualY?:number};
        const current=this.getBounds(),sx=current.width/Math.max(1,node.width),sy=current.height/Math.max(1,node.height);
        const isDragging=node._isDragActive===true;
        const normal=isDragging ? new Rectangle(current.x-((node._dragVisualX ?? node.x)-node.x)*sx,current.y-((node._dragVisualY ?? node.y)-node.y)*sy,current.width,current.height) : current;
        const dragged=isDragging ? new Rectangle(node._dragAbsX ?? current.x,node._dragAbsY ?? current.y,current.width,current.height):null;
        return new WidgetItem(this.getItemId(),this.getItemQuantity(),normal,this,dragged);
    }
    getId():number { return this.node.uid; } getParentId():number { return this.node.parentUid; }
    getParent():Widget|null { const m=this.client.engine.widgetManager; const id=this.node.parentUid >= 0 ? this.node.parentUid : m.getInterfaceParentContainerUid(this.node.groupId); return id === undefined || id<0 ? null : this.client.getWidget(id); }
    getIndex():number { return this.node.childIndex ?? -1; } getType():number { return this.node.type ?? 0; }
    getChildren():(Widget|null)[]|null { return this.node.children?.map(w=>w ? this.client.wrapWidget(w) : null) ?? null; }
    getDynamicChildren():Widget[] { return this.getChildren()?.filter((w):w is Widget=>w!==null) ?? []; }
    getStaticChildren():Widget[] { return this.client.engine.widgetManager.getStaticChildrenByParentUid(this.node.uid).map(w=>this.client.wrapWidget(w)); }
    getNestedChildren():Widget[] { const p=this.client.engine.widgetManager.getSubInterface(this.node.uid); return p ? this.client.engine.widgetManager.getAllGroupRoots(p.group).map(w=>this.client.wrapWidget(w)) : []; }
    getChild(index:number):Widget|null { const w=this.node.children?.[index]; return w ? this.client.wrapWidget(w) : null; }
    getCanvasLocation():Point { if(this.node._absX !== undefined && this.node._absY !== undefined) return new Point(this.node._absX,this.node._absY); const p=this.getParent(); if(!p) return new Point(this.node.x,this.node.y); const at=p.getCanvasLocation(); return new Point(at.getX()+this.node.x-p.getScrollX(),at.getY()+this.node.y-p.getScrollY()); }
    getBounds():Rectangle { const p=this.getCanvasLocation(); return new Rectangle(p.getX(),p.getY(),this.node._absWidth ?? this.node.width,this.node._absHeight ?? this.node.height); }
    getRelativeX():number { return this.node.x; } getRelativeY():number { return this.node.y; }
    getWidth():number { return this.node.width; } getHeight():number { return this.node.height; }
    getScrollX():number { return this.node.scrollX; } getScrollY():number { return this.node.scrollY; }
    getScrollWidth():number { return this.node.scrollWidth; } getScrollHeight():number { return this.node.scrollHeight; }
    isSelfHidden():boolean { return this.node.isHidden; }
    isHidden():boolean { return this.isSelfHidden() || (this.getParent()?.isHidden() ?? !this.client.engine.widgetManager.isGroupLoaded(this.node.groupId)); }
    getText():string { return this.node.text ?? ""; } getName():string { return this.node.opBase ?? ""; }
    getItemId():number { return this.node.itemId ?? -1; } getItemQuantity():number { return this.node.itemQuantity ?? this.node.itemAmount ?? 0; }
    getSpriteId():number { return this.node.spriteId ?? -1; } getTextColor():number { return this.node.textColor ?? 0; } getFontId():number { return this.node.fontId ?? -1; }
    getActions():(string|null)[]|null { return this.node.actions ?? null; }
    private dirty():this { this.client.engine.widgetManager.invalidateWidgetRender(this.node); return this; }
    setHidden(v:boolean):this { this.node.isHidden=v;this.node.hidden=v; return this.dirty(); } setText(v:string):this { this.node.text=v; return this.dirty(); }
    setTextColor(v:number):this { this.node.textColor=v; return this.dirty(); } setName(v:string):this { this.node.opBase=v; return this.dirty(); }
    setSpriteId(v:number):this { this.node.spriteId=v; return this.dirty(); } setScrollY(v:number):this { this.node.scrollY=v; return this.dirty(); }
    setScrollX(v:number):this { this.node.scrollX=v; return this.dirty(); } setAction(i:number,v:string):this { (this.node.actions ??=[])[i]=v; return this.dirty(); }
    setPos(x:number,y:number):this { this.node.rawX=x; this.node.rawY=y; this.node.x=x; this.node.y=y; return this.dirty(); }
    setSize(w:number,h:number):this { this.node.rawWidth=w; this.node.rawHeight=h; this.node.width=w; this.node.height=h; return this.dirty(); }
    revalidate():void { this.client.engine.widgetManager.invalidateWidget(this.node); } revalidateScroll():void { this.revalidate(); }
}
