import type { Projectile } from "../Projectile";
import type { LocalPoint } from "../coords/LocalPoint";
export class ProjectileMoved {
    constructor(private projectile: Projectile, private position: LocalPoint, private z: number) {}
    getProjectile(): Projectile { return this.projectile; } setProjectile(value: Projectile): void { this.projectile = value; }
    getPosition(): LocalPoint { return this.position; } setPosition(value: LocalPoint): void { this.position = value; }
    getZ(): number { return this.z; } setZ(value: number): void { this.z = value; }
}
