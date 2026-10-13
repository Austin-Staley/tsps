/**
 * The Blood Moon Rises (members, Myreque #6). Dialogue and action ids are
 * taken from the current OSRS Wiki transcript export in npc-dialogues.json;
 * quest state uses the cache's myq6 varbit (15464 in varp 5618).
 */
module.exports = function registerTheBloodMoonRises(api) {
  const { Boundary, Equipment, HitDamage, HitMask, Item, ItemIdentifiers, Location, NpcIdentifiers, ObjectDefinition, ObjectIdentifiers, PrayerHandler, PrivateArea, Skill, World } = api.core;
  const { registerQuest, loadTranscripts, startTranscript } = require("../QuestRuntime");
  require("../bmr/Refinery.TheBloodMoonRises")(api);
  const PAGE = "The Blood Moon Rises";
  const START_HOOK = "quest:the-blood-moon-rises:start";
  const TOME_ID = ItemIdentifiers.TOME_OF_EXPERIENCE_3;
  const PREP_ATTRIBUTE = "quest.the_blood_moon_rises.preparations";
  const THRONE_PUZZLE_ATTRIBUTE = "quest.the_blood_moon_rises.castle-throne-puzzle";
  const THRONE_BUST_VARBITS = Object.freeze([15539, 15540, 15541, 15542]);
  const BASIN_PUZZLE_ATTRIBUTE = "quest.the_blood_moon_rises.castle-basin-puzzle";
  const SOLID_KEY_ATTRIBUTE = "quest.the_blood_moon_rises.castle-solid-key-puzzle";
  const CLOCK_ATTRIBUTE = "quest.the_blood_moon_rises.castle-clocks";
  const GALLERY_CHEST_ATTRIBUTE = "quest.the_blood_moon_rises.gallery-chest";
  const REFINER_ATTRIBUTE = "quest.the_blood_moon_rises.castle-refiner";
  const HUNT_ATTRIBUTE = "quest.the_blood_moon_rises.blood-hunt";
  const HIDEOUT_IVAN_VARBIT = 15467;
  const HIDEOUT_SHRINE_INSPECTED = "quest.the_blood_moon_rises.hideout-shrine-inspected";
  const HIDEOUT_DEFENSE_COMPLETE = "quest.the_blood_moon_rises.hideout-defense-complete";
  const SLEPE_STORY_ATTRIBUTE = "quest.the_blood_moon_rises.slepe-story";
  const CASTLE_SHRINE_ATTRIBUTE = "quest.the_blood_moon_rises.castle-shrine-prayed";
  const CASTLE_SHRINE_VARBIT = 15470;
  const CASTLE_ROOM_ATTRIBUTE = "quest.the_blood_moon_rises.castle-room";
  const CASTLE_FLOOR_ATTRIBUTE = "quest.the_blood_moon_rises.castle-floor";
  const CASTLE_WORLD_MAP_FLOOR_VARBIT = 15489;
  const CASTLE_LAST_ROOM_VARBIT = 15499;
  const CASTLE_GROUND_FLOOR = 1;
  const CASTLE_NATIVE_STAGE_ATTRIBUTE = "quest.the_blood_moon_rises.castle-native-stage";
  const CASTLE_STORY_ATTRIBUTE = "quest.the_blood_moon_rises.castle-story";
  const CASTLE_BOOK_PUZZLE_ATTRIBUTE = "quest.the_blood_moon_rises.castle-book-puzzle";
  const CASTLE_TRANSITION_PENDING_ATTRIBUTE = "quest.the_blood_moon_rises.castle-transition-pending";
  const CASTLE_BOOK_VARBITS = Object.freeze([15550, 15551, 15552, 15553, 15554, 15555, 15556, 15557]);
  const CASTLE_GILDED_BOOKCASE_VARBIT = 15525;
  const CASTLE_BOOKCASE_INTERFACE = 962;
  const CASTLE_BOOK_ITEMS = Object.freeze({ gilded: 33767, vampyre: 33768, fullMoonKey: ItemIdentifiers.FULL_MOON_KEY,
    halfMoonKey: ItemIdentifiers.HALF_MOON_KEY, crescentMoonKey: ItemIdentifiers.CRESCENT_MOON_KEY,
    newMoonKey: ItemIdentifiers.NEW_MOON_KEY, gibbousMoonKey: ItemIdentifiers.GIBBOUS_MOON_KEY });
  const CASTLE_KEY_ITEMS = Object.freeze({
    plug: ItemIdentifiers.SINK_PLUG,
    pipe: ItemIdentifiers.BROKEN_PIPE,
    knife: ItemIdentifiers.SHARP_KNIFE,
    tongs: ItemIdentifiers.TONGS,
    needle: ItemIdentifiers.SYRINGE_NEEDLE,
    barrel: ItemIdentifiers.SYRINGE_BARREL,
    plunger: ItemIdentifiers.SYRINGE_PLUNGER,
    emptySyringe: ItemIdentifiers.EMPTY_SYRINGE,
    fullSyringe: ItemIdentifiers.FULL_SYRINGE,
    stomach: ItemIdentifiers.VENATOR_STOMACH,
    leftCrest: ItemIdentifiers.LEFT_CREST_HALF,
    rightCrest: ItemIdentifiers.RIGHT_CREST_HALF,
    fullCrest: ItemIdentifiers.FULL_CREST,
    sword: ItemIdentifiers.SWORD,
    axe: ItemIdentifiers.BATTLEAXE,
    mace: ItemIdentifiers.MACE_3,
  });
  // Visible Castle Drakan loc ids from the current client cache gamevals.
  const CASTLE_KEY_LOC_IDS = Object.freeze({
    searchableCrate: 61751,
    kitchenSink: [61719, 61720, 61721],
    larderSink: [61722, 61723, 61724, 61725],
    larderCabinet: 61726,
    kitchenCorpse: [61727, 61728, 61729],
    kitchenChest: [61683, 61684],
    armouryChest: [61685, 61686],
    weaponCase: 61741,
    statue1: 61742,
    statue2: 61743,
    statue3: 61744,
    statue4: 61745,
    unarmedStatue: 61746,
    swordStatue: 61747,
    maceStatue: 61749,
    axeStatue: 61750,
    studyFireplace: [61665, 61666, 61667],
  });
  const CASTLE_KEY_OBJECTS = Object.freeze({
    crate: new Set([CASTLE_KEY_LOC_IDS.searchableCrate]),
    kitchenSink: new Set(CASTLE_KEY_LOC_IDS.kitchenSink),
    larderSink: new Set(CASTLE_KEY_LOC_IDS.larderSink),
    larderCabinet: new Set([CASTLE_KEY_LOC_IDS.larderCabinet]),
    corpse: new Set(CASTLE_KEY_LOC_IDS.kitchenCorpse),
    kitchenChest: new Set(CASTLE_KEY_LOC_IDS.kitchenChest),
    weaponCase: new Set([CASTLE_KEY_LOC_IDS.weaponCase]),
    armouryChest: new Set(CASTLE_KEY_LOC_IDS.armouryChest),
    statues: new Set([CASTLE_KEY_LOC_IDS.statue1, CASTLE_KEY_LOC_IDS.statue2,
      CASTLE_KEY_LOC_IDS.statue3, CASTLE_KEY_LOC_IDS.statue4, CASTLE_KEY_LOC_IDS.unarmedStatue,
      CASTLE_KEY_LOC_IDS.swordStatue, CASTLE_KEY_LOC_IDS.maceStatue, CASTLE_KEY_LOC_IDS.axeStatue]),
    studyFireplace: new Set(CASTLE_KEY_LOC_IDS.studyFireplace),
  });
  const CASTLE_KEY_VARBITS = Object.freeze({ sinkEmptied: 15536, larderSink: 15537,
    corpseOpened: 15538, kitchenChest: 15518, fireplace: 15535,
    statue1: 15545, statue2: 15546, statue3: 15547, statue4: 15548 });
  const CASTLE_GILDED_BOOKCASE_IDS = new Set([61692, 61693, 61694, 61695]);
  const CASTLE_LIBRARY = Object.freeze({ z: 0, minX: 2448, maxX: 2461, minY: 7384, maxY: 7398,
    gildedBookcase: [2455, 7395], vampyreBookcase: [2458, 7388],
    westernBookcase: [2451, 7391], passage: [2455, 7386], secretKey: [2433, 7416] });
  const CASTLE_ACTORS = new Map();
  const CASTLE_ACTOR_OWNERS = new Map();
  // Cache gamevals from client/runelite/api/gameval/NpcID.ts. These Castle
  // variants have quest actions that are absent from the generic NPC IDs.
  const CASTLE_NPC = Object.freeze({
    IVAN_LIBRARY: 15845,
    IVAN_ENTRY_HALL: 15846,
    VELIAF_GALLERY: 15867,
    VELIAF_ENTRY_HALL: 15869,
    SAFALAAN_PRISON: 15888,
    VANESCULA_PRISON: 15903,
    VANESCULA_CASTLE: 15907,
    LOWERNIEL_CUTSCENE_NO_WING: 15924,
    SANGUIDAE: 16223,
    VENATOR: 16213,
    VENATOR_5: 16217,
  });
  const CASTLE_ROOM = Object.freeze({
    LOBBY: 1, DINING: 2, THRONE: 3, SOUTH_OF_THRONE: 4, EAST_STAIR_GROUND: 5, STORAGE: 6,
    STUDY: 7, WEST_DINING: 8, THRONE_STORAGE: 9, LARDER: 10, KITCHEN: 11, GALLERY_HALL: 12,
    GALLERY: 13, CHAPEL_LIBRARY: 14, WEST_CHAPEL: 15, BOTTLE_ROOM: 16, NORTH_CHAPEL: 17,
    UPPER_SOUTH_HALL: 18, ABOVE_STUDY: 19, BEDROOM: 20, ORNATE_KNIFE: 21,
    EAST_STAIR_FIRST: 22, VANESCULA_STUDY: 23, VANESCULA_CHAMBER: 24, EMBLEM_ROOM: 25,
    RANIS_PARLOUR: 26, CRESCENT_ROOM: 27, EXPLOSIVE_ROOM: 28, IVAN_ROOM: 29,
    SERVANTS_QUARTERS: 30, EXPLOSIVE_HALL: 31, SECRET_ROOM: 32, SMALL_HALL: 33,
    NORTH_LOBBY_HALL: 34, VANESCULA_HALL: 35, RANIS_HALL: 36, VENATOR_ROOM: 37,
    DISPLAY_ROOM: 38, VENATOR_PUZZLE: 39, SOLID_KEY_ROOM: 40, SOLID_DOOR_STORAGE: 41,
    LABORATORY: 42, STOCKPILE_STORAGE: 43, VENATOR_LIBRARY: 44, SOLID_DOOR_HALL: 45,
    GUEST_STORAGE: 46, BASEMENT_HALL: 48, BASEMENT_VENATOR: 49, BASEMENT_STORAGE: 50,
    BASEMENT_PRISON: 51,
  });
  // Cache gameval loc ids from client/runelite/api/gameval/ObjectID.ts.
  const CASTLE_DOOR_IDS = Object.freeze({ DOOR: 61572, DOOR_M: 61573, DOOR_ALT: 61576, DOOR_ALT_M: 61577,
    NEW: 61584, NEW_M: 61585, HALF: 61586, HALF_M: 61587, GIBBOUS: 61588, GIBBOUS_M: 61589,
    FULL: 61590, FULL_M: 61591, CRESCENT: 61592, CRESCENT_M: 61593,
    SOLID: 61574, SOLID_M: 61575, GILDED: 61626, GILDED_M: 61627,
    STAIRS_UP: 61599, STAIRS_UP_NORUG: 61600, STAIRS_DOWN: 61606, STAIRS_DOWN_INVISIBLE: 61608,
    DISPLAY_STAIRS_DOWN: 61609,
    SPIRAL_UP: 61602, SPIRAL_DOWN: 61604, GUEST_PORTAL_IN: 61771, GUEST_PORTAL_OUT: 61770,
    CHAPEL_PORTAL_IN: 61773, CHAPEL_PORTAL_OUT: 61772, PUZZLE_LIBRARY: 61625, IVAN_PASSAGE: 61615 });
  const CASTLE_EMBLEM_IDS = Object.freeze([ItemIdentifiers.DRAKAN_EMBLEM, ItemIdentifiers.DRAKAN_EMBLEM_2,
    ItemIdentifiers.DRAKAN_EMBLEM_3]);
  // The Castle's Enter doors link distinct room endpoints. Quest Helper's
  // CastleDrakanRoomNetwork records the paired cache locs; the arrival tiles
  // below are adjacent, collision-clear tiles on the destination side.
  // shortcut: exact OSRS arrival tiles are not published, so use the verified
  // paired door endpoints and cache-walkable adjacent tiles until captured.
  const CASTLE_DOOR_TRANSITIONS = Object.freeze([
    { id: 61577, x: 2327, y: 7360, from: CASTLE_ROOM.LOBBY, to: CASTLE_ROOM.DINING, landing: [2342, 7372] },
    { id: 61576, x: 2328, y: 7360, from: CASTLE_ROOM.LOBBY, to: CASTLE_ROOM.DINING, landing: [2342, 7372] },
    { id: 61573, x: 2342, y: 7373, from: CASTLE_ROOM.DINING, to: CASTLE_ROOM.LOBBY, landing: [2327, 7362] },
    { id: 61572, x: 2341, y: 7373, from: CASTLE_ROOM.DINING, to: CASTLE_ROOM.LOBBY, landing: [2327, 7362] },
    { id: 61572, x: 2358, y: 7366, from: CASTLE_ROOM.DINING, to: CASTLE_ROOM.THRONE, landing: [2305, 7391] },
    { id: 61572, x: 2304, y: 7391, from: CASTLE_ROOM.THRONE, to: CASTLE_ROOM.DINING, landing: [2357, 7366] },
    { id: 61573, x: 2304, y: 7392, from: CASTLE_ROOM.THRONE, to: CASTLE_ROOM.DINING, landing: [2357, 7366] },
    // The half-moon door pair joins the dining room and the western dining hall.
    // shortcut: QH records the paired door tiles, not the OSRS teleport landing; these
    // adjacent destinations are collision-checked and can be refined from a live capture.
    { id: CASTLE_DOOR_IDS.HALF, x: 2336, y: 7370, z: 0, from: CASTLE_ROOM.DINING, to: CASTLE_ROOM.WEST_DINING,
      fromFloor: 1, toFloor: 1, key: CASTLE_BOOK_ITEMS.halfMoonKey, keyName: "half moon key", landing: [2338, 7395] },
    { id: CASTLE_DOOR_IDS.HALF_M, x: 2339, y: 7395, z: 0, from: CASTLE_ROOM.WEST_DINING, to: CASTLE_ROOM.DINING,
      fromFloor: 1, toFloor: 1, key: CASTLE_BOOK_ITEMS.halfMoonKey, keyName: "half moon key", landing: [2337, 7370] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2323, y: 7395, z: 0, from: CASTLE_ROOM.WEST_DINING, to: CASTLE_ROOM.STORAGE,
      fromFloor: 1, toFloor: 1, landing: [2347, 7383] },
    { id: CASTLE_DOOR_IDS.DOOR_M, x: 2348, y: 7383, z: 0, from: CASTLE_ROOM.STORAGE, to: CASTLE_ROOM.WEST_DINING,
      fromFloor: 1, toFloor: 1, landing: [2324, 7395] },
    { id: CASTLE_DOOR_IDS.SPIRAL_UP, x: 2339, y: 7383, z: 0, from: CASTLE_ROOM.STORAGE, to: CASTLE_ROOM.EXPLOSIVE_ROOM,
      fromFloor: 1, toFloor: 1, action: "Climb-up", landing: [2434, 7386] },
    { id: CASTLE_DOOR_IDS.SPIRAL_DOWN, x: 2435, y: 7386, z: 0, from: CASTLE_ROOM.EXPLOSIVE_ROOM, to: CASTLE_ROOM.STORAGE,
      fromFloor: 1, toFloor: 1, action: "Climb-down", landing: [2341, 7384] },
    { id: CASTLE_DOOR_IDS.DOOR_M, x: 2439, y: 7384, z: 0, from: CASTLE_ROOM.EXPLOSIVE_ROOM, to: CASTLE_ROOM.EMBLEM_ROOM,
      fromFloor: 1, toFloor: 1, landing: [2455, 7380] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2455, y: 7381, z: 0, from: CASTLE_ROOM.EMBLEM_ROOM, to: CASTLE_ROOM.EXPLOSIVE_ROOM,
      fromFloor: 1, toFloor: 1, landing: [2439, 7386] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2444, y: 7386, z: 0, from: CASTLE_ROOM.EXPLOSIVE_ROOM, to: CASTLE_ROOM.EXPLOSIVE_HALL,
      fromFloor: 1, toFloor: 1, landing: [2468, 7395] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT_M, x: 2467, y: 7395, z: 0, from: CASTLE_ROOM.EXPLOSIVE_HALL, to: CASTLE_ROOM.EXPLOSIVE_ROOM,
      fromFloor: 1, toFloor: 1, landing: [2443, 7386] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2474, y: 7398, z: 0, from: CASTLE_ROOM.EXPLOSIVE_HALL, to: CASTLE_ROOM.LOBBY,
      fromFloor: 1, toFloor: 2, landing: [2314, 7359, 1] },
    { id: CASTLE_DOOR_IDS.DOOR_M, x: 2314, y: 7360, z: 1, from: CASTLE_ROOM.LOBBY, to: CASTLE_ROOM.EXPLOSIVE_HALL,
      fromFloor: 2, toFloor: 1, landing: [2474, 7397] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2314, y: 7382, z: 1, from: CASTLE_ROOM.LOBBY, to: CASTLE_ROOM.NORTH_LOBBY_HALL,
      fromFloor: 2, toFloor: 2, landing: [2456, 7417, 0] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT, x: 2457, y: 7417, z: 0, from: CASTLE_ROOM.NORTH_LOBBY_HALL, to: CASTLE_ROOM.LOBBY,
      fromFloor: 2, toFloor: 2, landing: [2313, 7381, 1] },
    // Cache placements pair the ground lobby stair at2315,7370 with its
    // first-floor down variant at the same x/y on plane1.
    { id: CASTLE_DOOR_IDS.STAIRS_UP, x: 2315, y: 7370, z: 0, from: CASTLE_ROOM.LOBBY, to: CASTLE_ROOM.LOBBY,
      fromFloor: 1, toFloor: 2, action: "Climb-up", landing: [2314, 7370, 1] },
    { id: CASTLE_DOOR_IDS.STAIRS_DOWN_INVISIBLE, x: 2315, y: 7370, z: 1, from: CASTLE_ROOM.LOBBY, to: CASTLE_ROOM.LOBBY,
      fromFloor: 2, toFloor: 1, action: "Climb-down", landing: [2314, 7369, 0] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT, x: 2466, y: 7422, z: 0, from: CASTLE_ROOM.NORTH_LOBBY_HALL, to: CASTLE_ROOM.VANESCULA_HALL,
      fromFloor: 2, toFloor: 2, landing: [2451, 7403] },
    { id: CASTLE_DOOR_IDS.DOOR_M, x: 2452, y: 7403, z: 0, from: CASTLE_ROOM.VANESCULA_HALL, to: CASTLE_ROOM.NORTH_LOBBY_HALL,
      fromFloor: 2, toFloor: 2, landing: [2456, 7417] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2477, y: 7409, z: 0, from: CASTLE_ROOM.VANESCULA_HALL, to: CASTLE_ROOM.RANIS_HALL,
      fromFloor: 2, toFloor: 2, anyKey: CASTLE_EMBLEM_IDS, keyName: "a Drakan emblem", landing: [2481, 7404] },
    { id: CASTLE_DOOR_IDS.DOOR_M, x: 2481, y: 7403, z: 0, from: CASTLE_ROOM.RANIS_HALL, to: CASTLE_ROOM.VANESCULA_HALL,
      fromFloor: 2, toFloor: 2, anyKey: CASTLE_EMBLEM_IDS, keyName: "a Drakan emblem", landing: [2476, 7409] },
    { id: CASTLE_DOOR_IDS.SPIRAL_DOWN, x: 2491, y: 7402, z: 0, from: CASTLE_ROOM.RANIS_HALL, to: CASTLE_ROOM.NORTH_CHAPEL,
      fromFloor: 2, toFloor: 1, action: "Climb-down", landing: [2384, 7403] },
    { id: CASTLE_DOOR_IDS.SPIRAL_UP, x: 2385, y: 7403, z: 0, from: CASTLE_ROOM.NORTH_CHAPEL, to: CASTLE_ROOM.RANIS_HALL,
      fromFloor: 1, toFloor: 2, action: "Climb-up", landing: [2490, 7401] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2372, y: 7409, z: 0, from: CASTLE_ROOM.NORTH_CHAPEL, to: CASTLE_ROOM.WEST_CHAPEL,
      fromFloor: 1, toFloor: 1, anyKey: CASTLE_EMBLEM_IDS, keyName: "a Drakan emblem", landing: [2371, 7395] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT_M, x: 2371, y: 7396, z: 0, from: CASTLE_ROOM.WEST_CHAPEL, to: CASTLE_ROOM.NORTH_CHAPEL,
      fromFloor: 1, toFloor: 1, anyKey: CASTLE_EMBLEM_IDS, keyName: "a Drakan emblem", landing: [2373, 7409] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2369, y: 7384, z: 0, from: CASTLE_ROOM.WEST_CHAPEL, to: CASTLE_ROOM.GALLERY,
      fromFloor: 1, toFloor: 1, anyKey: CASTLE_EMBLEM_IDS, keyName: "a Drakan emblem", landing: [2387, 7366] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2388, y: 7366, z: 0, from: CASTLE_ROOM.GALLERY, to: CASTLE_ROOM.WEST_CHAPEL,
      fromFloor: 1, toFloor: 1, anyKey: CASTLE_EMBLEM_IDS, keyName: "a Drakan emblem", landing: [2370, 7384] },
    { id: CASTLE_DOOR_IDS.CRESCENT_M, x: 2370, y: 7370, z: 0, from: CASTLE_ROOM.GALLERY, to: CASTLE_ROOM.GALLERY_HALL,
      fromFloor: 1, toFloor: 1, landing: [2342, 7416] },
    { id: CASTLE_DOOR_IDS.CRESCENT, x: 2343, y: 7416, z: 0, from: CASTLE_ROOM.GALLERY_HALL, to: CASTLE_ROOM.GALLERY,
      fromFloor: 1, toFloor: 1, landing: [2371, 7370] },
    { id: CASTLE_DOOR_IDS.CRESCENT_M, x: 2325, y: 7403, z: 0, from: CASTLE_ROOM.GALLERY_HALL, to: CASTLE_ROOM.KITCHEN,
      fromFloor: 1, toFloor: 1, landing: [2314, 7420] },
    { id: CASTLE_DOOR_IDS.CRESCENT, x: 2314, y: 7421, z: 0, from: CASTLE_ROOM.KITCHEN, to: CASTLE_ROOM.GALLERY_HALL,
      fromFloor: 1, toFloor: 1, landing: [2324, 7403] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT, x: 2309, y: 7421, z: 0, from: CASTLE_ROOM.KITCHEN, to: CASTLE_ROOM.LARDER,
      fromFloor: 1, toFloor: 1, landing: [2360, 7393] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT_M, x: 2361, y: 7393, z: 0, from: CASTLE_ROOM.LARDER, to: CASTLE_ROOM.KITCHEN,
      fromFloor: 1, toFloor: 1, landing: [2309, 7420] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT_M, x: 2330, y: 7407, z: 0, from: CASTLE_ROOM.GALLERY_HALL, to: CASTLE_ROOM.LOBBY,
      fromFloor: 1, toFloor: 1, landing: [2327, 7381] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2327, y: 7382, z: 0, from: CASTLE_ROOM.LOBBY, to: CASTLE_ROOM.GALLERY_HALL,
      fromFloor: 1, toFloor: 1, landing: [2331, 7407] },
    { id: CASTLE_DOOR_IDS.HALF_M, x: 2310, y: 7386, z: 0, from: CASTLE_ROOM.THRONE, to: CASTLE_ROOM.SOUTH_OF_THRONE,
      fromFloor: 1, toFloor: 1, landing: [2327, 7390] },
    { id: CASTLE_DOOR_IDS.HALF_M, x: 2327, y: 7391, z: 0, from: CASTLE_ROOM.SOUTH_OF_THRONE, to: CASTLE_ROOM.THRONE,
      fromFloor: 1, toFloor: 1, landing: [2310, 7388] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT, x: 2309, y: 7397, z: 0, from: CASTLE_ROOM.THRONE, to: CASTLE_ROOM.STUDY,
      fromFloor: 1, toFloor: 1, landing: [2357, 7380] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT, x: 2358, y: 7380, z: 0, from: CASTLE_ROOM.STUDY, to: CASTLE_ROOM.THRONE,
      fromFloor: 1, toFloor: 1, landing: [2310, 7395] },
    { id: CASTLE_DOOR_IDS.GIBBOUS, x: 2327, y: 7360, z: 1, from: CASTLE_ROOM.LOBBY, to: CASTLE_ROOM.DINING,
      fromFloor: 2, toFloor: 2, landing: [2342, 7372, 1] },
    { id: CASTLE_DOOR_IDS.GIBBOUS, x: 2342, y: 7373, z: 1, from: CASTLE_ROOM.DINING, to: CASTLE_ROOM.LOBBY,
      fromFloor: 2, toFloor: 2, landing: [2328, 7360, 1] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2358, y: 7366, z: 1, from: CASTLE_ROOM.DINING, to: CASTLE_ROOM.THRONE,
      fromFloor: 2, toFloor: 2, landing: [2305, 7392, 1] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT_M, x: 2304, y: 7392, z: 1, from: CASTLE_ROOM.THRONE, to: CASTLE_ROOM.DINING,
      fromFloor: 2, toFloor: 2, landing: [2357, 7366, 1] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2306, y: 7386, z: 1, from: CASTLE_ROOM.THRONE, to: CASTLE_ROOM.UPPER_SOUTH_HALL,
      fromFloor: 2, toFloor: 2, landing: [2434, 7364] },
    { id: CASTLE_DOOR_IDS.DOOR_M, x: 2434, y: 7365, z: 0, from: CASTLE_ROOM.UPPER_SOUTH_HALL, to: CASTLE_ROOM.THRONE,
      fromFloor: 2, toFloor: 2, landing: [2305, 7386, 1] },
    { id: CASTLE_DOOR_IDS.FULL, x: 2436, y: 7361, z: 0, from: CASTLE_ROOM.UPPER_SOUTH_HALL, to: CASTLE_ROOM.BEDROOM,
      fromFloor: 2, toFloor: 2, landing: [2452, 7364] },
    { id: CASTLE_DOOR_IDS.FULL_M, x: 2452, y: 7365, z: 0, from: CASTLE_ROOM.BEDROOM, to: CASTLE_ROOM.UPPER_SOUTH_HALL,
      fromFloor: 2, toFloor: 2, landing: [2437, 7361] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT_M, x: 2446, y: 7364, z: 0, from: CASTLE_ROOM.UPPER_SOUTH_HALL, to: CASTLE_ROOM.EAST_STAIR_FIRST,
      fromFloor: 2, toFloor: 2, landing: [2458, 7362] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2457, y: 7362, z: 0, from: CASTLE_ROOM.EAST_STAIR_FIRST, to: CASTLE_ROOM.UPPER_SOUTH_HALL,
      fromFloor: 2, toFloor: 2, landing: [2445, 7364] },
    // The current cache places the matching descent at 2459,7371; the QH
    // endpoint at 2359,7371 is an obsolete/incorrectly transcribed location.
    { id: CASTLE_DOOR_IDS.SPIRAL_DOWN, x: 2459, y: 7371, z: 0, from: CASTLE_ROOM.EAST_STAIR_FIRST, to: CASTLE_ROOM.EAST_STAIR_GROUND,
      fromFloor: 2, toFloor: 1, action: "Climb-down", landing: [2363, 7368] },
    { id: CASTLE_DOOR_IDS.SPIRAL_UP, x: 2363, y: 7369, z: 0, from: CASTLE_ROOM.EAST_STAIR_GROUND, to: CASTLE_ROOM.EAST_STAIR_FIRST,
      fromFloor: 1, toFloor: 2, action: "Climb-up", landing: [2358, 7371] },
    { id: CASTLE_DOOR_IDS.DOOR_M, x: 2363, y: 7362, z: 0, from: CASTLE_ROOM.EAST_STAIR_GROUND, to: CASTLE_ROOM.THRONE_STORAGE,
      fromFloor: 1, toFloor: 1, landing: [2348, 7397] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2349, y: 7399, z: 0, from: CASTLE_ROOM.THRONE_STORAGE, to: CASTLE_ROOM.EAST_STAIR_GROUND,
      fromFloor: 1, toFloor: 1, landing: [2364, 7362] },
    { id: CASTLE_DOOR_IDS.DOOR_M, x: 2344, y: 7395, z: 0, from: CASTLE_ROOM.THRONE_STORAGE, to: CASTLE_ROOM.SOUTH_OF_THRONE,
      fromFloor: 1, toFloor: 1, landing: [2332, 7388] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2333, y: 7388, z: 0, from: CASTLE_ROOM.SOUTH_OF_THRONE, to: CASTLE_ROOM.THRONE_STORAGE,
      fromFloor: 1, toFloor: 1, landing: [2345, 7395] },
    { id: CASTLE_DOOR_IDS.CRESCENT_M, x: 2471, y: 7422, z: 0, from: CASTLE_ROOM.NORTH_LOBBY_HALL, to: CASTLE_ROOM.CRESCENT_ROOM,
      fromFloor: 2, toFloor: 2, landing: [2491, 7377] },
    { id: CASTLE_DOOR_IDS.CRESCENT, x: 2492, y: 7377, z: 0, from: CASTLE_ROOM.CRESCENT_ROOM, to: CASTLE_ROOM.NORTH_LOBBY_HALL,
      fromFloor: 2, toFloor: 2, landing: [2471, 7421] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT, x: 2507, y: 7409, z: 0, from: CASTLE_ROOM.SOLID_DOOR_HALL, to: CASTLE_ROOM.SOLID_DOOR_STORAGE,
      fromFloor: 2, toFloor: 2, landing: [2554, 7364] },
    { id: CASTLE_DOOR_IDS.DOOR_M, x: 2553, y: 7364, z: 0, from: CASTLE_ROOM.SOLID_DOOR_STORAGE, to: CASTLE_ROOM.SOLID_DOOR_HALL,
      fromFloor: 2, toFloor: 2, landing: [2506, 7409] },
    { id: CASTLE_DOOR_IDS.DOOR_M, x: 2585, y: 7370, z: 0, from: CASTLE_ROOM.BASEMENT_HALL, to: CASTLE_ROOM.BASEMENT_STORAGE,
      fromFloor: 1, toFloor: 1, landing: [2587, 7380] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2588, y: 7380, z: 0, from: CASTLE_ROOM.BASEMENT_STORAGE, to: CASTLE_ROOM.BASEMENT_HALL,
      fromFloor: 1, toFloor: 1, landing: [2583, 7370] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2442, y: 7361, z: 0, from: CASTLE_ROOM.UPPER_SOUTH_HALL, to: CASTLE_ROOM.ORNATE_KNIFE,
      fromFloor: 2, toFloor: 2, landing: [2451, 7371] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT_M, x: 2452, y: 7373, z: 0, from: CASTLE_ROOM.ORNATE_KNIFE, to: CASTLE_ROOM.UPPER_SOUTH_HALL,
      fromFloor: 2, toFloor: 2, landing: [2441, 7361] },
    { id: CASTLE_DOOR_IDS.GUEST_PORTAL_IN, x: 2450, y: 7372, z: 0, from: CASTLE_ROOM.ORNATE_KNIFE, to: CASTLE_ROOM.GUEST_STORAGE,
      fromFloor: 2, toFloor: 2, action: "Enter", landing: [2515, 7395] },
    { id: CASTLE_DOOR_IDS.GUEST_PORTAL_OUT, x: 2515, y: 7396, z: 0, from: CASTLE_ROOM.GUEST_STORAGE, to: CASTLE_ROOM.ORNATE_KNIFE,
      fromFloor: 2, toFloor: 2, action: "Enter", landing: [2450, 7371] },
    { id: CASTLE_DOOR_IDS.GIBBOUS_M, x: 2522, y: 7397, z: 0, from: CASTLE_ROOM.GUEST_STORAGE, to: CASTLE_ROOM.DISPLAY_ROOM,
      fromFloor: 2, toFloor: 2, landing: [2507, 7363] },
    { id: CASTLE_DOOR_IDS.GIBBOUS, x: 2506, y: 7363, z: 0, from: CASTLE_ROOM.DISPLAY_ROOM, to: CASTLE_ROOM.GUEST_STORAGE,
      fromFloor: 2, toFloor: 2, landing: [2520, 7396] },
    { id: CASTLE_DOOR_IDS.GIBBOUS, x: 2336, y: 7370, z: 1, from: CASTLE_ROOM.DINING, to: CASTLE_ROOM.EXPLOSIVE_HALL,
      fromFloor: 2, toFloor: 2, landing: [2482, 7395] },
    { id: CASTLE_DOOR_IDS.GIBBOUS_M, x: 2483, y: 7395, z: 0, from: CASTLE_ROOM.EXPLOSIVE_HALL, to: CASTLE_ROOM.DINING,
      fromFloor: 2, toFloor: 2, landing: [2337, 7370, 1] },
    { id: CASTLE_DOOR_IDS.GIBBOUS, x: 2510, y: 7370, z: 0, from: CASTLE_ROOM.DISPLAY_ROOM, to: CASTLE_ROOM.VENATOR_PUZZLE,
      fromFloor: 2, toFloor: 2, landing: [2516, 7367] },
    { id: CASTLE_DOOR_IDS.GIBBOUS_M, x: 2515, y: 7367, z: 0, from: CASTLE_ROOM.VENATOR_PUZZLE, to: CASTLE_ROOM.DISPLAY_ROOM,
      fromFloor: 2, toFloor: 2, landing: [2509, 7370] },
    { id: CASTLE_DOOR_IDS.PUZZLE_LIBRARY, x: 2519, y: 7363, z: 0, from: CASTLE_ROOM.VENATOR_PUZZLE, to: CASTLE_ROOM.VENATOR_LIBRARY,
      fromFloor: 2, toFloor: 2, action: "Enter", landing: [2551, 7386] },
    { id: CASTLE_DOOR_IDS.DOOR_ALT_M, x: 2551, y: 7387, z: 0, from: CASTLE_ROOM.VENATOR_LIBRARY, to: CASTLE_ROOM.VENATOR_PUZZLE,
      fromFloor: 2, toFloor: 2, landing: [2518, 7363] },
    { id: CASTLE_DOOR_IDS.DISPLAY_STAIRS_DOWN, x: 2503, y: 7369, z: 0, from: CASTLE_ROOM.DISPLAY_ROOM, to: CASTLE_ROOM.LOBBY,
      fromFloor: 2, toFloor: 2, action: "Climb-down", landing: [2307, 7365, 1] },
    { id: CASTLE_DOOR_IDS.STAIRS_UP, x: 2308, y: 7365, z: 1, from: CASTLE_ROOM.LOBBY, to: CASTLE_ROOM.DISPLAY_ROOM,
      fromFloor: 2, toFloor: 2, action: "Climb-up", landing: [2502, 7368] },
    { id: CASTLE_DOOR_IDS.GILDED_M, x: 2452, y: 7420, z: 0, from: CASTLE_ROOM.NORTH_LOBBY_HALL, to: CASTLE_ROOM.SMALL_HALL,
      fromFloor: 2, toFloor: 2, action: "Enter", key: ItemIdentifiers.GILDED_KEY, keyName: "gilded key", landing: [2444, 7418] },
    { id: CASTLE_DOOR_IDS.GILDED, x: 2445, y: 7418, z: 0, from: CASTLE_ROOM.SMALL_HALL, to: CASTLE_ROOM.NORTH_LOBBY_HALL,
      fromFloor: 2, toFloor: 2, action: "Enter", key: ItemIdentifiers.GILDED_KEY, keyName: "gilded key", landing: [2453, 7421] },
    { id: CASTLE_DOOR_IDS.DOOR_M, x: 2441, y: 7417, z: 0, from: CASTLE_ROOM.SMALL_HALL, to: CASTLE_ROOM.IVAN_ROOM,
      fromFloor: 2, toFloor: 2, landing: [2459, 7390] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2460, y: 7390, z: 0, from: CASTLE_ROOM.IVAN_ROOM, to: CASTLE_ROOM.SMALL_HALL,
      fromFloor: 2, toFloor: 2, landing: [2442, 7417] },
    { id: CASTLE_DOOR_IDS.IVAN_PASSAGE, x: 2455, y: 7386, z: 0, from: CASTLE_ROOM.IVAN_ROOM, to: CASTLE_ROOM.SECRET_ROOM,
      fromFloor: 2, toFloor: 2, action: "Enter", landing: [2437, 7419] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2438, y: 7419, z: 0, from: CASTLE_ROOM.SECRET_ROOM, to: CASTLE_ROOM.IVAN_ROOM,
      fromFloor: 2, toFloor: 2, landing: [2456, 7388] },
    { id: CASTLE_DOOR_IDS.FULL_M, x: 2373, y: 7392, z: 0, from: CASTLE_ROOM.WEST_CHAPEL, to: CASTLE_ROOM.BOTTLE_ROOM,
      fromFloor: 1, toFloor: 1, landing: [2380, 7392] },
    { id: CASTLE_DOOR_IDS.FULL_M, x: 2379, y: 7392, z: 0, from: CASTLE_ROOM.BOTTLE_ROOM, to: CASTLE_ROOM.WEST_CHAPEL,
      fromFloor: 1, toFloor: 1, landing: [2372, 7392] },
    { id: CASTLE_DOOR_IDS.FULL, x: 2388, y: 7383, z: 0, from: CASTLE_ROOM.BOTTLE_ROOM, to: CASTLE_ROOM.CHAPEL_LIBRARY,
      fromFloor: 1, toFloor: 1, landing: [2393, 7363] },
    { id: CASTLE_DOOR_IDS.FULL_M, x: 2392, y: 7363, z: 0, from: CASTLE_ROOM.CHAPEL_LIBRARY, to: CASTLE_ROOM.BOTTLE_ROOM,
      fromFloor: 1, toFloor: 1, landing: [2387, 7383] },
    { id: CASTLE_DOOR_IDS.CHAPEL_PORTAL_IN, x: 2393, y: 7370, z: 0, from: CASTLE_ROOM.CHAPEL_LIBRARY, to: CASTLE_ROOM.SERVANTS_QUARTERS,
      fromFloor: 1, toFloor: 1, action: "Enter", landing: [2441, 7400] },
    { id: CASTLE_DOOR_IDS.CHAPEL_PORTAL_OUT, x: 2440, y: 7400, z: 0, from: CASTLE_ROOM.SERVANTS_QUARTERS, to: CASTLE_ROOM.CHAPEL_LIBRARY,
      fromFloor: 1, toFloor: 1, action: "Enter", landing: [2394, 7370] },
    { id: CASTLE_DOOR_IDS.NEW_M, x: 2438, y: 7394, z: 0, from: CASTLE_ROOM.SERVANTS_QUARTERS, to: CASTLE_ROOM.EXPLOSIVE_ROOM,
      fromFloor: 1, toFloor: 1, landing: [2440, 7388] },
    { id: CASTLE_DOOR_IDS.NEW, x: 2441, y: 7389, z: 0, from: CASTLE_ROOM.EXPLOSIVE_ROOM, to: CASTLE_ROOM.SERVANTS_QUARTERS,
      fromFloor: 1, toFloor: 1, landing: [2439, 7394] },
    { id: CASTLE_DOOR_IDS.FULL, x: 2306, y: 7397, z: 1, from: CASTLE_ROOM.THRONE, to: CASTLE_ROOM.ABOVE_STUDY,
      fromFloor: 2, toFloor: 2, landing: [2435, 7372] },
    { id: CASTLE_DOOR_IDS.FULL_M, x: 2434, y: 7372, z: 0, from: CASTLE_ROOM.ABOVE_STUDY, to: CASTLE_ROOM.THRONE,
      fromFloor: 2, toFloor: 2, landing: [2306, 7396, 1] },
    { id: CASTLE_DOOR_IDS.FULL, x: 2525, y: 7363, z: 0, from: CASTLE_ROOM.VENATOR_PUZZLE, to: CASTLE_ROOM.SOLID_KEY_ROOM,
      fromFloor: 2, toFloor: 2, landing: [2540, 7373] },
    { id: CASTLE_DOOR_IDS.FULL, x: 2541, y: 7374, z: 0, from: CASTLE_ROOM.SOLID_KEY_ROOM, to: CASTLE_ROOM.VENATOR_PUZZLE,
      fromFloor: 2, toFloor: 2, landing: [2526, 7363] },
    { id: CASTLE_DOOR_IDS.FULL, x: 2510, y: 7379, z: 0, from: CASTLE_ROOM.DISPLAY_ROOM, to: CASTLE_ROOM.SOLID_DOOR_HALL,
      fromFloor: 2, toFloor: 2, landing: [2499, 7400] },
    { id: CASTLE_DOOR_IDS.FULL_M, x: 2499, y: 7400, z: 0, from: CASTLE_ROOM.SOLID_DOOR_HALL, to: CASTLE_ROOM.DISPLAY_ROOM,
      fromFloor: 2, toFloor: 2, landing: [2510, 7380] },
    { id: 61575, x: 2503, y: 7400, z: 0, from: CASTLE_ROOM.SOLID_DOOR_HALL, to: CASTLE_ROOM.LABORATORY,
      fromFloor: 2, toFloor: 2, action: "Enter", key: ItemIdentifiers.SOLID_KEY, keyName: "solid key", landing: [2510, 7382] },
    { id: 61574, x: 2512, y: 7382, z: 0, from: CASTLE_ROOM.LABORATORY, to: CASTLE_ROOM.SOLID_DOOR_HALL,
      fromFloor: 2, toFloor: 2, action: "Enter", key: ItemIdentifiers.SOLID_KEY, keyName: "solid key", landing: [2502, 7400] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2523, y: 7389, z: 0, from: CASTLE_ROOM.LABORATORY, to: CASTLE_ROOM.STOCKPILE_STORAGE,
      fromFloor: 2, toFloor: 2, landing: [2534, 7377] },
    { id: CASTLE_DOOR_IDS.DOOR, x: 2535, y: 7377, z: 0, from: CASTLE_ROOM.STOCKPILE_STORAGE, to: CASTLE_ROOM.LABORATORY,
      fromFloor: 2, toFloor: 2, landing: [2524, 7388] },
    { id: 61606, x: 2311, y: 7366, z: 0, from: CASTLE_ROOM.LOBBY, to: CASTLE_ROOM.BASEMENT_HALL,
      fromFloor: 1, toFloor: 1, action: "Climb-down", landing: [2563, 7369] },
    { id: 61600, x: 2564, y: 7369, z: 0, from: CASTLE_ROOM.BASEMENT_HALL, to: CASTLE_ROOM.LOBBY,
      fromFloor: 1, toFloor: 1, action: "Climb-up", landing: [2310, 7366] },
    { id: CASTLE_DOOR_IDS.CRESCENT_M, x: 2570, y: 7365, z: 0, from: CASTLE_ROOM.BASEMENT_HALL, to: CASTLE_ROOM.BASEMENT_VENATOR,
      fromFloor: 1, toFloor: 1, landing: [2566, 7386] },
    { id: CASTLE_DOOR_IDS.CRESCENT, x: 2566, y: 7387, z: 0, from: CASTLE_ROOM.BASEMENT_VENATOR, to: CASTLE_ROOM.BASEMENT_HALL,
      fromFloor: 1, toFloor: 1, landing: [2569, 7365] },
    { id: CASTLE_DOOR_IDS.NEW, x: 2570, y: 7369, z: 0, from: CASTLE_ROOM.BASEMENT_HALL, to: CASTLE_ROOM.BASEMENT_PRISON,
      fromFloor: 1, toFloor: 1, landing: [2565, 7394] },
    { id: CASTLE_DOOR_IDS.NEW_M, x: 2566, y: 7394, z: 0, from: CASTLE_ROOM.BASEMENT_PRISON, to: CASTLE_ROOM.BASEMENT_HALL,
      fromFloor: 1, toFloor: 1, landing: [2567, 7394] },
  ]);
  const CASTLE_DOOR_NAMES = Object.freeze(["Door", "Half moon door", "Crescent moon door",
    "New moon door", "Gibbous moon door", "Full moon door", "Stairs", "Spiral staircase",
    "Gilded door", "Solid door", "Teleporter"]);
  const CASTLE_MOON_DOOR_KEYS = new Map([
    [CASTLE_DOOR_IDS.NEW, [CASTLE_BOOK_ITEMS.newMoonKey, "new moon key"]],
    [CASTLE_DOOR_IDS.NEW_M, [CASTLE_BOOK_ITEMS.newMoonKey, "new moon key"]],
    [CASTLE_DOOR_IDS.HALF, [CASTLE_BOOK_ITEMS.halfMoonKey, "half moon key"]],
    [CASTLE_DOOR_IDS.HALF_M, [CASTLE_BOOK_ITEMS.halfMoonKey, "half moon key"]],
    [CASTLE_DOOR_IDS.GIBBOUS, [CASTLE_BOOK_ITEMS.gibbousMoonKey, "gibbous moon key"]],
    [CASTLE_DOOR_IDS.GIBBOUS_M, [CASTLE_BOOK_ITEMS.gibbousMoonKey, "gibbous moon key"]],
    [CASTLE_DOOR_IDS.FULL, [CASTLE_BOOK_ITEMS.fullMoonKey, "full moon key"]],
    [CASTLE_DOOR_IDS.FULL_M, [CASTLE_BOOK_ITEMS.fullMoonKey, "full moon key"]],
    [CASTLE_DOOR_IDS.CRESCENT, [CASTLE_BOOK_ITEMS.crescentMoonKey, "crescent moon key"]],
    [CASTLE_DOOR_IDS.CRESCENT_M, [CASTLE_BOOK_ITEMS.crescentMoonKey, "crescent moon key"]],
    [CASTLE_DOOR_IDS.GILDED, [ItemIdentifiers.GILDED_KEY, "gilded key"]],
    [CASTLE_DOOR_IDS.GILDED_M, [ItemIdentifiers.GILDED_KEY, "gilded key"]],
    [CASTLE_DOOR_IDS.SOLID, [ItemIdentifiers.SOLID_KEY, "solid key"]],
    [CASTLE_DOOR_IDS.SOLID_M, [ItemIdentifiers.SOLID_KEY, "solid key"]],
  ]);
  // Quest Helper locates the Castle Drakan shrine at (3168, 7707) and the
  // Vampyrium entry portal at (3161, 7710). The medallion lands beside the
  // clipped shrine object; the entry portal then moves the player beside the
  // return portal in the Vampyrium castle.
  // shortcut: the Wiki does not publish teleport landing tiles; both adjacent
  // tiles are cache-verified and connected to their respective portal.
  const CASTLE_TELEPORT_TILE = Object.freeze({ x: 3167, y: 7707, z: 0 });
  const CASTLE_VAMPYRIUM_ENTRY = Object.freeze({ id: 61216, x: 3161, y: 7710, z: 0 });
  const CASTLE_VAMPYRIUM_ARRIVAL = Object.freeze({ x: 2322, y: 7370, z: 0 });
  const CASTLE_VAMPYRIUM_RETURN = Object.freeze({ id: 61221, x: 2323, y: 7370, z: 0 });
  const CASTLE_LEGACY_BLOCKED_ARRIVAL = Object.freeze({ x: 2310, y: 7404, z: 0 });
  const REFINERY_COMPLETED_EVENT = "bmr:refinery-completed";
  const SLEPE_PLINTH_VARBITS = [15496, 15492, 15491, 15493, 15495, 15494];
  const SLEPE_BOOKS = [
    { id: ItemIdentifiers.ESSIANDARS_NOTES, name: "Essiandar's notes", varbitValue: 6, shelf: [3409, 3488] },
    { id: ItemIdentifiers.SARLS_JOURNAL, name: "Sarl's journal", varbitValue: 2, shelf: [3414, 3491] },
    { id: ItemIdentifiers.FROM_MISTHALIN_TO_MORYTANIA, name: "From Misthalin to Morytania", varbitValue: 1, shelf: [3411, 3492] },
    { id: ItemIdentifiers.SCRUFFY_NOTEBOOK, name: "Scruffy notebook", varbitValue: 3, shelf: [3409, 3488] },
    { id: ItemIdentifiers.THE_LIFE_OF_FRIAR, name: "The Life of Friar", varbitValue: 5, shelf: [3414, 3491] },
    { id: ItemIdentifiers.PIOUS_PROCEEDINGS, name: "Pious proceedings", varbitValue: 4, shelf: [3411, 3491] },
  ];
  const SLEPE_PLINTHS = [
    { x: 3409, y: 3483, window: "Essiandar", itemId: ItemIdentifiers.ESSIANDARS_NOTES },
    { x: 3408, y: 3485, window: "Sarl", itemId: ItemIdentifiers.SARLS_JOURNAL },
    { x: 3409, y: 3487, window: "Iriandul", itemId: ItemIdentifiers.FROM_MISTHALIN_TO_MORYTANIA },
    { x: 3409, y: 3490, window: "Derygull", itemId: ItemIdentifiers.SCRUFFY_NOTEBOOK },
    { x: 3408, y: 3492, window: "Friar", itemId: ItemIdentifiers.THE_LIFE_OF_FRIAR },
    { x: 3409, y: 3494, window: "Erysail", itemId: ItemIdentifiers.PIOUS_PROCEEDINGS },
  ];
  const SLEPE_MONK_TILES = [
    [3410, 3484], [3410, 3493], [3411, 3489], [3415, 3485], [3415, 3489],
  ];
  const SLEPE_MONK_IDS = new Set([
    NpcIdentifiers.MONK_OF_ZAMORAK_4, NpcIdentifiers.MONK_OF_ZAMORAK_5, NpcIdentifiers.MONK_OF_ZAMORAK_6,
    16154, 16155, 16156, 16271, 16272, 16273,
  ]);
  const HIDEOUT_SHRINE_IDS = new Set([61174, ObjectIdentifiers.MAKESHIFT_SHRINE, ObjectIdentifiers.MAKESHIFT_SHRINE_2]);
  const HIDEOUT_SHRINE_TILE = { x: 3601, y: 9614, z: 0 };
  const HIDEOUT_CHEST_ID = ObjectIdentifiers.CLOSED_CHEST_37;
  const HIDEOUT_CHEST_TILE = { x: 3600, y: 9617, z: 0 };
  const VYRE_NOBLE_OUTFIT = [ItemIdentifiers.VYRE_NOBLE_TOP, ItemIdentifiers.VYRE_NOBLE_LEGS, ItemIdentifiers.VYRE_NOBLE_SHOES];
  const HUNT_ITEMS = {
    crank: ItemIdentifiers.CRANK_WHEEL, dustyBook: ItemIdentifiers.DUSTY_BOOK, viturKey: ItemIdentifiers.VITUR_KEY,
    boltCutters: ItemIdentifiers.BOLT_CUTTERS, toothHalf: ItemIdentifiers.TOOTH_HALF_OF_KEY_6,
    loopHalf: ItemIdentifiers.LOOP_HALF_OF_KEY_6, myrmelKey: ItemIdentifiers.MYRMEL_KEY,
    bucket: ItemIdentifiers.BUCKET, bucketWater: ItemIdentifiers.BUCKET_OF_WATER,
    shadumKey: ItemIdentifiers.SHADUM_KEY, trapdoorKey: ItemIdentifiers.TRAPDOOR_KEY,
    jovkaiKey: ItemIdentifiers.JOVKAI_KEY, oldCog: ItemIdentifiers.OLD_COG,
  };
  const PREP = {
    leaves: ItemIdentifiers.AMITIRE_LEAVES,
    stew: ItemIdentifiers.AMITIRE_STEW,
    bowl: ItemIdentifiers.BOWL,
    bowlWater: ItemIdentifiers.BOWL_OF_WATER,
    potato: ItemIdentifiers.POTATO,
    incompleteStew: ItemIdentifiers.INCOMPLETE_STEW,
    rawMeat: ItemIdentifiers.RAW_IMPALER_MEAT,
    cookedMeat: ItemIdentifiers.COOKED_MEAT,
    uncookedStew: ItemIdentifiers.UNCOOKED_STEW,
    cookedStew: ItemIdentifiers.STEW,
    hammer: ItemIdentifiers.HAMMER,
    chisel: ItemIdentifiers.CHISEL,
    knife: ItemIdentifiers.KNIFE,
    logs: ItemIdentifiers.BLISTERWOOD_LOGS,
    blessedSickle: ItemIdentifiers.SILVER_SICKLE_B_,
    diamond: ItemIdentifiers.DIAMOND,
    diamondTablet: ItemIdentifiers.ENCHANT_DIAMOND,
    diamondSickle: ItemIdentifiers.DIAMOND_SICKLE_B_,
    enchantedSickle: ItemIdentifiers.ENCHANTED_DIAMOND_SICKLE_B_,
    enhancedSickle: ItemIdentifiers.BLISTERWOOD_SICKLE_E_,
    marks: ItemIdentifiers.HALLOWED_MARKS,
    blisterwoodFlail: ItemIdentifiers.BLISTERWOOD_FLAIL,
    flail: ItemIdentifiers.HALLOWED_FLAIL,
    stakes: ItemIdentifiers.BLISTERWOOD_STAKE,
  };
  const ATTRIBUTE = "quest.the_blood_moon_rises.tome-uses";
  const STAGE = {
    NOT_STARTED: 0,
    STARTED: 10,
    HIDEOUT: 20,
    SLEPE: 30,
    CASTLE: 40,
    ESCAPE: 45,
    BLOOD_HUNT: 50,
    PREPARATIONS: 60,
    SIEGE: 70,
    THEATRE: 80,
    WYRDS: 90,
    WYRD_DEFEATED: 95,
    FENCE_FOUND: 96,
    FINAL: 100,
    COMPLETE: 110,
  };
  const WYRD_AREA_ATTRIBUTE = "quest.the_blood_moon_rises.wyrd-area";
  const WYRD_DEFEATED_ATTRIBUTE = "quest.the_blood_moon_rises.wyrd-defeated";
  const DRAKAN_AREA_ATTRIBUTE = "quest.the_blood_moon_rises.drakan-area";
  const DRAKAN_ENCOUNTER_COMPLETE = "quest.the_blood_moon_rises.drakan-defeated";
  const SIEGE_DRAKAN_AREA_ATTRIBUTE = "quest.the_blood_moon_rises.siege-drakan-area";
  const SIEGE_DRAKAN_COMPLETE = "quest.the_blood_moon_rises.siege-drakan-defeated";
  const SIEGE_DEFENCE_ATTRIBUTE = "quest.the_blood_moon_rises.siege-defence";
  const TOB_CHALLENGE_ATTRIBUTE = "quest.the_blood_moon_rises.tob-challenge";
  const PREP_COMPLETE = "quest.the_blood_moon_rises.preparations-complete";
  const wyrdEncounters = new Map();
  const slepeIvans = new Map();
  const slepeRoys = new Map();
  const paterdomusIvans = new Map();
  const slepeManors = new Map();
  const drakanEncounters = new Map();
  const siegeDrakanEncounters = new Map();
  const siegeHallInjured = new Map();
  const hideoutDefense = require("../bmr/HideoutDefense.TheBloodMoonRises")({ api, stage: player => stage(player),
    hideoutStage: STAGE.HIDEOUT,
    complete: (player, npcId) => startTranscript(api, player, npcId, PAGE, "starting-out-escaping-the-vampyres") });
  const CHAPTERS = [
    [STAGE.STARTED, "starting-out"],
    [STAGE.HIDEOUT, "starting-out-in-the-myreque-hideout"],
    [STAGE.SLEPE, "the-truth-hurtz"],
    [STAGE.CASTLE, "escape-from-castle-drakan"],
    [STAGE.ESCAPE, "blood-hunt"],
    [STAGE.BLOOD_HUNT, "blood-hunt"],
    [STAGE.PREPARATIONS, "hallowed-preparations"],
    [STAGE.SIEGE, "drakan-s-siege"],
    [STAGE.THEATRE, "another-night-at-the-theatre"],
    [STAGE.WYRDS, "fighting-wyrds"],
    [STAGE.FINAL, "night-of-the-blood-moon"],
  ];
  const REQUIRED_QUESTS = [
    ["sins_of_the_father", "Sins of the Father"],
    ["a_night_at_the_theatre", "A Night at the Theatre"],
  ];
  const REQUIRED_SKILLS = [
    [Skill.SLAYER, 74, "Slayer"], [Skill.WOODCUTTING, 74, "Woodcutting"],
    [Skill.SMITHING, 72, "Smithing"], [Skill.COOKING, 72, "Cooking"],
    [Skill.FLETCHING, 70, "Fletching"], [Skill.MINING, 66, "Mining"],
    [Skill.HUNTER, 65, "Hunter"], [Skill.CRAFTING, 64, "Crafting"],
    [Skill.HERBLORE, 64, "Herblore"], [Skill.MAGIC, 57, "Magic"],
  ];
  let quest;

  class WyrdEncounterArea extends PrivateArea {
    constructor(owner) {
      super([new Boundary(2944, 3007, 7424, 7487, 0)]);
      this.owner = owner;
    }

    isMulti() { return true; }

    canAttack(attacker, target) {
      const attackerHere = attacker?.getArea?.() === this;
      const targetHere = target?.getArea?.() === this;
      if (attackerHere || targetHere) return attackerHere && targetHere;
      return null;
    }

    postLeave(mobile, logout) {
      super.postLeave(mobile, logout);
      if (this.isDestroyed()) wyrdEncounters.delete(this);
    }

    process(mobile) {
      if (!mobile?.isNpc?.()) return;
      const encounter = wyrdEncounters.get(this);
      if (!encounter || mobile !== encounter.boss || encounter.finished || mobile.getHitpoints() <= 0) return;
      const now = World.getProcessCycle();
      if (encounter.lastCycle === now) return;
      encounter.lastCycle = now;
      mobile.setScriptedMovement(true);
      mobile.getCombat().getLastAttack().reset();
      const player = encounter.player;
      if (player.getArea?.() !== this || player.getHitpoints() <= 0) return;

      const hpPercent = mobile.getHitpoints() / mobile.getMaxHitpoints();
      const threshold = hpPercent <= 0.1 ? 10 : hpPercent <= 0.5 ? 50 : hpPercent <= 0.8 ? 80 : 0;
      if (threshold && !encounter.thresholdsSeen.has(threshold)) {
        encounter.thresholdsSeen.add(threshold);
        if (threshold === 10) encounter.ending = true;
        startTranscript(api, player, mobile.getId(), PAGE, `fighting-wyrds-upon-reaching-${threshold}-hp`);
        return;
      }
      if (encounter.ending) return;

      const phase = hpPercent <= 0.5 ? 2 : 1;
      if (phase === 2 && encounter.phase !== 2) {
        encounter.phase = 2;
        player.sendMessage("The Wyrd's body crackles with lightning. Leave its blood pools when it calls the storm, and lower every protection prayer during the screech.");
      }
      if (encounter.impactAt && now >= encounter.impactAt) {
        const warning = encounter.warning;
        encounter.impactAt = 0;
        encounter.warning = null;
        if (warning === "screech") {
          const prayers = player.getPrayerActive?.() ?? [];
          const overheadActive = [PrayerHandler.PROTECT_FROM_MAGIC, PrayerHandler.PROTECT_FROM_MISSILES,
            PrayerHandler.PROTECT_FROM_MELEE].some((id) => prayers[id] === true);
          const damage = overheadActive ? 30 : 0;
          if (damage) player.sendMessage("Your protection prayer amplifies the Wyrd's screech.");
          else player.sendMessage("The screech passes over you as you lower your prayers.");
          if (damage) player.getCombat().getHitQueue().addPendingDamage([
            new HitDamage(damage, HitMask.RED).setSource(mobile),
          ]);
          encounter.screeches++;
          return;
        }
        if (warning === "storm") {
          const distance = Math.max(Math.abs(player.getLocation().getX() - encounter.markedX),
            Math.abs(player.getLocation().getY() - encounter.markedY));
          const prayers = player.getPrayerActive?.() ?? [];
          const overheadActive = [PrayerHandler.PROTECT_FROM_MAGIC, PrayerHandler.PROTECT_FROM_MISSILES,
            PrayerHandler.PROTECT_FROM_MELEE].some((id) => prayers[id] === true);
          if (distance <= 2) {
            player.sendMessage("The lightning strikes around you. Move clear of the blood pools and turn off your protection prayers.");
            player.getCombat().getHitQueue().addPendingDamage([
              new HitDamage(overheadActive ? 24 : 16, HitMask.RED).setSource(mobile),
            ]);
          } else {
            player.sendMessage("You escape the lightning strike and its blood pools.");
          }
          return;
        }
        if (warning === "slam") {
          const distance = Math.max(Math.abs(player.getLocation().getX() - encounter.markedX),
            Math.abs(player.getLocation().getY() - encounter.markedY));
          if (distance <= 1) player.getCombat().getHitQueue().addPendingDamage([
            new HitDamage(35, HitMask.RED).setSource(mobile),
          ]);
          else player.sendMessage("The Wyrd's ground slam crashes where you stood.");
          return;
        }
      }
      if (encounter.impactAt) return;
      if (now < encounter.nextAttackAt) return;
      encounter.nextAttackAt = now + 4;
      if (phase === 1 && encounter.punches < 2) {
        encounter.punches++;
        const protectedFromMelee = (player.getPrayerActive?.() ?? [])[PrayerHandler.PROTECT_FROM_MELEE] === true;
        if (!protectedFromMelee) player.getCombat().getHitQueue().addPendingDamage([
          new HitDamage(5 + Math.floor(Math.random() * 7), HitMask.RED).setSource(mobile),
        ]);
        player.sendMessage("The Wyrd swings a heavy fist at you.");
        return;
      }
      if (phase === 1 && encounter.screeches < 2) {
        encounter.punches = 0;
        encounter.warning = "screech";
        encounter.impactAt = now + 2;
        player.sendMessage("The Wyrd draws breath for a screech. Turn off all protection prayers before it lands.");
        return;
      }
      encounter.screeches = 0;
      encounter.punches = 0;
      const loc = player.getLocation();
      encounter.markedX = loc.getX();
      encounter.markedY = loc.getY();
      encounter.warning = phase === 2 ? "storm" : "slam";
      encounter.impactAt = now + 2;
      player.sendMessage(phase === 2
        ? "The Wyrd calls down lightning around you. Move away from the marked ground and turn off your protection prayers."
        : "The Wyrd winds back for a ground slam. Move away from your current tile.");
    }
  }

  class SlepeManorArea extends PrivateArea {
    constructor(player) {
      // The map's Crombwick Manor floor is at z=1, with its cache staircase at
      // (3725,3353,0). Each quest player gets their own Vyrewatch and kill state.
      super([new Boundary(3713, 3735, 3352, 3372, 1)]);
      this.player = player;
      this.enemies = [];
      this.storyActors = [];
      this.finished = false;
    }

    isMulti() { return true; }

    canAttack(attacker, target) {
      const attackerHere = attacker?.getArea?.() === this;
      const targetHere = target?.getArea?.() === this;
      if (attackerHere || targetHere) return attackerHere && targetHere;
      return null;
    }

    postLeave(mobile, logout) {
      super.postLeave(mobile, logout);
      if (mobile !== this.player) return;
      for (const npc of [...this.enemies, ...this.storyActors]) if (npc) api.removeNpc(npc);
      if (slepeManors.get(mobile) === this) slepeManors.delete(mobile);
    }
  }

  class DrakanEncounterArea extends PrivateArea {
    constructor(owner) {
      super([new Boundary(2495, 2514, 7823, 7853, 3)]);
      this.owner = owner;
    }
    isMulti() { return true; }
    canAttack(attacker, target) {
      const attackerHere = attacker?.getArea?.() === this;
      const targetHere = target?.getArea?.() === this;
      if (attackerHere || targetHere) return attackerHere && targetHere;
      return null;
    }
    postLeave(mobile, logout) {
      super.postLeave(mobile, logout);
      if (this.isDestroyed()) drakanEncounters.delete(this);
    }
    process(mobile) {
      if (!mobile?.isNpc?.()) return;
      const fight = drakanEncounters.get(this);
      if (!fight || mobile !== fight.boss || fight.finished || mobile.getHitpoints() <= 0) return;
      const now = World.getProcessCycle();
      if (fight.lastCycle === now) return;
      fight.lastCycle = now;
      mobile.setScriptedMovement(true);
      mobile.getCombat().getLastAttack().reset();
      const player = fight.player;
      if (player.getArea?.() !== this || player.getHitpoints() <= 0 || fight.ending) return;
      const hpPercent = mobile.getHitpoints() / mobile.getMaxHitpoints();
      if (hpPercent <= 0.3 && !fight.thresholdSeen) {
        fight.thresholdSeen = true;
        fight.ending = true;
        startTranscript(api, player, mobile.getId(), PAGE, "night-of-the-blood-moon-upon-lowerniel-reaching-30-hp");
        return;
      }
      if (fight.impactAt && now >= fight.impactAt) {
        const warning = fight.warning;
        fight.impactAt = 0;
        fight.warning = null;
        const location = player.getLocation();
        const x = location.getX();
        const y = location.getY();
        const prayers = player.getPrayerActive?.() ?? [];
        const melee = prayers[PrayerHandler.PROTECT_FROM_MELEE] === true;
        const magic = prayers[PrayerHandler.PROTECT_FROM_MAGIC] === true;
        if (warning === "thrust") {
          const distance = Math.max(Math.abs(x - fight.markedX), Math.abs(y - fight.markedY));
          if (distance === 0) this.hit(player, mobile, 30, "The spear thrust catches you. Step away when Lowerniel draws the spear back.");
          else player.sendMessage("You sidestep Lowerniel's spear thrust.");
          return;
        }
        if (warning === "blood-spear") {
          if (!magic) this.hit(player, mobile, 32, "The blood spear strikes you. Protect from Magic when he fires it.");
          else player.sendMessage("Your Protect from Magic prayer turns aside the blood spear.");
          return;
        }
        if (warning === "wave") {
          if (y === fight.markedY) this.hit(player, mobile, 36, "The blood wave crashes through your lane. Move to another row when it gathers.");
          else player.sendMessage("You dodge sideways out of the blood wave's path.");
          return;
        }
        if (warning === "shadow") {
          const distance = Math.max(Math.abs(x - fight.markedX), Math.abs(y - fight.markedY));
          if (distance <= 1) this.hit(player, mobile, 28, "The shadow pool erupts beneath you. Move clear of the marked ground.");
          else player.sendMessage("You move clear before the shadow pool erupts.");
          return;
        }
        if (warning === "melee") {
          if (!melee) this.hit(player, mobile, 7 + Math.floor(Math.random() * 10), "Lowerniel's melee strike lands.");
          return;
        }
      }
      if (fight.impactAt || now < fight.nextAttackAt) return;
      fight.nextAttackAt = now + 4;
      fight.attackIndex++;
      const loc = player.getLocation();
      if (fight.attackIndex % 5 === 1) {
        fight.warning = "thrust"; fight.markedX = loc.getX(); fight.markedY = loc.getY(); fight.impactAt = now + 2;
        player.sendMessage("Lowerniel draws his spear back and lines up a thrust. Step at least one tile aside.");
      } else if (fight.attackIndex % 5 === 2) {
        fight.warning = "blood-spear"; fight.impactAt = now + 2;
        player.sendMessage("Lowerniel fires a blood spear. Protect from Magic before it lands.");
      } else if (fight.attackIndex % 5 === 3) {
        fight.warning = "wave"; fight.markedY = loc.getY(); fight.impactAt = now + 2;
        player.sendMessage("A blood wave gathers across your row. Move to another row before it sweeps through.");
      } else if (fight.attackIndex % 5 === 4) {
        fight.warning = "shadow"; fight.markedX = loc.getX(); fight.markedY = loc.getY(); fight.impactAt = now + 2;
        player.sendMessage("A shadow pool forms beneath you. Move more than one tile away.");
      } else {
        fight.warning = "melee"; fight.impactAt = now + 1;
        player.sendMessage("Lowerniel closes in with a melee strike. Protect from Melee.");
      }
    }
    hit(player, source, damage, message) {
      player.sendMessage(message);
      player.getCombat().getHitQueue().addPendingDamage([
        new HitDamage(damage, HitMask.RED).setSource(source),
      ]);
    }
  }

  class SiegeDrakanArea extends PrivateArea {
    constructor(owner) {
      super([new Boundary(3155, 3181, 7823, 7863, 1)]);
      this.owner = owner;
    }
    isMulti() { return true; }
    canAttack(attacker, target) {
      const attackerHere = attacker?.getArea?.() === this;
      const targetHere = target?.getArea?.() === this;
      if (attackerHere || targetHere) return attackerHere && targetHere;
      return null;
    }
    postLeave(mobile, logout) {
      super.postLeave(mobile, logout);
      if (this.isDestroyed()) siegeDrakanEncounters.delete(this);
    }
    process(mobile) {
      if (!mobile?.isNpc?.()) return;
      const fight = siegeDrakanEncounters.get(this);
      if (!fight || mobile !== fight.boss || fight.finished || mobile.getHitpoints() <= 0) return;
      const now = World.getProcessCycle();
      if (fight.lastCycle === now) return;
      fight.lastCycle = now;
      mobile.setScriptedMovement(true);
      mobile.getCombat().getLastAttack().reset();
      const player = fight.player;
      if (player.getArea?.() !== this || player.getHitpoints() <= 0 || fight.ending) return;
      if (mobile.getHitpoints() <= fight.thresholdHp) {
        fight.ending = true;
        startTranscript(api, player, mobile.getId(), PAGE,
          "drakan-s-siege-fighting-lowerniel-upon-lowerniel-reaching-58-hp");
        return;
      }
      if (fight.impactAt && now >= fight.impactAt) {
        const warning = fight.warning;
        fight.impactAt = 0;
        fight.warning = null;
        const location = player.getLocation();
        const x = location.getX();
        const y = location.getY();
        const prayers = player.getPrayerActive?.() ?? [];
        const melee = prayers[PrayerHandler.PROTECT_FROM_MELEE] === true;
        const magic = prayers[PrayerHandler.PROTECT_FROM_MAGIC] === true;
        if (warning === "thrust") {
          const distance = Math.max(Math.abs(x - fight.markedX), Math.abs(y - fight.markedY));
          if (distance === 0) this.hit(player, mobile, 30, "The spear thrust catches you. Step aside when Lowerniel draws the spear back.");
          else player.sendMessage("You sidestep Lowerniel's spear thrust.");
          return;
        }
        if (warning === "blood-spear") {
          if (!magic) this.hit(player, mobile, 32, "The blood spear strikes you. Protect from Magic before it lands.");
          else player.sendMessage("Your Protect from Magic prayer turns aside the blood spear.");
          return;
        }
        if (warning === "front-back") {
          const distance = Math.max(Math.abs(x - fight.markedX), Math.abs(y - fight.markedY));
          if (distance <= 2 && x === fight.markedX) {
            this.hit(player, mobile, 25, "Drakan's blood burst catches you in front of him. Move to either side.");
          } else player.sendMessage("You move to the side and avoid Drakan's blood burst.");
          return;
        }
        if (warning === "melee") {
          if (!melee) this.hit(player, mobile, 7 + Math.floor(Math.random() * 10), "Lowerniel's melee strike lands.");
          return;
        }
      }
      if (fight.impactAt || now < fight.nextAttackAt) return;
      fight.nextAttackAt = now + 4;
      fight.attackIndex++;
      const loc = player.getLocation();
      if (fight.attackIndex % 4 === 1) {
        fight.warning = "thrust";
        fight.markedX = loc.getX();
        fight.markedY = loc.getY();
        fight.impactAt = now + 2;
        player.sendMessage("Lowerniel draws his spear back and lines up a thrust. Step to either side.");
      } else if (fight.attackIndex % 4 === 2) {
        fight.warning = "front-back";
        fight.markedX = loc.getX();
        fight.markedY = loc.getY();
        fight.impactAt = now + 2;
        player.sendMessage("Lowerniel gathers blood in front of and behind him. Move to one of his sides.");
      } else if (fight.attackIndex % 4 === 3) {
        fight.warning = "blood-spear";
        fight.impactAt = now + 2;
        player.sendMessage("Lowerniel fires a blood spear. Protect from Magic before it lands.");
      } else {
        fight.warning = "melee";
        fight.impactAt = now + 1;
        player.sendMessage("Lowerniel closes in with a melee strike. Protect from Melee.");
      }
    }
    hit(player, source, damage, message) {
      player.sendMessage(message);
      player.getCombat().getHitQueue().addPendingDamage([
        new HitDamage(damage, HitMask.RED).setSource(source),
      ]);
    }
  }

  function startDrakanBattle(player) {
    if (stage(player) !== STAGE.FINAL) return false;
    const existing = player.getAttribute(DRAKAN_AREA_ATTRIBUTE);
    if (existing && existing.isDestroyed?.() !== true) return true;
    const area = new DrakanEncounterArea(player.getUsername?.());
    const boss = api.spawnNpc({ id: NpcIdentifiers.LOWERNIEL_DRAKAN_17, x: 2505, y: 7838, z: 3,
      wanderRadius: 0, owner: player, ownerOnly: true });
    if (!boss) { player.sendMessage("Lowerniel could not be reached. Return to the northern chamber door."); return false; }
    boss.setMultiCombat?.(true);
    boss.setMaxHitpoints(1600);
    boss.setHitpoints(1600);
    area.enter(player);
    area.enter(boss);
    player.setAttribute(DRAKAN_AREA_ATTRIBUTE, area);
    player.moveTo(new Location(2502, 7838, 3));
    drakanEncounters.set(area, { area, boss, player, lastCycle: -1,
      nextAttackAt: World.getProcessCycle() + 4, attackIndex: 0, impactAt: 0, warning: null,
      markedX: 2502, markedY: 7838, thresholdSeen: false, ending: false, finished: false });
    player.sendMessage("Lowerniel attacks. Dodge his spear thrust and blood wave, protect from Magic against blood spears, and leave the shadow pools.");
    return true;
  }

  function finishDrakanEncounter(player) {
    const area = player.getAttribute(DRAKAN_AREA_ATTRIBUTE);
    const fight = area && drakanEncounters.get(area);
    if (!fight || !fight.ending) return false;
    fight.finished = true;
    api.removeNpc(fight.boss);
    area.leave(player, false);
    player.setAttribute(DRAKAN_AREA_ATTRIBUTE, null);
    player.setAttribute(DRAKAN_ENCOUNTER_COMPLETE, true);
    drakanEncounters.delete(area);
    return true;
  }

  function handleDrakanDeath(event) {
    const npc = event?.npc;
    const area = npc?.getArea?.();
    const fight = area && drakanEncounters.get(area);
    if (!fight || npc !== fight.boss || fight.finished) return false;
    fight.ending = true;
    fight.thresholdSeen = true;
    startTranscript(api, fight.player, npc.getId(), PAGE, "night-of-the-blood-moon-upon-killing-lowerniel-drakan");
    return true;
  }

  function startSiegeDrakanBattle(player) {
    const existing = player.getAttribute(SIEGE_DRAKAN_AREA_ATTRIBUTE);
    if (existing && existing.isDestroyed?.() !== true) return true;
    if (stage(player) !== STAGE.SIEGE || hallDefenceState(player).phase !== "breach") return false;
    const area = new SiegeDrakanArea(player.getUsername?.());
    const boss = api.spawnNpc({ id: NpcIdentifiers.LOWERNIEL_DRAKAN_19, x: 3168, y: 7853, z: 1,
      wanderRadius: 0, owner: player, ownerOnly: true });
    if (!boss) {
      player.sendMessage("Lowerniel could not be reached. Pass through the barricade into the palace hall and try again.");
      return false;
    }
    boss.setMultiCombat?.(true);
    boss.setMaxHitpoints(3000);
    boss.setHitpoints(2550);
    area.enter(player);
    area.enter(boss);
    player.setAttribute(SIEGE_DRAKAN_AREA_ATTRIBUTE, area);
    player.setAttribute(SIEGE_DRAKAN_COMPLETE, false);
    siegeDrakanEncounters.set(area, { area, boss, player, thresholdHp: 1740, lastCycle: -1,
      nextAttackAt: World.getProcessCycle() + 4, attackIndex: 0, impactAt: 0, warning: null,
      markedX: 3168, markedY: 7853, ending: false, finished: false });
    player.sendMessage("Lowerniel has breached the entrance hall. Dodge his spear thrusts and front-and-back blood bursts, and protect from Magic against his blood spears.");
    return true;
  }

  function finishSiegeDrakanBattle(player) {
    const area = player.getAttribute(SIEGE_DRAKAN_AREA_ATTRIBUTE);
    const fight = area && siegeDrakanEncounters.get(area);
    if (!fight || fight.player !== player) return false;
    fight.finished = true;
    api.removeNpc(fight.boss);
    area.leave(player, false);
    player.setAttribute(SIEGE_DRAKAN_AREA_ATTRIBUTE, null);
    player.setAttribute(SIEGE_DRAKAN_COMPLETE, true);
    siegeDrakanEncounters.delete(area);
    advance(player, STAGE.THEATRE);
    // The cutscene sends the party to the Haunted Woods; this is its canonical
    // post-scene checkpoint from the Quest Helper route.
    api.spawnNpc({ id: NpcIdentifiers.IVAN_STROM_13, x: 3606, y: 3416, z: 0,
      wanderRadius: 0, owner: player, ownerOnly: true });
    player.moveTo(new Location(3605, 3416, 0));
    return true;
  }

  const SIEGE_HALL = {
    hammerCrate: ObjectIdentifiers.CRATE_OF_HAMMERS_2,
    potionCrate: ObjectIdentifiers.CRATE_OF_POTIONS,
    damagedPillar: ObjectIdentifiers.DAMAGED_PILLAR_2,
    pillar: ObjectIdentifiers.PILLAR_150,
    damagedWindow: ObjectIdentifiers.DAMAGED_WINDOW,
    window: ObjectIdentifiers.WINDOW_20,
    barricade: ObjectIdentifiers.BARRICADE_60,
    hammer: ItemIdentifiers.HAMMER,
    healingPotion: ItemIdentifiers.HEALING_POTION,
    injuredAranei: [NpcIdentifiers.ARANEI_108, NpcIdentifiers.ARANEI_109, NpcIdentifiers.ARANEI_110,
      NpcIdentifiers.ARANEI_111, NpcIdentifiers.ARANEI_112, NpcIdentifiers.ARANEI_113],
    repairLocations: new Map([
      ["3174,7855", [ObjectIdentifiers.DAMAGED_PILLAR_2, ObjectIdentifiers.PILLAR_150]],
      ["3162,7855", [ObjectIdentifiers.DAMAGED_PILLAR_2, ObjectIdentifiers.PILLAR_150]],
      ["3176,7858", [ObjectIdentifiers.DAMAGED_WINDOW, ObjectIdentifiers.WINDOW_20]],
      ["3174,7858", [ObjectIdentifiers.DAMAGED_WINDOW, ObjectIdentifiers.WINDOW_20]],
      ["3162,7858", [ObjectIdentifiers.DAMAGED_WINDOW, ObjectIdentifiers.WINDOW_20]],
      ["3164,7858", [ObjectIdentifiers.DAMAGED_WINDOW, ObjectIdentifiers.WINDOW_20]],
    ]),
  };

  function hallDefenceState(player) {
    return player.getAttribute(SIEGE_DEFENCE_ATTRIBUTE) ?? { phase: "bridge", integrity: 100, healed: [], repaired: [] };
  }

  // The live defense uses a continuously falling integrity meter. Cache data
  // and the transcript expose the 50% story threshold, but not its server tick
  // cadence or exact repair gains. These two timing/gain values are shortcuts
  // pending live calibration; integrity, rather than a repair-count gate, is
  // the actual win condition.
  const HALL_INTEGRITY_INTERVAL = 20;
  const HALL_INTEGRITY_LOSS = 1;
  const HALL_INTEGRITY_THRESHOLD = 50;
  // shortcut: the Wiki says a player must participate but does not publish a
  // count; require three distinct repair/heal actions before the breach scene.
  const HALL_PARTICIPATION_REQUIRED = 3;

  function applyHallIntegrity(player, delta, participated = false) {
    const state = hallDefenceState(player);
    if (state.phase !== "hall") return;
    const integrity = Math.max(0, Math.min(100, (state.integrity ?? 100) + delta));
    const updated = { ...state, integrity,
      participation: (state.participation ?? 0) + (participated ? 1 : 0) };
    player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE, updated);
    if (integrity <= HALL_INTEGRITY_THRESHOLD && !updated.qualified) {
      if (updated.participation < HALL_PARTICIPATION_REQUIRED) {
        updated.integrity = HALL_INTEGRITY_THRESHOLD + 1;
        player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE, updated);
        player.sendMessage("The Aranei need more help before the doors give way. Repair another damaged window or pillar, or heal a fallen Aranei.");
        return;
      }
      updated.qualified = true;
      player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE, updated);
    }
    if (integrity === 0 && updated.qualified) {
      updated.phase = "breach";
      player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE, updated);
      quest.setStage(player, STAGE.SIEGE);
      startTranscript(api, player, NpcIdentifiers.LOWERNIEL_DRAKAN_19, PAGE,
        "drakan-s-siege-upon-reaching-0-hideout-integrity");
    }
  }

  function processSiegeDefence({ player }) {
    if (!player || stage(player) !== STAGE.SIEGE) return;
    const state = hallDefenceState(player);
    if (state.phase !== "hall") return;
    const cycle = World.getProcessCycle();
    if (cycle < (state.nextIntegrityLossCycle ?? cycle + HALL_INTEGRITY_INTERVAL)) {
      if (state.nextIntegrityLossCycle === undefined) player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE,
        { ...state, nextIntegrityLossCycle: cycle + HALL_INTEGRITY_INTERVAL });
      return;
    }
    applyHallIntegrity(player, -HALL_INTEGRITY_LOSS);
    const updated = hallDefenceState(player);
    player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE,
      { ...updated, nextIntegrityLossCycle: cycle + HALL_INTEGRITY_INTERVAL });
  }

  function injuredAraneiKey(npc) {
    const location = npc.getLocation?.();
    return `aranei:${location?.getX?.()},${location?.getY?.()},${location?.getZ?.()}`;
  }

  function spawnSiegeInjuredAranei(player) {
    const state = hallDefenceState(player);
    if (state.phase !== "hall" || (state.healed ?? []).includes("aranei:3173,7855,1")) return;
    const key = player.getUsername?.() ?? player.getIndex?.();
    const old = siegeHallInjured.get(key);
    if (old && old.isRegistered?.() && old.getHitpoints?.() > 0) return;
    const npc = api.spawnNpc({ id: NpcIdentifiers.ARANEI_112, x: 3173, y: 7855, z: 1,
      wanderRadius: 0, owner: player, ownerOnly: true });
    if (npc) { player.getPrivateArea?.()?.enter(npc); siegeHallInjured.set(key, npc); }
  }

  function handleSiegeLogin({ player }) {
    if (!player || stage(player) !== STAGE.SIEGE) return;
    const state = hallDefenceState(player);
    hall.enter(player);
    if (state.phase === "hall") player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE,
      { ...state, nextIntegrityLossCycle: World.getProcessCycle() + HALL_INTEGRITY_INTERVAL });
    spawnSiegeInjuredAranei(player);
  }

  function handleSiegeLogout({ player }) {
    if (!player) return;
    const key = player.getUsername?.() ?? player.getIndex?.();
    const npc = siegeHallInjured.get(key);
    if (npc) api.removeNpc(npc);
    siegeHallInjured.delete(key);
  }

  function replaceHallObject(event, replacementId) {
    const object = event.object;
    if (!object) return false;
    const location = object.getLocation();
    const area = hall.sessions.get(event.player);
    if (!area || object.getPrivateArea?.() !== area) return false;
    const replacement = new api.core.GameObject(replacementId, location.clone(), object.getType(), object.getFace(), area);
    api.core.ObjectManager.deregister(object, true);
    api.core.ObjectManager.register(replacement, true);
    return true;
  }

  function handleSiegeHallObject(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.SIEGE) return;
    const objectId = event.definition?.id ?? event.objectId;
    const { x, y, z } = event.location ?? {};
    const state = hallDefenceState(player);
    const inventory = player.getInventory();
    if (!["hall", "breach"].includes(state.phase) || event.object?.getPrivateArea?.() !== hall.sessions.get(player)) return;

    if (objectId === SIEGE_HALL.hammerCrate || objectId === SIEGE_HALL.potionCrate) {
      event.handled = true;
      const item = objectId === SIEGE_HALL.hammerCrate ? SIEGE_HALL.hammer : SIEGE_HALL.healingPotion;
      if (!inventory.contains(item)) inventory.adds(item, 1);
      player.sendMessage(item === SIEGE_HALL.hammer ? "You take a hammer from the crate." : "You take a healing potion from the crate.");
      return;
    }

    if (objectId === SIEGE_HALL.barricade && x === 3167 && y === 7844 && z === 1) {
      event.handled = true;
      if (state.phase === "breach") { startSiegeDrakanBattle(player); return; }
      player.sendMessage("The reinforced door is still holding. Keep repairing the hall and helping the Aranei until Lowerniel breaks through.");
      return;
    }

    if (z !== 1 || state.phase !== "hall") return;
    const repairKey = `${x},${y}`;
    const repair = SIEGE_HALL.repairLocations.get(repairKey);
    if (!repair || objectId !== repair[0]) return;
    event.handled = true;
    if (!(state.repaired ?? []).includes(repairKey) && !inventory.contains(SIEGE_HALL.hammer)) {
      player.sendMessage("You need a hammer from the crate in the hall to repair this.");
      return;
    }
    if ((state.repaired ?? []).includes(repairKey)) {
      player.sendMessage("You have already repaired this part of the hall.");
      return;
    }
    if (!replaceHallObject(event, repair[1])) return;
    player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE, { ...state, repaired: [...(state.repaired ?? []), repairKey] });
    applyHallIntegrity(player, 8, true);
    player.sendMessage(repair[0] === SIEGE_HALL.damagedPillar ? "You brace and repair the damaged pillar." : "You repair the damaged window.");
  }

  function healSiegeAranei(event) {
    const player = event?.player;
    const npc = event?.npc ?? event?.target;
    const npcId = event?.npcId ?? npc?.getId?.();
    if (!player || !npc || !SIEGE_HALL.injuredAranei.includes(npcId) ||
      stage(player) !== STAGE.SIEGE || hallDefenceState(player).phase !== "hall") return false;
    if (npc.getOwner?.() !== player || npc.getArea?.() !== hall.sessions.get(player)) return false;
    event.handled = true;
    const state = hallDefenceState(player);
    const key = injuredAraneiKey(npc);
    if ((state.healed ?? []).includes(key)) return;
    const inventory = player.getInventory();
    if (!inventory.contains(SIEGE_HALL.healingPotion)) {
      player.sendMessage("The Aranei needs a healing potion from the crate in the hall.");
      return;
    }
    inventory.deleteNumber(SIEGE_HALL.healingPotion, 1);
    npc.setNpcTransformationId?.(NpcIdentifiers.ARANEI_106);
    player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE, { ...state, healed: [...(state.healed ?? []), key] });
    applyHallIntegrity(player, 12, true);
    siegeHallInjured.delete(player.getUsername?.() ?? player.getIndex?.());
    player.sendMessage("You give the healing potion to the Aranei and help them back to their feet.");
  }

  function handleSiegeDrakanHit(event) {
    const npc = event?.npc;
    const hit = event?.hit;
    const fight = npc && siegeDrakanEncounters.get(npc.getArea?.());
    if (!fight || npc !== fight.boss || fight.ending || !hit) return;
    let remaining = Math.max(0, npc.getHitpoints() - fight.thresholdHp);
    for (const part of hit.getHits?.() ?? []) {
      const damage = part.getDamage?.() ?? 0;
      if (damage <= 0) continue;
      const allowed = Math.min(remaining, damage);
      if (allowed < damage) part.setDamage(allowed);
      remaining -= allowed;
    }
    hit.updateTotalDamage?.();
  }

  function handleSiegeDrakanDeath(event) {
    const npc = event?.npc;
    const fight = npc && siegeDrakanEncounters.get(npc.getArea?.());
    if (!fight || npc !== fight.boss || fight.finished) return false;
    // The story exits at 58% health; never let the combat hit skip its cutscene.
    npc.setHitpoints(Math.max(1, fight.thresholdHp));
    fight.ending = true;
    startTranscript(api, fight.player, npc.getId(), PAGE,
      "drakan-s-siege-fighting-lowerniel-upon-lowerniel-reaching-58-hp");
    return true;
  }

  function startWyrdBattle(player) {
    const existing = player.getAttribute(WYRD_AREA_ATTRIBUTE);
    if (existing && existing.isDestroyed?.() !== true) return true;
    const area = new WyrdEncounterArea(player.getUsername?.());
    const boss = api.spawnNpc({ id: NpcIdentifiers.WYRD_8, x: 2976, y: 7456, z: 0,
      wanderRadius: 0, owner: player, ownerOnly: true });
    if (!boss) {
      player.sendMessage("The Wyrd could not be reached. Return to Veliaf and try again.");
      return false;
    }
    boss.setMultiCombat?.(true);
    boss.setMaxHitpoints(1100);
    boss.setHitpoints(1100);
    area.enter(player);
    area.enter(boss);
    player.setAttribute(WYRD_AREA_ATTRIBUTE, area);
    player.moveTo(new Location(2976, 7452, 0));
    wyrdEncounters.set(area, { area, boss, player, phase: 1, lastCycle: -1, nextAttackAt: World.getProcessCycle() + 4,
      impactAt: 0, warning: null, punches: 0, screeches: 0, markedX: 2976, markedY: 7452, finished: false,
      ending: false, thresholdsSeen: new Set() });
    player.sendMessage("The Wyrd breaks free. Protect from its fists, lower all protection prayers for the screech, and move away from the ground slam.");
    return true;
  }

  function handleWyrdDeath(event) {
    if (handleSiegeDrakanDeath(event)) return;
    if (handleDrakanDeath(event)) return;
    const npc = event?.npc;
    const area = npc?.getArea?.();
    const encounter = area && wyrdEncounters.get(area);
    if (!encounter || npc !== encounter.boss || encounter.finished || event?.killer !== encounter.player) return;
    // A lethal hit can skip over 10% between NPC processing ticks. Keep the same
    // story outcome as the threshold trigger: Safalaan knocks the player out and flees.
    if (!encounter.ending) {
      encounter.ending = true;
      encounter.thresholdsSeen.add(10);
      startTranscript(api, encounter.player, npc.getId(), PAGE, "fighting-wyrds-upon-reaching-10-hp");
    }
  }

  function inspectWyrdFence(event) {
    const player = event?.player;
    const name = String(event?.definition?.getName?.() ?? "").toLowerCase();
    if (!player || !player.getAttribute(WYRD_DEFEATED_ATTRIBUTE) || name !== "broken fence") return false;
    const x = event.location?.getX?.() ?? event.location?.x;
    const y = event.location?.getY?.() ?? event.location?.y;
    if (x !== 3562 || y !== 3323) return false;
    event.handled = true;
    return startTranscript(api, player, 0, PAGE, "fighting-wyrds-inspecting-the-broken-fence");
  }

  function nativeStage(value, player) {
    if (value === STAGE.COMPLETE) return 176;
    if (value === STAGE.STARTED) return player?.getAttribute(HIDEOUT_SHRINE_INSPECTED) ? 8 : 4;
    if (value === STAGE.HIDEOUT) return 12;
    if (value === STAGE.SLEPE) return 16;
    if (value === STAGE.CASTLE) return Number(player?.getAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE)) || 70;
    if (value === STAGE.ESCAPE) return 84;
    if (value === STAGE.PREPARATIONS) {
      const prep = player?.getAttribute(PREP_ATTRIBUTE) ?? {};
      if (prep.flail && prep.stakes) return 114;
      if (prep.flail) return 112;
      if (prep.stewFed) return 110;
      return player?.getInventory?.().contains(PREP.stew) ? 104 : 102;
    }
    if (value === STAGE.SIEGE) {
      const phase = player?.getAttribute(SIEGE_DEFENCE_ATTRIBUTE)?.phase;
      return ({ 'fall-back': 118, hall: 120, breach: 122 })[phase] ?? 116;
    }
    return value;
  }

  function nativeQuestVarbit(value, player) {
    if (value === STAGE.SLEPE) {
      const phase = player?.getAttribute("the-blood-moon-rises:refinery-progress")?.phase;
      const refineryStage = ({ route: 48, tomb: 50, pickaxe: 52, mined: 54, tunnel: 56,
        fight: 58, cleared: 60, freed: 61, escaped: 62 })[phase];
      if (refineryStage !== undefined) return refineryStage;
    }
    return nativeStage(value, player);
  }

  function syncHideoutIvan(event) {
    const player = event?.player;
    if (!player || (event.key && event.key !== "the_blood_moon_rises")) return;
    const value = stage(player);
    // Cache NPC 5049 is invisible at 0, becomes the ordinary blisterwood Ivan
    // at 1, and the trade/disguise variant at 2.
    const variant = value === STAGE.STARTED ? 1 : value === STAGE.HIDEOUT ? 2 : 0;
    player.getPacketSender().sendVarbit(HIDEOUT_IVAN_VARBIT, variant);
  }

  function removeSlepeIvan(player) {
    const npc = slepeIvans.get(player);
    if (npc) api.removeNpc(npc);
    slepeIvans.delete(player);
  }

  function cleanupSlepeIvan({ player }) {
    if (!player) return;
    removeSlepeIvan(player);
    const paterdomusIvan = paterdomusIvans.get(player);
    if (paterdomusIvan?.npc) api.removeNpc(paterdomusIvan.npc);
    paterdomusIvans.delete(player);
    const roy = slepeRoys.get(player);
    if (roy) api.removeNpc(roy);
    slepeRoys.delete(player);
  }

  function cleanupSlepeStory(event) {
    if (event?.player && stage(event.player) !== STAGE.SLEPE) cleanupSlepeManor(event);
  }

  function inSlepe(player) {
    const location = player?.getLocation?.();
    if (!location) return false;
    const x = location.getX(), y = location.getY(), z = location.getZ();
    return z === 0 && x >= 3648 && x <= 3791 && y >= 3232 && y <= 3407;
  }

  function syncSlepeIvan(event) {
    const player = event?.player;
    if (!player) return;
    if (stage(player) !== STAGE.SLEPE || !inSlepe(player)) { removeSlepeIvan(player); return; }
    if (slepeIvans.get(player)) return;
    const story = player.getAttribute(SLEPE_STORY_ATTRIBUTE) ?? {};
    const location = player.getLocation();
    const x = story.ivanFollowing ? Math.max(3727, location.getX() - 1) : 3729;
    const y = story.ivanFollowing ? location.getY() : 3308;
    const npc = api.spawnNpc({ id: NpcIdentifiers.IVAN_STROM_4, x, y, z: location.getZ(),
      wanderRadius: 0, owner: player, ownerOnly: true });
    if (!npc) return;
    npc.setScriptedMovement?.(true);
    slepeIvans.set(player, npc);
  }

  function syncSlepeRoy(event) {
    const player = event?.player;
    if (!player) return;
    if (stage(player) !== STAGE.SLEPE || !inSlepe(player)) {
      const npc = slepeRoys.get(player);
      if (npc) api.removeNpc(npc);
      slepeRoys.delete(player);
      return;
    }
    if (slepeRoys.has(player)) return;
    const roy = api.spawnNpc({ id: NpcIdentifiers.ROY, x: 3750, y: 3296, z: 0,
      wanderRadius: 0, owner: player, ownerOnly: true });
    if (!roy) return;
    roy.setScriptedMovement?.(true);
    slepeRoys.set(player, roy);
  }

  function processSlepeIvan({ player }) {
    if (!player) return;
    syncSlepeIvan({ player });
    syncSlepeRoy({ player });
    const npc = slepeIvans.get(player);
    if (!npc || stage(player) !== STAGE.SLEPE) return;
    const story = player.getAttribute(SLEPE_STORY_ATTRIBUTE) ?? {};
    if (!story.ivanFollowing) return;
    const from = npc.getLocation(), to = player.getLocation();
    if (from.getZ() !== to.getZ() || from.getDistance(to) > 12) {
      npc.moveTo(new Location(to.getX() - 1, to.getY(), to.getZ()));
    } else if (from.getDistance(to) > 1) {
      api.core.PathFinder.calculateWalkRoute(npc, to.getX(), to.getY());
    }
  }

  function inCrombwickManor(player) {
    const location = player?.getLocation?.();
    if (!location) return false;
    const x = location.getX(), y = location.getY();
    return location.getZ() === 1 && x >= 3713 && x <= 3735 && y >= 3352 && y <= 3372;
  }

  function startSlepeManor(player) {
    if (slepeManors.has(player)) return slepeManors.get(player);
    const story = player.getAttribute(SLEPE_STORY_ATTRIBUTE) ?? {};
    if (!story.ivanFollowing || !story.royClue || !inCrombwickManor(player)) return null;
    const area = new SlepeManorArea(player);
    area.enter(player);
    slepeManors.set(player, area);
    if (story.manorEnemiesDefeated) {
      // Private-area actors are recreated after login; a saved clear must resume
      // at Veliaf rather than starting the manor wave again.
      area.finished = true;
      spawnSlepeManorStoryActors(player, area);
      return area;
    }
    // shortcut: the current Wiki text requires every manor Vyrewatch but gives no roster;
    // the three cache forms below are the quest-room wave used until an OSRS capture exists.
    const enemies = [
      [NpcIdentifiers.VYREWATCH_54, 3721, 3358],
      [NpcIdentifiers.VYREWATCH_55, 3723, 3359],
      [NpcIdentifiers.VYREWATCH_56, 3727, 3358],
    ];
    for (const [id, x, y] of enemies) {
      const npc = api.spawnNpc({ id, x, y, z: 1, wanderRadius: 0, owner: player, ownerOnly: true });
      if (!npc) {
        for (const spawned of area.enemies) api.removeNpc(spawned);
        area.leave(player, false);
        slepeManors.delete(player);
        player.sendMessage("The Vyrewatch have not gathered in the manor yet. Enter again from the stairs.");
        return null;
      }
      npc.setMultiCombat?.(true);
      area.enter(npc);
      area.enemies.push(npc);
      npc.getCombat?.().attack?.(player);
    }
    player.setAttribute(SLEPE_STORY_ATTRIBUTE, { ...story, manorEntered: true });
    startTranscript(api, player, NpcIdentifiers.VELIAF_HURTZ, PAGE, "the-truth-hurtz-upon-entering-crombwick-manor");
    return area;
  }

  function spawnSlepeManorStoryActors(player, area) {
    if (area.storyActors.length) return;
    const ivan = api.spawnNpc({ id: NpcIdentifiers.IVAN_STROM_4, x: 3722, y: 3358, z: 1, wanderRadius: 0, owner: player, ownerOnly: true });
    const veliaf = api.spawnNpc({ id: NpcIdentifiers.VELIAF_HURTZ_2, x: 3720, y: 3359, z: 1, wanderRadius: 0, owner: player, ownerOnly: true });
    for (const actor of [ivan, veliaf]) {
      if (!actor) continue;
      actor.setScriptedMovement?.(true);
      area.storyActors.push(actor);
      area.enter(actor);
    }
  }

  function processSlepeManor({ player }) {
    if (!player || stage(player) !== STAGE.SLEPE) return;
    if (inCrombwickManor(player)) startSlepeManor(player);
  }

  function cleanupSlepeManor({ player }) {
    const area = player && slepeManors.get(player);
    if (!area) return;
    for (const npc of [...area.enemies, ...area.storyActors]) if (npc) api.removeNpc(npc);
    area.leave(player, true);
    slepeManors.delete(player);
  }

  function handleSlepeManorDeath(event) {
    const npc = event?.npc;
    const area = npc?.getArea?.();
    const encounter = area instanceof SlepeManorArea ? area : null;
    if (!encounter || encounter.finished || !encounter.enemies.includes(npc) || event?.killer !== encounter.player) return;
    if (encounter.enemies.some(enemy => enemy !== npc && enemy.getHitpoints?.() > 0)) return;
    const player = encounter.player;
    encounter.finished = true;
    player.setAttribute(SLEPE_STORY_ATTRIBUTE, { ...(player.getAttribute(SLEPE_STORY_ATTRIBUTE) ?? {}), manorEnemiesDefeated: true });
    spawnSlepeManorStoryActors(player, encounter);
    player.sendMessage("The manor is clear. Speak to Veliaf.");
  }

  function handleSlepeJournalCondition({ player, stepId }) {
    if (!player || !["eNc25m", "lq2B7i"].includes(stepId)) return null;
    const hasSpace = player.getInventory().getFreeSlots() > 0;
    return stepId === "eNc25m" ? hasSpace : !hasSpace;
  }

  function readSlepeJournal(event) {
    const player = event?.player;
    if (!player || event.itemId !== ItemIdentifiers.SQUIRES_JOURNAL || stage(player) !== STAGE.SLEPE ||
      !(player.getAttribute(SLEPE_STORY_ATTRIBUTE)?.journalGiven)) return;
    event.handled = true;
    player.setAttribute(SLEPE_STORY_ATTRIBUTE, { ...player.getAttribute(SLEPE_STORY_ATTRIBUTE), journalRead: true });
    player.sendMessage("The squire records that Ivandis left a book describing the Seven Priestly Warriors somewhere within Paterdomus.");
  }

  function slepeStory(player) { return player?.getAttribute(SLEPE_STORY_ATTRIBUTE) ?? {}; }

  function paterdomusLocation(player) {
    const loc = player?.getLocation?.();
    if (!loc) return null;
    return { x: loc.getX(), y: loc.getY(), z: loc.getZ() };
  }

  function inPaterdomusCellar(player) {
    const { x, y, z } = paterdomusLocation(player) ?? {};
    return z === 0 && x >= 3434 && x <= 3450 && y >= 9880 && y <= 9910;
  }

  function inPaterdomusTemple(player, plane) {
    const { x, y, z } = paterdomusLocation(player) ?? {};
    return z === plane && x >= 3408 && x <= 3419 && y >= 3483 && y <= 3494;
  }

  function spawnPaterdomusIvan(player, tile) {
    const key = `${tile.x},${tile.y},${tile.z}`;
    const existing = paterdomusIvans.get(player);
    if (existing?.key === key && existing.npc?.isRegistered?.() !== false) return existing.npc;
    if (existing?.npc) api.removeNpc(existing.npc);
    const ivan = api.spawnNpc({ id: NpcIdentifiers.IVAN_STROM_4, ...tile,
      wanderRadius: 0, owner: player, ownerOnly: true });
    if (ivan) {
      ivan.setScriptedMovement?.(true);
      paterdomusIvans.set(player, { npc: ivan, key });
    }
    return ivan;
  }

  function processSlepeProgress({ player }) {
    if (!player || stage(player) !== STAGE.SLEPE) return;
    const story = slepeStory(player);
    if (!story.manorComplete) return;
    if (story.monksCleared && inPaterdomusTemple(player, 1)) {
      spawnPaterdomusIvan(player, { x: 3417, y: 3487, z: 1 });
      return;
    }
    if (!story.monksRequested && inPaterdomusCellar(player)) {
      spawnPaterdomusIvan(player, { x: 3441, y: 9897, z: 0 });
      return;
    }
    const current = paterdomusIvans.get(player);
    if (current?.npc) api.removeNpc(current.npc);
    paterdomusIvans.delete(player);
  }

  function syncPaterdomusBookPuzzle({ player }) {
    if (!player || stage(player) !== STAGE.SLEPE) return;
    const story = slepeStory(player);
    const placements = story.booksPlaced ? {} : (story.bookPlacements ?? {});
    SLEPE_PLINTHS.forEach((plinth, index) => {
      const book = SLEPE_BOOKS.find(({ id }) => id === placements[`${plinth.x},${plinth.y}`]);
      player.getPacketSender?.().sendVarbit(SLEPE_PLINTH_VARBITS[index], book?.varbitValue ?? 0);
    });
  }

  function resolveObjectInteraction(event) {
    const definition = event?.definition ?? ObjectDefinition?.forPlayer?.(event?.objectId, event?.player);
    const option = event?.option ?? definition?.getInteractions?.()?.[(event?.clickType ?? 1) - 1] ?? "";
    return { definition, option: String(option) };
  }

  function eventTile(event) {
    const loc = event?.location;
    if (!loc) return null;
    return { x: typeof loc.getX === "function" ? loc.getX() : loc.x,
      y: typeof loc.getY === "function" ? loc.getY() : loc.y,
      z: typeof loc.getZ === "function" ? loc.getZ() : loc.z ?? 0 };
  }

  function bookOnShelf(player, book, shelf) {
    const story = slepeStory(player);
    if (story.bookPlacements && Object.values(story.bookPlacements).includes(book.id)) return false;
    return book.shelf[0] === shelf.x && book.shelf[1] === shelf.y &&
      player.getInventory().getAmount(book.id) === 0;
  }

  function offerBooksFromShelf(player, shelf) {
    const books = SLEPE_BOOKS.filter((book) => bookOnShelf(player, book, shelf));
    if (!books.length) {
      player.sendMessage("You have already taken the books from this shelf.");
      return;
    }
    const inventory = player.getInventory();
    const chooseBooks = (selected) => {
      const chosen = selected === "Both." ? books : books.filter((book) => book.name === selected);
      if (chosen.length > inventory.getFreeSlots()) {
        player.sendMessage("Make room in your inventory before taking those books.");
        return;
      }
      for (const book of chosen) {
        if (!inventory.adds(book.id, 1)) return;
        player.sendMessage(`You find ${book.name}.`);
      }
    };
    const options = [];
    if (books.length > 1) options.push("Both.", () => chooseBooks("Both."));
    for (const book of books) options.push(book.name, () => chooseBooks(book.name));
    api.sendMultiChatboxPrompt(player, "You find several books. Which would you like to take?", ...options);
  }

  function handlePaterdomusObject(event) {
    const player = event?.player;
    if (!player || stage(player) !== STAGE.SLEPE) return;
    const story = slepeStory(player);
    if (!story.monksCleared || !story.journalRead || !story.upstairsTalked) return;
    const tile = eventTile(event);
    if (!tile || tile.z !== 1) return;
    const { definition, option } = resolveObjectInteraction(event);
    const objectName = String(definition?.getName?.() ?? "");
    if (option === "Search" && /bookcase|bookshelf/i.test(objectName)) {
      const shelf = SLEPE_BOOKS.find(({ shelf: [x, y] }) => x === tile.x && y === tile.y)?.shelf;
      if (!shelf) return;
      event.handled = true;
      offerBooksFromShelf(player, { x: shelf[0], y: shelf[1] });
      return;
    }
    const plinth = SLEPE_PLINTHS.find(({ x, y }) => x === tile.x && y === tile.y);
    if (option === "Inspect" && /window|glass/i.test(objectName)) {
      const portrait = SLEPE_PLINTHS.find(({ x, y }) => x === tile.x && y === tile.y);
      if (!portrait) return;
      event.handled = true;
      startTranscript(api, player, 0, PAGE,
        `the-truth-hurtz-inspecting-the-stained-glass-windows-${portrait.window.toLowerCase()}`);
      return;
    }
    if (!plinth || objectName !== "Plinth") return;
    if (option === "Inspect") {
      event.handled = true;
      startTranscript(api, player, 0, PAGE, "the-truth-hurtz-inspecting-the-plinths");
      return;
    }
    if (option === "Take") {
      const placements = { ...(story.bookPlacements ?? {}) };
      const key = `${plinth.x},${plinth.y}`;
      const bookId = placements[key];
      if (!bookId) return;
      event.handled = true;
      if (player.getInventory().getFreeSlots() <= 0 || !player.getInventory().adds(bookId, 1)) {
        player.sendMessage("Make room in your inventory before taking the book.");
        return;
      }
      delete placements[key];
      player.setAttribute(SLEPE_STORY_ATTRIBUTE, { ...story, bookPlacements: placements });
      player.getPacketSender().sendVarbit(SLEPE_PLINTH_VARBITS[SLEPE_PLINTHS.indexOf(plinth)], 0);
    }
  }

  function handlePaterdomusItemOnObject(event) {
    const player = event?.player;
    if (!player || stage(player) !== STAGE.SLEPE) return;
    const story = slepeStory(player);
    if (!story.monksCleared || !story.journalRead || !story.upstairsTalked || story.booksPlaced) return;
    const tile = eventTile(event);
    if (!tile || tile.z !== 1) return;
    const plinth = SLEPE_PLINTHS.find(({ x, y }) => x === tile.x && y === tile.y);
    const book = SLEPE_BOOKS.find(({ id }) => id === event.itemId);
    if (!plinth || !book) return;
    event.handled = true;
    if (!player.getInventory().contains(event.itemId)) return;
    const placements = { ...(story.bookPlacements ?? {}) };
    const key = `${plinth.x},${plinth.y}`;
    if (placements[key]) {
      if (placements[key] === book.id) {
        player.sendMessage("That book is already on this plinth.");
        return;
      }
      if (!player.getInventory().adds(placements[key], 1)) {
        player.sendMessage("Make room in your inventory before changing the book on this plinth.");
        return;
      }
      player.sendMessage(`You take ${SLEPE_BOOKS.find(({ id }) => id === placements[key])?.name ?? "the misplaced book"} from the plinth.`);
    }
    player.getInventory().deleteNumber(event.itemId, 1);
    placements[key] = book.id;
    const complete = SLEPE_PLINTHS.every((spot) =>
      placements[`${spot.x},${spot.y}`] === spot.itemId);
    player.setAttribute(SLEPE_STORY_ATTRIBUTE, { ...story, bookPlacements: placements, ...(complete ? { booksPlaced: true } : {}) });
    player.getPacketSender().sendVarbit(SLEPE_PLINTH_VARBITS[SLEPE_PLINTHS.indexOf(plinth)], book.varbitValue);
    player.sendMessage(`You place ${book.name} on the plinth.`);
    if (!complete) return;
    for (const varbit of SLEPE_PLINTH_VARBITS) player.getPacketSender().sendVarbit(varbit, 0);
    player.setAttribute(SLEPE_STORY_ATTRIBUTE, { ...story, booksPlaced: true, bookPlacements: {} });
    startTranscript(api, player, NpcIdentifiers.IVAN_STROM_4, PAGE, "the-truth-hurtz-upon-completing-the-book-puzzle");
  }

  function handlePaterdomusMonkDeath(event) {
    const player = event?.killer;
    const npc = event?.npc;
    if (!player?.isPlayer?.() || !npc || stage(player) !== STAGE.SLEPE) return;
    const story = slepeStory(player);
    if (!story.monksRequested || story.monksCleared) return;
    const spawn = npc.getSpawnPosition?.() ?? npc.getLocation?.();
    if (!SLEPE_MONK_IDS.has(npc.getId?.() ?? event.npcId) || !spawn || spawn.getZ() !== 0) return;
    const x = spawn.getX(), y = spawn.getY();
    if (!SLEPE_MONK_TILES.some(([tx, ty]) => tx === x && ty === y)) return;
    const kills = new Set(story.monkKills ?? []);
    kills.add(`${x},${y}`);
    const allDefeated = kills.size >= SLEPE_MONK_TILES.length;
    player.setAttribute(SLEPE_STORY_ATTRIBUTE, { ...story, monkKills: [...kills], ...(allDefeated ? { monksCleared: true } : {}) });
    if (allDefeated) {
      player.sendMessage("The Zamorakian monks are defeated. Ivan is waiting upstairs in the temple.");
      startTranscript(api, player, NpcIdentifiers.IVAN_STROM_4, PAGE, "the-truth-hurtz-upon-killing-the-monks-of-zamorak");
    }
  }

  function readPaterdomusBook(event) {
    const player = event?.player;
    const book = SLEPE_BOOKS.find(({ id }) => id === event?.itemId);
    if (!player || !book || stage(player) !== STAGE.SLEPE || !slepeStory(player).upstairsTalked ||
      !player.getInventory().contains(book.id)) return;
    event.handled = true;
    const identities = {
      [ItemIdentifiers.ESSIANDARS_NOTES]: "Essiandar Gar",
      [ItemIdentifiers.SARLS_JOURNAL]: "Sarl Dunegun",
      [ItemIdentifiers.FROM_MISTHALIN_TO_MORYTANIA]: "Iriandul Caistlyn",
      [ItemIdentifiers.SCRUFFY_NOTEBOOK]: "Derygull Templeton",
      [ItemIdentifiers.THE_LIFE_OF_FRIAR]: "Friar Twiblick",
      [ItemIdentifiers.PIOUS_PROCEEDINGS]: "Erysail the Pious",
    };
    player.sendMessage(`The book identifies ${identities[book.id]} as one of the Seven Priestly Warriors.`);
  }

  function readIvandisWritings(event) {
    const player = event?.player;
    if (!player || event?.itemId !== ItemIdentifiers.IVANDIS_WRITINGS || stage(player) !== STAGE.SLEPE ||
      !slepeStory(player).writingsGiven || !player.getInventory().contains(ItemIdentifiers.IVANDIS_WRITINGS)) return;
    event.handled = true;
    player.setAttribute(SLEPE_STORY_ATTRIBUTE, { ...slepeStory(player), writingsRead: true });
    player.sendMessage("Ivandis describes his final attempt to reach Castle Drakan through a tunnel near his tomb.");
  }

  function inspectHideoutShrine(event) {
    const player = event?.player;
    if (!player || !HIDEOUT_SHRINE_IDS.has(event.objectId) || stage(player) !== STAGE.STARTED) return;
    const at = player.getLocation?.();
    const x = typeof at?.getX === "function" ? at.getX() : at?.x;
    const y = typeof at?.getY === "function" ? at.getY() : at?.y;
    const z = typeof at?.getZ === "function" ? at.getZ() : at?.z;
    if (z !== HIDEOUT_SHRINE_TILE.z || Math.abs(x - HIDEOUT_SHRINE_TILE.x) > 2 || Math.abs(y - HIDEOUT_SHRINE_TILE.y) > 2) return;
    event.handled = true;
    player.setAttribute(HIDEOUT_SHRINE_INSPECTED, true);
    player.getPacketSender().sendVarbit(15464, nativeStage(STAGE.STARTED, player));
    startTranscript(api, player, 9531, PAGE, "starting-out-inspecting-the-shrine");
  }

  function hideoutOutfitWorn(player) {
    const equipment = player.getEquipment();
    return equipment.get(Equipment.BODY_SLOT)?.getId?.() === VYRE_NOBLE_OUTFIT[0] &&
      equipment.get(Equipment.LEG_SLOT)?.getId?.() === VYRE_NOBLE_OUTFIT[1] &&
      equipment.get(Equipment.FEET_SLOT)?.getId?.() === VYRE_NOBLE_OUTFIT[2];
  }

  function answerHideoutCondition({ player, stepId }) {
    if (!player || !["nMuybV", "wAGF9J", "ysow_0"].includes(stepId)) return null;
    const outfitWorn = hideoutOutfitWorn(player);
    const hasOutfit = outfitWorn || VYRE_NOBLE_OUTFIT.every((id) => player.getInventory().contains(id));
    if (stepId === "nMuybV") return !hasOutfit;
    if (stepId === "wAGF9J") return hasOutfit && !outfitWorn;
    return outfitWorn;
  }

  function openHideoutChest(event) {
    const player = event?.player;
    const visibleId = event?.definition?.id ?? event?.objectId;
    if (!player || visibleId !== HIDEOUT_CHEST_ID || ![STAGE.STARTED, STAGE.HIDEOUT].includes(stage(player))) return false;
    const location = event.location ?? event.object?.getLocation?.();
    const x = typeof location?.getX === "function" ? location.getX() : location?.x;
    const y = typeof location?.getY === "function" ? location.getY() : location?.y;
    const z = typeof location?.getZ === "function" ? location.getZ() : location?.z;
    if (x !== HIDEOUT_CHEST_TILE.x || y !== HIDEOUT_CHEST_TILE.y || z !== HIDEOUT_CHEST_TILE.z || event.option !== "Open") return false;
    event.handled = true;
    if (VYRE_NOBLE_OUTFIT.every((id) => player.getInventory().contains(id))) {
      player.sendMessage("The chest contains no more of the disguise.");
      return true;
    }
    const inventory = player.getInventory();
    const freeSlots = typeof inventory.getFreeSlots === "function" ? inventory.getFreeSlots() : inventory.isFull() ? 0 : 28;
    const missing = VYRE_NOBLE_OUTFIT.filter((id) => !inventory.contains(id));
    if (freeSlots < missing.length) {
      player.sendMessage("You need more inventory space to take the vyre noble disguise.");
      return true;
    }
    for (const id of missing) inventory.adds(id, 1);
    player.sendMessage("You open the chest and take a vyre noble disguise.");
    return true;
  }

  function stage(player) { return quest.getStage(player); }
  function isAtSinsMedallionHideout(event) {
    const location = event?.location ?? event?.npc?.getLocation?.();
    const x = location?.getX?.() ?? location?.x;
    const y = location?.getY?.() ?? location?.y;
    const z = location?.getZ?.() ?? location?.z;
    return z === 0 && Math.abs(x - 3598) <= 12 && Math.abs(y - 9613) <= 12;
  }
  function advance(player, value) {
    if (stage(player) < value) quest.setStage(player, value);
  }
  function hasQuest(player, key) {
    const request = { player, key, complete: null };
    api.emitCustomEvent("quest:is-complete", request);
    return request.complete === true;
  }
  function meetsRequirements(player) {
    return REQUIRED_QUESTS.every(([key]) => hasQuest(player, key)) &&
      REQUIRED_SKILLS.every(([skill, level]) => player.getSkillManager().getMaxLevel(skill) >= level);
  }
  function explainRequirements(player) {
    for (const [key, name] of REQUIRED_QUESTS) {
      if (!hasQuest(player, key)) player.sendMessage(`You must have completed ${name} to start this quest.`);
    }
    for (const [skill, level, name] of REQUIRED_SKILLS) {
      if (player.getSkillManager().getMaxLevel(skill) < level) player.sendMessage(`You need ${level} ${name} to start this quest.`);
    }
  }
  function currentChapter(value) {
    let selected = CHAPTERS[0][1];
    for (const [threshold, chapter] of CHAPTERS) if (value >= threshold) selected = chapter;
    return selected;
  }

  function selectVariant(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player)) return null;
    const page = event.pages?.find((entry) => entry.page === PAGE);
    if (!page) return null;
    const value = stage(player);
    if (value === STAGE.SLEPE && event.definition?.getName?.() === "Ivan Strom" && isAtSinsMedallionHideout(event)) {
      const sinsPage = event.pages.find((entry) => entry.page === "Ivan Strom");
      const sinsVariant = "standard-dialogue-after-completing-sins-of-the-father";
      if (hasQuest(player, "sins_of_the_father") && sinsPage?.variants.includes(sinsVariant)) {
        return { page: sinsPage.page, variant: sinsVariant };
      }
      return null;
    }
    if (value === STAGE.NOT_STARTED) {
      if (event.definition?.getName?.() !== "Sarius Guile" || !meetsRequirements(player)) return null;
      return page.variants.includes("starting-out") ? { page: PAGE, variant: "starting-out" } : null;
    }
    const chapter = currentChapter(value);
    const candidates = page.variants.filter((variant) => variant.startsWith(`${chapter}-`));
    if (!candidates.length) return null;
    const useful = candidates.filter((variant) => !variant.includes("again"));
    return { page: PAGE, variant: (useful[0] ?? candidates[0]) };
  }

  function onStartHook(event) {
    if (event?.hook !== START_HOOK || !event.player) return;
    if (!meetsRequirements(event.player)) { explainRequirements(event.player); return; }
    advance(event.player, STAGE.STARTED);
  }

  function prayAtCastleShrine(event) {
    const player = event?.player;
    const tile = event?.location;
    const x = tile?.x ?? tile?.getX?.();
    const y = tile?.y ?? tile?.getY?.();
    const z = tile?.z ?? tile?.getZ?.();
    const name = String(event?.definition?.getName?.() ?? "").toLowerCase();
    const objectId = event?.definition?.id ?? event?.objectId;
    const atShrine = [[3168, 7707], [3168, 7713]].some(([sx, sy]) => x === sx && y === sy && z === 0);
    if (!player || stage(player) !== STAGE.SLEPE || !slepeStory(player).refineryComplete ||
      !atShrine || (objectId !== 61225 && objectId !== 61226 && name !== "shrine") ||
      String(event?.option ?? "") !== "Pray-to") return false;
    event.handled = true;
    if (!player.getAttribute(CASTLE_SHRINE_ATTRIBUTE)) {
      player.setAttribute(CASTLE_SHRINE_ATTRIBUTE, true);
      player.getPacketSender().sendVarbit(CASTLE_SHRINE_VARBIT, 1);
      player.sendMessage("You pray at the vampyric shrine. Drakan's medallion can now return you to Castle Drakan.");
    }
    return true;
  }

  function syncCastleShrine({ player }) {
    if (!player || stage(player) < STAGE.SLEPE) return;
    player.getPacketSender().sendVarbit(CASTLE_SHRINE_VARBIT,
      player.getAttribute(CASTLE_SHRINE_ATTRIBUTE) ? 1 : 0);
  }

  function syncCastleRoom(player) {
    if (!player || stage(player) < STAGE.CASTLE || stage(player) > STAGE.ESCAPE) return;
    const room = Number(player.getAttribute(CASTLE_ROOM_ATTRIBUTE)) || CASTLE_ROOM.LOBBY;
    const floor = Number(player.getAttribute(CASTLE_FLOOR_ATTRIBUTE)) || CASTLE_GROUND_FLOOR;
    player.setAttribute(CASTLE_ROOM_ATTRIBUTE, room);
    player.setAttribute(CASTLE_FLOOR_ATTRIBUTE, floor);
    player.getPacketSender().sendVarbit(CASTLE_WORLD_MAP_FLOOR_VARBIT, floor);
    player.getPacketSender().sendVarbit(CASTLE_LAST_ROOM_VARBIT, room);
  }

  function syncCastleRoomOnLogin({ player }) {
    repairLegacyCastleLanding(player);
    reconcileCastleLobbyFloor(player);
    syncCastleRoom(player);
    if (stage(player) === STAGE.CASTLE) {
      player.getPacketSender().sendVarbit(15464,
        Number(player.getAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE)) || 70);
    }
    syncCastleActors(player);
    const bookPuzzle = bookPuzzleState(player);
    if (stage(player) === STAGE.CASTLE && Array.isArray(bookPuzzle.positions)) {
      player.setAttribute(CASTLE_BOOK_PUZZLE_ATTRIBUTE, { ...bookPuzzle, open: false, selected: null });
      writeBookPuzzlePositions(player, bookPuzzle.positions);
    }
    if (stage(player) === STAGE.CASTLE) {
      player.getPacketSender().sendVarbit(CASTLE_GILDED_BOOKCASE_VARBIT,
        castleStory(player).bookPuzzleComplete || bookPuzzle.solved ? 2 : bookPuzzle.prepared ? 1 : 0);
    }
    syncCastleKeyVarbits(player);
    syncCastleBookKey(player);
    syncCastleGibbousKey(player);
    syncCastleSyringeBarrel(player);
  }

  function reconcileCastleLobbyFloor(player) {
    if (!player || Number(player.getAttribute(CASTLE_ROOM_ATTRIBUTE)) !== CASTLE_ROOM.LOBBY) return;
    const z = player.getLocation?.()?.getZ?.();
    const expectedFloor = z === 1 ? 2 : z === 0 ? CASTLE_GROUND_FLOOR : null;
    if (expectedFloor !== null && Number(player.getAttribute(CASTLE_FLOOR_ATTRIBUTE)) !== expectedFloor) {
      player.setAttribute(CASTLE_FLOOR_ATTRIBUTE, expectedFloor);
    }
  }

  function repairLegacyCastleLanding(player) {
    if (!player || stage(player) !== STAGE.CASTLE) return;
    const location = player.getLocation?.();
    if (!location || location.getX() !== CASTLE_LEGACY_BLOCKED_ARRIVAL.x ||
      location.getY() !== CASTLE_LEGACY_BLOCKED_ARRIVAL.y || location.getZ() !== CASTLE_LEGACY_BLOCKED_ARRIVAL.z) return;
    // Older builds used a nearby NPC/cutscene marker as the player's arrival.
    // Move only that exact stuck save to the actual Vampyrium lobby; quest flags
    // and inventory are left untouched.
    player.moveTo(new Location(CASTLE_VAMPYRIUM_ARRIVAL.x, CASTLE_VAMPYRIUM_ARRIVAL.y,
      CASTLE_VAMPYRIUM_ARRIVAL.z));
    player.setAttribute(CASTLE_ROOM_ATTRIBUTE, CASTLE_ROOM.LOBBY);
  }

  function castleStory(player) {
    return player.getAttribute(CASTLE_STORY_ATTRIBUTE) ?? { defeated: [], talkedToVeliaf: false,
      prisonersFound: false, talkedToIvan: false, bookPuzzleComplete: false, stockpileDestroyed: false };
  }

  function bookPuzzleState(player) {
    return player?.getAttribute(CASTLE_BOOK_PUZZLE_ATTRIBUTE) ?? { open: false, positions: null, selected: null, solved: false };
  }

  function writeBookPuzzlePositions(player, positions) {
    CASTLE_BOOK_VARBITS.forEach((varbit, slot) => player.getPacketSender().sendVarbit(varbit, positions[slot]));
  }

  function openCastleBookPuzzle(player) {
    const state = bookPuzzleState(player);
    if (!state.positions) {
      const cached = CASTLE_BOOK_VARBITS.map(varbit => player.getPacketSender().getVarbit?.(varbit));
      const validCacheOrder = cached.length === 8 && cached.every(Number.isInteger) &&
        [...cached].sort((a, b) => a - b).every((value, index) => value === index + 1) &&
        !cached.every((value, index) => value === index + 1);
      // The cache puzzle exposes the active order through these eight varbits.
      // Its initial permutation is cache/client-generated; the stable fallback
      // below is only used when this server has no valid initial cache values.
      state.positions = validCacheOrder ? cached : [4, 1, 7, 2, 8, 3, 5, 6];
    }
    player.setAttribute(CASTLE_BOOK_PUZZLE_ATTRIBUTE, { ...state, open: true, selected: null });
    writeBookPuzzlePositions(player, state.positions);
    player.getPacketSender().sendInterface(CASTLE_BOOKCASE_INTERFACE);
  }

  function startCastleBookPuzzlePrompt(player) {
    api.sendMultiChatboxPrompt(player, "The gilded bookcase asks you to arrange the Vampyric Houses alphabetically.",
      "Rearrange the books", () => openCastleBookPuzzle(player),
      "Not yet", () => player.getPacketSender().sendInterfaceRemoval());
  }

  function handleCastleBookWidgetAction(event) {
    const player = event?.player;
    const packet = event?.packet;
    const state = bookPuzzleState(player);
    if (!player || !packet || packet.type !== "widget_action" || packet.groupId !== CASTLE_BOOKCASE_INTERFACE ||
      stage(player) !== STAGE.CASTLE || !state.open || state.solved || !Array.isArray(state.positions)) return;
    const slot = Number.isInteger(packet.slot) && packet.slot >= 0 && packet.slot < 8
      ? packet.slot : packet.childId;
    if (!Number.isInteger(slot) || slot < 0 || slot >= 8) return;
    event.handled = true;
    if (state.selected === null) {
      player.setAttribute(CASTLE_BOOK_PUZZLE_ATTRIBUTE, { ...state, selected: slot });
      return;
    }
    if (state.selected === slot) {
      player.setAttribute(CASTLE_BOOK_PUZZLE_ATTRIBUTE, { ...state, selected: null });
      return;
    }
    const positions = [...state.positions];
    [positions[state.selected], positions[slot]] = [positions[slot], positions[state.selected]];
    const solved = positions.every((value, index) => value === index + 1);
    player.setAttribute(CASTLE_BOOK_PUZZLE_ATTRIBUTE, { open: !solved, positions, selected: null, solved });
    writeBookPuzzlePositions(player, positions);
    if (solved) {
      const story = castleStory(player);
      player.setAttribute(CASTLE_STORY_ATTRIBUTE, { ...story, bookPuzzleComplete: true });
      player.getPacketSender().sendVarbit(CASTLE_GILDED_BOOKCASE_VARBIT, 2);
      player.getPacketSender().sendInterfaceRemoval();
      player.sendMessage("You arrange the Vampyric Houses alphabetically. A secret passage opens to the south.");
      syncCastleBookKey(player);
    }
  }

  function syncCastleBookKey(player) {
    if (!player || stage(player) !== STAGE.CASTLE) return;
    const story = castleStory(player);
    if (!story.bookPuzzleComplete || story.fullMoonKeyClaimed) return;
    const manager = api.getItemOnGroundManager?.();
    if (!manager?.registerLocation) return;
    const tile = new Location(...CASTLE_LIBRARY.secretKey, CASTLE_LIBRARY.z);
    if (!manager.getGroundItem?.(player.getUsername?.(), CASTLE_BOOK_ITEMS.fullMoonKey, tile,
      player.getPrivateArea?.() ?? null)) {
      manager.registerLocation(player, new Item(CASTLE_BOOK_ITEMS.fullMoonKey, 1), tile);
    }
  }

  function syncCastleGibbousKey(player) {
    if (!player || stage(player) !== STAGE.CASTLE) return;
    const story = castleStory(player);
    if (!story.prisonersFound || story.gibbousKeyClaimed || hasItem(player, CASTLE_BOOK_ITEMS.gibbousMoonKey)) return;
    const manager = api.getItemOnGroundManager?.();
    if (!manager?.registerLocation) return;
    const tile = new Location(2573, 7395, 0);
    if (!manager.getGroundItem?.(player.getUsername?.(), CASTLE_BOOK_ITEMS.gibbousMoonKey, tile,
      player.getPrivateArea?.() ?? null)) {
      manager.registerLocation(player, new Item(CASTLE_BOOK_ITEMS.gibbousMoonKey, 1), tile);
    }
  }

  function syncCastleSyringeBarrel(player) {
    if (!player || stage(player) !== STAGE.CASTLE) return;
    const story = castleStory(player);
    if (!story.defeated.includes("kitchen-sanguidae") || story.syringeBarrelClaimed ||
      hasItem(player, CASTLE_KEY_ITEMS.barrel)) return;
    const manager = api.getItemOnGroundManager?.();
    if (!manager?.registerLocation) return;
    const tile = new Location(2315, 7418, 0);
    if (!manager.getGroundItem?.(player.getUsername?.(), CASTLE_KEY_ITEMS.barrel, tile,
      player.getPrivateArea?.() ?? null)) {
      manager.registerLocation(player, new Item(CASTLE_KEY_ITEMS.barrel, 1), tile);
    }
  }

  function syncCastleKeyVarbits(player) {
    if (!player || stage(player) !== STAGE.CASTLE) return;
    const story = castleStory(player);
    const state = story.newMoon ?? {};
    const vars = player.getPacketSender();
    vars.sendVarbit(CASTLE_KEY_VARBITS.sinkEmptied, state.sinkPlugClaimed ? 1 : 0);
    vars.sendVarbit(CASTLE_KEY_VARBITS.larderSink, state.larderSinkCollapsed ? 2 : state.larderSinkPlugged ? 1 : 0);
    vars.sendVarbit(CASTLE_KEY_VARBITS.corpseOpened, state.corpseOpened ? 1 : 0);
    vars.sendVarbit(CASTLE_KEY_VARBITS.kitchenChest, state.kitchenChestUnlocked ? 1 : 0);
    vars.sendVarbit(CASTLE_KEY_VARBITS.fireplace, state.fullCrestInFireplace ? 1 : 0);
    ["statue1", "statue2", "statue3", "statue4"].forEach((key, index) => {
      vars.sendVarbit(CASTLE_KEY_VARBITS[key], state.weaponPuzzle?.[index] ? 1 : 0);
    });
  }

  function updateCastleKeyStory(player, changes) {
    const story = castleStory(player);
    player.setAttribute(CASTLE_STORY_ATTRIBUTE, { ...story, newMoon: { ...(story.newMoon ?? {}), ...changes } });
    syncCastleKeyVarbits(player);
  }

  function castleKeyGive(player, itemId, message) {
    const inventory = player.getInventory();
    if (inventory.getFreeSlots() <= 0 || !inventory.adds(itemId, 1)) {
      player.sendMessage("Make room in your inventory before continuing.");
      return false;
    }
    if (message) player.sendMessage(message);
    return true;
  }

  function confirmCastleKeyAction(player, prompt, accept) {
    api.sendMultiChatboxPrompt(player, prompt,
      "Yes.", () => {
        if (player.isRegistered?.() === false || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
        accept();
      },
      "No.", () => {});
  }

  function handleCastleKeyPickup(event) {
    const player = event?.player;
    const id = event?.groundItemId;
    if (!player || stage(player) !== STAGE.CASTLE || id !== CASTLE_KEY_ITEMS.barrel) return;
    const location = event.location;
    const x = location?.getX?.() ?? location?.x;
    const y = location?.getY?.() ?? location?.y;
    const z = location?.getZ?.() ?? location?.z;
    const story = castleStory(player);
    if (x !== 2315 || y !== 7418 || z !== 0 || !story.defeated.includes("kitchen-sanguidae")) return;
    player.setAttribute(CASTLE_STORY_ATTRIBUTE, { ...story, syringeBarrelClaimed: true });
    player.sendMessage("You take the syringe barrel left by the kitchen aranei.");
  }

  function handleCastleKeyObjects(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE ||
      (Number(player.getAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE)) || 70) < 74) return;
    const tile = event.location;
    const x = tile?.x ?? tile?.getX?.();
    const y = tile?.y ?? tile?.getY?.();
    const z = tile?.z ?? tile?.getZ?.();
    if (z !== 0) return;
    const id = event.definition?.id ?? event.objectId;
    const option = String(event.option ?? "");
    const story = castleStory(player);
    const key = story.newMoon ?? {};

    if (CASTLE_KEY_OBJECTS.crate.has(id) && x === 2315 && y === 7408 && option === "Search") {
      event.handled = true;
      if (!story.syringeBarrelClaimed || !hasItem(player, CASTLE_KEY_ITEMS.barrel)) {
        player.sendMessage("The kitchen insects are still guarding the tools; take the syringe barrel first.");
        return;
      }
      if (key.stomachClaimed) { player.sendMessage("The venator stomach crate is empty."); return; }
      if (castleKeyGive(player, CASTLE_KEY_ITEMS.stomach, "You search the south-eastern crate and take the venator stomach.")) {
        updateCastleKeyStory(player, { stomachClaimed: true });
      }
      return;
    }
    if (CASTLE_KEY_OBJECTS.kitchenSink.has(id) && x === 2308 && y === 7411 && option === "Inspect") {
      event.handled = true;
      if (key.sinkPlugClaimed) { player.sendMessage("You have already removed the sink plug."); return; }
      confirmCastleKeyAction(player, "Remove the plug from the sink?", () => {
        if (castleStory(player).newMoon?.sinkPlugClaimed) return;
        if (castleKeyGive(player, CASTLE_KEY_ITEMS.plug, "You remove the plug from the kitchen sink.")) {
          updateCastleKeyStory(player, { sinkPlugClaimed: true });
        }
      });
      return;
    }
    if (CASTLE_KEY_OBJECTS.larderSink.has(id) && x === 2356 && y === 7400 &&
      ["Turn on", "Turn-on", "Activate"].includes(option)) {
      event.handled = true;
      if (!key.larderSinkPlugged) { player.sendMessage("The sink needs a plug before you turn the tap on."); return; }
      if (key.larderSinkCollapsed) { player.sendMessage("The sink has already collapsed."); return; }
      confirmCastleKeyAction(player, "Turn the tap on?", () => {
        const current = castleStory(player).newMoon ?? {};
        if (!current.larderSinkPlugged || current.larderSinkCollapsed) return;
        updateCastleKeyStory(player, { larderSinkCollapsed: true });
        player.sendMessage("You turn on the tap. The sink gives way, leaving a broken pipe.");
      });
      return;
    }
    if (CASTLE_KEY_OBJECTS.larderSink.has(id) && x === 2356 && y === 7400 && option === "Take pipe") {
      event.handled = true;
      if (!key.larderSinkCollapsed) { player.sendMessage("The sink has not collapsed yet."); return; }
      if (key.pipeClaimed) { player.sendMessage("You already took the broken pipe."); return; }
      confirmCastleKeyAction(player, "Take the broken pipe?", () => {
        if (castleStory(player).newMoon?.pipeClaimed) return;
        if (castleKeyGive(player, CASTLE_KEY_ITEMS.pipe, "You take the broken pipe.")) updateCastleKeyStory(player, { pipeClaimed: true });
      });
      return;
    }
    if (CASTLE_KEY_OBJECTS.larderCabinet.has(id) && x === 2360 && y === 7403 && option === "Search") {
      event.handled = true;
      if (!key.pipeClaimed || !hasItem(player, CASTLE_KEY_ITEMS.pipe)) {
        player.sendMessage("You need the broken pipe to reach behind the cabinet.");
        return;
      }
      player.sendMessage("The cabinet is too close to reach behind without using the broken pipe on it.");
      return;
    }
    if (CASTLE_KEY_OBJECTS.crate.has(id) && x === 2358 && y === 7397 && option === "Search") {
      event.handled = true;
      if (!key.larderSinkCollapsed) { player.sendMessage("The crate is wedged behind the intact sink."); return; }
      if (key.plungerClaimed) { player.sendMessage("The crate is empty."); return; }
      if (castleKeyGive(player, CASTLE_KEY_ITEMS.plunger, "You search the larder crate and take a syringe plunger.")) {
        updateCastleKeyStory(player, { plungerClaimed: true });
      }
      return;
    }
    if (CASTLE_KEY_OBJECTS.corpse.has(id) && x === 2311 && y === 7417 &&
      ["Inspect", "Search"].includes(option)) {
      event.handled = true;
      if (!key.corpseOpened) { player.sendMessage("The venator corpse is still closed."); return; }
      if (key.tongsClaimed) { player.sendMessage("You have already taken the tongs."); return; }
      if (castleKeyGive(player, CASTLE_KEY_ITEMS.tongs, "You search the opened corpse and take the tongs.")) {
        updateCastleKeyStory(player, { tongsClaimed: true });
      }
      return;
    }
    if (CASTLE_KEY_OBJECTS.kitchenChest.has(id) && x === 2308 && y === 7415 && option === "Search") {
      event.handled = true;
      if (!key.kitchenChestUnlocked) { player.sendMessage("The kitchen chest is locked."); return; }
      if (key.leftCrestClaimed) { player.sendMessage("The chest is empty."); return; }
      confirmCastleKeyAction(player, "Search the unlocked chest?", () => {
        if (castleStory(player).newMoon?.leftCrestClaimed) return;
        if (castleKeyGive(player, CASTLE_KEY_ITEMS.leftCrest, "You open the chest and take the left crest half.")) {
          updateCastleKeyStory(player, { leftCrestClaimed: true });
        }
      });
      return;
    }
    if (CASTLE_KEY_OBJECTS.armouryChest.has(id) && x === 2570 && y === 7380 && option === "Search") {
      event.handled = true;
      if (!story.defeated.includes("first-venator")) { player.sendMessage("The venator still guards the armoury."); return; }
      if (!Array.isArray(key.weaponPuzzle) || key.weaponPuzzle.length !== 4 || !key.weaponPuzzle.every(Boolean)) {
        player.sendMessage("The chest remains locked until the statues mirror their weapons.");
        return;
      }
      if (key.rightCrestClaimed || hasItem(player, CASTLE_KEY_ITEMS.rightCrest)) { player.sendMessage("You already have the right crest half."); return; }
      if (castleKeyGive(player, CASTLE_KEY_ITEMS.rightCrest, "You search the armoury chest and find the right crest half.")) {
        updateCastleKeyStory(player, { rightCrestClaimed: true });
      }
      return;
    }
    if (CASTLE_KEY_OBJECTS.weaponCase.has(id) && x === 2579 && y === 7382 && option === "Search") {
      event.handled = true;
      if (!story.defeated.includes("first-venator")) {
        player.sendMessage("The venator still guards the armoury.");
        return;
      }
      startCastleWeaponChoice(player);
      return;
    }
    if (CASTLE_KEY_OBJECTS.studyFireplace.has(id) && x === 2358 && y === 7386 && option === "Search") {
      event.handled = true;
      if (!key.fullCrestInFireplace) { player.sendMessage("The fireplace's hidden lock needs the full crest."); return; }
      if (key.newMoonKeyClaimed || hasItem(player, CASTLE_BOOK_ITEMS.newMoonKey)) {
        player.sendMessage("You already have the new moon key.");
        return;
      }
      if (castleKeyGive(player, CASTLE_BOOK_ITEMS.newMoonKey, "You search the study fireplace and find the new moon key.")) {
        updateCastleKeyStory(player, { newMoonKeyClaimed: true });
      }
    }
  }

  function startCastleWeaponChoice(player) {
    const choices = [
      ["Take a battleaxe", CASTLE_KEY_ITEMS.axe, "You take a battleaxe from the armoury rack."],
      ["Take a mace", CASTLE_KEY_ITEMS.mace, "You take a mace from the armoury rack."],
      ["Take a sword", CASTLE_KEY_ITEMS.sword, "You take a sword from the armoury rack."],
    ];
    api.sendMultiChatboxPrompt(player, "Choose a weapon from the armoury rack.",
      ...choices.flatMap(([label, id, message]) => [label, () => castleKeyGive(player, id, message)]));
  }

  function handleCastleKeyItemOnObject(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE ||
      (Number(player.getAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE)) || 70) < 74) return;
    const tile = event.location;
    const x = tile?.x ?? tile?.getX?.();
    const y = tile?.y ?? tile?.getY?.();
    const z = tile?.z ?? tile?.getZ?.();
    const id = event.definition?.id ?? event.objectId;
    const item = event.itemId;
    if (z !== 0) return;
    const story = castleStory(player);
    const key = story.newMoon ?? {};
    const inv = player.getInventory();
    if (CASTLE_KEY_OBJECTS.larderSink.has(id) && x === 2356 && y === 7400 && item === CASTLE_KEY_ITEMS.plug) {
      event.handled = true;
      if (key.larderSinkPlugged || !inv.contains(CASTLE_KEY_ITEMS.plug)) { player.sendMessage("The sink is already plugged."); return; }
      inv.deleteNumber(CASTLE_KEY_ITEMS.plug, 1);
      updateCastleKeyStory(player, { larderSinkPlugged: true });
      player.sendMessage("You plug the larder sink.");
      return;
    }
    if (CASTLE_KEY_OBJECTS.larderCabinet.has(id) && x === 2360 && y === 7403 && item === CASTLE_KEY_ITEMS.pipe) {
      event.handled = true;
      if (!key.larderSinkCollapsed || !key.pipeClaimed || !inv.contains(CASTLE_KEY_ITEMS.pipe)) {
        player.sendMessage("You need the broken pipe from the collapsed larder sink."); return;
      }
      if (key.knifeClaimed) { player.sendMessage("You already took the knife from behind the cabinet."); return; }
      if (castleKeyGive(player, CASTLE_KEY_ITEMS.knife, "You use the broken pipe to reach behind the cabinet and take a sharp knife.")) {
        inv.deleteNumber(CASTLE_KEY_ITEMS.pipe, 1);
        updateCastleKeyStory(player, { knifeClaimed: true });
      }
      return;
    }
    if (CASTLE_KEY_OBJECTS.corpse.has(id) && x === 2311 && y === 7417 && item === CASTLE_KEY_ITEMS.knife) {
      event.handled = true;
      if (!key.knifeClaimed || !inv.contains(CASTLE_KEY_ITEMS.knife)) { player.sendMessage("You need the sharp kitchen knife."); return; }
      if (key.corpseOpened) { player.sendMessage("The venator corpse is already open."); return; }
      updateCastleKeyStory(player, { corpseOpened: true });
      player.sendMessage("You cut open the venator corpse with the sharp kitchen knife.");
      return;
    }
    if (CASTLE_KEY_OBJECTS.kitchenSink.has(id) && x === 2308 && y === 7411 && item === CASTLE_KEY_ITEMS.tongs) {
      event.handled = true;
      if (!key.corpseOpened || !key.tongsClaimed) { player.sendMessage("Open the venator corpse and take its tongs first."); return; }
      if (key.needleClaimed) { player.sendMessage("You have already taken the syringe needle."); return; }
      if (castleKeyGive(player, CASTLE_KEY_ITEMS.needle, "You use the tongs to retrieve a syringe needle from the sink.")) {
        updateCastleKeyStory(player, { needleClaimed: true });
      }
      return;
    }
    if (CASTLE_KEY_OBJECTS.kitchenChest.has(id) && x === 2308 && y === 7415 && item === CASTLE_KEY_ITEMS.fullSyringe) {
      event.handled = true;
      if (!inv.contains(CASTLE_KEY_ITEMS.fullSyringe)) return;
      if (key.kitchenChestUnlocked) { player.sendMessage("The kitchen chest is already unlocked."); return; }
      inv.deleteNumber(CASTLE_KEY_ITEMS.fullSyringe, 1);
      updateCastleKeyStory(player, { kitchenChestUnlocked: true });
      player.sendMessage("You use the venator blood to unlock the kitchen chest.");
      return;
    }
    if (CASTLE_KEY_OBJECTS.studyFireplace.has(id) && x === 2358 && y === 7386 && item === CASTLE_KEY_ITEMS.fullCrest) {
      event.handled = true;
      if (!inv.contains(CASTLE_KEY_ITEMS.fullCrest) || key.fullCrestInFireplace) return;
      inv.deleteNumber(CASTLE_KEY_ITEMS.fullCrest, 1);
      updateCastleKeyStory(player, { fullCrestInFireplace: true });
      player.sendMessage("You place the full crest in the study fireplace. Something clicks inside.");
      return;
    }
    const statuePlacements = [
      { id: CASTLE_KEY_LOC_IDS.statue2, x: 2577, y: 7380, item: CASTLE_KEY_ITEMS.axe, slot: 1, name: "battleaxe" },
      { id: CASTLE_KEY_LOC_IDS.statue3, x: 2569, y: 7386, item: CASTLE_KEY_ITEMS.mace, slot: 2, name: "mace" },
      { id: CASTLE_KEY_LOC_IDS.statue4, x: 2569, y: 7380, item: CASTLE_KEY_ITEMS.mace, slot: 3, name: "mace" },
      { id: CASTLE_KEY_LOC_IDS.statue1, x: 2565, y: 7386, item: CASTLE_KEY_ITEMS.sword, slot: 0, name: "sword" },
    ];
    const placement = statuePlacements.find(target => id === target.id && x === target.x && y === target.y && item === target.item);
    if (!placement) return;
    event.handled = true;
    const puzzle = [...(key.weaponPuzzle ?? [false, false, false, false])];
    if (puzzle[placement.slot]) { player.sendMessage("That statue already holds its weapon."); return; }
    if (!inv.contains(item)) return;
    inv.deleteNumber(item, 1);
    puzzle[placement.slot] = true;
    updateCastleKeyStory(player, { weaponPuzzle: puzzle });
    player.sendMessage(`You place the ${placement.name} on the statue.`);
    if (puzzle.every(Boolean)) player.sendMessage("The armoury statues align and the chest unlocks.");
  }

  function handleCastleKeyItemOnItem(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const used = event.usedItemId;
    const withItem = event.usedWithItemId;
    const pair = [used, withItem];
    const inv = player.getInventory();
    const syringeParts = [CASTLE_KEY_ITEMS.barrel, CASTLE_KEY_ITEMS.plunger, CASTLE_KEY_ITEMS.needle];
    if (pair.some(id => syringeParts.includes(id))) {
      event.handled = true;
      for (const id of syringeParts) {
        if (!inv.contains(id)) { player.sendMessage("You need the syringe barrel, plunger and needle together."); return; }
      }
      syringeParts.forEach(id => inv.deleteNumber(id, 1));
      castleKeyGive(player, CASTLE_KEY_ITEMS.emptySyringe, "You assemble the syringe.");
      return;
    }
    if (pair.includes(CASTLE_KEY_ITEMS.emptySyringe) && pair.includes(CASTLE_KEY_ITEMS.stomach)) {
      event.handled = true;
      if (!inv.contains(CASTLE_KEY_ITEMS.emptySyringe) || !inv.contains(CASTLE_KEY_ITEMS.stomach)) return;
      inv.deleteNumber(CASTLE_KEY_ITEMS.emptySyringe, 1);
      inv.deleteNumber(CASTLE_KEY_ITEMS.stomach, 1);
      castleKeyGive(player, CASTLE_KEY_ITEMS.fullSyringe, "You draw blood from the venator stomach into the syringe.");
      return;
    }
    if (pair.includes(CASTLE_KEY_ITEMS.leftCrest) && pair.includes(CASTLE_KEY_ITEMS.rightCrest)) {
      event.handled = true;
      if (!inv.contains(CASTLE_KEY_ITEMS.leftCrest) || !inv.contains(CASTLE_KEY_ITEMS.rightCrest)) return;
      inv.deleteNumber(CASTLE_KEY_ITEMS.leftCrest, 1);
      inv.deleteNumber(CASTLE_KEY_ITEMS.rightCrest, 1);
      castleKeyGive(player, CASTLE_KEY_ITEMS.fullCrest, "You join the two halves into a full crest.");
    }
  }

  function processCastleDialogueTransition({ player }) {
    if (!player || stage(player) !== STAGE.CASTLE) return;
    const pending = player.getAttribute(CASTLE_TRANSITION_PENDING_ATTRIBUTE);
    if (pending !== "free-prisoners" || player.getDialogueManager?.()?.getCurrent?.()) return;
    const story = castleStory(player);
    if (!story.prisonersFound) {
      player.setAttribute(CASTLE_STORY_ATTRIBUTE, { ...story, prisonersFound: true });
      setCastleNativeStage(player, 76);
      syncCastleActors(player);
      syncCastleGibbousKey(player);
    }
    player.setAttribute(CASTLE_TRANSITION_PENDING_ATTRIBUTE, null);
  }

  function handleCastleCellDoor(event) {
    const player = event?.player;
    const tile = event?.location;
    const x = tile?.x ?? tile?.getX?.();
    const y = tile?.y ?? tile?.getY?.();
    const z = tile?.z ?? tile?.getZ?.();
    const id = event?.definition?.id ?? event?.objectId;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE ||
      Number(player.getAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE)) !== 74 ||
      ![61584, 61585].includes(id) || x !== 2570 || y !== 7369 || z !== 0 || event?.option !== "Enter") return;
    event.handled = true;
    if (!hasItem(player, CASTLE_BOOK_ITEMS.newMoonKey)) {
      player.sendMessage("The north cell door needs the new moon key from the castle fireplace.");
      return;
    }
    if (castleStory(player).prisonersFound) return;
    if (!startTranscript(api, player, 0, PAGE, "escape-from-castle-drakan-upon-finding-safalaan-and-vanescula")) {
      event.handled = false;
      return;
    }
    player.setAttribute(CASTLE_TRANSITION_PENDING_ATTRIBUTE, "free-prisoners");
  }

  function handleCastleBookPickup(event) {
    const player = event?.player;
    const tile = event?.location;
    const x = tile?.getX?.() ?? tile?.x;
    const y = tile?.getY?.() ?? tile?.y;
    const z = tile?.getZ?.() ?? tile?.z;
    if (player && event?.groundItemId === CASTLE_BOOK_ITEMS.gibbousMoonKey && stage(player) === STAGE.CASTLE &&
      x === 2573 && y === 7395 && z === 0 && castleStory(player).prisonersFound) {
      const story = castleStory(player);
      player.setAttribute(CASTLE_STORY_ATTRIBUTE, { ...story, gibbousKeyClaimed: true });
      player.sendMessage("You pick up the gibbous moon key from the bench.");
      return;
    }
    if (!player || event?.groundItemId !== CASTLE_BOOK_ITEMS.fullMoonKey || stage(player) !== STAGE.CASTLE ||
      x !== CASTLE_LIBRARY.secretKey[0] || y !== CASTLE_LIBRARY.secretKey[1] ||
      z !== CASTLE_LIBRARY.z || !castleStory(player).bookPuzzleComplete) return;
    const story = castleStory(player);
    player.setAttribute(CASTLE_STORY_ATTRIBUTE, { ...story, fullMoonKeyClaimed: true });
    player.sendMessage("You take the full moon key from the table.");
  }

  function setCastleNativeStage(player, value) {
    player.setAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE, value);
    player.getPacketSender().sendVarbit(15464, value);
  }

  function castleActors(player) {
    let actors = CASTLE_ACTORS.get(player);
    if (!actors) {
      actors = new Map();
      CASTLE_ACTORS.set(player, actors);
    }
    return actors;
  }

  function spawnCastleActor(player, key, id, tile, hostile = false) {
    const actors = castleActors(player);
    const existing = actors.get(key);
    if (existing && existing.getHitpoints?.() > 0) return existing;
    const npc = api.spawnNpc({ id, x: tile[0], y: tile[1], z: tile[2] ?? 0,
      wanderRadius: 0, owner: player, ownerOnly: true });
    if (!npc) return null;
    if (hostile) npc.setMultiCombat?.(true);
    else npc.setScriptedMovement?.(true);
    actors.set(key, npc);
    CASTLE_ACTOR_OWNERS.set(npc, { player, key });
    return npc;
  }

  function removeCastleActor(player, key) {
    const actors = CASTLE_ACTORS.get(player);
    const npc = actors?.get(key);
    if (!npc) return;
    CASTLE_ACTOR_OWNERS.delete(npc);
    api.removeNpc(npc);
    actors.delete(key);
    if (actors.size === 0) CASTLE_ACTORS.delete(player);
  }

  function syncCastleActors(player) {
    if (!player || stage(player) !== STAGE.CASTLE) return;
    const progress = Number(player.getAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE)) || 70;
    const story = castleStory(player);
    if (progress >= 72 && !story.talkedToVeliaf) {
      spawnCastleActor(player, "veliaf-gallery", CASTLE_NPC.VELIAF_GALLERY, [2379, 7367]);
    }
    if (progress >= 72) {
      if (!story.defeated.includes("first-venator"))
        spawnCastleActor(player, "first-venator", CASTLE_NPC.VENATOR_5, [2569, 7384], true);
      if (!story.defeated.includes("crescent-venator"))
        // QH points at the emblem holder in this room; the adjacent floor tile
        // is the nearest collision-clear combat anchor.
        spawnCastleActor(player, "crescent-venator", CASTLE_NPC.VENATOR, [2486, 7420], true);
      if (!story.defeated.includes("kitchen-sanguidae"))
        spawnCastleActor(player, "kitchen-sanguidae", CASTLE_NPC.SANGUIDAE, [2314, 7418], true);
    }
    if (progress >= 76 && story.prisonersFound) {
      // The QH marker is the prison bench; place the freed characters on the
      // open floor directly south of it rather than inside the bench footprint.
      spawnCastleActor(player, "safalaan-prison", CASTLE_NPC.SAFALAAN_PRISON, [2573, 7396]);
      spawnCastleActor(player, "vanescula-prison", CASTLE_NPC.VANESCULA_PRISON, [2571, 7396]);
    }
    if (progress >= 76) {
      if (!story.defeated.includes("library-venator"))
        spawnCastleActor(player, "library-venator", CASTLE_NPC.VENATOR, [2456, 7392], true);
      if (story.defeated.includes("library-venator") && !story.talkedToIvan)
        spawnCastleActor(player, "ivan-library", CASTLE_NPC.IVAN_LIBRARY, [2455, 7389]);
    }
    if (progress >= 78) {
      spawnCastleActor(player, "ivan-entry-hall", CASTLE_NPC.IVAN_ENTRY_HALL, [2313, 7371]);
      spawnCastleActor(player, "veliaf-entry-hall", CASTLE_NPC.VELIAF_ENTRY_HALL, [2313, 7372]);
    }
  }

  function cleanupCastleActors({ player }) {
    const actors = CASTLE_ACTORS.get(player);
    if (!actors) return;
    for (const npc of actors.values()) {
      CASTLE_ACTOR_OWNERS.delete(npc);
      api.removeNpc(npc);
    }
    CASTLE_ACTORS.delete(player);
  }

  function handleCastleNpcDeath(event) {
    const npc = event?.npc;
    const owner = CASTLE_ACTOR_OWNERS.get(npc);
    const player = event?.killer?.isPlayer?.() ? event.killer : null;
    if (!owner || owner.player !== player || stage(player) !== STAGE.CASTLE) return;
    const story = castleStory(player);
    if (["first-venator", "crescent-venator", "library-venator"].includes(owner.key)) {
      const defeated = [...new Set([...story.defeated, owner.key])];
      player.setAttribute(CASTLE_STORY_ATTRIBUTE, { ...story, defeated });
      removeCastleActor(player, owner.key);
      if (owner.key === "library-venator") syncCastleActors(player);
    } else if (owner.key === "kitchen-sanguidae") {
      player.setAttribute(CASTLE_STORY_ATTRIBUTE, { ...story,
        defeated: [...new Set([...story.defeated, owner.key])] });
      removeCastleActor(player, owner.key);
      syncCastleSyringeBarrel(player);
    }
  }

  function talkCastleNpc(event, npcName) {
    const player = event?.player;
    const npc = event?.npc;
    if (!player || !npc || stage(player) !== STAGE.CASTLE || !CASTLE_ACTOR_OWNERS.has(npc)) return false;
    const owner = CASTLE_ACTOR_OWNERS.get(npc);
    if (owner.player !== player) return false;
    const progress = Number(player.getAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE)) || 70;
    const story = castleStory(player);
    let variant = null;
    let transition = null;
    if (npcName === "veliaf hurtz" && owner.key === "veliaf-gallery") {
      if (!player.getAttribute(GALLERY_CHEST_ATTRIBUTE)?.key) {
        player.sendMessage("The emblem-gallery chest is still locked.");
        event.handled = true;
        return true;
      }
      variant = story.talkedToVeliaf
        ? "escape-from-castle-drakan-talking-to-veliaf-again"
        : "escape-from-castle-drakan-finding-veliaf";
      if (!story.talkedToVeliaf) transition = () => {
        player.setAttribute(CASTLE_STORY_ATTRIBUTE, { ...story, talkedToVeliaf: true });
        setCastleNativeStage(player, 74);
        syncCastleActors(player);
      };
    } else if ((npcName === "safalaan hallow" && owner.key === "safalaan-prison") ||
      (npcName === "vanescula drakan" && owner.key === "vanescula-prison")) {
      if (progress < 76 || !story.prisonersFound) return false;
      variant = "escape-from-castle-drakan-upon-finding-safalaan-and-vanescula";
    } else if (npcName === "ivan strom" && owner.key === "ivan-library") {
      if (!story.defeated.includes("library-venator")) {
        player.sendMessage("The venator is still guarding Ivan.");
        event.handled = true;
        return true;
      }
      variant = story.bookPuzzleComplete
        ? "escape-from-castle-drakan-talking-to-ivan-again-after-solving-the-bookshelf-puzzle"
        : story.talkedToIvan
          ? "escape-from-castle-drakan-talking-to-ivan-again"
          : "escape-from-castle-drakan-talking-to-ivan-after-defeating-the-venator";
      if (!story.talkedToIvan) transition = () => {
        player.setAttribute(CASTLE_STORY_ATTRIBUTE, { ...story, talkedToIvan: true });
        setCastleNativeStage(player, 78);
        removeCastleActor(player, "ivan-library");
        syncCastleActors(player);
      };
    }
    if (!variant) return false;
    const started = startTranscript(api, player, event.npcId, PAGE, variant);
    if (!started) return false;
    event.handled = true;
    transition?.();
    return true;
  }

  function addCastleMedallionDestination(event) {
    const player = event?.player;
    if (!player || !Array.isArray(event.destinations) ||
      stage(player) < STAGE.SLEPE || stage(player) > STAGE.CASTLE ||
      !slepeStory(player).refineryComplete || !player.getAttribute(CASTLE_SHRINE_ATTRIBUTE)) return;
    event.destinations.push({
      label: "Castle Drakan.",
      tile: CASTLE_TELEPORT_TILE,
    });
  }

  function enterVampyriumPortal(event) {
    const player = event?.player;
    const id = event?.definition?.id ?? event?.objectId;
    const tile = event?.location;
    const x = tile?.x ?? tile?.getX?.();
    const y = tile?.y ?? tile?.getY?.();
    const z = tile?.z ?? tile?.getZ?.();
    const currentStage = player && stage(player);
    if (!player || quest.isComplete(player) || currentStage < STAGE.SLEPE || currentStage > STAGE.CASTLE ||
      !slepeStory(player).refineryComplete || !player.getAttribute(CASTLE_SHRINE_ATTRIBUTE) ||
      id !== CASTLE_VAMPYRIUM_ENTRY.id || x !== CASTLE_VAMPYRIUM_ENTRY.x ||
      y !== CASTLE_VAMPYRIUM_ENTRY.y || z !== CASTLE_VAMPYRIUM_ENTRY.z || event.option !== "Enter") return false;
    event.handled = true;
    if (currentStage === STAGE.SLEPE) {
      advance(player, STAGE.CASTLE);
      player.setAttribute(CASTLE_ROOM_ATTRIBUTE, CASTLE_ROOM.LOBBY);
      player.setAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE, 70);
      syncCastleRoom(player);
      startTranscript(api, player, 0, PAGE, "escape-from-castle-drakan-entering-the-portal",
        steps => steps.filter(step => step.type !== "unavailable"));
    } else if (currentStage === STAGE.CASTLE &&
      (Number(player.getAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE)) || 70) === 70) {
      startTranscript(api, player, 0, PAGE, "escape-from-castle-drakan-entering-the-portal",
        steps => steps.filter(step => step.type !== "unavailable"));
    } else if (currentStage === STAGE.CASTLE) {
      player.moveTo(new Location(CASTLE_VAMPYRIUM_ARRIVAL.x, CASTLE_VAMPYRIUM_ARRIVAL.y,
        CASTLE_VAMPYRIUM_ARRIVAL.z));
      player.setAttribute(CASTLE_ROOM_ATTRIBUTE, CASTLE_ROOM.LOBBY);
      syncCastleRoom(player);
    }
    return true;
  }

  function tryCastleReturnPortal(event) {
    const player = event?.player;
    const id = event?.definition?.id ?? event?.objectId;
    const tile = event?.location;
    const x = tile?.x ?? tile?.getX?.();
    const y = tile?.y ?? tile?.getY?.();
    const z = tile?.z ?? tile?.getZ?.();
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE ||
      id !== CASTLE_VAMPYRIUM_RETURN.id || x !== CASTLE_VAMPYRIUM_RETURN.x ||
      y !== CASTLE_VAMPYRIUM_RETURN.y || z !== CASTLE_VAMPYRIUM_RETURN.z || event.option !== "Enter" ||
      (Number(player.getAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE)) || 70) !== 80) return false;
    const started = startTranscript(api, player, 0, PAGE,
      "escape-from-castle-drakan-attempting-to-head-back-to-the-foyer");
    if (!started) return false;
    event.handled = true;
    return true;
  }

  // Transcript cutscenes mark the major route changes. The separate object,
  // puzzle and boss handlers below remain responsible for the actual mechanics.
  function onTranscriptAction(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player)) return;
    if (event.stepId === "ikSyAR" && stage(player) === STAGE.CASTLE) {
      player.moveTo(new Location(CASTLE_VAMPYRIUM_ARRIVAL.x, CASTLE_VAMPYRIUM_ARRIVAL.y,
        CASTLE_VAMPYRIUM_ARRIVAL.z));
      player.setAttribute(CASTLE_ROOM_ATTRIBUTE, CASTLE_ROOM.LOBBY);
      syncCastleRoom(player);
      setCastleNativeStage(player, 72);
      syncCastleActors(player);
    }
    if (event.stepId === "LTAe0k" && stage(player) === STAGE.CASTLE) {
      const refiner = player.getAttribute(REFINER_ATTRIBUTE) ?? {};
      if (!refiner.destroyed) {
        event.handled = true;
        player.sendMessage("Destroy the blood stockpile before trying to leave Castle Drakan.");
        return;
      }
      const story = castleStory(player);
      player.setAttribute(CASTLE_STORY_ATTRIBUTE, { ...story, stockpileDestroyed: true });
      setCastleNativeStage(player, 80);
    }
    if (event.stepId === "RkdJSc" && stage(player) === STAGE.CASTLE) {
      const loc = player.getLocation();
      spawnCastleActor(player, "stockpile-venator", CASTLE_NPC.VENATOR,
        [loc.getX() + 1, loc.getY(), loc.getZ()], true);
    }
    if (event.stepId === "iutH3M" && stage(player) === STAGE.CASTLE) {
      removeCastleActor(player, "stockpile-venator");
      const loc = player.getLocation();
      spawnCastleActor(player, "vanescula-escape", CASTLE_NPC.VANESCULA_CASTLE,
        [loc.getX() + 1, loc.getY(), loc.getZ()]);
    }
    if (event.stepId === "ERoU4N" && stage(player) === STAGE.CASTLE) {
      removeCastleActor(player, "ivan-library");
      removeCastleActor(player, "veliaf-gallery");
      const loc = player.getLocation();
      spawnCastleActor(player, "ivan-escape", CASTLE_NPC.IVAN_ENTRY_HALL,
        [loc.getX() - 1, loc.getY(), loc.getZ()]);
      spawnCastleActor(player, "veliaf-escape", CASTLE_NPC.VELIAF_ENTRY_HALL,
        [loc.getX() + 1, loc.getY(), loc.getZ()]);
    }
    if (event.stepId === "KaZlum" && stage(player) === STAGE.CASTLE) {
      const loc = player.getLocation();
      spawnCastleActor(player, "lowerniel-cutscene", CASTLE_NPC.LOWERNIEL_CUTSCENE_NO_WING,
        [loc.getX() + 2, loc.getY(), loc.getZ()]);
    }
    if (event.stepId === "pvorJI" && stage(player) === STAGE.CASTLE) {
      setCastleNativeStage(player, 82);
    }
    if (event.stepId === "UgyYUc" && stage(player) === STAGE.SLEPE &&
      player.getAttribute(SLEPE_STORY_ATTRIBUTE)?.manorComplete) {
      const inventory = player.getInventory();
      if (inventory.getFreeSlots() <= 0 || !inventory.adds(ItemIdentifiers.SQUIRES_JOURNAL, 1)) {
        event.handled = true;
        player.sendMessage("Make room for the squire's journal before taking it.");
        return;
      }
      event.handled = true;
      event.box = { items: [ItemIdentifiers.SQUIRES_JOURNAL] };
      player.setAttribute(SLEPE_STORY_ATTRIBUTE,
        { ...player.getAttribute(SLEPE_STORY_ATTRIBUTE), journalGiven: true });
      return;
    }
    if (event.stepId === "OW0EIY" && stage(player) === STAGE.SLEPE &&
      player.getAttribute(SLEPE_STORY_ATTRIBUTE)?.booksPlaced) {
      const inventory = player.getInventory();
      if (inventory.getFreeSlots() <= 0 || !inventory.adds(ItemIdentifiers.IVANDIS_WRITINGS, 1)) {
        event.handled = true;
        player.sendMessage("Make room in your inventory for Ivandis' writings.");
        return;
      }
      event.handled = true;
      event.box = { items: [ItemIdentifiers.IVANDIS_WRITINGS] };
      player.setAttribute(SLEPE_STORY_ATTRIBUTE,
        { ...player.getAttribute(SLEPE_STORY_ATTRIBUTE), writingsGiven: true });
      return;
    }
    if (event.stepId === "y37Yph" && stage(player) === STAGE.SLEPE &&
      player.getAttribute(SLEPE_STORY_ATTRIBUTE)?.tombRouteStarted) {
      // The Wiki gives no exact landing tile; this walkable tile is beside the cache blockage.
      player.moveTo(new Location(3507, 9860, 0));
      return;
    }
    if (event.stepId === "fiqzZ7" && !player.getAttribute(HIDEOUT_DEFENSE_COMPLETE)) {
      player.sendMessage("Keep the vyrewatch away from Ivan and let him complete the spell before escaping.");
      return;
    }
    const next = ACTION_STAGE[event.stepId];
    if (event.stepId === "vqg4qO") {
      if (stage(player) !== STAGE.SIEGE || !bridge.finish(player)) return;
      player.setAttribute(SIEGE_DEFENCE_ATTRIBUTE, { phase: "hall", integrity: 100, healed: [], repaired: [] });
      quest.setStage(player, STAGE.SIEGE);
      hall.enter(player);
      spawnSiegeInjuredAranei(player);
    }
    if (event.stepId === "Sut83Q") {
      const prep = player.getAttribute(PREP_ATTRIBUTE) ?? {};
      if (!prep.flail || !prep.stakes) {
        player.sendMessage("Before the siege, finish the hallowed flail and cut blisterwood stakes for the defence.");
        return;
      }
      player.setAttribute(PREP_COMPLETE, true);
      advance(player, STAGE.SIEGE);
      bridge.start(player);
    }
    if (event.stepId === "XqVfhB" && !player.getAttribute(THRONE_PUZZLE_ATTRIBUTE)?.keyClaimed) {
      player.sendMessage("Solve the throne-room bust puzzle and take the half moon key before leaving the castle.");
      return;
    }
    if (event.stepId === "XqVfhB" && stage(player) === STAGE.CASTLE &&
      !player.getAttribute(REFINER_ATTRIBUTE)?.destroyed) {
      player.sendMessage("Destroy the blood stockpile before leaving Castle Drakan.");
      return;
    }
    if (next) advance(player, next);
    if (event.stepId === "XqVfhB" && stage(player) === STAGE.ESCAPE) {
      cleanupCastleActors({ player });
    }
    if (event.stepId === "4G5OZg") startWyrdBattle(player);
    if (event.stepId === "t7FMNM") startDrakanBattle(player);
    if (event.stepId === "4ebW6l" || event.stepId === "BzMe5D") finishDrakanEncounter(player);
    if (event.stepId === "Xz7d4O") startSiegeDrakanBattle(player);
    if (event.stepId === "zPiZ9c") finishSiegeDrakanBattle(player);
    if (event.stepId === "1Z5SGt" && stage(player) === STAGE.THEATRE &&
      !player.getAttribute(TOB_CHALLENGE_ATTRIBUTE)?.started) {
      player.setAttribute(TOB_CHALLENGE_ATTRIBUTE, { started: true, completed: false });
      api.emitCustomEvent("tob:bmr-start", { player });
    }
    if (event.stepId === "dJZbqF") {
      const area = player.getAttribute(WYRD_AREA_ATTRIBUTE);
      const encounter = area && wyrdEncounters.get(area);
      if (encounter) {
        encounter.finished = true;
        api.removeNpc(encounter.boss);
        area.leave(player, false);
      }
      player.setAttribute(WYRD_AREA_ATTRIBUTE, null);
      player.setAttribute(WYRD_DEFEATED_ATTRIBUTE, true);
      advance(player, STAGE.WYRD_DEFEATED);
      player.moveTo(new Location(3562, 3323, 0));
    }
    if (event.stepId === "xt3dPV") advance(player, STAGE.FENCE_FOUND);
    if (event.stepId === "2QgFZA" && player.getAttribute(WYRD_DEFEATED_ATTRIBUTE)) advance(player, STAGE.FINAL);
    if (event.stepId === "BzMe5D" && stage(player) === STAGE.FINAL
      && player.getAttribute(DRAKAN_ENCOUNTER_COMPLETE)) quest.complete(player);
  }

  function onBloodMoonTobCompleted(event) {
    const player = event?.player;
    const challenge = player?.getAttribute(TOB_CHALLENGE_ATTRIBUTE);
    if (!player || stage(player) !== STAGE.THEATRE || !challenge?.started || challenge.completed) return;
    player.setAttribute(TOB_CHALLENGE_ATTRIBUTE, { ...challenge, completed: true });
    advance(player, STAGE.WYRDS);
    startTranscript(api, player, NpcIdentifiers.SUGADINTI_VITUR_6, PAGE,
      "another-night-at-the-theatre-after-killing-the-nylocas-vasilias");
  }

  function onRefineryCompleted(event) {
    const player = event?.player;
    const story = slepeStory(player);
    if (!player || stage(player) !== STAGE.SLEPE || !story.tombRouteStarted || story.refineryComplete) return;
    player.setAttribute(SLEPE_STORY_ATTRIBUTE, { ...story, refineryComplete: true });
    player.sendMessage("The tunnel through the refinery is clear. Return to the passage into Castle Drakan.");
  }

  function onChoice(event) {
    if (!event?.player) return;
    const player = event.player;
    if (event.option === "Lead the way." && stage(player) === STAGE.SLEPE &&
      player.getAttribute(SLEPE_STORY_ATTRIBUTE)?.writingsRead) {
      const story = player.getAttribute(SLEPE_STORY_ATTRIBUTE) ?? {};
      player.setAttribute(SLEPE_STORY_ATTRIBUTE, { ...story, tombRouteStarted: true });
      api.emitCustomEvent("bmr:refinery-start", { player });
      return;
    }
    if (event.option === "Yes." && stage(player) === STAGE.NOT_STARTED &&
      event.definition?.getName?.() === "Sarius Guile" && meetsRequirements(player)) {
      advance(player, STAGE.STARTED);
    } else if (event.option === "I'm ready." && stage(player) === STAGE.STARTED &&
      player.getAttribute(HIDEOUT_SHRINE_INSPECTED) && hideoutOutfitWorn(player)) {
      advance(player, STAGE.HIDEOUT);
    }
  }

  function startHideoutDeparture(player) {
    if (stage(player) !== STAGE.HIDEOUT) return false;
    if (!hideoutOutfitWorn(player)) {
      player.sendMessage("Wear the vyre noble outfit before leaving for Castle Drakan.");
      return false;
    }
    if (!hideoutDefense.prepare(player)) return false;
    return startTranscript(api, player, NpcIdentifiers.IVAN_STROM_13, PAGE, "starting-out-lowerniel-s-speech");
  }

  function onBloodMoonDialogueLine(request) {
    const player = request?.player;
    if (!player || stage(player) !== STAGE.HIDEOUT) return;
    if (request.step?.speaker === "Ivan Strom" && request.text === "Alright... To Darkmeyer then.") {
      request.after = () => startHideoutDeparture(player);
      return;
    }
    if (request.step?.speaker === "Lowerniel Drakan" &&
      request.text === "As a starting point, you may wish to deal with the two humans that stand among you, unless of course you've all become so weak that you can't even do that anymore...") {
      request.after = () => hideoutDefense.start(player);
    }
  }

  function onSlepeDialogueLine(request) {
    const player = request?.player;
    if (!player || stage(player) !== STAGE.SLEPE) return;
    if (request.step?.player && request.text === "Sounds like a plan! Let's do it!") {
      request.after = () => player.setAttribute(SLEPE_STORY_ATTRIBUTE,
        { ...slepeStory(player), monksRequested: true });
      return;
    }
    if (request.step?.speaker === "Ivan Strom" && request.text === "Sounds good.") {
      request.after = () => player.setAttribute(SLEPE_STORY_ATTRIBUTE,
        { ...slepeStory(player), upstairsTalked: true });
      return;
    }
    if (request.step?.speaker === "Ivan Strom" &&
      ["I'm right behind you.", "The truth is that I don't think I'll know until we do, so we may as well get to it."].includes(request.text)) {
      request.after = () => {
        player.setAttribute(SLEPE_STORY_ATTRIBUTE, { ...(player.getAttribute(SLEPE_STORY_ATTRIBUTE) ?? {}), ivanFollowing: true });
        syncSlepeIvan({ player });
      };
    } else if (request.step?.speaker === "Roy" &&
      request.text === "That, I do not. However, I did hear that there was some commotion up at Crombwick Manor soon afterwards.") {
      request.after = () => player.setAttribute(SLEPE_STORY_ATTRIBUTE,
        { ...(player.getAttribute(SLEPE_STORY_ATTRIBUTE) ?? {}), royClue: true });
    } else if (request.text?.includes("Now, I'd better get to Paterdomus.") &&
      (request.step?.player || request.step?.speaker === "Veliaf Hurtz")) {
      request.after = () => {
        player.setAttribute(SLEPE_STORY_ATTRIBUTE,
          { ...(player.getAttribute(SLEPE_STORY_ATTRIBUTE) ?? {}), manorComplete: true });
        cleanupSlepeManor({ player });
      };
    }
  }

  function resumeHideoutEscape({ player }) {
    if (!player || stage(player) !== STAGE.HIDEOUT || !player.getAttribute(HIDEOUT_DEFENSE_COMPLETE)) return;
    if (player.getDialogueManager?.()?.getCurrent?.()) return;
    startTranscript(api, player, NpcIdentifiers.IVAN_STROM_13, PAGE, "starting-out-escaping-the-vampyres");
  }

  function claimNightLamps(player) {
    const request = { player, handled: false };
    api.emitCustomEvent("night-at-the-theatre:claim-lamps", request);
    if (!request.handled) player.sendMessage("There are no unused Hallowed lamps to reclaim.");
  }

  function talkQuestNpc(event) {
    const player = event?.player;
    if (!player) return false;
    const npcName = String(event.definition?.getName?.() ?? "").toLowerCase();
    if (stage(player) === STAGE.CASTLE) {
      const started = talkCastleNpc(event, npcName);
      if (started) return true;
    }
    // Night at the Theatre owns this same Stranger until its story is complete.
    // Once Night is done, preserve its lamp reclaim service while Blood Moon is active.
    if (npcName === "mysterious stranger") {
      if (!hasQuest(player, "a_night_at_the_theatre")) return false;
      api.sendMultiChatboxPrompt(player, "What would you like to do?",
        "Claim unused Hallowed lamps", () => claimNightLamps(player),
        "I'm off", () => {});
      event.handled = true;
      return true;
    }
    if (quest.isComplete(player)) return false;
    if (stage(player) === STAGE.HIDEOUT && npcName === "ivan strom") {
      event.handled = true;
      api.sendMultiChatboxPrompt(player, "Are you ready to go to Darkmeyer?",
        "I'm ready.", () => startHideoutDeparture(player),
        "I need more time to prepare.", () => {});
      return true;
    }
    // The Sins of the Father reclaim dialogue also belongs to Ivan in this
    // hideout. SLEPE's later story variant is only relevant at its own scene;
    // let the completed Sins transcript win here instead of hijacking Talk-to.
    if (stage(player) === STAGE.SLEPE && npcName === "ivan strom" &&
      isAtSinsMedallionHideout(event)) {
      return false;
    }
    if (stage(player) === STAGE.SLEPE) {
      const story = player.getAttribute(SLEPE_STORY_ATTRIBUTE) ?? {};
      let variant = null;
      if (npcName === "ivan strom") {
        if (story.monksCleared) {
          variant = !story.upstairsTalked
            ? "the-truth-hurtz-talking-to-ivan-upstairs"
            : story.booksPlaced
              ? story.writingsRead
                ? "the-truth-hurtz-talking-to-ivan-after-reading-ivandis-writings"
                : "the-truth-hurtz-talking-to-ivan-after-solving-the-book-puzzle"
              : "the-truth-hurtz-talking-to-ivan-again-3";
        } else if (story.manorComplete) {
          variant = story.journalRead
            ? "the-truth-hurtz-talking-to-ivan-and-drezel-after-reading-the-journal"
            : story.journalGiven
              ? "the-truth-hurtz-talking-to-ivan-or-drezel-again-before-reading-the-journal"
              : "the-truth-hurtz-talking-to-ivan-and-drezel-in-the-mausoleum";
        } else if (story.royClue) {
          variant = "the-truth-hurtz-talking-to-ivan-again";
        } else {
          variant = story.ivanFollowing
            ? "the-truth-hurtz-talking-to-ivan-while-he-is-following-the-player"
            : "the-truth-hurtz-talking-to-ivan-in-slepe";
        }
      } else if (npcName === "roy") {
        if (!story.ivanFollowing) {
          player.sendMessage("I should find Ivan by the church and bring him to the pub.");
          event.handled = true;
          return true;
        }
        variant = story.royClue
          ? "the-truth-hurtz-talking-to-roy-talking-to-roy-again"
          : "the-truth-hurtz-talking-to-roy";
      } else if (npcName === "veliaf hurtz") {
        if (story.manorEnemiesDefeated) variant = "the-truth-hurtz-talking-to-veliaf-inside-crombwick-manor";
        else if (story.manorComplete) variant = "the-truth-hurtz-talking-to-veliaf-again";
        else {
          player.sendMessage("The Vyrewatch are still fighting in the manor.");
          event.handled = true;
          return true;
        }
      } else if (npcName === "drezel") {
        if (!story.manorComplete) return false;
        variant = story.journalRead
          ? "the-truth-hurtz-talking-to-ivan-and-drezel-after-reading-the-journal"
          : story.journalGiven
            ? "the-truth-hurtz-talking-to-ivan-or-drezel-again-before-reading-the-journal"
            : "the-truth-hurtz-talking-to-ivan-and-drezel-in-the-mausoleum";
      }
      if (variant) {
        event.handled = true;
        const started = startTranscript(api, player, event.npcId, PAGE, variant);
        return started;
      }
    }
    if (stage(player) === STAGE.NOT_STARTED) {
      if (npcName !== "sarius guile") return false;
      if (!meetsRequirements(player)) { explainRequirements(player); return true; }
      return startTranscript(api, player, event.npcId, PAGE, "starting-out");
    }
    const chapter = currentChapter(stage(player));
    const alias = ({ "king roald": "king-roald", "the nylocas queen": "nylocas-queen" })[npcName] ?? npcName.replace(/[^a-z0-9]+/g, "-");
    const variants = Object.keys(loadTranscripts(api)[PAGE]?.variants ?? {});
    const candidates = variants.filter((variant) => variant.startsWith(`${chapter}-`) && variant.includes(alias));
    const selected = candidates.find((variant) => variant.includes("talking-to") && !variant.includes("again")) ??
      candidates.find((variant) => variant.includes("talking-to")) ?? candidates[0];
    return selected ? startTranscript(api, player, event.npcId, PAGE, selected) : false;
  }

  function buildJournal(player) {
    if (quest.isComplete(player)) return ["The confrontation at the blood moon is over.", "The Myreque have survived the battle and must regroup."];
    const value = stage(player);
    if (value >= STAGE.FINAL) return ["The Myreque have set out for Castle Drakan.", "I must follow them and stop Lowerniel Drakan."];
    if (value >= STAGE.FENCE_FOUND) return ["Safalaan escaped toward Castle Drakan.", "I should join the Myreque in Burgh de Rott and prepare to pursue him."];
    if (value >= STAGE.WYRD_DEFEATED) return ["The Wyrd knocked me unconscious and fled north.", "I should inspect the broken fence beyond Barrows and follow Safalaan's trail."];
    if (value >= STAGE.THEATRE) return ["Safalaan is becoming a wyrd.", "I must help Veliaf defeat him before he loses himself."];
    if (value >= STAGE.SIEGE) return ["The aranei hideout is under attack.", "I must help defend the bridge and protect the portal."];
    if (value >= STAGE.PREPARATIONS) return ["Sugadinti's followers are preparing to face Lowerniel.", "I should speak to Veliaf when I am ready."];
    if (value >= STAGE.BLOOD_HUNT) return ["I have escaped into Vampyrium.", "I must find the group and survive the hunt."];
    if (value >= STAGE.ESCAPE) return ["I am fleeing Castle Drakan with the others.", "I must escape the vampyres and get clear of the castle."];
    if (value >= STAGE.CASTLE) return ["I am trapped inside Castle Drakan.", "I must find the others and escape."];
    if (value >= STAGE.SLEPE) return ["I need to investigate the events in Slepe and Castle Drakan.", "I should follow Ivan's leads."];
    if (value >= STAGE.HIDEOUT) return ["Ivan has agreed to help me reach Castle Drakan.", "I should make sure we are both disguised before we leave."];
    return ["Sarius Guile told me Lowerniel Drakan has taken Safalaan.", "I should find Ivan in the Myreque hideout."];
  }

  function readTome({ player, itemId, item, slot }) {
    if (itemId !== TOME_ID || !quest.isComplete(player) || player.getInventory().get(slot) !== item) return false;
    if ((Number(player.getAttribute(ATTRIBUTE)) || 0) >= 6) return true;
    api.emitCustomEvent("xpreward:open", {
      player,
      minLevel: 70,
      title: "Choose the stat you wish to be advanced!",
      onConfirm: (skill, name) => {
        if (player.getInventory().get(slot) !== item) return null;
        const used = (Number(player.getAttribute(ATTRIBUTE)) || 0) + 1;
        player.setAttribute(ATTRIBUTE, used);
        if (used >= 6) player.getInventory().deleteAtSlot(slot, 1);
        player.getSkillManager().addExperience(skill, 30000, false);
        return `You have been awarded 30,000 ${name} XP!`;
      },
    });
    return true;
  }

  function hasItem(player, itemId) {
    return player.getInventory().contains(itemId) || player.getEquipment?.().contains?.(itemId) === true;
  }

  function giveInventoryItem(player, itemId, fullMessage = "Make room in your inventory before taking that item.") {
    const inventory = player.getInventory();
    if (inventory.contains(itemId)) return true;
    if (typeof inventory.getFreeSlots === "function" && inventory.getFreeSlots() <= 0) {
      player.sendMessage(fullMessage);
      return false;
    }
    inventory.adds(itemId, 1);
    return true;
  }

  function hasBankedItem(player, itemId) {
    for (let tab = 0; tab < 11; tab++) {
      if (player.getBank?.(tab)?.contains?.(itemId)) return true;
    }
    return false;
  }

  function replaceItems(player, required, removed, added) {
    const inventory = player.getInventory();
    if (!required.every((itemId) => inventory.contains(itemId))) return false;
    for (const itemId of removed) inventory.deleteNumber(itemId, 1);
    for (const [itemId, amount] of added) inventory.adds(itemId, amount);
    return true;
  }

  function prepAction(player, variant, npcId = 0) {
    return startTranscript(api, player, npcId, PAGE, variant);
  }

  function prepObjectAt(event, x, y, z) {
    const tile = event?.location;
    return tile?.x === x && tile?.y === y && tile?.z === z;
  }

  function syncThroneBustVarbits(player) {
    if (!player || stage(player) < STAGE.CASTLE || stage(player) > STAGE.ESCAPE) return;
    const state = player.getAttribute(THRONE_PUZZLE_ATTRIBUTE) ?? {};
    THRONE_BUST_VARBITS.forEach((varbit, index) => {
      // The cache keeps each bust inert until the throne reveals the levers. The
      // first/second transformed children are the two lever positions.
      const value = state.started ? (state.pulled?.[index] ? 2 : 1) : 0;
      player.getPacketSender().sendVarbit(varbit, value);
    });
  }

  function syncThroneBustsOnLogin({ player }) {
    syncThroneBustVarbits(player);
  }

  function handleCastleDoorEnter(event) {
    const player = event?.player;
    const { x, y, z } = event?.location ?? {};
    const currentStage = player && stage(player);
    const name = event?.definition?.getName?.();
    const visibleId = event?.definition?.id ?? event?.objectId;
    if (!player || quest.isComplete(player) || currentStage < STAGE.CASTLE || currentStage > STAGE.ESCAPE ||
      !["Enter", "Climb-up", "Climb-down"].includes(event.option) ||
      (!CASTLE_DOOR_NAMES.includes(name) && !CASTLE_DOOR_TRANSITIONS.some(door => door.id === visibleId &&
        door.x === x && door.y === y && (door.z ?? 0) === z)) ||
      x < 2300 || x > 2600 || y < 7300 || y > 7440) return;
    const moonDoorKey = CASTLE_MOON_DOOR_KEYS.get(visibleId);
    if (moonDoorKey && !hasItem(player, moonDoorKey[0])) {
      event.handled = true;
      player.sendMessage(`The door is locked. You need the ${moonDoorKey[1]}.`);
      return;
    }
    const transition = CASTLE_DOOR_TRANSITIONS.find(door => door.id === visibleId && door.x === x && door.y === y &&
      (door.z ?? 0) === z &&
      (door.action ?? "Enter") === event.option);
    if (transition) {
      const currentRoom = Number(player.getAttribute(CASTLE_ROOM_ATTRIBUTE)) || CASTLE_ROOM.LOBBY;
      const currentFloor = Number(player.getAttribute(CASTLE_FLOOR_ATTRIBUTE)) || CASTLE_GROUND_FLOOR;
      if (transition.key && !hasItem(player, transition.key)) {
        event.handled = true;
        player.sendMessage(`The door is locked. You need the ${transition.keyName}.`);
        return;
      }
      if (transition.anyKey && !transition.anyKey.some(itemId => hasItem(player, itemId))) {
        event.handled = true;
        player.sendMessage(`The door is locked. You need ${transition.keyName}.`);
        return;
      }
      if (currentRoom !== transition.from || currentFloor !== (transition.fromFloor ?? CASTLE_GROUND_FLOOR)) {
        player.sendMessage("That doorway does not lead onward from this part of the castle.");
        event.handled = true;
        return;
      }
      event.handled = true;
      player.setAttribute(CASTLE_ROOM_ATTRIBUTE, transition.to);
      player.setAttribute(CASTLE_FLOOR_ATTRIBUTE, transition.toFloor ?? CASTLE_GROUND_FLOOR);
      syncCastleRoom(player);
      player.moveTo(new Location(transition.landing[0], transition.landing[1], transition.landing[2] ?? 0));
      return;
    }
    if (name !== "Door") return;
    const door = event.object;
    const face = door?.getFace?.();
    if (!Number.isInteger(face)) return;
    const axis = (face & 1) === 0 ? "x" : "y";
    const source = event.sourceLocation ?? {
      x: player.getLocation().getX(), y: player.getLocation().getY(), z: player.getLocation().getZ(),
    };
    const side = Math.sign(source[axis] - event.location[axis]) || (face === 0 || face === 3 ? 1 : -1);
    const privateArea = player.getPrivateArea?.() ?? null;
    let destination = null;
    // Castle doors sit in thick walls; the first tile beyond the clickable loc
    // can still be clipped by the wall. Walk the same line until clear floor.
    for (let distance = 1; distance <= 8; distance++) {
      const across = event.location[axis] - side * distance;
      const candidate = axis === "x"
        ? new Location(across, source.y, z)
        : new Location(source.x, across, z);
      if (!api.core.RegionManager.blocked(candidate, privateArea)) {
        destination = candidate;
        break;
      }
    }
    if (!destination) return;
    event.handled = true;
    player.moveTo(destination);
  }

  function handleCastleBookObjects(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const tile = event?.location;
    const x = tile?.x ?? tile?.getX?.();
    const y = tile?.y ?? tile?.getY?.();
    const z = tile?.z ?? tile?.getZ?.();
    if (z !== CASTLE_LIBRARY.z) return;
    const id = event?.definition?.id ?? event?.objectId;
    const option = String(event?.option ?? "");
    const name = String(event?.definition?.getName?.() ?? "").toLowerCase();
    const story = castleStory(player);
    const progress = Number(player.getAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE)) || 70;
    if ([61615, 61616, 61617, 61618].includes(id) && x === CASTLE_LIBRARY.passage[0] &&
      y === CASTLE_LIBRARY.passage[1] && option === "Enter") {
      if (!story.bookPuzzleComplete) {
        event.handled = true;
        player.sendMessage("The hidden passage remains sealed until you arrange the Vampyric Houses alphabetically.");
        return;
      }
      syncCastleBookKey(player);
      return;
    }
    const puzzle = bookPuzzleState(player);
    if (CASTLE_GILDED_BOOKCASE_IDS.has(id) && x === CASTLE_LIBRARY.westernBookcase[0] &&
      y === CASTLE_LIBRARY.westernBookcase[1] && option === "Search" && puzzle.prepared && !puzzle.solved) {
      event.handled = true;
      startCastleBookPuzzlePrompt(player);
      return;
    }
    const gildedShelf = id === 61756 && x === CASTLE_LIBRARY.gildedBookcase[0] && y === CASTLE_LIBRARY.gildedBookcase[1];
    const vampyreShelf = id === 61757 && x === CASTLE_LIBRARY.vampyreBookcase[0] && y === CASTLE_LIBRARY.vampyreBookcase[1];
    if (option !== "Search" || !/bookcase|bookshelf/.test(name) || (!gildedShelf && !vampyreShelf) ||
      progress < 78 || !story.talkedToIvan || !story.defeated.includes("library-venator")) return;
    event.handled = true;
    const inventory = player.getInventory();
    if (gildedShelf) {
      if (inventory.contains(CASTLE_BOOK_ITEMS.gilded)) {
        player.sendMessage("You already have the gilded book from this shelf.");
        return;
      }
      if (inventory.getFreeSlots() <= 0 || !inventory.adds(CASTLE_BOOK_ITEMS.gilded, 1)) {
        player.sendMessage("Make room in your inventory before taking the gilded book.");
        return;
      }
      player.sendMessage("You search the northern bookcase and take a gilded book.");
      return;
    }
    if (inventory.contains(CASTLE_BOOK_ITEMS.vampyre)) {
      player.sendMessage("You have already taken a book about the Vampyric Houses from this shelf.");
      return;
    }
    if (inventory.getFreeSlots() <= 0 || !inventory.adds(CASTLE_BOOK_ITEMS.vampyre, 1)) {
      player.sendMessage("Make room in your inventory before taking the book.");
      return;
    }
    player.sendMessage("You search the south-eastern bookcase and take a book about the Vampyric Houses.");
  }

  function handleCastleBookOnObject(event) {
    const player = event?.player;
    const tile = event?.location;
    const x = tile?.x ?? tile?.getX?.();
    const y = tile?.y ?? tile?.getY?.();
    const z = tile?.z ?? tile?.getZ?.();
    const objectId = event?.definition?.id ?? event?.objectId;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE ||
      (Number(player.getAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE)) || 70) < 78 || !castleStory(player).talkedToIvan ||
      event?.itemId !== CASTLE_BOOK_ITEMS.gilded || !CASTLE_GILDED_BOOKCASE_IDS.has(objectId) ||
      x !== CASTLE_LIBRARY.westernBookcase[0] || y !== CASTLE_LIBRARY.westernBookcase[1] || z !== CASTLE_LIBRARY.z) return;
    event.handled = true;
    const inventory = player.getInventory();
    if (!inventory.contains(CASTLE_BOOK_ITEMS.vampyre)) {
      player.sendMessage("The book asks for the Vampyric Houses volume from the south-eastern bookcase before it can be arranged.");
      return;
    }
    const state = bookPuzzleState(player);
    if (state.solved || castleStory(player).bookPuzzleComplete) {
      player.sendMessage("The books are already arranged in alphabetical order.");
      return;
    }
    inventory.deleteNumber(CASTLE_BOOK_ITEMS.gilded, 1);
    player.setAttribute(CASTLE_BOOK_PUZZLE_ATTRIBUTE, { ...state, prepared: true });
    player.getPacketSender().sendVarbit(CASTLE_GILDED_BOOKCASE_VARBIT, 1);
    startCastleBookPuzzlePrompt(player);
  }

  function routeCastleDoorEnter(event) {
    const player = event?.player;
    const tile = event?.object?.getLocation?.();
    const currentStage = player && stage(player);
    const name = event.definition?.getName?.();
    const option = event.definition?.getInteractions?.()?.[event.clickType - 1];
    if (!player || quest.isComplete(player) || currentStage < STAGE.CASTLE || currentStage > STAGE.ESCAPE ||
      (!CASTLE_DOOR_NAMES.includes(name) && !CASTLE_DOOR_TRANSITIONS.some(door => door.id === event.definition?.id &&
        door.x === tile?.getX?.() && door.y === tile?.getY?.() && (door.z ?? 0) === tile?.getZ?.())) ||
      !["Enter", "Climb-up", "Climb-down"].includes(option) ||
      !tile || tile.getX() < 2300 || tile.getX() > 2600 ||
      tile.getY() < 7300 || tile.getY() > 7440) return;
    const source = event.sourceLocation;
    const sourceX = source?.x ?? source?.getX?.();
    const sourceY = source?.y ?? source?.getY?.();
    const sourceZ = source?.z ?? source?.getZ?.();
    if (sourceZ === tile.getZ() &&
      Math.max(Math.abs(sourceX - tile.getX()), Math.abs(sourceY - tile.getY())) <= 1) return;
    // The north-lobby door is placed in a clipped wall segment disconnected
    // from the player's landing room component. Route to the known connected
    // room arrival point, then let the same Enter packet use the paired door.
    if (event.definition?.id === 61576 && tile.getX() === 2466 && tile.getY() === 7422 &&
      tile.getZ() === 0 && Number(player.getAttribute(CASTLE_ROOM_ATTRIBUTE)) === CASTLE_ROOM.NORTH_LOBBY_HALL) {
      event.destination = { x: 2456, y: 7417, z: 0 };
      return;
    }
    const face = event.object.getFace();
    const axis = (face & 1) === 0 ? "x" : "y";
    const side = Math.sign(source?.[axis] - (axis === "x" ? tile.getX() : tile.getY())) ||
      (face === 0 || face === 3 ? 1 : -1);
    const privateArea = player.getPrivateArea?.() ?? null;
    // Castle doors can sit in a multi-tile clipped wall. Route to the first
    // clear tile on the player's current side instead of falling through to a
    // clear tile on the far side, which leaves pathfinding trying to cross the
    // wall without executing the Enter action.
    for (let distance = 1; distance <= 8; distance++) {
      const candidate = axis === "x"
        ? new Location(tile.getX() + side * distance, tile.getY(), tile.getZ())
        : new Location(tile.getX(), tile.getY() + side * distance, tile.getZ());
      if (api.core.RegionManager.blocked(candidate, privateArea)) continue;
      event.destination = { x: candidate.getX(), y: candidate.getY(), z: candidate.getZ() };
      return;
    }
  }

  function handleCastleThronePuzzle(event) {
    const player = event?.player;
    const value = player && stage(player);
    if (!player || quest.isComplete(player) || value < STAGE.CASTLE || value > STAGE.ESCAPE) return;
    const tile = event.location;
    const x = tile?.x ?? tile?.getX?.();
    const y = tile?.y ?? tile?.getY?.();
    const z = tile?.z ?? tile?.getZ?.();
    const name = String(event.definition?.getName?.() ?? "").toLowerCase();
    const state = player.getAttribute(THRONE_PUZZLE_ATTRIBUTE) ?? { step: 0, solved: false, keyClaimed: false, pulled: [] };
    // The loc is placed at y=7391 and covers y=7391–7392. The Quest Helper
    // highlights the southern footprint tile (7392), while normal object
    // packets resolve to the cache anchor (7391).
    if (name.includes("throne") && x === 2313 && [7391, 7392].includes(y) && z === 0) {
      event.handled = true;
      const throneOption = String(event.option ?? "").toLowerCase();
      if (["investigate", "search"].includes(throneOption) && !state.started && !state.solved) {
        const next = { ...state, started: true, pulled: [false, false, false, false] };
        player.setAttribute(THRONE_PUZZLE_ATTRIBUTE, next);
        syncThroneBustVarbits(player);
        player.sendMessage("The four busts conceal a mechanism. Their levers must be pulled in the right order.");
        return;
      }
      const hasKey = hasItem(player, ItemIdentifiers.HALF_MOON_KEY) || hasBankedItem(player, ItemIdentifiers.HALF_MOON_KEY);
      if (state.solved && !hasKey && ["search", "take", "investigate"].includes(throneOption)) {
        const inventory = player.getInventory();
        if (typeof inventory.getFreeSlots === "function" && inventory.getFreeSlots() <= 0) {
          player.sendMessage("You couldn't hold the half moon key.");
          return;
        }
        inventory.adds(ItemIdentifiers.HALF_MOON_KEY, 1);
        player.setAttribute(THRONE_PUZZLE_ATTRIBUTE, { ...state, keyClaimed: true });
        player.sendMessage("You find a half moon key inside the throne.");
        return;
      }
      player.sendMessage(state.solved ? "The throne's hidden compartment is empty." : "There is nothing more to learn from the throne yet.");
      return;
    }
    const leverRow = x === 2317 && [7393, 7392, 7391, 7390].indexOf(y);
    if (!name.includes("bust") || !name.includes("lever") || z !== 0 || leverRow < 0) return;
    event.handled = true;
    if (!state.started) {
      player.sendMessage("Investigate the throne first; the busts must be part of its mechanism.");
      return;
    }
    if (state.solved) {
      player.sendMessage("The busts are already set in the correct order.");
      return;
    }
    // The OSRS puzzle order is the third bust, fourth, first, then second.
    const order = [2, 3, 0, 1];
    const pulled = [...(state.pulled ?? [false, false, false, false])];
    pulled[leverRow] = !pulled[leverRow];
    if (leverRow !== order[state.step]) {
      player.setAttribute(THRONE_PUZZLE_ATTRIBUTE, { ...state, step: 0, pulled });
      syncThroneBustVarbits(player);
      player.sendMessage("The mechanism clicks back into place. The bust sequence has reset.");
      return;
    }
    const step = state.step + 1;
    const solved = step === order.length;
    player.setAttribute(THRONE_PUZZLE_ATTRIBUTE, { ...state, step, solved, pulled });
    syncThroneBustVarbits(player);
    player.sendMessage(solved ? "The busts turn into alignment, and a compartment opens beneath the throne." : "The bust lever locks into place.");
  }

  function handleCastleBasinPuzzle(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const { x, y, z } = event.location ?? {};
    const name = String(event.definition?.getName?.() ?? "").toLowerCase();
    if (name !== "shelves" || x !== 2380 || y !== 7396 || z !== 0) return;
    event.handled = true;
    const state = player.getAttribute(BASIN_PUZZLE_ATTRIBUTE) ?? { basins: {}, symbol: false };
    const inventory = player.getInventory();
    const potions = [ItemIdentifiers.CLOUDY_GREY_POTION, ItemIdentifiers.WEIGHTLESS_BLACK_POTION,
      ItemIdentifiers.THICK_RED_POTION, ItemIdentifiers.COLD_BLUISH_WHITE_POTION];
    for (const potion of potions) if (!inventory.contains(potion)) inventory.adds(potion, 1);
    player.sendMessage("You search the north-west shelves and take one potion of each colour.");
  }

  function handleBasinPotion(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const { x, y, z } = event.location ?? {};
    if (z !== 0) return;
    const basin = `${x},${y}`;
    const correctBasin = new Map([
      [ItemIdentifiers.THICK_RED_POTION, "2380,7389"], // north-west: blood
      [ItemIdentifiers.WEIGHTLESS_BLACK_POTION, "2387,7389"], // north-east: shadow
      [ItemIdentifiers.CLOUDY_GREY_POTION, "2380,7384"], // south-west: smoke
      [ItemIdentifiers.COLD_BLUISH_WHITE_POTION, "2387,7384"], // south-east: ice
    ]);
    const expected = correctBasin.get(event.itemId);
    if (!expected || !["61702", "61703", "61704", "61705"].includes(String(event.objectId))) return;
    event.handled = true;
    const state = player.getAttribute(BASIN_PUZZLE_ATTRIBUTE) ?? { basins: {}, symbol: false };
    if (!player.getInventory().contains(event.itemId)) return;
    if (basin !== expected) {
      player.sendMessage("The basin rejects the potion. Read its inscription and choose another basin.");
      return;
    }
    if (state.basins[basin]) {
      player.sendMessage("A potion has already been poured into this basin.");
      return;
    }
    player.getInventory().deleteNumber(event.itemId, 1);
    const basins = { ...state.basins, [basin]: true };
    player.setAttribute(BASIN_PUZZLE_ATTRIBUTE, { ...state, basins });
    player.sendMessage("You pour the potion into the basin. The liquid settles beneath its inscription.");
  }

  function handleBasinAltar(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const { x, y, z } = event.location ?? {};
    const name = String(event.definition?.getName?.() ?? "").toLowerCase();
    if (name !== "altar" || x !== 2382 || y !== 7393 || z !== 0) return;
    event.handled = true;
    const state = player.getAttribute(BASIN_PUZZLE_ATTRIBUTE) ?? { basins: {}, symbol: false };
    if (!Object.values(state.basins).length || Object.keys(state.basins).length !== 4) {
      player.sendMessage("The altar remains still. The four inscriptions must each receive the correct potion.");
      return;
    }
      if (!giveInventoryItem(player, ItemIdentifiers.ANCIENT_SYMBOL, "Make room in your inventory before taking the ancient symbol.")) return;
      player.setAttribute(BASIN_PUZZLE_ATTRIBUTE, { ...state, symbol: true });
      player.sendMessage("You search the altar and take an ancient symbol.");
  }

  function handleSolidKeyObjects(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const { x, y, z } = event.location ?? {};
    if (z !== 0) return;
    const name = String(event.definition?.getName?.() ?? "").toLowerCase();
    const basinState = player.getAttribute(BASIN_PUZZLE_ATTRIBUTE) ?? { basins: {}, symbol: false };
    const state = player.getAttribute(SOLID_KEY_ATTRIBUTE) ?? { shield: false, mounted: false, key: false };
    if (name === "crate" && x === 2439 && y === 7378) {
      event.handled = true;
      if (!basinState.symbol || !player.getInventory().contains(ItemIdentifiers.ANCIENT_SYMBOL)) {
        player.sendMessage("The ancient shield's room lies beyond the chapel. Find the ancient symbol first.");
        return;
      }
      if (!giveInventoryItem(player, ItemIdentifiers.ANCIENT_SHIELD, "Make room in your inventory before taking the ancient shield.")) return;
      player.setAttribute(SOLID_KEY_ATTRIBUTE, { ...state, shield: true });
      player.sendMessage("You search the crate and take an ancient shield.");
      return;
    }
    if (x !== 2543 || y !== 7361) return;
    if (state.mounted) {
      event.handled = true;
      if (!giveInventoryItem(player, ItemIdentifiers.SOLID_KEY, "Make room in your inventory before taking the solid key.")) return;
      player.setAttribute(SOLID_KEY_ATTRIBUTE, { ...state, key: true });
      player.sendMessage("You search the mounted shield and take the solid key.");
    }
  }

  function setClockValue(player, side, hand, value) {
    const state = player.getAttribute(CLOCK_ATTRIBUTE) ?? { west: {}, east: {}, emblem: false };
    const clock = { ...(state[side] ?? {}), [hand]: value };
    player.setAttribute(CLOCK_ATTRIBUTE, { ...state, [side]: clock });
    player.sendMessage(`You set the ${hand === "large" ? "large" : "small"} clock hand to ${value}.`);
  }

  function promptClockValue(player, side, hand) {
    const choices = [];
    for (let value = 0; value < 12; value++) {
      choices.push(String(value), () => setClockValue(player, side, hand, value));
    }
    api.sendMultiChatboxPrompt(player, `Set the ${side} ${hand} clock hand`, ...choices);
  }

  function handleCastleClocks(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const { x, y, z } = event.location ?? {};
    if (z !== 0) return;
    const state = player.getAttribute(CLOCK_ATTRIBUTE) ?? { west: {}, east: {}, emblem: false };
    if (event.objectId === 61752 && x === 2323 && y === 7386) {
      event.handled = true;
      if (!giveInventoryItem(player, ItemIdentifiers.SMALL_CLOCK_HAND, "Make room in your inventory before taking the small clock hand.")) return;
      player.sendMessage("You search the shelves and take a small clock hand.");
      return;
    }
    if (event.objectId === 61751 && x === 2466 && y === 7370) {
      event.handled = true;
      if (!giveInventoryItem(player, ItemIdentifiers.LARGE_CLOCK_HAND, "Make room in your inventory before taking the large clock hand.")) return;
      player.sendMessage("You search the crate and take a large clock hand.");
      return;
    }
    const side = event.objectId === 61656 && x === 2344 && y === 7372 ? "west" :
      event.objectId === 61657 && x === 2350 && y === 7372 ? "east" : null;
    if (side) {
      event.handled = true;
      const clock = state[side] ?? {};
      if (!clock.installed) {
        player.sendMessage("The clock is missing its hand. Fit the small hand to the western clock and the large hand to the eastern clock.");
        return;
      }
      api.sendMultiChatboxPrompt(player, `Adjust the ${side} grandfather clock`,
        "Set the large hand", () => promptClockValue(player, side, "large"),
        "Set the small hand", () => promptClockValue(player, side, "small"));
      return;
    }
    if (event.objectId === 61662 && x === 2346 && y === 7372) {
      event.handled = true;
      const west = state.west ?? {};
      const east = state.east ?? {};
      if (west.large !== 11 || west.small !== 9 || east.large !== 0 || east.small !== 4) {
        player.sendMessage("The fireplace mechanism remains locked. The western clock must show 11:45 and the eastern clock 12:20.");
        return;
      }
      if (!giveInventoryItem(player, ItemIdentifiers.DRAKAN_EMBLEM_2, "Make room in your inventory before taking the Drakan emblem.")) return;
      player.setAttribute(CLOCK_ATTRIBUTE, { ...state, emblem: true });
      player.sendMessage("You search the fireplace and take a second Drakan emblem.");
    }
  }

  function handleClockHandOnClock(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE || event.location?.z !== 0) return;
    const side = event.objectId === 61656 && event.location.x === 2344 && event.location.y === 7372 ? "west" :
      event.objectId === 61657 && event.location.x === 2350 && event.location.y === 7372 ? "east" : null;
    const itemId = event.itemId;
    const expectedItem = side === "west" ? ItemIdentifiers.SMALL_CLOCK_HAND :
      side === "east" ? ItemIdentifiers.LARGE_CLOCK_HAND : null;
    if (!side || itemId !== expectedItem) return;
    event.handled = true;
    const inventory = player.getInventory();
    if (!inventory.contains(itemId)) return;
    const state = player.getAttribute(CLOCK_ATTRIBUTE) ?? { west: {}, east: {}, emblem: false };
    if (state[side]?.installed) {
      player.sendMessage("A clock hand is already fitted there.");
      return;
    }
    inventory.deleteNumber(itemId, 1);
    player.setAttribute(CLOCK_ATTRIBUTE, { ...state, [side]: { ...(state[side] ?? {}), installed: true } });
    player.sendMessage(`You fit the ${side === "west" ? "small" : "large"} clock hand to the ${side} clock.`);
  }

  function promptGalleryChest(player) {
    const state = player.getAttribute(GALLERY_CHEST_ATTRIBUTE) ?? { step: 0, solved: false, key: false };
    const solution = ["right", "down", "right", "left", "left"];
    if (state.step >= solution.length) {
      player.setAttribute(GALLERY_CHEST_ATTRIBUTE, { ...state, solved: true });
      player.sendMessage("The chest's arrow mechanism clicks open. Search it for the crescent moon key.");
      return;
    }
    const options = ["Up", "Right", "Down", "Left"];
    const callbacks = options.map((label) => () => {
      const direction = label.toLowerCase();
      const current = player.getAttribute(GALLERY_CHEST_ATTRIBUTE) ?? { step: 0, solved: false, key: false };
      if (direction !== solution[current.step]) {
        player.setAttribute(GALLERY_CHEST_ATTRIBUTE, { ...current, step: 0, solved: false });
        player.sendMessage("The arrows click back to their starting positions. The chest puzzle resets.");
        return;
      }
      const step = current.step + 1;
      player.setAttribute(GALLERY_CHEST_ATTRIBUTE, { ...current, step, solved: step === solution.length });
      if (step === solution.length) {
        player.sendMessage("The chest's arrow mechanism clicks open. Search it for the crescent moon key.");
      } else {
        player.sendMessage(`One arrow locks into place (${step} of ${solution.length}).`);
        promptGalleryChest(player);
      }
    });
    const pairs = [];
    options.forEach((label, index) => pairs.push(label, callbacks[index]));
    api.sendMultiChatboxPrompt(player, `Chest arrows (${state.step + 1} of ${solution.length})`, ...pairs);
  }

  function handleGalleryChest(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE ||
      event.objectId !== 61681 || event.location?.x !== 2379 || event.location?.y !== 7372 || event.location?.z !== 0) return;
    event.handled = true;
    const state = player.getAttribute(GALLERY_CHEST_ATTRIBUTE) ?? { step: 0, solved: false, key: false };
    if (!state.solved) {
      promptGalleryChest(player);
      return;
    }
    if (!giveInventoryItem(player, ItemIdentifiers.CRESCENT_MOON_KEY, "Make room in your inventory before taking the crescent moon key.")) return;
    player.setAttribute(GALLERY_CHEST_ATTRIBUTE, { ...state, key: true });
    player.sendMessage("You search the chest and take the crescent moon key.");
  }

  function syncHuntGroundItems(event) {
    const player = event?.player ?? event;
    if (!player || player.isPlayerBot?.() === true || stage(player) !== STAGE.BLOOD_HUNT) return;
    const hunt = player.getAttribute(HUNT_ATTRIBUTE) ?? {};
    if (hunt.crankStarted || hasItem(player, HUNT_ITEMS.crank)) return;
    const manager = api.getItemOnGroundManager();
    const tile = new Location(2603, 7847, 0);
    if (!manager?.registerLocation || manager.getGroundItem(player.getUsername(), HUNT_ITEMS.crank, tile, player.getPrivateArea?.() ?? null)) return;
    manager.registerLocation(player, new Item(HUNT_ITEMS.crank, 1), tile);
  }

  function promptHuntCode(player, kind) {
    const code = kind === "shed" ? "TOOLS" : "35158";
    const key = kind === "shed" ? "shedDigits" : "chestDigits";
    const state = player.getAttribute(HUNT_ATTRIBUTE) ?? {};
    const entered = state[key] ?? "";
    const options = kind === "shed" ? ["T", "O", "L", "S"] : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    const pairs = [];
    for (const label of options) pairs.push(label, () => {
      const current = player.getAttribute(HUNT_ATTRIBUTE) ?? {};
      const value = (current[key] ?? "") + label;
      if (value !== code.slice(0, value.length)) {
        player.setAttribute(HUNT_ATTRIBUTE, { ...current, [key]: "" });
        player.sendMessage("The lock clicks and resets.");
        return;
      }
      player.setAttribute(HUNT_ATTRIBUTE, { ...current, [key]: value });
      if (value === code) {
        player.setAttribute(HUNT_ATTRIBUTE, { ...current, [key]: value, [`${kind}Open`]: true });
        if (kind === "shed" && !player.getInventory().contains(HUNT_ITEMS.boltCutters)) player.getInventory().adds(HUNT_ITEMS.boltCutters, 1);
        if (kind === "chest" && !player.getInventory().contains(HUNT_ITEMS.jovkaiKey)) player.getInventory().adds(HUNT_ITEMS.jovkaiKey, 1);
        player.sendMessage(kind === "shed" ? "The shed lock opens. You take a pair of bolt cutters." : "The altar chest opens. You take the Jovkai key.");
        return;
      }
      promptHuntCode(player, kind);
    });
    api.sendMultiChatboxPrompt(player, `${kind === "shed" ? "Shed" : "Altar chest"} combination (${entered.length + 1} of ${code.length})`, ...pairs);
  }

  function handleBloodHuntObjects(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.BLOOD_HUNT) return;
    const { x, y, z } = event.location ?? {};
    if (z !== 0) return;
    const state = player.getAttribute(HUNT_ATTRIBUTE) ?? {};
    const inventory = player.getInventory();
    const has = (itemId) => inventory.contains(itemId);
    const locked = (message) => { event.handled = true; player.sendMessage(message); };
    if (x === 2612 && y === 7853 && !has(HUNT_ITEMS.viturKey)) return locked("The Vitur manor is locked. Find the key in the bookcase north-west of the crank.");
    if ((x === 2612 && y === 7852 || x === 2598 && y === 7843) && !has(HUNT_ITEMS.viturKey)) return locked("The door is locked. You need the Vitur key.");
    if (x === 2590 && y === 7818) {
      if (!has(HUNT_ITEMS.boltCutters)) return locked("The clothes-shop door is chained shut. You need bolt cutters.");
      player.setAttribute(HUNT_ATTRIBUTE, { ...state, chainCut: true });
      player.sendMessage("You cut through the chain on the clothes-shop door.");
      return;
    }
    if (x === 2599 && y === 7826 && !has(HUNT_ITEMS.myrmelKey)) return locked("The pub door is locked. Join the two halves of the key to make a Myrmel key.");
    if (x === 2614 && y === 7814 && !has(HUNT_ITEMS.shadumKey)) return locked("The house is locked. The barrel in the Myrmel pub may hold a key.");
    if (x === 2580 && y === 7812 && !has(HUNT_ITEMS.jovkaiKey)) return locked("The smithy is locked. Search the altar chest for its key.");
    if (x === 2580 && y === 7835 && (!has(HUNT_ITEMS.myrmelKey) || !has(HUNT_ITEMS.trapdoorKey) || !has(HUNT_ITEMS.crank))) {
      return locked("The bank requires the Myrmel key, trapdoor key, and crank wheel.");
    }
    if (x === 2582 && y === 7834) {
      if (!has(HUNT_ITEMS.trapdoorKey) || !has(HUNT_ITEMS.crank)) return locked("The bank crank needs the trapdoor key and crank wheel.");
      inventory.deleteNumber(HUNT_ITEMS.crank, 1);
      player.setAttribute(HUNT_ATTRIBUTE, { ...state, bankCrank: true });
      player.sendMessage("You fit the wheel and turn the bank crank; the trapdoor latch releases.");
      return;
    }
    if (x === 2579 && y === 7830) {
      if (!has(HUNT_ITEMS.trapdoorKey) || !state.bankCrank) return locked("The trapdoor is locked. Find its key and operate the bank crank.");
      player.setAttribute(HUNT_ATTRIBUTE, { ...state, enteredTrapdoor: true });
      return;
    }
    if (x === 2588 && y === 7855) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.crank)) { player.sendMessage("The crank base needs its wheel."); return; }
      player.setAttribute(HUNT_ATTRIBUTE, { ...state, crankStarted: true });
      player.sendMessage("You fit the wheel and turn the crank. A presence stirs behind you. Run!");
      return;
    }
    if (x === 2585 && y === 7861) {
      event.handled = true;
      if (!state.crankStarted) { player.sendMessage("You should get the nearby crank working first."); return; }
      if (!inventory.contains(HUNT_ITEMS.dustyBook)) inventory.adds(HUNT_ITEMS.dustyBook, 1);
      player.sendMessage("You search the bookcase and find a dusty book. Read it to discover the Vitur key.");
      return;
    }
    if (x === 2616 && y === 7855) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.viturKey)) { player.sendMessage("The shed lock needs the Vitur key."); return; }
      if (!state.shedOpen) promptHuntCode(player, "shed");
      else if (!inventory.contains(HUNT_ITEMS.boltCutters)) inventory.adds(HUNT_ITEMS.boltCutters, 1);
      return;
    }
    if (x === 2600 && y === 7845) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.viturKey)) { player.sendMessage("The manor's doors are locked. Find the Vitur key in the bookcase north-west of here."); return; }
      if (!inventory.contains(HUNT_ITEMS.toothHalf)) inventory.adds(HUNT_ITEMS.toothHalf, 1);
      player.sendMessage("You take the tooth half of a key from the table.");
      return;
    }
    if (x === 2588 && y === 7816) {
      event.handled = true;
      if (!state.chainCut || !inventory.contains(HUNT_ITEMS.boltCutters)) { player.sendMessage("The door is chained shut. Cut the chain with bolt cutters first."); return; }
      if (!inventory.contains(HUNT_ITEMS.loopHalf)) inventory.adds(HUNT_ITEMS.loopHalf, 1);
      player.sendMessage("You cut the chain and take the loop half of a key.");
      return;
    }
    if (x === 2596 && y === 7833) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.myrmelKey)) { player.sendMessage("The pub door's lock needs the Myrmel key."); return; }
      if (!inventory.contains(HUNT_ITEMS.bucket) && !inventory.contains(HUNT_ITEMS.bucketWater)) inventory.adds(HUNT_ITEMS.bucket, 1);
      player.sendMessage("You take a bucket from the house.");
      return;
    }
    if (x === 2592 && y === 7825) {
      if (!event.itemId && !event.usedItemId) return;
      const itemId = event.itemId ?? event.usedItemId;
      if (itemId !== HUNT_ITEMS.bucket) return;
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.bucket)) return;
      inventory.deleteNumber(HUNT_ITEMS.bucket, 1);
      inventory.adds(HUNT_ITEMS.bucketWater, 1);
      player.sendMessage("You fill the bucket with water from the well.");
      return;
    }
    if (x === 2592 && y === 7833 && event.itemId === HUNT_ITEMS.bucketWater) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.bucketWater)) return;
      inventory.deleteNumber(HUNT_ITEMS.bucketWater, 1);
      inventory.adds(HUNT_ITEMS.shadumKey, 1);
      player.sendMessage("The water washes away the grime on the barrel and reveals a Shadum key.");
      return;
    }
    if (x === 2619 && y === 7812) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.shadumKey)) { player.sendMessage("The locked house needs its Shadum key."); return; }
      if (!inventory.contains(HUNT_ITEMS.trapdoorKey)) inventory.adds(HUNT_ITEMS.trapdoorKey, 1);
      player.sendMessage("You find the trapdoor key inside the house.");
      return;
    }
    if (x === 2576 && y === 7846) {
      event.handled = true;
      if (!state.enteredTrapdoor || !inventory.contains(HUNT_ITEMS.trapdoorKey)) { player.sendMessage("The chest is below the bank. Operate the crank and enter with the trapdoor key first."); return; }
      if (!state.chestOpen) promptHuntCode(player, "chest");
      else if (!inventory.contains(HUNT_ITEMS.jovkaiKey)) inventory.adds(HUNT_ITEMS.jovkaiKey, 1);
      return;
    }
    if (x === 2582 && y === 7817) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.jovkaiKey)) { player.sendMessage("The smithy lock needs the Jovkai key."); return; }
      if (!inventory.contains(HUNT_ITEMS.oldCog)) inventory.adds(HUNT_ITEMS.oldCog, 1);
      player.sendMessage("You take the old cog from the table.");
    }
  }

  function routeBloodHuntObjects(event) {
    const player = event?.player;
    if (!player || stage(player) !== STAGE.BLOOD_HUNT || event.objectId !== 61818) return;
    const location = event.object?.getLocation?.() ?? event.object?.location ?? {};
    const x = location.getX?.() ?? location.x;
    const y = location.getY?.() ?? location.y;
    const z = location.getZ?.() ?? location.z;
    if (x === 2585 && y === 7861 && z === 0) event.destination = { x: 2584, y: 7862, z: 0 };
  }

  function handleBloodHuntItemOnObject(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.BLOOD_HUNT) return;
    const { x, y, z } = event.location ?? {};
    if (z !== 0) return;
    const itemId = event.itemId;
    const inventory = player.getInventory();
    if (x === 2592 && y === 7825 && itemId === HUNT_ITEMS.bucket) {
      handleBloodHuntObjects({ ...event, player, itemId });
    } else if (x === 2592 && y === 7833 && itemId === HUNT_ITEMS.bucketWater) {
      handleBloodHuntObjects({ ...event, player, itemId });
    } else if (x === 2582 && y === 7834 && itemId === HUNT_ITEMS.crank) {
      event.handled = true;
      if (inventory.contains(HUNT_ITEMS.trapdoorKey)) {
        inventory.deleteNumber(HUNT_ITEMS.crank, 1);
        player.setAttribute(HUNT_ATTRIBUTE, { ...(player.getAttribute(HUNT_ATTRIBUTE) ?? {}), bankCrank: true });
        player.sendMessage("You fit the wheel to the bank's crank. The mechanism lifts the trapdoor latch.");
      }
    }
  }

  function handleBloodHuntItemOnItem(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.BLOOD_HUNT) return;
    const pair = new Set([event.usedItemId, event.usedWithItemId]);
    const inventory = player.getInventory();
    if (pair.has(HUNT_ITEMS.toothHalf) && pair.has(HUNT_ITEMS.loopHalf)) {
      event.handled = true;
      if (!inventory.contains(HUNT_ITEMS.toothHalf) || !inventory.contains(HUNT_ITEMS.loopHalf)) return;
      inventory.deleteNumber(HUNT_ITEMS.toothHalf, 1);
      inventory.deleteNumber(HUNT_ITEMS.loopHalf, 1);
      inventory.adds(HUNT_ITEMS.myrmelKey, 1);
      player.sendMessage("The two halves fit together to make a Myrmel key.");
    }
  }

  function readDustyBook(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.BLOOD_HUNT || event.itemId !== HUNT_ITEMS.dustyBook) return;
    event.handled = true;
    if (!player.getInventory().contains(HUNT_ITEMS.dustyBook)) return;
    player.getInventory().deleteNumber(HUNT_ITEMS.dustyBook, 1);
    player.getInventory().adds(HUNT_ITEMS.viturKey, 1);
    player.setAttribute(HUNT_ATTRIBUTE, { ...(player.getAttribute(HUNT_ATTRIBUTE) ?? {}), readBook: true });
    player.sendMessage("A key falls from the dusty book. It is marked with the Vitur crest.");
  }

  function handleAncientShieldAssembly(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const pair = new Set([event.usedItemId, event.usedWithItemId]);
    if (!pair.has(ItemIdentifiers.ANCIENT_SYMBOL) || !pair.has(ItemIdentifiers.ANCIENT_SHIELD)) return;
    event.handled = true;
    const inventory = player.getInventory();
    if (!inventory.contains(ItemIdentifiers.ANCIENT_SYMBOL) || !inventory.contains(ItemIdentifiers.ANCIENT_SHIELD)) return;
    inventory.deleteNumber(ItemIdentifiers.ANCIENT_SYMBOL, 1);
    inventory.deleteNumber(ItemIdentifiers.ANCIENT_SHIELD, 1);
    if (!inventory.adds(ItemIdentifiers.SHIELD_WITH_SYMBOL, 1)) {
      inventory.adds(ItemIdentifiers.ANCIENT_SYMBOL, 1);
      inventory.adds(ItemIdentifiers.ANCIENT_SHIELD, 1);
      player.sendMessage("Make room for the shield with symbol.");
      return;
    }
    player.setAttribute(SOLID_KEY_ATTRIBUTE, { ...(player.getAttribute(SOLID_KEY_ATTRIBUTE) ?? {}), assembled: true });
    player.sendMessage("You fit the ancient symbol onto the shield.");
  }

  function handleMountShield(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE ||
      event.itemId !== ItemIdentifiers.SHIELD_WITH_SYMBOL) return;
    const { x, y, z } = event.location ?? {};
    if (x !== 2543 || y !== 7361 || z !== 0) return;
    event.handled = true;
    const state = player.getAttribute(SOLID_KEY_ATTRIBUTE) ?? { shield: false, mounted: false, key: false };
    if (!state.assembled || !player.getInventory().contains(ItemIdentifiers.SHIELD_WITH_SYMBOL)) {
      player.sendMessage("The shield is missing its ancient symbol.");
      return;
    }
    player.getInventory().deleteNumber(ItemIdentifiers.SHIELD_WITH_SYMBOL, 1);
    player.setAttribute(SOLID_KEY_ATTRIBUTE, { ...state, mounted: true });
    player.sendMessage("You mount the shield on the southern wall.");
  }

  function handleRefiner(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE) return;
    const { x, y, z } = event.location ?? {};
    const name = String(event.definition?.getName?.() ?? "").toLowerCase();
    if (name === "shelves" && x === 2513 && y === 7387 && z === 0) {
      event.handled = true;
      const inventory = player.getInventory();
      for (const [id, amount] of [[ItemIdentifiers.VIAL_OF_WATER_6, 2],
        [ItemIdentifiers.VIAL_OF_BLOOD_5, 3], [ItemIdentifiers.PURE_ESSENCE_4, 3]]) {
        const missing = amount - (inventory.getAmount?.(id) ?? (inventory.contains(id) ? 1 : 0));
        if (missing > 0) inventory.adds(id, missing);
      }
      player.sendMessage("You search the north-west shelves and take two vials of water, three vials of blood, and three pure essences.");
      return;
    }
    if (name !== "blood stockpile" || x !== 2535 || y !== 7385 || z !== 0) return;
    event.handled = true;
    const state = player.getAttribute(REFINER_ATTRIBUTE) ?? { mixtures: [], made: [], used: 0, total: 0, destroyed: false };
    if (state.used !== 4 || state.total !== 53) {
      player.sendMessage("The stockpile is protected by the refiner. Make mixtures totalling 53 haemalchemic potential and use all four on the basin.");
      return;
    }
    player.setAttribute(REFINER_ATTRIBUTE, { ...state, destroyed: true });
    const story = castleStory(player);
    player.setAttribute(CASTLE_STORY_ATTRIBUTE, { ...story, stockpileDestroyed: true });
    player.sendMessage("You destroy the blood stockpile. The refiner's north door is now clear.");
    startTranscript(api, player, 0, PAGE, "escape-from-castle-drakan-destroying-the-blood-stockpile");
  }

  function handleRefinerMixture(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE || event.objectId !== 61709) return;
    const { x, y, z } = event.location ?? {};
    if (x !== 2520 || y !== 7385 || z !== 0) return;
    const inventory = player.getInventory();
    const state = player.getAttribute(REFINER_ATTRIBUTE) ?? { mixtures: [], used: 0, total: 0, destroyed: false };
    const made = state.made ?? state.mixtures;
    const candidates = [
      { items: [ItemIdentifiers.VIAL_OF_BLOOD_5, ItemIdentifiers.PURE_ESSENCE_4], value: 17, max: 2 },
      { items: [ItemIdentifiers.VIAL_OF_BLOOD_5, ItemIdentifiers.VIAL_OF_WATER_6], value: 13, max: 1 },
      { items: [ItemIdentifiers.PURE_ESSENCE_4, ItemIdentifiers.VIAL_OF_WATER_6], value: 6, max: 1 },
    ];
    const recipe = candidates.find(({ items, value, max }) => items.includes(event.itemId) &&
      items.every((id) => inventory.contains(id)) && made.filter((entry) => entry === value).length < max);
    if (!recipe) return;
    event.handled = true;
    for (const id of recipe.items) inventory.deleteNumber(id, 1);
    if (!inventory.adds(ItemIdentifiers.CHEMICAL_VIAL, 1)) {
      for (const id of recipe.items) inventory.adds(id, 1);
      player.sendMessage("Make room in your inventory for the chemical vial.");
      return;
    }
    const mixtures = [...state.mixtures, recipe.value];
    player.setAttribute(REFINER_ATTRIBUTE, { ...state, mixtures, made: [...made, recipe.value] });
    player.sendMessage(`The refiner fills a chemical vial with ${recipe.value} haemalchemic potential.`);
  }

  function handleRefinerVial(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) !== STAGE.CASTLE ||
      event.itemId !== ItemIdentifiers.CHEMICAL_VIAL || event.objectId !== 61707) return;
    const { x, y, z } = event.location ?? {};
    if (x !== 2518 || y !== 7389 || z !== 0) return;
    event.handled = true;
    const state = player.getAttribute(REFINER_ATTRIBUTE) ?? { mixtures: [], used: 0, total: 0, destroyed: false };
    if (!state.mixtures.length || !player.getInventory().contains(ItemIdentifiers.CHEMICAL_VIAL)) {
      player.sendMessage("The refiner's basin is waiting for a prepared chemical vial.");
      return;
    }
    player.getInventory().deleteNumber(ItemIdentifiers.CHEMICAL_VIAL, 1);
    const [value, ...mixtures] = state.mixtures;
    const total = state.total + value;
    player.setAttribute(REFINER_ATTRIBUTE, { ...state, mixtures, used: state.used + 1, total });
    player.sendMessage(`The basin absorbs the vial. Haemalchemic potential: ${total} HP.`);
  }

  function handlePrepObject(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) < STAGE.PREPARATIONS || stage(player) >= STAGE.SIEGE) return;
    const name = String(event.definition?.getName?.() ?? "").toLowerCase();
    const option = String(event.option ?? "").toLowerCase();
    const inventory = player.getInventory();
    let variant = null;
    let changed = false;
    if (name === "amitire plant" && prepObjectAt(event, 2982, 7679, 0) && !hasItem(player, PREP.leaves)) {
      changed = inventory.adds(PREP.leaves, 1);
      variant = "hallowed-preparations-picking-the-amitire-plant";
    } else if (name === "shelves" && prepObjectAt(event, 3159, 7824, 1) && !hasItem(player, PREP.bowl)) {
      changed = inventory.adds(PREP.bowl, 1);
      variant = "hallowed-preparations-searching-the-shelves";
    } else if (name === "cupboard" && prepObjectAt(event, 3155, 7832, 1)) {
      event.handled = true;
      api.sendMultiChatboxPrompt(player, "What would you like to take?",
        "Potato.", () => takePrepItem(player, PREP.potato, "You take a potato from the cupboard."),
        "Raw meat.", () => takePrepItem(player, PREP.rawMeat, "You take some raw meat from the cupboard."),
        "Nothing.", () => {});
      return;
    } else if (name === "workbench" && prepObjectAt(event, 3176, 7841, 1)) {
      event.handled = true;
      api.sendMultiChatboxPrompt(player, "What would you like to take?",
        "Hammer.", () => takePrepItem(player, PREP.hammer, "You take a hammer from the workbench."),
        "Chisel.", () => takePrepItem(player, PREP.chisel, "You take a chisel from the workbench."),
        "Knife.", () => takePrepItem(player, PREP.knife, "You take a knife from the workbench."),
        "Nothing.", () => {});
      return;
    } else if ((name.includes("crate") || name.includes("blisterwood")) && prepObjectAt(event, 3177, 7843, 1) && !hasItem(player, PREP.logs)) {
      changed = inventory.adds(PREP.logs, 1);
      variant = "hallowed-preparations-searching-the-blisterwood-crate";
    } else if ((name.includes("crate") || name.includes("sickle")) && prepObjectAt(event, 3181, 7841, 1) && !hasItem(player, PREP.blessedSickle)) {
      changed = inventory.adds(PREP.blessedSickle, 1);
      variant = "hallowed-preparations-searching-the-sickle-crate";
    } else if (name === "chest" && !hasItem(player, PREP.diamond) && hasItem(player, PREP.blessedSickle) &&
      prepObjectAt(event, 3181, 7835, 1)) {
      changed = inventory.adds(PREP.diamond, 1);
      variant = "hallowed-preparations-searching-the-workshop-s-eastern-chest";
    } else if (name === "chest" && !hasItem(player, PREP.diamondTablet) && hasItem(player, PREP.diamondSickle) &&
      prepObjectAt(event, 3175, 7836, 1)) {
      changed = inventory.adds(PREP.diamondTablet, 1);
      variant = "hallowed-preparations-searching-the-workshop-s-western-chest";
    } else if (name.includes("range") && prepObjectAt(event, 3160, 7826, 1) && inventory.contains(PREP.rawMeat)) {
      changed = replaceItems(player, [PREP.rawMeat], [PREP.rawMeat], [[PREP.cookedMeat, 1]]);
    } else if (name.includes("range") && prepObjectAt(event, 3160, 7826, 1) && inventory.contains(PREP.uncookedStew)) {
      changed = replaceItems(player, [PREP.uncookedStew], [PREP.uncookedStew], [[PREP.cookedStew, 1]]);
    } else if (name === "anvil" && prepObjectAt(event, 3179, 7842, 1) && inventory.contains(PREP.enhancedSickle) && inventory.contains(PREP.marks) &&
      inventory.contains(PREP.blisterwoodFlail) && inventory.contains(PREP.hammer) &&
      player.getSkillManager().getMaxLevel(Skill.SMITHING) >= 72) {
      event.handled = true;
      api.sendMultiChatboxPrompt(player, "Upgrade your flail?", "Yes.", () => {
        if (stage(player) !== STAGE.PREPARATIONS || player.getSkillManager().getMaxLevel(Skill.SMITHING) < 72) return;
        if (replaceItems(player, [PREP.enhancedSickle, PREP.marks, PREP.blisterwoodFlail, PREP.hammer],
          [PREP.enhancedSickle, PREP.marks, PREP.blisterwoodFlail], [[PREP.flail, 1]])) {
          player.setAttribute(PREP_ATTRIBUTE, { ...(player.getAttribute(PREP_ATTRIBUTE) ?? {}), flail: true });
          quest.setStage(player, STAGE.PREPARATIONS);
          player.sendMessage("You upgrade your flail by swapping out the sickle and shortening the shaft before enhancing it with pure silvthrill.");
        }
      }, "No.", () => {});
      return;
    }
    if (!changed) return;
    event.handled = true;
    if (variant) prepAction(player, variant);
    else player.sendMessage(`You ${option === "search" ? "search" : "use"} the ${name}.`);
  }

  function handlePrepItemOnObject(event) {
    const player = event?.player;
    if (!player || stage(player) !== STAGE.PREPARATIONS) return;
    let result;
    if (event.objectId === ObjectIdentifiers.SINK_40 && prepObjectAt(event, 3156, 7824, 1) && event.itemId === PREP.bowl) result = PREP.bowlWater;
    if (event.objectId === ObjectIdentifiers.RANGE_24 && prepObjectAt(event, 3160, 7826, 1)) {
      if (event.itemId === PREP.rawMeat) result = PREP.cookedMeat;
      if (event.itemId === PREP.uncookedStew) result = PREP.cookedStew;
    }
    if (!result || !replaceItems(player, [event.itemId], [event.itemId], [[result, 1]])) return;
    event.handled = true;
    player.sendMessage(result === PREP.bowlWater ? 'You fill the bowl with water.' : 'You cook the ingredient for Safalaan’s stew.');
  }

  function handlePrepItemOnItem(event) {
    const player = event?.player;
    if (!player || quest.isComplete(player) || stage(player) < STAGE.PREPARATIONS || stage(player) >= STAGE.SIEGE) return;
    const pair = new Set([event.usedItemId, event.usedWithItemId]);
    const inventory = player.getInventory();
    let recipe = null;
    if (pair.has(PREP.bowlWater) && pair.has(PREP.potato)) {
      recipe = [[PREP.bowlWater, PREP.potato], [PREP.bowlWater, PREP.potato], [[PREP.incompleteStew, 1]]];
    } else if (pair.has(PREP.incompleteStew) && pair.has(PREP.cookedMeat)) {
      recipe = [[PREP.incompleteStew, PREP.cookedMeat], [PREP.incompleteStew, PREP.cookedMeat], [[PREP.uncookedStew, 1]]];
    } else if (pair.has(PREP.cookedStew) && pair.has(PREP.leaves)) {
      recipe = [[PREP.cookedStew, PREP.leaves], [PREP.cookedStew, PREP.leaves], [[PREP.stew, 1]]];
    } else if (pair.has(PREP.blessedSickle) && pair.has(PREP.diamond)) {
      recipe = [[PREP.blessedSickle, PREP.diamond], [PREP.blessedSickle, PREP.diamond], [[PREP.diamondSickle, 1]]];
    } else if (pair.has(PREP.diamondSickle) && pair.has(PREP.diamondTablet)) {
      recipe = [[PREP.diamondSickle, PREP.diamondTablet], [PREP.diamondSickle, PREP.diamondTablet], [[PREP.enchantedSickle, 1]]];
    } else if (pair.has(PREP.enchantedSickle) && pair.has(PREP.logs)) {
      recipe = [[PREP.enchantedSickle, PREP.logs], [PREP.enchantedSickle, PREP.logs], [[PREP.enhancedSickle, 1]]];
    } else if (pair.has(PREP.logs) && pair.has(PREP.knife)) {
      recipe = [[PREP.logs, PREP.knife], [PREP.logs], [[PREP.stakes, 5]]];
    }
    if (!recipe) return;
    event.handled = true;
    if (pair.has(PREP.blessedSickle) || pair.has(PREP.enchantedSickle)) {
      const diamond = pair.has(PREP.blessedSickle);
      api.sendMultiChatboxPrompt(player, diamond ? "Craft a diamond sickle?" : "Craft an enhanced blisterwood sickle?",
        "Yes.", () => craftPrepRecipe(player, recipe, pair), "No.", () => {});
    } else craftPrepRecipe(player, recipe, pair);
  }

  function takePrepItem(player, id, message) {
    if (stage(player) !== STAGE.PREPARATIONS || hasItem(player, id)) return;
    if (player.getInventory().adds(id, 1)) player.sendMessage(message);
  }

  function craftPrepRecipe(player, recipe, pair) {
    if (stage(player) !== STAGE.PREPARATIONS || !replaceItems(player, ...recipe)) return;
    if (pair.has(PREP.logs) && pair.has(PREP.knife)) {
      player.setAttribute(PREP_ATTRIBUTE, { ...(player.getAttribute(PREP_ATTRIBUTE) ?? {}), stakes: true });
      player.sendMessage("You cut the blisterwood logs into five stakes.");
    } else if (pair.has(PREP.blessedSickle)) {
      player.sendMessage("You embed the diamond into the sickle.");
    } else if (pair.has(PREP.diamondSickle)) {
      player.sendMessage("You enchant the diamond sickle.");
    } else if (pair.has(PREP.enchantedSickle)) {
      player.sendMessage("You enhance the diamond sickle with blisterwood, making an enhanced blisterwood sickle.");
      player.setAttribute(PREP_ATTRIBUTE, { ...(player.getAttribute(PREP_ATTRIBUTE) ?? {}), sickle: true });
    } else if (pair.has(PREP.cookedStew)) {
      prepAction(player, "hallowed-preparations-making-the-amitire-stew");
    } else player.sendMessage("You combine the ingredients.");
    quest.setStage(player, STAGE.PREPARATIONS);
  }

  function feedSafalaan(event) {
    const player = event?.player;
    const targetName = String(event?.target?.getDefinition?.()?.getName?.() ?? event?.target?.getName?.() ?? "").toLowerCase();
    if (!player || !targetName.includes("safalaan") || event.itemId !== PREP.stew || stage(player) < STAGE.PREPARATIONS || stage(player) >= STAGE.SIEGE) return;
    event.handled = true;
    if (!player.getInventory().contains(PREP.stew)) return;
    player.getInventory().deleteNumber(PREP.stew, 1);
    player.getInventory().adds(PREP.marks, 1);
    player.setAttribute(PREP_ATTRIBUTE, { ...(player.getAttribute(PREP_ATTRIBUTE) ?? {}), stewFed: true });
    quest.setStage(player, STAGE.PREPARATIONS);
    prepAction(player, "hallowed-preparations-feeding-safalaan-the-stew", event.npcId);
  }

  const ACTION_STAGE = {
    "gzCVlH": STAGE.SLEPE,
    "fiqzZ7": STAGE.SLEPE,
    "XqVfhB": STAGE.ESCAPE,
    "D5qF0g": STAGE.BLOOD_HUNT,
    "sw9z49": STAGE.BLOOD_HUNT,
    "lKvIyH": STAGE.BLOOD_HUNT,
    "kfvYPl": STAGE.PREPARATIONS,
    "Sut83Q": STAGE.SIEGE,
    "vqg4qO": STAGE.SIEGE,
    "1JPVz5": STAGE.THEATRE,
    "4G5OZg": STAGE.WYRDS,
    "4ebW6l": STAGE.FINAL,
  };

  quest = registerQuest(api, {
    key: "the_blood_moon_rises",
    name: PAGE,
    varpId: 5618,
    varbitId: 15464,
    // shortcut: other chapter native stages need their cache morphs validated before mapping.
    varpValue: nativeStage,
    varbitValue: nativeQuestVarbit,
    startedValue: STAGE.STARTED,
    completionValue: STAGE.COMPLETE,
    questPoints: 4,
    rewardItemId: TOME_ID,
    rewardItemLabel: "Tome of Experience (six chapters)",
    otherRewards: ["Access to Vampyrium", "A Hallowed flail", "Sunspear", "The vampyres of Morytania are tolerant of you"],
    buildJournal,
  });
  api.persistAttribute(HIDEOUT_SHRINE_INSPECTED);
  api.persistAttribute(SLEPE_STORY_ATTRIBUTE);
  api.persistAttribute(CASTLE_SHRINE_ATTRIBUTE);
  const hall = require("../bmr/Hall.TheBloodMoonRises")({ api, state: hallDefenceState,
    process: processSiegeDefence, cleanup: handleSiegeLogout, scenery: player => {
      const repaired = hallDefenceState(player).repaired ?? [];
      // shortcut: potion-crate placement is inferred on reachable hall flooring; calibrate against a live OSRS capture.
      return [[SIEGE_HALL.hammerCrate, 3177, 7843], [SIEGE_HALL.potionCrate, 3171, 7847],
        [SIEGE_HALL.barricade, 3167, 7844], ...[...SIEGE_HALL.repairLocations].map(([key, ids]) => {
          const [x, y] = key.split(',').map(Number);
          return [ids[repaired.includes(key) ? 1 : 0], x, y, ids[0] === SIEGE_HALL.damagedWindow ? 0 : 10, ids[0] === SIEGE_HALL.damagedWindow ? 2 : 0];
        })];
    } });
  require("../bmr/Palace.TheBloodMoonRises")({ api, stage, preparationAttribute: PREP_ATTRIBUTE, processHall: ({ player }) => hall.enter(player) });
  const bridge = require("../bmr/Bridge.TheBloodMoonRises")({ api, stage, attribute: SIEGE_DEFENCE_ATTRIBUTE,
    sync: player => quest.setStage(player, STAGE.SIEGE),
    ready: player => { const prep = player.getAttribute(PREP_ATTRIBUTE) ?? {}; return prep.flail && prep.stakes; },
    play: (player, npc, variant) => startTranscript(api, player, npc, PAGE, variant) });
  api.persistAttribute(ATTRIBUTE);
  api.onCustomEvent("npc-dialogue:hook", onStartHook);
  api.onCustomEvent("npc-dialogue:action", onTranscriptAction);
  api.onCustomEvent("quest:stage-changed", syncHideoutIvan);
  api.onCustomEvent("quest:stage-changed", syncSlepeIvan);
  api.onCustomEvent("quest:stage-changed", syncSlepeRoy);
  api.onCustomEvent("quest:stage-changed", cleanupSlepeStory);
  api.onObjectInteraction(prayAtCastleShrine);
  api.onObjectInteraction(enterVampyriumPortal);
  api.onObjectInteraction(tryCastleReturnPortal);
  api.onCustomEvent("drakan-medallion:destinations", addCastleMedallionDestination);
  api.onCustomEvent("world:object-examine", inspectHideoutShrine);
  api.onNpcDialogueCondition(handleSlepeJournalCondition);
  api.onNpcDialogueCondition(answerHideoutCondition);
  api.onCustomEvent("npc-dialogue:choice", onChoice);
  api.onCustomEvent("npc-dialogue:line", onBloodMoonDialogueLine);
  api.onCustomEvent("npc-dialogue:line", onSlepeDialogueLine);
  api.onCustomEvent("tob:bmr-completed", onBloodMoonTobCompleted);
  api.onCustomEvent(REFINERY_COMPLETED_EVENT, onRefineryCompleted);
  api.onNpcDialogueVariant(selectVariant);
  api.onAnyNpcInteraction({ "Talk-to": talkQuestNpc });
  // Claim Ivan after Sins of the Father and In Aid of the Myreque decline him,
  // before their generic completed-quest transcript can answer for this stage.
  api.onNpcInteraction("Ivan Strom", { "Talk-to": talkQuestNpc });
  api.onNpcInteraction("Roy", { "Talk-to": talkQuestNpc });
  api.onNpcInteraction("Veliaf Hurtz", { "Talk-to": talkQuestNpc });
  api.onNpcInteraction("Safalaan Hallow", { "Talk-to": talkQuestNpc });
  api.onNpcInteraction("Vanescula Drakan", { "Talk-to": talkQuestNpc });
  api.onNpcInteraction("Drezel", { "Talk-to": talkQuestNpc });
  api.onObjectInteraction(handlePaterdomusObject);
  api.onItemOnObject(handlePaterdomusItemOnObject, { noted: false });
  api.onObjectInteraction(openHideoutChest);
  api.onObjectInteraction(handleSiegeHallObject);
  api.onObjectInteraction(inspectWyrdFence);
  api.onObjectInteraction(handleCastleThronePuzzle);
  api.onObjectInteraction(handleCastleCellDoor);
  api.onObjectInteraction(handleCastleDoorEnter);
  api.onObjectInteraction("Door", { Enter: handleCastleDoorEnter });
  api.onObjectInteraction("Half moon door", { Enter: handleCastleDoorEnter });
  api.onObjectInteraction("Crescent moon door", { Enter: handleCastleDoorEnter });
  api.onObjectInteraction("New moon door", { Enter: handleCastleDoorEnter });
  api.onObjectInteraction("Gibbous moon door", { Enter: handleCastleDoorEnter });
  api.onObjectInteraction("Full moon door", { Enter: handleCastleDoorEnter });
  api.onObjectInteraction("Stairs", { "Climb-up": handleCastleDoorEnter, "Climb-down": handleCastleDoorEnter });
  api.onObjectInteraction("Spiral staircase", { "Climb-up": handleCastleDoorEnter, "Climb-down": handleCastleDoorEnter });
  api.onObjectInteraction("Gilded door", { Enter: handleCastleDoorEnter });
  api.onObjectInteraction("Solid door", { Enter: handleCastleDoorEnter });
  api.onObjectInteraction("Teleporter", { Enter: handleCastleDoorEnter });
  api.onObjectInteraction(handleCastleBookObjects);
  api.onObjectInteraction(handleCastleKeyObjects);
  api.onItemOnObject(handleCastleBookOnObject, { noted: false });
  api.onItemOnObject(handleCastleKeyItemOnObject, { noted: false });
  api.onItemOnItem(handleCastleKeyItemOnItem);
  api.onCustomEvent("player:widget-action", handleCastleBookWidgetAction);
  api.onGroundItemPickup(handleCastleBookPickup);
  api.onGroundItemPickup(handleCastleKeyPickup);
  api.onObjectRoute(routeCastleDoorEnter);
  api.onObjectInteraction(handleCastleBasinPuzzle);
  api.onObjectInteraction(handleBasinAltar);
  api.onObjectInteraction(handleSolidKeyObjects);
  api.onObjectInteraction(handleCastleClocks);
  api.onObjectInteraction(handleGalleryChest);
  api.onObjectInteraction(handleBloodHuntObjects);
  api.onObjectRoute(routeBloodHuntObjects);
  api.onItemOnObject(handlePrepItemOnObject, { noted: false });
  api.onItemOnObject(handleBasinPotion, { noted: false });
  api.onItemOnObject(handleMountShield, { noted: false });
  api.onItemOnObject(handleClockHandOnClock, { noted: false });
  api.onItemOnObject(handleRefinerVial, { noted: false });
  api.onObjectInteraction(handlePrepObject);
  api.onObjectInteraction(handleRefiner);
  api.onItemOnObject(handleRefinerMixture, { noted: false });
  api.onItemOnObject(handleBloodHuntItemOnObject, { noted: false });
  api.onItemOnItem(handleAncientShieldAssembly);
  api.onItemOnItem(handlePrepItemOnItem);
  api.onItemOnItem(handleBloodHuntItemOnItem);
  api.onItemOnNpc(feedSafalaan);
  api.onItemAction("Dusty book", { Read: readDustyBook });
  api.onItemAction("Squire's journal", { Read: readSlepeJournal });
  for (const book of SLEPE_BOOKS) api.onItemAction(book.name, { Read: readPaterdomusBook });
  api.onItemAction("Ivandis' writings", { Read: readIvandisWritings });
  api.onNpcInteraction("Aranei", { Heal: healSiegeAranei });
  api.onPlayerProcess(syncHuntGroundItems);
  api.onPlayerProcess(processSlepeIvan);
  api.onPlayerProcess(processSlepeManor);
  api.onPlayerProcess(processSlepeProgress);
  api.onPlayerProcess(processCastleDialogueTransition);
  api.onPlayerLogin(handleSiegeLogin);
  api.onPlayerLogin(syncHideoutIvan);
  api.onPlayerLogin(syncSlepeIvan);
  api.onPlayerLogin(syncSlepeRoy);
  api.onPlayerLogin(syncPaterdomusBookPuzzle);
  api.onCustomEvent("player:bootstrap-complete", syncPaterdomusBookPuzzle);
  api.onPlayerLogin(resumeHideoutEscape);
  api.onPlayerLogin(syncCastleShrine);
  api.onPlayerLogin(syncCastleRoomOnLogin);
  api.onPlayerLogout(cleanupCastleActors);
  api.onPlayerLogout(handleSiegeLogout);
  api.onPlayerLogout(hideoutDefense.onPlayerLogout);
  api.onPlayerLogout(cleanupSlepeIvan);
  api.onPlayerLogout(cleanupSlepeManor);
  api.onNpcDeath(handleWyrdDeath);
  api.onNpcDeath(handleSlepeManorDeath);
  api.onNpcDeath(handlePaterdomusMonkDeath);
  api.onNpcDeath(handleCastleNpcDeath);
  api.persistAttribute(HIDEOUT_DEFENSE_COMPLETE);
  api.onNpcHitModify(handleSiegeDrakanHit);
  api.persistAttribute(WYRD_DEFEATED_ATTRIBUTE);
  api.persistAttribute(DRAKAN_ENCOUNTER_COMPLETE);
  api.persistAttribute(SIEGE_DRAKAN_COMPLETE);
  api.persistAttribute(SIEGE_DEFENCE_ATTRIBUTE);
  api.persistAttribute(TOB_CHALLENGE_ATTRIBUTE);
  api.persistAttribute(PREP_ATTRIBUTE);
  api.persistAttribute(PREP_COMPLETE);
  api.persistAttribute(THRONE_PUZZLE_ATTRIBUTE);
  api.persistAttribute(CASTLE_ROOM_ATTRIBUTE);
  api.persistAttribute(CASTLE_FLOOR_ATTRIBUTE);
  api.persistAttribute(CASTLE_NATIVE_STAGE_ATTRIBUTE);
  api.persistAttribute(CASTLE_STORY_ATTRIBUTE);
  api.persistAttribute(CASTLE_BOOK_PUZZLE_ATTRIBUTE);
  api.persistAttribute(CASTLE_TRANSITION_PENDING_ATTRIBUTE);
  api.onPlayerLogin(syncThroneBustsOnLogin);
  api.persistAttribute(BASIN_PUZZLE_ATTRIBUTE);
  api.persistAttribute(SOLID_KEY_ATTRIBUTE);
  api.persistAttribute(CLOCK_ATTRIBUTE);
  api.persistAttribute(GALLERY_CHEST_ATTRIBUTE);
  api.persistAttribute(REFINER_ATTRIBUTE);
  api.persistAttribute(HUNT_ATTRIBUTE);
  api.onItemAction("Tome of Experience", { Read: readTome });
};
