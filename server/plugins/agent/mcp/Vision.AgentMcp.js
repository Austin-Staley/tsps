// Vision tools: screenshots and short clips of an online player through a
// headless rendering client (see client/tests/vision-capture.browser.cjs).
// The MCP server is stateless, so every call boots its own browser, logs the
// named player in through it (taking over any headless session), aims the
// camera, captures, and shuts down. Scene setup stays with the existing tools
// (command/teleport, interact, npc_option, ...); these only observe.
//
// Export layout, all under <worktree>/vision-exports/ (git-ignored):
//   <run-id>/logs/run.log                 one tick-stamped line per vision call
//   <run-id>/logs/harness-<ts>.json       full harness summary per call
//   <run-id>/screenshots/t<TICK>-<label>.png
//   <run-id>/videos/t<TICK>-<label>.mp4   (+ t<TICK>-<label>-frames/)
// The server tick in file names ties media to run.log lines (completion tick;
// capture and naming are seconds apart, so within a few ticks). Results are
// file paths as text; agents read the PNG/JPEG frames back to inspect them.
// ASYNC on purpose: spawnSync would block this server's event loop for the
// whole capture, so the browser's own login request could never be processed
// (server and harness waiting on each other = deadlock). Async spawn keeps the
// world ticking while the capture runs.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function worktreeRoot() {
  return path.resolve(__dirname, "..", "..", "..", "..");
}

function exportsRoot() {
  if (process.env.VISION_EXPORT_DIR) return process.env.VISION_EXPORT_DIR;
  return path.join(worktreeRoot(), "vision-exports");
}

function clientUrl() {
  if (process.env.VISION_CLIENT_URL) return process.env.VISION_CLIENT_URL;
  // The worktree's own client port (scripts/wt writes PORT into root .env);
  // main checkout has none and keeps the 3000 default (docs/worktrees.md).
  try {
    const env = fs.readFileSync(path.join(worktreeRoot(), ".env"), "utf8");
    const match = env.match(/^PORT=(\d+)\s*$/m);
    if (match) return `http://localhost:${match[1]}`;
  } catch {}
  return "http://localhost:3000";
}

function serverTick(ctx) {
  try {
    const tick = ctx?.core?.World?.getProcessCycle?.();
    if (Number.isInteger(tick) && tick >= 0) return tick;
  } catch {}
  return null;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function sanitizeLabel(label, fallback) {
  const clean = String(label ?? "").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return clean || fallback;
}

function resolveRunDir(runLabel, username) {
  const base = exportsRoot();
  const runId = sanitizeLabel(runLabel, `${stamp()}-${String(username).toLowerCase()}`);
  const runDir = path.join(base, runId);
  for (const sub of ["logs", "screenshots", "videos"]) {
    fs.mkdirSync(path.join(runDir, sub), { recursive: true });
  }
  return { runDir, runId };
}

function logRun(runDir, line) {
  fs.appendFileSync(path.join(runDir, "logs", "run.log"), `${new Date().toISOString()} ${line}\n`);
}

function uniquePath(dir, name) {
  let candidate = path.join(dir, name);
  if (!fs.existsSync(candidate)) return candidate;
  const ext = path.extname(name);
  const stem = path.basename(name, ext);
  for (let index = 2; index < 1000; index++) {
    candidate = path.join(dir, `${stem}-${index}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  return candidate;
}

function runHarness(args, timeoutMs) {
  const harness = path.join(worktreeRoot(), "client", "tests", "vision-capture.browser.cjs");
  if (!fs.existsSync(harness)) return Promise.reject(new Error(`vision harness missing: ${harness}`));
  const started = Date.now();
  const budget = Math.max(60000, timeoutMs);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [harness, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let errBuf = "";
    child.stdout.on("data", (chunk) => { out += String(chunk); });
    child.stderr.on("data", (chunk) => { errBuf += String(chunk); });
    const killer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch {}
      reject(new Error(`vision harness exceeded ${budget}ms`));
    }, budget);
    child.on("error", (error) => {
      clearTimeout(killer);
      reject(new Error(`vision harness failed to run: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(killer);
      const lines = out.trim().split("\n");
      let summary = null;
      for (let index = lines.length - 1; index >= 0; index--) {
        try {
          const parsed = JSON.parse(lines[index]);
          if (parsed && typeof parsed === "object" && "ok" in parsed) {
            summary = parsed;
            break;
          }
        } catch {}
      }
      if (!summary) {
        reject(new Error(`vision harness produced no summary (exit ${code}): ${String(errBuf).slice(0, 300)}`));
        return;
      }
      summary.wallMs = Date.now() - started;
      if (!summary.ok) {
        reject(new Error(`vision capture failed: ${summary.error ?? "unknown"}`));
        return;
      }
      resolve(summary);
    });
  });
}

module.exports = function registerVisionTools(ctx) {
  const { player, tool, z } = ctx;
  const yaw = z.number().int().min(0).max(2047).optional()
    .describe("Camera yaw (0-2047). Omit to keep the player's current view.");
  const pitch = z.number().int().min(0).max(512).optional()
    .describe("Camera pitch (0 level - 512 down). Omit to keep the player's current view.");
  const run = z.string().min(1).max(60).optional()
    .describe("Run label grouping captures into one vision-exports/<run>/ folder (default: timestamped per call).");
  const label = z.string().min(1).max(60).optional()
    .describe("Short label for the file names, e.g. lumbridge, araxxor-lair (default: tool name).");

  tool(
    "vision_screenshot",
    "Capture what the named online player sees right now through a headless game client (WebGPU): logs them in through it, aims the optional camera, screenshots to PNG under vision-exports/<run>/screenshots with the server tick in the name. Arrange the scene first (command/teleport, interact, ...). Returns paths for inspection.",
    { player, yaw, pitch, run, label },
    async ({ player: username, yaw: y, pitch: p, run: runLabel, label: name }) => {
      const tickStart = serverTick(ctx);
      const { runDir, runId } = resolveRunDir(runLabel, username);
      const args = ["--url", clientUrl(), "--user", username, "--pass", process.env.VISION_BOT_PASSWORD ?? "vision1234",
        "--settle-ms", "2500"];
      if (y !== undefined) args.push("--yaw", String(y));
      if (p !== undefined) args.push("--pitch", String(p));
      const tickShot = serverTick(ctx);
      const out = uniquePath(path.join(runDir, "screenshots"),
        `t${String(tickShot ?? 0).padStart(7, "0")}-${sanitizeLabel(name, "screenshot")}.png`);
      const summary = await runHarness([...args, "--out", out], 240000);
      const tickEnd = serverTick(ctx);
      fs.writeFileSync(path.join(runDir, "logs", `harness-${stamp()}.json`), JSON.stringify(summary, null, 2));
      logRun(runDir, `tick ${tickStart}->${tickEnd} tool=vision_screenshot player=${username} ` +
        `camera=${JSON.stringify(summary.camera ?? null)} files=${path.relative(runDir, summary.screenshot)}`);
      return { run: runId, screenshot: summary.screenshot, tick: tickEnd, camera: summary.camera ?? null, client: summary.client ?? null, ms: summary.wallMs };
    }
  );

  tool(
    "vision_clip",
    "Record a short clip of what the named online player sees (CDP screencast frames assembled to MP4 with ffmpeg when available, else JPEG frames), stored under vision-exports/<run>/videos with the server tick in the name. Keep under ~15 seconds. Returns paths for inspection.",
    {
      player, yaw, pitch, run, label,
      seconds: z.number().int().min(1).max(30).default(8).describe("Clip length in seconds."),
    },
    async ({ player: username, yaw: y, pitch: p, run: runLabel, label: name, seconds }) => {
      const tickStart = serverTick(ctx);
      const { runDir, runId } = resolveRunDir(runLabel, username);
      const args = ["--url", clientUrl(), "--user", username, "--pass", process.env.VISION_BOT_PASSWORD ?? "vision1234",
        "--settle-ms", "2500"];
      if (y !== undefined) args.push("--yaw", String(y));
      if (p !== undefined) args.push("--pitch", String(p));
      const tickShot = serverTick(ctx);
      const base = `t${String(tickShot ?? 0).padStart(7, "0")}-${sanitizeLabel(name, "clip")}`;
      const videoDir = path.join(runDir, "videos");
      const summary = await runHarness([...args,
        "--out", uniquePath(path.join(runDir, "screenshots"), `${base}.png`),
        "--clip-secs", String(seconds), "--clip-fps", "10",
        "--clip-out", path.join(videoDir, `${base}.mp4`),
        "--frames-dir", path.join(videoDir, `${base}-frames`)], 240000 + seconds * 1000);
      const tickEnd = serverTick(ctx);
      fs.writeFileSync(path.join(runDir, "logs", `harness-${stamp()}.json`), JSON.stringify(summary, null, 2));
      const files = [summary.screenshot, summary.clip?.video ?? summary.clip?.framesDir ?? null].filter(Boolean)
        .map((f) => path.relative(runDir, f)).join(",");
      logRun(runDir, `tick ${tickStart}->${tickEnd} tool=vision_clip player=${username} seconds=${seconds} ` +
        `camera=${JSON.stringify(summary.camera ?? null)} files=${files}`);
      return {
        run: runId,
        video: summary.clip?.video ?? null,
        videoCodec: summary.clip?.videoCodec ?? null,
        videoError: summary.clip?.videoError ?? null,
        frames: summary.clip?.frames ?? 0,
        framesDir: summary.clip?.framesDir ?? null,
        screenshot: summary.screenshot ?? null,
        tick: tickEnd,
        ms: summary.wallMs,
      };
    }
  );
};
