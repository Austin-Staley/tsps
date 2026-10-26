/**
 * Revision 241 client packets to the browser client's ClientMessage values.
 *
 * Decoders match blurite/rsprox (commit 46719fd1): MoveGameClick,
 * ClientCheat, OpNpc1V2, OpLoc1V2, OpObj1V2, OpPlayer1, If1Button,
 * IfButtonX, IfSubOp, ResumePauseButton, ResumePCountDialog.
 * Sizes are `GameClientProt.kt`. Packets this server does not act on are
 * consumed and dropped so the ISAAC stream stays aligned.
 *
 * There is no logout opcode in GameClientProtId 0..101. Closing the socket
 * is what drops the player.
 */
import type { ClientMessage } from "../protocol/ClientProtocol";
import { JagIn } from "./JagBuf";
import { ClientOp } from "./opcodes";

const MAIN_INVENTORY_GROUP = 149;
/** Existing item handlers still key the backpack off the pre-rev widget id. */
const BACKPACK_WIDGET = 3214;

const NPC_OP: Record<number, number> = {
  [ClientOp.OPNPC1]: 1,
  [ClientOp.OPNPC2]: 2,
  [ClientOp.OPNPC3]: 3,
  [ClientOp.OPNPC4]: 4,
  [ClientOp.OPNPC5]: 5,
  [ClientOp.OPNPC6]: 6,
};

const LOC_OP: Record<number, number> = {
  [ClientOp.OPLOC1]: 1,
  [ClientOp.OPLOC2]: 2,
  [ClientOp.OPLOC3]: 3,
  [ClientOp.OPLOC4]: 4,
  [ClientOp.OPLOC5]: 5,
  [ClientOp.OPLOC6]: 6,
};

const OBJ_OP: Record<number, number> = {
  [ClientOp.OPOBJ1]: 1,
  [ClientOp.OPOBJ2]: 2,
  [ClientOp.OPOBJ3]: 3,
  [ClientOp.OPOBJ4]: 4,
  [ClientOp.OPOBJ5]: 5,
  [ClientOp.OPOBJ6]: 6,
};

const PLAYER_OP: Record<number, number> = {
  [ClientOp.OPPLAYER1]: 1,
  [ClientOp.OPPLAYER2]: 2,
  [ClientOp.OPPLAYER3]: 3,
  [ClientOp.OPPLAYER4]: 4,
  [ClientOp.OPPLAYER5]: 5,
  [ClientOp.OPPLAYER6]: 6,
  [ClientOp.OPPLAYER7]: 7,
  [ClientOp.OPPLAYER8]: 8,
};

function combined(id: number): { widgetId: number; groupId: number; childId: number } {
  return { widgetId: id | 0, groupId: (id >>> 16) & 0xffff, childId: id & 0xffff };
}

export function decodeRev241Packet(opcode: number, payload: Buffer): ClientMessage | null {
  const input = new JagIn(payload);
  if (opcode === ClientOp.MOVE_GAMECLICK || opcode === ClientOp.MOVE_MINIMAPCLICK) {
    const key = input.g1Alt1();
    const z = input.g2Alt2();
    const x = input.g2Alt2();
    return { type: "move", worldX: x, worldY: z, modifierFlags: key & 0xff };
  }
  if (opcode === ClientOp.CLIENT_CHEAT) {
    const command = input.gjstr();
    return { type: "chat", text: command.startsWith("::") ? command : `::${command}`, messageType: "public" };
  }
  if (opcode in NPC_OP) {
    if (opcode === ClientOp.OPNPC6) {
      return { type: "npc_option", index: input.g2(), clickType: 6 };
    }
    input.g1Alt1();
    const index = input.g2Alt3();
    return { type: "npc_option", index, clickType: NPC_OP[opcode] };
  }
  if (opcode in LOC_OP) {
    if (opcode === ClientOp.OPLOC6) {
      return { type: "object_option", id: input.g2(), x: 0, y: 0, clickType: 6 };
    }
    const z = input.g2Alt1();
    const id = input.g2Alt3();
    input.g1();
    const x = input.g2();
    return { type: "object_option", id, x, y: z, clickType: LOC_OP[opcode] };
  }
  if (opcode in OBJ_OP) {
    if (opcode === ClientOp.OPOBJ6) {
      const x = input.g2();
      const id = input.g2();
      const z = input.g2();
      return { type: "ground_item_action", itemId: id, x, y: z, optionIndex: 6 };
    }
    const sub = input.g1();
    const x = input.g2();
    const id = input.g2();
    input.g1();
    const z = input.g2Alt3();
    void sub;
    return { type: "ground_item_action", itemId: id, x, y: z, optionIndex: OBJ_OP[opcode] };
  }
  if (opcode in PLAYER_OP) {
    const index = input.g2Alt3();
    return { type: "player_option", index, option: PLAYER_OP[opcode] };
  }
  if (opcode === ClientOp.IF_BUTTON) {
    const id = input.g4();
    const parts = combined(id);
    return { type: "widget_action", ...parts, buttonNum: 1, simple: true };
  }
  if (opcode === ClientOp.IF_BUTTONX || opcode === ClientOp.IF_SUBOP) {
    const id = input.g4();
    const slot = input.g2();
    const obj = input.g2();
    const op = input.g1();
    const parts = combined(id);
    if (parts.groupId === MAIN_INVENTORY_GROUP) {
      return { type: "inventory_action", slot, itemId: obj, widgetId: BACKPACK_WIDGET, optionIndex: op };
    }
    return { type: "widget_action", ...parts, slot, itemId: obj, buttonNum: op, opId: op };
  }
  if (opcode === ClientOp.CLOSE_MODAL) return { type: "interface_close" };
  if (opcode === ClientOp.RESUME_PAUSEBUTTON) {
    const child = input.g2Alt1();
    const id = input.g4Alt1();
    return { type: "dialogue_continue", widgetId: id, childIndex: child };
  }
  if (opcode === ClientOp.RESUME_P_COUNTDIALOG) {
    return { type: "dialogue_amount", amount: input.g4() >>> 0 };
  }
  if (opcode === ClientOp.RESUME_P_STRINGDIALOG || opcode === ClientOp.RESUME_P_NAMEDIALOG) {
    return { type: "dialogue_input", value: input.gjstr() };
  }
  if (opcode === ClientOp.SET_HEADING) {
    return { type: "set_heading", heading: input.g1() };
  }
  if (opcode === ClientOp.MESSAGE_PUBLIC) {
    // Huffman text. Commands arrive as CLIENT_CHEAT, which is what ::tfaroom uses.
    // TODO: decode public chat once the cache Huffman table is loaded.
    return null;
  }
  return null;
}
