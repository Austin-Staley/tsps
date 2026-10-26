/**
 * OSRS revision 241 opcodes.
 *
 * Server ids: blurite/rsprot `protocol/osrs-241/.../GameServerProtId.kt`
 * Client ids and sizes: blurite/rsprox `protocol/osrs-241/.../GameClientProt.kt`
 *   (sizes) joined to `GameClientProtId.kt`.
 * Both trees pinned at rsprot 37c4eb46e4731ae6764343d136f3076a50567ec1 and
 * rsprox 46719fd14b0138dbd5851c910328554fd622d087 (master on 2026-10-26).
 *
 * A size of -1 is VAR_BYTE and -2 is VAR_SHORT (`Prot` in rsprot).
 * Opcode 52 is unused in GameClientProtId (the id list jumps from 51 to 53).
 * Opcode 59 is VAR_BYTE (`AFFINEDCLANSETTINGS_ADDBANNED_FROMCHANNEL`).
 */

export const REV241 = 241;

export const ServerOp = {
  LOGOUT: 1,
  SERVER_TICK_END: 2,
  UPDATE_RUNENERGY: 3,
  CAM_RESET: 8,
  IF_SETTEXT: 11,
  IF_SETANIM: 7,
  VARP_SMALL: 21,
  VARP_LONG: 24,
  PLAYER_INFO: 27,
  UPDATE_INV_PARTIAL: 28,
  MIDI_SONG_V2: 29,
  VARP_LARGE: 40,
  REBUILD_REGION_V2: 39,
  IF_CLOSESUB: 45,
  LOC_ADD_CHANGE_V2: 48,
  UPDATE_ZONE_PARTIAL_FOLLOWS: 55,
  SYNTH_SOUND: 69,
  IF_SETEVENTS_V2: 75,
  IF_SETHIDE: 57,
  UPDATE_ZONE_FULL_FOLLOWS: 68,
  IF_OPENSUB: 93,
  REBUILD_NORMAL_V2: 96,
  PROJANIM_SPECIFIC_V4: 99,
  UPDATE_STAT_V2: 110,
  IF_OPENTOP: 120,
  IF_SETOBJECT: 123,
  MESSAGE_GAME: 124,
  UPDATE_INV_FULL: 126,
  NPC_INFO_LARGE_V6: 131,
  SET_MAP_FLAG_V2: 139,
  NPC_INFO_SMALL_V6: 150,
  UPDATE_ZONE_PARTIAL_ENCLOSED: 107,
  SET_PLAYER_OP: 81,
  RESET_ANIMS: 71,
  LOGOUT_WITHREASON: 74,
} as const;

/** Zone-prot ordinals inside UPDATE_ZONE_PARTIAL_ENCLOSED. rsprot DesktopUpdateZonePartialEnclosedEncoder enum order. */
export const ZoneOrdinal = {
  LOC_DEL: 3,
  OBJ_DEL: 5,
  OBJ_ADD: 9,
  LOC_ADD_CHANGE_V2: 11,
} as const;

/** Login server opcodes. rsprot LoginServerProtId.kt. Size-0 responses are a single byte. */
export const LoginOp = {
  OK: 2,
  INVALID_USERNAME_OR_PASSWORD: 3,
  CLIENT_OUT_OF_DATE: 6,
} as const;

/**
 * Client packet sizes indexed by opcode. Missing opcode 52 is `null`
 * (not assigned in GameClientProtId).
 */
export const CLIENT_PACKET_SIZES: Array<number | null> = [
  22, 1, -1, 2, 8, 2, 3, 6, 15, 8, // 0
  8, 10, 3, 3, -1, 16, 6, -2, 9, 3, // 10
  -1, 3, 15, 2, 8, -1, 3, 7, 4, -1, // 20
  3, 4, 3, -1, 0, 3, -1, 11, 9, 2, // 30
  3, 0, 11, 4, 4, -1, 16, 2, 4, -1, // 40
  -2, -1, null, 2, 3, -1, -1, -1, -1, -1, // 50  (52 unused, 59 VAR_BYTE)
  -1, 11, 11, 8, 3, 8, 10, 4, 4, 5, // 60
  1, 8, 8, 1, 0, 0, 4, -2, 4, 8, // 70
  -1, -1, 3, -1, -1, -1, 4, -1, 26, 11, // 80
  6, 11, 4, 1, 15, 3, 15, 1, 8, 0, // 90
  8, -2, // 100
];

export const ClientOp = {
  RESUME_P_OBJDIALOG: 3,
  OPLOC2: 4,
  OPLOCT: 8,
  RESUME_P_LONGDIALOG: 10,
  OPPLAYER1: 12,
  IF_BUTTONT: 15,
  RESUME_PAUSEBUTTON: 16,
  IF_BUTTONX: 38,
  CLOSE_MODAL: 41,
  OPNPC2: 44,
  IF_BUTTOND: 46,
  MESSAGE_PUBLIC: 49,
  OPNPC6: 53,
  OPPLAYER5: 54,
  MOVE_GAMECLICK: 55,
  RESUME_P_STRINGDIALOG: 58,
  OPPLAYERT: 61,
  OPNPCT: 62,
  IF_SUBOP: 66,
  RESUME_P_COUNTDIALOG: 68,
  WINDOW_STATUS: 69,
  OPOBJ1: 71,
  OPLOC1: 72,
  SET_HEADING: 73,
  IDLE: 74,
  NO_TIMEOUT: 75,
  OPNPC5: 76,
  IF_BUTTON: 78,
  OPLOC4: 79,
  MOVE_MINIMAPCLICK: 81,
  CLIENT_CHEAT: 84,
  OPNPC3: 86,
  OPNPC1: 92,
  OPOBJT: 94,
  OPPLAYER7: 95,
  MAP_BUILD_COMPLETE: 99,
  OPLOC3: 100,
  EVENT_KEYBOARD: 101,
  RESUME_P_NAMEDIALOG: 33,
  OPNPC4: 31,
  OPLOC5: 24,
  OPLOC6: 39,
  OPOBJ2: 98,
  OPOBJ3: 65,
  OPOBJ4: 63,
  OPOBJ5: 9,
  OPOBJ6: 90,
  OPPLAYER2: 35,
  OPPLAYER3: 30,
  OPPLAYER4: 26,
  OPPLAYER6: 64,
  OPPLAYER8: 40,
} as const;
