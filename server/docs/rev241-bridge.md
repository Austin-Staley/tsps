# Revision 241 protocol bridge

The bridge is an in-process TCP frontend on the existing tsps player session. The browser WebSocket client is unchanged and keeps speaking the custom protocol. A revision 241 RuneLite / Jagex gamepack speaks the Jagex protocol on a second socket. Gameplay (movement, combat, interfaces, the Fractured Archive plugins, `::tfaroom`) stays in the TypeScript server. This process never opens a connection to Jagex.

The cache is the one already configured for the server, `osrs-241_2026-10-20` (OpenRS2 archive 2746, revision 241), read from `server/caches` through `CachePipeline`. JS5 answers from that directory. It does not download a cache as part of serving a client.

## How to run

The bridge starts with the game server. From the server directory (`D:\Repositories\tsps\server` on OSRS-DEV01, or `server/` on Linux):

```
yarn dev
```

or the same `yarn start` already used for the browser listener. Leave the browser port alone (`WEBSOCKET_PORT`, default 43594).

| Variable | Default | Meaning |
| --- | --- | --- |
| `REV241_ENABLED` | on | `0` does not bind the TCP port |
| `REV241_HOST` | `127.0.0.1` | Bind address. Unset stays on localhost |
| `REV241_PORT` | `43595` | TCP port. 43594 is the OpenRune default on the same machine |

Paths use `path.join`, so the same code runs on Windows and Linux. The RSA file is `data/rev241/rsa.json` under the process working directory. `yarn dev` and `yarn start` run with the server directory as the working directory, which is `D:\Repositories\tsps\server\data\rev241\rsa.json` on the VM.

Tests, without booting the world:

```
cd server && yarn test:rev241
```

## RSA key

The bridge does not use Jagex's public key (that value is still in `NetworkConstants` for the old browser login and must not be copied into the Kevlar client). On first start the server writes a 1024-bit key, public exponent **65537**, to `server/data/rev241/rsa.json`. That file holds the private exponent: it is gitignored and must never be committed. Each install generates its own key, and it stays stable across restarts for as long as the file is kept. Delete it to rotate the key (then update the client config).

The server also writes the public half to `server/data/rev241/rsa.public.json` (`modulusHex`, decimal `modulus`, `exponent`). That is the value to copy into the Kevlar tsps profile. The modulus is 128 bytes with the high bit set, so a signed byte array needs a leading `00`.

Public exponent: `65537`.

The client encrypts the login block as raw RSA (`m^e mod n`, no PKCS#1 padding), which is what `LoginBlockDecoder` decrypts. The check byte at the start of the plaintext is `1`.

## What the client has to do

`Austin-Staley/kevlar-client` is private. The GitHub API from this environment returned 404, so this branch does not name a file inside that repo as if it had been opened, and it does not modify that repo.

Stock RuneLite 1.13.3, which the Kevlar launcher already boots with the vanilla revision 241 gamepack, has these relevant switches:

- `--jav_config <url>` selects the jav_config the gamepack loads. A `file:///` URL is enough. That config's server-list parameter is what chooses the game host and port. Point it at `127.0.0.1` port `43595`.
- `--insecure-write-credentials` lets the client store a password for a host that is not Jagex. It does not change the host or the RSA key.
- `--developer-mode` turns on RuneLite's developer tools. It does not change the host or the RSA key.
- RuneLite's own world hopper list is not the list the gamepack dials. Overriding only that list leaves the game socket on Jagex.

The RSA modulus is read from the gamepack when the client class initialises. A RuneLite plugin that runs after that load cannot reliably replace it. RSProx's private-server config does the swap before the gamepack runs (`modulus` as hex, plus a jav_config URL and the revision). That is the pattern to copy. It is not a suggestion to point anything at Jagex.

Proposed change, for Austin to apply in kevlar-client:

1. Find the launcher class that calls `RuneLite.main` (the Gradle `application` main class, or a search for `jav_config` / `RuneLite.main`). The change goes there, not in a plugin.
2. Before the gamepack is loaded, replace Jagex's 1024-bit modulus with `modulusHex` from `rsa.public.json`. Public exponent stays `65537`. If the gamepack stores the integer as a signed byte array, prepend `00` because this modulus has its high bit set.
3. Pass `--jav_config` pointing at a local jav_config whose single world is `127.0.0.1:43595`, and pass `--insecure-write-credentials`.

Nothing in this repository connects to `oldschool*.runescape.com` or downloads a gamepack.

## Protocol

Opcodes and sizes are copied, not invented.

- Server opcodes and the login response: blurite/rsprot `protocol/osrs-241`, commit `37c4eb46e4731ae6764343d136f3076a50567ec1` (MIT). Maven coordinate `net.rsprot:osrs-241-api:1.0.0-ALPHA-20261014`. Encoders are the server write order. `WHATSNEW.md` records that revision 237 removed XTEA keys from rebuild packets.
- Client opcodes, sizes, and decoders: blurite/rsprox `protocol/osrs-241`, commit `46719fd14b0138dbd5851c910328554fd622d087` (MIT).
- OpenRune consumes rsprot. It is not a second opcode source.
- Byte transforms are `JagexByteBufExtensions.kt` in that rsprot commit. ISAAC header obfuscation is `OutgoingMessageEncoder.kt` (`seed[i] + 50` on the encode cipher, raw seed on the decode cipher). Login responses use a nop cipher. `GameLoginResponseHandler` writes opcode `2`, then a hardcoded size byte `37`, then 34 payload bytes. This server pads the other 3 bytes with zeros so the client does not eat the next packet.

Login is two sockets. Opcode `15` is JS5 and stays open. Opcode `14` is game init: the server replies `0` and an 8-byte session id. Opcode `16` (or `18` for reconnect) is the RSA/XTEA login block. A revision other than 241 gets opcode `6` and the socket closes. CRCs in the XTEA block are not checked.

JS5 group bytes are the cache group with the 2-byte version trailer removed, then `prepareJs5Buffer` (512-byte blocks, `0xFF` between blocks). A missing group is dropped. The stream is not ISAAC'd.

Rebuild normal V2 is six bytes (`zoneZ`, `zoneX` as `p2Alt1`, `worldArea`) after the login GPI block. The GPI block is 30 bits of packed coordinate (`level << 28 | x << 14 | z`) and then 18 bits per other player index. The client treats a rebuild as a login rebuild only when it is at least the GPI size plus those six bytes (`StaticRebuildV2Decoder.MINIMUM_REBUILD_LOGIN_CAPACITY`). Later rebuilds are exactly six bytes. Map XTEA keys are not on the wire. The stock client is assumed to already have the keys for cache 2746, including Fractured Archive templates of real regions. If the map is black, that assumption is wrong: do not invent an XTEA packet, the revision removed it.

Rebuild region V2 is the zone header, a distinct mapsquare count, and the 4×13×13 bit palette. No keys. `TemplatedInstanceArea.packTemplateChunk` already matches rsprot's `ReferenceZone` packing, so the Fractured Archive scene packet is re-encoded, not reinterpreted.

Player info is opcode 27. NPC info small is opcode 150 (large is 131 when the payload is big). Varps are opcodes 21 and 40. There is no varbit packet; varbits are folded into the base varp with `CacheDefinitions.getVarbit`. The backpack is container 93 on interface 149. The browser client still says 3214 for that widget; incoming inventory clicks from group 149 are handed to the existing handlers as widget 3214.

## Milestones

The world spawn in `server/data/definitions/world.json` is tile **3089, 3524, plane 0** (the Edgeville area the browser client already uses). It is not the classic Lumbridge tile 3222, 3218. The bridge does not move it. A logged-in revision 241 player stands on that same tile.

### M1 — handshake, login, JS5, standing in the world

Verified by `server/tests/rev241-bridge.test.ts`:

- RSA login block round-trip (check byte, seed, session id, username, password).
- JS5 framing: 512-byte blocks and the `0xFF` separator, version trailer stripped.
- Login OK is opcode 2, size byte 37, player index in the payload.
- A headless TCP client on `127.0.0.1` and an ephemeral port completes opcode 14, login, and a login rebuild whose first 30 bits are tile 3089, 3524, plane 0, followed by player info that carries the display name.
- ISAAC is not advanced when a client packet is short. Game headers use the seed+50 cipher.

Not verified against Kevlar or a real gamepack. JS5 bytes are framed and the reader is wired to `FileStore.read`; a full cache download was not exercised here because that needs the cache files present and a client. Reconnect (opcode 18) is accepted as a new login. A second login of the same name while the first player is still in the world fails the way the browser login already fails.

### M2 — movement, player and NPC info, chat, `::tfaroom`

Verified:

- `MOVE_GAMECLICK` / minimap clicks become the existing `move` message (world x, world y, key modifier).
- `CLIENT_CHEAT` becomes a chat message `::command`. `::tfaroom` is that path, and `ChatPacketListener` already runs `::` text through the command handler. The command itself is unchanged.
- Player info: stationary run-length, a one-tile north walk opcode (`N` = 6, from rsprot `CellOpcodes`), and the appearance block.
- NPC info: an add of Ocellus id 16673, then a following tick with a high-resolution count of 1 and no movement.
- A browser `REBUILD_NORMAL` that still contains XTEA keys is translated to `REBUILD_NORMAL_V2` with the GPI block and without those key bytes.

TODO:

- Public chat is Huffman (`PlayerChatEncoder`). The bit-length table lives in cache index 10 under the archive name `huffman` (RuneLite's name for it; not re-confirmed against this cache in these tests). Until that table is loaded, public chat is sent as a game message so the text is not dropped. Commands do not need Huffman.
- NPC facing uses `Direction.getId()` in the 3-bit field `DesktopLowResolutionChangeEncoder` writes. If an NPC faces the wrong way, that mapping is the place to correct. The extended facing block is not sent.
- There is no logout opcode in `GameClientProtId` 0..101. Closing the socket logs the player out through the existing connection cleanup.

### M3 — combat, interfaces, inventory, prayer

Verified:

- A varbit value is folded into its base varp (bits 2..4 of varp 10).
- `VARP_SMALL` byte order matches `VarpSmallEncoder` (`p1Alt3` value, `p2Alt1` id).
- Backpack container 93 / interface 149 encodes an item id+1 and a count over 255 as `UpdateInvFullEncoder` specifies.
- Hits use the shared hitmark encoder (type, damage, delay, limit). The limit field repeats the damage. TODO: rsprot's `Hitmark.limit` is a separate cap and tsps does not store one.
- Hitsplat type ids are the same cache ids `PlayerSession` already sends (RuneLite `HitsplatID` damage / poison / venom / heal).
- Prayer has no packet of its own. Quick prayers and prayer points already move as varbits and as the prayer skill; the bridge folds the varbits and sends `UPDATE_STAT_V2`.

TODO, labelled in code:

- Run energy scale. `UpdateRunEnergyEncoder` writes a short. This server sends `percent * 100` (`RUN_ENERGY_SCALE`). If the orb is empty or pinned, that constant is wrong.
- `UPDATE_STAT_V2.invisibleBoostedLevel` is set equal to the visible level. tsps does not track a separate invisible level.
- `IF_SETEVENTS_V2` events1/events2 are the browser flags word and the op mask. If a button does not click, that split is the assumption to fix.
- Widget client scripts (`WIDGET_RUN_SCRIPT`, including members script 828) are not forwarded. There is no cited encoder wired for them. The interface still opens via `IF_OPENTOP` / `IF_OPENSUB`.
- Ground-item ownership and despawn times. `ObjAddEncoder`'s ownership byte is 0 and the timers are the server's tick counts. The client may want client cycles (20 ms). Op flags are 0 until a capture shows the value that enables Take.
- `LOC_DEL` sends the zone-follows header only. The zone loc-delete body is not wired, so a removed loc can linger until the next rebuild.
- Area sounds are sent as a non-positional `SYNTH_SOUND`. The zone `SOUND_AREA` encoder is not wired.
- Projectile actor indexes use `0xFFFFFF` for "no actor". Confirm if a projectile misses.

### M4 — Fractured Archive Ocellus room

Verified in unit tests: a region palette encodes as `REBUILD_REGION_V2` with a mapsquare count and the 26-bit chunk, and the XTEA key bytes from the browser packet are absent. `::tfaroom` decodes to the command chat message the Fractured Archive plugin already handles. Ocellus ids 16673 and the other archive NPCs are ordinary NPC-info adds once they are in `player.getLocalNpcs()`.

Not verified: playing an Ocellus room end to end. That needs the running world, the cache, the plugins, and Austin's client on OSRS-DEV01. Boats (`REBUILD_WORLDENTITY`, `WORLDENTITY_INFO`) are logged once and dropped. Fractured Archive rooms are region rebuilds, not boats.

## Layout

`server/src/main/typescript/elvarg/net/rev241/`

| File | Role |
| --- | --- |
| `Rev241Server.ts` | TCP state machine, JS5, login, ISAAC |
| `WorldLogin.ts` | Builds a `ClientConnection` on the existing session |
| `Translate.ts` | Browser frames to Jagex frames. Sync packets are re-encoded from the live player |
| `Inbound.ts` | Jagex client packets to the existing `ClientMessage` values |
| `PlayerInfo.ts`, `NpcInfo.ts`, `Packets.ts` | Encoders |
| `LoginBlock.ts`, `RsaKeys.ts`, `Xtea.ts`, `Js5.ts`, `Frame.ts`, `JagBuf.ts`, `opcodes.ts` | Handshake and framing |

`IsaacRandom` gained `clone()` so a short client read does not advance the live cipher.

## License

The server stays BSD-2-Clause. rsprot and rsprox are MIT; this tree does not vendor their source. The encoders are reimplementations of the cited files, and each file names the source it follows.
