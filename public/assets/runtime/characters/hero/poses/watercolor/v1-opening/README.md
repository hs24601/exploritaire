# Opening-days Hero artwork v1

Generated using the built-in ImageGen tool, 2026-10-16. All sources and runtime
PNGs are retained here. The style/identity reference was
`public/assets/runtime/characters/hero/sleeping/watercolor/v1/hero-sleeping-body-v3.png`, the approved
prone-in-den Hero. That reference itself was preserved.

## Artwork and expression names

- **Happy**: Day 01 default; closed mouth with a small, cautious upward smile and gentle amber eyes.
- **Joyful**: the preserved original open-mouth artwork. Original files have not
  been renamed or overwritten; runtime tags and choices now call it Joyful.
- **Curious**: selectable variation with alert eyes, slightly inquisitive brows,
  perked ears and a very subtle closed-mouth hopeful smile.
- **Sad**: the Day 02 default, with worried inner brows, tender heavy eyes and a
  small closed-mouth downward turn.

There are 72 full body cutouts: 18 sitting views, 10 standing views and 44 walking
frames. Sitting includes independently painted opposite directions and overhead.
Standing/walking share mirrored opposite views through the existing rig. The high
standing sheet includes overhead; high rear standing reuses the low rear view,
as in the existing definition. Walking retains all four authored gait phases.
Three eight-view expression head sets support low/elevated front, quarter,
profile and rear-quarter cameras. Front crops supply matching dialogue emoji.
True rear and overhead views retain their whole painted bodies, where the face
is not readable.

Map rendering uses these body sheets; Happy retains its coherent whole-pose
head. Curious and Sad use the new matching expression heads, including seated
Sad. Joyful selects the original registered body textures without reconstructing
the rig. Combat and sleeping bodies keep their established artwork.

## Prompt set

Each asset used a separate built-in ImageGen call with transparent output.
Body calls used the corresponding existing
`public/assets/runtime/characters/hero/rig/watercolor/v3/hero-{pose}-{tier}-body-v3.png` as the edit
target, plus the prone reference as the style/identity input. The following
production specification was applied to all six body requests:

> Use case: style-transfer. Production directional sprite atlas edit. Repaint
> every complete Hero puppy cutout in the approved prone-in-den reference's
> chunky angular layered watercolor/gouache aesthetic: broad opaque textured
> pigment facets, grain inside paint, confident cream/tan/slate brush shapes,
> warm golden ochre/orange ears and cheeks and organic brush-edged silhouettes.
> Same compact young tricolor Australian shepherd puppy, fluffy rounded cheeks,
> large expressive ears, cream blaze and chest, charcoal slate patches, amber
> eyes and very short natural bobtail. Preserve grid order, directional views,
> approximate relative scale, planted paw baselines and complete ears/paws.
> Readable faces HAPPY: mouth completely closed, tiny cautious smile, gentle
> attentive eyes. No tongue, teeth or open mouth. Genuinely transparent alpha
> outside all cutouts; no background, ground, shadows, text, grid, glow,
> accessories or detached body parts. Keep wide transparent gutters.

Per-sheet directives:

| Source filename | Layout and camera directive |
| --- | --- |
| `hero-sitting-low-source-v1.png` | Nine sitting poses, 3×3. Front / left-front quarter / left profile; rear-left quarter / back / rear-right quarter; right profile / right-front quarter / overhead. Eye-level views. |
| `hero-sitting-high-source-v1.png` | Same nine sitting views/order, viewed from approximately 55° above, last frame true overhead. |
| `hero-directions-low-source-v1.png` | Five standing poses in one leftmost vertical column: front / left-front quarter / left profile / rear-left quarter / back. Preserve mostly transparent canvas to the right. |
| `hero-directions-high-source-v1.png` | Five standing poses in one leftmost vertical column: elevated front / quarter / profile / rear quarter / true overhead pointing up. |
| `hero-walking-low-source-v1.png` | Four columns × five rows, 20 complete sprites. Rows front / left-front quarter / left profile / rear-left quarter / back. Columns are four distinct sequential alternating paw placements of a coherent four-beat walk. Preserve four-leg anatomy and phase scale. |
| `hero-walking-high-source-v1.png` | Four columns × six rows, 24 complete sprites. Same five directional rows from elevated camera plus true overhead pointing up. Preserve all four distinct walking phases. |

The elevated walking sheet required one targeted refinement, retained as
`hero-walking-high-source-v2.png` and preferred by the packer. The edit target was
v1, with the Happy head sheet as the expression reference. Final correction prompt:

> Use case: precise-object-edit. Image 1 is edit target, a 24-frame walking puppy
> sprite atlas, 4 columns × 6 rows. Image 2 is the approved Happy expression
> reference: Hero with mouth entirely closed and a tiny cautious smile. Correct
> only the mouths of every visible face in Image 1 to match Image 2. Remove all
> tongue, teeth, dark mouth openings and pink interior. Replace each with a
> single fine closed lip seam, small cautious upward turn at corner, cream muzzle
> touching cream chin with no gap. Keep identical amber eyes, brows, ears, head
> shape, body, paint style, directions, 24 silhouettes, four walking phases, cell
> layout, overall registration and sizes. Rear/overhead frames without visible
> mouths remain unchanged. Maintain opaque angular watercolor paint and true
> transparent alpha outside all sprites. No background, shadows, text, grid or
> glow. All 24 full walking sprites remain in exactly the same 4×6 layout.

Head requests used only the approved prone reference and this specification:

> Use case: stylized-concept. Production directional Hero expression-head atlas.
> Four columns × two rows, eight separate complete head and short natural neck
> cutouts. Match the reference's broad chunky angular watercolor/gouache pigment
> shapes, opaque paper-grain paint, fluffy rounded cream cheeks, warm golden
> ochre/orange brows and ears, charcoal slate tricolor patches, white blaze,
> amber eyes and large upright ears. Same young Australian shepherd puppy.
> Row 1 eye-level front / front-left quarter / left profile / rear-left quarter.
> Row 2 the same four views from 55° above. Consistent proportions and scale,
> centered within equal cells, wide transparent gutters and complete ears.
> No bodies beyond short neck fur, no background, shadows, floor, glow, grid,
> labels or accessories. True transparent alpha outside paint.

Expression directives:

- `hero-happy-heads-source-v1.png`: mouth completely CLOSED with a tiny cautious
  upward smile; gentle hopeful eyes, relaxed slightly raised brows. No tongue,
  teeth, open mouth or exaggerated grin.
- `hero-curious-heads-source-v1.png`: alert open amber eyes, softly inquisitive
  slightly asymmetrical raised eyebrows, ears perked attentively, mouth CLOSED
  with very subtle hopeful smile. No tongue, teeth, open mouth or excessive grin.
- `hero-sad-heads-source-v1.png`: gently drooping worried inner brows, slightly
  heavy tender amber eyes, mouth CLOSED with a very small downward turn, ears a
  little subdued. Subtle melancholy; no tears, exaggerated crying, open mouth,
  tongue or teeth.

## Registration and validation

Repack with `node tools/pack-hero-opening.cjs` (requires installed Playwright
Chromium). This extracts whole silhouettes before ordering grid cells, retains
the transparent painted fringe, preserves aspect ratio and plants each cutout
on the existing registration rectangle's foot line. No source art is replaced.
Head measurements live in `src/proto/art/hero{Happy,OpeningCurious,OpeningSad}HeadLayout.json`.

`tools/opening-hero-check.cjs` exercises eight compass directions for sitting,
standing and walking at low/elevated/overhead camera angles, separate Happy,
Joyful, Curious and Sad selections, bounds and asset loading. It saves full and
close detail screenshots at 3× resolution. `tools/opening-hero-scene-check.cjs`
checks desktop scenario persistence/travel and legacy callout migration.
The shared face-layer and walking tests cover geometry/expression switching and
the four-phase gait. Callout v1 saved Hero Happy overrides migrate to Joyful on
read; new saves use v2 without modifying the original v1 data.
