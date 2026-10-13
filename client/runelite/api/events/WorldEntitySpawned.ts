import type { WorldEntity } from "../WorldEntity";
export class WorldEntitySpawned {
    constructor(private readonly worldEntity: WorldEntity) {}
    getWorldEntity(): WorldEntity { return this.worldEntity; }
}
