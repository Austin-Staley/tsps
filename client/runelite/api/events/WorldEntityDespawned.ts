import type { WorldEntity } from "../WorldEntity";
export class WorldEntityDespawned {
    constructor(private readonly worldEntity: WorldEntity) {}
    getWorldEntity(): WorldEntity { return this.worldEntity; }
}
