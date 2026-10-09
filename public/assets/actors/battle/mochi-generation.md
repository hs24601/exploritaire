# Mochi generation record

Selected project assets:

- `mochi-directions-low-v1.png`: `exec-921977b8-730b-4e59-8c96-f6d094e35864.png`.
- `mochi-directions-high-v1.png`: `exec-70d8fd5a-0406-41b3-a012-8a560deea97b.png`.

Both are original built-in outputs, copied without raster editing. Source
rectangles, anatomical joints and two convex corner guards are authored in
`src/proto/mochiSprite.ts`. The packing repair output
`exec-760f5018-06db-45af-9fd5-a41159211138.png` did not provide the requested
gutters; it is unused and retained at
`artifacts/directional-sprites/mochi-high-packing-attempt.png`.

## Elevated atlas packing repair

Use case: precise-object-edit. Edit target: the attached Mochi elevated sprite sheet. Correct ONLY sprite packing and transparent-background cleanliness.

Preserve all NINE existing complete cat drawings: their Mochi identity, pixel art, colors, coat markings, exact anatomy and proportions, paws, tail, pose and direction. Do not redesign or add a cat. Preserve the row order: front/left-front-quarter/left-side; left-rear-quarter/rear/right-rear-quarter; right-side/right-front-quarter/true overhead nose-up.

Rearrange those nine complete cutouts into a clean regular THREE-column THREE-row atlas with generous true-alpha gutters. At least 80 pixels of empty space must separate the AXIS-ALIGNED BOUNDING RECTANGLES of neighboring sprites, horizontally and vertically. In the current sheet, the rear sprite's feet and the right-front-quarter tail occupy overlapping row ranges and stray neighboring pixels leak into rectangular sprite crops. Fix that packing so each sprite's tight rectangular crop contains only that cat, and no pixels of any other cat. Increase the overall canvas size as necessary instead of squeezing, distorting, clipping or changing any cat. Every ear, paw, whisker and tail must remain entirely visible.

Set all background and gutters to genuine alpha zero, including any brown glow/haze. Keep only the actual sprite artwork and natural transparent edges. No floor, shadows, colored background, checkerboard pattern, captions, labels, borders or grid lines. The output is a production transparent PNG atlas.

## Elevated and overhead atlas

Use case: stylized-concept. Asset type: Exploritaire MOCHI elevated directional pixel sprite atlas.

Input image 1 is the approved Mochi low-angle atlas, the primary character and pixel-style reference. Images 2–5 are identity references of the real Mochi tortoiseshell long-haired CAT. Preserve the same feline proportions, dark paws, mottled charcoal/copper/tawny coat, asymmetric facial patches, amber-green eyes, dark plume tail, pointed tufted ears, closed mouth. No white markings, dog anatomy, costume or accessories.

Create ONE genuinely transparent sprite sheet with NINE entire, coherent Mochi cat silhouettes, arranged three columns by three rows with transparent gutters and no overlaps. All nine are the same character at the same pixel scale and same neutral standing pose; keep consistent back length and head size. Each silhouette stands independently within its own cell.

For cells 1–8 the camera looks downward at the cat from approximately 55 degrees above the ground: clearly see the back and top of the head, feet naturally foreshortened. Rotate the CAT relative to this fixed camera; do not reuse an eye-level drawing.
ROW 1: front, front-left three-quarter, true left side (nose screen-left).
ROW 2: rear-left three-quarter, true rear (back to viewer, no frontal face), rear-right three-quarter.
ROW 3: true right side (nose screen-right), front-right three-quarter, TRUE DIRECTLY OVERHEAD at 90 degrees (nose toward TOP of sheet, tail toward BOTTOM). The overhead cell shows the whole long furry back, ears, head and tail footprint; no forward-facing portrait.

Use coherent full silhouettes only; no separated heads, torsos or tails. The rig will define joint regions against these complete source drawings. Four anatomically correct feline paws, no extra anatomy. Author both sides with the same animal's irregular tortoiseshell markings; avoid simply mirroring identical coat patterns. Tail gently curves behind, keep its entire outline inside the cell. Pixel art matching image 1: crisp clustered fur, dark stepped outline, warm readable asset lighting, no painted/photographic texture. No floor, ground shadows, background color, gradient, checkerboard graphic, grid lines, labels, captions or watermarks. Real alpha transparency around and between all nine sprites.

Mode: built-in ImageGen, transparent background. No separately billed CLI/API call. The built-in tool does not expose a model selector.

## Low atlas

Use case: stylized-concept. Asset type: production pixel-art directional sprite atlas for the game Exploritaire, actor MOCHI.

Input images 1–5 are identity references of Mochi, a real long-haired tortoiseshell CAT. Input image 6 is STYLE ONLY: Hero's existing pixel sprite atlas. Match its crisp pixel clusters, dark outline, readable shading and playful game scale, but do not copy the dog's anatomy, white chest, white socks or ear shape.

Create ONE genuinely transparent-background sprite sheet containing EIGHT complete, anatomically coherent views of the SAME Mochi cat, in a regular FOUR-column by TWO-row grid, spacious transparent gutters. Each cell contains exactly one entire standing quadruped cat, feet on the same baseline relative to its cell, same natural body/head proportions and pixel scale. No detached parts; the rig will use explicitly authored regions of each coherent silhouette. Never stitch independent anatomy.

Cell order, left-to-right:
TOP ROW: front (nose toward viewer); front-left three-quarter (nose diagonally screen-left); true left profile (nose screen-left); rear-left three-quarter (back toward viewer, nose away to screen-left).
BOTTOM ROW: true rear (back toward viewer, no frontal face); rear-right three-quarter (back toward viewer, nose away to screen-right); true right profile (nose screen-right); front-right three-quarter (nose diagonally screen-right).

Mochi identity: fluffy long-haired tortoiseshell cat with a slim feline muzzle, pointed triangular ears with subtle tufts, soft amber/green-gold eyes, small dark brown/pinkish nose, closed mouth, dark charcoal/brown base coat richly marbled with warm muted copper, caramel and tawny patches. The forehead has a broad dark central cap and a narrow copper stripe down the nose, uneven warm cheeks, a thick tawny neck ruff, dark near-black paws (NO white socks), long mottled fluffy body, and a large dark brown/charcoal plume tail with soft warm flecks. Preserve the photo references' irregular asymmetric markings, including visible warm patches across shoulders/flanks and dark patches down the spine. Left/right views describe the corresponding sides of this same animal; do not just mirror identical paint.

Pose: alert but relaxed neutral standing feline, four anatomically correct short feline legs/paws, compact shoulders/hips and a continuous, slightly elongated feline back. A proportional furry CAT head, not a dog or fox. Tail extends comfortably behind with a gentle upward curve, its tip no higher than the ears. Match silhouette proportions across views; no long giraffe neck, duplicated chest ruff, disconnected rump, extra legs or extra tails. Front/rear views naturally foreshorten the body. Make all entire silhouettes fit their own cell; no clipped paws, ears or tail.

Rendering: clean pixel art at the same effective resolution as the Hero style reference, not a painted illustration or photograph, deliberately pixelated stepped contours and crisp clustered fur, limited palette with dark outlines. Neutral asset lighting, warm fur distinguishable on dark backgrounds; no strong colored rim light. No ground shadows, floor, scenery, furniture, captions, text, watermark, borders or grid lines. The space around every cat and in all gutters must be real alpha transparency, not a solid/gradient backdrop or checkerboard graphic. Four columns and two rows only.
