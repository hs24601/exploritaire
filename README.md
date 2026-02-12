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
