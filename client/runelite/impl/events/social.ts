import { subscribeFriendsChat } from "../../../network/serverConnection/subscriptions/ui";
import type { FriendsChatSnapshot } from "../../../common/social/FriendsChat";
import { SocialState, socialNameKey, NameableImpl, FriendsChatMemberImpl, FriendImpl } from "../SocialState";
import { FriendsChatChanged, FriendsChatMemberJoined, FriendsChatMemberLeft, NameableNameChanged, RemovedFriend } from "../../api/events";
import type { EventBus } from "../../client/eventbus/EventBus";
export function bindSocialEvents(state: SocialState, bus: EventBus): () => void {
    const pending: object[] = [];
    const updateNames = <T extends NameableImpl>(items: Array<{ name: string; previousName: string; world?: number; rank?: number }>, previous: Map<string, T>, create: (item: { name: string; previousName: string; world?: number; rank?: number }) => T) => {
        const next = new Map<string, T>();
        for (const item of items) {
            const name = socialNameKey(item.name), before = previous.get(name) ?? previous.get(socialNameKey(item.previousName));
            const node = before ?? create(item);
            const changed = node.name !== item.name || node.previousName !== (item.previousName || null);
            node.name = item.name; node.previousName = item.previousName || null;
            if (node instanceof FriendImpl) { node.world = item.world ?? 0; node.rank = item.rank ?? 0; }
            next.set(name, node);
            if (before && changed) pending.push(new NameableNameChanged(node));
        }
        const retained = new Set(next.values());
        for (const node of previous.values()) if (!retained.has(node)) pending.push(new RemovedFriend(node));
        previous.clear(); for (const [key, node] of next) previous.set(key, node);
    };
    return subscribeFriendsChat((snapshot: FriendsChatSnapshot) => {
        updateNames(snapshot.friends, state.friends, item => new FriendImpl(item.name, item.previousName || null, item.world ?? 0, item.rank ?? 0));
        updateNames(snapshot.ignores, state.ignores, item => new NameableImpl(item.name, item.previousName || null));
        const joined = snapshot.channel !== undefined;
        const sameChannel = joined && state.channelName === snapshot.channel?.name && state.owner === snapshot.channel.owner;
        const next = new Map<string, FriendsChatMemberImpl>();
        for (const member of snapshot.channel?.members ?? []) {
            const key = socialNameKey(member.name), old = sameChannel ? state.members.get(key) : undefined;
            const node = old ?? new FriendsChatMemberImpl(member.name, member.rank, member.world);
            node.name = member.name; node.rank = member.rank; node.world = member.world; next.set(key, node);
        }
        for (const [key, node] of state.members) if (!sameChannel || !next.has(key)) pending.push(new FriendsChatMemberLeft(node));
        const oldMembers = new Map(state.members);
        state.members.clear(); for (const [key, node] of next) state.members.set(key, node);
        state.myRank = snapshot.channel?.localRank ?? -1; state.kickRank = snapshot.channel?.minKickRank ?? -1;
        state.channelName = snapshot.channel?.name ?? null; state.owner = snapshot.channel?.owner ?? null;
        const changedChannel = state.joined !== joined; state.joined = joined;
        if (changedChannel) pending.push(new FriendsChatChanged(joined));
        for (const [key, node] of next) if (!sameChannel || !oldMembers.has(key)) pending.push(new FriendsChatMemberJoined(node));
        for (const event of pending.splice(0)) bus.post(event);
    });
}
