# Combat Stagger Mechanics

This note proposes high-level foundational mechanics for layering a stagger-driven combat payoff system onto Exploritaire's existing tableau and stock combat language.

## Foundational Mechanics

### 1. Tableau-to-Stock Conversion Creates Baseline Combat Pressure

When an actor converts tableau cards into stock, the actor that receives the stock gains access to a default **chip damage** attack.

This should be treated as a near-universal baseline for player actors. Elite and boss enemies should also commonly use chip damage as part of their combat kit, even if they express it through faction-specific abilities.

Chip damage does not directly remove HP on application.

Instead, chip damage builds a chip-damage meter on the target. This meter is overlaid on the target's HP bar component:
- armor is resolved first
- chip damage then overlays the HP layer rather than immediately depleting it

Chip damage has two jobs:
- build deferred damage on the target
- increase the target's stagger gauge

Chip damage remains inert until an activating ability is played. That activating ability should usually be a hand-card-style ability that cashes out the accumulated chip damage and applies the total stored value against the target at once.

Actors with especially strong AP generation or unusually efficient stock-building may need to trade away some chip damage output or stagger generation in exchange for that economy. This should be treated as a key balancing lever so high-engine actors do not automatically become the best stagger actors.

### 2. Stagger Phases: PRESSURED Before STAGGERED

Stagger should phase in through a lighter preliminary state before the full break window.

The intended baseline sequence is:
- chip damage and other effects build stagger gauge
- partial stagger pressure can apply **PRESSURED**
- a filled stagger gauge applies **STAGGERED**

From a UX perspective, the pressure/stagger gauge should draw as an incrementing rectangular shape around the exterior of the `actorFrame`. Each enemy can define its own threshold, and a full completion of that perimeter gauge applies **STAGGERED**.

**PRESSURED** should be a lighter warning state that signals growing instability without fully shutting the target down.

This gives the system:
- clearer combat readability
- more room for actor specialization
- more tuning space between setup and payoff
- better boss design control

Specific kits can then interact differently with the stagger ladder:
- some actors build **PRESSURED** quickly
- some actors convert **PRESSURED** into **STAGGERED** efficiently
- some actors extend **STAGGERED**
- some actors gain bonuses specifically against **PRESSURED** or **STAGGERED** targets

### 3. STAGGERED as the Full Break State

When a target's stagger gauge is filled, the target receives **STAGGERED**.

**STAGGERED** should function as a debuff state with a tunable set of effects. The baseline expression may include:
- stun or action interruption
- reduced stats, especially `DEFENSE`
- AP loss
- random card discard from hand
- increased brittleness for a fixed number of turns

Because the current hand model is still notional, any hand-related stagger effects should be treated as forward-looking design placeholders until a real hand construct exists in the combat framework.

## Core Tuning Knobs

The stagger system should be parameterized so different actors, enemies, and encounter tiers can express it differently.

Key tuning knobs:
- `stagger_duration`: how long **STAGGERED** lasts
- `stagger_sunder`: how much `DEFENSE` is reduced during **STAGGERED**
- `stagger_AP_loss`: how much AP is removed when stagger lands
- `stagger_hand_effect`: how many cards are randomly discarded from hand when stagger lands

These knobs should be mixed per enemy profile rather than assumed to all move together. A target can be highly vulnerable to `stagger_sunder` without also suffering a large `stagger_AP_loss`, for example.

## AP Scaling and Risk-Reward

The higher an enemy's AP meter is when stagger is applied, the more impactful that stagger event should be.

This creates a deliberate risk-reward tension:
- players can cash in stagger early for safety
- players can delay stagger investment while the enemy builds AP
- waiting creates more danger, but also raises the payoff when the stagger lands

This should not be tuned in isolation. Its balance depends directly on:
- whether enemy hand effects are actually modeled
- whether high-AP actors are paying enough opportunity cost for their stagger output
- how severe the AP-loss and control effects become on bosses and elites

This means stagger should not be valued only as a control effect. It should also become a timing mechanic that rewards reading enemy tempo and choosing when to convert setup into disruption.

## Enemy Stagger Profiles

Enemies should not all respond to stagger the same way.

Different enemy archetypes can expose different weaknesses:
- heavy enemies may resist long stun durations but suffer large `stagger_sunder`
- casters may lose queued actions, spells, or AP when staggered
- agile enemies may recover quickly but be easier to push into **PRESSURED**
- elites may require more commitment to fully break but expose stronger punish windows

This keeps stagger from feeling like a single universal checkbox and makes enemy classes more legible in battle.

## Boss Rules

Bosses should rarely lose an entire turn for free just because the stagger gauge filled.

A boss stagger should more often create an interrupt-and-expose window rather than a total shutdown. This preserves the payoff while avoiding encounters that collapse once the player can loop stagger efficiently.

Boss-specific stagger outcomes may include:
- interrupting the current action
- canceling a charged attack
- applying a strong `stagger_sunder`
- stripping AP without full stun
- briefly exposing a vulnerability window

## Specialist Actor Design

Default actors should participate in stagger through normal sequencing, but the strongest extension tools should belong to dedicated specialists.

Specialist actors may focus on:
- building stagger rapidly
- converting **PRESSURED** into **STAGGERED**
- extending `stagger_duration`
- increasing `stagger_sunder`
- amplifying payoff against already staggered targets

This preserves a readable baseline loop while ensuring that prolonged lockout patterns are earned through kit identity rather than granted for free to every efficient actor.

## Intended Combat Texture

This system should make stock gain feel like more than passive sequencing progress. Converting tableau into stock becomes a direct route into battlefield pressure, and repeated low-damage actions build toward a larger control-and-burst window.

In practice, this should produce a combat rhythm of:
- sequence into stock
- apply chip damage
- build toward **PRESSURED**
- choose whether to push immediately into **STAGGERED** or wait for a higher-AP punish window
- capitalize on the break with focused damage, denial, or tempo swing
