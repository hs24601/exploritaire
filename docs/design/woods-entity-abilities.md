# Woods entity → ability hand

`portals.html?combat` opens a three-card entity fan: Lustro, Flurry and Hero. Star is absent. Hero uses her approved entity portrait; her Bite action art appears only in the ability fan.

Tap, keyboard-activate or grab an entity to pin its portrait at the upper left and replace the opening fan with that owner's abilities. The pinned card returns to entity selection while choosing an ability. It stays visible while charging and targeting, then clears for the meteor cinematic. Entities never arm grid previews or start puzzles. Only ability cards can be armed or dragged onto the foundation grid. Shared pointer/gyro parallax, lenticular optics, transparent quarter-size ghosts, target outlines, pause and reduced-motion handling remain in use.

- Lustro: Meteo. This is the former Fireball ability with a new display/ability ID; damage, receipt scaling, stencil/painting, transfer and meteor choreography remain the same.
- Hero: Bite.
- Flurry: Ice Armor, Rime Retort, Whiteout, Glacial Lance, Shatterstrike and Snow Golem. These reuse the project's authored ice-kit concepts. Snow Golem uses the existing `snow-golem` identity, with a concise title for the compact fan.

The Flurry cards are a **temporary functional scaffold**, not the production AP/enemy-turn kits: hostile ice actions deal their charged frost damage (Whiteout and Glacial Lance also mark slow); support actions record armor, retort or summon power on Hero without accidentally healing or damaging either actor. Their prototype counters are exposed in `__castle1111.spells.heroEffects`. Enemy-turn retaliation, Frost consumption, summon actors and production balance remain unauthored in this isolated exploration slice.

The foundation-selection field doubles from 8×5 (40 cards) to 10×8 (80 cards), with `cardScale: 2` (192×268 logical card dimensions). A minimum display scale preserves the larger readable tiles instead of auto-shrinking the whole field. The bounded field scrolls in both axes when needed, recommends and centers a valid foundation on reveal/reselect, and folds into the existing canonical 3×3 play model. The twelve-card stock, refill queues, rank matching, solver and stock reselect are preserved. Scroll fitting and surface clipping are opt-in; standalone 3xgrid and stellarcombat retain their original defaults.

Data and UI: `src/book/woodsSpellRules.ts`, `woodsSpellHand.tsx`, `woodsSpellTest.ts`. Browser validation: `tools/woods-entity-hand-check.cjs`; captures: `output/woods-entity-*`, `woods-double-stargrid.png`, `woods-flurry-ability-hand.png` and `woods-stargrid-narrow-scroll.png`.
