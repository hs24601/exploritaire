# Legacy Watercolor Engine Deprecation Plan

## Scope
- Deprecate the old runtime watercolor paint engine (`src/watercolor-engine/*`) that was used for live canvas painting/splatter.
- Keep watercolor visuals used by:
- `VisualsEditor` watercolor gallery previews.
- Tableau and card overlays that render via `src/watercolor/*` configs/overlays.

## Phase 1: Runtime Disable (Completed)
- Remove global watercolor provider wiring from app root.
- Remove runtime watercolor toggles/hotkeys (`w`, `[`).
- Stop mounting legacy watercolor canvas layers in game shells and garden table.
- Stop drag-time watercolor degradation hooks tied to legacy runtime.

## Phase 2: Gameplay Detach (Completed)
- Remove gameplay code paths that invoke legacy engine APIs:
- RPG impact splashes from `CombatGolf`.
- Foundation card-placement splashes from `FoundationActor`.
- Paint-mark-to-light extraction (`usePaintMarkCount`) in `CombatGolf`.
- Remove legacy splatter pattern modal/hotkey integration from `CombatGolf`.
- Keep card/tableau watercolor overlays and editor-driven watercolor configs intact.

## Phase 3: Cleanup + Removal (Next)
- Delete unused legacy runtime files in `src/watercolor-engine/*` after confirming no active imports.
- Remove dead UI/tools tied to legacy runtime (if no longer referenced).
- Remove stale engine exports from `src/watercolor-engine/index.ts`.
- Add a smoke test checklist:
- App loads without full-screen watercolor overlay.
- No startup FPS drop from legacy watercolor canvas initialization.
- Tableau cards retain editor-matched watercolor styling.
