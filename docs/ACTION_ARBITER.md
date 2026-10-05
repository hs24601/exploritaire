# Action Arbiter

`src/engine/combat/realtimeArbiter.ts` owns delivery timing and conflict order. It is deliberately independent from combat resolution, React, and card animation.

## Flow modes

| Mode | Queue ownership | Arrival behavior |
| --- | --- | --- |
| `turn_based_pressure` | Active side only | Existing fixed turn budget; pause remains fully supported. |
| `rolling_initiative` | Active side only | A successfully resolved card resets that side's rolling deadline. Expiry passes initiative. |
| `real_time_shared` | Both sides | Tickets resolve by arrival, then submission time, sequence, and id. |

## Delivery contract

1. Queue an action when a card begins transport, supplying a stable source key such as `tableau:3:card-17`.
2. The arbiter reserves that source until its ticket resolves.
3. Advance it from the application clock. The caller resolves each arrived ticket by revalidating the source, target, actor state, and card legality.
4. Return `interrupted` when a target is defeated, crowd-controlled, unavailable, or the card is no longer the exposed source. The reservation is released without mutating game state.

The arbiter owns ordering; game-specific systems own the actual card move, ability effect, animation, and announcement.

## Non-combat use

- Foraging and chopping: use `turn_based_pressure`, or set `paused` while presenting a non-urgent choice.
- Fishing and other timed gathering: use `rolling_initiative` with no enemy producer. Timely successful plays refresh the yield window; expiry can lower yield, end the cast, or change the fishing state.
- Shared-world hazards: use `real_time_shared` only when two independent producers can claim the same sources. Every producer must use source keys so collisions stay deterministic.
