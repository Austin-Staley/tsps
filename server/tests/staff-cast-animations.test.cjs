// Run after `yarn build`: node --test tests/staff-cast-animations.test.cjs
const assert = require("node:assert/strict");
const path = require("node:path");
const { test, before } = require("node:test");

const { Server } = require("../dist/Server");
Server.installProductionPathResolver();

const { CachePipeline } = require("../dist/game/cache/CachePipeline");
const { CacheIndexDat2 } = require("../dist/game/cache/codec/rs/cache/CacheIndex");
const { ConfigType } = require("../dist/game/cache/codec/rs/cache/ConfigType");
const { IndexType } = require("../dist/game/cache/codec/rs/cache/IndexType");
const { Gamevals, GamevalKind } = require("../dist/game/cache/Gamevals");
const { CombatSpell } = require("../dist/game/content/combat/magic/CombatSpell");
const { CombatSpells } = require("../dist/game/content/combat/magic/CombatSpells");

const BIND = 710; // human_castentangle
const BIND_STAFF = 1161; // human_castentangle_staff

let seqs;
let seqNames;

before(async () => {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  seqs = CacheIndexDat2.fromStore(IndexType.DAT2.configs, CachePipeline.getStore()).getArchive(ConfigType.DAT2.seqs);
  seqNames = new Gamevals().namesOf(GamevalKind.SEQ);
});

/** The opcodes these casting sequences use (rev 241); hands are item + 512, 0 empties the hand. */
function decodeSeq(id) {
  const bytes = Uint8Array.from(seqs.getFile(id).data);
  let i = 0;
  const u8 = () => bytes[i++];
  const u16 = () => (u8() << 8) | u8();
  const seq = { frames: null, leftHand: -1, rightHand: -1 };
  for (let opcode = u8(); opcode !== 0; opcode = u8()) {
    if (opcode === 1) {
      const count = u16();
      const lengths = Array.from({ length: count }, u16);
      const low = Array.from({ length: count }, u16);
      const high = Array.from({ length: count }, u16);
      seq.frames = lengths.map((length, frame) => `${(high[frame] << 16) + low[frame]}x${length}`);
    } else if (opcode === 5 || opcode === 11 || opcode === 16) {
      u8();
    } else if (opcode === 6) {
      seq.leftHand = u16();
    } else if (opcode === 7) {
      seq.rightHand = u16();
    } else {
      throw new Error(`seq ${id}: opcode ${opcode} isn't decoded here`);
    }
  }
  return seq;
}

function caster({ player = true, staff = false } = {}) {
  const played = [];
  const mobile = {
    isPlayer: () => player,
    isNpc: () => !player,
    getAsPlayer: () => mobile,
    getEquipment: () => ({ hasStaffEquipped: () => staff }),
    performAnimation: (animation) => played.push(animation.getId()),
    performGraphic: () => {},
  };
  return { mobile, played };
}

test("every twin is the cache's _staff copy of the cast: the same frames, with the staff kept in hand", () => {
  for (const [plain, staff] of CombatSpell.STAFF_CAST_ANIMATIONS) {
    assert.equal(seqNames.get(staff), `${seqNames.get(plain)}_staff`, `seq ${staff}`);
    const [cast, staffCast] = [decodeSeq(plain), decodeSeq(staff)];
    assert.deepEqual(staffCast.frames, cast.frames, `${plain} and ${staff} frames`);
    assert.equal(cast.rightHand, 0, `${seqNames.get(plain)} empties the weapon hand`);
    assert.equal(staffCast.rightHand, -1, `${seqNames.get(staff)} keeps the weapon`);
  }
});

test("Bind casts with the staff twin only when a player wields a staff", () => {
  assert.equal(CombatSpells.BIND.castAnimation().getId(), BIND);
  assert.equal(CombatSpells.BIND.castAnimationFor(caster({ staff: true }).mobile).getId(), BIND_STAFF);
  assert.equal(CombatSpells.BIND.castAnimationFor(caster({ staff: false }).mobile).getId(), BIND, "a sword is put away");
  assert.equal(CombatSpells.BIND.castAnimationFor(caster({ player: false, staff: true }).mobile).getId(), BIND, "only players");
  for (const spell of [CombatSpells.SNARE, CombatSpells.ENTANGLE]) {
    assert.equal(spell.castAnimationFor(caster({ staff: true }).mobile).getId(), BIND_STAFF);
  }
});

test("the cast plays the twin, and a spell with no twin keeps its own animation", () => {
  const bind = Object.create(CombatSpells.BIND);
  bind.castProjectile = () => null;
  const withStaff = caster({ staff: true });
  bind.startCast(withStaff.mobile, caster().mobile);
  assert.deepEqual(withStaff.played, [BIND_STAFF]);

  const surge = CombatSpells.FIRE_SURGE.castAnimation().getId();
  assert.equal(CombatSpell.STAFF_CAST_ANIMATIONS.has(surge), false);
  assert.equal(CombatSpells.FIRE_SURGE.castAnimationFor(caster({ staff: true }).mobile).getId(), surge);
});
