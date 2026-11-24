# City riff: direct puzzle surfaces, no pawns (2026-11-23)

Ideas and open questions, written before building. **Eric's answers (2026-11-23):**

1. **Day limiter:** tie receipts to daylight. Do a simulated balance pass so that working the tableau uses very little daylight and reaching for the stock costs more. The Hands idea in section 2 is dropped. The numbers are in `docs/research/village-daylight-balance.md`.
2. **Look:** replace the wood, felt and brass look with something polished, modern and bespoke.
3. **Surfaces:** Forest, Berry Patch and Quarry are enough for the first slice. Fishing comes later.

The first slice is built as `village.html` (`src/village/`). Questions 4 to 8 are still open. The slice assumes: kin have portraits, buildings go anywhere on a 5×3 plot with side-by-side combos, an unfed kin goes hungry and leaves after a second unfed night, and runs last until the stock runs out or you leave.

Eric's brief: a new take on city building. No kin/actors dragged onto cards as the stamina element. The player plays themed golf puzzles directly: a **forest** for lumber, a **berry patch** for food, plus whatever fills standard progression (mining, fishing...). Goal loop: **shelter for wandering kin, amenities to attract more, a full loop like Dungeon Village 2**. The first pass must be a **fully expressive vertical slice** of the core loop. Look: clean lines, dense and polished (Melvor Idle), not the previous `?city` slice (big empty felt, oversized gradient-header cards, floating chips, a lot of nothing).

---

## 1. The loop in one picture

```
 Surfaces (golf)        Stores            Village              Kin
 Forest  -> lumber  -\                 /- build shelter  -> wanderer moves in
 Berries -> food     -> stock -> spend -> build amenity  -> appeal up -> better wanderers
 Quarry  -> stone   -/                 \- feed residents      |
 Pond    -> fish                                              v
   ^                                           residents add Hands + perks
   '---------------- more Hands = more puzzle runs per day ----'
```

The Dungeon Village 2 pattern, translated: there facilities attract visitors, visitors who like the village move in, residents make the village stronger, rank-ups unlock more. Here **surfaces are the facilities you operate yourself**, and **kin are what you're growing**, not tokens you move.

## 2. What replaces pawn stamina? (the big decision)

Something still has to bound a day, or the puzzles are just infinite grinding. Options:

| Option | How it works | For | Against |
| --- | --- | --- | --- |
| **A. Hands (recommended)** | The village has N Hands per day = 2 + 1 per housed kin. Opening a surface run costs 1 Hand; a redraw costs 1 more. | Kin are still the engine of growth, but passively. Housing a kin *visibly* buys more play. Closes the DV2 loop. | Early days are short (2–3 runs). |
| B. Daylight clock | A sun dial with ~8 hours. Runs cost hours, longer surfaces cost more. | Very readable, cozy. | Doesn't grow with kin unless kin extend the day. |
| C. Tool wear | Axe, basket, pick each have uses; tools are rebuilt with materials. | Ties surfaces to crafting. | Three meters to watch; resource sink, not a day rhythm. |
| D. No cap (Melvor-style) | Play as much as you like; regrowth timers are the only gate. | Zero friction. | No day, no food pressure, weak loop. |

**Recommendation: A**, with surfaces also having a finite yield that regrows overnight (a grove can be felled out). Food upkeep is per resident per day, so more kin = more Hands but more berries owed: a real tension.

## 3. Surfaces: one golf variant each, each with its own twist

Rule from the combat work that we keep: **every surface is its own puzzle with its own risk and reward**, but all share the golf core (play ±1 onto a foundation, receipts = yield) so learning one teaches the rest.

**Forest (Lumber)** — 7-column golf, trees are columns.
- Twist: **felling**. Clear a whole column and that tree drops a log bundle (+3 bonus). Chains of 5+ are a "clean swing" (+1).
- Grove picker like Melvor's locations: Birch Stand (open), Old Oaks (Forestry 5, heavier logs), Ironwood (later).

**Berry Patch (Food)** — the 3×3 grid tableau (already built and liked).
- Twist: **ripeness**. Some cards are unripe (dimmed rank, not playable); they ripen when a neighbour is picked. Picking around them is the skill.
- Overripe cards (rare) give 2 food but spoil the stores by 1 if left at run end. Small push-your-luck.

**Quarry (Stone, later Ore)** — columns are shafts, deeper = richer.
- Twist: **depth**. Bottom row cards are ore veins (×2). If the run dead-ends with a shaft untouched, a small cave-in seals it for tomorrow.
- Exists in the slice because shelter tiers need stone, so there's a reason to leave the forest.

**Pond (Fish)** — reuse the fishing redesign: cast (rank match = hook), then the short "fight" meter kept in zone with ±1 cards, under 10s, react-in-the-moment.
- Proposed for **pass 2**, it's a different interaction model and would double slice scope. Food comes from berries in pass 1.

Later fillers (not slice): Clay Bank (pottery), Herb Garden (medicine / malnourishment cure), Reed Bed (thatch).

**Mastery per surface (Melvor's best idea, cheap to add):** each surface has a level from its own receipts. Levels unlock the next grove/vein, a deck tweak (e.g. one wild card per run), or a perk. It gives every surface its own progress bar and the "Locked: Forestry 5" tiles that make Melvor screens feel full of promise.

## 4. Village and kin (the DV2 half)

- **Village plot:** a small fixed grid (e.g. 5×4) where buildings are placed. Rank-ups widen it.
- **Wanderers at the gate:** each morning 1–2 wanderer cards appear with **needs** (shelter tier, food/day) and **likes** (amenity tags: Warm, Sweet, Quiet, Shiny). They stay 2 days, then leave. Housing one = it moves in.
- **Appeal:** amenities add appeal; appeal sets how many and which wanderers show up (rarer kin need higher appeal). That's the "build amenities to attract more" lever.
- **Adjacency combos (DV2 signature):** e.g. Campfire next to Log Bench = Hearth (+appeal, Warm). Berry Stall next to Drying Rack = Pantry (food spoils slower). Discovering combos is a cheap, very satisfying content layer.
- **Residents give:** +1 Hand each, plus one perk tied to a surface (Banks: forest bundles +1; Mochi: one free ripen per berry run; Demi: cave-ins never happen). The kin you choose to house shapes how you play.
- **Village rank:** Hamlet → Village → Town, from appeal + residents. Each rank unlocks a surface, a plot expansion and new wanderer types.

### Slice building list (draft)

| Building | Cost | Effect |
| --- | --- | --- |
| Lean-to | 4 lumber | Shelter tier 1, houses 1 |
| Burrow | 6 lumber + 3 stone | Shelter tier 2, houses 2 |
| Campfire | 2 lumber + 2 stone | Amenity: Warm, +2 appeal |
| Log Bench | 3 lumber | Amenity: Quiet, +1 appeal (combo with Campfire) |
| Berry Stall | 3 lumber + 4 food | Amenity: Sweet, +2 appeal |
| Drying Rack | 4 lumber | Food doesn't spoil overnight; combo with Stall |
| Woodshed | 5 lumber | Raises lumber storage cap |

## 5. Screen design (the anti-slop part)

What went wrong in image 1: a huge empty felt field, cards as the only UI element, big gradient headers, low-contrast captions, chips floating with no alignment, and no sense of what's next.

What Melvor does that we copy:
- **One fixed frame:** a thin top bar (day, Hands, food, lumber, stone, rank), a left **icon rail** of surfaces + Village, and one main panel. Nothing floats.
- **Dense panels with hairline borders:** every number sits in a table row: *Output / Qty / You have*. Tabular numerals, one accent colour per surface (forest green, berry magenta, quarry slate, pond teal).
- **Locked tiles everywhere:** "Old Oaks · Forestry 5". Locked content is visible, dim, and specific.
- **A progress bar under every verb:** mastery, day, building construction, wanderer stay.
- **Restraint with the board-game look:** keep material cards (no glows on legal plays, per the no-hand-holding rule) but put them inside a clean panel, not on an endless table.

Proposed surface screen layout (desktop):

```
+---------------------------------------------------------------+
| Day 3  ●●●○ Hands  | Food 12  Lumber 18  Stone 4 | Hamlet ▓▓░ |
+----+----------------------------------------------------------+
| ⌂  | Birch Stand | Old Oaks (Forestry 5) | Ironwood (locked)  |
| 🌲 |-----------------------------------------+----------------|
| 🫐 |                                         | Output         |
| ⛏  |        golf tableau (the puzzle)        | Lumber   +7  18|
| 🐟 |                                         | Bundle   +1    |
|    |        stock · foundation · receipts    | Forestry 4 ▓▓░ |
|    |                                         | [ Start run ·1✋]|
+----+-----------------------------------------+----------------+
```

Z Fold 7 folded: the rail becomes a bottom tab bar and the Output panel collapses into a strip under the tableau. Unfolded (near-square): same as desktop with a narrower Output column.

## 6. Vertical slice proposal (pass 1)

Fully playable loop in ~15 minutes of play:

1. Day 1: 2 Hands, Forest + Berry Patch open, one wanderer (Mochi) at the gate needing a Lean-to.
2. Fell lumber, pick berries, build the Lean-to, Mochi moves in (+1 Hand, perk).
3. Food upkeep starts; wanderer #2 likes Warm → build Campfire → discover the Hearth combo.
4. Reach Hamlet → Village: Quarry unlocks, Burrow becomes buildable, appeal pulls a rarer kin.
5. Save/reset, mastery levels on all three surfaces, desktop + Z Fold layout check.

Out of slice: fishing, combat/raids, recipes-by-discovery beyond combos, idle automation.

## 7. Opportunities to muse on

- **Kin as automation later (the Melvor bridge):** once a surface hits a mastery level, a resident can "tend" it overnight for a small idle yield. Kin stay off the board but still matter.
- **Wanderer cards are cards:** a wanderer could literally be a card dealt into a surface (find a lost kin at the bottom of a tree column), making exploration happen inside the puzzles.
- **Seasons** as a deck modifier (winter: berry patch closed, forest gives more). Cheap variety.
- **Night raids** from dark slimes as the eventual reason for walls and the combat system, DV2-style.
- **One-tap repeat:** "Start run" remembers the grove, so the loop is fast on phone.

## 8. Questions for Eric

1. **Day limiter:** Hands from residents (A), a daylight clock (B), tool wear (C), or no cap (D)?
2. **Look:** does the Melvor-clean frame replace the wood/felt/brass tabletop for this riff, or should it be "clean panels with material cards inside" as sketched?
3. **Surfaces in pass 1:** Forest + Berries + Quarry, fishing in pass 2. OK, or must fishing be in the first slice?
4. **Are kin visible as characters?** Portraits in a roster and at the gate (existing art), or purely numbers?
5. **Placement:** free placement on a village grid with adjacency combos, or fixed slots (simpler, less DV2)?
6. **Failure:** what happens when food runs out: malnourished (fewer Hands), or a kin leaves?
7. **Where it lives:** a new `?village` query on book.html (leaving `?city` intact), or replace `?city`?
8. **Run length:** target ~60–90s per surface run, auto-ending when stuck?
