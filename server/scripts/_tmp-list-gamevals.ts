import path = require("path");
import { CachePipeline } from "../src/main/typescript/elvarg/game/cache/CachePipeline";
import { GamevalKind, Gamevals } from "../src/main/typescript/elvarg/game/cache/Gamevals";

async function main() {
  await CachePipeline.initialize(path.resolve(__dirname, ".."));
  const gamevals = new Gamevals();
  for (let kind = 0; kind <= 20; kind++) {
    try {
      const names = gamevals.namesOf(kind as GamevalKind);
      if (names.size === 0) continue;
      const sample = [...names.entries()]
        .slice(0, 4)
        .map(([id, name]) => `${id}=${name}`)
        .join(", ");
      console.log(`kind=${kind} size=${names.size} sample: ${sample}`);
      if (kind === 5 || kind === 11 || kind === 12) {
        console.log(`  id46=${names.get(46) ?? "-"} id22124=${names.get(22124) ?? "-"} id592=${names.get(592) ?? "-"}`);
      }
    } catch (error) {
      console.log(`kind=${kind} error ${String(error).slice(0, 120)}`);
    }
  }
}

main();
