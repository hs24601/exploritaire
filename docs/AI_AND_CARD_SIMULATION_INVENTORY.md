# AI and Card Simulation Inventory

## Scope

This document inventories the repository's decision-making, autoplay, card draw, card-play, backfill, and **drag-and-drop** systems so they can be compared before another implementation is selected.

Search performed across `src`, `tests`, `tools`, and `docs` on 2026-07-21.

The original request used “dragon” in error; the intended subject is **drag and drop**. The inventory therefore covers both manual and AI-driven visual card movement, action dispatch on drop, and the relationship between animation and game-state transitions.

## Executive Summary

There are three useful layers, plus several variant-local copies:

| Layer | Best source | What it owns | Reuse assessment |
| --- | --- | --- | --- |
| Pure combat rules | `src/engine/combat/actions.ts` | Legal player/enemy card plays, combo/AP/token updates, turn changes | Preferred rules base |
| Enemy decision policy | `src/engine/ai/enemyAi.ts` | Enumerates legal enemy moves and selects optimal/random moves by difficulty | Preferred enemy-AI base |
| Runtime controller | `src/components/EnemyAiController.tsx` | Timers, pause, cadence, retries, ending a turn | Preferred UI orchestration base |
| Experiment/autoplay harness | `src/components/combat/CombatSandbox.tsx` | Deterministic replay, traces, batch runs, drag presentation, diagnostics | Reuse selectively for test tooling |
| Variant-local systems | `src/golf/*Variant.tsx`, `src/golf/GolfGame.tsx` | Game-specific strategy, state, timers, animation, UI | References only until extracted |

Recommendation: build the next shared implementation around the first three layers. Port a *small, explicit policy* from a variant only after agreeing on its objective. Use the sandbox's trace/replay tooling to test it. Do not adopt a full variant component as the foundation.

## AI Mechanisms

### 1. Core enemy AI

**Files**

- `src/engine/ai/enemyAi.ts`
- `src/components/EnemyAiController.tsx`

**Decision model**

- `getEnemyPlayableMoves` enumerates top-tableau-card moves against active enemy foundations.
- It respects actor availability, blind effects, and the active combat rule mode.
- `selectEnemyMove` combines a full-sequence solver (`analyzeOptimalSequence`) with deliberate imperfection: difficulty controls optimal-choice chance and early-stop chance.
- `EnemyAiController` schedules repeat steps, applies speed scaling, supports pause, observes a ten-second turn budget, retries a rejected move once, optionally performs an RPG attack, then ends the turn.

**Strengths**

- Rules and selection are separated from React timing.
- Difficulty is data-shaped and easy to tune.
- Enemy turn behavior is testable without rendering.
- Player/enemy turn ownership is enforced by the action layer.

**Gaps / caveats**

- It is enemy-focused. A player autoplayer should share a generalized `selectMove(side, policy)` contract rather than copy this module.
- Randomness uses `Math.random`, so deterministic replay requires an injected RNG before it can support reproducible simulations.
- The controller itself is React-specific; the step scheduler could later become a framework-neutral runner.

### 2. Combat Sandbox autoplay harness

**Files**

- `src/components/combat/CombatSandbox.tsx`
- `src/components/combat/combatLabModel.ts`
- `src/hooks/useCombatLabEngine.ts`

**Decision and simulation model**

- Holds autoplay policy profiles by difficulty, adjustable speed, a deterministic seed option, decision traces, move audits, replay import/export, and multi-run test sequences.
- Keeps visual drag animation separate from the action execution enough to record action/drop timing.
- Includes metrics for autoplay stalls, dead-tableau runs, drag/drop timing, and final run snapshots.

**Strengths**

- Best existing environment for observing AI behavior over many runs.
- Deterministic seed and trace facilities are the strongest answer to "watch the AI helm each team" and compare policy changes.
- Useful QA features already exist: exported audits, replay snapshots, and batch summaries.

**Gaps / caveats**

- It is a large UI harness, not a small reusable AI engine.
- Its card/ability model is Combat Lab-specific.
- Extract only its replay protocol, seeded RNG, trace schema, and test-runner concepts; do not move its component into ClassicPlus.

### 3. ClassicPlus local autoplay

**File**

- `src/golf/ClassicPlusVariant.tsx`

**Decision model**

- Player autoplay scores legal placements primarily by resulting combo count.
- Enemy autoplay chooses a legal enemy tableau/foundation move locally.
- The runner also handles scene transitions, resource energy, mobility, pending targeting, ability targets, and turn handoff.

**Strengths**

- Directly matches the current ClassicPlus state model.
- Already exposes separate player/enemy controls, speed choices, and turn alternation.
- Correctly represents the current exploration/combat distinction: finite exploration deal and infinite combat replacement.

**Gaps / caveats**

- Decision policy, game mutation, combat effects, UI state, and timer scheduling live in one component.
- It cannot be compared cleanly against another policy without rendering or duplicating component logic.
- It should become an adapter around shared decision and execution modules, not be copied into another variant.

### 4. ChargeUp family: local one-step lookahead

**Files**

- `src/golf/ChargeUpVariant.tsx`
- `src/golf/KinHandVariant.tsx`
- `src/golf/MegaHandVariant.tsx`

**Decision model**

- `chooseBestChargeUpTableauMove` simulates each legal move.
- Scores continuation count heavily, then player hand options and residual column depth.
- Player automation can search a bench/hand path when no tableau move exists; the enemy only takes the best tableau move.
- Each variant schedules visual drag animations and uses pass counters to decide when to stop automation.

**Strengths**

- The best variant-local heuristic for preserving future options.
- Its scoring terms are legible and can be turned into policy weights.
- It explicitly models a fallback path instead of treating no immediate tableau move as the end.

**Gaps / caveats**

- The same core idea is duplicated across three large variants.
- State transitions and animation are interwoven.
- Its assumptions about hands, refills, and foundations do not match current ClassicPlus directly.

**Candidate for extraction**

Extract the *concept*, not a file: `evaluateMove(state, move) -> { continuations, unlocks, depth, score }`. Then let ClassicPlus define its own legal moves and scoring weights.

### 5. GolfGame integrated autoplay

**File**

- `src/golf/GolfGame.tsx`

**Decision model**

- `choosePlayerAutoAction` supports multiple autoplay modes: tableau pause, tactical pause, and full.
- The component-level loop executes player actions, emits combat log entries, and chains into an enemy turn runner.

**Strengths**

- Richest gameplay-aware player automation in the repository.
- Useful reference for automation modes and stopping points.

**Gaps / caveats**

- Very large, UI-integrated module with broad game-state responsibilities.
- Not suitable as a direct dependency for ClassicPlus.
- Its policy should be audited independently before any pieces are reused.

### 6. Guidance and balance solvers

**Files**

- `src/engine/guidance.ts`
- `tools/deck-balance.mjs`

**Purpose**

- `guidance.ts` performs bounded depth-first search and full optimal sequence solving. It is a move evaluator, not a turn runner.
- `deck-balance.mjs` performs beam-search simulations across randomized decks and balance parameters. It models high-skill play for tuning, not production AI.

**Best use**

- Use `guidance.ts` as a correctness oracle or high-difficulty policy.
- Use `deck-balance.mjs` for offline tuning once the next combat rules are stable.

**Do not use as-is**

- Neither provides UI timing, target selection, ability sequencing, or replayable production behavior.

### 7. Original prototype

**Files**

- `src/prototype/engine/game.ts`
- `src/prototype/engine/cards.ts`

**Purpose**

- Pure manual prototype rules: tableau construction, legal card checks, card play, resolve/wildcards, ability use, and basic enemy attack.

**Assessment**

- No actual autoplayer or enemy decision maker exists here.
- It is valuable as the simplest data-driven rules reference, not as an AI implementation.

## Card Draw, Play, Backfill, and Drop Mechanisms

### A. Shared engine combat actions

**Files**

- `src/engine/combat/actions.ts`
- `src/engine/combat/deal.ts`
- `src/engine/combat/backfill.ts`
- `src/engine/combat/deadlock.ts`

**Behavior**

- `playTableauCard` is the player-side pure transition. It validates turn ownership and legality, moves the top tableau card, increments combos/AP/tokens, records discard, and updates telemetry.
- `playEnemyTableauCard` is the enemy-side counterpart. It validates against enemy foundations, updates enemy combo/AP/tokens, and backfills the played tableau.
- `deal.ts` draws from an owned combat deck, reshuffles discard when needed, and falls back to generated combat cards only when depleted during a deal.
- `backfill.ts` supports immediate random backfill or a prepared enemy queue. When a queue runs out, it falls back to random generation.
- `deadlock.ts` detects when neither side has a move and redeals the random-biome tableau with a cooldown and telemetry event.

**Assessment**

- This is the best foundation for a shared card-execution system.
- Important asymmetry to resolve before reuse: player card play currently has `shouldBackfill = false`, while enemy card play backfills. Current ClassicPlus intentionally has different finite-exploration/infinite-combat logic, so that policy should be explicit rather than inferred from side.

### B. ClassicPlus finite exploration / infinite combat

**File**

- `src/golf/ClassicPlusVariant.tsx`

**Behavior**

- Exploration uses a seeded finite deal that contains resources and encounter cards.
- Card placement consumes from the selected tableau column.
- Combat uses `drawTableauReplacement(..., true)`, which supplies ongoing replacement cards.
- An encounter freezes exploration state and deploys a new combat tableau; resolution restores the exploration tableau.

**Assessment**

- This is the only implementation that already matches the desired scene boundary: preserve world/deal progress, isolate combat, then return.
- Its replacement policy should be moved into a small `CardSupply`/`BackfillPolicy` abstraction if it is retained.

### C. ChargeUp, KinHand, and MegaHand refills

**Files**

- `src/golf/ChargeUpVariant.tsx`
- `src/golf/KinHandVariant.tsx`
- `src/golf/MegaHandVariant.tsx`

**Behavior**

- Local `drawCards` routines fill hands/decks.
- Playing a tableau card updates the selected foundation and calls a local column refill routine.
- The variants animate both manual and automated plays with a drag sequence before applying state.

**Assessment**

- Good visual reference for card movement and refill cadence.
- Rule duplication means it should not be selected as a long-term execution system.

### D. Combat Sandbox drag/drop

**File**

- `src/components/combat/CombatSandbox.tsx`

**Behavior**

- Manual drag/drop routes hand and tableau cards to player or enemy foundations through action callbacks.
- Autoplay renders an independent drag animation, then invokes the action path.
- It records timing around visual drag completion and action/drop handling.

**Assessment**

- Best reference for visual "card dropping" and instrumentation.
- Keep visual motion as an adapter around a committed action; never let animation be the source of truth for a rules transition.

### E. BenchClassic and Inverse local play/draw

**Files**

- `src/golf/BenchClassicVariant.tsx`
- `src/golf/InverseVariant.tsx`

**Assessment**

- Smaller, local implementations of tableau play and draw/hand mechanics.
- Useful only for UX references. No AI system was found in either.

### F. Prototype data deal

**Files**

- `src/prototype/engine/cards.ts`
- `src/prototype/engine/game.ts`

**Assessment**

- Uses a static `DungeonData` tableau, marks cards cleared, and does not backfill.
- It is the cleanest reference for a finite authored deal, but lacks a simulation runner.

## Comparison Matrix

| System | Player AI | Enemy AI | Deterministic replay | Finite deal | Infinite backfill | Visual drag/drop | Pure transition functions | Recommended role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Engine + EnemyAiController | No shared player policy | Yes | No | Via deck deal | Yes, enemy side | No | Yes | Production rules/AI base |
| CombatSandbox | Yes | Yes | Yes | Configurable | Engine-dependent | Yes | Delegates | Test and comparison harness |
| ClassicPlus | Yes | Yes | No | Exploration | Combat | Minimal/local | No | Current behavior reference |
| ChargeUp family | Yes | Yes | No | Local deck | Local refill | Yes | Local | Heuristic reference |
| GolfGame | Yes | Enemy runner | No | Game-specific | Game-specific | Integrated | Mixed | Mode/UX reference |
| Guidance | Evaluator only | Evaluator only | Yes for same inputs | N/A | N/A | No | Yes | Oracle/high-skill reference |
| Deck balance script | Offline simulated play | N/A | No | Generated decks | N/A | No | Script-local | Balance research |
| Prototype engine | No | No | Yes for same inputs | Authored dungeon | No | No | Yes | Simple finite-deal reference |

## Recommended Selection Process

1. **Adopt the shared action model.** Treat combat card placement as a pure transition, with separate player and enemy entry points only where side-specific rewards differ.
2. **Extract one common policy interface.** Example: `selectMove(state, side, policy, rng)`. The policy returns a legal action only; it never mutates state or animates.
3. **Start with two policies.**
   - `continuation`: adapted from the ChargeUp one-step heuristic.
   - `solver`: adapted from `guidance.ts` for high-skill or diagnostic runs.
4. **Inject a seeded RNG.** This lets normal/easy variants of the policy be replayed exactly and makes AI comparison meaningful.
5. **Use the Combat Sandbox harness concepts.** Reuse the trace schema, replay bundle, and batch-run reporting. Keep ClassicPlus presentation independent.
6. **Make supply/backfill a scenario policy.** For example: `finiteSeeded`, `combatInfinite`, `queuedEnemy`, or `deadlockRedeal`. Do not encode it as a hard side effect of a player/enemy play function.
7. **Select card animation last.** Commit the pure state transition, then show a card moving. The UI must be able to skip animation in batch mode without changing outcomes.

## Proposed Next Decision

For the next implementation, compare these two candidate policies against the same seeded ClassicPlus combat states:

| Candidate | Behavior | Why compare it |
| --- | --- | --- |
| Continuation heuristic | Prefer the move with the most immediate legal follow-ups; use depth/unlockers as tie-breakers | Closest to existing ChargeUp/KinHand/MegaHand behavior and cheap to run |
| Bounded solver | Choose the first action from the best search sequence up to a fixed depth | Establishes an upper benchmark and reveals where heuristic choices leave chains behind |

Record move traces, cards played, stalls, enemy damage, and combat result for each. Choose the heuristic only if it produces sufficiently close outcomes while remaining readable and easy to tune.
