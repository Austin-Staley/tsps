import type { StructComposition } from "../StructComposition";
export class PostStructComposition {
    constructor(private readonly structComposition: StructComposition) {}
    getStructComposition(): StructComposition { return this.structComposition; }
}
