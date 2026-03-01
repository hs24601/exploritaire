# Gameplay Smoke Checklist

Use this checklist after major gameplay/editor changes.

## Environment
1. Run `npm install` (if needed).
2. Run `npm run dev`.
3. Open the app in the browser with `#devmode` enabled when required by the flow.

## Drag / Face-Card Validation
1. Start a combat scene with face cards visible.
2. Drag a face card (`J`, `Q`, `K`) from hand/tableau.
3. Confirm the dragged card still shows the face glyph, not the raw numeric value (`11`, `12`, `13`).
4. Drop on valid/invalid targets and confirm visual + rules response is consistent.

## AutoPlay AI Drag Quality
1. Trigger enemy autoplay/AI drag behavior.
2. Confirm the finger pointer tracks from the lower-right corner of the dragged card.
3. Confirm movement is smooth (no stutter/teleport tween artifacts) across several AI drags.

## Card Editor Rarity Loadouts
1. Open card editor and select a card.
2. On `Common`, set one base row (example: `damage = 1`) and save.
3. Switch to `Uncommon`, add an additional row (example: bleed chance).
4. Switch between rarities and confirm each rarity shows its own row-manager loadout immediately.
5. Confirm `Common` remains unchanged when editing higher rarities.

## Per-Rarity Cost
1. In editor, verify cost is set at the rarity level (not baseline card root).
2. Set different costs per rarity.
3. Save/reload and confirm costs persist per rarity.

## Foundation Value Rendering
1. Enter gameplay where foundation cards are visible.
2. Confirm value is rendered in upper-left corner.
3. Confirm a larger duplicate value appears in the lower main value zone of the same foundation card.
4. Validate consistency for numbered and face cards.

## Pass Criteria
1. No regressions in drag interactions.
2. No stale data bleed between rarity loadouts.
3. Per-rarity costs persist and affect gameplay as expected.
4. Foundation value rendering matches design in both value locations.
