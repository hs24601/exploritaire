# Mochi Fast Swipes · Common

New built-in ImageGen portrait art at 1024×1536, guided by ART.md. Mochi watercolor v2 supplied identity; Hero watercolor v5 supplied the broad storybook wash/gouache style. Tortoiseshell fur, black paws, cream chin/ruff, yellow-green eyes and the long natural tail are preserved. Cream/pale-green painted motion strokes mark the swipes. Card title/cost/rules and the existing background are composed separately. Source/runtime PNGs are byte-identical, with generated alpha unchanged; the source manifest records references, prompt, dimensions and digest.

In musicaltableaus, Fast Swipes appears once in the persistent hand. Drag onto Hero's foundation or open its enlarged card and choose Attach for 1 AP. It costs one AP once, does not refund that cost, disappears from the hand and adds one maximum AP (initial capacity 1 → 2). Duplicate attachment is rejected. Common is the only authored gameplay rarity for this first iteration.

Every five accepted legal tableau receipts to that foundation deal one base chip damage to its current target through the normal hit/defense pipeline. Full-AP chip doubling does not apply to this fixed base hit. Invalid plays, enemy plays and Bite casts do not advance its counter. Counter progress survives turns and Bite casts; the fifth receipt resets it, independently of Bite's accumulated damage. Normal dead/turn/target/status constraints apply. It spends no additional AP when triggering.

The player's first encounter starts with one AP. Each subsequent party-round opening grants +1 AP, capped at maximum, preserving banked AP. Continuing into another encounter does the same. These rules are scoped to the musical Bite variant; other combat variants retain their existing AP rules. The foundation's AP bank appears as a separate pip row below HP, with Fast Swipes progress beneath it; this does not add a cost to Bite.

Validation: pure tests cover equip cost/capacity, duplicates, no-AP rejection, ten receipts with two exact baseline chips, current target, independent Bite counter, round grants/cap and unchanged legacy opening. The browser test `tools/fast-swipes-check.cjs` uses actual drag handlers, verifies the fifth-play chip and +1 AP after a full enemy/player turn transition, then checks mobile layout. Screenshot: `output/fast-swipes/equipped-phone.png`.

## Draft rarity completion (2026-11-06)

All four gameplay tiers are now authored in `fastSwipesData.ts`: Common/Rare/Epic/Legendary use 5/4/3/3-play cadence, retaining 1 AP attach cost, +1 max AP and 1 base chip. Legendary restores 1 AP only if its proc removes enemy HP, capped at capacity. Config → Fast Swipes draft rarity updates both rules and card presentation; the default is Common. See [ability rarity methodology](../design/ability-rarity-methodology.md) for evidence, lifecycle and tuning rules.
