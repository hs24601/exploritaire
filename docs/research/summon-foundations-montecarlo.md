# Temporary summoned foundations Monte Carlo

Research for Eric, 2026-10-26, from the "Balance tableau shape with Monte Carlo" thread. It tests summoned foundations that only last a while, on today's table, on a one-foundation table and on split-card tableaus. It follows [tableau-shape-montecarlo.md](./tableau-shape-montecarlo.md) and [split-card-montecarlo.md](./split-card-montecarlo.md).

Simulator source and raw results are in the project files under `tableau-montecarlo/` (`sim5.js`, `sweep5.js`, `sweep5b.js`, `results5.json`).

## Recommendations

1. **Expire summons by cards received, not by turns.** A summon that holds 5 cards caps how much it can add. A summon that lasts whole turns takes 10–17 cards on today's table and doubles the median streak (6 → 12–14).
2. **The dead-run fix is a summon you can only call when a turn opens dead.** On 2×7, dead turns fall from 10% to 4% while the median streak stays at 7 and nothing runs away. That matches the free pity flip from the earlier study, but it feels like agency instead of luck.
3. **Let the player pick the summon's starting rank from an exposed card.** With a picked start, a dead-start summon brings dead turns to about 1% on every table tested, at almost no cost to pace.
4. **A summon you can call any time you're stuck is a streak extender, not a dead-run fix.** On 2×7, holding 5 cards, it lifts the median streak from 6 to 11 with no runaways. Treat that as a paid ability (AP or Momentum) with a 1-turn cooldown (median 9).
5. **+1-only summons and closing a column are weak levers.** Each roughly halves what a summon adds, but the dead-start rule and the card cap already do the job more clearly.
6. **Split cards need a smaller table before any summon.** 1 foundation × 6 split columns already runs away in 18% of turns with no summon, and every summon makes it worse (20–78%). **1 foundation × 5 split columns** is in band (18% dead, median 6, 0% runaway). With a dead-start summon it gets 4% dead, median 9 and 1% runaway. A table where half the cards are split also works at 7 columns.
7. **Never put two permanent foundations on split cards.** 2 foundations × 4 split columns runs away in 42% of turns, so with split cards the second receiver should only ever be a temporary summon.

**Starting tuning**

- Summon: holds 5 cards, then expires. One active at a time. Callable only when a turn opens with nothing to play. The player places it on an exposed card, which sets its rank.
- Its cards count as hits (chip damage and Momentum) but give no actor AP.
- Optional paid version for streak play: callable any time you're stuck, 1-turn cooldown after it expires.
- Split tableau: 1 foundation × 5 split columns, or 7 columns with half the cards split.

Results with the starting tuning:

| Table | Dead | Median | Runaway | Summons per 10 turns |
|---|---|---|---|---|
| 2 × 7 | 1% | 7 | 0% | 1.0 |
| 1 × 13 | 0% | 13 | 0% | 1.1 |
| 1 × 5 split | 0% | 12 | 1% | 1.9 |
| 1 × 7, half split | 0% | 8 | 0% | 1.7 |

## Model

- The same golf model as the earlier study: ±1 with A/K wrap, every card face-up, infinifill, and Withdraw redeals and ends the turn. Each fight is 20 party turns, 150 fights (3,000 turns) per setting. Expect about ±1.5 points of noise.
- **Expert** player: searches every visible line (up to 1,500 nodes) before each play, including which side of a split card to use.
- **Split cards** follow `splitCards.ts`: the second rank is 2 to 11 steps from the first, so it never matches or neighbours it. Split tables use depth 3, like the split-card study. Plain tables use depth 4.
- **Summon:** an extra foundation that accepts ±1 (or +1 only) and changes rank with each card, like a Kin. Only one is active at a time. By default it is called when the party is stuck and none is active, once per turn, and it starts on a random rank. It survives Withdraw. A turn lifetime counts the turn it's called on. A card lifetime expires the moment it holds that many cards.
- **Dead** means a turn with zero plays even after any summon. **Runaway** means 100 plays in one turn. **6+** is turns with at least 6 plays (a stagger break). **Usable AP** is the actors' AP per turn, capped at 6 each. Summon cards give no AP.

## Today's table: 2 foundations × 7 columns

| Summon | Dead | Median | p90 | 6+ | Runaway | Summons per 10 turns | Cards per summon | Usable AP |
|---|---|---|---|---|---|---|---|---|
| No summon | 10% | 6 | 24 | 50% | 0% | 0.0 | – | 6.0 |
| Lasts 1 turn | 4% | 12 | 46 | 71% | 1% | 10.0 | 4.0 | 7.6 |
| Lasts 2 turns | 4% | 13 | 51 | 71% | 2% | 5.0 | 10.6 | 7.6 |
| Lasts 3 turns | 5% | 14 | 53 | 72% | 1% | 3.5 | 17.3 | 7.7 |
| Holds 3 cards | 6% | 9 | 32 | 67% | 0% | 4.4 | 3.0 | 7.1 |
| Holds 5 cards | 5% | 11 | 34 | 67% | 0% | 3.9 | 5.0 | 7.3 |
| Holds 8 cards | 6% | 10 | 37 | 67% | 0% | 3.3 | 8.0 | 7.1 |
| Holds 5, 1-turn cooldown | 6% | 9 | 33 | 63% | 0% | 3.0 | 5.0 | 6.9 |
| Holds 5, 2-turn cooldown | 8% | 8 | 29 | 62% | 0% | 2.4 | 5.0 | 6.8 |
| 2 turns, 2-turn cooldown | 8% | 9 | 39 | 60% | 1% | 2.5 | 11.3 | 6.9 |
| Holds 5, picked start | 2% | 18 | 42 | 84% | 0% | 6.1 | 5.0 | 8.8 |
| Holds 5, +1 only | 8% | 7 | 27 | 57% | 0% | 2.0 | 5.0 | 6.4 |
| 2 turns, +1 only | 7% | 8 | 29 | 60% | 0% | 5.0 | 2.2 | 6.6 |
| Holds 5, closes a column | 8% | 8 | 28 | 61% | 0% | 3.3 | 5.0 | 6.4 |
| 2 turns, closes a column | 6% | 9 | 36 | 65% | 0% | 5.0 | 7.2 | 6.7 |
| Dead start only, 1 turn | 4% | 6 | 26 | 55% | 0% | 1.1 | 4.3 | 6.5 |
| Dead start only, 2 turns | 5% | 7 | 27 | 56% | 0% | 1.0 | 9.1 | 6.4 |
| Dead start only, holds 5 | 4% | 7 | 27 | 57% | 0% | 0.9 | 5.0 | 6.5 |
| Dead start only, holds 8 | 5% | 7 | 28 | 57% | 0% | 0.9 | 8.0 | 6.5 |
| Dead start only, holds 5, picked start | 1% | 7 | 26 | 60% | 0% | 1.0 | 5.0 | 6.8 |
| Dead start only, holds 5, 1-turn cooldown | 4% | 7 | 26 | 57% | 0% | 0.8 | 5.0 | 6.6 |
| Holds 5, +1 only, 1-turn cooldown | 9% | 7 | 28 | 58% | 0% | 1.8 | 5.0 | 6.5 |
| Dead start only, holds 5, +1 only | 7% | 6 | 24 | 53% | 0% | 0.8 | 5.0 | 6.2 |

- **Every summon fixes dead turns, but most also lengthen streaks.** Turn-based summons get the most cards and the biggest streaks. Card caps keep runaways at 0%.
- **Dead-start summons are the clean fix.** Holding 5 cards: 4% dead, median 7. With a picked start: 1% dead.
- A summon that lasts 1 turn and is called whenever you're stuck is effectively always up (10 summons per 10 turns), so it's a third foundation in disguise.

## One foundation: 1 × 13

The single-foundation table from the column-for-foundation trade.

| Summon | Dead | Median | p90 | 6+ | Runaway | Summons per 10 turns | Cards per summon | Usable AP |
|---|---|---|---|---|---|---|---|---|
| No summon | 11% | 8 | 40 | 59% | 0% | 0.0 | – | 4.4 |
| Lasts 1 turn | 2% | 34 | 100 | 87% | 13% | 10.0 | 14.9 | 5.3 |
| Lasts 2 turns | 3% | 39 | 100 | 87% | 14% | 5.0 | 38.0 | 5.3 |
| Lasts 3 turns | 2% | 42 | 100 | 87% | 16% | 3.5 | 62.7 | 5.3 |
| Holds 3 cards | 3% | 17 | 51 | 81% | 1% | 6.7 | 3.0 | 5.1 |
| Holds 5 cards | 3% | 20 | 56 | 83% | 1% | 6.2 | 5.0 | 5.1 |
| Holds 8 cards | 3% | 25 | 59 | 84% | 1% | 5.8 | 8.0 | 5.2 |
| Holds 5, 1-turn cooldown | 6% | 16 | 50 | 75% | 1% | 4.0 | 5.0 | 4.9 |
| Holds 5, 2-turn cooldown | 7% | 13 | 49 | 71% | 1% | 3.0 | 5.0 | 4.8 |
| 2 turns, 2-turn cooldown | 7% | 19 | 84 | 74% | 6% | 2.5 | 37.8 | 4.9 |
| Holds 5, picked start | 0% | 38 | 73 | 97% | 3% | 9.0 | 5.0 | 5.8 |
| Holds 5, +1 only | 6% | 13 | 45 | 72% | 1% | 3.6 | 5.0 | 4.7 |
| 2 turns, +1 only | 5% | 15 | 52 | 73% | 1% | 5.0 | 6.9 | 4.8 |
| Holds 5, closes a column | 3% | 19 | 55 | 81% | 1% | 5.9 | 5.0 | 5.1 |
| 2 turns, closes a column | 4% | 31 | 97 | 84% | 10% | 5.0 | 31.9 | 5.1 |
| Dead start only, 1 turn | 2% | 10 | 47 | 66% | 1% | 1.1 | 18.4 | 4.8 |
| Dead start only, 2 turns | 2% | 12 | 58 | 68% | 3% | 1.1 | 40.7 | 4.8 |
| Dead start only, holds 5 | 3% | 10 | 39 | 66% | 0% | 1.2 | 5.0 | 4.7 |
| Dead start only, holds 8 | 2% | 11 | 42 | 68% | 0% | 1.0 | 8.0 | 4.8 |
| Dead start only, holds 5, picked start | 0% | 13 | 44 | 72% | 0% | 1.1 | 5.0 | 5.1 |
| Dead start only, holds 5, 1-turn cooldown | 3% | 10 | 41 | 66% | 0% | 1.0 | 5.0 | 4.7 |
| Holds 5, +1 only, 1-turn cooldown | 7% | 12 | 45 | 70% | 0% | 2.7 | 5.0 | 4.7 |
| Dead start only, holds 5, +1 only | 4% | 10 | 41 | 65% | 0% | 0.9 | 5.0 | 4.7 |

- The same pattern, with bigger numbers because one foundation on 13 columns is already near the top of the band. Turn-based summons that are always available run away in 13–16% of turns.
- Card-capped dead-start summons stay at 0% runaway with a median of 10–13.

## Split cards: 1 foundation × 6 split columns

The split-card study's table.

| Summon | Dead | Median | p90 | 6+ | Runaway | Summons per 10 turns | Cards per summon | Usable AP |
|---|---|---|---|---|---|---|---|---|
| No summon | 13% | 20 | 100 | 68% | 18% | 0.0 | – | 4.6 |
| Lasts 1 turn | 2% | 100 | 100 | 91% | 67% | 8.2 | 24.8 | 5.6 |
| Lasts 2 turns | 3% | 100 | 100 | 92% | 75% | 4.6 | 66.4 | 5.6 |
| Lasts 3 turns | 2% | 100 | 100 | 93% | 78% | 3.3 | 111.0 | 5.7 |
| Holds 3 cards | 3% | 57 | 100 | 87% | 32% | 6.2 | 3.0 | 5.4 |
| Holds 5 cards | 3% | 67 | 100 | 90% | 35% | 6.3 | 5.0 | 5.5 |
| Holds 8 cards | 3% | 74 | 100 | 90% | 38% | 6.1 | 8.0 | 5.6 |
| Holds 5, 1-turn cooldown | 7% | 51 | 100 | 82% | 30% | 3.9 | 5.0 | 5.2 |
| Holds 5, 2-turn cooldown | 8% | 38 | 100 | 77% | 25% | 2.9 | 5.0 | 5.0 |
| 2 turns, 2-turn cooldown | 6% | 97 | 100 | 82% | 50% | 2.5 | 67.4 | 5.2 |
| Holds 5, picked start | 0% | 100 | 100 | 99% | 53% | 8.0 | 5.0 | 5.9 |
| Holds 5, +1 only | 6% | 43 | 100 | 79% | 25% | 4.4 | 5.0 | 5.0 |
| 2 turns, +1 only | 6% | 57 | 100 | 80% | 36% | 4.6 | 19.1 | 5.1 |
| Holds 5, closes a column | 5% | 51 | 100 | 84% | 29% | 5.6 | 5.0 | 5.2 |
| 2 turns, closes a column | 4% | 100 | 100 | 88% | 61% | 4.6 | 57.4 | 5.4 |
| Dead start only, 1 turn | 2% | 35 | 100 | 77% | 26% | 1.2 | 33.6 | 5.2 |
| Dead start only, 2 turns | 3% | 41 | 100 | 78% | 31% | 1.1 | 73.9 | 5.2 |
| Dead start only, holds 5 | 3% | 30 | 100 | 76% | 20% | 1.3 | 5.0 | 5.1 |
| Dead start only, holds 8 | 2% | 31 | 100 | 77% | 22% | 1.1 | 8.0 | 5.1 |
| Dead start only, holds 5, picked start | 0% | 35 | 100 | 80% | 21% | 1.2 | 5.0 | 5.3 |
| Dead start only, holds 5, 1-turn cooldown | 3% | 29 | 100 | 76% | 20% | 1.1 | 5.0 | 5.1 |
| Holds 5, +1 only, 1-turn cooldown | 7% | 37 | 100 | 77% | 23% | 3.2 | 5.0 | 5.0 |
| Dead start only, holds 5, +1 only | 5% | 26 | 100 | 74% | 19% | 1.2 | 5.0 | 4.9 |

Every summon pushes this table further into runaway. The summon is not the problem: 6 split columns already behave like a table with far more playable cards than 12 plain columns once a streak starts.

## Smaller split tables

| Table | Summon | Dead | Median | p90 | 6+ | Runaway | Usable AP |
|---|---|---|---|---|---|---|---|
| 1 × 4 split | No summon | 24% | 3 | 14 | 34% | 0% | 3.2 |
| 1 × 4 split | Dead start only, holds 5 | 8% | 5 | 20 | 47% | 0% | 3.8 |
| 1 × 4 split | Dead start only, holds 5, picked start | 0% | 7 | 23 | 55% | 0% | 4.4 |
| 1 × 4 split | Holds 5, 1-turn cooldown | 17% | 6 | 25 | 54% | 0% | 3.8 |
| 1 × 5 split | No summon | 18% | 6 | 35 | 51% | 0% | 3.9 |
| 1 × 5 split | Dead start only, holds 5 | 4% | 9 | 42 | 63% | 1% | 4.6 |
| 1 × 5 split | Dead start only, holds 5, picked start | 0% | 12 | 48 | 70% | 1% | 5.0 |
| 1 × 5 split | Holds 5, 1-turn cooldown | 10% | 16 | 57 | 69% | 2% | 4.6 |
| 1 × 6 split | No summon | 13% | 20 | 100 | 68% | 18% | 4.6 |
| 1 × 6 split | Dead start only, holds 5 | 3% | 30 | 100 | 76% | 20% | 5.1 |
| 1 × 6 split | Dead start only, holds 5, picked start | 0% | 35 | 100 | 80% | 21% | 5.3 |
| 1 × 6 split | Holds 5, 1-turn cooldown | 7% | 51 | 100 | 82% | 30% | 5.2 |
| 1 × 6, half split | No summon | 23% | 3 | 13 | 33% | 0% | 3.2 |
| 1 × 6, half split | Dead start only, holds 5 | 7% | 5 | 18 | 46% | 0% | 3.8 |
| 1 × 6, half split | Dead start only, holds 5, picked start | 0% | 6 | 20 | 53% | 0% | 4.3 |
| 1 × 6, half split | Holds 5, 1-turn cooldown | 12% | 6 | 23 | 55% | 0% | 3.9 |
| 1 × 7, half split | No summon | 17% | 5 | 25 | 47% | 0% | 3.8 |
| 1 × 7, half split | Dead start only, holds 5 | 4% | 7 | 29 | 58% | 0% | 4.4 |
| 1 × 7, half split | Dead start only, holds 5, picked start | 0% | 8 | 31 | 63% | 0% | 4.8 |
| 1 × 7, half split | Holds 5, 1-turn cooldown | 10% | 10 | 35 | 65% | 0% | 4.4 |
| 2 × 4 split | No summon | 7% | 73 | 100 | 81% | 42% | 9.8 |
| 2 × 4 split | Dead start only, holds 5 | 3% | 75 | 100 | 84% | 42% | 10.0 |
| 2 × 4 split | Dead start only, holds 5, picked start | 0% | 79 | 100 | 88% | 42% | 10.5 |
| 2 × 4 split | Holds 5, 1-turn cooldown | 4% | 99 | 100 | 88% | 50% | 10.5 |

- **There is a cliff between 5 and 6 split columns.** 1 × 5 split: median 6, 0% runaway. 1 × 6 split: median 20, 18% runaway.
- **1 × 5 split with a dead-start summon** is the best split setup: 4% dead (0% with a picked start), median 9–12, about 1% runaway.
- **Half-split 7 columns** is a gentler option: 17% dead and median 5 alone, 4% dead and median 7 with a dead-start summon, never runaway.
- **2 × 4 split** runs away in 42% of turns before any summon.

## Ideas not simulated

- **Payout on expiry** (damage or AP scaled by cards held) doesn't change what can be played, so it's a reward lever only. With a 5-card cap it pays out at most 5.
- **Diminishing receipts** on summon cards is also a reward lever. It doesn't shorten streaks, because summon cards still bridge to the Kin foundations.
