import { Rectangle } from "../../awt/Rectangle";
import { Point } from "../../awt/Point";
import type { Widget } from "./Widget";
export class WidgetItem {
    constructor(private readonly id:number,private readonly quantity:number,private readonly canvasBounds:Rectangle,private readonly widget:Widget,private readonly draggingCanvasBounds:Rectangle|null) {}
    getId():number { return this.id; } getQuantity():number { return this.quantity; } getWidget():Widget { return this.widget; }
    getCanvasBounds():Rectangle;
    getCanvasBounds(dragging:boolean):Rectangle|null;
    getCanvasBounds(dragging?:boolean):Rectangle|null { return dragging===undefined ? this.draggingCanvasBounds ?? this.canvasBounds : dragging ? this.draggingCanvasBounds : this.canvasBounds; }
    getDraggingCanvasBounds():Rectangle|null { return this.draggingCanvasBounds; }
    getCanvasLocation():Point { const r=this.getCanvasBounds();return new Point(r.x,r.y); }
}
