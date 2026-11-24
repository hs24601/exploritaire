# Party tap-in Monte Carlo

Research for Eric, 2026-10-27, from the "Balance tableau shape with Monte Carlo" thread. One foundation takes tableau cards. The rest of the party (2–4 keru in all) waits in reserve, each remembering its last foundation value, and a reserve keru can tap in and swap onto the foundation. Tap-ins earn no AP, Momentum or pips. It follows [tableau-shape-montecarlo.md](./tableau-shape-montecarlo.md) and [summon-foundations-montecarlo.md](./summon-foundations-montecarlo.md).

Simulator source and raw results are in the project files under `tableau-montecarlo/` (`sim7.js`, `sweep8.js`, `sweep9.js`, `results7.json`).

## Recommendations

1. **Your rule as written is safe but weak.** A keru can tap in only when its stored value is ±1 of the foundation top. That happens rarely: each reserve keru matches only 2 of 13 ranks, and memories drift randomly. With 4 keru the party taps in only 0.5–1.4 times per turn on 7–12 columns. On those tables dead turns drop by only 2–4 points and the median streak rises by 0–3. It never runs away.
2. **Its main effect is AP, not tempo.** Because tap-ins move receipts between keru, a 3–4 keru party earns noticeably more usable AP (cap 6 each): on 12 columns, 4.1 solo → 6.8–7.4 with 3–4 keru. On 14 columns the median also rises from 10 to 15–16.
3. **To make tap-ins a real dead-run tool, let a keru tap in when its value is ±1 of any exposed tableau card** (it "has a play"). Then the party acts like extra foundations. Unlimited, that runs away from 9–12 columns, like adding foundations. **Capped at 1 tap-in per turn it is a clean fix:** 1 foundation × 7 columns with 3 keru gives 6% dead turns, a median streak of 6, 0% runaway and 5.5 usable AP. That's today's 2×7 pace (10% dead, median 6, 6.0 AP) with one foundation.
4. **Party size matters most with the looser rule.** On 7 columns with 1 tap-in per turn: 2 keru 12% dead, 3 keru 6%, 4 keru 2%. Bigger parties mean a reserve value is more likely to fit something on the table.
5. **No cooldown is needed with your rule.** Free unlimited tap-ins never ran away on any table tested. With the looser rule, keep a per-turn cap: price alone doesn't stop runaways (from the ability study), but a cap does.
6. **Memory is a skill lever the sim underrates.** The sim's player only plans the current turn. A real player can leave a keru on a useful value for later, which makes stored values less random and tap-ins more frequent. Expect your rule to play a little stronger in hand than these numbers.

**Starting tuning**

- One active foundation, 3-keru party, 1 foundation × 7 columns.
- A reserve keru may tap in when its stored value is ±1 of any exposed tableau card, once per party turn (team-wide). The keru tapping out stores the current top. Tap-ins earn nothing.
- Result: 6% dead, median 6, 0% runaway, 5.5 usable AP. With 4 keru: 2% dead, median 7, 6.1 AP.
- If you want to keep your stricter rule (±1 of the foundation), use it on 12 columns with 3–4 keru (12–13% dead, median 9, 6.8–7.4 AP, no cap needed).

## Model

- The same golf model as the earlier studies: ±1 with A/K wrap, every card face-up, depth 4, infinifill, and Withdraw redeals and ends the turn. Each setting is 150 fights of 20 party turns (3,000 turns). Expect about ±1.5 points of noise.
- Each keru starts with a random stored value. The active keru's value is the foundation top. On a tap-in, the incoming keru's stored value becomes the top, and the outgoing keru stores the old top. Memories and the active keru carry across turns and Withdraw.
- Cards played earn +1 AP for the active keru. Tap-ins earn nothing. **Usable AP** is per turn, capped at 6 per keru.
- **Expert** player: searches every visible line (up to 1,500 nodes), including chains of tap-ins. A chain can't be longer than the reserve, and the player can't tap straight back to the keru it just swapped out, so it can't loop.
- **Dead** means a turn with zero plays. **Runaway** means 100 plays in one turn. Tap-in rules:
  - **Foundation** (Eric's rule): the stored value is ±1 of the foundation top.
  - **Table**: the stored value is ±1 of any exposed tableau card.

## Eric's rule: tap in when ±1 of the foundation

Each cell: dead turns · median streak · runaway turns. Tap-ins are unlimited unless the column says otherwise.

| Columns | Solo (no party) | 2 keru | 3 keru | 4 keru | 4 keru, 1 tap-in per turn |
|---|---|---|---|---|---|
| 5 | 43% · 1 · 0% | 42% · 1 · 0% | 40% · 1 · 0% | 37% · 1 · 0% | 38% · 1 · 0% |
| 6 | 35% · 1 · 0% | 37% · 1 · 0% | 33% · 2 · 0% | 34% · 2 · 0% | 30% · 2 · 0% |
| 7 | 30% · 2 · 0% | 31% · 2 · 0% | 29% · 2 · 0% | 28% · 2 · 0% | 27% · 2 · 0% |
| 8 | 25% · 2 · 0% | 25% · 2 · 0% | 26% · 2 · 0% | 24% · 3 · 0% | 22% · 3 · 0% |
| 9 | 23% · 3 · 0% | 21% · 3 · 0% | 21% · 3 · 0% | 19% · 4 · 0% | 17% · 4 · 0% |
| 10 | 19% · 4 · 0% | 19% · 4 · 0% | 18% · 4 · 0% | 17% · 5 · 0% | 15% · 5 · 0% |
| 12 | 15% · 6 · 0% | 14% · 6 · 0% | 13% · 9 · 0% | 12% · 9 · 0% | 11% · 9 · 0% |
| 14 | 10% · 10 · 1% | 8% · 15 · 1% | 10% · 16 · 1% | 9% · 16 · 1% | 8% · 17 · 1% |

| Columns | Solo AP | 2 keru AP | 3 keru AP | 4 keru AP | Tap-ins per turn (4 keru) | Most-fed keru share (4 keru) |
|---|---|---|---|---|---|---|
| 7 | 2.2 | 2.4 | 2.9 | 3.1 | 0.5 | 87% |
| 10 | 3.4 | 4.2 | 5.1 | 5.6 | 1.0 | 82% |
| 12 | 4.1 | 5.3 | 6.8 | 7.4 | 1.4 | 79% |
| 14 | 4.6 | 6.7 | 8.1 | 8.9 | 1.7 | 78% |

Plain 2 × 7 for reference: 10–12% dead, median 5–6, 0% runaway, 6.0 usable AP.

## Looser rule: tap in when ±1 of any exposed card

Each cell: dead turns · median streak · runaway turns.

| Columns | 2 keru | 2 keru, 1/turn | 3 keru | 3 keru, 1/turn | 4 keru | 4 keru, 1/turn |
|---|---|---|---|---|---|---|
| 4 | 28% · 2 · 0% | 29% · 2 · 0% | 16% · 3 · 0% | 15% · 2 · 0% | 11% · 6 · 0% | 10% · 3 · 0% |
| 5 | 20% · 3 · 0% | 21% · 2 · 0% | 12% · 5 · 0% | 11% · 3 · 0% | 7% · 9 · 0% | 7% · 4 · 0% |
| 6 | 15% · 4 · 0% | 16% · 3 · 0% | 7% · 8 · 0% | 7% · 4 · 0% | 5% · 14 · 0% | 4% · 5 · 0% |
| 7 | 12% · 5 · 0% | 12% · 4 · 0% | 6% · 12 · 0% | 6% · 6 · 0% | 4% · 18 · 2% | 2% · 7 · 0% |
| 9 | 7% · 12 · 1% | 8% · 7 · 0% | 3% · 25 · 5% | 3% · 10 · 0% | 1% · 31 · 9% | 1% · 11 · 0% |
| 12 | 3% · 33 · 9% | 3% · 19 · 0% | 1% · 51 · 21% | 1% · 21 · 0% | 1% · 62 · 30% | 0% · 22 · 0% |

Usable AP:

| Columns | 3 keru, 1/turn AP | 4 keru, 1/turn AP | 3 keru unlimited AP | 4 keru unlimited AP |
|---|---|---|---|---|
| 5 | 3.5 | 3.9 | 6.8 | 9.9 |
| 6 | 4.5 | 5.0 | 8.8 | 12.4 |
| 7 | 5.5 | 6.1 | 10.4 | 13.8 |
| 9 | 7.2 | 7.7 | 12.9 | 16.5 |

A version where any keru can tap in at any time, with no legality check, plays almost the same as the table rule (raw data in `results7.json`). The table rule reads better, because a keru taps in when it has a play.

## Ideas not simulated

- **Per-keru cooldown** (a keru that taps out can't return for a turn). With the table rule, the 1-per-turn cap already does this job.
- **Tap-in costs** (AP from the incoming keru). Because tap-ins earn nothing, a cost isn't needed for exploits. It would only slow the pace.
- **Memory-aware play**: a player who deliberately parks keru on spread-out values (for example 3, 7 and 11) would tap in more. Worth testing by hand in a scenario.
