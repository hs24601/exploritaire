# Ability rarity scaling methodology

Status: standing workflow authorized 2026-11-06. Individual new-ability numbers remain first-pass balance drafts until playtested.

## What already existed

GAME.md contained several relevant rules, but no single general ability-scaling procedure:

- **In-battle Keru rarity** (2026-10-28): Common/Rare/Epic/Legendary; initial buffs scale through Epic, while Legendary often retains Epic's primary number and adds a signature effect. Its 1/2/3 AP feeding investments describe that specific temporary Keru system.
- **Reward rarity tuning** (2026-10-29): a reward's inspected rarity changes both its displayed effects and the tier granted, rather than merely changing the frame.
- **100-series ice Keru rewards** (2026-10-29): defines Common Ice Armor and its persistence between encounters.
- **Crimson mote side encounters** (2026-10-30): persistent Phoenix rarity acquisition with a Rare-or-higher guarantee.

These rules establish precedents, not a universal multiplier or shared acquisition system. Temporary fed Keru tiers, persistent reward tiers and cosmetic foil selection are different systems.

## Reverse-engineered examples

Values below come from the runtime rule definitions and descriptions, not a proposed rebalance.

### Ice Armor

| Tier | Armor per unused AP at turn end | Armor cap | Additional behavior |
|---|---:|---:|---|
| Common | 1 | 5 | Absorbs incoming damage |
| Rare | 1 | 8 | Same trigger/identity, greater storage |
| Epic | 2 | 12 | Better conversion and storage |
| Legendary | 2 | 12 | Restores 1 armor after the first armor-absorbed hit each enemy turn |

Sources: `src/proto/rules/iceRewards.ts` (`iceDescription`), `battleTutorials.ts` (turn-end accumulation/reset), and `cirCompanion.ts` (`absorbTempHp`, once-per-turn restoration). The Legendary recovery needs positive armor absorption; an unrelated hit is not sufficient. This is the clearest example of Epic's main numbers staying fixed while Legendary adds a bounded mechanic.

### Heart of the Phoenix

| Tier | Revive HP, capped at max HP | Fire damage to each living foe | Reuse |
|---|---:|---:|---|
| Common | 5 | 2 | Breaks permanently after activation |
| Rare | 8 | 3 | Recharges after 12 Hero receipts |
| Epic | 12 | 4 | Recharges after 8 Hero receipts |
| Legendary | 16 | 6 | Recharges after 5 Hero receipts |

All tiers trigger when Hero is downed and Phoenix is ready, stun survivors for one enemy turn and interrupt the current enemy sequence. Common's permanent break is stored as a negative recharge sentinel; higher tiers count recharge down on Hero receipts.

Sources: `src/proto/rules/phoenixReward.ts` (`triggerPhoenix`) and `iceRewards.ts` (description and receipt recharge). Phoenix is a deliberate exception to a rigid "Legendary freezes every number" interpretation: its recovery and damage also rise, while Rare already introduces the qualitative change from disposable to rechargeable.

## General design pattern — an inference from those examples

1. Preserve the Common ability's recognizable job, target and trigger. Its supplied base values are the anchor.
2. Choose one or two meaningful scaling axes: amount, capacity, efficiency, trigger threshold, duration, recharge or target scope. Improve those deliberately; do not double every number.
3. Make Rare and Epic useful improvements without compounding every axis at once. Faster cadence can be the upgrade even when per-hit damage stays fixed.
4. Prefer a bounded, thematic signature at Legendary, often retaining Epic's primary numbers. A larger numeric capstone can be appropriate when the ability's established design supports it, as Phoenix does.
5. State costs, caps, stack/duplicate rules, timing, eligible events, blocked hits and persistence at every tier. Higher rarity must not silently change rules unrelated to the intended upgrade.
6. Keep rarity mechanics and rarity cosmetics distinct. A cosmetic foil picker never upgrades gameplay. A gameplay rarity tuner must update the actual stored tier, rules and copy together.

There is no universal Common-to-Legendary damage multiplier, mandatory cost increase, shared recharge rule or automatic feeding/loot mechanic.

## New standing rule: every new ability gets four drafts

When implementing an ability such as Fast Swipes, complete Common, Rare, Epic and Legendary in the same pass. Do not ship Common alone and rely on implicit identical fallbacks for the other tiers.

Required first-pass work:

- Author a four-row tier table, marking proposed numbers **draft** and preserving the requested Common baseline.
- Use one shared typed data definition for costs, thresholds, caps and perks; rules and card descriptions read it. Missing stored tiers migrate to Common.
- Store the chosen gameplay tier and preserve it through the ability's intended save/encounter lifecycle. Describe restart/reset behavior.
- Provide the existing inspection or config tuning path so all drafts are reviewable; keep natural acquisition unchanged unless that is part of the task.
- Apply the actual rarity frame/foil and describe the actual tier. Do not use cosmetic rarity as the rule source.
- Validate every tier's observable behavior, relevant costs/caps, legal versus invalid triggers, reset/recharge semantics and Legendary restrictions. Include a negative case for the signature perk.
- Document an intentionally invariant axis instead of manufacturing an unrelated upgrade. Changing acquisition, stacking or unrelated combat rules is not implied by rarity authoring.

This is a reusable workflow, not a claim that initial draft balance is final. See GAME.md's **Ability rarity authoring methodology** entry.

## Fast Swipes — first-pass implementation

| Tier | Attach cost | +Max AP | Base chip | Proc cadence | Signature |
|---|---:|---:|---:|---:|---|
| Common | 3 Momentum | 1 | 1 | Every 5 legal receipts | — |
| Rare | 3 Momentum | 1 | 1 | Every 4 legal receipts | — |
| Epic | 3 Momentum | 1 | 1 | Every 3 legal receipts | — |
| Legendary | 3 Momentum | 1 | 1 | Every 3 legal receipts | Restore 1 AP when the proc actually removes target HP, capped at foundation capacity |

These are drafts. The primary progression is cadence; Legendary adds bounded resource synergy instead of increasing all of damage, cadence and AP capacity. A fully absorbed proc grants no AP. Restoring AP does not create another receipt or proc. Existing chip defenses/multipliers still resolve through the normal hit pipeline.

The default offered card remains Common. **Config → Fast Swipes draft rarity** changes the offered card and, if attached, its stored gameplay tier. Tuning never fires a free hit: progress is clamped below the new interval. This is an explicit authoring/debug convention, not an invented player upgrade mechanic. Its tier/progress and offered tier carry into continued encounters; a fresh manual restart returns to the Common default. Existing saves without a tier behave as Common.

Data: `src/proto/rules/fastSwipesData.ts`. Rules: `battle.ts`. Card: `FastSwipesCard.tsx`. Tests: `fastSwipes.test.ts`. The existing cosmetic **Bite foil** selector remains unrelated.


Mochi support ownership (2026-11-06): Fast Swipes summons an adjacent support foundation for 3 Momentum, preserving Hero AP. The Momentum gauge reveals Mochi's summon card; inspect its abilities and drag Fast Swipes into an empty support foundation. Mochi owns the passive counter, +1 maximum AP (starts 0/1) and Legendary refund. Accepted prime tableau receipts and the prime leader's current target drive the passive. The rarity intervals and damage above remain unchanged. See [musical summoning](./musical-summoning.md).
