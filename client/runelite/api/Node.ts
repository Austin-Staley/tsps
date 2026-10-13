export interface Node {
    getNext(): Node | null;
    getPrevious(): Node | null;
    getHash(): bigint;
}
