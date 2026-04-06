# Kin Bible

## Core Terms

### INFINIFILL

`INFINIFILL` is the random backfill method that immediately repopulates a tableau back to full capacity as soon as its current top card is claimed.

Design intent:
- tableaus should remain visually full and legible
- newly exposed cards should advance into the front presentation slot immediately
- backfill should prevent the board from feeling hollow or partially collapsed after each claim

For seeded tutorials, test slices, and authored scenarios where random refill is not active, the game should still preserve the same presentation rule:
- when a top card is taken, the next card in that tableau advances forward into the front slot
- authored placeholder cards should maintain a stable full-capacity visual stack where needed

This should be treated as both:
- a refill rule for live random tableaus
- a presentation rule for non-random seeded tableaus

### Tutorial Rail Invariant

All tutorial slices must remain fully on rails.

This means:
- every move presented to the player as legally playable must be valid under normal game rules
- no alternate legal move may be exposed if taking it can break the intended tutorial sequence
- the authored happy-path moves at each step must equal the full set of legal player-visible moves at that step

Operationally:
- compute `legalMoves(state)` using standard game rules only
- define `happyPathMoves(state)` from the authored tutorial route
- require `legalMoves(state) == happyPathMoves(state)`

If this equality fails, the slice is invalid.

Authoring rules:
- do not solve rails by disabling a visible legal-looking card at input time
- if a card appears legally playable to the player, it must actually be playable
- rails must be authored into the tableau, reveal timing, and tutorial state itself
- special traversal mechanics such as streaking, exclusion, swap, fetch, rewind, or buried-card access must be included in rail validation
- tutorial and vertical slice presentation should not show `CLEARED` tableau placeholders
- if an authored slice needs a visually occupied empty column, use a non-playable value-safe card or a blank shell instead
- prefer real non-legal authored cards when they preserve legibility; use blank shells only when mathematically necessary

### Tutorial Filler / Disintegration Escape Hatch

If a seeded tutorial slice cannot satisfy the tutorial rail invariant using only live value-cards, the slice may use non-valued filler rows.

These filler rows:
- are visible presentation scaffolding, not legal playable cards
- may sit on top of authored value-cards to prevent premature exposure
- may disintegrate away on authored beats to reveal the next legal row in sequence

This is an approved escape hatch for tutorial slices, tests, and other authored scenarios where:
- a deep tableau would otherwise expose alternate legal routes
- the slice must remain deterministic
- the player should only ever see legal top-card options that preserve the happy path

### Tableau Coordinate Shorthand

Use `T#R#` or `t#r#` as the standard shorthand for authored tableau positions.

Examples:
- `T1R1` = Tableau 1, Row 1
- `T7R4` = Tableau 7, Row 4
- `t3r2` = Tableau 3, Row 2

This shorthand should be treated as equivalent regardless of case.

### Tutorial Seed Registry

Tutorial slices and bookmarks should be authored as permanent seed entries, not ad hoc debug states.

Rules:
- every tutorial seed gets a stable ID, for example `tutorial.s02.deadlock.v1`
- a seed must be loadable on demand from a central registry
- a seed may define expected visible top ranks, expected legal actions, and route checkpoints
- downstream variations should branch from a named parent seed or route spec instead of replacing the original seed
- rail validation and automated tests should resolve tutorial states through these permanent seed IDs

## Jet

### Status

Note: Jet is a scope creep nightmare. He is a favorite design space and should keep a large future-facing section in the bible for iteration, but he should not absorb the tuning and implementation time needed to ship and stabilize the more basic kin first.

### Jet Legacy

`JET LEGACY` refers to Jet's current playtest-era implementation in code.

This legacy kit includes:
- Sticky Paws
- Re-Purpose
- Quarnyx Battery
- Rigged Construct
- Rewire
- Scrap Plating
- Aegis Shunt
- Slink
- Siphon
- Efficiency
- Free Energy

These should remain documented and preserved as Jet's current baseline for playtesting while the next major redesign is explored.

### Future Direction

The intended future direction is to make construct-building the center of Jet's gameplay identity rather than treating `Rigged Construct` as one strong ability among many.

Prime Jet should become the kin with the most expansive deck logic in the roster. He inherits a Phase-10-style build language and can decide what kind of construct to build on the fly. Unlike other actors, building constructs physically removes cards from Jet's stock and places them into a new card in hand. Jet should also gain abilities that let him reuse cards from discard spaces, including his own discard, allied discard piles, and enemy discard piles, to complete inventions.

### Prime Jet Motif

Jet should feel like a field engineer operating an improvised workshop in the middle of a live run.

His core loop should be:
- acquire cards into stock
- route those cards into partially built devices
- complete inventions by matching build rules
- feed AP into completed devices instead of into Jet directly
- treat those devices as the true active engine of the character

Jet himself should never feel like a normal AP-holder. His devices are the AP sinks, the power batteries, and the visible expression of his machine-state.

### Tableau Design

#### (A) Stage Device

Tapping Jet should open a build menu that displays all unlocked inventions in Jet's library.

Buildable cards are highlighted.

Clicking a device adds it to Jet's hand as a build target.

This makes Jet feel less like he draws abilities and more like he chooses what to fabricate based on the current run state.

#### (P) Build and Power

Whenever Jet receives a card to his stock, he can downstream-sequence it into a device in his hand, incrementally building it according to Phase-10-style rules.

Jet may also steal cards from:
- enemy tableaus
- allied tableaus
- discard spaces, if supported by future unlocks

Whenever Jet gains AP, the AP should be shared in packets of `1` across all built devices in sequence.

Jet himself never gains AP directly. All gained AP is fed into his devices.

This should be treated as a foundational identity rule for future Prime Jet.

### Device Philosophy

Jet's gadgets should vary by resource demand and upkeep profile.

Some devices should require only cards.

Some devices should require both cards and AP.

Some devices should consume AP every turn to remain active and depower if they are not sufficiently fed.

Some devices may eventually have HP, taunt behavior, or autonomous battlefield presence, acting as temporary constructed allies or dummies.

### Example Device Concepts

#### Scrap Armor

Scrap Armor converts any cards in stock into `+1 Armor`.

It can be primed and applied to any target.

This captures the intended future Jet theme well:
- cards are material
- material becomes gadgets
- gadgets become tactical support or survival

#### Other Desired Device Families

Future Jet gadgets may include:
- improvised explosives
- armor
- shields
- utility gadgets
- golem-like constructs
- AP-hungry battlefield devices that depower if starved

### Implementation Guidance

When future Jet work resumes:
- treat the current Jet kit as `JET LEGACY`
- preserve legacy comments in code
- avoid deleting the old implementation until the new construct-first identity is fully testable
- prioritize getting other kin deployed and tuned before doing a deep Jet rewrite

## Unassigned Core Hero Ability Sets

### Electrical Master

Future-design aside for assignment to a later core hero.

#### (P) Electrify

Performing specific actions causes cards in the tableau to become electrified.

This should create a visible board-state layer that other abilities can reference and extend.

#### (A) Conduit

Electrified cards, if adjacent vertically or at a 45-degree angle to an adjacent tableau, can be chained together in sequence without stock interaction.

This should feel like building temporary conductive routes directly across the tableau, allowing a hero to bypass normal stock-dependent sequencing rules when enough electrified structure has been established.

## Hero

### Role

Hero is the intended starter kin.

He should be the simplest prime in the roster to understand and enjoy on first contact while still leaving room for more advanced play. His identity is built around:
- leadership
- stamina
- loyalty
- endurance
- straightforward sequence extension

Hero should feel like a husky-like pack lead: steady, reliable, eager to keep moving, and rewarding without requiring intricate setup language.

### Migration Note

Most of Hero's older tank kit should conceptually migrate to Pan, who is now the clearer tank kin target.

That migrated legacy cluster includes:
- Ironfur
- Intervene
- Adaptive Thorns
- Bulwark Roar
- Stone Guard
- Earthen Rebuke

### Core Hero Loop

Hero should reward both:
- steady successful local sequencing
- bad local boards that would otherwise stall a turn

This means Hero can feel good for a new player without collapsing into a passive-only safety net. Good Hero play should naturally bank stamina, and advanced Hero play can intentionally leave rough local tableau states in order to trigger recovery tools like `Dig Deep` or `Second Wind`.

### Current Playtest Direction

#### Heart of the Wild

After 4 successful Hero stock-adds, generate a `Heart of the Wild` into hand, up to Hero's current `Endurance` cap.

`Heart of the Wild` is not a separate subsystem resource. It is a branded in-hand Wild card. Its primary job is to extend Hero's local sequence when a single rank is missing.

In the current first-pass implementation, `Heart of the Wild` is represented as a Hero-only generated card that chooses the more promising adjacent rank when played.

#### Endurance

Every 4 turns, Hero gains `+1` maximum `Heart of the Wild` capacity.

This should make Hero feel better the longer a fight or run continues. It is a slow, visible stamina escalator rather than a sudden burst mechanic.

#### Second Wind

If Hero ends a turn with fewer than 2 successful stock-adds, generate a `Heart of the Wild`.

Cooldown: 2 turns.

This prevents weak turns from feeling empty and helps beginners recover from rough deals without needing deep system mastery.

#### Leader of the Pack

If Hero is the first party member to successfully act on a turn, all other party members gain `+1 AP`.

For now, this is intentionally simplified as bonus AP rather than kin-specific stat tuning. It makes Hero feel like an opener and keeps his leadership identity easy to understand.

#### Fetch

Return the most recently discarded non-Hero ally card back to that ally's hand. The returned card costs `0 AP`.

Scope-control note:
In the current playtest environment, true ally hands are not yet fully modeled as a separate recovered-card surface. The first-pass implementation approximates this by recovering the freshest non-Hero allied discard as an immediately reusable loyalty recovery card in the player hand space.

#### Momentum

While holding 2 or more `Hearts of the Wild`, Hero gains `+1 damage` per held Heart.

Bonus:
- Hero cannot be slowed
- Hero cannot be stopped

Momentum should create a clean tension between:
- spending Hearts to keep a sequence alive
- banking Hearts to become a stronger closer

#### Dig Deep

If Hero starts a turn with no Hero-only legal tableau moves, generate a `Heart of the Wild`.

This is an anti-brick passive and a major part of why Hero can support both new players and advanced players. New players get relief from bad boards; advanced players may eventually learn how to exploit poor local tableau setups intentionally.

#### Trail Sense

After Hero consumes a `Heart of the Wild`, apply a minor temporary guidance buff.

This should stay intentionally small. Hero is not a foresight specialist. The effect should feel like instinct, not prophecy.

Current first-pass direction:
- consuming a Heart briefly sharpens Hero's next follow-up line
- avoid turning this into a solver-style oracle mechanic

#### Vice Grip

`Vice Grip` is Hero's primary direct combat-tableau bridge ability.

When played on an enemy prime:
- the enemy may only access the three tableaus directly in front of the prime on its next turn

When played on an enemy support:
- that support is stunned on its next turn

This keeps Hero physical and hands-on. He is not just a passive endurance engine; he can also clamp the fight into a narrower, more manageable lane.

### Hero Summary Line

Hero is the starter husky kin: a loyal pack leader who banks endurance as Wild-card momentum, rescues weak turns, helps the whole party move first, and turns steady effort into reliable sequence extension.

### Support Square Prototype

Feature-fork scenario note:

This prototype reimagines the current Golf scenario around a much stronger distinction between the prime and supports.

In this fork:
- Hero remains the only true stock
- supports are represented as square modules instead of stock cards
- supports no longer receive tableau cards directly

### Kin Sticker Zoology

Current prototype direction:

- collected kin are represented as stickers instead of full support decks
- stickers sit in square reserve slots around the prime
- each sticker has:
  - a kin species
  - a playing-card rank
  - a base element
  - an optional augment element
  - a rarity tier

The starter zoology for the current prototype is:
- Jet
- Whis
- Pan

Duplicates should combine upward into rarity rather than cluttering the reserve with repeated identical kin. In the current first-pass model, multiple copies of the same kin increase sticker rarity, which should be reflected visually with shinier holo treatment.

This keeps collection readable and playful:
- stickers are fun
- rarity reads instantly
- a stronger sticker still occupies one simple reserve slot

### Reserve Card Rule

Kin stickers are not just passive companions. They can be committed directly into the prime stock as reserve cards.

When committed:
- the kin uses its sticker rank and current element
- the kin helps continue the active golf sequence
- the kin becomes temporarily unavailable

This creates the desired tension:
- spend a kin now to save or extend the line
- lose access to that kin until it is recovered

### Buried Recovery Rule

When a kin sticker is used, it should be buried back into the tableau rather than placed on a flat cooldown.

Current prototype direction:
- the used kin attaches to a hidden tableau card
- the player is told which column holds it
- when that host card resurfaces, the kin returns to the reserve

This keeps recovery inside the core golf loop rather than outside it. Used kin become future recoverable objectives, which strengthens both the creature-collecting fantasy and the solitaire board play.

### Starter Pack Scenario

Current fresh-run prototype direction:

- the board starts as a pure golf solitaire scenario
- the player has a persistent `Starter Pack` of four stock cards
- only one pack card can act as the active foundation at a time
- when the current foundation stalls or the player wants to reroute, they can cash it out and switch to a fresh unused pack card
- resetting the pack returns the encounter to stock `#1` using the same pack cards

This keeps the puzzle loop stronger than the collecting loop:
- the player learns a stable starting toolset
- the tableau changes, but the pack stays legible
- new kin discovery remains rare and satisfying rather than constant

### Element Augments

Element augments are a future-facing extension for kin stickers.

An augment element should modify the kin's current element identity without requiring full bespoke decks or large personal ability libraries. This adds room for collectible expression and light variation while staying much smaller in scope than full RPG-style kit expansion.
- supports trigger from the prime's collected elements and streak behavior

### Creature Expedition Direction

This fork is also the first pass toward a broader structural simplification:

`Golf solitaire first. Creature collecting second. Auto-battler reactions third.`

The long-term intent is that collected creatures should mostly interpret solitaire performance instead of becoming full RPG party members with deep bespoke combat kits.

The preferred creature schema is:
- `Trigger`
- `Payload`
- `Trait`

Example:
- Trigger: after a 4-card streak
- Payload: reveal the best path, deal damage, generate a wild, heal, etc.
- Trait: prefers certain elements, tableau states, or clear patterns

This should let the game expand through creature collection without requiring every creature to become a deck, a stat sheet, and a full active-combat actor.

Current prototype support:
- `Jet`
- `Whis`
- `Pan`

Current prototype sticker squares:

#### Jet `[J]`

- reserve sticker with rank and element identity
- can be committed into Hero's stock to save or extend a streak
- returns only after its buried tableau host resurfaces

#### Whis `[W]`

- reserve sticker with the same commit/recovery rule as the other kin
- also remains the current prophecy proof-of-concept
- after Hero has collected `fire`, `earth`, `water`, and `air`, available Whis can awaken `Prophecy`
- `Prophecy` drives the dedicated Navi guide-through for 5 optimal steps

#### Pan `[P]`

- reserve sticker with rank and element identity
- can be committed into Hero's stock to save or extend a streak
- returns through buried tableau recovery instead of a flat cooldown

This fork should be treated as a scenario experiment rather than a finalized systemic replacement.
