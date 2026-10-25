# Friends chat and player following

The [OSRS chat-channel page](https://oldschool.runescape.wiki/w/Chat-channel) documents the slash-prefixed channel messages, owner-controlled entry/talk/kick ranks, ignore-based entry blocking, temporary 60-minute kick bans, and 500-member capacity. It also says a channel reset when empty clears those bans. The implementation follows those rules in `FriendsChatManager`; its saved player fields retain the channel name, three access ranks, friend ranks, and last joined owner. `player-save.test.cjs` covers that save/load round-trip, which also supplies the offline-owner profile path used on automatic rejoin.

The [player page](https://oldschool.runescape.wiki/w/New_character) lists Follow among a player's right-click options. It does not describe follow movement or teleport/logout cleanup. In this server, follow is a transient `Mobile` reference: ordinary movement interactions clear it through `MovementQueue.walkToReset`, known player actions clear it as they dispatch, logout clears the departing player's reference, and `Mobile` clears follow-owned interaction/facing state before a player relocation. These cleanup paths are implementation behavior covered by local tests; they are not independently verified against live OSRS. The movement tick also drops a follow when its target is no longer registered or is in another private area.

Presence is single-world: friend snapshots resolve currently registered players in this server's `World` and send world 1 for visible online friends. Cross-world presence and the live OSRS behavior of the right-click Follow action's edge cases remain outside this implementation.

## Public chat and autochat

Public chat arrives as the CHAT packet (kind byte 0 public, 1 game, 2 friends chat, 3 public autochat) and
goes out as a CHAT_MESSAGE of type 2 to every local player whose public filter admits the speaker
(`PlayerRelations.canReceivePublicChatFrom`; the Public stone's modes 0 Show standard, 1 Show friends,
2 Show none, 3 Hide, 4 Show autochat), plus the overhead line.

Autochat is the [Chat Interface](https://oldschool.runescape.wiki/w/Chat_Interface) "Setup your autochat"
option and lives in the cache scripts: the phrase sits in varcstring 358, "Pause/Resume autochat" flips
varcint 62, and the chatbox timer (proc 552) forces the public filter to mode 4 and calls
`chat_sendpublic(text, 1)` every 150 client cycles (3 seconds). The client sends kind 3 for type 1, the
server flags the social packet `public_chat` with `autoChat` and delivers it as type 90 (AUTOTYPER, or 91
MODAUTOTYPER with a mod crown) so the chatbox colours it as "Auto chat". The cache chatbox shows those lines
only in mode 4 "Show autochat" (beside standard chat), so the server sends autochat only to listeners on
mode 4. The overhead text is still the plain forced chat; the public filter does not hide it.
