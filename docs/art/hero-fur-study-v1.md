# Hero fur study v1 (spike)

Question (Eric, 2026-10-20): can Hero's watercolor sprites be generated in code, as the bushes and Khad Roots now are? The smallest test is one still pose with the richest painted reference: the sleeping curl, `runtime/characters/hero/sleeping/watercolor/v1/hero-sleeping-body-v3.png` (plus its bobtail layer). Hero is a girl, a tricolour merle Australian Shepherd.

Status: spike for side-by-side review only. Nothing in the game uses it; the approved art is unchanged. Not committed pending Eric's review.

- Painter: `src/proto/heroFurPainter.ts` (`hero-fur-study-v1`), a DOM-free painter registered as the `heroSleeping` paint job, so it bakes in the paint worker pool.
- Review surface: `/proto.html?herosbx` shows the approved cutout and the painting registered in the same frame, at 160/320/512 px, with seed and tuning controls and a four-seed strip.
- Node fixture: `node --import ./tools/ts-resolve.mjs tools/hero-fur-render.mjs [outDir] [seed]` writes `compare-<seed>.png` (full frame, head 2×, small) and `head-<seed>.png` (face 3×) to `artifacts/hero-fur-study/`.
- Tests: `src/proto/heroFurPainter.test.ts` (determinism, size bounds, no clipping, tricolour proportions, readable closed eyes).

## Method

1. **Body.** Eleven ellipsoid parts (body, tail, haunch, hind paw, ears, head, ruff, front paws, muzzle) painted back to front. Centres and outer radii were measured on the reference with a 50 px grid (`artifacts/hero-fur-study/reference-grid.png`). Ears taper to a point.
2. **Markings in part coordinates.** Each part maps its local u/v to black, copper, cream or pink. The head's blaze, copper brows and cheeks are leaf shapes measured in reference pixels. Because markings belong to body parts, not to an image, other views could reuse them, which is the main structural argument for this approach.
3. **Fur as flame tongues.** Each part is a single wash. Every pixel samples its colour and coverage upstream along the part's fur flow by a tongue-shaped distance. One colour then licks into the next, and the outline breaks into flames. The tongue count around each flow origin is a whole number, so there is no seam. Tongues fade in away from the origin, and calm parts (face, muzzle, paws) mix and modulate less.
4. **Accents and ink.** Sparse slender leaf strokes glaze dark accents along the flow. Then come the authored closed eyes, mouth, toe lines and nose, and the shared `dabPass` granulation. Last, a thick, continuous dark outline (`HERO_OUTLINE`, 27 reference pixels, about 12 px at 512; tripled from 9 at Eric's request) is painted outside the silhouette and composited under the paint, so soft fur tips sit on the ink. Its width swells and thins slightly with brush-scale noise. Each body part is painted on its own sheet. Where it overlaps the parts painted before it, a thick dark ring (`HERO_PART_OUTLINE`, 18 reference pixels, about 8 px at 512) is glazed onto the paint behind it before the part is laid on top. Paws, muzzle, ruff, tail, haunch and ears therefore read as distinct shapes. The rings only glaze existing paint, so the silhouette edge is never doubled. A part can scale its ring with `outline`, and 0 draws none. The muzzle has no ring: a full ring read as a dark mask, and Eric then removed the fine line too.

## Attempts

| Pass | Result | Why it was changed |
| --- | --- | --- |
| 1. Many small flame clumps on lit ellipsoids | Recognisable tricolour, but read as spiky vector art (a hedgehog); black too grey; layout out of register | Clumps too small and uniform; layout eyeballed from a scaled preview |
| 2. Measured layout, broad leaf clumps with pooled rims | Read as an artichoke of outlined leaves | In the reference most form comes from soft washes; leaf strokes are accents |
| 3. Flame-tongue wash | Fur character arrived; body too thin, sunbursts at flow origins, a seam on the head, eyes lost in near-black fur | Core inset too deep; radial tongues crowd at the origin; the angle wrap made a seam |
| 4. Fatter core, origin fade, seam fix, slate eye mask | Face legible but blaze and white areas dominated it, brows were round dots, haunch looked like a ball of yarn | Colour licked too far on the face; circular marking shapes; near-tangential twist drew concentric rings |
| 5. Per-part mix and accent, leaf markings, sweeping haunch, brush-scale border warp | Face legible, edge ink sparse and broken | |
| 6. Thick dark outer stroke replaces the broken inner ink (Eric, 2026-10-20; later tripled to 27 px) | the silhouette pops at small sizes, closer to the reference's inked edge; loose fur flecks near the tail get their own outlined dots | Eric asked for part outlines |
| 7. Thick dark ring around every overlapping body part (Eric, 2026-10-20) | paws, muzzle, tail and ears separate clearly at every size; the look moves toward a bold cel/sticker style, and the muzzle ring reads as a dark mask | Eric asked for a thinner muzzle ring |
| 8. Muzzle ring thinned to 0.3× (Eric, 2026-10-20) | The muzzle kept a fine ragged line | Eric asked to remove muzzle lines |
| 9. Muzzle ring removed (Eric, 2026-10-20) | Current state: the muzzle blends into the blaze with no line; other parts keep their rings | |

## Findings

- **Works:** the silhouette, ear flames, the tricolour coat, the copper haunch sweep and seed variation (identity holds across seeds). At about 160 px wide, it reads as Hero sleeping.
- **Falls short:** the face. The reference's face is calm, bold marking shapes over wet-in-wet gradients. The painted face reads flatter and more diagrammatic, and the brows and cheeks still look placed rather than painted. The black coat lacks the reference's soft value gradients, and the paws read as tiles. This matches the feasibility estimate: generated faces are where charm is lost first.
- **Implication:** a hybrid fits. Generate the body, coat and fur, and keep painted faces and expressions as ImageGen pieces composited on top.

## Bake timing

Warm medians in Node on this machine (not a phone or frame-time figure): 256 px 51 ms, 512 px 198 ms, 1024 px 641 ms. The full plan of roughly 30+ poses and views would need load-time baking in the worker pool, with the approved art shown until each bake lands.
