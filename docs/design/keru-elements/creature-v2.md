# Keru creature redesign v2

2026-10-23. Supersedes the first round spirit mascot designs, including Cir's former orb creature. Existing backgrounds and mechanics remain unchanged. Creature subjects are independent transparent watercolor layers; no card mockup was generated.

| Keru | Element | Animal basis | Temperament |
| --- | --- | --- | --- |
| Dem | Ice | Polar bear | Formidable, watchful guardian |
| Bri | Nature | Stag | Ancient, imposing, patient |
| Sol | Light | Crane | Vigilant, noble sentinel |
| Vey | Dark | Panther | Stalking, dangerous predator |
| Flux | Chaos | Hyena | Unruly, threatening, volatile |
| Axi | Order | Tortoise | Severe, composed bulwark |
| Cir | Fire | Phoenix | Fierce celestial raptor |

## Dem

A mature glacial polar bear with an angular frost mantle, translucent ice claws and cold blue breath. Broad shoulders, small watchful eyes and a low, deliberate stance make Dem a formidable guardian.

Subject: `artifacts/keru-creatures-v2/dem-subject-v2.png`.

## Bri

An ancient woodland stag with branching fern-and-wood antlers, moss at the shoulders and new growth along old bark scars. Bri feels patient and imposing, with living renewal rooted in an adult animal silhouette.

Subject: `artifacts/keru-creatures-v2/bri-subject-v2.png`.

## Sol

A vigilant radiant crane with long legs, an ivory spear beak and luminous gold flight feathers. Sol has the composure of a watchful sentinel rather than a cheerful lantern mascot.

Subject: `artifacts/keru-creatures-v2/sol-subject-v2.png`.

## Vey

A lean predatory panther whose hindquarters trail into indigo shadow. Vey's low stalking posture, long muzzle and pale narrow eyes communicate real danger; shadow and life-drain motifs remain part of its body.

Subject: `artifacts/keru-creatures-v2/vey-subject-v2.png`.

## Flux

A rangy storm-hyena with a high bristling mane, mismatched ember and violet markings, and a jagged tail. Flux is unruly and dangerous, with weather-like instability rather than a cheerful ribbon body.

Subject: `artifacts/keru-creatures-v2/flux-subject-v2.png`.

## Axi

A massive adult tortoise with a balanced limestone shell and jade seams. Axi's heavy stance and severe watchful face suggest patient, unstoppable defense; orderly motifs follow real shell anatomy.

Subject: `artifacts/keru-creatures-v2/axi-subject-v2.png`.

## Cir

A fierce meteor phoenix with a white-hot breast, molten-gold wings and a long streaming ember train. The silhouette keeps Cir's shooting-star direction and luminous meteor core while becoming a recognizable supernatural bird.

Subject: `artifacts/keru-creatures-v2/cir-subject-v2.png`.

## Integration

The five-element gallery retains independent scenery, target faces, costs, code-rendered text and forecast examples at `/proto.html?kerusbx`. Dem's preview at `/proto.html?demsbx` uses the new bear cutout. Cir's active familiar, ability, drag and inspector surfaces share the versioned phoenix asset through `CIR_ART`. The old sprite is retained as historical art. Contained subject sizing preserves complete animal silhouettes; inspection depth, pause and reduced-motion behavior remain in the shared framework.

The animal bases distinguish body plans, not just palettes. Mature proportions, restrained eyes and natural postures replace the universal mascot face. Light and Nature need not appear harmless; Dark and Chaos need not be evil, but their predators can credibly threaten the party. Cir keeps the white-hot meteor breast, diagonal flight and trailing ember train; phoenix rebirth is visual mythology here, not an added revive mechanic.

Built-in ImageGen prompts: [creature-v2-prompts.json](./creature-v2-prompts.json). Earlier prompts and art remain historical.

## Validation

- Typecheck passed.
- Headless Chrome passed 63 primary face/viewport combinations: seven Keru with Hero, Mochi and invocation faces at 1280, 390 and 320px. Checked image loading, real transparent edges/near-opaque paint, independent layers, target transitions, full copy, inspection tilt, navigation, scrollable notes and no page errors.
- Cir's actual combat holocard passed spring tilt, opposing subject/background parallax, raised copy/cost, bounded subject extrusion, focus/hover reset, inspection without spending and reduced-motion checks.
- All 14 existing Cir, recall and Ember Trial rule tests passed. Artwork changes add no new combat mechanic.
- Reviewed generated subjects and desktop/mobile scaffold captures, including the actual combat ability fan. Reports, scripts and screenshots are in `artifacts/keru-creatures-v2/`.
