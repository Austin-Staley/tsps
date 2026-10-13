import type { Node } from "./Node";
export interface IterableHashTable<T extends Node> extends Iterable<T> {
    get(hash: bigint | number): T | null;
    put(node: T, hash: bigint | number): void;
}
