import type { NameableContainer } from "./NameableContainer";
import type { FriendsChatMember } from "./FriendsChatMember";
import type { FriendsChatRank } from "./FriendsChatRank";
export interface FriendsChatManager extends NameableContainer<FriendsChatMember> { getOwner():string|null; getName():string|null; getMyRank():FriendsChatRank; getKickRank():FriendsChatRank; }
