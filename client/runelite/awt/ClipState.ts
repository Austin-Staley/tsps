import { Area } from "./geom/Area";
import { Ellipse2D } from "./geom/Ellipse2D";
import { AffineTransform } from "./geom/AffineTransform";
import { Polygon } from "./Polygon";
import { Rectangle } from "./Rectangle";
import type { Shape } from "./Shape";
export interface ClipEntry {
    shape: Shape;
    transform: AffineTransform;
}
export function snapshotClip(shape: Shape): Shape {
    if (shape instanceof Area) {
        const copy = new Area();
        for (const part of shape.getShapes())
            copy.add(new Area(snapshotClip(part)));
        return copy;
    }
    if (shape instanceof Ellipse2D)
        return new Ellipse2D(shape.x, shape.y, shape.width, shape.height);
    if (shape instanceof Rectangle)
        return new Rectangle(shape);
    if (shape instanceof Polygon)
        return new Polygon(shape.xpoints, shape.ypoints, shape.npoints);
    throw new Error("Clip snapshots require Rectangle, Polygon, Ellipse2D or union Area");
}
function toCurrentShape(entry: ClipEntry, current: AffineTransform): Shape {
    const relative = current.createInverse();
    relative.concatenate(entry.transform);
    const same = relative.m00 === 1 && relative.m11 === 1 && relative.m01 === 0 && relative.m10 === 0 && relative.m02 === 0 && relative.m12 === 0;
    if (same)
        return snapshotClip(entry.shape);
    if (entry.shape instanceof Ellipse2D)
        throw new Error("Transformed ellipse clip queries are not supported");
    const shape = entry.shape instanceof Rectangle ? new Polygon([entry.shape.x, entry.shape.getMaxX(), entry.shape.getMaxX(), entry.shape.x], [entry.shape.y, entry.shape.y, entry.shape.getMaxY(), entry.shape.getMaxY()]) : entry.shape;
    if (!(shape instanceof Polygon))
        throw new Error("Transformed clip queries require polygon geometry");
    const result = new Polygon();
    for (let i = 0; i < shape.npoints; i++)
        result.addPoint(...relative.transformPoint(shape.xpoints[i], shape.ypoints[i]));
    return result;
}
/** Preserve real shape membership; unsupported compound paths fail instead of returning a bounding-box surrogate. */
export function queryClip(entries: readonly ClipEntry[], current: AffineTransform): Shape | null {
    if (!entries.length)
        return null;
    const shapes = entries.map(entry => toCurrentShape(entry, current));
    if (shapes.length === 1)
        return shapes[0];
    if (shapes.every(shape => shape instanceof Rectangle))
        return shapes.map(shape => shape.getBounds()).reduce((a, b) => a.intersection(b));
    throw new Error("Compound non-rectangular clip queries are not supported");
}
