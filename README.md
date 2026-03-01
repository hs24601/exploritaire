# Exploritaire

## Playtest Variants
- Single foundation, four in support: one foundation actor with four benched; combo-chasing with value-based swaps; no hand/stock. See docs/variants.md.

## Terminology
- `LE`: Light Engine (`src/components/LightRenderer.tsx`) that handles dynamic lighting and shadow compositing.
- `WE`: Watercolor Engine (`src/watercolor-engine/` and `src/watercolor/WatercolorOverlay.tsx`) that handles watercolor overlays, splashes, and persistent paint marks.

## Performance Toggle (Dev)
- Drag-only WE degradation is enabled by default (auto-reduces WE quality while dragging, restores on drop).
- Disable for A/B:
  - `localStorage.setItem('exploritaire.we.dragDegradeDisabled', '1'); location.reload();`
  - or in console for current session: `window.__EXPLORITAIRE_DISABLE_WE_DRAG_DEGRADE__ = true`
- Re-enable:
  - `localStorage.removeItem('exploritaire.we.dragDegradeDisabled'); location.reload();`

## Performance Baseline
- Target drag performance: `60 FPS` locked.
- `Clean canvas` definition:
  - No watercolor paint marks deployed (zero WE persistent paint).
  - No extra transient light sources beyond baseline scene lighting (no combo flashes, no paint luminosity lights).
  - Single-card drag interaction used for baseline LE/WE drag profiling.

## Dev Mode Flag
- Use `#devmode` in the URL hash to enable backlog/experimental gameplay features.
- Default behavior remains production-safe when `#devmode` is absent.
- Details and policy: `docs/devmode.md`.

## Naming Conventions
- System IDs (ability IDs, aspect identifiers, and similar tooling-driven values) use `thisTypeOfCase` (lower camel case) so they're consistent across the editors. Stick to that format when entering or reviewing system IDs.

## Typecheck Guardrails
- Run `npm run typecheck` to validate TypeScript without building.
- A pre-push hook is available at `.githooks/pre-push`.
- One-time setup for local hooks: `npm run setup:hooks`.
- CI also runs typecheck on pull requests and pushes to `main` via `.github/workflows/typecheck.yml`.

## Dev Startup Guardrails
- `npm run dev` now runs `dev:doctor:fix` before Vite to clear stale duplicate listeners on the dev port.
- Manual diagnostics:
  - `npm run dev:doctor`
  - `npm run dev:doctor:fix`

## Dev Host/HMR Configuration
- Default dev host/port: `0.0.0.0:5178`.
- Optional env overrides:
  - `VITE_DEV_HOST` (example: `0.0.0.0`)
  - `VITE_DEV_PORT` (example: `5178`)
  - `VITE_DEV_HMR_HOST` (example: `192.168.50.27`)
  - `VITE_DEV_HMR_PORT` (example: `5178`)
- If `VITE_DEV_HMR_HOST` is not set, Vite HMR host is not forced.

## 426 Troubleshooting
- Symptom: browser request to `http://<LAN-IP>:5178` returns `426 Upgrade Required`.
- Cause: conflicting listeners on the same port (typically duplicate Vite/WS processes).
- Fix:
  1. Run `npm run dev:doctor`.
  2. If duplicates are reported, run `npm run dev:doctor:fix`.
  3. Restart dev server with `npm run dev`.

## Smoke Tests
- Focused gameplay smoke checklist: `docs/smoke-gameplay-checklist.md`.
- Automated preflight (typecheck + build + preview reachability): `npm run smoke:preflight`.

## Rarity Balance
- Default rarity auto-fill curve and guardrails: `docs/rarity-balance-curve.md`.
