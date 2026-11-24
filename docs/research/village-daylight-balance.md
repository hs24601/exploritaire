# Village daylight balance pass (2026-11-23)

Eric's rule for `village.html`: tie receipts to daylight. Working the tableau should cost very little daylight, and reaching for the stock should cost much more. This pass sets those numbers.

Sim: `npx vite-node tools/village-daylight-sim.ts [runs]`. It uses the real rules (`src/village/rules/`) with two simulated players. The **casual** player plays a random legal card. The **planner** looks 6 plays ahead for the longest, richest chain. Both turn the stock only when stuck. Each row is 300 deals.

## Chosen values

| Cost | Daylight |
| --- | --- |
| Play a card from the tableau | **2 min** |
| Turn a stock card | **15 min** (7.5× a play) |
| Walk out and deal a run | **15 min**, now **0** (Eric, 2026-11-24: no walking; the player works a node straight from the map) |
| Day length | 6:00 AM to 8:00 PM (**14 h**), +1 h with a Lantern Post |

The stock is the clock. In a full run, stock draws are about 75% of the daylight spent, and plays are about 20%. A 10-card chain costs 20 min, the same as one draw plus a walk. So a long chain feels nearly free, and every stock card feels like an hour passing.

## Per-run results (wrap on, King and Ace connect)

| Surface | Player | Plays | Draws | Units | Cleared | Median best chain | Full run | Min per unit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Forest | casual | 29.6 | 15.8 | 38.2 | 10% | 7 | 5.2 h | 8.6 |
| Forest | planner | 30.5 | 15.7 | 40.2 | 12% | 8 | 5.2 h | 8.0 |
| Berry Patch | casual | 31.2 | 14.9 | 31.2 | 7% | 8 | 5.0 h | 9.9 |
| Berry Patch | planner | 33.4 | 14.4 | 33.4 | 20% | 10 | 5.0 h | 9.0 |
| Quarry | casual | 27.2 | 20.2 | 47.1 | 26% | 6 | 6.2 h | 8.1 |
| Quarry | planner | 27.3 | 20.5 | 47.3 | 24% | 7 | 6.3 h | 8.1 |

- **Skill pays in daylight.** Planning saves 7–9% daylight per unit in the forest and berry patch. The berry patch rewards planning most (cleared 7% to 20%) because ripening is spatial. In the quarry, planning doesn't help because the rock is hidden. That's intended: digging is the press-your-luck surface.
- **Wrap stays on.** Without King–Ace wrap, almost no run clears (1–11%) and units drop 10–15%. Wrap keeps runs lively without hint UI.

## What a stock card is worth over a run

These are the average units gained between one stock draw and the next (planner):

| Draw | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 14 | 16 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Forest | 3.1 | 3.4 | 3.3 | 3.1 | 2.7 | 3.1 | 2.6 | 2.3 | 1.8 | 1.3 | 1.2 |
| Berry Patch | 3.4 | 4.2 | 3.7 | 3.4 | 2.9 | 2.7 | 1.8 | 1.2 | 0.8 | 0.5 | – |

Early stock cards pay about 3 units for 15 min. Late ones pay about 1. That makes **"walk away now or turn one more?"** a real decision. A player who leaves once three draws in a row each paid under 2 units gets 4–14% more per day than one who always turns the whole stock:

| Surface | Turns every card | Leaves when it thins |
| --- | --- | --- |
| Forest | 111 units/day (3.0 runs) | 115 units/day (4.7 runs) |
| Berry Patch | 95 units/day (3.0 runs) | 108 units/day (4.8 runs) |
| Quarry | 105 units/day (3.0 runs) | 114 units/day (4.8 runs) |

## Economy that falls out of it

Each surface gives about 100–115 units a day, so building costs are set in the 20–50 range (one to two buildings a day). Kin eat 6–10 food a night, about a fifth of a day of berry picking for each kin. A scripted plain player (in `village.test.ts`) reaches Town, the end of the slice, on day 5–6 across 8 seeds.

## Knobs to try in playtest

- If days feel too short: draw 12 min. If chains feel unrewarded: play 1 min.
- An escalating draw cost (15, 15, 20, 25...) would make leaving early sharper. It isn't in yet, because one flat number is easier to read.

## Forest rework: trees of two columns (2026-11-24)

Eric's rule change: the forest is now **8 columns of 4**, and each two adjacent columns are one tree (4 trees). A column pays its lumber **only when it's finished** (1 per log). Finishing both columns of a tree fells it for **+2** (+5 at Old Oaks). Lumber cut from a half-finished column is lost if you leave or the run ends, though Forestry XP is kept. Banks (+2) and the Woodshed (+1) now pay per felled tree, i.e. per finished pair.

Sim with the same bots (`npx vite-node tools/village-daylight-sim.ts 400`, wrap on, deal is free now):

| Forest | Plays | Draws | Earned | Cleared | Min/unit |
| --- | ---: | ---: | ---: | ---: | ---: |
| casual | 30.4 | 17.6 | 33.7 | 40% | 10.3 |
| planner | 29.9 | 18.1 | 32.9 | 28% | 10.5 |

One 14 h day on the forest alone: **81 units/day** if you play each deal out, **65** if you walk off early. Before the change it was 111 to 115. Berries (101 to 120) and Quarry (114 to 128) are unchanged.

What this means:

- **Leaving early is now a loss in the forest**, which is the point of the rule: you commit to finishing columns. It's the only surface where staying beats leaving.
- **The forest earns about 25% less per day** at +2 a tree. Raising the fell bonus closes the gap: +4 gives 94 a day, +5 gives 101, +6 gives 108. If lumber feels slow in play, +5 (with Old Oaks at +8) is the parity setting.

**Update, same day:** Eric moved the paired-column puzzle to **Old Oaks** (fell bonus +5, which is the parity setting above, about 101 a day). **Birch Stand** is back to the original 7 × 5 per-card forest (+2 a column, about 111 a day) as a placeholder until a reimagined felling puzzle replaces it.
