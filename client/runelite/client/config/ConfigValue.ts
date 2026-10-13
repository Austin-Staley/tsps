import { Color, Dimension, Point, Rectangle } from "../../awt";
import { WorldPoint } from "../../api/coords/WorldPoint";
import { ColorUtil } from "../util/ColorUtil";
import { Keybind } from "./Keybind";
import { ModifierlessKeybind } from "./ModifierlessKeybind";
import { FontType } from "./FontType";
export type ConfigValueType<T> = { prototype: T } | Record<string, T>;
export function configObjectToString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (value instanceof Color) return String(value.getRGB());
    if (value instanceof Point) return `${value.x}:${value.y}`;
    if (value instanceof Dimension) return `${value.width}x${value.height}`;
    if (value instanceof Rectangle) return `${value.x}:${value.y}:${value.width}:${value.height}`;
    if (value instanceof WorldPoint) return `${value.getX()}:${value.getY()}:${value.getPlane()}`;
    if (value instanceof Keybind) return `${value.getKeyCode()}:${value.getModifiers()}`;
    if (value instanceof FontType) return JSON.stringify({family:value.getFamily(),size:value.getSize(),bold:value.isBold(),italic:value.isItalic()});
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Set) return JSON.stringify([...value]);
    return String(value);
}
export function configStringToObject(raw: string, type: unknown): unknown {
    try {
        if (type === String) return raw;
        if (type === Boolean) return raw.toLowerCase() === "true";
        if (type === Number) { const n = Number(raw); return raw.trim() && Number.isFinite(n) ? n : undefined; }
        if (type === BigInt) return BigInt(raw);
        if (type === Color) return ColorUtil.fromString(raw) ?? undefined;
        if (type === Date) { const date = new Date(raw); return Number.isFinite(date.getTime()) ? date : undefined; }
        if (type === Set) { const values = JSON.parse(raw); return Array.isArray(values) ? new Set(values) : undefined; }
        if (type === FontType) {
            const value = JSON.parse(raw);
            return typeof value.family === "string" && Number.isFinite(value.size) && value.size > 0 && value.size <= 256 &&
                typeof value.bold === "boolean" && typeof value.italic === "boolean" ? new FontType(value.family,value.size,value.bold,value.italic) : undefined;
        }
        if (type === Point || type === Dimension || type === Rectangle || type === WorldPoint || type === Keybind || type === ModifierlessKeybind) {
            const parts = raw.split(type === Dimension ? "x" : ":");
            if (!parts.every(value => /^-?\d+$/.test(value))) return undefined;
            const values = parts.map(Number), count = type === Rectangle ? 4 : type === WorldPoint ? 3 : 2;
            if (values.length !== count || !values.every(Number.isSafeInteger)) return undefined;
            if (type === Point) return new Point(values[0], values[1]);
            if (type === Dimension) return new Dimension(values[0], values[1]);
            if (type === Rectangle) return new Rectangle(values[0], values[1], values[2], values[3]);
            if (type === WorldPoint) return new WorldPoint(values[0], values[1], values[2]);
            if (type === ModifierlessKeybind) return new ModifierlessKeybind(values[0], values[1]);
            return new Keybind(values[0], values[1]);
        }
        if (type && typeof type === "object") return (type as Record<string, unknown>)[raw];
        return raw;
    } catch { return undefined; }
}
