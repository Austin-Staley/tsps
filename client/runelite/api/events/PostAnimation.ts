import type { Animation } from "../Animation";
export class PostAnimation {
    constructor(private readonly animation: Animation) {}
    getAnimation(): Animation { return this.animation; }
}
