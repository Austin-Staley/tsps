import type { FriendsChatMember } from "../FriendsChatMember";
export class FriendsChatMemberLeft {
    constructor(private readonly member: FriendsChatMember) {}
    getMember(): FriendsChatMember { return this.member; }
}
