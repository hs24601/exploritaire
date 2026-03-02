# Dice Rolling Deprecation Plan

## Status
- [x] Immediate removal executed on 2026-03-01: dice files/components deleted, live roll button gone, reroll indicator reduced.
- [x] No remaining references to `Die`/`DicePool`/`engine/dice` or to the `Roll Dice` command; codebase compiles cleanly (see verification section below).

## Summary
- The dice helpers and UI were a sandboxed feature; they had no core gameplay dependencies, which made removal low-risk once we deprecated the demo.
- This doc now tracks the final state so the replacement mechanic can be introduced without old artifacts confusing the tree.

## Inventory (prior to removal)
- Engine helpers (`src/engine/dice.ts`) for `Die`/`DicePool` and operations (roll, lock, unlock, sums, etc.).
- Dice UI components: `src/components/Die.tsx`, `DicePool.tsx`, and `DiceDemo.tsx`.
- Live touches: the `🎲 Roll Dice` toolbar button (`App.tsx`), `spawnDieRef`/animated die state in `GameShell.tsx`, and the reroll die indicator in `CombatGolf.tsx`.

## Deprecation actions taken
1. Removed the `Roll Dice` button from `App.tsx` and the `spawnDieRef` plumbing entirely.
2. Deleted the `Die` component and all dice helpers, so no randomness helpers or animations remain.
3. Simplified `CombatGolf`'s regroup button to just show the `Regroup` label and use the existing scheduler; the visual die indicator was removed along with the `Die` import.
4. Cleaned `GameShell` of `spawnedDie` state, drag handlers, and the animation/effect that introduced the die. The component now renders without dice-specific logic.
5. `src/engine/types.ts` no longer declares `Die`, `DieValue`, or `DicePool`.

## Verification
1. `rg -n spawnDieRef`, `rg -n DicePool`, `rg -n Die as DieType`, and other dice searches now return nothing.
2. `npm run build` (see run output) completes successfully after the deletion batch.

## Next steps
1. Implement the new dice mechanic using a fresh component/system.
2. If animations return, rely on a new representation instead of reusing the deleted files so the repo stays clean.
