# Woods spell slice · v1

Temporary `portals.html?combat` spell-design test, authorized 2026-11-16. The separate stellar page and legacy encounter stay independent.

**Current interaction revision:** [Cornerstone constellation charging](../design/woods-spell-constellations.md) supersedes the original interaction/validation account below. Abilities are placed in the starfield; combatants stay out of the cosmos; four cornerstone receipts are required to cast; later stars add complete local motifs. Target selection returns to the actual Woods actors. The original art assets, source prompts and alpha remain unchanged.

## Authored assets

Generated with the built-in ImageGen tool. Every call included the actual Hero berry painting as primary style input and Scratch as supporting light-palette/merged-brushwork input. The supplied orange Fireball supplied silhouette only. The supplied button reference rendered entirely black; the alternative is a readable three-card watercolor fan.

- Runtime Fireball: `public/assets/runtime/spells/fireball/v1/fireball.png`.
- Runtime hand icon: `public/assets/runtime/ui/spells/hand-fan-v1.png`.
- Exact Fireball prompt, reference roles and digest: [source manifest](../../public/assets/sources/spells/fireball/v1/manifest.json).
- Exact hand-icon prompt, reference roles and digest: [source manifest](../../public/assets/sources/ui/spell-hand/v1/manifest.json).

Masters and runtime copies are byte-identical; original alpha is retained. Sampled source alpha spans 0–254 (Fireball) and 0–253 (fan). No color key, automatic background removal or procedural substitute. Both original drafts were reviewed beside the supplied paintings, then reviewed on the live dark cosmos at hand/card scale. Broad warm paint masses and split flame tongues remain legible. No baked lettering, card UI or scenery. Blizzard/Bite/Star use simple existing-style symbols for this draft, rather than claiming additional generated spell artwork.

## Initial interaction and validation (superseded)

The shared ability fan layout and styling display four simple abilities. Hostile cards target Khadroot; Star supports Hero. Opening the hand fades the Woods into a bounded shader cosmos. Original live actor objects are temporarily borrowed for isolated render passes and restored in `finally`; the world positions, resources and legacy encounter state are untouched. The upward camera flight is smooth, with reduced-motion snapping and restoration of its prior position on exit.

Dropping a card on an eligible actor starts charging, rather than applying damage. The same shared grid engine provides foundation selection, alternating directional backfill, best-card shimmer, stock reselect and exact Ctrl tap/hold semantics. Successful receipts alone add +1 power. Fireball's first node is the leading tip, its second is the far tail, followed by silhouette notches/tongues/core. Its charged card can be dragged onto Khadroot at any time, including zero receipts. Fireball starts at 1 fire damage. There are no receipt chips, AP or automatic enemy attacks. Test HP is local to this scene session, with a 10-HP Khadroot and 32-HP Hero; it does not alter a saved journey.

Actual checks:

- TypeScript passed.
- Four focused test files / 14 tests passed (including the archived duplicate hand-layout suite collected by Vitest).
- Initial headless Chromium run passed the desktop hand/hostile drag, intermediate smooth-flight progress, foundation selection, exact one-step Ctrl taps, hold/release, no receipt damage, charged cast damage, Pause/Resume and exact camera/world actor restoration. It then found a narrow-hand selection/layout failure.
- One corrective headless run passed bottom-fan placement, bounded constellation canvas, readable narrow two-row hand, visible targets, zero-receipt Fireball and Star casts, reduced-motion entry and no runtime errors. Screenshots reviewed at 1432×900 and 390×844. Browser setup through final screenshot review stayed below the five-minute budget; no third run was performed.
- Screenshots: `output/woods-spell-hand.png`, `output/woods-spell-charge.png`, `output/woods-spell-charge-layout.png`, `output/woods-spell-hand-narrow.png`, `output/woods-spell-charge-narrow.png`.

Physical touch hardware, controllers inside the spell overlay, long-session balance, and production ability art for the three sibling cards were not tested. Pointer events support mouse/touch/pen; controller movement remains suspended while the slice owns the scene. Final code changes skip Woods draw calls once the cosmos is fully opaque and use simple sibling-specific star/snowflake/jaw scaffolds and symbol projectiles; they were typechecked after browser validation rather than given an extra browser run. Fireball retains its actual painting and registered silhouette scaffold.
