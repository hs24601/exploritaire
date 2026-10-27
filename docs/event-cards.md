# Tableau events

`Card.event` is shared by regular and travel tableaus. `eventCards.ts` owns event definitions, solution checks, and `spawnTableauEvent(columns, card, column, row)`. Rows count from the deepest card; the final array entry is exposed. Spawning inserts without deleting existing cards. Give each spawned instance a unique `Card.id`; resolution is idempotent by that instance ID.

Event definitions have `id`, `title`, `description`, `solutions`, and `effect`. Solutions are alternatives (OR):

- `{ type: 'wildcard' }`: any foundation, exposed only. Keeps its rank.
- `{ type: 'rank' }`: ordinary adjacent-rank play, including A–K. Uses the event card's printed rank.
- `{ type: 'utility', moves: ['Fetch', 'Dig'] }`: explicit rank-independent utility access. Fetch costs 2 AP and requires exposure; Dig costs current depth and may take a covered card. Utilities do not grant play AP. Current non-combat utility owner is Hero.
- `{ type: 'characteristic', anyOf: ['treeClimber', 'lumberjack', 'flight'] }`: any member of the receiving actor's current party may supply a matching tag. Tags accept an optional leading `#` and match without case sensitivity. Exposure is still required by default. Use this solution alone for a characteristic-only event; adding wildcard would permit either route.

`MOON_FRUIT_EVENT` is an exported authoring example with characteristic-only access and one mana reward. It is deliberately not assigned to an unrelated existing tile. Characteristics may be authored on `ProtoActorData` and are copied into `WorldActorState`; no character receives unapproved abilities automatically.

Effects currently support resource awards, notices, and travel SEARCH. Covered event cards always permit jumbo inspection; their execution actions appear only for a legal selected solution. The authoritative rule repeats validation when an action commits. Discarding is exposed-only, invokes no effect and grants neither AP nor resources. Discarded cards remain inspectable. The solver never chooses an optional event on the player's behalf.

## SEARCH tuning

Known free/easy cells default to three required travel plays. Authored card-count overrides remain supported. SEARCH appears alongside the active cell's normal deal once per day. It does not disable normal legal plays, combos, AP, foundation resets or supported solver actions. Only the transition beyond that cell waits if its work is finished while an event remains unresolved. SEARCH costs 1.5 STA immediately, suspends the remaining travel tableau, and deals four finite adjacent-rank cards starting from the receiving foundation. The fourth card bears one wood for woods, otherwise one mana. Ordinary AP and combo continuation apply to these four plays. The event itself preserves rank and earns neither AP nor distance. Finishing the search restores the exact remaining tableau; no route distance is earned while searching. Resolving or discarding an event early preserves the unfinished crossing work.

Discarding continues without spending stamina or breaking the combo. Same-day revisits keep their crossing puzzle but do not regenerate AP, pickups, SEARCH opportunities or mastery credit. `travelVisits` uses absolute grid identities and the game day, so another party or route cannot reroll the same opportunity. Game reset resets session progress. Future explicit reset events can extend this ledger; no elapsed real-time respawn is implemented.

Five fresh crossings of an easy terrain kind earn its Trail Familiarity and enable that terrain's travel Auto-Solve. Best Move remains available. Solvers skip optional events and keep making legal normal plays; they stop at a tile boundary that needs the player's event decision. Ambush combat and the early-warning mechanic are deferred by agreement; this version does not imply a hidden enemy roll.
