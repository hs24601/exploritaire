# Glossary

## Markdown Rules
- Bold effect names when they appear in-game documentation.
- Color effect references the same magenta/fuchsia used for effect-name titles in-game.
- Italicize flavor text.

## AC (Attunement Cost)
- `AC` is the Attunement Cost of an Orim.
- It represents how much attunement budget the Orim consumes when equipped.
- Example: `Ice` has `AC: 1`.

## Action
- An `Action` is an interaction between an actor and the game world.
- Current action examples include tableau-to-prime plays, tableau-to-tableau plays such as `Rewire`, and ability-card plays unless that ability explicitly says otherwise.

## Buff / Debuff Listeners
- Buffs and debuffs can register listeners against gameplay events.
- A listener watches for a specific trigger such as an `Action` event and updates the effect when that trigger resolves.
- When a buff or debuff is affected by its listener trigger, its status chip should play a small flash at the exact moment the triggering event happens.
- This flash is required feedback for listener-driven effects, not an optional polish pass.

## Combat Doc
- Detailed pressure, stagger, collapse, and signature combat notes live in [COMBAT.md](C:/dev/Exploritaire/docs/COMBAT.md).
- Update that file whenever combat rules or combat-facing signature behavior materially changes.

## FELIS
- `FELIS` is a kin family taxonomy.
- FELIS kin come with the **Nine Lives** passive by default.

## Nine Lives
- *Not actually nine, but so uncanny are Felis kins' ability to narrowly escape death that the effect has been exaggerated.*
- Effect: when fatal damage would be received, set HP to `1` and apply **Narrow Escape** and **Skittish**.
- Resets on long rest.

## Narrow Escape
- *Avoided a cat-astrophe*
- Effect: `Evasion +20%` while HP is `1`.

## Skittish
- *Scared. of. Everything*
- Effect: cannot swap to prime position for `5 actions`.
- Listener: `Action` event.
- Behavior: when any action is taken, **Skittish** consumes that event, updates its remaining duration, and its debuff chip should flash at that exact moment.
