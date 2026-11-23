# Woods spell escalation: balance sim (2026-11-21)

Rules: `src/book/woodsHandBoard.ts` (tests in `woodsHandBoard.test.ts`). Page: `portals.html?combat`.

## Setup (one wild foundation per spell)

- The Khadroot has **no rank and no card frame**. Finished spell cards are dropped onto it.
- Nobody channels at the start; the player picks abilities from the fan.
- Live ability cards are ±1 foundations (K and A wrap). Board tops (4 columns of 3) and hand cards (4) play onto them, and the played card stays on top as the new rank (golf stacking). An emptied column takes one card from the stock.
  - **Mochi, Fast Swipes:** 2 live cards that refill forever. Each play onto them is a 1-damage chip. Lv2 (8 swipes) crits for 3 every 4th, Lv3 (20 swipes) every 3rd.
  - **Hero, Lustro's spells (Eric, 2026-11-22):** one foundation that opens wild ("Any"). Any card starts it, then each play stacks on top. A spell finishes on its receipt count (plays onto it). Then it becomes a card in hand, dragged or tapped onto the Khadroot to cast.

| Spell | Receipts | Damage | Wildfire vs a weak target |
|---|---|---|---|
| Fire | 3 | 5 | 0 |
| Fira | 5 | 12 | 1 |
| Firaga | 8 | 24 | 2 |
| Meteo | scavenger hunt: find a 2, a 4 and a K | 48 (ignores resistance) | 1 |

- **Wildfire** counts as one receipt whatever the rank and opens the foundation wild again, so it also unsticks a dead foundation.
- **Kindling:** each cast trims 1 receipt from the next spell (never below 3).
- **End turn:** the Khadroot strikes kin in turn. A strike knocks one receipt off the spell that kin is channelling. The plain hand is discarded and a fresh 4 is dealt; wildfire and spell cards stay.

## Results

300 seeded fights per row. The sim player starts Fast Swipes at once, takes the play with the longest follow-up chain, casts at once and burns wildfire at once. "Policy" is the spell Hero keeps choosing.

Khadroot 70 HP, strike 4, Hero 20, Mochi 16 (chosen):

| Policy | Win | Turns | Plays/turn | First cast (turn) |
|---|---|---|---|---|
| Swipes only | 3% | 9.9 | 2.3 | - |
| Fire | 31% | 8.9 | 5.1 | 1.9 |
| Fira | 73% | 6.7 | 5.5 | 2.6 |
| Firaga | 67% | 7.1 | 5.1 | 3.8 |
| Meteo | 67% | 7.2 | 5.0 | 5.0 |
| Ladder (Fire, then up) | 58% | 7.6 | 5.3 | 1.9 |

- One spell foundation means much shorter chains (about 5 plays a turn, down from 10 to 12 with 3 foundations), so receipt counts came down.
- Fire alone is a weak plan (31%); the bigger spells win about two thirds of fights. Meteo is a 5-turn build.
- Tried and rejected: the previous receipts (4/8/16/30) at 100 HP (3–7% wins), 3/6/10/16 (31–64% at 60–70 HP), strike 3 (Swipes alone wins 24–40%).

## Meteo as a scavenger hunt (Eric, 2026-11-22)

Meteo is a Phase 10-style phase: three empty slots that want exactly a **2**, a **4** and a **K**, filled in any order, with no ±1 sequence. Only the exact card fits a slot; a filled slot locks (✓). Wildfire fills any empty slot. A strike knocks the rightmost found card back out. Kindling doesn't apply.

Wildfire count matters most: with 3 wildfire (the old Meteo count) every Meteo fills instantly on turn 1. Sim (Meteo only, Mochi swiping, Khadroot 70 HP/strike 4):

| Wildfire | Damage | Win | Turns | First cast (turn) |
|---|---|---|---|---|
| 3 | any | 100% | 1.0 | 1.0 (broken) |
| 0 | 48 | 61% | 7.5 | 3.8 |
| 0 | 36 | 43% | 8.3 | 3.8 |
| 1 | 48 (chosen) | 71% | 6.7 | 3.1 |
| 1 | 36 | 57% | 7.4 | 3.1 |

The earlier "walk each foundation to 2, 4, K" version is retired.

Surface ideas to replace the 4-column board + hand: `docs/research/ability-puzzle-surfaces.md`.

## Flip supply (Eric chose idea 1, 2026-11-22)

`?combat` now uses the flip deck by default (`?combat&supply=board` keeps the old 4-column board + hand). One face-up card at a time, with a 2-card look-ahead. Playing the face-up card onto an ability is free and turns up the next one. A flip discards it, and you get a limited number of flips per turn (reset at End turn). The hand only holds wildfire and finished spell cards.

Sim (greedy flip player: plays the face-up card wherever it fits, flips when stuck, ends turn when out of flips; Mochi swiping; Khadroot 70 HP/strike 4):

| Flips/turn | Swipes | Fire | Fira | Firaga | Meteo (hunt, 48) |
|---|---|---|---|---|---|
| 3 | 0% | 0% | 2% | 2% | 40% |
| 5 | 0% | 4% | 39% | 37% | 94% |
| 6 (chosen) | 0% | 16% | 72% | 64% | ~100% |
| 7 | 0% | 41% | 89% | 86% | 100% |

At 6 flips Fira and Firaga sit near 70% again, with about 4–5 plays a turn. **Meteo's scavenger hunt is far too easy with a flowing deck**: every card that passes is a chance at a 2, a 4 or a K. Lowering its damage (24–30) or removing its wildfire still left it at 87–95%, and having a strike scatter every found card barely mattered. The real lever is a harder hunt (more slots, or needing pairs). That's Eric's call.

## Standard 7-column tableau and a 5-card Meteo (Eric, 2026-11-22)

`?combat` now defaults to a standard 7-column golf tableau, 4 deep, with every card face up and only the top cards playable. There's no plain hand; it holds only wildfire and spell cards. Columns can run empty during a turn, and End turn tops every column back up to 4 with the new cards on top. `?combat&supply=flip` and `?combat&supply=board` keep the earlier tries.

Meteo now needs 5 cards: **2, 4, 7, 10 and K** (Eric asked for 5; I picked the three extra ranks to spread the hunt across the deck).

Sim (greedy player, Mochi swiping, strike 4):

| Khadroot HP | Swipes | Fire | Fira | Firaga | Meteo (3-card hunt) |
|---|---|---|---|---|---|
| 70 | 2% | 37% | 53% | 49% | 34% |
| 60 (chosen) | 5% | 41% | 56% | 53% | 44% |
| 55 | 6% | 48% | 58% | 55% | 51% |

5-card Meteo at 60 HP: **33%** wins at 48 damage, first cast about turn 2. At 60 damage it one-shots the Khadroot (54%), which was rejected. Spells come together fast here (first cast in turns 1–2) but fights still run 6–8 turns, so the tableau rewards steady casting more than one big build.

## Stagger break and Har Megiddo (Eric, 2026-11-23)

Stagger replaces the intent-stealing idea. Defaults I picked (easy to change in `woodsHandBoard.ts`):

- **Stagger gauge 15.** All damage dealt to the Khadroot fills it. When it fills, the Khadroot is staggered: the gauge resets and it **loses its next action** (no strike, no spell progress).
- **Break.** If the Khadroot is casting when staggered, the spell breaks. Every card already placed in it **spills onto the table**, shown first in the hand row, and can be played as a receipt like any other card. Spilled cards stay until used.
- **Har Megiddo.** On its first turn the Khadroot starts casting a phase of **7 ranks drawn at random from the stock**. It fills **2 slots a turn**. At 7/7 it hits every living kin for **10**, then starts again on its next turn.
- A **layout button** beside End turn cycles the supply: 7 columns → Flip deck → 4 columns + hand. Switching starts a new fight. It is also kept in the URL (`?supply=`).

With Har Megiddo running, fights are shorter (about 4–6 turns) and win rates stay close to the table above. Breaking it before turn 4 is the main reason to build damage early.

## Layout for the Galaxy Z Fold 7 (2026-11-23)

Now a standing rule in GAME.md. Target CSS viewports: unfolded 884×797 (landscape) and 797×884 (portrait), cover screen 412×915 (portrait), plus desktop. Below 1100px wide the tray becomes a grid with the controls on top. Below 600px the ability lanes stack above the tray. Cards shrink to fit 7 columns and keep 63:88. HP plates avoid each other, the screen edges and the lanes.
