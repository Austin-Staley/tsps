import type { Nameable } from "./Nameable";
export interface Friend extends Nameable {
    getWorld(): number;
    getRank(): number;
}
