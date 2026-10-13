/** The Ghorrock prison route between Sucellus' cell and the asylum. */
module.exports = function registerSucellusPrison(api) {
  const { ItemIdentifiers: I, NpcIdentifiers: N } = api.core;
  const { startTranscript } = require("../QuestRuntime");
  const PAGE = "Desert Treasure II - The Fallen Empire";
  const AREA = "desert-treasure-ii:sucellus-area";
  const PROGRESS = "desert-treasure-ii:sucellus-prison-progress";
  const ENTERED = "desert-treasure-ii:sucellus-cell-entered";
  const ESCAPED = "desert-treasure-ii:sucellus-cell-escaped";
  const COMPLETE = "desert-treasure-ii:sucellus-prison-complete";
  const GEAR_RETURNED = "desert-treasure-ii:sucellus-prison-gear-returned";
  const FIREWORKS = "desert-treasure-ii:sucellus-prison-fireworks";
  const DEFENCE_START = "desert-treasure-ii:sucellus-prison-defence-start";
  const CHISEL = I.CHISEL_5;
  const LOCKPICK = I.LOCKPICK_4;
  const KEYS = { sapphire: I.SAPPHIRE_KEY_3, emerald: I.EMERALD_KEY_3, ruby: I.RUBY_KEY_3, diamond: I.DIAMOND_KEY };
  const ANSWERS = { sapphire: "214013", emerald: "LIES", ruby: "URLDRU", diamond: "WRATH" };
  const SHADOWS_AT = 150;
  const CODE_CHEST = {
    "2980,6346,2": ["sapphire", 24],
    "2902,6445,2": ["emerald", 26],
    "2968,6414,2": ["ruby", 34],
    "2890,6375,2": ["diamond", 38],
  };
  const TILES = {
    padlock: [2945, 6389, 2], altar: [2975, 6347, 2], sapphire: [2980, 6346, 2],
    emerald: [2902, 6445, 2], ruby: [2968, 6414, 2], diamond: [2890, 6375, 2],
    diamondGate: [2903, 6375, 2], gear: [2899, 6376, 2], fireworks: [2972, 6367, 2],
    asylum: [2974, 6440, 2],
  };
  const activePrompts = new WeakMap();
  const defences = new WeakMap();

  api.persistAttribute?.(PROGRESS);
  api.persistAttribute?.(COMPLETE);
  api.persistAttribute?.(GEAR_RETURNED);
  api.persistAttribute?.(FIREWORKS);
  api.persistAttribute?.(DEFENCE_START);

  const state = (player) => Number(player?.getAttribute(PROGRESS)) || 0;
  const setState = (player, value) => {
    player.setAttribute(PROGRESS, value);
    api.emitCustomEvent("dt2:sucellus-prison:journal", { player, lines: journal(value) });
  };
  const has = (player, id) => player.getInventory().getAmount(id) > 0;
  const atArea = (player, area) => Boolean(area && player.getAttribute(AREA) === area && player.getPrivateArea?.() === area);
  const areaLocation = (area, x, y, z) => area.tile(x - 2872, y - 6336, z);
  const worldTile = (player, area) => {
    const p = player.getLocation();
    return [p.getX() - area.getBaseX() + 2872, p.getY() - area.getBaseY() + 6336, p.getZ?.() ?? p.z ?? 0];
  };
  const eventTile = (event, area) => {
    const p = event.location ?? event.object?.getLocation?.();
    if (!p) return null;
    return [p.getX?.() ?? p.x, p.getY?.() ?? p.y, p.getZ?.() ?? p.z ?? 0].map(Number);
  };
  const isTile = (tile, expected) => tile && tile[0] === expected[0] && tile[1] === expected[1] && tile[2] === expected[2];
  const journal = (value) => {
    if (value < 24) return ["Open the padlocked prison gate with the lockpick."];
    if (value < 26) return ["Search the altar room and solve the sapphire chest lock."];
    if (value < 30) return ["Use the sapphire key to reach the north-west chest and solve its lock."];
    if (value < 34) return ["Clear the crevice, enter the beds room and solve the ruby chest lock."];
    if (value < 40) return ["Use the ruby key on the western gate and solve the diamond chest lock."];
    if (value < 46) return ["Talk to the Assassin about the diamond key."];
    if (value < 50) return ["Open the nearby equipment chest to recover your belongings."];
    if (value < 52) return ["Talk to the Assassin again after reclaiming your equipment."];
    if (value < 54) return ["Search the firecracker pack in the refugee camp and prepare for Jhallan."];
    if (value < 56) return ["Survive Jhallan's attack until the Assassin arrives."];
    if (value < 58) return ["Speak to the Assassin after Jhallan is frozen."];
    return ["Enter the asylum through the northern gate."];
  };

  function objectId(event) {
    return event.definition?.id ?? api.core.ObjectDefinition?.forPlayer?.(event.objectId, event.player)?.id ?? event.objectId;
  }

  function handleItemOnObject(event) {
    const { player, itemId, objectId: rawObjectId, location } = event;
    const area = player?.getAttribute(AREA);
    if (!player?.getAttribute(ESCAPED) || !atArea(player, area)) return;
    const id = event.object?.getId?.() ?? rawObjectId;
    const tile = [location?.x, location?.y, location?.z].map(Number);
    if (id === 49120 && isTile(tile, TILES.padlock) && itemId === LOCKPICK) {
      event.handled = true;
      if (state(player) < 22) return;
      setState(player, Math.max(24, state(player)));
      player.sendMessage("You use the lockpick to open the padlocked gate.");
      return;
    }
    if (isTile(tile, TILES.diamondGate) && itemId === KEYS.ruby && state(player) >= 36 && state(player) < 40) {
      event.handled = true;
      setState(player, 38);
      player.sendMessage("The ruby key turns in the western gate.");
    }
  }

  function promptCode(player, key, index = 0, prefix = "", offset = 0) {
    const answer = ANSWERS[key];
    const letters = key === "ruby" ? ["U", "R", "D", "L"] : key === "emerald" || key === "diamond" ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") : "0123456789".split("");
    const current = answer[index];
    const groupSize = 4;
    const start = offset % Math.max(1, Math.ceil(letters.length / groupSize)) * groupSize;
    const choices = letters.slice(start, start + groupSize);
    if (!choices.includes(current)) choices.push(current);
    const distinct = [...new Set(choices)].slice(0, 4);
    const pairs = [];
    for (const choice of distinct) pairs.push(choice, () => {
      if (choice !== current) {
        player.sendMessage("The tumbler clicks into the wrong position. The lock resets.");
        activePrompts.delete(player);
        return;
      }
      if (index + 1 === answer.length) {
        activePrompts.delete(player);
        unlockChest(player, key);
      } else promptCode(player, key, index + 1, prefix + choice, 0);
    });
    pairs.push("More options", () => promptCode(player, key, index, prefix, (offset + 1) % Math.ceil(letters.length / groupSize)));
    activePrompts.set(player, { key, index, prefix });
    api.sendMultiChatboxPrompt(player, `Choose tumbler ${index + 1} (${prefix || "start"})`, ...pairs);
  }

  function unlockChest(player, key) {
    const current = state(player);
    const needed = key === "sapphire" ? 24 : key === "emerald" ? 26 : key === "ruby" ? 34 : 38;
    if (current !== needed) return;
    if (!player.getInventory().adds(KEYS[key], 1)) {
      player.sendMessage("You need an empty inventory slot to take the key.");
      return;
    }
    const next = key === "sapphire" ? 26 : key === "emerald" ? 30 : key === "ruby" ? 36 : 40;
    setState(player, next);
    player.sendMessage(`The lock opens. You take the ${key} key.`);
  }

  function spawnAssassin(player, area, x = 2920, y = 6375) {
    const current = player.getAttribute("desert-treasure-ii:sucellus-prison-assassin");
    if (current?.isRegistered?.() && area.entities.includes(current)) return current;
    const npc = api.core.NPC.create(N.ASSASSIN_7, areaLocation(area, x, y, 2));
    npc.setOwner?.(player);
    npc.setOwnerOnly?.(true);
    npc.__skipDefaultRespawn = true;
    area.add(npc);
    api.core.World.getAddNPCQueue().push(npc);
    player.setAttribute("desert-treasure-ii:sucellus-prison-assassin", npc);
    return npc;
  }

  function removeOwnedNpc(area, npc) {
    if (!npc) return;
    const add = api.core.World.getAddNPCQueue();
    for (let i = add.indexOf(npc); i >= 0; i = add.indexOf(npc)) add.splice(i, 1);
    if (npc.isRegistered?.() && !api.core.World.getRemoveNPCQueue().includes(npc)) api.core.World.getRemoveNPCQueue().push(npc);
    area.remove?.(npc);
  }

  function spawnJhallan(area, player, id, x, y, hitpoints) {
    const npc = api.core.NPC.create(id, areaLocation(area, x, y, 2));
    if (hitpoints) npc.setMaxHitpoints?.(hitpoints).setHitpoints?.(hitpoints);
    npc.setOwner?.(player);
    npc.setOwnerOnly?.(true);
    area.add(npc);
    api.core.World.getAddNPCQueue().push(npc);
    npc.setCombatFollowing?.(player);
    return npc;
  }

  function talkAssassin(event) {
    const { player, npcId } = event;
    const progress = state(player);
    if (!player.getAttribute(ESCAPED) || ![N.ASSASSIN_7, N.ASSASSIN_8].includes(npcId)) return;
    const area = player.getAttribute(AREA);
    if (!atArea(player, area)) return;
    event.handled = true;
    if (progress >= 40 && progress < 46 && has(player, KEYS.diamond)) {
      startTranscript(api, player, npcId, PAGE, "duke-sucellus-of-the-sixth-legion-talking-to-the-assassin-after-getting-the-diamond-key");
    } else if (progress >= 50 && progress < 52) {
      startTranscript(api, player, npcId, PAGE, "duke-sucellus-of-the-sixth-legion-talking-to-the-assassin-after-getting-your-items-back");
    } else if (progress >= 56 && progress < 58) {
      startTranscript(api, player, npcId, PAGE, "duke-sucellus-of-the-sixth-legion-talking-to-the-assassin-after-jhallan-is-frozen");
    } else if (progress >= 22 && progress < 24) {
      startTranscript(api, player, npcId, PAGE, "duke-sucellus-of-the-sixth-legion-talking-to-the-assassin-again-before-getting-your-items-back");
    } else player.sendMessage("The Assassin is busy studying the prison's way to the asylum.");
  }

  function handleDialogueAction(event) {
    const { player, stepId } = event;
    if (!player?.getAttribute(ESCAPED)) return;
    if (stepId === "FyTltG" && state(player) >= 50) {
      setState(player, 52);
      removeOwnedNpc(player.getAttribute(AREA), player.getAttribute("desert-treasure-ii:sucellus-prison-assassin"));
      player.setAttribute("desert-treasure-ii:sucellus-prison-assassin", null);
    }
    if (stepId === "IME-83" && state(player) >= 56) {
      setState(player, 58);
      player.setAttribute(COMPLETE, true);
      api.emitCustomEvent("dt2:sucellus-prison:complete", { player });
      removeOwnedNpc(player.getAttribute(AREA), player.getAttribute("desert-treasure-ii:sucellus-prison-assassin"));
      player.setAttribute("desert-treasure-ii:sucellus-prison-assassin", null);
    }
  }

  function handleObject(event) {
    const { player } = event;
    const area = player?.getAttribute(AREA);
    if (!player?.getAttribute(ESCAPED) || !atArea(player, area)) return;
    const progress = state(player);
    const tile = eventTile(event, area);
    const id = objectId(event);
    const option = String(event.option ?? "").toLowerCase();
    const onTile = (key) => isTile(tile, TILES[key]);

    if (id === 49120 && onTile("padlock") && (option === "unlock" || option === "open" || option === "pick")) {
      event.handled = true;
      if (progress < 22 || !has(player, LOCKPICK)) return player.sendMessage("The Assassin's lockpick should open this gate.");
      setState(player, Math.max(24, progress));
      player.sendMessage("You pick the padlock and open the gate into the prison administrative rooms.");
      return;
    }

    const chest = CODE_CHEST[tile?.join(",")];
    if (chest && (option === "open" || option === "unlock" || option === "search" || option === "attempt to open")) {
      const [key, required] = chest;
      if (progress < required || has(player, KEYS[key])) return;
      event.handled = true;
      promptCode(player, key);
      return;
    }

    if (onTile("altar") && option === "search" && progress === 24) {
      event.handled = true;
      player.sendMessage("You search the altar and find a warning note about the prison's locks.");
      if (!has(player, I.WARNING_LETTER)) player.getInventory().adds(I.WARNING_LETTER, 1);
      return;
    }

    if (onTile("diamondGate") && (option === "open" || option === "unlock") && progress >= 36 && progress < 40) {
      event.handled = true;
      if (!has(player, KEYS.ruby)) return player.sendMessage("The western gate needs the ruby key.");
      setState(player, 38);
      player.sendMessage("The ruby key turns. The western cell opens.");
      return;
    }

    if (onTile("gear") && (option === "search" || option === "open") && progress >= 46 && progress < 50) {
      event.handled = true;
      if (!has(player, KEYS.diamond)) return player.sendMessage("The equipment chest is still locked.");
      if (!player.getAttribute(GEAR_RETURNED)) {
        player.setAttribute(GEAR_RETURNED, true);
        api.emitCustomEvent("dt2:sucellus-prison:return-stash", { player });
      }
      setState(player, 50);
      player.sendMessage("You search the chest and recover your belongings.");
      spawnAssassin(player, area, 2903, 6383);
      return;
    }

    if (onTile("fireworks") && (option === "search" || option === "light") && progress === 52) {
      event.handled = true;
      if (option === "search") {
        api.sendMultiChatboxPrompt(player, "Light the firecrackers?", "Yes", () => startDefence(player, area), "No", () => {});
      } else startDefence(player, area);
      return;
    }

    if (onTile("asylum") && (option === "enter" || option === "open" || option === "climb")) {
      if (progress < 58 || !player.getAttribute(COMPLETE)) {
        event.handled = true;
        player.sendMessage("Jhallan still blocks the way to the asylum.");
      }
      return false;
    }
  }

  function startDefence(player, area) {
    if (state(player) !== 52 || player.getAttribute(FIREWORKS)) return;
    player.setAttribute(FIREWORKS, true);
    player.setAttribute(DEFENCE_START, api.core.World.getProcessCycle());
    setState(player, 54);
    api.emitCustomEvent("dt2:sucellus-prison:journal", { player, lines: ["Survive Jhallan's assault until the Assassin freezes him.", "Protect from Magic and keep moving around the pillar."] });
    // Cache 12353 is the live, 1,500 HP, 30-max-hit, four-tick magic attacker.
    // Its ordinary combat path applies Protect from Magic; 12355 is dialogue-only.
    const jhallan = spawnJhallan(area, player, N.JHALLAN_3, 2975, 6362, 1500);
    defences.set(player, { clones: [], shadowsSpawned: false });
    player.setAttribute("desert-treasure-ii:sucellus-prison-jhallan", jhallan);
    startTranscript(api, player, N.JHALLAN_5, PAGE, "duke-sucellus-of-the-sixth-legion-getting-ambushed-by-jhallan-after-setting-off-the-fireworks");
  }

  function handleProcess(event) {
    const { player, area, cycle } = event ?? {};
    if (!player || !atArea(player, area) || state(player) !== 54) return;
    const started = Number(player.getAttribute(DEFENCE_START));
    if (!Number.isFinite(started)) return;
    const jhallan = player.getAttribute("desert-treasure-ii:sucellus-prison-jhallan");
    const defence = defences.get(player) ?? { clones: [], shadowsSpawned: false };
    const elapsed = cycle - started;
    // The Wiki describes Jhallan's shadow copies as one-hit enemies appearing
    // part-way through the three-minute defence. Cache 12354 is the matching
    // attackable Jhallan copy; its normal attack remains a magic attack.
    if (elapsed >= SHADOWS_AT && !defence.shadowsSpawned) {
      defence.shadowsSpawned = true;
      defence.clones.push(
        spawnJhallan(area, player, N.JHALLAN_4, 2973, 6363, 1),
        spawnJhallan(area, player, N.JHALLAN_4, 2977, 6363, 1),
      );
      defences.set(player, defence);
      player.sendMessage("Shadow copies of Jhallan converge on the camp.");
    }
    if (elapsed < 300) return;
    removeOwnedNpc(area, jhallan);
    for (const clone of defence.clones) removeOwnedNpc(area, clone);
    defences.delete(player);
    player.setAttribute("desert-treasure-ii:sucellus-prison-jhallan", null);
    player.setAttribute("desert-treasure-ii:sucellus-prison-assassin", null);
    spawnAssassin(player, area, 2978, 6371);
    setState(player, 56);
    player.sendMessage("The Assassin strikes and freezes Jhallan in place.");
    startTranscript(api, player, N.ASSASSIN_7, PAGE, "duke-sucellus-of-the-sixth-legion-talking-to-the-assassin-after-jhallan-is-frozen");
  }

  api.onCustomEvent("dt2:sucellus-prison:start", ({ player, area }) => {
    if (!player || !area || !player.getAttribute(ESCAPED)) return;
    if (!Number.isFinite(Number(player.getAttribute(PROGRESS)))) setState(player, 22);
    spawnAssassin(player, area);
  });
  api.onCustomEvent("dt2:sucellus-prison:resume", ({ player, area }) => {
    if (!player || !area || !player.getAttribute(ESCAPED)) return;
    if (state(player) >= 22 && state(player) < 58 && !player.getAttribute(FIREWORKS)) spawnAssassin(player, area);
  });
  api.onCustomEvent("dt2:sucellus-prison:process", handleProcess);
  api.onNpcInteraction("Assassin", { "Talk-to": talkAssassin });
  api.onNpcInteraction("Jhallan", { "Talk-to": (event) => {
    if (state(event.player) !== 54) return;
    event.handled = true;
    startTranscript(api, event.player, event.npcId, PAGE, "duke-sucellus-of-the-sixth-legion-getting-ambushed-by-jhallan");
  } });
  api.onObjectInteraction(handleObject);
  api.onItemOnObject(handleItemOnObject, { noted: false });
  api.onCustomEvent("npc-dialogue:action", handleDialogueAction);
  api.onItemAction("Prisoner's letter", { Read: (event) => {
    if (!event.player.getAttribute(ENTERED) || !has(event.player, I.PRISONERS_LETTER)) return;
    event.handled = true;
    event.player.setAttribute("desert-treasure-ii:sucellus-prison-letter-read", true);
    event.player.sendMessage("The letter warns that a knife and lockpick were hidden in the prison cell.");
  } });
  api.onCustomEvent("npc-dialogue:line", (event) => {
    if (event.npcId === N.ASSASSIN_7 && event.text === "Now, once again, let's get this cell open.") {
      event.after = () => setState(event.player, 46);
    }
  });
};
