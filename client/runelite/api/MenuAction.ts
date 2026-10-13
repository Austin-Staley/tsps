/*
 * Copyright (c) 2017, Adam <Adam@sigterm.info>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
// Ported to TypeScript from RuneLite; numeric action IDs are preserved.
export class MenuAction {
    static readonly ITEM_USE_ON_GAME_OBJECT = new MenuAction(1);
    static readonly WIDGET_TARGET_ON_GAME_OBJECT = new MenuAction(2);
    static readonly GAME_OBJECT_FIRST_OPTION = new MenuAction(3);
    static readonly GAME_OBJECT_SECOND_OPTION = new MenuAction(4);
    static readonly GAME_OBJECT_THIRD_OPTION = new MenuAction(5);
    static readonly GAME_OBJECT_FOURTH_OPTION = new MenuAction(6);
    static readonly GAME_OBJECT_FIFTH_OPTION = new MenuAction(1001);
    static readonly ITEM_USE_ON_NPC = new MenuAction(7);
    static readonly WIDGET_TARGET_ON_NPC = new MenuAction(8);
    static readonly NPC_FIRST_OPTION = new MenuAction(9);
    static readonly NPC_SECOND_OPTION = new MenuAction(10);
    static readonly NPC_THIRD_OPTION = new MenuAction(11);
    static readonly NPC_FOURTH_OPTION = new MenuAction(12);
    static readonly NPC_FIFTH_OPTION = new MenuAction(13);
    static readonly ITEM_USE_ON_PLAYER = new MenuAction(14);
    static readonly WIDGET_TARGET_ON_PLAYER = new MenuAction(15);
    static readonly ITEM_USE_ON_GROUND_ITEM = new MenuAction(16);
    static readonly WIDGET_TARGET_ON_GROUND_ITEM = new MenuAction(17);
    static readonly GROUND_ITEM_FIRST_OPTION = new MenuAction(18);
    static readonly GROUND_ITEM_SECOND_OPTION = new MenuAction(19);
    static readonly GROUND_ITEM_THIRD_OPTION = new MenuAction(20);
    static readonly GROUND_ITEM_FOURTH_OPTION = new MenuAction(21);
    static readonly GROUND_ITEM_FIFTH_OPTION = new MenuAction(22);
    static readonly WALK = new MenuAction(23);
    static readonly WIDGET_TYPE_1 = new MenuAction(24);
    static readonly WIDGET_TARGET = new MenuAction(25);
    static readonly WIDGET_CLOSE = new MenuAction(26);
    static readonly WIDGET_TYPE_4 = new MenuAction(28);
    static readonly WIDGET_TYPE_5 = new MenuAction(29);
    static readonly WIDGET_CONTINUE = new MenuAction(30);
    static readonly ITEM_USE_ON_ITEM = new MenuAction(31);
    static readonly WIDGET_USE_ON_ITEM = new MenuAction(32);
    static readonly ITEM_FIRST_OPTION = new MenuAction(33);
    static readonly ITEM_SECOND_OPTION = new MenuAction(34);
    static readonly ITEM_THIRD_OPTION = new MenuAction(35);
    static readonly ITEM_FOURTH_OPTION = new MenuAction(36);
    static readonly ITEM_FIFTH_OPTION = new MenuAction(37);
    static readonly ITEM_USE = new MenuAction(38);
    static readonly WIDGET_FIRST_OPTION = new MenuAction(39);
    static readonly WIDGET_SECOND_OPTION = new MenuAction(40);
    static readonly WIDGET_THIRD_OPTION = new MenuAction(41);
    static readonly WIDGET_FOURTH_OPTION = new MenuAction(42);
    static readonly WIDGET_FIFTH_OPTION = new MenuAction(43);
    static readonly PLAYER_FIRST_OPTION = new MenuAction(44);
    static readonly PLAYER_SECOND_OPTION = new MenuAction(45);
    static readonly PLAYER_THIRD_OPTION = new MenuAction(46);
    static readonly PLAYER_FOURTH_OPTION = new MenuAction(47);
    static readonly PLAYER_FIFTH_OPTION = new MenuAction(48);
    static readonly PLAYER_SIXTH_OPTION = new MenuAction(49);
    static readonly PLAYER_SEVENTH_OPTION = new MenuAction(50);
    static readonly PLAYER_EIGHTH_OPTION = new MenuAction(51);
    static readonly CC_OP = new MenuAction(57);
    static readonly WIDGET_TARGET_ON_WIDGET = new MenuAction(58);
    static readonly SET_HEADING = new MenuAction(60);
    static readonly WORLD_ENTITY_FIRST_OPTION = new MenuAction(63);
    static readonly WORLD_ENTITY_SECOND_OPTION = new MenuAction(64);
    static readonly WORLD_ENTITY_THIRD_OPTION = new MenuAction(65);
    static readonly WORLD_ENTITY_FOURTH_OPTION = new MenuAction(66);
    static readonly WORLD_ENTITY_FIFTH_OPTION = new MenuAction(67);
    static readonly RUNELITE_WIDGET = new MenuAction(998);
    static readonly RUNELITE_HIGH_PRIORITY = new MenuAction(999);
    static readonly EXAMINE_OBJECT = new MenuAction(1002);
    static readonly EXAMINE_NPC = new MenuAction(1003);
    static readonly EXAMINE_ITEM_GROUND = new MenuAction(1004);
    static readonly EXAMINE_ITEM = new MenuAction(1005);
    static readonly CANCEL = new MenuAction(1006);
    static readonly CC_OP_LOW_PRIORITY = new MenuAction(1007);
    static readonly EXAMINE_WORLD_ENTITY = new MenuAction(1013);
    static readonly RUNELITE = new MenuAction(1500);
    static readonly RUNELITE_OVERLAY = new MenuAction(1501);
    static readonly RUNELITE_OVERLAY_CONFIG = new MenuAction(1502);
    static readonly RUNELITE_PLAYER = new MenuAction(1503);
    static readonly RUNELITE_INFOBOX = new MenuAction(1504);
    static readonly RUNELITE_LOW_PRIORITY = new MenuAction(1506);
    static readonly UNKNOWN = new MenuAction(-1);
    private static readonly byId = new Map<number, MenuAction>(Object.values(MenuAction).filter((value): value is MenuAction => value instanceof MenuAction).map((value) => [value.getId(), value]));
    private constructor(private readonly id: number) {}
    getId(): number { return this.id; }
    static of(id: number): MenuAction { return this.byId.get(id) ?? this.UNKNOWN; }
}
