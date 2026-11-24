# Recommended method: routing by player knowledge

Requested 2026-10-14. Implemented in travel routing and safe-Cairn checkpoints. Unknown cells provisionally cost 1 STA and seven neutral travel cards.

## Authored terrain passage exception (2026-10-15)

Explicit single-cell passages can cross otherwise impassable terrain along their authored east–west or north–south axis. The perpendicular faces remain blocked before and after breach. Unknown passages retain the uniform provisional route and cost; discovering a route through a forbidden face halts at the safe Cairn as usual. Discovering a legal approach replaces neutral work with an isolated obstruction stage, before charging any crossing work. A matching assigned ability spends the displayed AP to open that passage, revealing its tile-local deal without earning distance or rewards. The live tile retains its breach for return journeys until restart; authored saves exclude this session flag. Replanning or cancelling from the obstruction retains the safe approach and earned resources. All other mountains retain the original rules below.

## Plan with what the actor knows

Keep physical terrain truth separate from the actor's discovered map. Automatic routing and manual waypoint validation use the discovered map. An unknown cell is provisionally traversable at a uniform baseline cost, regardless of its hidden terrain, flags or rewards. Choose the shortest legal route under that knowledge, breaking equal-distance choices by known traversal effort. Known impassable cells and the table boundary remain blocked. Hidden obstacles must not influence diagonal corner checks either: otherwise the route would disclose their locations.

Unknown portions use a neutral dashed route rather than a terrain difficulty color. Their estimates use the same provisional traversal/card budget and explicitly say that unknown terrain may change the route and cost. Do not expose hidden mountain titles, real difficulty, reward icons or terrain-specific travel-card artwork through the preview or seeded tableau.

## Discover and validate at Cairns

Every completed grid crossing is a navigation checkpoint, including automatic zero-cost crossings. At a safe Cairn, apply the actor's normal adjacent discovery rules and revalidate the remaining proposed route using the newly discovered map before authorizing another crossing. Artwork filling remains tied to traversal progress; knowing that a mountain is impassable must not depend on finishing its paint animation or solving its tableau.

If discovery reveals a newly impassable cell on the remaining path—or a blocked corner needed by a planned diagonal—halt at that safe Cairn. Never enter the obstacle, animate through it, assign its foundation, or spend stamina for it. Movement animation and Auto-Solve must observe the same halted state. Checkpoint processing cannot skip cells during fast travel, long frames or zero-cost stretches.

For the example, the initial proposal may cross unknown (2,2). Once a safe adjacent Cairn reveals (2,2) as an impassable mountain, stop there and invalidate the remaining proposal. Reveal (3,2) only if it independently meets the existing discovery radius; do not reveal the entire obstacle region merely because one member was found.

## Prompt the player to replan

Show: “Path blocked — an impassable mountain was discovered at (2,2). Plan a new route.” Mark the discovered obstacle and distinguish the invalid remainder from the earned trail. Keep the original destination, open waypoint editing from the actor's halted grid, and disable OK! until the replacement path is legal and affordable. X cancels the remaining journey and leaves the actor at the Cairn; it does not rewind travel. If no legal route is known, permit a different destination or cancellation.

Keep completed cards, stamina expenditure, AP and collected rewards exactly once. Retain earned progress in the current tile. Suspend unused travel cards while replanning; after confirmation, rebuild only the untraversed work for the replacement route. Do not award pickups on discarded cards, refund completed movement or replay reward milestones. An interruption breaks travel streaks without removing rewards already earned. Recompute the remaining estimate against the actor's remaining STA and charge no replanning fee.

## Required validation

- Unknown mountains produce the same initial route and estimate as other unknown cells.
- Known mountains block automatic paths, manual waypoints and diagonal corners.
- Revealing a mountain on the remaining path stops at a safe Cairn, before entering it or spending its traversal cost.
- Discoveries off the proposed route do not interrupt an otherwise legal journey.
- Zero-cost crossings, Auto-Solve and skipped animation frames cannot bypass checkpoints.
- Replanning preserves completed progress/resources and awards no duplicate pickups or streak bonuses.
- Cancellation leaves the actor at the halted Cairn; confirmation resumes toward the retained destination on the replacement route.
- Mouse, touch, keyboard, OTT and immersion display the same knowledge and interruption state.
