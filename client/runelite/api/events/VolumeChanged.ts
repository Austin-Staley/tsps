export class VolumeChanged {
    constructor(private readonly type: VolumeChanged.Type) {}
    getType(): VolumeChanged.Type { return this.type; }
}
export namespace VolumeChanged {
    export enum Type { MUSIC, EFFECTS, AREA }
}
