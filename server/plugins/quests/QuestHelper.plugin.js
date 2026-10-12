const { getRegisteredQuests } = require("./QuestRuntime");

const DATASET = "questHelper";
const tracking = new WeakMap();

function status(quest, player) {
  return quest.isComplete(player) ? 2 : quest.isStarted(player) ? 0 : 1;
}

function send(player, row) {
  player.getPacketSender().sendContentData("server", [{ key: DATASET, rows: [row] }]);
}

function sendCatalog({ player }) {
  if (player.isPlayerBot?.() === true) return;
  send(player, {
    kind: "catalog",
    quests: getRegisteredQuests().map((quest) => ({
      key: quest.key, name: quest.name, status: status(quest, player),
    })).sort((a, b) => a.name.localeCompare(b.name)),
  });
}

function snapshot(player, quest) {
  return {
    kind: "quest",
    key: quest.key,
    name: quest.name,
    stage: quest.getStage(player),
    status: status(quest, player),
    journal: quest.buildJournal?.(player, quest) ?? [],
    facts: quest.key === "cooks_assistant" ? {
      flour: Number(player.getAttribute("windmill:flour")) || 0,
      hopper: player.getAttribute("windmill:hopper") === true,
    } : {},
  };
}

function updateTracked({ player }) {
  const current = tracking.get(player);
  if (!current) return;
  const row = snapshot(player, current.quest);
  const signature = JSON.stringify(row);
  if (signature === current.signature) return;
  send(player, row);
  current.signature = signature;
}

function helperCommand({ player, parts }) {
  const key = parts.slice(1).join(" ");
  if (key === "stop") {
    tracking.delete(player);
    send(player, { kind: "stop" });
    return true;
  }
  if (key === "list") {
    sendCatalog({ player });
    return true;
  }
  const quest = getRegisteredQuests().find((entry) => entry.key === key);
  if (!quest) {
    player.sendMessage("Choose a quest from the Quest Helper sidebar.");
    return true;
  }
  tracking.set(player, { quest, signature: null });
  updateTracked({ player });
  return true;
}

function clearTracked({ player }) {
  tracking.delete(player);
}

module.exports = {
  name: "Quest Helper",
  register(api) {
    api.registerCommand("questhelper", helperCommand, api.core.PlayerRights.NONE, "Track a quest in the Quest Helper sidebar");
    api.onCustomEvent("player:bootstrap-complete", sendCatalog);
    api.onCustomEvent("quest:stage-changed", sendCatalog);
    api.onPlayerProcess(updateTracked);
    api.onPlayerLogout(clearTracked);
  },
  _test: { helperCommand, sendCatalog, updateTracked, clearTracked, snapshot },
};
