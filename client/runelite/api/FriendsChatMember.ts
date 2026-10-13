import type { Nameable } from "./Nameable";
import type { FriendsChatRank } from "./FriendsChatRank";
export interface FriendsChatMember extends Nameable {
    getRank(): FriendsChatRank;
    getWorld(): number;
}
