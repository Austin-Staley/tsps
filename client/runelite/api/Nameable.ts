export interface Nameable {
    getName(): string;
    getPrevName(): string | null;
    compareTo(other: Nameable): number;
}
