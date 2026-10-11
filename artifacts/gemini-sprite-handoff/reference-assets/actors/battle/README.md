# Directional battle sprites, v1

Created 2026-10-08 with Codex's built-in ImageGen tool, using Hero's existing
`../hero.png` as the character/style reference. No CLI/API generation was used.
The built-in tool does not expose a model selector, so this pack is not labelled
as a confirmed Sunburst result.

## Saved assets

| File | Contents |
| --- | --- |
| `hero-directions-low-v1.png` | Front, front-quarter, side, rear-quarter and rear; assembled reference plus separate head, torso/front legs and hind legs/tail columns |
| `hero-directions-high-v1.png` | Elevated front, front-quarter, side and rear-quarter; true overhead head/torso/hind sections |
| `dark-slime-directions-v1.png` | Five horizontal views, three elevated views and one overhead view |
| `mochi-directions-low-v1.png` | Eight authored horizontal views of Mochi, including independent left and right markings |
| `mochi-directions-high-v1.png` | Eight elevated views and one true overhead view of Mochi |

The generated separate sections did not agree anatomically: their first rig
lengthened the neck, doubled the ruff and raised the hindquarters. Playback now
uses the coherent assembled-reference column, divided into three explicitly
authored UV regions on a common registration grid. `directionalSprites.ts`
defines the source rectangles, neck/hip seams and anatomical pivots. Head and
hind attach to the torso and inherit its movement; all Hero scaling is uniform.
Neutral assembly retains the source silhouette's proportions. The separately
generated columns remain available as unused source material, not runtime art.
Do not assume a perfectly regular atlas grid.

Mochi's two sheets were generated with the built-in tool from the supplied cat
photos and Hero's style reference. The exact prompt set and output selection
are recorded in `mochi-generation.md`. `mochiSprite.ts` contains cat-specific
seams and pivots; it uses the same `quadrupedSprite.ts` factory and renderer as
Hero. The high atlas needs two convex corner guards to exclude neighboring
art from tight crops. A generated packing repair failed to provide adequate
spacing and is retained only in development artifacts, not used by playback.

## Prompt set (condensed production briefs)

These briefs record the final intent and constraints of the generation/edit
calls; they are condensed rather than verbatim tool transcripts.

1. **Hero horizontal sheet:** Match the tricolour Border Collie Hero reference:
   black coat, white muzzle/chest/feet, warm tan face and legs, lively ears and
   bushy tail. Crisp pixel art with dark outlines and transparent background.
   Four columns by five rows: assembled dog, head, torso/front legs, hind
   legs/tail; rows front, front-left quarter, left side, rear-left quarter, rear.
   Keep identity, proportions and pixel scale consistent. No text, grid, shadow
   or background. Sections should overlap at the neck/hips and permit reuse.
2. **Horizontal repair:** Preserve the character, style and five directions;
   correct the section registration and remove duplicated anatomy, especially
   rear limbs/tail from the torso section. Keep assembled references and three
   independently riggable anatomical columns on genuine transparency.
3. **Hero elevated/overhead sheet:** Use the same Hero identity and modular
   columns. Show matching front/quarter/side/rear directions from roughly 55
   degrees above, plus a true overhead view with the nose pointing up. Preserve
   white markings, tan paws, black coat, pixel scale and complete anatomy.
   No environmental scene, captions, grid, ground shadow or backdrop.
4. **Elevated background extraction:** Change only the background to genuine
   transparency; preserve all existing sprites, their placement, dimensions,
   contours, colours and details. Do not redraw, rearrange or add parts.
5. **Dark slime sheet:** A consistent near-black indigo/violet glossy slime
   enemy with cyan eyes, crisp pixel outlines and genuine transparency. Three
   columns by three rows: front/front-left quarter/left side;
   rear-left quarter/rear/elevated front-left quarter;
   elevated left side/elevated rear-left quarter/overhead. Show eyes only where
   visible from that direction; rear and overhead views have no frontal face.
   Simple consistent silhouette, no scene, labels, grid or ground shadows.

## Playback and reuse

- Hero's eight horizontal directions reuse five authored directions plus
  mirroring. Mochi has eight authored directions at each elevation; her
  asymmetric markings select right-side frames without texture mirroring.
- Art selection reads the camera angle relative to the actor's world heading.
  Camera changes do not alter the actor's intended opponent/target.
- Elevated art starts around 40 degrees; overhead around 72 degrees, with
  hysteresis. Overhead sprites point along the world heading and are centred
  on the ground anchor.
- Hero and Mochi each share two atlas textures and clipped UV geometry across
  their independent instances. Slimes share one atlas. There is no runtime segmentation or
  generated canvas; each direction's clip regions are authored in source code.
- Each quadruped has three mesh draws; slime has one. Normal actors use opaque
  alpha-tested materials; echoes use single-pass transparency. Sampling is
  nearest-neighbour, without mipmaps. The five-atlas pack occupies approximately
  30 MiB of uncompressed RGBA texture memory, independent of actor count.
  PNG files total approximately 7.5 MiB.
- Hero's elevated rear currently reuses its horizontal rear view. Slime's
  elevated front/rear likewise reuse their horizontal views. Direction changes
  are discrete sprite swaps; this is an articulated sprite rig, not a 3D model.

Browser checks: `tools/actor-rig-playwright.cjs`.
Proportion/animation regression checks: `tools/hero-proportions-playwright.cjs`
compares both quadrupeds throughout eight directions at each elevation and
overhead with the coherent source silhouette, allowing isolated contour pixels
from triangle interpolation. It rejects interior gaps, bounds average color
error, checks animated connectedness and verifies translucent echoes render.
Unit tests also verify exact neutral source-to-joint registration and UV mapping.
`tools/mochi-atlas-playwright.cjs` verifies that every crop preserves Mochi's
main silhouette and that its atlas guards exclude neighboring sprites.
Ten-actor rendering check: `tools/directional-sprite-benchmark.cjs`; measured
draw calls are 30 for ten Heroes or five Heroes plus five Mochis, and 20 for
five Heroes plus five slimes.
The headless benchmark uses software WebGL and is not a hardware FPS guarantee.

Original built-in outputs, retained outside the project:

- Hero low: `exec-fffe4304-e6af-45bf-8a84-1442b2b5cb2d.png`
- Hero high: `exec-bd267b94-b9ab-46e5-b332-78b55a243941.png`
- Slime: `exec-96e92d81-36c7-40b8-a0c5-3aa37e95a986.png`

They are under the Codex generated-images directory for this chat. Project
playback depends only on the five saved files in this directory.
