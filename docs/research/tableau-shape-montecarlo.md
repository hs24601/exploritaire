# Tableau shape Monte Carlo

Research for Eric, 2026-10-24 to 2026-10-25, from the "Balance tableau shape with Monte Carlo" thread. It covers how many foundations and columns combatsbx should use, how rule-bending abilities and AP behave, how to trade columns for foundations, compact and spatial layouts, crit spills and dead-run fixes, including enemy intent cards.

Simulator source and raw results are in the project files under `tableau-montecarlo/` (Node, no dependencies: `sim.js` shape and abilities, `sim2.js` layouts and crit spills, `sim3.js` camera ring, `sim4.js` multi-turn fights with mitigations).

## Model

- Golf ±1 with A/K wrap onto each Kin's foundation. Every tableau card is face-up.
- Infinifill: when a top card is taken, a random card is added underneath, so columns keep their depth (default 4). The scenarios thread confirmed this matches combatsbx.
- Withdraw redeals and ends the turn, so each party turn effectively starts from a fresh deal. Foundation ranks and AP carry over.
- **Expert** player: searches every visible line (up to 1,500 nodes) before each play. **Casual** player: picks the play that leaves the most plays open.
- A **streak** is the number of receipts (cards played) in one turn. It ends when nothing is legal or at 100 plays, which counts as a **runaway**.
- A **dead deal** is a turn with zero plays, which Withdraw absorbs at the cost of the turn.
- Momentum is +1 per receipt with no decay unless stated. AP is +1 per receipt for the receiving Kin. "Usable AP" assumes a cap of 6 per actor, spent every turn.
- Rates are from 600–1,500 turns per setting, so expect about ±1.5 points of noise.
- Wild/wildcard abilities were removed from the study at Eric's request (2026-10-25).

## Recommendations

1. **Keep 2 foundations × 7 columns.** About 8–11% of turns are dead deals that Withdraw absorbs. The median streak is 6, so a stagger break comes about half the time, and natural play never runs away.
2. **Keep foundations × columns between about 14 and 20.** A third actor roughly doubles streaks, so use 5–6 columns with 3 foundations and 4–5 with 4. Column depth above 3 barely matters.
3. **Limit rule-bending abilities per turn, don't just raise the price.** Any ability that plays a card earns a receipt back and can start a new run. A per-turn limit (max 2 uses) brings runaways to about 0% at any price. A ±2 that lasts the whole turn runs away at any price, so make it "next 3 plays" instead.
4. **Per-actor AP cap: 6.** Each actor banks a median of 2–3 AP per turn (75th percentile 6–7, 90th 12).
5. **One foundation needs about 14 playable cards.** The cheapest way to get that is 7 columns with the top two cards of each column playable. Trading for more foundations: 14 → 2×9 → 3×6 → 4×5.
6. **Crit spills:** 2 cards on a 5% crit chance per receipt on a 14-card table, or 2 cards at 10% on 2×7. Never spill on every stagger break.
7. **Dead runs:** one free pity flip only when a turn opens dead. Add a hold slot for playable cards only. Enemy intent cards are the strongest fix (see the tuning below).

## Foundations × columns

Expert play at depth 4. Each cell shows the median streak, then dead deals / runaway turns.

| foundations \ columns | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|
| 1 | 0 (60%/0%) | 0 (53%/0%) | 1 (44%/0%) | 1 (38%/0%) | 2 (34%/0%) | 2 (27%/0%) | 3 (23%/0%) | 4 (20%/0%) |
| 2 | 1 (37%/0%) | 2 (26%/0%) | 2 (17%/0%) | 4 (14%/0%) | 6 (8%/0%) | 8 (8%/0%) | 10 (5%/0%) | 17 (4%/1%) |
| 3 | 2 (21%/0%) | 3 (14%/0%) | 5 (8%/0%) | 9 (6%/0%) | 14 (3%/2%) | 25 (2%/4%) | 33 (2%/12%) | 49 (1%/19%) |
| 4 | 3 (16%/0%) | 6 (7%/0%) | 9 (4%/1%) | 20 (3%/4%) | 32 (1%/10%) | 42 (1%/17%) | 59 (1%/28%) | 76 (0%/38%) |

The band is dead deals at or under 12%, a median streak of at least 3, and runaways at or under 3%. More columns cut dead deals at every foundation count. Past the band, runaways climb fast: 2 foundations stay at 0–1% through 10 columns, while 3 and 4 foundations take off.

The skill gap grows with flexibility. Expert and casual medians are close on tight tables and far apart on loose ones (see the full table).

<details><summary>Full shape table</summary>

| shape | band | dead | median | casual median | p90 | 6+ receipts | runaway |
|---|---|---|---|---|---|---|---|
| 1F × 3C | too punishing | 60% | 0 | 0 | 2 | 0% | 0% |
| 1F × 4C | too punishing | 53% | 0 | 0 | 3 | 1% | 0% |
| 1F × 5C | too punishing | 44% | 1 | 1 | 4 | 4% | 0% |
| 1F × 6C | too punishing | 38% | 1 | 1 | 5 | 7% | 0% |
| 1F × 7C | too punishing | 34% | 2 | 2 | 7 | 15% | 0% |
| 1F × 8C | too punishing | 27% | 2 | 2 | 8 | 20% | 0% |
| 1F × 9C | too punishing | 23% | 3 | 3 | 10 | 26% | 0% |
| 1F × 10C | too punishing | 20% | 4 | 3 | 16 | 37% | 0% |
| 2F × 3C | too punishing | 37% | 1 | 1 | 5 | 6% | 0% |
| 2F × 4C | too punishing | 26% | 2 | 2 | 7 | 14% | 0% |
| 2F × 5C | too punishing | 17% | 2 | 2 | 11 | 24% | 0% |
| 2F × 6C | too punishing | 14% | 4 | 3 | 15 | 39% | 0% |
| 2F × 7C | in band | 8% | 6 | 5 | 26 | 52% | 0% |
| 2F × 8C | in band | 8% | 8 | 6 | 34 | 60% | 0% |
| 2F × 9C | in band | 5% | 10 | 8 | 44 | 66% | 0% |
| 2F × 10C | in band | 4% | 17 | 10 | 62 | 77% | 1% |
| 3F × 3C | too punishing | 21% | 2 | 2 | 7 | 18% | 0% |
| 3F × 4C | too punishing | 14% | 3 | 3 | 13 | 32% | 0% |
| 3F × 5C | in band | 8% | 5 | 4 | 23 | 48% | 0% |
| 3F × 6C | in band | 6% | 9 | 7 | 37 | 64% | 0% |
| 3F × 7C | in band | 3% | 14 | 9 | 55 | 72% | 2% |
| 3F × 8C | runaway risk | 2% | 25 | 13 | 76 | 80% | 4% |
| 3F × 9C | runaway risk | 2% | 33 | 16 | 100 | 86% | 12% |
| 3F × 10C | runaway risk | 1% | 49 | 21 | 100 | 91% | 19% |
| 4F × 3C | too punishing | 16% | 3 | 3 | 13 | 32% | 0% |
| 4F × 4C | in band | 7% | 6 | 5 | 24 | 52% | 0% |
| 4F × 5C | in band | 4% | 9 | 8 | 41 | 66% | 1% |
| 4F × 6C | runaway risk | 3% | 20 | 12 | 67 | 80% | 4% |
| 4F × 7C | runaway risk | 1% | 32 | 16 | 98 | 85% | 10% |
| 4F × 8C | runaway risk | 1% | 42 | 22 | 100 | 90% | 17% |
| 4F × 9C | runaway risk | 1% | 59 | 28 | 100 | 94% | 28% |
| 4F × 10C | runaway risk | 0% | 76 | 36 | 100 | 96% | 38% |

</details>

### Column depth

Depth only sets how far ahead you can plan. Anything from 3 cards up plays almost the same.

| shape | dead | median | mean | runaway |
|---|---|---|---|---|
| 2F × 7C, depth 1 | 12% | 4 | 5.6 | 0% |
| 2F × 7C, depth 2 | 11% | 5 | 7.7 | 0% |
| 2F × 7C, depth 3 | 11% | 6 | 8.6 | 0% |
| 2F × 7C, depth 4 | 11% | 6 | 9.3 | 0% |
| 2F × 7C, depth 5 | 11% | 5 | 9.1 | 0% |
| 2F × 7C, depth 6 | 10% | 6 | 9.9 | 0% |
| 2F × 7C, depth 8 | 11% | 5 | 9.7 | 0% |
| 3F × 7C, depth 1 | 5% | 8 | 10.6 | 0% |
| 3F × 7C, depth 2 | 3% | 11 | 16.6 | 0% |
| 3F × 7C, depth 3 | 4% | 15 | 22.0 | 1% |
| 3F × 7C, depth 4 | 4% | 17 | 24.4 | 1% |
| 3F × 7C, depth 5 | 3% | 16 | 23.2 | 2% |
| 3F × 7C, depth 6 | 4% | 17 | 25.2 | 2% |
| 3F × 7C, depth 8 | 4% | 16 | 24.2 | 2% |

## Rule-bending abilities

Shared Momentum pool, 2 foundations × 7 columns. The ability is used whenever the party is stuck and can afford it. The table shows runaway turns at each Momentum cost.

| ability | 1 | 2 | 3 | 4 | 6 | 8 | 10 | 12 | 16 |
|---|---|---|---|---|---|---|---|---|---|
| Stretch ±2 (1 play) | 10% | 9% | 5% | 7% | 4% | 2% | 1% | 1% | 0% |
| Loosen ±2 (whole turn) | 63% | 57% | 50% | 44% | 34% | 27% | 24% | 21% | 15% |
| Redraw | 77% | 39% | 17% | 8% | 3% | 1% | 0% | 1% | 0% |

- **Stretch** (one ±2 play) is the safest rule-bender: about 5–9% runaway at 2–4 Momentum and 0% with a 2-per-turn limit.
- **Loosen** (±2 for the rest of the turn) behaves like extra foundations and runs away at any price (15% even at 16 Momentum).
- **Redraw** (one foundation gets a random rank) is fine from 4–6 Momentum.
- If Momentum decay halves its value per play, the safe price roughly halves.

### Limits beat prices

| table | mode | ability | cost | median | runaway |
|---|---|---|---|---|---|
| 2F × 6C | decay 0.5/receipt | Stretch ±2 (1 play) | 2 | 5 | 2% |
| 2F × 6C | decay 0.5/receipt | Stretch ±2 (1 play) | 3 | 3 | 0% |
| 2F × 6C | decay 0.5/receipt | Stretch ±2 (1 play) | 4 | 4 | 0% |
| 2F × 6C | decay 0.5/receipt | Stretch ±2 (1 play) | 6 | 4 | 0% |
| 2F × 6C | decay 0.5/receipt | Stretch ±2 (1 play) | 8 | 4 | 0% |
| 2F × 7C | decay 0.5/receipt | Stretch ±2 (1 play) | 2 | 10 | 3% |
| 2F × 7C | decay 0.5/receipt | Stretch ±2 (1 play) | 3 | 5 | 4% |
| 2F × 7C | decay 0.5/receipt | Stretch ±2 (1 play) | 4 | 5 | 3% |
| 2F × 7C | decay 0.5/receipt | Stretch ±2 (1 play) | 6 | 5 | 1% |
| 2F × 7C | decay 0.5/receipt | Stretch ±2 (1 play) | 8 | 6 | 0% |
| 2F × 6C | rising price | Stretch ±2 (1 play) | 2 | 10 | 0% |
| 2F × 6C | rising price | Stretch ±2 (1 play) | 3 | 6 | 0% |
| 2F × 6C | rising price | Stretch ±2 (1 play) | 4 | 5 | 0% |
| 2F × 6C | rising price | Stretch ±2 (1 play) | 6 | 4 | 0% |
| 2F × 7C | rising price | Stretch ±2 (1 play) | 2 | 16 | 3% |
| 2F × 7C | rising price | Stretch ±2 (1 play) | 3 | 12 | 2% |
| 2F × 7C | rising price | Stretch ±2 (1 play) | 4 | 8 | 2% |
| 2F × 7C | rising price | Stretch ±2 (1 play) | 6 | 7 | 0% |
| 2F × 6C | max 2/turn | Stretch ±2 (1 play) | 2 | 9 | 0% |
| 2F × 6C | max 2/turn | Stretch ±2 (1 play) | 3 | 7 | 0% |
| 2F × 6C | max 2/turn | Stretch ±2 (1 play) | 4 | 6 | 0% |
| 2F × 6C | max 2/turn | Stretch ±2 (1 play) | 6 | 4 | 0% |
| 2F × 7C | max 2/turn | Stretch ±2 (1 play) | 2 | 16 | 0% |
| 2F × 7C | max 2/turn | Stretch ±2 (1 play) | 3 | 14 | 0% |
| 2F × 7C | max 2/turn | Stretch ±2 (1 play) | 4 | 11 | 0% |
| 2F × 7C | max 2/turn | Stretch ±2 (1 play) | 6 | 6 | 0% |

<details><summary>All ability runs</summary>

| table | ability | cost | uses/turn | median | mean | runaway |
|---|---|---|---|---|---|---|
| 2F × 6C | Loosen ±2 (whole turn) | 1 | 0.85 | 100 | 58.9 | 51% |
| 2F × 6C | Loosen ±2 (whole turn) | 2 | 0.71 | 63 | 52.7 | 47% |
| 2F × 6C | Loosen ±2 (whole turn) | 3 | 0.61 | 8 | 42.8 | 36% |
| 2F × 6C | Loosen ±2 (whole turn) | 4 | 0.51 | 5 | 35.2 | 30% |
| 2F × 6C | Loosen ±2 (whole turn) | 6 | 0.39 | 4 | 28.4 | 24% |
| 2F × 6C | Loosen ±2 (whole turn) | 8 | 0.26 | 3 | 22.5 | 18% |
| 2F × 6C | Loosen ±2 (whole turn) | 10 | 0.17 | 3 | 15.8 | 12% |
| 2F × 6C | Loosen ±2 (whole turn) | 12 | 0.16 | 4 | 15.2 | 10% |
| 2F × 6C | Loosen ±2 (whole turn) | 16 | 0.09 | 4 | 11.0 | 6% |
| 2F × 6C | Redraw | 1 | 30.0 | 100 | 65.7 | 63% |
| 2F × 6C | Redraw | 2 | 11.83 | 9 | 31.9 | 20% |
| 2F × 6C | Redraw | 3 | 4.7 | 5 | 16.4 | 4% |
| 2F × 6C | Redraw | 4 | 2.38 | 3 | 11.5 | 1% |
| 2F × 6C | Redraw | 6 | 1.12 | 4 | 8.9 | 0% |
| 2F × 6C | Redraw | 8 | 0.61 | 4 | 7.6 | 0% |
| 2F × 6C | Redraw | 10 | 0.34 | 4 | 6.8 | 0% |
| 2F × 6C | Redraw | 12 | 0.25 | 4 | 6.9 | 0% |
| 2F × 6C | Redraw | 16 | 0.12 | 4 | 6.4 | 0% |
| 2F × 6C | Stretch ±2 (1 play) | 1 | 3.94 | 15 | 23.4 | 3% |
| 2F × 6C | Stretch ±2 (1 play) | 2 | 3.66 | 13 | 23.6 | 3% |
| 2F × 6C | Stretch ±2 (1 play) | 3 | 2.5 | 7 | 18.6 | 2% |
| 2F × 6C | Stretch ±2 (1 play) | 4 | 1.96 | 5 | 15.6 | 2% |
| 2F × 6C | Stretch ±2 (1 play) | 6 | 0.96 | 3 | 10.8 | 1% |
| 2F × 6C | Stretch ±2 (1 play) | 8 | 0.6 | 4 | 9.5 | 0% |
| 2F × 6C | Stretch ±2 (1 play) | 10 | 0.26 | 4 | 7.2 | 0% |
| 2F × 6C | Stretch ±2 (1 play) | 12 | 0.28 | 4 | 7.9 | 0% |
| 2F × 6C | Stretch ±2 (1 play) | 16 | 0.12 | 4 | 6.7 | 0% |
| 2F × 7C | Loosen ±2 (whole turn) | 1 | 0.9 | 100 | 69.3 | 63% |
| 2F × 7C | Loosen ±2 (whole turn) | 2 | 0.82 | 100 | 62.7 | 57% |
| 2F × 7C | Loosen ±2 (whole turn) | 3 | 0.7 | 100 | 55.4 | 50% |
| 2F × 7C | Loosen ±2 (whole turn) | 4 | 0.62 | 23 | 49.2 | 44% |
| 2F × 7C | Loosen ±2 (whole turn) | 6 | 0.5 | 6 | 40.0 | 34% |
| 2F × 7C | Loosen ±2 (whole turn) | 8 | 0.4 | 5 | 32.8 | 27% |
| 2F × 7C | Loosen ±2 (whole turn) | 10 | 0.34 | 6 | 29.4 | 24% |
| 2F × 7C | Loosen ±2 (whole turn) | 12 | 0.29 | 6 | 26.0 | 21% |
| 2F × 7C | Loosen ±2 (whole turn) | 16 | 0.2 | 6 | 20.8 | 15% |
| 2F × 7C | Redraw | 1 | 27.39 | 100 | 78.5 | 77% |
| 2F × 7C | Redraw | 2 | 13.66 | 24 | 47.1 | 39% |
| 2F × 7C | Redraw | 3 | 7.62 | 10 | 31.7 | 17% |
| 2F × 7C | Redraw | 4 | 4.67 | 7 | 23.6 | 8% |
| 2F × 7C | Redraw | 6 | 1.9 | 6 | 14.9 | 3% |
| 2F × 7C | Redraw | 8 | 1.11 | 5 | 12.5 | 1% |
| 2F × 7C | Redraw | 10 | 0.76 | 5 | 11.5 | 0% |
| 2F × 7C | Redraw | 12 | 0.54 | 5 | 11.2 | 1% |
| 2F × 7C | Redraw | 16 | 0.31 | 5 | 10.1 | 0% |
| 2F × 7C | Stretch ±2 (1 play) | 1 | 4.37 | 25 | 34.9 | 10% |
| 2F × 7C | Stretch ±2 (1 play) | 2 | 4.09 | 19 | 32.3 | 9% |
| 2F × 7C | Stretch ±2 (1 play) | 3 | 3.35 | 16 | 28.2 | 5% |
| 2F × 7C | Stretch ±2 (1 play) | 4 | 2.76 | 9 | 25.3 | 7% |
| 2F × 7C | Stretch ±2 (1 play) | 6 | 1.6 | 6 | 19.3 | 4% |
| 2F × 7C | Stretch ±2 (1 play) | 8 | 1.12 | 5 | 15.7 | 2% |
| 2F × 7C | Stretch ±2 (1 play) | 10 | 0.8 | 6 | 15.7 | 1% |
| 2F × 7C | Stretch ±2 (1 play) | 12 | 0.53 | 6 | 12.9 | 1% |
| 2F × 7C | Stretch ±2 (1 play) | 16 | 0.23 | 5 | 9.9 | 0% |
| 3F × 5C | Loosen ±2 (whole turn) | 1 | 0.92 | 100 | 74.5 | 67% |
| 3F × 5C | Loosen ±2 (whole turn) | 2 | 0.76 | 100 | 60.4 | 54% |
| 3F × 5C | Loosen ±2 (whole turn) | 3 | 0.7 | 100 | 57.6 | 52% |
| 3F × 5C | Loosen ±2 (whole turn) | 4 | 0.63 | 58 | 52.0 | 46% |
| 3F × 5C | Loosen ±2 (whole turn) | 6 | 0.54 | 12 | 46.0 | 40% |
| 3F × 5C | Loosen ±2 (whole turn) | 8 | 0.38 | 5 | 32.2 | 26% |
| 3F × 5C | Loosen ±2 (whole turn) | 10 | 0.35 | 5 | 32.2 | 27% |
| 3F × 5C | Loosen ±2 (whole turn) | 12 | 0.26 | 5 | 23.8 | 18% |
| 3F × 5C | Loosen ±2 (whole turn) | 16 | 0.2 | 5 | 20.7 | 14% |
| 3F × 5C | Redraw | 1 | 29.99 | 100 | 69.7 | 67% |
| 3F × 5C | Redraw | 2 | 11.97 | 11 | 32.9 | 20% |
| 3F × 5C | Redraw | 3 | 6.5 | 9 | 24.7 | 10% |
| 3F × 5C | Redraw | 4 | 3.4 | 6 | 16.0 | 2% |
| 3F × 5C | Redraw | 6 | 1.79 | 5 | 13.7 | 1% |
| 3F × 5C | Redraw | 8 | 1.12 | 5 | 12.2 | 0% |
| 3F × 5C | Redraw | 10 | 0.71 | 5 | 10.9 | 0% |
| 3F × 5C | Redraw | 12 | 0.5 | 5 | 10.2 | 0% |
| 3F × 5C | Redraw | 16 | 0.28 | 6 | 9.8 | 0% |
| 3F × 5C | Stretch ±2 (1 play) | 1 | 6.33 | 36 | 43.7 | 17% |
| 3F × 5C | Stretch ±2 (1 play) | 2 | 5.14 | 29 | 38.6 | 15% |
| 3F × 5C | Stretch ±2 (1 play) | 3 | 4.58 | 22 | 35.7 | 14% |
| 3F × 5C | Stretch ±2 (1 play) | 4 | 3.15 | 9 | 26.0 | 9% |
| 3F × 5C | Stretch ±2 (1 play) | 6 | 1.66 | 5 | 17.9 | 4% |
| 3F × 5C | Stretch ±2 (1 play) | 8 | 1.22 | 5 | 16.9 | 3% |
| 3F × 5C | Stretch ±2 (1 play) | 10 | 0.76 | 5 | 13.4 | 2% |
| 3F × 5C | Stretch ±2 (1 play) | 12 | 0.6 | 6 | 13.1 | 1% |
| 3F × 5C | Stretch ±2 (1 play) | 16 | 0.31 | 5 | 10.8 | 1% |
| 3F × 7C | Loosen ±2 (whole turn) | 1 | 0.94 | 100 | 86.8 | 83% |
| 3F × 7C | Loosen ±2 (whole turn) | 2 | 0.9 | 100 | 80.4 | 76% |
| 3F × 7C | Loosen ±2 (whole turn) | 3 | 0.86 | 100 | 78.3 | 75% |
| 3F × 7C | Loosen ±2 (whole turn) | 4 | 0.79 | 100 | 74.9 | 71% |
| 3F × 7C | Loosen ±2 (whole turn) | 6 | 0.71 | 100 | 68.7 | 65% |
| 3F × 7C | Loosen ±2 (whole turn) | 8 | 0.66 | 100 | 64.2 | 60% |
| 3F × 7C | Loosen ±2 (whole turn) | 10 | 0.61 | 100 | 60.4 | 56% |
| 3F × 7C | Loosen ±2 (whole turn) | 12 | 0.59 | 100 | 57.4 | 51% |
| 3F × 7C | Loosen ±2 (whole turn) | 16 | 0.47 | 15 | 49.9 | 44% |
| 3F × 7C | Redraw | 1 | 19.73 | 100 | 89.3 | 88% |
| 3F × 7C | Redraw | 2 | 14.66 | 100 | 73.6 | 67% |
| 3F × 7C | Redraw | 3 | 9.8 | 60 | 56.8 | 43% |
| 3F × 7C | Redraw | 4 | 7.0 | 39 | 49.2 | 34% |
| 3F × 7C | Redraw | 6 | 4.37 | 26 | 41.0 | 22% |
| 3F × 7C | Redraw | 8 | 2.94 | 21 | 35.0 | 14% |
| 3F × 7C | Redraw | 10 | 2.12 | 20 | 31.7 | 10% |
| 3F × 7C | Redraw | 12 | 1.55 | 14 | 28.7 | 8% |
| 3F × 7C | Redraw | 16 | 1.14 | 16 | 28.4 | 6% |
| 3F × 7C | Stretch ±2 (1 play) | 1 | 5.9 | 100 | 78.0 | 60% |
| 3F × 7C | Stretch ±2 (1 play) | 2 | 5.12 | 100 | 72.5 | 52% |
| 3F × 7C | Stretch ±2 (1 play) | 3 | 4.76 | 95 | 66.8 | 50% |
| 3F × 7C | Stretch ±2 (1 play) | 4 | 4.31 | 81 | 60.8 | 44% |
| 3F × 7C | Stretch ±2 (1 play) | 6 | 3.41 | 59 | 56.0 | 40% |
| 3F × 7C | Stretch ±2 (1 play) | 8 | 2.63 | 38 | 48.6 | 31% |
| 3F × 7C | Stretch ±2 (1 play) | 10 | 1.7 | 18 | 39.5 | 23% |
| 3F × 7C | Stretch ±2 (1 play) | 12 | 1.59 | 20 | 36.8 | 18% |
| 3F × 7C | Stretch ±2 (1 play) | 16 | 1.04 | 15 | 33.6 | 15% |

</details>

## Per-actor AP

Momentum is the team pool. Each card banks +1 AP for the actor whose foundation it lands on.

- **Cap 6 per actor.** On 2×7, each actor banks a median of 2–3 AP per turn (75th percentile 6–7, 90th 12), and 22–27% of turns give an actor nothing. A cap of 6 fills in about two turns of saving, holds two 3-AP Mochi casts, and leaves room for a later "raise your cap" ability.
- **Feeding one actor is rarer than it sounds.** A card fits both foundations only when they are two ranks apart, about 0.4 times per turn. The real choice is which line you play. In 26% of opening deals, giving up at most one play gets Hero more AP (+0.9 on average), lifting Hero's chance of 3+ AP from 44% to 55%. With 3 foundations that happens in 45% of deals.
- A self-cast Stretch paid from AP stays at about 1% runaway at any AP cost on 2×7.

| foundations | ability | AP cost | mean receipts | runaway |
|---|---|---|---|---|
| 2 | Stretch ±2 (1 play) | 1 | 18.3 | 1% |
| 2 | Stretch ±2 (1 play) | 2 | 18.1 | 1% |
| 2 | Stretch ±2 (1 play) | 3 | 14.4 | 1% |
| 2 | Stretch ±2 (1 play) | 4 | 11.2 | 0% |
| 2 | Stretch ±2 (1 play) | 5 | 11.2 | 0% |
| 2 | Stretch ±2 (1 play) | 6 | 11.5 | 0% |
| 2 | Stretch ±2 (1 play) | 8 | 9.6 | 0% |
| 2 | Stretch ±2 (1 play) | 10 | 10.4 | 0% |
| 3 | Stretch ±2 (1 play) | 1 | 38.3 | 9% |
| 3 | Stretch ±2 (1 play) | 2 | 36.4 | 10% |
| 3 | Stretch ±2 (1 play) | 3 | 33.7 | 10% |
| 3 | Stretch ±2 (1 play) | 4 | 30.0 | 8% |
| 3 | Stretch ±2 (1 play) | 5 | 30.8 | 6% |
| 3 | Stretch ±2 (1 play) | 6 | 28.0 | 6% |
| 3 | Stretch ±2 (1 play) | 8 | 27.6 | 5% |
| 3 | Stretch ±2 (1 play) | 10 | 26.1 | 5% |

## Trading columns for foundations

Start with one foundation on a wide table and trade columns for extra foundations.

- **One foundation needs about 14 columns.** Below 13 columns, more than 12% of deals are dead. At 14 columns, 9% are dead, the median streak is 11 and 1% of turns run away. Past 16 columns, runaways climb (4% at 16, 18% at 20). For today's pace, use 13 columns (median 8, 12% dead).
- **Each extra foundation is worth fewer columns.** At equal receipts, the second foundation is worth 4–5 columns, the third 2–3 and the fourth about 1.
- **At equal receipts the foundation side still wins.** 1×14 and 2×9 both play about 19 receipts a turn, but 2×9 has fewer dead deals (6% vs 9%) and nearly double the usable AP (8.1 vs 4.6), because a lone actor keeps hitting the 6-AP cap.

Suggested ladder: chip damage stays roughly flat while ability fuel more than doubles.

| step | shape | dead | median | receipts/turn | usable AP/turn |
|---|---|---|---|---|---|
| 1 | 1F × 14C | 9% | 11 | 19.1 | 4.6 |
| 2 | 2F × 9C | 6% | 13 | 18.7 | 8.1 |
| 3 | 3F × 6C | 5% | 10 | 15.4 | 9.6 |
| 4 | 4F × 5C | 5% | 10 | 17.1 | 11.5 |

<details><summary>Full trade table</summary>

| shape | dead | median | receipts/turn | 6+ | runaway |
|---|---|---|---|---|---|
| 1F × 6C | 36% | 1 | 2.0 | 9% | 0% |
| 1F × 7C | 32% | 2 | 2.4 | 13% | 0% |
| 1F × 8C | 27% | 2 | 3.2 | 19% | 0% |
| 1F × 9C | 22% | 3 | 4.4 | 27% | 0% |
| 1F × 10C | 17% | 3 | 6.2 | 37% | 0% |
| 1F × 11C | 16% | 5 | 8.7 | 47% | 0% |
| 1F × 12C | 13% | 6 | 11.2 | 53% | 0% |
| 1F × 13C | 12% | 8 | 14.5 | 60% | 0% |
| 1F × 14C | 9% | 11 | 19.1 | 65% | 1% |
| 1F × 15C | 9% | 16 | 24.0 | 72% | 1% |
| 1F × 16C | 8% | 22 | 29.8 | 74% | 4% |
| 1F × 17C | 7% | 29 | 34.6 | 80% | 5% |
| 1F × 18C | 4% | 36 | 42.4 | 85% | 11% |
| 1F × 19C | 5% | 41 | 46.8 | 88% | 15% |
| 1F × 20C | 4% | 51 | 52.3 | 89% | 18% |
| 1F × 21C | 3% | 57 | 57.5 | 91% | 25% |
| 1F × 22C | 2% | 66 | 62.8 | 94% | 30% |
| 1F × 23C | 2% | 78 | 68.4 | 95% | 39% |
| 1F × 24C | 2% | 85 | 71.3 | 95% | 42% |
| 2F × 3C | 40% | 1 | 1.6 | 6% | 0% |
| 2F × 4C | 31% | 1 | 2.4 | 13% | 0% |
| 2F × 5C | 20% | 2 | 3.9 | 24% | 0% |
| 2F × 6C | 12% | 4 | 6 | 38% | 0% |
| 2F × 7C | 11% | 6 | 9.2 | 51% | 0% |
| 2F × 8C | 9% | 7 | 12.7 | 59% | 0% |
| 2F × 9C | 6% | 13 | 18.7 | 69% | 0% |
| 2F × 10C | 5% | 18 | 25.6 | 75% | 2% |
| 2F × 11C | 2% | 27 | 34.3 | 82% | 5% |
| 2F × 12C | 2% | 36 | 41.2 | 85% | 8% |
| 2F × 13C | 2% | 46 | 49.2 | 89% | 16% |
| 3F × 3C | 24% | 2 | 3.1 | 18% | 0% |
| 3F × 4C | 13% | 3 | 5.8 | 35% | 0% |
| 3F × 5C | 9% | 5 | 9.8 | 49% | 0% |
| 3F × 6C | 5% | 10 | 15.4 | 63% | 0% |
| 3F × 7C | 4% | 16 | 23.4 | 73% | 1% |
| 3F × 8C | 3% | 22 | 30.0 | 79% | 4% |
| 3F × 9C | 2% | 34 | 41.3 | 86% | 11% |
| 4F × 3C | 15% | 3 | 4.9 | 31% | 0% |
| 4F × 4C | 8% | 5 | 9.1 | 44% | 0% |
| 4F × 5C | 5% | 10 | 17.1 | 65% | 0% |
| 4F × 6C | 3% | 19 | 27.3 | 78% | 3% |

</details>

## Fourteen columns of play in a 7-column footprint

What matters is how many cards are playable at once, not how many columns there are.

| layout | foundations | dead | median | receipts/turn | runaway |
|---|---|---|---|---|---|
| 7 columns | 1 | 31% | 2 | 2.6 | 0% |
| 10 columns | 1 | 20% | 4 | 6.1 | 0% |
| 12 columns | 1 | 14% | 5 | 10.7 | 0% |
| 7 columns + 5-card hand row | 1 | 13% | 5 | 8.8 | 0% |
| 7 columns + 7-card hand row | 1 | 10% | 8 | 12.4 | 0% |
| Two rows of 7 short columns | 1 | 11% | 10 | 17.1 | 0% |
| 7 columns, top two playable | 1 | 9% | 12 | 18.5 | 1% |
| 7 deep columns (6), top two playable | 1 | 9% | 11 | 18.8 | 0% |
| 14 columns | 1 | 10% | 11 | 19.8 | 1% |
| 7 columns, top two playable | 2 | 2% | 42 | 46.3 | 13% |
| Two rows of 7 short columns | 2 | 2% | 44 | 47.8 | 15% |
| 7 columns + 7-card hand row | 2 | 1% | 34 | 40.4 | 7% |

- **Best fit: 7 columns with the top two cards of each column playable.** It matches 1×14 almost exactly without widening the table. Two rows of 7 short columns also works. A 7-card hand row is a little weaker, about like 13 columns.
- **The trade ladder really counts playable cards (14 → 9 → 6 → 5).** Top-two-playable with 2 foundations behaves like 2×14 (13% runaway), so take the second playable card away when the second foundation joins. Plain 2×7 is today's in-band table.
- **Forward/back along rows** behaves like top-two-playable: reaching one row deeper roughly doubles your playable cards.

## Crit spills

On a crit, a few random cards spill out as loose face-up cards. They can be played this turn and never refill. A crit either has a fixed chance per receipt or happens on every stagger break (every 6th receipt).

- **Spills lengthen streaks but never fix dead deals.** A dead deal has no receipt to crit on, and the dead-deal rate doesn't move in any setting.
- **Spills feed themselves.** On a 14-card table, spilling on every stagger break runs away in 7% of turns with 1 card and 20% with 2.
- **Recommended:** 2 cards on a 5% crit per receipt on the 14-card table (3% runaway, median about the same). On today's 2×7, 2 cards at 10% (receipts 9 → 15, 1% runaway), or 3 cards at 5% for rarer, bigger crits (1% runaway).

<details><summary>All spill runs</summary>

| table | trigger | cards | dead | median | receipts/turn | runaway |
|---|---|---|---|---|---|---|
| 1F × 10 | every stagger break | 1 | 19% | 3 | 6.9 | 0% |
| 1F × 10 | every stagger break | 2 | 17% | 4 | 9.0 | 1% |
| 1F × 10 | every stagger break | 3 | 20% | 4 | 12.3 | 5% |
| 1F × 10 | every stagger break | 4 | 18% | 4 | 16.6 | 11% |
| 1F × 10 | 5% per receipt | 1 | 19% | 3 | 6.0 | 0% |
| 1F × 10 | 5% per receipt | 2 | 18% | 4 | 7.5 | 0% |
| 1F × 10 | 5% per receipt | 3 | 17% | 4 | 8.0 | 0% |
| 1F × 10 | 5% per receipt | 4 | 20% | 4 | 9.2 | 1% |
| 1F × 10 | 10% per receipt | 1 | 18% | 4 | 7.1 | 0% |
| 1F × 10 | 10% per receipt | 2 | 19% | 4 | 9.0 | 0% |
| 1F × 10 | 10% per receipt | 3 | 18% | 4 | 10.4 | 2% |
| 1F × 10 | 10% per receipt | 4 | 17% | 4 | 12.8 | 4% |
| 1F × 10 | 20% per receipt | 1 | 19% | 4 | 8.5 | 1% |
| 1F × 10 | 20% per receipt | 2 | 23% | 4 | 12.8 | 4% |
| 1F × 10 | 20% per receipt | 3 | 18% | 5 | 22.0 | 14% |
| 1F × 10 | 20% per receipt | 4 | 18% | 4 | 25.1 | 20% |
| 1F × 14 | every stagger break | 1 | 11% | 14 | 26.5 | 6% |
| 1F × 14 | every stagger break | 2 | 11% | 13 | 35.0 | 20% |
| 1F × 14 | every stagger break | 3 | 10% | 23 | 44.9 | 35% |
| 1F × 14 | every stagger break | 4 | 8% | 24 | 48.7 | 43% |
| 1F × 14 | 5% per receipt | 1 | 9% | 13 | 22.3 | 1% |
| 1F × 14 | 5% per receipt | 2 | 10% | 12 | 21.4 | 3% |
| 1F × 14 | 5% per receipt | 3 | 10% | 12 | 25.3 | 6% |
| 1F × 14 | 5% per receipt | 4 | 10% | 18 | 30.5 | 9% |
| 1F × 14 | 10% per receipt | 1 | 8% | 12 | 22.5 | 3% |
| 1F × 14 | 10% per receipt | 2 | 9% | 13 | 29.4 | 10% |
| 1F × 14 | 10% per receipt | 3 | 10% | 19 | 36.0 | 19% |
| 1F × 14 | 10% per receipt | 4 | 8% | 18 | 38.7 | 25% |
| 1F × 14 | 20% per receipt | 1 | 11% | 17 | 30.2 | 10% |
| 1F × 14 | 20% per receipt | 2 | 8% | 24 | 41.2 | 26% |
| 1F × 14 | 20% per receipt | 3 | 7% | 40 | 52.2 | 45% |
| 1F × 14 | 20% per receipt | 4 | 8% | 100 | 57.8 | 54% |
| 1F × 7 | every stagger break | 1 | 33% | 2 | 2.4 | 0% |
| 1F × 7 | every stagger break | 2 | 27% | 2 | 3.0 | 0% |
| 1F × 7 | every stagger break | 3 | 30% | 2 | 2.9 | 0% |
| 1F × 7 | every stagger break | 4 | 32% | 2 | 3.9 | 1% |
| 1F × 7 | 5% per receipt | 1 | 30% | 2 | 2.5 | 0% |
| 1F × 7 | 5% per receipt | 2 | 33% | 2 | 2.7 | 0% |
| 1F × 7 | 5% per receipt | 3 | 30% | 2 | 3.0 | 0% |
| 1F × 7 | 5% per receipt | 4 | 30% | 2 | 2.8 | 0% |
| 1F × 7 | 10% per receipt | 1 | 33% | 2 | 2.7 | 0% |
| 1F × 7 | 10% per receipt | 2 | 33% | 2 | 2.9 | 0% |
| 1F × 7 | 10% per receipt | 3 | 29% | 2 | 3.0 | 0% |
| 1F × 7 | 10% per receipt | 4 | 35% | 1 | 3.9 | 0% |
| 1F × 7 | 20% per receipt | 1 | 30% | 2 | 3.0 | 0% |
| 1F × 7 | 20% per receipt | 2 | 33% | 2 | 3.5 | 0% |
| 1F × 7 | 20% per receipt | 3 | 32% | 2 | 5.3 | 1% |
| 1F × 7 | 20% per receipt | 4 | 30% | 2 | 8.5 | 5% |
| 2F × 7 | every stagger break | 1 | 9% | 5 | 12.1 | 0% |
| 2F × 7 | every stagger break | 2 | 11% | 6 | 18.8 | 6% |
| 2F × 7 | every stagger break | 3 | 12% | 5 | 21.8 | 12% |
| 2F × 7 | every stagger break | 4 | 10% | 6 | 32.1 | 25% |
| 2F × 7 | 5% per receipt | 1 | 10% | 5 | 9.3 | 0% |
| 2F × 7 | 5% per receipt | 2 | 11% | 6 | 10.7 | 0% |
| 2F × 7 | 5% per receipt | 3 | 7% | 6 | 12.9 | 1% |
| 2F × 7 | 5% per receipt | 4 | 10% | 7 | 14.8 | 2% |
| 2F × 7 | 10% per receipt | 1 | 12% | 6 | 10.6 | 0% |
| 2F × 7 | 10% per receipt | 2 | 10% | 6 | 15.4 | 1% |
| 2F × 7 | 10% per receipt | 3 | 13% | 7 | 18.0 | 4% |
| 2F × 7 | 10% per receipt | 4 | 12% | 6 | 22.0 | 11% |
| 2F × 7 | 20% per receipt | 1 | 10% | 6 | 12.5 | 1% |
| 2F × 7 | 20% per receipt | 2 | 12% | 7 | 23.1 | 10% |
| 2F × 7 | 20% per receipt | 3 | 13% | 7 | 32.5 | 24% |
| 2F × 7 | 20% per receipt | 4 | 12% | 9 | 36.1 | 29% |
| 1F × 7 top-two | every stagger break | 1 | 11% | 10 | 21.8 | 5% |
| 1F × 7 top-two | every stagger break | 2 | 8% | 15 | 34.0 | 19% |
| 1F × 7 top-two | every stagger break | 3 | 9% | 15 | 39.7 | 30% |
| 1F × 7 top-two | every stagger break | 4 | 10% | 24 | 48.7 | 44% |
| 1F × 7 top-two | 5% per receipt | 1 | 8% | 12 | 19.2 | 1% |
| 1F × 7 top-two | 5% per receipt | 2 | 8% | 11 | 21.0 | 3% |
| 1F × 7 top-two | 5% per receipt | 3 | 9% | 13 | 23.6 | 5% |
| 1F × 7 top-two | 5% per receipt | 4 | 11% | 13 | 26.7 | 7% |
| 1F × 7 top-two | 10% per receipt | 1 | 10% | 10 | 19.8 | 1% |
| 1F × 7 top-two | 10% per receipt | 2 | 9% | 14 | 28.2 | 8% |
| 1F × 7 top-two | 10% per receipt | 3 | 10% | 15 | 31.7 | 14% |
| 1F × 7 top-two | 10% per receipt | 4 | 12% | 16 | 37.1 | 24% |
| 1F × 7 top-two | 20% per receipt | 1 | 8% | 13 | 25.7 | 6% |
| 1F × 7 top-two | 20% per receipt | 2 | 12% | 18 | 38.2 | 23% |
| 1F × 7 top-two | 20% per receipt | 3 | 10% | 32 | 49.3 | 40% |
| 1F × 7 top-two | 20% per receipt | 4 | 12% | 100 | 56.8 | 52% |

</details>

## Camera ring

The 14 columns stand in a circle around the party, and only an arc in front of the camera is playable. Turning one column costs Momentum. With **free look** you can see every column but only play inside the arc, and the expert plans its turning as part of the line. With **blind** turning you only know the arc. **Bank** is the Momentum carried into the turn. Flat 1×14 for reference: 9% dead, median 11.

| arc | look | bank | cost/column | dead | median | receipts/turn | Momentum on turning | runaway |
|---|---|---|---|---|---|---|---|---|
| 5 | blind | 3 | 0.5 | 14% | 4 | 5.5 | 8.3 | 0% |
| 5 | blind | 3 | 1 | 27% | 2 | 3.3 | 6.3 | 0% |
| 7 | blind | 3 | 0.5 | 11% | 4 | 6.3 | 9.0 | 0% |
| 7 | blind | 3 | 1 | 19% | 4 | 5.4 | 8.4 | 0% |
| 3 | free | 0 | 0 | 10% | 11 | 21.1 | 0 | 1% |
| 3 | free | 0 | 0.5 | 61% | 0 | 4.7 | 3.8 | 0% |
| 3 | free | 0 | 1 | 61% | 0 | 1.6 | 1.0 | 0% |
| 3 | free | 0 | 2 | 64% | 0 | 0.8 | 0.3 | 0% |
| 3 | free | 3 | 0 | 11% | 12 | 20.2 | 0 | 0% |
| 3 | free | 3 | 0.5 | 10% | 9 | 19.9 | 19.4 | 2% |
| 3 | free | 3 | 1 | 25% | 3 | 4.9 | 5.5 | 0% |
| 3 | free | 3 | 2 | 46% | 1 | 1.6 | 1.8 | 0% |
| 5 | free | 0 | 0 | 10% | 10 | 19.6 | 0 | 1% |
| 5 | free | 0 | 0.5 | 48% | 1 | 9.2 | 6.2 | 1% |
| 5 | free | 0 | 1 | 44% | 1 | 5.4 | 4.2 | 0% |
| 5 | free | 0 | 2 | 41% | 1 | 2.3 | 1.1 | 0% |
| 5 | free | 3 | 0 | 10% | 12 | 20.3 | 0 | 1% |
| 5 | free | 3 | 0.5 | 11% | 12 | 21.6 | 16.6 | 1% |
| 5 | free | 3 | 1 | 14% | 6 | 14.0 | 14.1 | 1% |
| 5 | free | 3 | 2 | 31% | 2 | 4.0 | 3.8 | 0% |
| 7 | free | 0 | 0 | 10% | 13 | 20.3 | 0 | 1% |
| 7 | free | 0 | 0.5 | 32% | 4 | 14.1 | 6.4 | 0% |
| 7 | free | 0 | 1 | 33% | 3 | 12.7 | 9.6 | 1% |
| 7 | free | 0 | 2 | 34% | 2 | 5.6 | 3.9 | 0% |
| 7 | free | 3 | 0 | 10% | 10 | 19.4 | 0 | 1% |
| 7 | free | 3 | 0.5 | 10% | 10 | 20.3 | 10.2 | 1% |
| 7 | free | 3 | 1 | 12% | 10 | 19.5 | 16.7 | 1% |
| 7 | free | 3 | 2 | 23% | 4 | 10.3 | 9.7 | 0% |
| 9 | free | 0 | 0 | 9% | 12 | 20.5 | 0 | 1% |
| 9 | free | 0 | 0.5 | 24% | 7 | 17.5 | 4.7 | 1% |
| 9 | free | 0 | 1 | 22% | 7 | 17.6 | 9.1 | 0% |
| 9 | free | 0 | 2 | 22% | 3 | 11.6 | 8.0 | 0% |
| 9 | free | 3 | 0 | 9% | 11 | 20.7 | 0 | 0% |
| 9 | free | 3 | 0.5 | 8% | 11 | 20.0 | 5.8 | 1% |
| 9 | free | 3 | 1 | 9% | 13 | 21.5 | 11.8 | 1% |
| 9 | free | 3 | 2 | 17% | 6 | 15.2 | 12.3 | 1% |
| 14 | free | 0 | 0 | 9% | 11 | 20.6 | 0 | 2% |

- **Turning needs a bank.** With 0 Momentum at turn start and nothing playable in the arc you can't turn, and 22–64% of turns go dead. Carry at least 3 Momentum in, or give one free turn per round.
- **7-column arc, 1 Momentum per column, 3 banked plays like flat 1×14** (12% dead, median 10). But turning uses about 17 Momentum a turn, nearly everything the turn earns, so camera and abilities compete for the same pool. Charge turning in AP, or make it cheaper, if that isn't the tension you want.
- **5-column arc at 1 Momentum** is the "costly camera" setting: median 6, 14% dead. At 2 Momentum per column, every arc under 9 columns is punishing.
- **Free look matters.** Blind turning at the same cost gives a quarter to a third of the receipts.
- **Turning vs Withdraw:** Withdraw is free but ends the turn and redeals. Turning costs Momentum but keeps the turn and the board. Turning rescues a stalled streak, and Withdraw still handles a dead start with nothing banked.

## Dead-run fixes and enemy intent cards

Whole 20-turn fights: party turn, Withdraw, enemy turn, on 2 foundations.

The intent model is the original **shared intent card** (scenarios 020–024): the party can play onto it. Each enemy turn the enemy plays up to E matching tableau cards onto it (+1 pip each) and gains b passive pips. At P pips it fires, then returns as a new card. Each party card on it removes a pip and earns Momentum, but no AP and no chip damage. The later caster-built Deep Breath foundation in scenario 1000 (the party can't play onto it, only deny it) was not simulated.

Readout idea, matching the AP pips:

```
[ 9 ]  Deep Breath   ● ● ◐ ○   2 of 4 pips · enemy adds about 2 next turn · play an 8 or 10 here to remove one
```

- **Pity draw: one free flip, only when a turn opens dead.** Dead deals fall from 11% to 4% and streaks stay the same. A free flip whenever you're stuck also works (5% dead, median 9) but boosts streaks. Don't price it in Momentum: every flip pays itself back, so at 1–3 Momentum per flip 45–98% of turns run away, and 21% at 4.
- **Hold slot: a planning tool, not a dead-deal fix.** Alone, dead deals barely move (11% → 10%) and turns gain about 2 plays. It shines in combination, because smart players save a playable card at the end of a turn as insurance for the next. Only allow parking playable cards. A parked dead card clogs the slot for the rest of the fight.
- **Intent cards are the strongest fix, because the intent is a third golf target.** On 7 columns streaks double (median 5 → 12–16), like 3 foundations × 7. To keep today's pace, drop to 6 columns, or have the intent card keep its rank when played on, so it's a target but not a bridge.
- **Contesting matters without trivializing.** At 4 pips, +2 enemy plays and +1 passive, an ignored intent fires every 2–3 turns (4.3 per 10). Fighting it cuts that to every 4–5 turns (2.4 per 10) and costs about 4 of each turn's plays, which don't strike. Without the passive pip, a contested intent almost never fires, so keep b = 1.

**Starting tuning**

- Deep Breath: 4 pips. Each enemy turn the enemy plays up to 2 matching cards onto it plus 1 passive pip. Each party card on it removes a pip. It fires at 4, then returns as a new card.
- Table: 2 foundations × 6 columns with a golf intent, or 7 columns with a fixed-rank intent.
- Plus: one hold slot per actor (playable cards only) and one free pity flip when a turn opens dead.
- Result on 6 columns: 4% dead deals, median streak 11, about 1 runaway turn in 100. Deep Breath fires every 5 turns when fought and every 2–3 when ignored. Usable AP rises from 4.9 to 7.1.

Fires per 10 turns, 7 columns, intent contested (E = enemy plays per turn, b = passive pips):

| pips (P) | E1 b0 | E1 b1 | E2 b0 | E2 b1 | E3 b0 | E3 b1 |
|---|---|---|---|---|---|---|
| 3 | 0.1 | 1.7 | 0.9 | 5.8 | 4.0 | 5.7 |
| 4 | 0.0 | 0.6 | 0.4 | 2.0 | 1.2 | 4.5 |
| 5 | 0 | 0.3 | 0.2 | 1.2 | 0.8 | 1.9 |
| 6 | 0 | 0.2 | 0.1 | 0.8 | 0.5 | 1.4 |

| setup | dead | median | receipts/turn | fires/10 turns |
|---|---|---|---|---|
| C5 P4 E2 b0 | 17% | 4 | 8.2 | 0.7 |
| C5 P4 E2 b1 | 18% | 4 | 8.5 | 2.6 |
| C5 P5 E2 b0 | 19% | 4 | 7.5 | 0.3 |
| P4 E2 b1 no undermine | 13% | 5 | 9.0 | 4.4 |
| C5 P5 E2 b1 | 18% | 4 | 8.1 | 1.9 |
| C6 P4 E2 b0 | 13% | 7 | 12.8 | 0.6 |
| C6 P4 E2 b1 | 11% | 7 | 13.7 | 2.5 |
| C6 P5 E2 b0 | 14% | 7 | 13.4 | 0.2 |
| C6 P5 E2 b1 | 13% | 7 | 13.8 | 1.6 |
| P4 E1 b1 no undermine | 13% | 5 | 9.0 | 3.8 |
| P4 E1 b0 no undermine | 13% | 5 | 8.5 | 1.5 |
| P4 E2 b0 no undermine | 12% | 5 | 8.6 | 2.8 |

<details><summary>All mitigation runs</summary>

| setup | dead | median | receipts/turn | on intent | fires/10 turns | runaway | usable AP |
|---|---|---|---|---|---|---|---|
| Pity: 1 free flip per turn | 5% | 9 | 13.0 | 0 | 0 | 0% | 7.6 |
| Pity: 2 free flips per turn | 2% | 14 | 18.0 | 0 | 0 | 0% | 9.0 |
| Pity: 1 free flip, only on a dead start | 4% | 6 | 10.2 | 0 | 0 | 0% | 6.5 |
| No mitigation | 11% | 5 | 9.2 | 0 | 0 | 0% | 6.0 |
| Intent + hold + pity, 6 columns | 5% | 10 | 16.3 | 4.3 | 1.3 | 0% | 6.9 |
| Pity: 1 Momentum per flip | 1% | 100 | 98.3 | 0 | 0 | 98% | 11.8 |
| Pity: 2 Momentum per flip | 2% | 100 | 95.0 | 0 | 0 | 94% | 11.8 |
| Pity: 3 Momentum per flip | 9% | 68 | 56.9 | 0 | 0 | 44% | 9.3 |
| Pity: 4 Momentum per flip | 15% | 18 | 36.7 | 0 | 0 | 21% | 7.8 |
| Hold slot (one per actor) | 10% | 7 | 11.3 | 0 | 0 | 0% | 6.7 |
| Intent + pity on dead start | 3% | 13 | 22.0 | 6.3 | 1.1 | 2% | 7.5 |
| Intent + hold | 6% | 16 | 23.5 | 6.2 | 1.0 | 2% | 8.0 |
| Intent + hold + pity on dead start | 2% | 16 | 23.7 | 6.3 | 1.0 | 1% | 8.0 |
| 6 columns, no mitigation | 15% | 4 | 6.4 | 0 | 0 | 0% | 4.9 |
| 6 columns + intent (ignored) | 15% | 4 | 5.9 | 0 | 4.2 | 0% | 4.6 |
| 6 columns + intent | 12% | 7 | 13.4 | 3.9 | 2.4 | 0% | 5.8 |
| 7 columns + fixed-rank intent | 13% | 6 | 11.3 | 1.5 | 2.9 | 0% | 6.0 |
| 6 columns + intent + hold | 8% | 10 | 16.2 | 4.4 | 2.1 | 0% | 6.7 |
| 6 columns + intent + hold + pity on dead start | 4% | 11 | 16.9 | 4.6 | 2.0 | 0% | 7.1 |
| 7 columns + fixed-rank intent (ignored) | 16% | 5 | 8.5 | 0 | 4.1 | 0% | 5.5 |
| 7 columns + fixed-rank intent + hold + pity on dead start | 4% | 11 | 15.0 | 1.9 | 2.7 | 0% | 7.5 |
| 7 columns + intent + hold + pity on dead start | 3% | 17 | 24.2 | 6.3 | 1.9 | 1% | 8.1 |

</details>
