# Combat

This document is the local source of truth for the golf prototype's combat layer.

It exists to track:
- the currently implemented combat-adjacent systems,
- the intended combat grammar,
- signature and collapse identities for KIN,
- stagger and pressure terminology,
- future ideas that should not be mistaken for shipped behavior.

## Current Prototype State

### Core Structure
- The player controls a party of friendly `KIN`.
- `Prime` is the active KIN.
- `Support` is the primary benched helper.
- Team `AP` is currently shared across the party.
- Signature cards are visible for the active prime hand, and some support-side effects are now directly invocable through bench interaction.

### Pressure And Stagger
- `Poke` damage is the setup layer.
- The target's `staggerPressure` is a separate counter from HP.
- Enemy actor frames now show a temporary `STG` counter for iteration.
- The long-term intent is:
  - poke primarily affects `staggerPressure`,
  - prime `Collapse` actions cash out pressure into real HP damage and stagger consequences,
  - different KIN convert pressure into payoff in different ways.

### Collapse
- `Collapse` is the universal prime-click action.
- Clicking the prime KIN should be the "pull the trigger" moment that cashes out built combat pressure.
- This preserves player agency over when stagger payoff happens instead of making it automatic at a hidden threshold.

### Mochi
- Signature: `Tap Out!`
- Passive: `Nine Lives`
- Collapse: `Pounce`

Current prototype direction:
- If Mochi is in support, `Tap Out!` can swap her into prime.
- On swap-in, Mochi gains `Whiskersense`.
- If Mochi is already prime and has `Whiskersense`, `Tap Out!` becomes the tableau traversal burst presentation currently referred to as `Zoomies`.
- `Zoomies` uses a bounded auto-solved exclusion path across visible tableau cards.
- Each successful `Zoomies` claim currently:
  - advances the tableau,
  - adds poke-style pressure to the enemy prime,
  - adds a stack of `Momentum` to Mochi.
- `Momentum` currently decays by `1` per turn.
- `Pounce` is intended to consume built `Momentum` and aggressively push enemy stagger state, more in line with Tifa-style stagger specialization than with standard direct damage.

### Hero
- Signature: `Fetch`
- Passive: `Guard Dog`
- Collapse: `Tackle`

Current prototype direction:
- `Fetch`
  - Tableau: retrieve a top-row tableau card into Hero's hand.
  - Actor: retrieve the top card from a creature discard into Hero's hand.
- `Guard Dog`
  - Hero takes damage instead of an ally when that ally would otherwise die.
- `Tackle`
  - cashes out enemy pressure into real HP damage,
  - grants armor equal to Hero's current AP,
  - distributes that armor across the team,
  - uneven distribution favors lower current HP/max HP ratio first, then lower max HP.
- Hero's current prototype max AP is `8`.

## Terminology

### Pressure
- The setup layer of combat.
- In the current model, pressure is represented by `staggerPressure`.
- Pressure should make the enemy increasingly vulnerable to deliberate payoff actions.

### Stagger
- The payoff vulnerability state that pressure is building toward.
- Full stagger UX and rules are not final yet.
- The current implementation uses a visible counter only; the richer state machine still needs iteration.

### Poke
- Light combat contribution that builds pressure instead of immediately resolving the whole combat exchange.
- Poke is not meant to feel like fake damage; it is the setup half of a two-step combat rhythm.

### Collapse
- The intentional cashout action.
- Triggered by clicking the current prime KIN.
- Resolves built setup into real payoff.

### Momentum
- Mochi-specific stacking resource.
- Current prototype:
  - built by `Zoomies`,
  - loses `1` stack per turn,
  - improves `Pounce`.

### Whiskersense
- Mochi buff gained when `Tap Out!` brings her into prime.
- Current prototype combat expression:
  - negates the next incoming damage source against prime Mochi.
- Current prototype tableau expression:
  - enables `Zoomies`.

## Tableau Traversal: Zoomies

`Zoomies` is Mochi's current tableau traversal mechanic.

### Rule Shape
- It is an auto-solved multi-card claim burst.
- It searches across visible tableau cards, not only top cards.
- It is bounded by rarity-based claim limits.

### Legal Step Rule
- The next card must be in an adjacent tableau column only.
- The next card must be visible.
- The next card must be golf-adjacent in rank to the current card.
- `A-K` wrap counts as adjacent.
- Pathing may move left or right, including reversing direction.

### Boundedness Rule
- Columns may be revisited.
- A specific physical card instance may not be reused within the same streak.

### Solver Rule
- Build a graph where visible tableau cards are nodes.
- Connect nodes when they are in adjacent columns and golf-adjacent in rank.
- Search for the best simple path under no-card-instance-reuse rules.
- If multiple paths tie, use deterministic tie-breakers.

### Recommended Tie-Break Order
1. Longest path
2. Highest total rank value or other game-defined score
3. Leftmost starting column
4. Lexicographically lowest column-index sequence

### Current Rarity Cap Direction
- Common: `3` claims
- Uncommon: `5` claims
- Rare: `7` claims

## Signature Philosophy

Current direction:
- each `KIN` should trend toward:
  - `1` signature ability,
  - `1` passive trait,
  - `1` collapse identity.

This is meant to:
- reduce cognitive load,
- keep collector identity crisp,
- prevent hand bloat,
- let ORIMs and mutations do the deep buildcrafting work.

## Mutation Ideas

These are design candidates, not necessarily implemented.

### Mochi / Zoomies

#### Resonance
- Each `Zoomies` step builds a stack of `Resonance`.
- `Resonance` is a `HOT` effect.
- Each tick consumes `1` stack and heals the entire team for a fixed value.
- Theme:
  - leverages the real-world association between cat purring and restorative resonance,
  - gives Mochi a support-healer mutation path without collapsing her identity into a pure healer.

Design intent:
- lets Mochi become a pocket healer if the player chooses that branch,
- keeps the healing tied to active tableau success,
- differentiates this branch from pure stagger-spike Mochi.

Open questions:
- should `Resonance` heal flat HP, max-HP percentage, or lowest-HP allies first,
- should it be teamwide or split,
- should it tick on turn end, beneficial tick, or some new timing hook.

## ORIM Interaction Direction

Current direction:
- branch first,
- rarify second,
- ORIMs provide the actual modifier payload.

Examples:
- `Efficiency` lowers AP cost,
- `Cal` adds elemental or rider effects,
- future ORIMs may alter reach, persistence, sustain, or echo behavior.

The intended distinction is:
- branch defines what the signature does,
- ORIM defines how that branch is bent on a run.

## Try This Out

This section is explicitly for speculative mechanics that may or may not survive playtesting.

### Tag Team
- We previously had a `Punish` mechanic that rewarded the player for cashing out before finishing a streak.
- It felt bad and was removed.
- `Tag Team` is a different experiment and needs direct playtesting before it earns a permanent place in the system.

Core idea:
- certain pairs of KIN gain a joint threshold state between prime and support,
- when that state is met, the player may choose to `Tag Team`,
- this triggers a duo action that should generally be more rewarding than simply continuing the prime's normal streak,
- the value proposition must be high enough to compete with streak continuation without making streaking feel wrong.

#### Hero + Mochi: Raining Cats And Dogs
- Either KIN may be prime.
- Tentative criteria:
  - both have more than `5 AP`, and
  - at least one has a Water-element ORIM.
- Effect concept:
  - hit all enemies with a punishing rainstorm,
  - heal all allies,
  - `Exhaust`.

Open questions:
- what the exact threshold should be,
- whether this is once per fight or once per rest,
- whether it should consume both signatures, both collapses, both AP pools, or a dedicated duo currency,
- whether duo moves should require explicit ORIM synergy or work as a baseline kin-pair feature.

## Notes

- Keep "implemented now" separate from "interesting future idea."
- Do not let this file silently turn prototypes into assumed canon.
- When combat rules change, update this file in the same patch whenever practical.
