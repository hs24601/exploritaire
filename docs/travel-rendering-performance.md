# Travel rendering performance — 2026-10-12

Travel had two separate problems: delayed React camera snapshots could rewind the live camera, and travel repeatedly rebuilt the scene while recoloring/rasterizing voxel scenery, projected shadows and oversized lighting surfaces.

The actor, heading and follow camera now share the travel frame clock. Live actor coordinates also feed the walking rig and grab targets. React receives scene/lighting snapshots every 250 ms, and synchronizes the camera when tracking ends or manual input takes over. The actor renderer survives OTT/immersion changes. Occlusion copies retain their structure as animation frames change.

Voxel positions, normals and source colors upload once per solid. Shader uniforms handle lighting. Projected shadows use the same geometry, with strict depth rejection to avoid shading already covered pixels. A rendering worker transfers batched image atlases; unsupported workers retain the main-thread GPU path and CPU rasterizer. Known scenery is prepared while OTT is idle. Ground lighting uses the existing wash projected into a viewport surface capped at 512 × 320 pixels, with the previous 2D renderer retained on context loss. Camera and visual-clock callbacks share the atmospheric frame budget.

## Measurement

`tools/travel-performance-playwright.cjs` runs isolated headless Chromium contexts at DPR 1. It warms OTT, travels north from `(0,2)` to `(0,-2)` at a selected 30% speed, follows at 300% zoom, and samples the same 12-second scenario. Both runs include the existing three-second 5% opening and one-second ramp. The sample includes arrival; these are whole scenario averages, not a guarantee of sustained moving FPS. CPU sampling is 1 ms in both comparison runs.

The original before/after runs below used the development build and the default headless-shell launch. Checking that launch configuration subsequently confirmed SwiftShader software graphics, with hardware compositing and rasterization disabled. These numbers measure the improvement in that configuration; they must not be presented as the hardware-accelerated game's FPS ceiling. The harness now records graphics metadata and accepts `PERF_GPU=1` to request full Chromium with `--enable-gpu`.

| Viewport | Before FPS | After FPS | Before p95 frame | After p95 frame | Before longest frame | After longest frame |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1280 × 720 | 16.9 | 26.9 | 150 ms | 66.7 ms | 400 ms | 166.6 ms |
| 1912 × 914 | 12.6 | 21.2 | 216.7 ms | 100 ms | 366.7 ms | 200 ms |

JavaScript time within the sample fell from 6.40 to 3.67 seconds at 1280, and from 5.94 to 3.85 seconds at 1912. Long frame times improved substantially, but this software-rendered configuration still misses 60 FPS. CSS scene composition, remaining scene updates and bitmap transfers remain measurable costs. The measurements vary with browser/system load; the artifacts retain intermediate runs and a run without CPU profiling. This change should not be described as eliminating every stutter.

Raw comparison: `artifacts/travel-performance/before.json` and `artifacts/travel-performance/after.json` (the final strict-depth shadow run). Pixel comparisons: `artifacts/travel-performance/renderer-parity.json`.

### Hardware-accelerated follow-up

Full headless Chromium with `--enable-gpu` reports Intel Arc graphics through ANGLE/D3D11, with hardware compositing, rasterization and WebGL enabled. The same route, viewport sizes, DPR 1 and 1 ms CPU sampling give:

| Viewport | Development travel FPS | Production travel FPS | Production p95 frame | Production longest frame | Production immersive idle FPS |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1280 × 720 | 50.6 | 56.4 | 16.8 ms | 200 ms | 60.1 |
| 1912 × 914 | 55.2 | 58.9 | 16.8 ms | 100 ms | 60.6 |

In the production samples, every frame over 50 ms occurs in the first second of entering immersion. Subsequent seconds are approximately 60 FPS, except a few 33 ms frames during the 1280 ramp. This points to transition setup as the immediate hitch problem, rather than an inherent inability to sustain immersion. Context creation appears in the CPU profile; mounting canvases, initial uploads and shader preparation are candidates for a separately timed transition trace, not proven individual causes yet.

At 1912, production travel spends 2.10 seconds recalculating styles and 1.40 seconds executing JavaScript over the 12-second sample. Development JavaScript takes 2.98 seconds. The camera's inherited CSS variables and many DOM/canvas scene surfaces remain practical scaling concerns: camera changes can trigger style work, and voxel/lighting output still crosses multiple canvas/compositor stages. These totals overlap with other profile categories and must not be added to inclusive stack timings or described as GPU utilization. A production GPU/compositor trace is still needed to assign exact raster/compositing costs.

Raw samples and verified graphics metadata are `artifacts/travel-performance/hardware-production.json`, `hardware-development.json` and their corresponding `-environment.json` files. These small-scene desktop tests do not establish a phone or larger-world performance guarantee.

## Validation

- Production build and TypeScript check pass.
- 48 targeted movement, pathfinding, discovery, camera, voxel, occlusion, orientation, footprint and walking-definition tests pass.
- Mouse and touch travel controls, slider edits, follow toggling, 300% zoom, manual Space takeover and reduced motion pass at 1280 × 720 and 1912 × 914, including 3× layout screenshots.
- Full scenery orbit, fixed footprints, complete nonblank voxel views, low camera descent, shadows and OTT restoration pass at both desktop sizes with mouse/touch camera interaction.
- Worker output matches CPU silhouettes above 99.7% across the tested material views; mean color differences are below 0.11/255. Projected shadow coverage matches above 99.9%, with only raster edge antialiasing differences.
- Worker-disabled GPU fallback, CPU fallback, bounded ground projection and ground context-loss fallback pass.
- The actor keeps the same renderer canvas when switching from OTT into immersion during travel; walking phases advance from live ground distance and arrival restores sitting.

The speed slider and temporary opening scaffold are independent of these rendering changes. This pass does not remove the opening delay.
