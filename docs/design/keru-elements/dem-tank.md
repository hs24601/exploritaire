# Dem — tanking kit proposal

Dem is named in reference to Demeter and uses **they/them** pronouns. Their approved storybook art and natural-pose study are unchanged by the rename. Current gallery: `/proto.html?kerusbx&element=ice`; standalone alias: `/proto.html?demsbx`.

The two user concepts below establish the direction. Costs, numerical limits and detailed resolutions here are recommendations for playtesting, not implemented mechanics. Dem needs their own combat actor/foundation: attaching the old effects to Hero or Mochi is not this design. The former Stillwater/Rime Paws/Winter Hush kit is superseded in the visible catalog and retained only in historical draft data.

## Ice Wall — user concept

Self-buff. While active, Dem does not perform the automatic attack associated with receiving a foundation card. Instead, each card added to their foundation increases the ice-wall barrier by 1 HP. Their ordinary Momentum generation continues.

Naming options: **Rime Rampart** (recommended), **Winter’s Bulwark**, **Permafrost**, or the straightforward **Ice Wall**.

Suggested resolution:

- Count an actual legally received new card, not any arbitrary Momentum gain. A redraw or repeated transfer of one card must not farm the wall. A per-activation received-card ledger can enforce this.
- Begin at 0 barrier; try a 10-HP cap and 3 Momentum activation cost. These are tuning suggestions. Do not retroactively count the existing foundation stack.
- Barrier absorbs incoming attack HP damage before Dem’s HP. It does not automatically block stagger, pay self-costs or grant immunity.
- At zero barrier, the stance remains active so the next card can rebuild it. Allow explicit cancellation; no refund or stacking multiple walls. Decide cancellation cleanup before implementation.
- Suppress only automatic receipt attacks and their attack/on-hit triggers. Manual ability casts remain available, making Glacial Reprisal possible while defending.

The opportunity cost is the attacks Dem sacrifices. A taunt makes that sacrifice useful to the whole party rather than only Dem.

## Aurora Bearealis — user concept

**Light / Ice.** Illuminate the encounter and reveal all tableau cards for 2 turns, including cards backfilled during that window. Enemies affected by the aurora gain **Exposed**, adding a 25% critical-strike chance to attacks against them.

Keep **Aurora Bearealis**. More serious alternatives: **Polar Revelation** or **Light of the Long Night**.

Suggested resolution:

- Reveal information about covered cards without removing their coverage, root bindings, or normal play restrictions. Only newly exposed cards become playable under the usual rules. New backfills are immediately known while the aurora lasts.
- Scope illumination to this encounter; it does not automatically reveal world-map fog or grant permanent exploration light.
- Use one explicit duration clock for light, reveal and Exposed. Recommended definition: expire after the second enemy response opportunity following the cast. Skipped responses count; pause and inspection do not.
- Define the bonus as **+25 percentage points** to attack crit chance, capped at 100%. Reapplying refreshes rather than stacks the same Exposed source. With no base crit chance, this is 25% total.
- Try **1.5× HP damage** on a crit, with no bonus stagger. One seeded crit roll per attack/target; multi-hit and added-element packets share that result. Retaliation, damage over time, barrier building and self-costs do not crit. This gives roughly +12.5% expected attack damage before defenses if the base crit chance is zero.
- Decide whether incoming enemies enter the ongoing aurora; recommend yes for consistency with new backfills. Respect explicit encounter immunities. Preview eligibility clearly.
- Start testing at **5 Momentum**. Information plus team-wide crit support may be stronger in a long or heavily covered tableau; tune duration/cost after observing it.

## Recommended addition: Polar Presence

Self-buff / taunt. For 2 turns, eligible enemy single-target attacks prioritize Dem. Proposed cost: **2 Momentum**.

This gives Ice Wall a party-protection role. It neither cancels attacks nor changes area attacks into single-target attacks. Dem must remain a living eligible target; authored targeting locks and taunt immunity win. Use Aurora’s duration clock. Alternatives: **Bear Down**, **Winter’s Challenge**, **Stand Behind Me**.

## Recommended addition: Glacial Reprisal

Target one enemy. Spend **1–6 barrier HP** to deal the same amount of ice damage and add **2 stagger**. Proposed cost: **4 Momentum**. This is an instant cast, not automatic battle exhaustion.

It turns stored defense into an active decision: finish a dangerous foe or keep the wall intact. Require at least 1 barrier HP; choose the spend before commitment, resolve through normal defenses, and spend the committed barrier even if damage is mitigated. It is a manual attack and can benefit from Aurora’s crit chance; the 2 stagger does not crit. It does not automatically end the defensive stance. Alternatives: **Avalanche Answer**, **Shatterback**, **Cold Reprisal**.

## Playtest loop

Raise the wall → draw enemy pressure → use Aurora to plan card sequencing and enable allied damage → decide whether a Reprisal is worth losing barrier. This gives Dem distinct defense, threat control, team utility and a conditional finisher without making every card both an attack and a shield.

The four visible gallery cards are proposals. No Dem actor, barrier, illumination, crit or taunt resolution has been added to combat. Unlock rules remain future work.
