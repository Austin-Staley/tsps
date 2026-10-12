// Vision tools: screenshots and short clips of an online player through a
// headless rendering client (see client/tests/vision-capture.browser.cjs).
// The MCP server is stateless, so every call boots its own browser, logs the
// named player in through it (taking over any headless session), aims the
// camera, captures, and shuts down. Scene setup stays with the existing tools
// (command/teleport, interact, npc_option, ...); these only observe.
// Results are file paths as text (the harness prints JSON); agents read the
// PNG/JPEG frames back with their file tools for inspection.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function worktreeRoot() {
  return path.resolve(__dirname, "..", "..", "..", "..");
}

function captureDir() {
  if (process.env.VISION_CAPTURE_DIR) return process.env.VISION_CAPTURE_DIR;
  return path.join(worktreeRoot(), "..", "tsps-vision-captures");
}

function clientUrl(ctx) {
  if (process.env.VISION_CLIENT_URL) return process.env.VISION_CLIENT_URL;
  // The worktree's own client port (scripts/wt writes PORT into root .env);
  // main checkout has none and keeps the 3000 default (docs/worktrees.md).
  try {
    const env = fs.readFileSync(path.join(worktreeRoot(), ".env"), "utf8");
    const match = env.match(/^PORT=(\d+)\s*$/m);
    if (match) return `http://localhost:${match[1]}`;
  } catch {}
  void ctx;
  return "http://localhost:3000";
}

function runHarness(args, timeoutMs) {
  const harness = path.join(worktreeRoot(), "client", "tests", "vision-capture.browser.cjs");
  if (!fs.existsSync(harness)) throw new Error(`vision harness missing: ${harness}`);
  const started = Date.now();
  const run = spawnSync(process.execPath, [harness, ...args], {
    encoding: "utf8",
    timeout: Math.max(60000, timeoutMs),
    maxBuffer: 4 * 1024 * 1024,
  });
  if (run.error) throw new Error(`vision harness failed to run: ${run.error.message}`);
  const lines = String(run.stdout ?? "").trim().split("\n");
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
  if (!summary) throw new Error(`vision harness produced no summary (exit ${run.status}): ${String(run.stderr ?? "").slice(0, 300)}`);
  summary.wallMs = Date.now() - started;
  if (!summary.ok) throw new Error(`vision capture failed: ${summary.error ?? "unknown"}`);
  return summary;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

module.exports = function registerVisionTools(ctx) {
  const { player, tool, z } = ctx;
  const yaw = z.number().int().min(0).max(2047).optional()
    .describe("Camera yaw (0-2047). Omit to keep the player's current view.");
  const pitch = z.number().int().min(0).max(512).optional()
    .describe("Camera pitch (0 level - 512 down). Omit to keep the player's current view.");
  const filename = z.string().min(1).max(80).optional()
    .describe("File name in the captures folder (default timestamped).");

  tool(
    "vision_screenshot",
    "Capture what the named online player sees right now through a headless game client (WebGPU): logs them in through it, aims the optional camera, screenshots to PNG. Arrange the scene first (command/teleport, interact, ...). Returns the PNG path for inspection.",
    { player, yaw, pitch, filename },
    ({ player: username, yaw: y, pitch: p, filename: name }) => {
      const dir = captureDir();
      fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, name ?? `shot-${stamp()}.png`);
      const args = ["--url", clientUrl(ctx), "--user", username, "--pass", process.env.VISION_BOT_PASSWORD ?? "vision1234",
        "--out", out, "--settle-ms", "2500"];
      if (y !== undefined) args.push("--yaw", String(y));
      if (p !== undefined) args.push("--pitch", String(p));
      const summary = runHarness(args, 240000);
      return { screenshot: summary.screenshot, camera: summary.camera ?? null, client: summary.client ?? null, ms: summary.wallMs };
    }
  );

  tool(
    "vision_clip",
    "Record a short clip of what the named online player sees (CDP screencast frames assembled to MP4 with ffmpeg when available, else JPEG frames). Keep under ~15 seconds. Returns the video path (or frames dir).",
    {
      player, yaw, pitch, filename,
      seconds: z.number().int().min(1).max(30).default(8).describe("Clip length in seconds."),
    },
    ({ player: username, yaw: y, pitch: p, filename: name, seconds }) => {
      const dir = captureDir();
      fs.mkdirSync(dir, { recursive: true });
      const base = (name ?? `clip-${stamp()}`).replace(/\.(mp4|png|jpg)$/i, "");
      const args = ["--url", clientUrl(ctx), "--user", username, "--pass", process.env.VISION_BOT_PASSWORD ?? "vision1234",
        "--out", path.join(dir, `${base}.png`),
        "--clip-secs", String(seconds), "--clip-fps", "10",
        "--clip-out", path.join(dir, `${base}.mp4`),
        "--frames-dir", path.join(dir, `${base}-frames`),
        "--settle-ms", "2500"];
      if (y !== undefined) args.push("--yaw", String(y));
      if (p !== undefined) args.push("--pitch", String(p));
      const summary = runHarness(args, 240000 + seconds * 1000);
      return {
        video: summary.clip?.video ?? null,
        videoCodec: summary.clip?.videoCodec ?? null,
        videoError: summary.clip?.videoError ?? null,
        frames: summary.clip?.frames ?? 0,
        framesDir: summary.clip?.framesDir ?? null,
        screenshot: summary.screenshot ?? null,
        ms: summary.wallMs,
      };
    }
  );
};
