import { ClientState } from "../../game/ClientState";

/** RuneLite exposes live, writable player-menu arrays; packets remain their source of truth. */
export class PlayerMenuArrays {
    readonly options = this.array<string | null>("option", index => ClientState.playerOptions.get(index + 1)?.option || null);
    readonly priorities = this.array<boolean>("priority", index => {
        const row = ClientState.playerOptions.get(index + 1);
        return row ? !row.priority : false;
    });
    readonly types = this.array<number>("opcode", index => ClientState.playerOptions.get(index + 1)?.opcode ?? 44 + index);
    private array<T>(field: "option" | "priority" | "opcode", read: (index: number) => T): T[] {
        const target = Array<T>(8).fill(undefined as T);
        const indexOf = (key: string | symbol) => typeof key === "string" && /^(?:0|[1-7])$/.test(key) ? Number(key) : undefined;
        return new Proxy(target, {
            get(array, key, receiver) {
                const index = indexOf(key);
                return index === undefined ? Reflect.get(array, key, receiver) : read(index);
            },
            set(_array, key, value) {
                const index = indexOf(key);
                if (index === undefined) {
                    if (key === "length" && value === 8) return true;
                    throw new RangeError("Player-menu arrays contain eight slots");
                }
                const row: { option: string; priority: boolean; opcode?: number } = ClientState.playerOptions.get(index + 1) ?? { option: "", priority: false };
                if (field === "option") {
                    if (value !== null && typeof value !== "string") throw new TypeError("Player option must be a string or null");
                    row.option = value ?? "";
                } else if (field === "priority") {
                    if (typeof value !== "boolean") throw new TypeError("Player option priority must be boolean");
                    row.priority = !value;
                } else {
                    if (!Number.isInteger(value)) throw new TypeError("Player menu type must be an opcode");
                    row.opcode = value;
                }
                ClientState.playerOptions.set(index + 1, row);
                if (field === "option") for (const listener of ClientState.playerOptionsChangedListeners) listener(index);
                return true;
            },
        });
    }
}
