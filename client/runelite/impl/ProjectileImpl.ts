import type { Projectile as NativeProjectile } from "../../render/projectiles/Projectile";
import type { ProjectileActorRef } from "../../common/projectiles/ProjectileLaunch";
import type { Projectile } from "../api/Projectile";
import type { ClientImpl } from "./ClientImpl";
import { WorldPoint } from "../api/coords/WorldPoint";
import { LocalPoint } from "../api/coords/LocalPoint";
export class ProjectileImpl implements Projectile {
    constructor(private readonly client: ClientImpl, readonly value: NativeProjectile) {}
    getId(): number { return this.value.projectileId; }
    getSourceLevel(): number { return this.value.plane; } getTargetLevel(): number { return this.value.targetPlane; }
    getSourcePoint(): WorldPoint { const p = this.value.getSource(); return new WorldPoint(p.x >> 7, p.y >> 7, this.getSourceLevel()); }
    getTargetPoint(): WorldPoint { const p = this.value.getTarget(); return new WorldPoint(p.x >> 7, p.y >> 7, this.getTargetLevel()); }
    private actor(ref?: ProjectileActorRef) { return !ref ? null : ref.kind === "player" ? this.client.getPlayerByIndex(ref.serverId) : this.client.getNpcByIndex(ref.serverId); }
    getSourceActor() { return this.actor(this.value.sourceActor); } getTargetActor() { return this.actor(this.value.targetActor); }
    getTarget(): LocalPoint { const p = this.value.getTarget(), view = this.client.getTopLevelWorldView(); return new LocalPoint(p.x - (view.getBaseX() << 7), p.y - (view.getBaseY() << 7), view); }
    getX1(): number { return this.value.getSource().x - (this.client.getBaseX() << 7); } getY1(): number { return this.value.getSource().y - (this.client.getBaseY() << 7); }
    getFloor(): number { return this.value.plane; } getHeight(): number { return this.value.getSource().z; } getEndHeight(): number { return this.value.endHeight; }
    getStartCycle(): number { return this.value.startCycle; } getEndCycle(): number { return this.value.endCycle; }
    setEndCycle(cycle: number): void { this.value.setEndCycle(cycle); }
    getRemainingCycles(): number { return this.getEndCycle() - this.client.getGameCycle(); }
    getSlope(): number { return this.value.slope; } getStartPos(): number { return this.value.horizontalOffset; } getStartHeight(): number { return this.value.startHeight; }
    getX(): number { return this.value.currentX - (this.client.getBaseX() << 7); } getY(): number { return this.value.currentY - (this.client.getBaseY() << 7); } getZ(): number { return this.value.currentZ; }
    getOrientation(): number { return this.value.yaw; } getAnimationFrame(): number { return this.value.animationFrame; }
}
