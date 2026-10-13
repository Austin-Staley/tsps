import type { FriendsChatMember } from "../FriendsChatMember";
export class FriendsChatMemberJoined {
    constructor(private readonly member: FriendsChatMember) {}
    getMember(): FriendsChatMember { return this.member; }
}
