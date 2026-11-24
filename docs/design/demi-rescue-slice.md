# Demi rescue playtest

Current entry: `/aldan.html`. The prior mote-trial source and saves remain
separate. This iteration persists under `exploritaire.demi-rescue.v1`.

Leave Home Tree, resolve two outward battles, then recruit Demi at her refuge.
Each outward win guarantees one Frost mote. Recruitment commits the return:
the darkness surges, the actual world renderer lowers its environmental lights,
and two stronger, two-Mote encounters replace the outward solo fights. Return
through the passage and last roots to bring Demi home permanently.

Hero begins without AP capacity, a gauge, inspiration actions, innate Burn or
abilities. All common motes supply one AP capacity and their passive effect.
Transfer one mote at a time between Hero and Demi at encounter boundaries.
Capacity moves with it; surplus current AP is discarded, never duplicated.

Two Frost on Hero enable **Ice Climber** in the Recipes control: choose an
otherwise-playable immediately covered card, leaving the cover in its stack.
It recharges after ten further Hero receipts, across encounters and transfers.
Two Frost on Demi enable **Glacial Armor**: spend two AP to give each living
ally three armor, up to six. Use normal tableau plays on Demi to earn her AP.
Both are optional solutions; no encounter waits for a prescribed move.

Retreat is offered before recruitment, outside combat only. After recruitment,
resolve the entire return. Defeat loses unbanked motes and permits a retry.
Arrival banks motes and makes Demi permanently safe; this named rescue cannot
be repeated for farming. Recipe discoveries persist even on a failed attempt.
Camp construction and missions involving already-rescued companions are later
work, not part of this slice.

Presentation reuses Proto's `CombatDemo` world renderer, real environmental
lights and `useCinema` orchestration, with automatically timed authored camera
shots. Actions remain available throughout; there are no dialogue advances,
tutorial arrows or mandatory recipe activations. Existing Dem world/portrait
assets stand in for Demi; this is not a new character-art delivery. It is an
authored sequence of forest scenes, not continuous free-navigation terrain.

Initial values: Hero 32 HP, Demi 24 HP, outward foes 6/8 HP, return pairs 5/7 HP
each, and 3 HP recovery for living allies after each win. Collection and recipe
knowledge use their own save; earlier trial saves are never overwritten.

Validation:
- `npm exec vitest run src/expedition/demiRescue.test.ts src/proto/rules/moteRecipes.test.ts src/proto/rules/lightMotes.test.ts`
- `npm run build`
- `node tools/demi-rescue-playtest.cjs` (isolated headless browser)

Browser screenshots and fixtures are in `output/demi-rescue`.
