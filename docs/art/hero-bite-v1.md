# Hero Bite holocard · v1

Two built-in ImageGen character paintings: portrait 1024×1536 and landscape 1536×1024. Identity and brushwork reference: approved `hero-watercolor-v5-ordinary-day.png`. The landscape generation also referenced the new portrait to retain the same bite action. Hero is the small tricolor corgi-like dog, amber-eyed, with charcoal/tan/cream markings and a short bobtail. A lunging three-quarter snap, small canine teeth, forward forepaws and cream/gold/charcoal tapered jaw strokes make the action readable. No victim or gore; no text, card frame, scenery or UI in the subject paintings.

Both generated PNGs and their transparency are retained without raster edits. Byte-identical runtime and source copies plus dimensions/SHA-256 are recorded in `public/assets/sources/ui/holocards/hero-bite/v1/manifest.json`. Browser canvas inspection confirmed transparent outer pixels. The generated soft pigment/glow edges are retained.

The shared BiteFace renders a diagonal-holo TradingCard with the new subject over the existing independent painted background, plus live title, value, cost and damage copy. Portrait is the default for hand, drag, foundation and jumbo. `orientation="landscape"` selects the separately composed landscape asset for wider future placements.

On musicaltableaus only, Hero's foundation now has a 63:88 playing-card silhouette (84–126 px wide responsively). It uses the Bite holocard instead of the previous emoji portrait/name row, keeping live full-width HP and AP pips. The value is absent until Bite is equipped; receipts and attacks retain their existing handlers. The smaller foundation renders its card face at half scale to keep title/cost/badge layout coherent; detailed damage copy remains available in the hand/jumbo. Encounter descriptions/notes are removed from the scene, with encounter choice retained inside config.

Validation: typecheck; desktop/mobile browser equip, two legal receipt charges without automatic damage, 1-AP cast/reset and repeated mobile equip. Browser assertions check 63:88 ratio, no foundation emoji, no scene notes, current art loading and full-width HP. Reviewed screenshots: `output/musical-bite-charged.png` and `output/musical-bite-mobile.png`.

## Landscape row revision

The musical foundation now uses the landscape artwork at 88:63 proportions (126–176 px wide). The Bite hand card is removed: Bite begins equipped at value 2 and resets there after attacking. Remaining persistent hand cards align on the foundation centerline with no fan rotation; their authored `--hand-top` overrides modal top placement, and the row reserves footer clearance. Browser fixture checks added two reward cards at 390×844 and 1440×900 and confirmed their centers match the foundation without entering header/footer control areas.
Bite is now free: no AP cost or cooldown, including repeated use at zero AP. Each accepted tableau card adds +1 base damage to the next cast. Casting consumes that accumulated bonus and resets to base damage 1/value 2. The card's former AP bubble now shows live base damage. Rule tests and browser checks cover charging, unchanged AP, repeated zero-AP casting, and no cooldown delay.

## Readability and rarity finishes

Bite no longer renders an AP meter. The name, tableau VALUE and live DAMAGE panels are larger, and HP uses bold 16px text in a full-width bar eight pixels below the holocard. The card frame is four rendered pixels thick. Config → Bite foil selects a remembered cosmetic Common/Rare/Epic/Legendary finish without changing combat rarity or power.

The shared TradingCard finish uses independently authored CSS gradients, blend modes and existing pointer spring variables, informed by [Simey’s holofoil reference](https://poke-holo.simey.me/) and its [technique overview](https://github.com/simeydotme/pokemon-cards-css). No reference textures or source CSS were copied. Common is matte silver; Rare blue with a restrained diagonal sheen; Epic purple with additional conic prism foil; Legendary gold combines prism, small star luster and pointer glare. Effects remain behind the text, use no new raster textures or canvas passes, and have static reduced-motion/low-FX variants. The existing shared Keru rarity frame wrappers use the same finishes rather than stacking their former extra art overlays.

`tools/bite-rarity-check.cjs` checks all four frame colors/effect layers, removed AP, enlarged text, HP below the card, remembered selection and reduced motion. Reviewed mobile image: `output/bite-rarity/legendary-phone.png`.
## Zero damage, HP reaction and gyro

Bite's base damage is now exactly the count of legal foundation receipts. It starts and resets at zero; casting without accrual returns unchanged state, guaranteeing no unearned damage. Each accepted card adds one for the next cast.

The live foundation observes actual HP, independently of receipt values or damage events. A decrease switches only its art subject to the front-facing first cell in the existing combat flinch atlas. The measured rectangle is read from `heroCombatLayout.json`; the atlas is sampled with CSS rather than rewritten. Another loss refreshes the 750 ms game-clock hold. Initial HP, healing and shield-only changes do not trigger it, and encounter reset clears it. Labels, rarity finish and HP stay mounted. The flinch atlas is preloaded on foundation mount.

AbilityCardFace compact/hand cards and standalone foundations now subscribe to the shared calibrated device-orientation spring. Permission is requested on a card gesture where supported, including the parent-owned hand hit surface. Secure-context gating, pointer priority, reduced motion and hidden-page resets remain. Only the visual face tilts; the input stage and foundation drag bounds remain stationary. Actual mobile sensor availability still depends on the browser/device permission; tests inject orientation events rather than claiming hardware validation.

Validation: `tools/bite-reaction-gyro-check.cjs` covers HP art replacement/restoration, refreshed hold on successive losses, healing ignored, zero-damage label, gyro response on hand and foundation, unchanged hitbox and reduced-motion reset. Screenshot: `output/bite-reaction/front-flinch.png`. Bite rule tests cover no accrual, exact damage count and repeated zero-AP charged attacks.
