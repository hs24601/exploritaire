# Distinct Keru ability authoring

2026-10-24. Each Keru owns multiple abilities. An ability has a stable ID, name, cost, effect, usage type and explicit eligible targets. Changing targets cannot change those properties. Unlock requirements are deliberately absent for playtest authoring.

`KERU_ABILITIES` in `src/proto/keruDrafts.ts` is the 21-entry catalog. The gallery renders three independent cards per Keru at `/proto.html?kerusbx`, with fixed resolution notes. The older `bindings` grouping is retained only as an internal migration source; it is no longer a target-driven UI model. The standalone Dem URL shares this catalog.

Cir's distinct `cir-hearthflame`, `cir-ember-claws` and `cir-meteor` skills are playable in the combat sandbox. Their current target rules are Hero, Mochi and living enemies, respectively. Those recipient restrictions belong to each ability, not to a mutable Cir card. Legacy `cir` dispatch remains an internal compatibility adapter for existing state/tests. The paid shared-entity recall/battle-exhaustion lifecycle and Scenario 006 phase guards are unchanged. Other Keru remain proposal cards; this work does not implement their combat triggers or unlock systems.

The live fan now exposes the three Cir choices with fixed copy/costs. Narrow screens use a scrollable grid so all choices remain reachable. Cast flight recognizes Cir skills as Keru-sourced actions. Dedicated future action paintings can replace the currently shared per-creature image independently of card identity; none is represented as already produced.

Dem's natural-pose study can be selected for visual comparison without changing abilities or elemental rules. It retains the approved storybook paint but removes the ice mantle, ice claws, frost breath and particles. Its transparent subject and prompt are under `artifacts/dem-style-v3/`.

Validation: typecheck; 22 focused rule tests covering distinct costs/targets, shared-entity exclusivity, paid recall, exhaustion and phase gates; headless desktop/phone checks of 21 cards, the natural-art toggle and actual Hearthflame casting. No unlock/progression implementation is included.
