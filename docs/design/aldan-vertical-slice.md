# Mote trials: combat-only vertical slice

Historical v3 notes. The current mounted rescue slice is described in [demi-rescue-slice.md](./demi-rescue-slice.md).

Play `/aldan.html`. Five fights follow the shared Proto 100-series rules:
win → choose a power → choose a connected combat node. There are no travel
costs, Seed/light systems, gathering puzzles, resources, supplies or world
exploration in this iteration. No Keru summons are enabled.

The FTL-inspired combat itinerary marks the route already taken, the current
fight, future nodes and at least three eligible next fights. Each available
node previews enemy count/HP and its reward affinity. Click a connected node
to start its fight immediately. **Run path** opens the itinerary during a
fight and pauses the simulation; **Back to fight** resumes it. On phones the
node diagram sits above compact, labeled combat choices.

## Baseline and progression

- Hero begins every run with **32 HP, 0 AP, a 3 AP cap and 10% burn chance on a
  landed direct hit**. Burn uses the existing shared debuff: 2 damage at the
  start of each of the next two enemy turns. Blocked hits and damage over time
  do not roll it.
- The opening weakened Mote has 6 HP. Solo opponents then rise from 7 to 10 HP.
  Crosswind nodes from fight 3 onward offer two Motes with 4–6 HP each.
- Victory restores **4 HP** immediately, capped at maximum. No separate rest
  action or planning currency is involved. HP, AP, foundations and build carry
  to the next encounter. AP fills before the receipt's chip hit, so a card that
  fills the bank qualifies for full-AP bonuses, just as in the 100-series.
- Fights **1, 2 and 4** offer three light motes. Fights **3 and 5** offer three
  existing major abilities, themed to the chosen node. A repeated major
  ability upgrades its rarity instead of granting an identical copy.
- Each new run starts with a **fresh build**, as requested for combat tuning.
  Motes and abilities earned in previous runs remain in the collection and are
  not automatically equipped. Collection totals can exceed three; equipped
  copies of any single mote are capped at three.
- **Escape Rope** (also Alt+R) ends the run immediately with earned powers kept.
  It works during enemy play, node selection and reward inspection. An earned
  but unchosen reward remains available after returning. Defeat uses the same
  collection-preserving return. Banking is idempotent.

## Light mote rewards

The persistent collection has a further intended purpose: accumulate and combine
enough matching motes across runs to rescue a corresponding Keru. The same mote
can provide a small combat gain during its run and then contribute to that
longer-term rescue. Equipped stacks and banked quantities remain separate, so
fresh builds preserve collection progress. Reward affinities can give players
a reason to pursue a particular Keru across different combat paths.

This is the next progression direction, not an implemented rescue mechanic.
Keru matches, required quantities, mixed recipes and consumption rules remain
open for tuning.

| Mote | One copy | Further copies / limit |
| --- | --- | --- |
| Ember | +1 fire on full-AP chip hits | +1 per copy, maximum 3 |
| Splash | +1 max AP; 10% chance to save 1 AP when paying a cost | Cap increases and chance stack, maximum +3 AP / 30% |
| Frost | +1 ice armor at turn end | +1 per copy; mote armor gains cap at 6 |
| Cinder | +10 percentage points to burn chance | Maximum 40% including innate 10% |
| Verdant | Heal 1 HP every 6 tableau receipts | Heal 2 / 3 with more copies |
| Gale | +5% chance to evade enemy hits | Maximum 15% |
| Spark | +1 bonus AP every 6 tableau receipts, up to cap | Every 5 / 4 receipts with more copies |
| Pebble | +1 opening armor each encounter, up to 6 total | +1 per copy, maximum 3 |

Splash rolls **once per payment**, saves **at most one AP**, and still requires
the full AP cost to be affordable. Its random stream is stored on the actor
so save/reload and legacy attack helpers cannot reset a favorable roll. Other
hit/evasion rolls use the shared effect stream. Frost never reduces armor
already above its cap from a stronger ability. Receipt counters and consumed
AP use the real combat rules; these are not presentation-only bonuses.

Reward affinities are visible before choosing a node: Cinder drift favors
Ember/Cinder/Spark and later fire abilities; Ripple knot favors
Splash/Verdant/Spark and later AP/recovery abilities; Frost ring favors
Frost/Pebble/Splash and later ice abilities; Crosswind favors
Gale/Verdant/Ember and later evasion/guard abilities.

Try **Splash → Frost ring → Glacial Lance at fight 3** to exercise the increased
AP cap and conservation. Try Ember/Cinder for early damage, or repeated Frost
for a defensive build. The two-Mote route is an optional comparison against
solo encounters. All numbers are provisional playtest tuning.

## Saves and scope

The current save is `exploritaire.mote-trials.v3`. Earlier v1/v2 browser saves
are left untouched. The v2 slice's earned ability collection is imported into
the new collection without equipping its old build. Seed and material data do
not enter the new combat state. Neither major rewards in other sandboxes nor
their normal reward pools receive these micro motes automatically.

Real spatial darkness, exploration, rescue and base construction are outside
this iteration. `GAME.md` retains the standing requirement that any future
return to spatial darkness uses Proto's actual camera and lighting engine.

## Validation

- `npm exec vitest run src/expedition/sceneRun.test.ts src/proto/rules/lightMotes.test.ts`
- `npm run build` (includes TypeScript checks)
- `node tools/aldan-scenes-playtest.cjs`
- `node tools/aldan-scenes-extras.cjs` after the main browser test

Browser checks run headlessly in isolated profiles without controlling the
user's mouse. Screenshots and layout reports go to `output/mote-trials`.
