# Major element Keru options

Current visual direction: [creature redesign v2](./creature-v2.md). The former round spirit designs are superseded by mature animal-based creatures, including Dem and Cir. The gallery now includes all seven elements. Version-1 prompts and images below are historical; current subjects live in `artifacts/keru-creatures-v2/`, while scenery layers are reused.

Exploratory art and mechanics drafts, 2026-10-23. Live layered gallery: `/proto.html?kerusbx`. These are original class-archetype inspirations, not adaptations of a named RPG ruleset. Costs and effects are proposals, not combat implementation or balance approval.

Each option has a separate transparent watercolor character and opaque watercolor scenery layer in `artifacts/keru-drafts/`. TradingCard composes the actual title, cost, target badge, rules, depth and inspection foil. No flattened card artwork was generated. Exact prompts: [prompts.json](./prompts.json). The shared data is authored in `src/proto/keruDrafts.ts`.

## Comparison

| Element | Keru | RPG role | Hero binding | Mochi binding | Single-use invocation |
| --- | --- | --- | --- | --- | --- |
| Nature | Bri | Regeneration · patient growth | Rootmend · 3 | Bloom Claws · 4 | Verdant Shelter · 6 |
| Light | Sol | Wards · cleansing | Dawnguard · 3 | Clearstep · 4 | First Dawn · 6 |
| Dark | Vey | Life drain · weakening curses | Dusk Thread · 3 | Sable Sip · 4 | Nightwell · 6 |
| Chaos | Flux | Visible fortune · tactical adaptation | Lucky Current · 3 | Wild Paws · 4 | Wild Surge · 6 |
| Order | Axi | Cadence · measured control | Measured Flow · 3 | Patient Claws · 4 | Verdict · 6 |

## Shared proposal boundaries

- Each Keru is one unique entity. Bindings cost their target-specific Momentum, persist until recall or battle end, and can be recalled without a refund. Every new binding/invocation pays again. Invocation exhausts that Keru until fresh combat.
- Retain Dem's proposed one-Keru-per-Kin occupancy while comparing synergies; this is still a draft policy. All combinations below place the two bound Keru on different Kin. No Mind/Heart/Paw slots.
- Every damage packet respects applicable element defenses and ordinary stagger vulnerability. No new type-advantage wheel, universal light/dark opposition, hidden armor bypass, automatic elemental reaction or interaction with scripted phase gates is assumed. Scenario 006 keeps its required Cir sequence; none of these cards is added to it.
- Added packets, healing, Ward and curses do not generate builder receipts, AP, Momentum or proc chains. A damaging attack means ordinary resolved positive HP damage, unless its specific rule says otherwise. Multi-hit attacks count as one attack for these triggers.
- HP restoration caps at max HP, cannot revive, and does not substitute for finite mana/rest outside combat. Battle-only sustain requires real card/attack/turn events. No wall-clock healing or bonus growth.
- The oldest explicitly dispellable harmful status is the cleanse target. Disarmed, downed, stagger meters, authored armor and phase flags are not cleansed. Proposed control effects respect immunity.
- Per-turn allowances belong to the unique Keru's battle state and survive recall. Consumed rolls cannot be reset by rebinding. All pending bound effects clear on recall; counters clear where specified. New combat resets draft state.
- The gallery has an explicit Binding/Invocation selector to review ally-targeted invocation faces without confusing them with a binding. It previews expressions only, with no combat casts or persistence. Enemy is an abstract inspection target; the real encounter supplies its portrait when integrated.

## Bri — Nature

An ancient woodland stag with branching fern-and-wood antlers, moss at the shoulders and new growth along old bark scars. Bri feels patient and imposing, with living renewal rooted in an adult animal silhouette.

**RPG inspiration:** Druid regeneration and delayed bloom procs.

### Hero binding: Rootmend · 3 Momentum

Card text: **Every third valid Hero builder receipt restores 1 HP to Hero.**

Count actual valid Hero builder receipts while bound; every third restores 1 HP, capped at max HP. No overheal, revival or wall-clock healing. Recall clears the unfinished counter.

### Mochi binding: Bloom Claws · 4 Momentum

Card text: **Every third damaging Mochi attack adds 2 nature damage and restores 1 HP to Mochi.**

Count attacks whose ordinary damage resolves positive HP loss, once per attack even for multi-hit or added-element packets. On the third, add one mitigated 2-nature packet and heal Mochi 1 HP if she is living. Reset the counter after the proc; recall clears unfinished progress. The extra packet earns no AP, Momentum or new triggers.

### Invocation: Verdant Shelter · 6 Momentum

Card text: **Restore 6 HP to one living Kin. Reduce their next incoming attack by 2. Exhaust Bri for this battle.**

Targets: Hero or Mochi. Ally selectors are presentation scaffolding; where a rule says one living Kin or all living Kin, future integration should use the actual party roster.

Choose one living injured Kin or a living Kin without this pending shelter. Heal up to 6 missing HP. A single 2-point attack-reduction token persists until their next direct incoming attack or battle end. Apply it to total attack damage after mitigation, floor zero, then consume it; no stacking, revival, effect on retaliation, or turn denial.

**Synergies**

- Cir on Mochi + Bri on Hero: Rootmend sustains Hero while Ember Claws supplies reliable fire damage. Bri does not replace finite mana or out-of-combat rest.
- Dem on Hero + Bri on Mochi: slower Momentum decay supports saving for Verdant Shelter while repeated legal attacks build Bloom Claws.
- Verdant Shelter can protect the Kin drawing enemy attention; it does not change highest-AP targeting.

**Tradeoff:** Slow sustain loses value in short fights. Rootmend requires three paid-for-in-actions receipts per HP; Bloom Claws is delayed and can lose unfinished growth on recall.

**Checks before gameplay adoption**

- Verify multi-hit attacks advance Bloom Claws only once.
- Verify full-HP, downed and battle-end states; healing cannot revive.
- Check pending Shelter consumption on zero-damage attacks and multi-hit packets.

**Art layers:** [character](../../../artifacts/keru-drafts/bri-subject-v1.png), [background](../../../artifacts/keru-drafts/bri-background-v1.png).

## Sol — Light

A vigilant radiant crane with long legs, an ivory spear beak and luminous gold flight feathers. Sol has the composure of a watchful sentinel rather than a cheerful lantern mascot.

**RPG inspiration:** Cleric cleansing and paladin prevention.

### Hero binding: Dawnguard · 3 Momentum

Card text: **At each player team turn start, Hero gains 1 Ward, up to 2.**

No Ward on binding. At each real player-team-turn start, add 1 Ward to Hero, total cap 2 from all proposed sources. Ward is an HP-damage absorption pool after mitigation, used before HP, and never absorbs stagger. Consumed points are not HP loss. Rebinding cannot duplicate a turn-start event. Recall removes Ward granted by Sol.

### Mochi binding: Clearstep · 4 Momentum

Card text: **Mochi’s first damaging attack each turn cleanses one debuff from her; if none, gain 1 Ward (max 2).**

On Mochi's first attack with positive ordinary HP damage each player team turn, remove her oldest explicitly dispellable harmful status. If none exists, grant 1 Ward, capped at 2. Do not clear downed, Disarmed, authored armor/phases, pending damage already resolved, or stagger meters. Recall does not refresh the per-turn allowance and removes remaining Sol-granted Ward.

### Invocation: First Dawn · 6 Momentum

Card text: **Restore 3 HP and cleanse one debuff from each living Kin. Exhaust Sol for this battle.**

Targets: Hero or Mochi. Ally selectors are presentation scaffolding; where a rule says one living Kin or all living Kin, future integration should use the actual party roster.

The selected living ally anchors a team invocation, not multiple casts. All living party Kin heal up to 3 missing HP and lose their oldest explicitly dispellable harmful status. No revival or removal of Disarmed, stagger, encounter flags or authored phase defenses. Disable if no living Kin has missing HP or a dispellable debuff.

**Synergies**

- Cir on Hero + Sol on Mochi: Hearthflame's retaliation still responds to attacks against Hero, while Clearstep helps Mochi keep attacking through dispellable hindrances.
- Sol on Hero + Bri on Mochi: Dawnguard prevents damage and Bloom Claws repairs small losses; they cannot overheal or accumulate unlimited Ward.
- First Dawn offers a recovery choice at the same reserve threshold as Meteor: stabilize the team or spend on a finisher.

**Tradeoff:** Ward builds only at real turn starts and caps at 2. Cleansing is situational, so Clearstep has a small capped fallback. No new harmful status is silently added to existing encounters.

**Checks before gameplay adoption**

- Verify Ward consumption per attack, including multi-hit and zero damage.
- Ensure cleanse honors explicit dispellable tags and excludes Disarmed/phases.
- Check recall attribution when other future Ward sources exist.

**Art layers:** [character](../../../artifacts/keru-drafts/sol-subject-v1.png), [background](../../../artifacts/keru-drafts/sol-background-v1.png).

## Vey — Dark

A lean predatory panther whose hindquarters trail into indigo shadow. Vey's low stalking posture, long muzzle and pale narrow eyes communicate real danger; shadow and life-drain motifs remain part of its body.

**RPG inspiration:** Warlock curses and restrained lifesteal.

### Hero binding: Dusk Thread · 3 Momentum

Card text: **When an enemy attack costs Hero HP, weaken that foe’s next attack by 1. Does not stack.**

After actual HP loss from a direct enemy attack, put one nonstacking Weaken token on the attacker, if it accepts the debuff. Its next direct attack against any Kin loses 1 total damage after mitigation, floor zero, then consumes the token. Multi-hit is one attack. Retaliation, poison and self-damage cannot apply it. Recall removes outstanding Vey curses.

### Mochi binding: Sable Sip · 4 Momentum

Card text: **Mochi’s first damaging attack each turn restores up to 2 HP to her, limited by HP damage dealt.**

After Mochi's first ordinary attack with positive actual HP loss each player team turn, heal her by min(2, target's actual HP lost to that attack, Mochi's missing HP). Overkill does not count. Ignore retaliation and added Keru packets for the drain basis. No extra damage, overheal, revival or Momentum; recall does not refresh the allowance.

### Invocation: Nightwell · 6 Momentum

Card text: **Deal 5 dark damage. Restore up to 3 HP to the most injured living Kin, limited by HP damage dealt. Exhaust Vey.**

Targets: one living enemy. Ally selectors are presentation scaffolding; where a rule says one living Kin or all living Kin, future integration should use the actual party roster.

Resolve one 5-dark packet through applicable mitigation/vulnerability. Heal min(3, actual HP lost to the packet) to the living ally with the greatest absolute missing HP; ties use party order. Cap at max HP. If no ally is injured, damage still resolves. Cannot revive; damage immunity yields no healing. Exhaustion lasts for this battle.

**Synergies**

- Vey on Hero + Cir on Mochi: Dusk Thread softens repeat attackers while Ember Claws maintains pressure. A fully blocked attack does not create the curse.
- Sol on Hero + Vey on Mochi: capped Ward buys time while Sable Sip repairs Mochi's own losses; overkill cannot inflate healing.
- Dem's stagger opening can improve Nightwell's actual damage and its capped healing, without multiplying the healing cap.

**Tradeoff:** Reactive weakening requires taking HP damage first. Lifesteal needs a vulnerable living foe and benefits only an injured living recipient; armor and full HP limit its value.

**Checks before gameplay adoption**

- Verify overkill clamps and lifesteal based on actual HP lost.
- Ensure retaliation cannot loop curse or drain.
- Check Weaken immunity, multi-hit consumption and pending-token cleanup.

**Art layers:** [character](../../../artifacts/keru-drafts/vey-subject-v1.png), [background](../../../artifacts/keru-drafts/vey-background-v1.png).

## Flux — Chaos

A rangy storm-hyena with a high bristling mane, mismatched ember and violet markings, and a jagged tail. Flux is unruly and dangerous, with weather-like instability rather than a cheerful ribbon body.

**RPG inspiration:** Wild-magic outcomes and gambler resource swings, with a readable next outcome.

### Hero binding: Lucky Current · 3 Momentum

Card text: **Hero’s first builder receipt each turn gains +0 or +2 Momentum. The next bonus is visible.**

One trial per actual player team turn, triggered by Hero's first valid builder receipt while bound; add the visible bonus to the normal receipt. Equal-probability 0/2 results come from a per-battle seeded stream. Draw the next result only on consumption. Inspection, recall, rebinding, disabled casts and time do not reroll or refresh the per-turn allowance. No multiplying the bonus by other earnings modifiers.

### Mochi binding: Wild Paws · 4 Momentum

Card text: **Mochi’s first damaging attack each turn adds 2 chaos damage or 2 stagger. The next result is visible.**

On the first attack with positive ordinary HP loss each player team turn, consume the visible equal-probability outcome. Either add one mitigated 2-chaos packet, or add 2 stagger subject to immunity. One roll per attack, no trigger chains or Momentum. A blocked stagger result stays blocked; it does not convert to damage. The seeded outcome and turn allowance survive recall/rebinding.

### Invocation: Wild Surge · 6 Momentum

Card text: **Deal 4 chaos damage and 2 stagger, or 8 chaos damage. Preview the result before casting. Exhaust Flux.**

Targets: one living enemy. Ally selectors are presentation scaffolding; where a rule says one living Kin or all living Kin, future integration should use the actual party roster.

A separate per-battle seeded 50/50 result is visible from battle start. Casting consumes it: either one 4-chaos packet plus 2 stagger, or one 8-chaos packet. Normal defenses and control immunity apply. Inspection, cancellation, changing targets and rebinding cannot reroll. Exhaust Flux for this battle even if the result is mitigated.

**Synergies**

- Cir on Mochi + Flux on Hero: visible Lucky Current bonuses tell the player when an earned Momentum burst can help fund the next paid ability.
- Dem on Hero + Flux on Mochi: preserve reserve while adapting to Wild Paws' known damage/stagger outcome. Axi offers a deterministic alternative to this choice.
- Wild Surge's stagger branch can set up Cir's later Meteor; the 8-damage branch may finish immediately. Neither branch promises a universal advantage.

**Tradeoff:** A visible weak result is still weak. Forecasting makes variance a planning constraint, but removes neither armor nor stagger immunity. No random rank changes, card deletions or forced redeals.

**Checks before gameplay adoption**

- Prove all previews/cancel/recall paths preserve seeded outcomes.
- Consume the first-per-turn allowance once across multi-hit and rebinding.
- Verify previewed packets and resolved mitigation match; no outcome substitution.

**Art layers:** [character](../../../artifacts/keru-drafts/flux-subject-v1.png), [background](../../../artifacts/keru-drafts/flux-background-v1.png).

## Axi — Order

A massive adult tortoise with a balanced limestone shell and jade seams. Axi's heavy stance and severe watchful face suggest patient, unstoppable defense; orderly motifs follow real shell anatomy.

**RPG inspiration:** Monk combo cadence and tactician precision.

### Hero binding: Measured Flow · 3 Momentum

Card text: **Three consecutive Hero builder plays alternating up/down grant +1 Momentum. Then begin a new set.**

Count only valid Hero receipts while bound. Each receipt must be opposite in rank direction to the preceding one in the set; the first starts at 1. A same-direction Hero play restarts at 1. Another Kin's builder receipt breaks the set. On reaching 3, add exactly +1 shared Momentum and clear the set. K→A is up and A→K is down under normal wrap rules. Team handoff preserves progress; recall clears it. No timing requirement or altered golf legality.

### Mochi binding: Patient Claws · 4 Momentum

Card text: **Every second damaging Mochi attack against the same foe adds 2 stagger. Switching foes starts a new count.**

Count once per ordinary attack that causes positive HP loss. The second consecutive qualifying Mochi attack against the same foe adds 2 stagger, respecting immunity, then clears the pair. A Mochi attack against another foe starts a new pair; a zero-HP-damage attack breaks it. Other actors' attacks do not affect the count. Recall clears progress, and added packets/retaliation cannot advance it.

### Invocation: Verdict · 6 Momentum

Card text: **Deal 5 order damage, or 8 if the target is already staggered. Exhaust Axi for this battle.**

Targets: one living enemy. Ally selectors are presentation scaffolding; where a rule says one living Kin or all living Kin, future integration should use the actual party roster.

Read the target's staggered state immediately before resolution, choose a base packet of 5 or 8, then apply normal element mitigation and ordinary stagger vulnerability once. This is one packet, not 5+3 hits. Do not add stagger, bypass phase armor or force a response skip. Exhaust Axi for this battle.

**Synergies**

- Axi on Mochi + Cir on Hero: Patient Claws supplies measured stagger pressure while Hearthflame earns Momentum; either invocation can spend the prepared opening.
- Dem on Mochi + Axi on Hero: Rime Paws supports control while alternating Hero card decisions earn a bounded economy bonus.
- Sol's Ward can buy the team a safer turn to finish Measured Flow, but cannot make illegal card directions valid.

**Tradeoff:** Measured Flow asks the player to give up some long same-direction lines. Patient Claws commits Mochi to a foe. Verdict needs prior setup to equal Cir's base Meteor damage.

**Checks before gameplay adoption**

- Check A/K direction, actor interruptions, same-direction resets and three-play receipts.
- Check target switching, zero damage, defeat and multi-hit pair counters.
- Verify Verdict snapshots stagger before the packet and applies normal vulnerability once.

**Art layers:** [character](../../../artifacts/keru-drafts/axi-subject-v1.png), [background](../../../artifacts/keru-drafts/axi-background-v1.png).

## Tuning priorities

Cir remains the simple fire benchmark: Hearthflame earns +25% on Hero's builder receipts and retaliates for 1 fire per attack; Ember Claws adds 1 fire on Mochi's damaging attacks; Meteor deals 8 base fire for 6 Momentum. Dem supplies slower decay and control. The five new groups should earn their place by distinct decisions, not by exceeding every Cir value.

- Bri: evaluate how many actual receipts/attacks a fight offers before its delayed sustain can pay off.
- Sol: distinguish HP prevention from healing and stagger; future status tagging is required for cleanse.
- Vey: use actual post-mitigation HP loss, never nominal attack numbers or overkill, as the healing basis.
- Flux: Hero's bonus averages +1 per triggered turn, Wild Paws splits 2 damage/2 stagger, and Wild Surge averages 6 base damage plus 1 stagger before defenses. These expectations describe equal-probability proposals, not observed balance. Visible outcomes still require seeded implementation and counter-reset abuse checks.
- Axi: alternating rank directions must reflect legal golf choices; perfect cadence earns +1 per three qualifying receipts, and missing the cadence has a real opportunity cost. Verdict's condition is sampled before damage; its 8 base damage can still receive the game's ordinary stagger vulnerability once.

No gameplay tests can validate these mechanics yet because they are authored proposals. Browser checks validate only the presentation scaffold.

## Presentation validation

- `npm run typecheck` passed.
- Headless Chrome checked all five Keru and their Hero, Mochi and invocation faces at 1280, 390 and 320px (45 primary face/viewport combinations). Full effect text stayed inside each card and the gallery had no horizontal overflow.
- Verified separate subject/background controls, loaded assets, real transparent subject edges and near-opaque body paint, appropriate ally/enemy selector transitions, inspection tilt, bookmarked element selection, Dem navigation and scroll access to design notes. No page errors or failed asset responses were observed.
- Flux exposes selectable forecast examples in the scaffold; these are illustrative art-direction states, not gameplay rolls. Its seeded outcome rules remain proposals.
- Reviewed desktop and mobile screenshots. The game normally locks document scrolling; the gallery restores document flow only while its own root is present.
- Check script, screenshots and machine-readable report: `artifacts/keru-drafts/`. Generated PNG backgrounds use opaque RGB; subjects retain their generated RGBA alpha. Built-in ImageGen prompts are recorded in `prompts.json`.
