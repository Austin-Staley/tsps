import type { Actor } from "./Actor";
import type { PlayerComposition } from "./PlayerComposition";
import type { HeadIcon } from "./HeadIcon";
export interface Player extends Actor { getId(): number; getPlayerId(): number; getTeam(): number; isHidden(): boolean; getSkullIcon(): number; setSkullIcon(icon:number):void; getOverheadIcon(): HeadIcon|null; getPlayerComposition():PlayerComposition|null; isFriend():boolean; isFriendsChatMember():boolean; }
