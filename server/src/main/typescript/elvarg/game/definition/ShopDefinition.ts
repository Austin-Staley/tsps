export type ShopCurrency = "COINS" | "BLOOD_MONEY" | "POINTS" | string;

export interface ShopStockDefinition {
    id: number;
    amount: number;
    restockTicks: number | null;
    price: number | null;
}

/**
 * Optional per-shop rules, as the Wiki's store tables give them: what share of an item's value
 * the shop sells and buys at (per mille: `sellmultiplier=1200`, `buymultiplier=600`), and
 * whether items players sell to it join its stock.
 */
export interface ShopDefinitionOptions {
    sellMultiplier?: number | null;
    buyMultiplier?: number | null;
    stocksSoldItems?: boolean;
}

export class ShopDefinition {
    private static definitions = new Map<number, ShopDefinition>();

    constructor(
        private readonly id: number,
        private readonly name: string,
        private readonly currency: ShopCurrency,
        private readonly originalStock: ShopStockDefinition[],
        private readonly defaultRestockTicks: number,
        private readonly defaultDestockTicks: number,
        private readonly soldItemDestockTicks: number,
        private readonly source: string,
        private readonly options: ShopDefinitionOptions = {}
    ) {}

    public static replace(definitions: ShopDefinition[]): void {
        this.definitions.clear();
        for (const definition of definitions) {
            this.definitions.set(definition.getId(), definition);
        }
    }

    public static forId(id: number): ShopDefinition | undefined {
        return this.definitions.get(id);
    }

    public static all(): readonly ShopDefinition[] {
        return Array.from(this.definitions.values());
    }

    public getId(): number {
        return this.id;
    }

    public getName(): string {
        return this.name;
    }

    public getCurrency(): ShopCurrency {
        return this.currency;
    }

    public getOriginalStock(): readonly ShopStockDefinition[] {
        return this.originalStock;
    }

    public getDefaultRestockTicks(): number {
        return this.defaultRestockTicks;
    }

    public getDefaultDestockTicks(): number {
        return this.defaultDestockTicks;
    }

    public getSoldItemDestockTicks(): number {
        return this.soldItemDestockTicks;
    }

    public getSource(): string {
        return this.source;
    }

    /** Per mille of an item's value the shop sells it for, or null for the default. */
    public getSellMultiplier(): number | null {
        return this.options.sellMultiplier ?? null;
    }

    /** Per mille of an item's value the shop pays for it, or null for the default. */
    public getBuyMultiplier(): number | null {
        return this.options.buyMultiplier ?? null;
    }

    /** False when what players sell to the shop is taken without joining its stock. */
    public stocksSoldItems(): boolean {
        return this.options.stocksSoldItems !== false;
    }
}
