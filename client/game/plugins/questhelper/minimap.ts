// Based on upstream steps/overlay/DirectionArrow.java (BSD notice in LICENSE-QuestHelper.txt).
export function questMinimapArrowPosition(
    target: { x: number; y: number }, center: { x: number; y: number },
    distanceTiles: number, zoom: number, scale: number,
): { x: number; y: number; angle: number } {
    if (distanceTiles < Math.max(1, Math.floor(16 / zoom))) return { x: target.x, y: target.y - 8 * scale, angle: 0 };
    const angle = Math.atan2(target.y - center.y, target.x - center.x);
    return { x: center.x + Math.cos(angle) * 65 * scale, y: center.y + Math.sin(angle) * 65 * scale, angle: angle - Math.PI / 2 };
}

/** Upstream's black 6px shaft/head with the cyan 3px shaft/head drawn over it. */
export function questMinimapArrowCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = 22;
    canvas.height = 24;
    const ctx = canvas.getContext("2d")!;
    for (const [color, width, extra] of [["#000000", 6, 2], ["#00ffff", 3, 0]] as const) {
        ctx.strokeStyle = ctx.fillStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = "square";
        ctx.beginPath(); ctx.moveTo(11, 3); ctx.lineTo(11, 13); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(11, 19 + extra); ctx.lineTo(5 - extra, 12 - extra); ctx.lineTo(17 + extra, 12 - extra); ctx.closePath(); ctx.fill();
    }
    return canvas;
}
