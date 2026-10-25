# Hero orbit v1: standing, low camera (vertical slice)

Goal (Eric, 2026-10-20): test whether ImageGen (GPT Sol), guided by a code-built 3D proxy, can paint Hero consistently around an orbit camera in the `?khad-combat` scene. Hero is a girl, a tricolour merle Australian Shepherd puppy.

Scope: the standing pose, alert expression, low camera tier (about 15° elevation), 8 faces. The rig mirrors the five authored views into eight faces (mirroring approved by Eric), so this is **5 paintings**. The higher camera, overhead view, other poses and 16 faces come later if this works. The thick-outline fur spike (`hero-fur-study-v1`) is abandoned; this set follows the approved watercolor references.

## How the pieces fit

1. **Proxy** `src/proto/heroOrbitProxy.ts` (`hero-orbit-proxy-v1`): a 3D body of ellipsoids with markings attached to body parts. It is never shown in the game.
2. **Guides** `tools/hero-orbit-guides.mjs` ray-casts the proxy at each view into `public/assets/sources/characters/hero/orbit/watercolor/v1/guides/`. Every guide shares one world scale and ground line. Beside each guide is the approved v3 crop for the same angle. `artifacts/hero-orbit/guides-vs-approved.png` compares them.
3. **Sol** paints each view from its guide using the rubric and prompts below.
4. **Import** `tools/hero-orbit-import.mjs` validates the paintings and packs them into the runtime sheet that the `?khad-combat` toggle uses.

## What to hand Sol

For every view, attach all of these:

| Role | File |
| --- | --- |
| Guide (the image to paint over) | `public/assets/sources/characters/hero/orbit/watercolor/v1/guides/hero-standing-low-<view>-guide-v1.png` |
| Same angle, approved identity | `public/assets/sources/characters/hero/orbit/watercolor/v1/guides/hero-standing-low-<view>-approved-v3-crop.png` |
| Whole approved standing sheet | `public/assets/runtime/characters/hero/rig/watercolor/v3/hero-directions-low-body-v3.png` |
| Watercolor quality anchor | `public/assets/runtime/characters/hero/sleeping/watercolor/v1/hero-sleeping-body-v3.png` |
| Alert face anchor | `public/assets/runtime/characters/hero/expressions/heads/watercolor/v2/hero-curious-heads-v1.png` |
| House style | `ART.md` |

`<view>` is one of `front`, `front-quarter`, `side`, `rear-quarter`, `rear`. Run the five views in one session if possible, so Sol keeps one individual in mind. After the first accepted view, attach it to the remaining runs as well.

## Rubric (all views)

**Registration (checked by the importer)**
- R1. Square 1024×1024 PNG with a true transparent background: alpha 0 everywhere outside Hero, with no paper rectangle, halo or colour fringe.
- R2. Same size and placement as the guide: the lowest paw on the same row as the guide's lowest paw (front 897, front-quarter 899, side 875, rear-quarter 909 and rear 909 at 1024 px), the overall silhouette within about 5% of the guide's height and horizontal centre, nothing touching the canvas edge.
- R3. Same camera as the guide: low, about 15° above her, no perspective distortion, same facing. She faces screen-left in the quarter and side views.

**Pose and expression**
- R4. Standing four-square on all four legs, weight even, head up, as in the guide. No sitting, walking, play bow or turned head.
- R5. Alert: open amber eyes with a dark pupil, focused toward screen-left (toward the enemy in the side and quarter views), ears pricked upright, mouth closed or barely parted with no tongue. Attentive brows, not worried and not smiling broadly.

**Identity and markings (the guide's flat colours map to her coat)**
- R6. Guide charcoal → black/charcoal coat with blue-grey merle mottling (soft grey patches over black, as in the approved art).
- R7. Guide copper → warm copper/tan: cheeks, legs, lower flanks, the underside of the rump and the back of the thighs. Add small copper brows above each eye; the guide leaves them out on purpose.
- R8. Guide cream → opaque creamy white: the blaze between the eyes widening to the muzzle, the deep chest bib, the collar across the shoulders and the socks and paws.
- R9. Guide pink → soft pink inner ears inside a copper rim, with dark ear tips and backs.
- R10. A natural bobtail hidden in rump fluff, with no long tail, flame tail or effects.
- R11. Fur volume grows outward from the guide's smooth shapes: a fluffy ruff, cheeks and rump with ragged fur edges. The guide's ellipsoids and seam lines are structure only and must not show.

**Style (match the references and ART.md)**
- R12. The same hand-painted watercolor as the approved Hero sheets and the sleeping art: broad wet washes, pigment pooled into crisp dried edges, confident leaf-shaped dark fur strokes, transparent layered glazes, cream left bright and opaque.
- R13. Thin, broken dark ink only where the references have it. No thick outline, sticker border or cel shading.
- R14. Nothing baked in: no ground shadow, glow, scenery, text, frame or second character.
- R15. The same individual in every view: identical palette, marking placement and proportions. Compare each view against the others and the approved crop.

## Prompts

Paste the shared block, then the view's line.

**Shared block**

```text
Paint Hero, a young girl tricolour merle Australian Shepherd puppy, standing alert, as one transparent-background watercolor sprite. Paint directly over the attached guide image: keep its exact pose, camera angle, silhouette size, position and ground line, and use its flat colours only as a marking map (charcoal = black coat with blue-grey merle mottling; copper = warm copper/tan; cream = opaque creamy white; pink = inner ears; amber = eyes; black = nose and pupils). The guide's smooth shapes and seam lines are structure only: grow fluffy fur outward from them with ragged painted edges, a full ruff and fluffy cheeks and rump. Match the attached approved Hero art exactly for identity, palette, markings and proportions, and match its hand-painted watercolor: broad wet washes, pigment pooled into crisp dried edges, confident leaf-shaped dark fur strokes, transparent layered glazes, bright opaque cream. Use thin broken dark ink only where the approved art has it; no thick outline, sticker border or cel shading. Expression: alert and focused, open amber eyes with dark pupils, small copper brows above each eye, ears pricked upright, mouth closed or barely parted with no tongue. Natural bobtail hidden in rump fluff. Square 1024×1024 PNG, fully transparent background, nothing touching the edges; no ground shadow, glow, scenery, text or frame.
```

**Per view**

- `front`: `View: straight on from the front at a low angle. Both eyes, the full blaze and the white bib face the viewer; both ears upright and symmetric; all four paws visible.`
- `front-quarter`: `View: front three-quarter, her head and chest toward screen-left. Both eyes visible, the far eye partly turned away; the near flank and both near legs show her copper and merle side.`
- `side`: `View: left-facing profile. One eye visible, gazing ahead to screen-left; the muzzle in profile with the blaze edge visible; the near ear upright in front of the far ear.`
- `rear-quarter`: `View: rear three-quarter, her body turned away toward screen-left. No eyes visible, only the back of her head, the far cheek edge and both ears from behind; the white collar across her shoulders, a merle back, copper thighs and a fluffy rump with the bobtail tucked in.`
- `rear`: `View: straight from behind. No face visible: the backs of both upright ears, the white collar band across her shoulders, a merle back, a fluffy rump with the bobtail tucked in, copper backs of the thighs and white hind paws.`

## Returning the paintings

Save each accepted painting, unedited, as:

`public/assets/sources/characters/hero/orbit/watercolor/v1/hero-standing-low-<view>-sol-v1.png`

Then run:

```text
node --import ./tools/ts-resolve.mjs tools/hero-orbit-import.mjs
```

The importer checks R1–R2 and reports silhouette agreement with the guide. It packs the views into `public/assets/runtime/characters/hero/rig/watercolor/orbit-v1/hero-standing-low-orbit-v1.png` and regenerates `src/proto/heroOrbitAtlas.ts`. Until Sol's paintings exist, `--placeholder` packs the guides instead, so the scene toggle can be checked end to end.

## Review

In `/proto.html?khad-combat`, the **Hero art** toggle switches between the approved sheets and Orbit v1. Use the scene's freecam or the camera buttons to orbit. Only standing at the low tier uses the new set. The higher camera, overhead view, sitting, walking, flinch and down poses keep the approved art.
