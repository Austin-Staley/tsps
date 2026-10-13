import type { Friend } from "../api/Friend";
import type { Nameable } from "../api/Nameable";
import type { FriendsChatMember } from "../api/FriendsChatMember";
import type { FriendsChatRank } from "../api/FriendsChatRank";
export function socialNameKey(name: string): string { return name.toLowerCase().replace(/[\s_\-]+/g, "_").replace(/^_|_$/g, ""); }
export class NameableImpl implements Nameable {
    constructor(public name: string, public previousName: string | null = null) {}
    getName(): string { return this.name; }
    getPrevName(): string | null { return this.previousName; }
    compareTo(other: Nameable): number { const a = socialNameKey(this.name), b = socialNameKey(other.getName()); return a < b ? -1 : a > b ? 1 : 0; }
}
export class FriendsChatMemberImpl extends NameableImpl implements FriendsChatMember {
    constructor(name: string, public rank: FriendsChatRank, public world: number) { super(name); }
    getRank(): FriendsChatRank { return this.rank; }
    getWorld(): number { return this.world; }
}
export class FriendImpl extends NameableImpl implements Friend {
    constructor(name: string, previousName: string | null, public world: number, public rank: number) { super(name, previousName); }
    getWorld(): number { return this.world; }
    getRank(): number { return this.rank; }
}
export class SocialState {
    readonly friends = new Map<string, FriendImpl>();
    readonly ignores = new Map<string, NameableImpl>();
    readonly members = new Map<string, FriendsChatMemberImpl>();
    joined = false;
    myRank = -1;
    kickRank = -1;
    channelName: string | null = null;
    owner: string | null = null;
}
