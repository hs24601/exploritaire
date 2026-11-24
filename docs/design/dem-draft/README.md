# Dem — ice Keru draft

Status: exploratory proposal, 2026-10-23. Name, artwork, costs and mechanics are drafts; no runtime integration or standing baseline change. Built-in ImageGen produced separate character and background assets; the flattened card study is rejected. Presentation scaffold: `/proto.html?demsbx`. Neither balance nor interaction has been playtested.

## Identity

**Dem** (pronounced “dem”), the Stillwater Keru. The current v2 design is a mature glacial polar bear with a frozen shoulder mantle, ice claws, small watchful eyes and a formidable natural stance. This supersedes the snow-pearl mascot. The separate frozen woodland background is retained. See `../keru-elements/creature-v2.md` and `artifacts/keru-creatures-v2/dem-subject-v2.png` for the new design.

Cir kindles resources and turns attacks into fire; Dem preserves resources and creates a measured opening. Ice should support deliberate card decisions without changing ordinary golf legality, granting free cards or rewarding waiting.

## Proposed target-dependent card faces

One unique Dem card changes its cost, effect and upper-right target portrait with the selected target. These are expressions through Kin, not equipment slots.

| Target | Expression | Cost | Proposed rules text |
| --- | --- | --- | --- |
| Hero | Stillwater | 3 Momentum | Halve passive Momentum decay while bound. |
| Mochi | Rime Paws | 4 Momentum | Mochi's first damaging attack each player team turn deals +1 stagger. |
| Enemy | Winter Hush | 6 Momentum | Deal 4 ice damage. Freeze this enemy's next response. Exhaust Dem for this battle. |

Stillwater affects the shared reserve: current combat decay becomes 0.25/s instead of 0.5/s. It grants no Momentum, does not compound with itself, and preserves existing pause/clock behavior. Apply a single 0.5 multiplier to the otherwise applicable passive decay; a disabled/frozen decay remains zero. Spending is unaffected.

Rime Paws triggers once per player team turn on an attack that resolves positive HP damage, after ordinary attack resolution. It adds no HP damage, separate hit, builder receipt or Momentum. Extra fire damage from Ember Claws cannot trigger another proc. It cannot stagger an immune enemy. Recall/rebinding does not reset its per-turn allowance.

Winter Hush is a targeted, one-invocation-per-battle ability. Resolve its 4 ice damage through applicable defenses and vulnerability, then apply one pending response skip if the living enemy accepts freeze. The skip consumes the next response opportunity; it does not stack or queue with an already pending stagger/control skip. Control-immune enemies still take applicable damage but do not skip a response. No persistent ice vulnerability or automatic fire/ice multiplier is proposed. Dem exhausts even if defenses reduce the result. Target and affordability validation happen before spending.

## Lifecycle and presentation

- Bindings persist until recall or battle end. Recall removes the effect, restores the unique card and refunds no Momentum. Every subsequent use pays the selected target's full cost. Invocation exhausts Dem until fresh combat.
- Initial proposal: at most one Keru bound to any one Kin at a time. Cir and Dem can support different Kin simultaneously. A paid change on the same Kin requires recalling its existing Keru first. This occupancy rule is a proposal requiring design acceptance, not an inferred existing rule.
- Use the shared 63:88 TradingCard framework: opaque readable rules panel, painted night background, separate subject layer, inspection tilt/parallax and inspection-only foil. Static reduced-motion view. The preview uses TradingCard with separate background/subject layers, target selectors and layer visibility controls. It does not cast abilities.
- Keep the shared warm Spiraling Ember for Momentum costs; ice coloring identifies Dem, not a new currency. Target badge uses actual approved actor emoji/foe portrait in implementation. The generated Hero badge is illustrative only.
- No Mind/Heart/Paw slots, idle foil shimmer, bottom availability copy, per-card drag instruction or familiar-duration boilerplate.

## Proposed synergies

**Cir on Hero + Dem on Mochi:** Hearthflame retains its current +25% Hero builder earnings and 1-fire retaliation per attack against Hero. Rime Paws helps Mochi reach a normal stagger opening; Cir can later be recalled and invoked as Meteor into that opening. All binding and invocation costs still apply.

**Dem on Hero + Cir on Mochi:** Stillwater preserves more of the shared reserve between valid card plays while Ember Claws adds fire to Mochi's damaging attacks. The player trades Hero's Cir generation bonus for slower decay; neither Keru is duplicated.

**Winter Hush into a planned offensive turn:** spend 6 to secure one enemy response skip while retaining the ability to arrange the next card sequence. Cir's Meteor supplies the stronger 8-fire finisher. Hush costs resources and Dem's remaining utility; it does not generate the resources for Meteor.

**Sticky Paws:** Hush can provide breathing room to exploit an exposed card, but grants no adjacency exception. If Disarmed or another control already denies the next response, the skips overlap rather than creating a chain of banked lost turns.

## Balance checks before adoption

At ordinary 0.5/s decay, Stillwater saves 0.25 Momentum per active decay second. Its 3-point binding cost takes 12 seconds of actual draining reserve to recoup, ignoring opportunity cost. This is a tuning estimate, not a playtest result. Waiting still loses reserve.

Test Rime Paws against low stagger thresholds and multi-hit attacks; keep the once-per-team-turn cap across recall. Compare Winter Hush against Meteor and control immunity, especially existing authored scenarios. Scenario 006's required Cir sequence must remain intact; do not add Dem to it by default. Revisit costs, control overlap and same-Kin occupancy before implementation.

## Deliverables

- `../../../artifacts/dem-draft/dem-watercolor-v1.png`: standalone transparent character draft.
- `../../../artifacts/dem-draft/dem-background-v1.png`: standalone watercolor scenery layer. The previous `dem-ability-card-v1.png` is rejected and unused.
- `prompts.txt`: exact built-in ImageGen prompts and reference roles.

Validation: typecheck passed. Headless browser checks passed at 1280px and 390px for separate layer visibility, loaded images, all three target faces and unclipped full rules text, with no page errors. Reviewed the mobile scaffold screenshot. Combat mechanics remain unimplemented and untested. Background prompt: `background.prompt.txt`.
