import type { Nameable } from "./Nameable";
export interface NameableContainer<T extends Nameable> { getCount():number; getMembers():T[]; findByName(name:string):T|null; }
