# Developed Features

This document records systems that have been built and validated in the prototype,
but are not necessarily enabled in the current Classic Plus experience.

## Reserved Systems

### Card Pattern Triggers

- Status: developed, disabled in Classic Plus.
- Module: `src/golf/reserve/cardPatternTriggers.ts`.
- Purpose: match recent card-direction sequences such as `down, down, up` against
  data-defined actor triggers.
- Previous use: Hero Taunt used the `down, down, up` sequence.
- Re-enable only when a future combat design explicitly calls for multi-card
  sequencing. The active build intentionally uses immediate Chip effects instead.

## Active Systems

### Simulated Card Transport

- Status: active in Classic Plus.
- Modules: `src/golf/classicPlusTransport.ts` and
  `src/golf/ClassicPlusVariant.tsx`.
- Interaction: card placement remains click-to-target. The selected card then
  visually leaves the tableau through `DragPreview` and travels to the chosen
  actor board.
- Commit rule: the rules state changes only when the flight arrives. The source
  card and target are validated again at that point; an invalid route returns the
  card to the tableau and announces the interruption.
- Automation: player and enemy AI card moves use the same queued transport, one
  card at a time. This preserves readable progression and permits future
  real-time interrupts without rollback.
- Timing: the default transport baseline is intentionally half-speed, with
  per-actor `cardTransportSpeed` data available for future speed stats.

### Immediate Chip Combat

- Status: active in Classic Plus.
- Module: `src/golf/classicPlusData.ts` (`DEFAULT_CHIP_ABILITY`).
- Rule: placing a tableau card on a foundation during combat immediately deals
  one damage to the lowest-HP living foe.
- Scope: the current baseline is intentionally small and does not use card
  direction history or multi-card trigger patterns.
