# Performance Backlog
**Target**: 60 fps locked during drag on a clean canvas (no persistent WE paint, no combo flashes).

Audit conducted: 2026-02-13
Systems reviewed: Light Engine (LE), Watercolor Engine (WE), Drag Events (DE)

---

## Phase I — Quick wins (low risk, high ROI)
These are cache/memoisation fixes. No architectural change required.

| ID | System | Issue | File | Lines | Est. gain |
|----|--------|-------|------|-------|-----------|
| I-1 ✓ | LE | `getBoundingClientRect()` called 3× per frame — cache results between ticks, invalidate on resize/scroll | `LightRenderer.tsx` | 159, 160, 173, 175 | 2–4 ms/frame |
| I-2 ✓ | WE | `getBoundingClientRect()` + `getComputedStyle()` called per overlay per frame in `isOverlayRenderable()` | `WatercolorOverlay.tsx` | 73–82 | 2–4 ms/frame |
| I-3 ✓ | WE | Drag-degradation broadcasts 8 individual React `setState` calls (one per subscribed overlay); coalesce into a single shared ref/context signal | `WatercolorOverlay.tsx` | 96–101, 709 | 1–2 ms spike on drag start |
| I-4 ✓ | LE | `Math.sqrt(w²+h²)` (diagHalf) recalculated per blocker per frame — precompute and cache on the blocker object since dimensions are static | `LightRenderer.tsx` | 234 | < 1 ms/frame |
| I-5 ✓ | WE | Both branches of RAF rescheduler do the same thing — loop never idles during drag degradation; add a real idle/sleep path | `WatercolorOverlay.tsx` | 673–679 | keeps loop alive unnecessarily |
| I-6 ✓ | WE | Assert WebGL availability at startup; log a clear warning and hard-bail on Canvas2D grain fallback during gameplay (fallback costs 20–50 ms/frame) | `WatercolorOverlay.tsx` | 501–509 | 20–50 ms/frame if hit |

---

## Phase II — Structural improvements (medium risk, high ceiling)
Require refactoring internal loops or render strategies.

| ID | System | Issue | File | Lines | Est. gain |
|----|--------|-------|------|-------|-----------|
| II-1 ✓ | LE | `destination-out` composite mode forces GPU framebuffer read-back before each draw — explore off-screen canvas accumulation + single blit, or invert the shadow approach (draw darkness last via `source-over` mask) | `LightRenderer.tsx` | 262, 314 | 3–6 ms/frame |
| II-2 ✓ | LE | Shadow quad loop is O(M×N) — M lights × N blockers with path ops per quad. Batch all quads into a single path per light; eliminate per-quad `beginPath`/`fill` | `LightRenderer.tsx` | 414–468 | 5–10 ms/frame |
| II-3 ✓ | DE | Dual RAF loops — `useDragDrop` queues its own RAF for React state throttle, `DragPreview` runs a second RAF for DOM updates. Introduce a shared RAF coordinator so both read from the same tick | `useDragDrop.ts` 140, 161 / `DragPreview.tsx` 44–82 | 1–2 ms/frame during drag |
| II-4 | WE | `drawImage` × (up to 8) overlays per frame — each copies the shared WebGL canvas to an individual 2D canvas at full resolution. Investigate compositing overlays directly via CSS `mix-blend-mode` on the shared canvas to eliminate per-overlay `drawImage` | `WatercolorOverlay.tsx` | 667–668 | 3–5 ms/frame |
| II-5 ✓ | WE | `buildBlooms()` rebuilds the entire bloom array (incl. per-splotch `hexToRgb()`) whenever parent passes a new config identity — ensure callers memoize config, or key the memo on a stable hash | `WatercolorOverlay.tsx` | 691 | 1–3 ms/render |

---

## Phase III — Algorithmic overhauls (higher risk, largest ceiling)
Require rethinking core data structures or render pipelines.

| ID | System | Issue | File | Lines | Est. gain |
|----|--------|-------|------|-------|-----------|
| III-1 ✓ | LE | Visibility polygon raycasting is O(B²) — (12+12B) angles × (4+4B) segment intersection tests per polygon. Replace with a spatial index (grid or BVH) to reduce to O(B log B) | `lighting.ts` | 319–327 | 10–20 ms/frame in crowded scenes |
| III-2 ✓ | LE | `Math.atan2`, `Math.sin`, `Math.cos` called 12+12B times per polygon per light — precompute and cache angle→sincos table per unique blocker set | `lighting.ts` | 298–321 | 3–5 ms/frame |
| III-3 ✓ | DE | `pointermove` fires unbounded at 60–120 Hz. Source-throttle using `getCoalescedEvents()` or an explicit time-gate inside the listener to avoid redundant processing above 60 Hz | `useDragDrop.ts` | 288–295 | 1–2 ms at 120 Hz |
| III-4 ✓ | WE | Fragment shader runs full Perlin noise per pixel per frame for grain. Bake grain into a pre-generated texture (updated at a lower rate, e.g. 10 Hz) and sample it instead of computing per frame | `WatercolorOverlay.tsx` shader | 153–168 | 2–5 ms/frame (GPU-side) |

---

## Status key
- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete

All Phase I items (I-1 through I-6) implemented 2026-02-13. All phases complete. II-1, II-2, II-3, II-5, III-1, III-2, III-3, III-4 done. II-4 deferred (CSS blend-mode approach not viable in current DOM layout).

---

## Notes
- **Clean canvas baseline** for profiling: no persistent WE paint, no combo flashes, no extra transient lights beyond baseline scene lighting, single-card drag.
- Phase I items should each be verified with a before/after FPS measurement in the browser DevTools Performance panel.
- Phase III-1 (spatial index for raycasting) is the single highest-ceiling optimisation in the codebase; schedule it when blocker counts regularly exceed 15 in real gameplay.
