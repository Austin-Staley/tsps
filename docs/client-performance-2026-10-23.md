# Client performance comparison — 23 October 2026

The camera benchmark uses the reported scene at **3104,3508,0**, with **117 HD,
GPU, Animation Smoothing and Camera enabled**. The finished branch reduces CPU
work and frame spikes without lowering the requested quality. CPU stress still
produces missed frames; this is not a claim that panning is now smooth on every PC.

## Builds and method

- Current-main baseline: `01a1770e9e5ed904ebc98645969be3b6e31e9603`, production
  `main.a5c1c569.js` (SHA256 `58cb2ab8024d03bc8d02946fb22d88fa534815ccf2ab391a6cf19f23bc19fd6f`).
- Performance product source: `849ab16fc`, production `main.713c8668.js`. Later
  benchmark/documentation/browser-test commits do not change the deployed product.
- Apple M5 Pro, native Apple Metal WebGPU, Chrome 156 headless; four existing cache
  workers and cross-origin isolation in both builds. The cache manifest, indexes
  and dat2 file matched byte for byte. Separate worktree servers used a copied
  test-account save at the same position.
- Draw distance 25, 4× MSAA, GPU FPS limit 240, all HD options enabled, DPR 1.
  The native canvas and scene viewport were 1234×633. The resolution stress case
  rendered 2468×1266 while retaining the same CSS size: four times as many pixels.
- Each case warms for 16 seconds, then records four eight-second windows in
  idle/turn/turn/idle order. The first 1.5 seconds of each window are excluded.
  Turning supplies 512 yaw units/second through the accumulated camera-drag input.
  The tables pool the two turning windows. Builds, tests and other QA browsers
  were paused or closed during measurements.

The checked-in driver is `client/tests/camera-pan-benchmark.browser.cjs`. Log in
on the worktree's own port, dismiss the Welcome Screen, teleport the test account
to the stated position through its own agent MCP, and enable the four plugins:

```sh
CDP_PORT=9333 CPU_SLOWDOWN=1 RENDER_SCALE=1 node client/tests/camera-pan-benchmark.browser.cjs /tmp/camera-native.json
CDP_PORT=9333 CPU_SLOWDOWN=6 RENDER_SCALE=1 node client/tests/camera-pan-benchmark.browser.cjs /tmp/camera-cpu6.json
CDP_PORT=9333 CPU_SLOWDOWN=1 RENDER_SCALE=2 node client/tests/camera-pan-benchmark.browser.cjs /tmp/camera-scale2.json
```

Use the same driver in both checkouts. Its SHA256 for these captures is
`f4d4ca684ebf2bb0fe1d36e9d47ed521b8039ee2895ad0f2bf639a4f07634cd2`.
[Chrome CPU throttling](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setCPUThrottlingRate)
and extra pixels are stress cases, not an emulation of the reporting Windows
CPU/GPU, its driver, or Android hardware. Both native cases reached the headless
browser's 60 Hz ceiling despite the client's 240 FPS setting.

## Camera results

| Turning workload | Metric | Current main | Performance branch |
| --- | --- | ---: | ---: |
| Native | Render CPU mean | 6.24 ms | 3.61 ms |
| Native | Render CPU p95 / p99 | 9.06 / 16.15 ms | 6.31 / 7.75 ms |
| Native | FPS | 60.0 | 60.0 |
| 6× CPU slowdown | Render CPU mean | 38.74 ms | 18.86 ms |
| 6× CPU slowdown | Render CPU p95 / p99 | 75.04 / 90.38 ms | 35.30 / 41.46 ms |
| 6× CPU slowdown | Frame interval p95 | 83.33 ms | 33.34 ms |
| 6× CPU slowdown | FPS | 21.58 | 44.09 |
| Four times the pixels | Render CPU mean / p95 | 6.61 / 10.38 ms | 3.81 / 5.56 ms |
| Four times the pixels | FPS | 60.0 | 60.0 |

The stressed turning windows individually reached 21.1–22.0 FPS on main and
43.6–44.6 FPS on the branch. Native and resolution-stress captures recorded no
frame intervals above 25 ms in either build. Every capture recorded zero rendering
errors. CPU durations include synchronous submission work and the same lightweight
counters in both builds; they are not GPU execution times.

### Work submitted in native turning frames

These averages use the native case, where both builds delivered the same frame
rate. Counts cover WebGPU passes; the separate WebGL widget canvas is excluded.

| Work per frame | Current main | Performance branch |
| --- | ---: | ---: |
| Indexed draw submissions | 533.4 | 221.1 |
| Submitted index elements, including instances | 542,246 | 420,316 |
| Pipeline binds | 77.2 | 40.1 |
| `queue.writeBuffer` calls | 15.7 | 12.5 |
| `queue.writeBuffer` source bytes | 225,201 | 69,867 |
| NPC CPU pose-mesh builds | 6.29 | 2.80 |
| Grass rebuilds across both turning windows | 12 | 0 |

Draw submissions fell 59%, submitted indices 22%, and buffer payload bytes 69%.
These are API work counts, not measured GPU bandwidth, utilization or execution
time. The device was not created with timestamp queries; queue-completion latency
is retained in the raw output but is not presented as GPU time.

The builds were captured sequentially with moving actors. The final metadata
contained 16 NPCs/one player on main and 17 NPCs/two players on the branch because
another player was using 3102. Main processed nine visible map squares versus six
on the branch, with the same 25-tile requested distance. Those lists intentionally
exclude unnecessary outer-map frame work in the branch. These are live-scene
measurements with residual variation, not a deterministic replay or physical
Windows reproduction.

## World map and correctness

The same 15 archive tiles (`x=48..52`, `y=49..51`, ppi 2) were requested three
times per build, with decoded map caches cleared between runs and JS5 bytes/image
dependencies already warm. Rendering and client ticks were paused without
disposing the renderer. No JS5 downloads occurred inside the measured runs.

| World-map result | Current main | Performance branch |
| --- | ---: | ---: |
| All 15 tiles complete | 29.30–30.73 ms | 29.11–31.91 ms |
| Largest gap in a 5 ms main-thread timer | 15.86–18.15 ms | 5.45–6.12 ms |

Warm tile completion time is unchanged; moving rasterization to an existing
worker improves main-thread responsiveness. All 983,040 pixel bytes and all icons
matched across both builds and every run. Aggregate SHA256:

- Pixels: `c7549b21f294ad6913a210df1ce5e66aaa56309083c52727c3df46417c3dade7`
- Icons: `7620de797f89c6226813381c1d38a2fade54f78cf76a647ccbc94e8cb2290c0b`

Additional checks isolate the new changes:

- Four frozen views at the reported location compared GPU-resident NPC pose reuse
  against CPU rebuilding with an empty CPU cache: every 3,124,488-byte view matched,
  each had positive NPC pixel coverage, and CPU builds fell 14→0 per view.
- Matching opaque crowds preserve pixels while batching 100→1 WebGPU draws
  (HD shadow plus scene: 200→2) and 10→1 WebGL draws. Eight GPU base/HD/MSAA
  NPC/player cases had positive actor coverage and exact readback agreement.
- The ordered UI batch matches the original current-main renderer byte for byte
  on the open world map: 588→160 renderer draws. Controlled 6× CPU full redraws
  averaged 20.77→17.78 ms. Its tradeoff is 167,328 additional vertex-upload bytes
  per full redraw; normal camera updates need only their damaged UI regions.
- The integrated mixed-texture UI readback matches individual submissions,
  67→11 draws, including alpha, filtering, clipping, rotation, masks and deletion
  of a previously bound batch texture. Zero GL errors.
- Large-region geometry copies are bounded to 256 KiB per call and 2 MiB per
  preparation step, with a 2 ms cooperative budget. An actual large WebGL instance
  previously copied up to 37.3 MB in one call; staged GPU readback matched all
  65,977,344 incoming geometry bytes. Complete scene publication is retained.
- Geometry exports retain used bytes only. A real IndexedDB legacy-entry check
  preserved every byte while compacting and rewriting its oversized backing
  arrays; it did not clear existing saved caches.
- The integrated world-map UI settled at zooms 50/100/25/100 with zero failed or
  pending tiles. Single-worker/LAN, stale request cancellation, cache reset and
  foreground-scene priority were also checked.
- The integrated Android-user-agent LAN path used WebGL, one worker and no shared
  buffers. With 4× MSAA and a 482×234 scene resolved into an 804×390 canvas,
  16 camera frames produced 16 distinct images and yaw angles without GL errors.
  Its single-worker world-map pixels/icons also matched current main exactly.

## Validation and limits

Client typecheck and production builds passed in both checkouts. Main's client
suite passed 196 files and failed `map-loading-regression.test.ts` on its existing
import of deleted `ConstructionData`; baseline source was left unchanged. The
performance branch's final publication run passed 222 files, with zero failures
and zero skipped tests; the final nine affected suites also passed.

One queued `INVALID_OPERATION` was observed before the first Android-path camera
capture. It did not recur during fresh startup, per-call tracing, three AA/plugin
toggle cycles, or an uninstrumented repeat with zero initial/capture errors. No
unconfirmed production fix was added for that observation.

Remaining CPU pose misses and final region setup can still produce long frames.
Staging covers bulk geometry; textures and final metadata still initialize
synchronously. Preparing a replacement also keeps the old scene alive until
publication. Physical Windows/Android frame pacing and peak transition memory
remain unverified. The changes preserve the selected plugins, distance and AA.

Raw local artifacts: `/tmp/main-camera-{native,cpu6,scale2}.json`,
`/tmp/tsps-final-camera-{native,cpu6,scale2}.json`,
`/tmp/tsps-main-final-camera-comparison.json`, `/tmp/world-map-current-main.json`,
`/tmp/world-map-final-pr.json` and `/tmp/tsps-final-npc-resident-parity.json`.
