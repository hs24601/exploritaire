# Village: travel, parties and an explorable world (2026-11-25)

Eric's ask: review where `village.html` stands, then look at adding travel time and stamina for map travel, so that **choosing a party before you leave** becomes a risk/reward decision, alongside deeper mechanics that reward planning and curiosity. This note gives ideas and a recommended first slice. Nothing here is built yet.

## 1. Where the village stands today

**What works:**

- **Three distinct golf surfaces**, each with a twist:
  - **Forest:** Birch Stand fall direction; Old Oaks two-column trees that pay only when finished.
  - **Berry Patch:** ripening.
  - **Quarry:** hidden depth.
- **Daylight is the single clock.** Plays cost 2 min, a stock draw costs 15 min, and the day is 14 h. Each surface yields about 100 to 130 units a day.
- **The 9 × 6 home map:**
  - Features are fixed, and buildings move.
  - Combos form across shared edges, and buildings get bonuses for touching a feature (Woodshed, Drying Rack, Lantern).
  - Taking a building down refunds 50%.
  - Fog lifts at Village rank.
- **Kin** each have a liked tag, a food cost and one passive surface perk. They wander in at the gate when appeal is high enough, and they leave after two hungry nights.

**Where it's thin** (the gaps the ideas below aim at):

1. **No reason to look further.** All three features are visible, or fogged until a rank, from minute one. Nothing is out there to discover.
2. **Kin are passive.** A resident is a bed, a food bill and a static perk. Who you take in matters, but nothing asks you to *use* them.
3. **One currency of risk.** Daylight is the only thing a choice can cost, and nothing you do can fail or be lost. The bot reaches Town on day 5 or 6 with no setbacks.
4. **Food has one use** (feeding residents), and stone has two buildings' worth of demand. Resources have nowhere to flow after the build list.
5. **Placement is static.** Once the combos and feature bonuses are set, the map stops asking questions.

## 2. The shape I'd propose: two scales

Keep the **Hollow** as it is: home, building, instant access to the three home features, the deity-like player. Add **the Wilds** beyond the gate as a second, larger map. Travel time and stamina live only there.

- This keeps everything Eric approved for the home map (no walking, tap to work) and puts the new risk where it reads naturally: leaving home.
- The gate tile becomes the threshold. Wanderers arrive there, and expeditions leave from it.
- The Wilds use the same square grid and `GridCoordinates` convention as the home map. Biomes are clusters of tiles of one terrain type, like the multi-tile features today. Travel is costed **per tile entered**, by terrain, so a big biome is slower to cross than to skirt.

**One question decides a lot (Q1 below):** on an expedition, does the deity *guide a party of kin* (the kin travel; you still play the puzzles, using the party's perks), or does a player avatar walk? The rest of this note assumes **the deity guides a party of kin**. That keeps the identity Eric set on 2026-11-24 and makes the party the thing you compose.

## 3. Travel, time and stamina

Two meters, each with its own job, so they never blur:

| Meter | Belongs to | Spent by | Restored by | What it limits |
| --- | --- | --- | --- | --- |
| **Daylight** | the world | travel (minutes per tile by terrain), puzzle plays, stock draws | dawn | how far you get **today** |
| **Stamina** | each kin on the expedition | travel (per tile by terrain), stock draws at a wild site, hazards | packed food (eat on the trail), camp, a night at home | how long the party can **stay out** |

- **Terrain costs** (starting numbers to sim):
  - Meadow: 10 min and 1 stamina per kin.
  - Woods: 20 min and 2 stamina.
  - Marsh or hills: 30 min and 3 stamina.
  - Built path: 5 min and 0 stamina. Roads are a building you can invest in (see section 6).
- **Hitting 0 stamina doesn't kill anyone.** That kin is *spent*: no perk, and the party slows by 50%. If everyone is spent, the expedition turns home on its own and **drops half its haul**. That's the risk.
- **Dusk away from home** asks for a choice:
  - Make camp: costs food, restores some stamina, and you wake in the Wilds.
  - Push on in the dark: double stamina per tile, and the Lantern or Cir's light halves that.
- **The route preview before you commit** shows the estimated minutes and stamina for the path, both there and back, like the building ghost preview. That's planning feedback, not move hints.

## 4. Party composition: where the risk/reward lives

Each kin gets a small **trail profile** on top of the perk they already have:

| Kin | Stamina | Carry | Trail skill (idea) | Surface perk (today) |
| --- | ---: | ---: | --- | --- |
| Mochi | 8 | 6 | **Forager:** berries found on the trail restore 1 stamina | Berries: +1 food per 5-chain |
| Banks | 12 | 10 | **Packhorse:** woods tiles cost him 1 less | Forest: +2 per felled tree |
| Cir | 6 | 4 | **Lamplight:** party travels after dusk at normal cost; reveals fog 1 tile farther | Quarry: first stock card free |

The decisions this creates:

- **Who goes vs. who stays.** Kin left at home do a **home chore** (new): Mochi tends the stall (+appeal), Banks splits wood (+lumber at dusk), Cir keeps the lantern lit. Taking everyone strips the village for the day. So party choice is a real opportunity cost, not "always bring the best."
- **Carry is a cap on the haul.** Each unit of resource takes carry, and it's the sum of the party's carry. A big haul needs a big party, and a big party eats more food. Overfilling forces a choice of what to leave.
- **Fed vs. hungry.** Packing food is the stamina reserve. That gives food its second use and ties expeditions to the berry economy.
- **Party size cap:** 2 at Hamlet, 3 at Village. A rank-up feels like a bigger reach.
- **Perks work where the party is.** Banks must be *on the trip* for his felling bonus at a wild forest. That makes the surface perks part of the composition puzzle instead of global passives. (Whether this also applies at the home features is Q3.)

## 5. A world that rewards planning and curiosity

**Fog, scouting, landmarks**

- The Wilds start fogged except a ring around the gate. Moving reveals 1 tile around the party (2 for Cir). A **Lookout** building, or reaching a hilltop tile, reveals a wider ring once.
- **Landmarks you can see before you reach them:** a tall pine, smoke or a ruin silhouette at the fog edge. They give curiosity a target without a quest marker.
- **The world is authored, with seeded variation.** A hand-placed skeleton (regions, landmarks, unlock gates) with seeded details (which wild site, which twist, events) keeps it designed and still worth a second save.

**New site types** (each a golf surface with one twist, like today's three):

| Site | Resource | Twist idea |
| --- | --- | --- |
| Pond | fish (food that doesn't spoil) | the water memory's bait-and-fight idea, simplified to a tableau variant |
| Mushroom ring | food + a rare spore | cards are face-down until a neighbour is picked; it's dark, and lantern light peeks |
| Ruins | relics (a new resource for upgrades) | locked piles that open on a matched pair |
| Wild orchard | food, seasonal | ripeness changes by day: visit on the right day |
| Ore vein | ore | the deep-seam rule with a cave-in risk on long chains |

**Wild sites deplete and regrow.**

- Heavy work thins a site, using the art list's `-thinned` and `-picked` states, and it recovers over days.
- This pushes you outward and rewards rotating between sites.
- The home features could follow the same rule, more gently.

**Curiosities, one-off and small:**

- A signpost with lore.
- A stranded wanderer: a kin found in the wild, who joins only if you escort them home within their stamina.
- A buried cache: a tiny golf puzzle with a fixed deal and a sure reward.
- A shrine: spend food once for a permanent +1 to something.

Each one is a reason to step one tile off the efficient route.

**Events on the trail** (rare, readable, under 10 s each):

- A fallen tree blocks a path: work 3 cards to clear it, or detour.
- Rain: muddy tiles cost +1 stamina today. The **weather forecast at dawn** turns this into planning.
- Resolve events as small card checks against the party (e.g. "turn a stock card; Banks' 12 carry makes the lift if it's 7+"). Keep them rare so they add tension, not chores.

## 6. Building that reshapes the world

This is where the home-map building decisions start to serve exploration:

- **Paths** (lumber) cost a tile less in time and stamina. A built road network is a visible record of where you go.
- **Waystation** (lumber + stone): a camp in the Wilds that restores stamina and holds part of a haul. It turns a far site into a two-day loop.
- **Bridge / ford** (stone): opens a region behind a river. A hard gate that stone buys, which gives stone a destination.
- **Lookout:** reveals fog. **Packhouse:** +carry for every expedition.
- **Upgrades at 100% refund** (Eric's note from 2026-11-24) fit here: upgrading a Lean-to into a Bunkhouse, for example, gives kin +stamina at dawn.

## 7. Making kin matter more

- **Kin grow with use.** Trail XP on expeditions raises stamina or carry by 1 at a threshold, and a second perk opens at their third level. Sending someone out becomes an investment.
- **Kin requests:** "Cir wants to see the ruins", or "Banks wants an oak log from the far wood". A small favour gives appeal, unlocks a perk or brings a friend. This turns curiosity into a goal without a quest log.
- **Bonds:** two kin who travel together often get a small pair bonus, like combos but for people. This rewards a stable party versus a min-maxed one.
- **New kin are found, not just attracted.** Some wander to the gate by appeal (as now). Others are met in the Wilds and need a home ready before they'll come.

## 8. Recommended first slice

Small enough to playtest in a round, deep enough to test whether the party decision is fun:

1. **A Wilds map** behind the gate, about 15 × 10 tiles in 4 terrains, fogged. Two wild sites: a far forest grove with a richer Old Oaks deal, and a pond (a plain golf deal that pays fish for now).
2. **The expedition screen:** pick up to 2 kin, pack food, and see the route preview (time and stamina, out and back).
3. **Travel per tile** with daylight + per-kin stamina, the spent state, auto-return with half the haul, and carry limits.
4. **Home chores** for kin who stay, so leaving people home is a choice.
5. **Two curiosities:** one stranded wanderer and one buried cache.
6. **A sim pass** before tuning, like the daylight balance: expected haul per day for a home-only day vs. a 1-kin trip vs. a 2-kin trip. The target is that a well-planned trip beats staying home by about 20–30%, and a reckless one loses.

Paths, the waystation, depletion, events and weather come after the slice proves the core.

## 9. Questions for Eric

1. **Who travels?** Does the deity guide a party of kin (my recommendation, which keeps the no-walking identity), or does a player avatar now walk the Wilds?
2. **Home vs. Wilds:** should the three home features stay instant (no travel, as now), with travel cost only beyond the gate? I'd say yes.
3. **Perks at home:** should kin perks at the home features still be global, or only for kin who stay home that day? The second one makes chores and expeditions compete. I'd lean that way, but it's a bigger change.
4. **Loss:** is a forced retreat losing half the haul the harshest outcome, or do you want something stronger, such as an injured kin who sits out a day? I wouldn't go further than that: no deaths, no leaving over a bad trip.
5. **Stamina scope:** one stamina meter per kin (more composition texture) or one pooled party meter (simpler UI)? I'd prototype per kin.
