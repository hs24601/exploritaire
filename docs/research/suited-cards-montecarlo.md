# Suited cards Monte Carlo

Research for Eric, 2026-10-26, from the "Balance tableau shape with Monte Carlo" thread. It replaces the split card's second rank with a suit (earth, air, fire, water, plus dark/light and/or order/chaos) and tests rules where a matching suit lets a card play off-sequence, Skip-Bo style. It follows [split-card-montecarlo.md](./split-card-montecarlo.md) and [summon-foundations-montecarlo.md](./summon-foundations-montecarlo.md).

Simulator source and raw results are in the project files under `tableau-montecarlo/` (`sim6.js`, `sweep6.js`, `sweep7.js`, `results6.json`).

## Recommendations

1. **A matching suit that plays at any rank, with no limit, runs away almost everywhere.** With 4 suits, a quarter of all cards match each foundation. Today's 2×7 runs away in 98% of turns, and even 8 suits run away in 86%. Unlimited, it only fits a tiny table (2×4 with 8 suits: 10% dead, median 12, 4% runaway).
2. **Cap suit plays per turn and it becomes the best tableau saver tested so far.** A per-turn cap brings runaways to 0% on every table, because each suit play is one bridge, not a new rule. It also nearly removes dead turns, since a suit match is usually available.
3. **Recommended: 6 elements, each actor takes any card of its own element off-sequence, 1 such play per turn, on 2 foundations × 5 columns.** That's 3% dead turns, median streak 8, 0% runaway and 7.0 usable AP, against today's 2×7 at 12% dead, median 5 and 5.9 AP. It saves two columns and plays better.
4. **One-foundation version: 1 × 9 with 1 suit play per turn** (2–7% dead, median 8–12, 0% runaway). It plays like plain 1×13 with fewer dead turns, saving four columns.
5. **Each suit play per turn is worth a lot.** On 2×7, even 1 per turn takes the median from 5 to 16–18. So the cap goes with a smaller table, not on top of today's.
6. **Affinity (each actor has a fixed element) is the thematic version and self-limits with more suits.** With 4 suits it matches "any suit". With 6–8 suits it gets weaker, because each actor only answers to one element in 6 or 8.
7. **More suits = a weaker suit rule.** 6 suits sits a little below 4. 8 suits is clearly weaker. Dark/light *and* order/chaos together (8) mostly just dilutes matches.
8. **Weaker suit rules:** "same suit at ±2" is a moderate stretch (2×7 with 6 suits: 8% dead, median 12, 2% runaway). "Same suit at the same rank" barely does anything (+1 median).
9. **Opposed suits as a block (fire can't go on water) is a strong constraint.** It cuts streaks by about a third and raises dead turns. Use it as an enemy curse or terrain effect, not a base rule.
10. **The dead-start summon still works with every suit rule** (holds 5, called only on a dead start, player picks its starting card), taking dead turns to 0–6% on 2×5 and bigger tables.

**Starting tuning**

- Suits: earth, air, fire, water, dark, light (6). Order/chaos are better saved for a later expansion or as special suits.
- Each actor has an element. A card of the actor's element can play on that actor's foundation at any rank, once per turn (team-wide). The foundation's rank becomes that card's rank.
- Table: 2 foundations × 5 columns.
- Result: 3% dead, median 8, 0% runaway, 7.0 usable AP.

## Model

- The same golf model as the earlier studies: ±1 with A/K wrap, every card face-up, depth 4, infinifill, and Withdraw redeals and ends the turn. Each setting is 100 fights of 20 party turns (2,000 turns). Expect about ±2 points of noise.
- Each card has a rank and one of 4, 6 or 8 suits, uniformly. Suits come in opposed pairs: earth–air, fire–water, dark–light, order–chaos.
- A foundation takes the rank and suit of the last card played on it, except under **affinity**, where its suit is always the actor's element. In affinity runs the two actors have different, non-opposed elements.
- **Expert** player: searches every visible line (up to 1,500 nodes) before each play, including when to spend the suit play.
- **Dead** means a turn with zero plays. **Runaway** means 100 plays in one turn. **Usable AP** is the actors' AP per turn, capped at 6 each.

## Suit rules without limits

Each cell: dead turns · median streak · runaway turns.

| Rule | Suits | 2 × 7 | 2 × 5 | 2 × 4 | 1 × 13 | 1 × 9 | 1 × 6 |
|---|---|---|---|---|---|---|---|
| Rank ±1 only (today) | – | 12% · 5 · 0% | 20% · 3 · 0% | 28% · 2 · 0% | 11% · 8 · 0% | 22% · 3 · 0% | 37% · 1 · 0% |
| Same suit plays at any rank | 4 | 0% · 100 · 98% | 1% · 100 · 91% | 2% · 100 · 71% | 0% · 100 · 100% | 2% · 100 · 94% | 6% · 100 · 67% |
| Same suit plays at any rank | 6 | 1% · 100 · 95% | 3% · 100 · 67% | 6% · 37 · 25% | 1% · 100 · 98% | 5% · 100 · 87% | 12% · 37 · 33% |
| Same suit plays at any rank | 8 | 2% · 100 · 86% | 5% · 59 · 36% | 10% · 12 · 4% | 2% · 100 · 96% | 7% · 100 · 79% | 16% · 9 · 8% |
| Same suit plays at ±2 | 4 | 5% · 22 · 8% | 14% · 4 · 0% | 20% · 3 · 0% | 7% · 81 · 43% | 15% · 6 · 1% | 28% · 2 · 0% |
| Same suit plays at ±2 | 6 | 8% · 12 · 2% | 15% · 4 · 0% | 23% · 2 · 0% | 7% · 43 · 24% | 17% · 5 · 0% | 30% · 2 · 0% |
| Same suit plays at ±2 | 8 | 10% · 9 · 1% | 15% · 4 · 0% | 23% · 2 · 0% | 7% · 29 · 13% | 18% · 4 · 0% | 30% · 2 · 0% |
| Same suit plays at the same rank | 4 | 8% · 7 · 0% | 17% · 3 · 0% | 22% · 2 · 0% | 8% · 10 · 0% | 18% · 3 · 0% | 31% · 1 · 0% |
| Same suit plays at the same rank | 6 | 9% · 6 · 0% | 18% · 3 · 0% | 24% · 2 · 0% | 10% · 9 · 0% | 20% · 3 · 0% | 33% · 1 · 0% |
| Same suit plays at the same rank | 8 | 10% · 6 · 0% | 18% · 3 · 0% | 24% · 2 · 0% | 9% · 10 · 0% | 20% · 3 · 0% | 34% · 1 · 0% |
| Opposed suits block ±1 | 4 | 18% · 3 · 0% | 31% · 1 · 0% | 38% · 1 · 0% | 22% · 4 · 0% | 33% · 2 · 0% | 47% · 1 · 0% |
| Opposed suits block ±1 | 6 | 15% · 4 · 0% | 28% · 2 · 0% | 36% · 1 · 0% | 17% · 5 · 0% | 28% · 2 · 0% | 43% · 1 · 0% |
| Opposed suits block ±1 | 8 | 14% · 4 · 0% | 26% · 2 · 0% | 31% · 1 · 0% | 15% · 6 · 0% | 26% · 2 · 0% | 40% · 1 · 0% |

## Suit plays capped per turn: any matching suit

The foundation's current suit (from the last card) matches. Each cell: dead turns · median streak · usable AP. Runaways are 0% in every cell.

| Suits | Suit plays per turn | 2 × 7 | 2 × 5 | 2 × 4 | 1 × 9 | 1 × 6 | 1 × 4 |
|---|---|---|---|---|---|---|---|
| 4 | 1 | 0% · 18 · AP 10.5 | 1% · 10 · AP 8.1 | 3% · 6 · AP 6.0 | 2% · 12 · AP 5.5 | 7% · 5 · AP 4.2 | 15% · 2 · AP 2.6 |
| 4 | 2 | 0% · 21 · AP 11.3 | 2% · 15 · AP 9.9 | 4% · 10 · AP 8.2 | 1% · 20 · AP 5.8 | 7% · 9 · AP 4.9 | 16% · 4 · AP 3.4 |
| 4 | 3 | 1% · 23 · AP 11.6 | 2% · 18 · AP 10.6 | 4% · 14 · AP 9.3 | 2% · 23 · AP 5.8 | 7% · 13 · AP 5.1 | 15% · 5 · AP 3.7 |
| 6 | 1 | 1% · 18 · AP 10.2 | 3% · 9 · AP 7.5 | 5% · 5 · AP 5.5 | 5% · 11 · AP 5.2 | 13% · 4 · AP 3.7 | 25% · 2 · AP 2.2 |
| 6 | 2 | 1% · 22 · AP 11.1 | 4% · 14 · AP 9.2 | 6% · 8 · AP 7.2 | 4% · 19 · AP 5.6 | 12% · 7 · AP 4.4 | 26% · 2 · AP 2.7 |
| 6 | 3 | 1% · 24 · AP 11.4 | 3% · 17 · AP 10.0 | 6% · 11 · AP 8.1 | 4% · 24 · AP 5.6 | 13% · 10 · AP 4.5 | 25% · 2 · AP 2.8 |
| 8 | 1 | 2% · 17 · AP 9.8 | 6% · 8 · AP 6.9 | 9% · 5 · AP 5.0 | 6% · 11 · AP 5.1 | 16% · 4 · AP 3.5 | 30% · 1 · AP 2.0 |
| 8 | 2 | 2% · 22 · AP 10.8 | 4% · 12 · AP 8.4 | 9% · 7 · AP 6.3 | 6% · 18 · AP 5.3 | 17% · 6 · AP 3.9 | 30% · 2 · AP 2.4 |
| 8 | 3 | 2% · 25 · AP 11.1 | 5% · 16 · AP 9.0 | 10% · 9 · AP 6.9 | 7% · 23 · AP 5.3 | 16% · 7 · AP 4.1 | 31% · 2 · AP 2.3 |

## Suit plays capped per turn: actor element (affinity)

Each actor's foundation always has that actor's element. Each cell: dead turns · median streak · usable AP. Runaways are 0% in every cell.

| Suits | Suit plays per turn | 2 × 7 | 2 × 5 | 2 × 4 | 1 × 9 | 1 × 6 | 1 × 4 |
|---|---|---|---|---|---|---|---|
| 4 | 1 | 0% · 18 · AP 10.4 | 1% · 9 · AP 7.8 | 2% · 6 · AP 6.0 | 1% · 11 · AP 5.3 | 7% · 4 · AP 4.0 | 15% · 2 · AP 2.6 |
| 4 | 2 | 0% · 21 · AP 11.3 | 0% · 14 · AP 9.8 | 2% · 10 · AP 8.0 | 1% · 18 · AP 5.6 | 7% · 7 · AP 4.6 | 16% · 3 · AP 3.1 |
| 4 | 3 | 0% · 23 · AP 11.6 | 1% · 17 · AP 10.5 | 2% · 13 · AP 9.1 | 2% · 21 · AP 5.6 | 6% · 9 · AP 4.7 | 15% · 3 · AP 3.3 |
| 6 | 1 | 0% · 16 · AP 9.9 | 3% · 8 · AP 7.0 | 6% · 5 · AP 5.3 | 4% · 9 · AP 5.0 | 14% · 3 · AP 3.4 | 25% · 2 · AP 2.0 |
| 6 | 2 | 1% · 21 · AP 10.8 | 3% · 12 · AP 8.5 | 6% · 7 · AP 6.6 | 5% · 15 · AP 5.2 | 13% · 4 · AP 3.8 | 25% · 2 · AP 2.4 |
| 6 | 3 | 0% · 24 · AP 11.0 | 3% · 14 · AP 9.1 | 5% · 9 · AP 7.4 | 4% · 18 · AP 5.2 | 13% · 5 · AP 3.8 | 26% · 2 · AP 2.4 |
| 8 | 1 | 1% · 16 · AP 9.4 | 5% · 7 · AP 6.5 | 8% · 4 · AP 4.8 | 7% · 8 · AP 4.7 | 15% · 3 · AP 3.2 | 32% · 1 · AP 1.8 |
| 8 | 2 | 2% · 20 · AP 10.2 | 5% · 9 · AP 7.6 | 8% · 5 · AP 5.7 | 7% · 11 · AP 4.8 | 18% · 3 · AP 3.4 | 31% · 2 · AP 2.1 |
| 8 | 3 | 2% · 23 · AP 10.5 | 5% · 11 · AP 8.0 | 8% · 6 · AP 6.1 | 7% · 13 · AP 4.8 | 18% · 3 · AP 3.4 | 30% · 1 · AP 2.1 |

## With the dead-start summon

Holds 5 cards, callable only when a turn opens dead, and the player picks its starting card. Each cell: dead turns · median streak · runaway turns.

| Rule | Suits | 2 × 7 | 2 × 5 | 2 × 4 | 1 × 13 | 1 × 9 | 1 × 6 |
|---|---|---|---|---|---|---|---|
| Rank ±1 only (today) | – | 1% · 7 · 0% | 4% · 4 · 0% | 7% · 3 · 0% | 0% · 12 · 0% | 1% · 5 · 0% | 6% · 3 · 0% |
| Same suit plays at ±2 | 6 | 0% · 16 · 3% | 1% · 5 · 0% | 3% · 4 · 0% | 0% · 52 · 26% | 0% · 8 · 0% | 2% · 4 · 0% |
| Same suit plays at the same rank | 6 | 0% · 8 · 0% | 1% · 5 · 0% | 6% · 3 · 0% | 0% · 13 · 1% | 0% · 5 · 0% | 3% · 3 · 0% |
| Opposed suits block ±1 | 6 | 1% · 5 · 0% | 6% · 3 · 0% | 12% · 2 · 0% | 0% · 8 · 0% | 1% · 4 · 0% | 11% · 2 · 0% |

## Compared with split cards

- Split cards (two ranks) widen *every* play, so they make long streaks across the whole turn. 1 × 6 split runs away in 18% of turns, and the safe split table is 1 × 5.
- Capped suit plays widen only a few plays per turn, so they rescue stuck moments without compounding. They also read more clearly on a card: one number and one element.
- Both can save real estate. Capped suits get there with no runaway risk.

## Ideas not simulated

- **Element charges per actor** instead of a team-wide cap (each actor gets its own one suit play per turn). It sits between the 1 and 2 per-turn rows above for two actors.
- **Suit plays paid with AP or Momentum.** From the earlier ability study, a price alone doesn't stop runaways but a per-turn cap does, so keep the cap even if suit plays cost something.
- **Suit bonuses** (an extra hit or status when the suit matches the foundation) change rewards, not what can be played.
