// Vision capture harness: headless Chromium + CDP against a tsps dev client.
// Screenshots (Page.captureScreenshot) and short clips (Page.startScreencast,
// assembled with ffmpeg when available). Drives the client through its own
// handles: ?username=&password= auto-login, window.__osrsClient for the camera.
//
// Run: node client/tests/vision-capture.browser.cjs --url http://localhost:3103
//   --user visionbot --pass vision1234 --out shot.png [--yaw 1024 --pitch 300]
//   [--clip-secs 5 --clip-fps 10 --clip-out clip.mp4]
//
// Notes:
// - Plain `--headless=new` with NO webgpu/swiftshader flags: on modern Chromium
//   extra flags (notably --enable-unsafe-webgpu) actively disable the adapter.
//   Verified with hardware D3D11 on Windows; SwiftShader remains the fallback.
// - Screenshots are file paths by design (MCP tools return text); the agent
//   reads the PNGs back with its file tools for inspection.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const Ws = require("../node_modules/ws");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}

function findBrowser() {
  if (process.env.VISION_CHROME_PATH && fs.existsSync(process.env.VISION_CHROME_PATH)) {
    return process.env.VISION_CHROME_PATH;
  }
  for (const p of [
    // Windows.
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    // macOS.
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    // Linux.
    "/usr/bin/microsoft-edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ]) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("no Chromium found (set VISION_CHROME_PATH)");
}

// Default client URL: explicit --url, then VISION_CLIENT_URL, then this
// worktree's own client port (scripts/wt writes PORT into root .env),
// falling back to the main checkout default (docs/worktrees.md).
function defaultUrl() {
  if (process.env.VISION_CLIENT_URL) return process.env.VISION_CLIENT_URL;
  try {
    const root = path.resolve(__dirname, "..", "..");
    const env = fs.readFileSync(path.join(root, ".env"), "utf8");
    const match = env.match(/^PORT=(\d+)\s*$/m);
    if (match) return `http://localhost:${match[1]}`;
  } catch {}
  return "http://localhost:3000";
}

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

// Chromium children outlive a plain kill on the wrapper pid (detached tree),
// which then holds the bot's login and blocks the next run. Kill the wrapper
// tree plus any browser pid that appeared after harness start (baseline diff),
// so a lingering renderer can never squat the account. Never touches browsers
// that were already running (e.g. the user's own window).
function browserPids() {
  try {
    const { execFileSync } = require("node:child_process");
    const out = execFileSync("tasklist", ["/FI", "IMAGENAME eq msedge.exe", "/FI", "IMAGENAME eq chrome.exe", "/FO", "CSV", "/NH"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15000 });
    const pids = new Set();
    for (const m of out.matchAll(/"(\d+)"\s*$/gm)) pids.add(Number(m[1]));
    return pids;
  } catch {
    return new Set();
  }
}

function killBrowser(proc, baseline) {
  if (proc && proc.pid != null) {
    try {
      if (process.platform === "win32") {
        require("node:child_process").execFileSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"],
          { stdio: "ignore", timeout: 15000 });
      } else {
        try { process.kill(-proc.pid, "SIGKILL"); } catch { try { proc.kill("SIGKILL"); } catch {} }
      }
    } catch {
      try { proc.kill(); } catch {}
    }
  }
  if (process.platform === "win32" && baseline) {
    try {
      const { execFileSync } = require("node:child_process");
      for (const pid of browserPids()) {
        if (!baseline.has(pid)) {
          try { execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", timeout: 15000 }); } catch {}
        }
      }
    } catch {}
  }
}

function createCdp(url) {
  const ws = new Ws(url, { maxPayload: 512 * 1024 * 1024 });
  let id = 0;
  const pending = new Map();
  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg.id != null && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      p(msg);
    } else if (msg.method === "Page.screencastFrame" && ws.onScreencastFrame) {
      ws.onScreencastFrame(msg.params);
    }
  });
  return {
    ws,
    opened: new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); }),
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const myId = ++id;
        pending.set(myId, resolve);
        ws.send(JSON.stringify({ id: myId, method, params }), (err) => {
          if (err) { pending.delete(myId); reject(err); }
        });
        setTimeout(() => {
          if (pending.has(myId)) { pending.delete(myId); reject(new Error(`cdp timeout: ${method}`)); }
        }, 60000);
      });
    },
    async evaluate(expression) {
      // CDP wraps the value twice: { result: { result: { value } } }.
      const r = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || JSON.stringify(r.exceptionDetails));
      if (r.error) throw new Error(r.error.message || JSON.stringify(r.error));
      return r.result?.result?.value;
    },
  };
}

const CLIENT_JS = `(() => window.osrsClient ?? window.__WEBGPU_RENDERER__?.osrsClient ?? window.__osrsClient ?? null)()`;

async function main() {
  const started = Date.now();
  const summary = { ok: false };
  const out = arg("out", null);
  const clipSecs = Number(arg("clip-secs", "0")) || 0;
  const timeoutMs = Number(arg("timeout-ms", "120000"));
  const deadline = Date.now() + timeoutMs;
  const viewport = (arg("viewport", "1280x800") || "1280x800").split("x").map(Number);
  let proc = null;
  let baseline = null;
  try {
    const target = new URL(arg("url", defaultUrl()));
    if (arg("user", null)) {
      target.searchParams.set("username", arg("user"));
      target.searchParams.set("password", arg("pass", ""));
    }
    if (arg("renderer", "webgpu") !== "none") target.searchParams.set("renderer", arg("renderer", "webgpu"));
    summary.url = target.href.replace(/password=[^&]*/, "password=***");

    const debugPort = await freePort();
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vision-cap-"));
    const bin = findBrowser();
    summary.browser = bin;
    baseline = browserPids();
    proc = spawn(bin, [
      "--headless=new", "--no-first-run", "--no-default-browser-check",
      "--mute-audio", "--hide-scrollbars",
      `--window-size=${viewport[0] | 0},${viewport[1] | 0}`,
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ], { stdio: "ignore", detached: true });
    proc.unref();

    const tab = await waitForTab(debugPort, Math.min(deadline - Date.now(), 30000));
    const cdp = createCdp(tab.webSocketDebuggerUrl);
    await cdp.opened;
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", { url: target.href });

    // Wait for frames, then for a logged-in world (or time out with a login-screen shot).
    // Field paths mirror webgpu-smoke's rendererState: stats.frameCount,
    // mapManager.visibleMaps.length, osrsClient.isLoggedIn().
    const needLogin = !!arg("user", null);
    const state = await waitFor(cdp, deadline, async () => {
      try {
        return await cdp.evaluate(`(() => {
          const c = ${CLIENT_JS};
          const r = window.__WEBGPU_RENDERER__ ?? (c && c.renderer) ?? null;
          if (!r) return { present: false };
          return {
            present: true,
            running: r.running === true,
            frames: Number(r.stats && r.stats.frameCount) || 0,
            loggedIn: !!(c && c.isLoggedIn && c.isLoggedIn()),
            maps: (r.mapManager && r.mapManager.visibleMaps) ? r.mapManager.visibleMaps.length : 0,
          };
        })()`);
      } catch { return { present: false }; }
    }, (s) => s && s.present && (s.frames > 0) && (!needLogin || (s.loggedIn && s.maps > 0)));
    summary.client = state;
    await dismissWelcome(cdp);

    const yaw = arg("yaw", null), pitch = arg("pitch", null);
    if (yaw !== null || pitch !== null) {
      summary.camera = await cdp.evaluate(`(() => {
        const c = ${CLIENT_JS};
        if (!c || !c.camera) return "no-camera";
        ${yaw !== null ? `c.camera.snapToYaw(${Number(yaw) | 0});` : ""}
        ${pitch !== null ? `c.camera.snapToPitch(${Number(pitch) | 0});` : ""}
        return { yaw: c.camera.yaw | 0, pitch: c.camera.pitch | 0 };
      })()`);
      await sleep(Number(arg("settle-ms", "1500")));
    } else {
      await sleep(Number(arg("settle-ms", "2500")));
    }

    // Staging hold: print READY after login+camera so an external driver can
    // arrange the scene (MCP teleports etc.), then the shot fires.
    const holdSecs = Number(arg("hold-secs", "0")) || 0;
    if (holdSecs > 0) {
      console.log("VISION_READY " + JSON.stringify({ camera: summary.camera ?? null }));
      await sleep(Math.min(holdSecs, 300) * 1000);
    }

    if (out) {
      const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
      if (shot.error) throw new Error(shot.error.message || JSON.stringify(shot.error));
      const data = shot.result?.data;
      if (!data) throw new Error("captureScreenshot returned no pixels");
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      fs.writeFileSync(out, Buffer.from(data, "base64"));
      summary.screenshot = path.resolve(out);
    }

    if (clipSecs > 0) {
      summary.clip = await recordClip(cdp, {
        secs: clipSecs,
        fps: Number(arg("clip-fps", "10")) || 10,
        out: arg("clip-out", null),
        framesDir: arg("frames-dir", null),
        viewport,
      });
    }
    summary.ok = true;
  } catch (error) {
    summary.error = String(error?.message ?? error);
  } finally {
    if (proc) killBrowser(proc, baseline);
  }
  summary.ms = Date.now() - started;
  console.log(JSON.stringify(summary));
  process.exit(summary.ok ? 0 : 1);
}

async function waitForTab(port, budgetMs) {
  const end = Date.now() + budgetMs;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const tabs = await res.json();
      const page = tabs.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {}
    if (Date.now() > end) throw new Error("no devtools page tab");
    await sleep(500);
  }
}

async function waitFor(cdp, deadline, read, done) {
  let last = null;
  for (;;) {
    last = await read();
    if (done(last)) return last;
    if (Date.now() > deadline) return last;
    await sleep(750);
  }
}

async function dismissWelcome(cdp) {
  try {
    const closed = await cdp.evaluate(`(() => {
      const client = window.osrsClient;
      if (!client || !client.widgetManager || client.widgetManager.rootInterface !== 378) return "n/a";
      const widget = client.widgetManager.getWidgetByUid((378 << 16) | 72);
      if (!widget) return "missing-play";
      client.handleWidgetAction({ widget, option: "Play", opIndex: 1, source: "primary" });
      return "dismissed";
    })()`);
    return closed;
  } catch {
    return "error";
  }
}

async function recordClip(cdp, { secs, fps, out, framesDir, viewport }) {
  const frames = [];
  cdp.ws.onScreencastFrame = async (params) => {
    frames.push(Buffer.from(params.data, "base64"));
    try {
      await cdp.send("Page.screencastFrameAck", { sessionId: params.sessionId });
    } catch {}
  };
  const everyNth = Math.max(1, Math.round(30 / Math.max(1, fps)));
  await cdp.send("Page.startScreencast", {
    format: "jpeg", quality: 80,
    maxWidth: viewport[0] | 0, maxHeight: viewport[1] | 0,
    everyNthFrame: everyNth,
  });
  await sleep(Math.max(500, secs * 1000));
  try { await cdp.send("Page.stopScreencast"); } catch {}
  await sleep(500);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = framesDir || path.join(process.cwd(), `clip-frames-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  frames.forEach((b, i) => fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, "0")}.jpg`), b));
  const result = { frames: frames.length, framesDir: path.resolve(dir) };
  if (out && frames.length > 0) {
    try {
      const { spawnSync } = require("node:child_process");
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      // Measured capture rate keeps the clip realtime (requested fps only sets density).
      const measuredFps = Math.max(1, Math.round(frames.length / Math.max(1, secs)));
      result.measuredFps = measuredFps;
      // Encoder order: Intel Quick Sync, MediaFoundation, then baseline mpeg4.
      // (libx264 is present but fails to open on some Windows Store builds;
      // mpeg4-in-mp4 does not play in stock Windows players.)
      const attempts = [
        ["-c:v", "h264_qsv", "-pix_fmt", "nv12", "-b:v", "4M"],
        ["-c:v", "h264_mf", "-b:v", "4M"],
        ["-c:v", "mpeg4", "-q:v", "3", "-pix_fmt", "yuv420p"],
      ];
      for (const codecArgs of attempts) {
        const r = spawnSync("ffmpeg", ["-y", "-framerate", String(measuredFps),
          "-i", path.join(dir, "f%04d.jpg"), ...codecArgs, path.resolve(out)],
          { stdio: "ignore" });
        if (r.status === 0 && fs.existsSync(path.resolve(out))
          && fs.statSync(path.resolve(out)).size > 0) {
          result.video = path.resolve(out);
          result.videoCodec = codecArgs[1];
          break;
        }
        result.videoError = `ffmpeg ${codecArgs[1]} exit ${r.status}`;
      }
    } catch (e) {
      result.videoError = String(e?.message ?? e);
    }
  }
  return result;
}

main();
