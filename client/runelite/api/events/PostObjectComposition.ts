import type { ObjectComposition } from "../ObjectComposition";
export class PostObjectComposition {
    constructor(private readonly objectComposition: ObjectComposition) {}
    getObjectComposition(): ObjectComposition { return this.objectComposition; }
}
