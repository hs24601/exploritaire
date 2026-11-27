# Exploritaire art and theming

## Art library layout

Use matching paths under `public/assets/sources/` for masters and provenance and `public/assets/runtime/` for game-ready exports. Reusable kin art lives under `kin/<kin-id>/`, with `portraits/`, `expressions/`, and `sprites/` grouped by use such as `combat/`, `world/`, and `platforming/`. Name each art set for its content, such as `kin/banks/portraits/banks-kitten/`. Keep revision identifiers in filenames and provenance where they identify individual paintings.

Ability-specific paintings live under `abilities/<ability-id>/`, including team-up abilities. Cinematic art lives under `cinematics/<scene-id>/`, including scenes with multiple kin. Reuse shared assets by reference. Keep enemy-only art under `creatures/` and shared UI backdrops or motifs under `ui/`.

- Lustro sticker and hand optics (Eric, 2026-11-16): author Lustro as a squat upright transformed sibling of the approved Fireball painting, with nine separate cheek-free expression overlays. The supplied flame image is silhouette-only, the supplied illustrated face is expression-only, and actual Hero berry painting is the style reference. Preserve original generated alpha, versioned masters, exact prompts and source digests. `runtime/ui/stickers/lustro-v1/`; provenance: `docs/art/lustro-v1.md`. All `?combat` hand cards use shared TradingCard pointer/gyro spring, foil, layered depth and lenticular optics; Lustro uses angle-selected expressions and Bite retains its authored jaw frames. Preserve global optics preferences, paused/static/reduced-motion and low-effects behavior, native drag/cast input and cleanup.

- Fireball cast shader (Eric, 2026-11-16): actual cast flight uses the supplied Three.js polar-noise sphere and tapered noise-displaced flame/steam cylinders with spell-only bloom. The approved Fireball watercolor remains the painted card/constellation artwork. Original referenced noise textures are cached locally at `spells/fireball/shader-v1/`; no new generated bitmap artwork. Authoring, source URLs and receipt-driven visual hooks: `docs/design/fireball-shader-effect.md`.

- Spell-effect assets (Eric, 2026-11-16; Woods dev slice): standalone spells are reusable transparent painted effects, separate from acting-character ability illustrations, scenery and code-rendered card UI. Fireball v1 follows the supplied diagonal rounded-head/split-tail silhouette, using the actual Hero berry painting for style and Scratch for lighter merged washes. Preserve original generated alpha and byte-identical sources/runtime copies. Runtime: `spells/fireball/v1/fireball.png`; hand icon: `ui/spells/hand-fan-v1.png`. Exact built-in ImageGen prompts/reference roles and source digests accompany their versioned source manifests. The first supplied button reference rendered entirely black; the generated alternative uses a readable three-card fan. Blizzard/Bite/Star test siblings reuse simple symbols rather than claiming newly authored spell paintings.

- Hero low crawl (Eric, 2026-11-13): grounded crouch movement uses the original-alpha, eleven-view/four-phase ImageGen crawl cycle under `world-traversal/v1`, with the actual Hero berry painting as style reference. Retain its low bent-limb anatomy, uniform per-view physical scale and opaque cream fur; never vertically squash ordinary walking frames. Pivot and backflips reuse the existing anatomical somersault exposures, reversing their rotation order for the backflip. Source prompts, reference roles, digests and packing: `docs/art/hero-world-traversal-v1.md`.

- Mixed-painted Khadroot (Eric, 2026-11-12): reuse the world's overlapping continuous brush field on the existing procedural enemy geometry. Preserve original material pigments and emission; mix brush value/texture into diffuse pigment before scene lighting rather than substituting an autumn palette. This is a code-native surface pass, with no new raster assets or lights.

- Attached Flurry presentation (Eric, 2026-11-12): reuse the approved ice body and generated expression atlas at Hero-ear scale (.21 m), without new raster art. Keep the plane vertical, with yaw spin and in-plane playful roll, Hero's heading as the default, and a front-only facial layer over a two-sided ice body. Small luminous six-armed flakes fall independently in world space and settle lightly on the terrain, fading rather than leaving a solid white carpet. The large overworld collectible remains independently present; its face also belongs on one side only.

- Hero awake-face refresh (Eric, 2026-11-12): combat v3 and exploration-v2 yawn rebuild from original navigation identity plus the actual Hero berry style reference. Preserve a short broad canine muzzle, skull/ear proportions, open amber eyes and a quiet closed mouth during combat; avoid half-lidded eyelids, dark orbital makeup and sleepy expressions. Yawns change lower jaw/eyelids only. Author eleven large orbit cutouts per phase rather than squeezing 44 poses into one source sheet; pack to 256 px cells with original alpha and one uniform per-view clip transform. Ready is a stable held painting to avoid face jitter, with existing subtle runtime breathing; moving actions use four authored exposures, with leap recovering to the same fully standing ready pose instead of a seated-looking landing gather. Archive earlier versions and record all exact prompts/reference roles. See docs/art/hero-world-refresh-v3.md.

- Hero combat focus v2 (Eric, 2026-11-12): rework all four world-combat atlases to remove the menacing dark eye outlines and scowling brows from v1. Use the actual Hero berry painting's soft natural amber eyes and broad watercolor face treatment; convey alert attention with gaze and pose, not black orbital rings or a frown. Keep a neutral closed mouth, original body poses/registration, opaque pale fur, original generated alpha and calibrated size. Retain v1 as history; selected v2 masters/prompts and runtime packing live in the versioned `world-combat/v2` family.

- Hero world combat v1 (Eric, 2026-11-12): four original-alpha ImageGen sheets add focused readiness, approach gait, chest-low/rump-high pre-lunge bow and leap, each with eleven orbit views and four exposures. Actual Hero berry paint supplies watercolor style; existing low/high navigation sheets supply identity/angles. Keep closed unsmiling muzzles, attentive eyes, adult tricolor anatomy and the organic bobtail. Facial corrections use the serious-ready master without changing body poses. Preserve original/corrected masters, prompts/references, alpha and scale registration under `sources/kin/hero/sprites/world/combat/first-combat-cycle/`; runtime uses the corresponding versioned atlas family. These poses drive threat-aware world navigation; the existing tableau battle rig remains separate.

- Hero world exploration v1 (Eric, 2026-11-12): thirteen original-alpha ImageGen action masters provide 572 poses, using the actual Hero berry painting as the watercolor style reference and existing directional Hero/navigation and platforming art as identity/pose references. Preserve adult tricolor anatomy, amber eyes, upright ears, opaque cream fur and the short organic bobtail. Runtime sheets use mechanical crop/registration/packing only; retain byte-identical masters, exact initial/correction prompts, reference roles and source digests in `public/assets/sources/kin/hero/sprites/world/exploration/exploration-actions/manifest.json`. Never color-key pale fur or conceal a paper backing with runtime blending. See [world exploration v1](./docs/art/hero-world-exploration-v1.md).

- Flurry expression overlays v2 (Eric, 2026-11-11): twenty individually generated registered face overlays reuse her original indie-comic ink geometry and painted coral cheeks, with the actual Hero berry painting supplied as paint-style reference in every call. Full-canvas originals, alpha, exact prompts and reference roles are retained under `public/assets/sources/ui/stickers/snowflake-expressions-v2/`. The shared atlas keeps neutral/curious/happy/sad, extra moods, winks, blink stages and directional looks aligned with the original ice body. Do not flatten the face into the body or recolor the body to make an expression.

- Page 1111 Yggdrasil silk and reef (Eric, 2026-11-11): add Geometry Painter's Aurora Silk and Glowing Reef as distinct attached luminous forms: soft cyan/green/violet curtains and dark violet coral growths with teal/blue pulsing buds and delicate fans. Preserve readable painted brown bark and green canopy beneath the growths; daylight and localized mist remain in use.

- World Flurry animation (Eric, 2026-11-11): reuse her authored body and face layers, with restrained independent face parallax, smooth curious glances and gentle tilts. Falling six-armed flakes have soft icy-white/cyan luminosity, not hard starbursts or a global snow overlay. Keep the storm centered on Flurry, with a tall, discoverable column, normal world occlusion and a reduced-motion still.

- Darker Autumn preset (Eric, 2026-11-11): retain Autumn Wood hue relationships with deeper brown/russet/ochre pigment values, including ground cover and mixed-painted wood/leaves. Keep daylight and localized mist independent of the palette. Reuse the existing authored directional watercolor slime for page 1111’s ground encounter.

- Page 1110 atmosphere (Eric, 2026-11-11): remove the night/darkness treatment and global dark veil. Keep the painted brown tree and green canopy readable in neutral daylight, with pale terrain-following ground mist and localized perimeter/waterfall fog. Optional smoke wisps use soft watercolor density, buoyant rise, cooling and swirl; keep their colors neutral and their motion restrained.

- Page 1110 mixed-paint coverage and tree colors (Eric, 2026-11-11): coverage 1 means a complete brush-painted surface across all visible topography, not just maximum random dab density on walkable floor. Blend overlapping world-pinned marks into a continuous pigment body, keeping dry-brush texture without transparent holes. Use the identical method for brown wood and green main foliage on Yggdrasil; these colors supersede the prior Autumn Wood gold/russet canopy. Keep Autumn Wood's ground/litter mixtures, soft watercolor edges, subdued relief and non-emissive bark/canopy.

- Page 1110 world-paint experiment (Eric, 2026-11-10): adapt Patch's Oil Paint world-pinned brush method and Soil and Grass planting/growth field in a separate copy of page 120. Use broad soft merged watercolor marks, uneven feathered edges, grouped values and restrained relief under the Hero/Scratch authoring direction; avoid turning the grove into glossy impasto or a screen-space filter. Existing Hero and painted-tree raster art stays authored. Ground grass uses the reference's curled instanced blades with muted base/tip/patch colors, matte shading and the existing soil wash. This authorizes code-native paint and planting methods for page 1110; it does not replace page 120's treatment. Preserve notices for vendored MIT source; see `docs/research/world-studio-1110.md`.

- Wood Plank adornments (Eric, 2026-11-09): `runtime/ui/card-adornments/wood-v1.png` is an original-alpha wood-themed sibling of `nature-v3.png`, with broad watercolor oak roots, knots, bark and curled shavings. Nature v3 supplies the asymmetric card-edge composition; actual approved Hero v6 supplies the style baseline and actual Scratch v3 supplies the light palette/soft brushwork. Used on page 119's world cards, drag ghosts and packs without changing their 63:88 aspect. The byte-identical source, exact built-in ImageGen prompt and references live in `sources/ui/card-adornments/wood-v1/manifest.json`.

- Active Fast Swipes pose (Eric, 2026-11-06): `runtime/abilities/fast-swipes/upright-swipe-pose/mochi-pose.png` replaces the earlier sequence in hand, foundation and jumbo. The supplied card image is pose-only reference; Mochi v3 supplies identity, actual Scratch v3 supplies light swatches/soft brushwork, and actual approved Hero v6 supplies the style baseline. Preserve the whole upright silhouette, raised forepaws, bent hindlegs and plume tail. This is one still painting: no lenticular extras or frame sequence for now. Original alpha, supplied reference and exact built-in ImageGen prompt are preserved in `sources/abilities/fast-swipes/upright-swipe-pose/manifest.json`. The lenticular production history below remains available for future explicitly requested animation work.

## ImageGen lenticular ability animation contract (Eric, 2026-11-06)

Current restrained-action example: [Fast Swipes v6](./docs/art/fast-swipes-lenticular-v6.md), with four registered right-paw slap poses at `runtime/abilities/fast-swipes/registered-slap-cycle/`. Exact built-in ImageGen prompts, actual reference roles and digests are recorded under `sources/abilities/fast-swipes/registered-slap-cycle/manifest.json`. Versions v3–v5 remain historical where superseded.

**Action restraint correction (Eric, 2026-11-06):** Fast Swipes is a cat's brisk slap, not a many-arm magical performance. Only the anatomical right forepaw (viewer-left shoulder) acts; the other paw hangs down in the same position. Use rest/lift/slap/follow drawings, retracted claws, modest changing wrist perspective and at most two small speed marks. Remove phantom planes, body-encircling arcs, repeated angular cycles and alternating-arm attacks for this ability. Three gates at lateral -0.45, 0.20 and 0.65 reveal one action across the full left-to-right range; reverse tilt retraces it. Face-on uses lift; reduced motion uses rest. These are discrete printed exposures with no position tween. A narrow .024-wide lens exchange band is sufficient. More frames, planes or cycles do not automatically make a lenticular action more convincing: start with one legible action and choose cadence to fit its anatomy. The v5 many-fists recipe below is historical and must not be reapplied to Fast Swipes by default.

**Discrete exposure correction (Eric, 2026-11-06):** repeated action must use lenticular/zoetrope trickery: distinct printed poses abruptly replace each other as lateral viewing angle crosses exposure bands. Do not slide, rotate, scale or tween one limb sprite through an attack. Every exposure depicts a newly painted presentation of the same arm with a different horizontal endpoint, wrist/toe silhouette and foreshortening. The position jumps forward/backward at exchange; it is not a continuous trajectory. For alternating swipes, author at least six registered exposures: left gather/strike/follow, right gather/strike/follow. Keep head, face, torso and camera steady. At a fixed angle all action freezes; reversal retraces the same angular sequence. Vertical angle never advances it.

Only when the requested action specifically calls for many-fists effects, author distinct phantom sequences for separate depth planes and stagger their exposures. Never stamp the same paw several times or move an unchanged paw sinusoidally. No positional interpolation between exposures. Keep phantom origins below the head and the primary arm visibly attached. A tightly bounded lens-sliver overlap may exchange adjacent drawings near a boundary; avoid a broad crossfade/morph. GPU and DOM must share pose order and angular gates. Prefer clamped, non-repeating selection for a single action; it needs no modulo wrap or center deadband. Reduced motion/low-FX uses the first body exposure and hides any optional phantoms.

Prompt addition for each body exposure: “A discrete printed exposure, not a translated copy: [left/right arm] is visibly attached at its shoulder; paw endpoint [x,y], [specific wrist yaw/toe silhouette], [specific short/front-facing or long/receding foreshortening]. Preserve exact facial/body/canvas anchors. Other arm tucked. No phantom duplicates in this body layer.” For a phantom atlas, specify an exact grid, one independently painted arm per cell, distinct horizontal positions, wrist perspectives and near/far scales, transparent gutters, no labels. Inspect each cell and reject simple copied/mirrored stamps. Save original atlases and document any deterministic packing separately from generation.

Requests such as **“add imagegen art via art.md for lenticular animations on this ability”** invoke this complete workflow. Author and integrate an angle-driven animation, not merely a static foil overlay. Infer the action from the ability's established art and gameplay; preserve identity, labels, costs and rules. Use Bite as the registered pose-flip example and Fast Swipes as the repeated-action example.

1. Inspect the current ability painting and its runtime crop. Use the actual Scratch v3 painting as the light palette/soft brushwork reference, the actual approved Hero key painting as the style baseline, and the ability/character master as the identity, pose and registration reference. State those roles in every ImageGen prompt. Apply the Light Scratch watercolor method below; don't replace paint with filters or procedural subjects.
2. Author **at least four distinct, independently generated registered poses** for one action, or **at least six for alternating repeated attacks**. For a bite: closed → parted → half → open. For alternating swipes: left gather → left strike → left follow → right gather → right strike → right follow. Each arm exposure changes its endpoint, wrist silhouette and foreshortening. Keep canvas dimensions, crop, head/eye/nose/ear anchors, torso, markings and background registered. Change only action anatomy and local motion marks. Never translate the whole character to impersonate animation. Review registration before integration; regenerate drifted frames.
3. Keep the primary action limb visibly attached at its shoulder/joint. Keep swipe origins below the face in the shoulder/chest band, never over the head. Extra blurred paw/weapon/trail afterimages must be separately generated alpha assets on separate parallax planes, and must not be baked into every body frame. Place their endpoints close enough to read as connected action. In Fast Swipes v4, the nearest afterimage is moved halfway toward Mochi's face from the previous lower-foreground placement; the ready pose also tucks the primary paw under the chin.
4. Save versioned generated masters and byte-identical runtime copies with original alpha, exact prompts, reference roles, dimensions and digests. Use the same registered landscape source sequence for compatible portrait crops when it keeps the action readable. Pale fur stays substantially opaque. Check light/dark/checkerboard grounds and actual compact/jumbo sizes; do not key pale fur or bake card text/backgrounds into subject assets.
5. Integrate the poses into the shared animated lenticular renderer. Use the **shared calibrated lateral pointer/gyro spring**, never a clock, CSS autoplay loop or mouse-event counter. A single pose flip such as Bite can use absolute lateral angle. A slap uses a small number of signed non-repeating gates: Fast Swipes v6 uses -0.45, 0.20 and 0.65 for four poses across the full range. Repeating angular cycles are opt-in for an explicitly requested repeated-action treatment. Reverse tilt retraces exposures; no frame-dependent velocity, sine-driven limb movement or smooth limb-position interpolation. Preserve a meaningful face-on pose; vertical movement alone must not select action poses.
6. Exchange adjacent exposures through narrow lens slivers, with uniform coating/refraction over the complete character and background. Repeated attacks use abrupt per-sliver selection, not a broad dissolve or positional morph. Preserve each extra action plane's independent authored perspective, stagger and discrete X jumps in both GPU and DOM compositions; adding a canvas must not flatten or hide them. Match crop and anatomical anchors between renderers. Keep card labels/borders outside optical distortion.
7. Use the global `HOLOGRAPHIC_LENTICULAR_ENABLED` flag and remembered all-holocard toggle/strength/pitch. Do not introduce per-ability effect flags unless requested. Provide the authored DOM frame sequence when WebGL is disabled/unavailable/loading/lost, and a static ready pose with no moving afterimages for reduced motion and low/off effects. Keep native hitboxes, dragging, HP reactions, game-clock pause and rarity semantics unchanged. Bound texture/canvas resolution, skip hidden/offscreen draws and release GPU resources on teardown.
8. Validate real pointer movement and injected gyro, both lateral directions, all poses and repeated cycles, reversal, idle stability, frame decode/alpha, anatomical layer placement, global toggle, reduced motion, fallback/context recovery, compact and jumbo presentations, and existing gameplay interactions. Record actual checks and physical-device limitations. This contract supplies the standing implementation requirements; the user should not need to repeat these details for another ability.

Prompt template for each pose:

> Image 1 is the exact registered identity/pose master; image 2 is actual Scratch for the lighter palette and soft wet brushwork; image 3 is actual approved Hero for the style baseline. Create frame [index/name] of [ability/action]. Preserve the original canvas, camera, crop, body/head/eye/nose/ear anchors and markings. Change only [connected limb/jaw] into [specific action pose and endpoint]. The limb stays joined at [joint]; no limbs originate over the head. Broad diluted wet-on-wet cloudy masses, rounded soft dabs, feathered lost edges, selective facial accents, light apricot/ivory/slate; no gritty texture, tiny fur serrations or photoreal detail. Genuine transparent surroundings, substantially opaque pale fur. No text, UI, card border, scenery, extra limbs or baked afterimages; separate runtime depth planes supply extra motion trails.

- Fast Swipes anatomical layer placement (Eric, 2026-11-06): place additional swipe forelegs in the shoulder/chest band, not above Mochi's ears or emerging from her head. The far afterimage sits behind the main subject; the other swipes fan across the lower torso while retaining separate parallax planes. This is a runtime composition correction to the v3 layers, not a new raster painting.

- Mochi light-wash holocard (Eric, 2026-11-06): main identity portrait now uses `runtime/kin/mochi/portraits/light-wash/mochi-watercolor-v3-light-washes.png`, generated with the actual Scratch v3 painting for light swatches/soft wet brushwork, actual approved Hero v6 for the style baseline, and Mochi v2 for identity/pose. Preserve the raised-paw pose, yellow-green eyes, poofy cream mane, tortoiseshell ankles feathering into black feet, and natural plume tail. Broad merged washes replace the earlier hard saturated fur treatment. The background remains a separate parallax asset. Byte-identical original-alpha master and exact prompt/reference roles: `public/assets/sources/kin/mochi/portraits/light-wash/manifest.json`. This updates the shared main holocard, independently of Fast Swipes ability art; earlier versions remain historical.

## Light Scratch watercolor method (Eric, 2026-11-06)

Scratch's current reference is `public/assets/sources/abilities/scratch/light-wash/scratch-source.png` (runtime `ui/abilities/watercolor-v3/scratch.webp`). Its recorded production history is `docs/art/ability-watercolor-v1-generation.json` → `ability-watercolor-v2-generation.json` → `ability-watercolor-v3-generation.json`: v2 deliberately softened the paint and lifted the palette; v3 removed the opponent while preserving that treatment. The following authoring method is reconstructed from those prompts and visual review, not a claim about hidden model settings.

Use **Scratch as the actual palette/brushwork reference**, alongside the actual approved Hero painting for the established character/style baseline and separate identity/pose references. Assign each reference a role explicitly. A pose reference must not import its human anatomy, costume, hard lighting or rendering style. The new Hero key art, Bite and Fast Swipes use this lighter method; it supersedes their earlier sharp, saturated fur treatment.

The change is in the painted forms, not a contrast/saturation filter: paint with a small number of **big water-diluted wet-on-wet washes and broad rounded soft brush dabs**. Merge fur into large cloudy masses, feather uneven boundaries, allow controlled bleed and lost-and-found edges. Remove fine fur clumps, triangular serrations, repeated tiny strokes and dense texture. Do not ask for a generic “gouache texture,” gritty pigment grain, embossed texture, paper-noise overlays or fine-hair detail; those can recreate the harsh result. Keep eyes, nose, mouth and action-contact points selectively clear with a few sparse broken ink accents so the card remains readable.

Use diluted warm ochre/apricot/copper, creamy ivory, smoky slate/blue-gray and muted sage. Lift near-black masses and reduce brilliant orange/purple saturation while preserving recognizable charcoal markings, black cat feet and character eye colors. Pale paint remains substantially opaque. A lighter palette does not mean making the entire character translucent. Generate genuine transparent cutouts for layered card subjects/effects, preserving their original alpha; author backgrounds separately. Never color-key pale fur or bake a paper rectangle behind a cutout.

Reusable prompt core (replace the bracketed task, retain reference roles and invariants):

> Repaint [subject/action] using the supplied Scratch painting as the primary lighter-palette and soft-brushwork reference, with the supplied Hero painting as the established style/identity baseline. Preserve [identity, anatomy, pose and registration]. Make a decisive paint-method change: a small number of BIG WATER-DILUTED WET-ON-WET WASHES and broad rounded soft brush dabs. Merge fur into large cloudy masses; feather uneven pigment boundaries with controlled bleed and lost-and-found contours. Erase fine fur clumps, triangular serrations, repeated tiny brush marks and microtexture. NO gritty/embossed/granular texture, paper-noise filter, stippling or individual hairs. Use diluted ochre/apricot/copper, creamy ivory, smoky slate and muted sage; lift dark masses without losing identity contrast. Keep only a few sparse broken ink accents at eyes, nose, mouth and action contact. Genuine transparent background, substantially opaque pale fur, no scenery, paper rectangle, text, UI or border. [For Hero holoart: only the short organic furry bobtail; no flame tail, glow or magical tail wisps.]

Review at actual card size and enlarged, against dark/light/checkerboard grounds. Check palette and brush shapes together, readable face/action, intact pale fur, alpha edges and separate layers. Preserve versioned masters/prompts and compare source/runtime digests. For multi-frame art, preserve canvas, body, eyes, nose, ear and paw registration; change only the intended moving anatomy. Reject whole-body wobble or duplicated translucent jaws. Bite's angle-driven “holograph” presentation is a simulated lenticular flip: registered jaw states selected by lateral tilt, with brief transition bands, no time-driven loop; retain a closed-mouth reduced-motion fallback.

- Hero holoart revision: use the new lighter key portrait with only her organic bobtail. Do not reapply the old flame/fur motif overlay to this portrait. This changes holoart, not unrelated world sprite rigs.
- Fast Swipes layered revision: retain one anatomically connected main swipe paw; each additional blurred paw/action trail is a separately generated alpha asset on its own parallax plane. Scratch supplies the lighter swatches and softer brushstrokes; the user reference supplies the many-swipe composition only. Preserve earlier versions as history.

Selected runtime art: Hero `ui/holocards/layered/hero-watercolor-v6-organic-bobtail.png`; Bite `ui/holocards/hero-bite/v2/bite-{closed,parted,half,open}.png`; Fast Swipes `ui/holocards/mochi-fast-swipes/v3/{mochi-main,swipe-far,swipe-middle,swipe-near}.png`. Full exact built-in ImageGen prompts/reference roles: [docs/art/scratch-light-holo-v1.json](./docs/art/scratch-light-holo-v1.json). Implementation and validation: [docs/art/scratch-light-holo-v1.md](./docs/art/scratch-light-holo-v1.md). The older entries below are retained as production history where superseded.

Bite's optional [lens shader trial](./docs/art/bite-lens-shader-v1.md) reconstructs the subject/background from these unchanged paintings. Treat the interlaced frame disruption, micro-refraction and pearl highlights as a runtime optical layer; do not bake them into generated art or obscure live labels. Keep its strength/pitch controls and original angle-flip comparison available while evaluating the experiment.

- Mochi Fast Swipes (Eric, 2026-11-05): new transparent portrait ImageGen holocard subject, using approved Mochi watercolor v2 for identity and Hero v5 for broad merged watercolor/gouache styling. Preserve tortoiseshell patches, black paws, cream chin/ruff, yellow-green eyes and natural fluffy tail. Both paws sweep with painted cream/pale-green action streaks. Runtime `public/assets/runtime/abilities/fast-swipes/swipe-portrait/`; byte-identical master under corresponding sources. Keep the background and live title/cost/rules separate. See `docs/art/mochi-fast-swipes-v1.md`.

- Hero Bite holocard (Eric, 2026-11-05): new ImageGen portrait and landscape snapping/lunging action paintings use Hero watercolor v5 for identity and broad gouache/watercolor styling. Preserve tricolor fur, amber eyes, short bobtail and generated transparency, with painted jaw action strokes and a separate runtime background. Runtime `public/assets/runtime/abilities/bite/portrait-and-landscape/`; byte-identical masters under corresponding `sources/`. Portrait drives the shared Bite hand/foundation/jumbo face; landscape is available through the face orientation prop. See `docs/art/hero-bite-v1.md`.

- Hero idle v2 (Eric, 2026-11-04): page 22 uses new open-eyed breath cells and separately authored two-eye closed blink keys, replacing its baked winks. Add roll, full-turn spin, canine soldier salute, lying/sleeping and butterfly-chase art with an independent butterfly. Runtime: `public/assets/runtime/kin/hero/sprites/platforming/breath-and-butterfly/`; original masters and rejected variants: corresponding `sources/` directory. Built-in ImageGen prompts and selected reference roles: `docs/art/hero-idle-v2-selected.json`; rig/timing notes: `docs/art/hero-idle-v2.md`. Both eyes must close together; review the smaller far eye at enlargement. Preserve opaque pale paint, true alpha and separate effects.

- Hero platforming suite (Eric, 2026-11-04): 19 eight-frame clips (152 poses) use the approved seated platforming sprite as the key ImageGen reference. Runtime atlases, individual alpha PNGs, timing and visual pivots: `public/assets/runtime/kin/hero/sprites/platforming/platforming-motion-library/`; original masters/reference: corresponding `sources/` directory. Exact prompts: `docs/art/hero-platform-suite-v1-production.json`; usage and limitations: `docs/art/hero-platform-suite-v1.md`. Preserve opaque pale fur, original source alpha and separate tail/flame effects. Right-facing canonical artwork supports runtime mirroring. This adds an animation asset pack and preview without replacing existing book/combat rigs.

- Hero platforming seated idle (Eric, 2026-11-04): a new right-facing sitting body sprite uses the existing combat body/approved side rig for identity and the Hero berry painting for broad watercolor brushwork. Runtime: `public/assets/runtime/kin/hero/sprites/platforming/seated-side/hero-sitting-side-v1.png`; the byte-identical master is in the corresponding `sources/` directory. Genuine generated alpha is preserved; pale fur is opaque, with no scenery, ground shadow or baked tail/flame. Exact built-in ImageGen prompt and reference roles: `docs/art/hero-platform-sitting-v1.json`. This adds a platforming asset and does not replace combat sprites.

- Mochi woodland pop-up poses (Eric, 2026-11-03): five transparent built-in ImageGen paintings scaffold page 04: seated wonder, careful step, play stretch, curled rest and happy branch perch. Use the actual Hero berry painting for style and Mochi’s approved tortoiseshell portrait for identity. Preserve her black paws, cream chin/ruff and long natural tail. Keep the tree as separate artwork, physically joined to the perch painting at runtime. Original PNGs and alpha are byte-identical in `public/assets/runtime/kin/mochi/sprites/world/storybook-woodland-poses/` and the corresponding `sources/` directory; exact prompts and reference roles are in `docs/art/mochi-book-poses-v1.json`. These are book-scene assets, not a replacement for gameplay art.

- Hero woodland pop-up poses (Eric, 2026-11-03): page 03 uses four separately authored transparent Hero paintings: seated wonder, careful step, play bow and curled rest. Generated with the actual Hero berry painting as style reference and separate Hero identity references; preserve natural tricolour fur, short bobtail, opaque pale paint and original alpha. Runtime assets: `public/assets/runtime/kin/hero/sprites/world/storybook-woodland-poses/`; masters: the corresponding `sources/` directory. Selected prompts and reference roles: `docs/art/hero-book-poses-v1.json`. These poses belong to the isolated book scene and do not replace Hero’s gameplay art.

- Card art layers and Banks identity (Eric, 2026-10-29): author character key art and backgrounds as separate assets, never a single flattened painting. Compose them at runtime to retain independent movement and reuse. Banks remains a sleek, athletic adult cat with long limbs and a lean silhouette; the v2 fighting expression is a reference for softer brushwork and facial clarity, not chubby or kitten-like proportions.

- Keru holocard framing (Eric, 2026-10-28): use the full art face after removal of the lower ability-card body. Dem fills the portrait with their complete head and paws inside the frame; Riv uses a larger, centered diagonal otter composition; Cir uses a close-up centered on her face above the interaction descriptions, cropping the wings as needed. Keep individual authored artwork, character-specific anchors, parallax, rarity treatments and reduced-motion behavior consistent between compact, drag and jumbo faces.

- Banks broad watercolor refresh (Eric, 2026-10-28): replace detailed realistic Banks rendering with broad, softer merged washes and grouped storybook gouache strokes aligned with Hero's approved `hero-watercolor-v5-ordinary-day.png`. Preserve dark charcoal tabby identity, sage-green eyes, existing poses and registration. Active assets: portrait/fallback v8, world and reaction rigs v6 (90 paintings), frontal expressions v6 (neutral replaces rear-view), and paired rescue v5. Prior versions remain historical. Exact built-in ImageGen prompts, packing reports and validation: `docs/art/banks-watercolor-v6/` and `docs/art/banks-watercolor-v6.md`.
- Riv invoke card artwork (Eric, 2026-10-28): shared card art selects the authored transparent water-otter v2 at `runtime/keru/riv/riv-watercolor-v2.png`, replacing the R placeholder across hand/drag/jumbo faces. Preserve existing painting, rarity layers and gameplay.

- Banks frontal expression set v5 (Eric, 2026-10-27): new built-in ImageGen artwork follows the current broad storybook gouache standard, using Banks v7 for identity and approved Dem v3 for brushwork. Nine frontal faces: happy closed smile, sad, upset, upset with symbol, stars, heart-eyes, blush, neutral and fighting. Original alpha is preserved. Master/prompt/reference notes: `public/assets/sources/kin/banks/expressions/storybook-gouache/`; runtime sheet/frame metadata: corresponding `runtime/kin/banks/expressions/storybook-gouache/`. This is a versioned asset set; existing v4 gameplay selection remains unchanged.

- Aldan Seed artwork (Eric, 2026-10-27): replace the temporary diamond emblem with `public/assets/runtime/aldan/aldan-seed-watercolor-v1.png`, an authored transparent golden two-leaf sprout based on Eric's reference. Follow the broad storybook gouache/watercolor standard, preserve generated alpha, and omit soil and scenery. Exact built-in ImageGen prompt and style references: `public/assets/sources/aldan/manifest.json`.

- Elemental value backsplash trial (Eric, 2026-10-27): Scenario 1002 paints each element into the dark backing behind the live tableau value rather than around the card perimeter. Use separate authored compact and large plaques for covered header values and exposed centered values. Keep cream ranks as live text, the center dark and uncluttered, and preserve affinity labels, receipt rules and card input. Retain previous corner artwork as alternate sources.


- Restrained corners for every element (Eric, 2026-10-27): extend Nature v4 sizing to Fire, Water, Air, Earth and Chaos. All six select v4 transparent overlays with two modest upper-right/lower-left accents of comparable visual weight, distinct non-mirrored shapes and open centers; remove the dominant lower-left mass and extra side accent. Preserve rank layout, accessible affinities, covered-card orientation and interactions. Supersedes the v3 selection and Nature-only sizing limitation.


- Nature corner restraint (Eric, 2026-10-27): use Nature v4 with two small, similarly sized upper-right and lower-left leaf sprigs, using the smaller prior accent as the size baseline. Paint distinct arrangements rather than mirrored copies; remove the dominant corner mass and extra side accent. Other elements remain v3.


- Soft elemental adornments (Eric, 2026-10-27): Scenario 1002 uses the v3 asymmetric corner overlays for Nature, Fire, Water, Air, Earth and Chaos, with wider brush strokes, reduced detail and softer outer edges. Keep ranks, accessible affinity names, buried-card orientation and input behavior intact. Full-frame variants remain source studies; see docs/art/card-adornments-v3.md.


- Elemental perimeter paintings (Eric, 2026-10-27): Nature, Fire, Water, Air and Earth use authored transparent ImageGen watercolor overlays instead of code-drawn SVG forms. Reject uniform rectangular frames, bilateral/rotational symmetry and matching corners. Use unequal disconnected organic clusters, open perimeter gaps and a clear rank area. Current v2 PNGs preserve generated paint and alpha exactly in `public/assets/runtime/ui/card-adornments/`; original v1 rejected studies, v2 masters and exact prompts are retained in `public/assets/sources/ui/card-adornments/`. Keep card input, accessible suit names and rank rendering independent of the paint. See `docs/art/card-adornments-v2.md`.

- Expression emoji camera direction (Eric, 2026-10-27): generate facial expression emojis straight toward the camera at eye level, with zero head yaw or tilt, a centered nose/beak and both eyes equally visible at equal scale (closed eyes retain the same frontal placement). Expressions change facial features, not camera direction. Every image-generation prompt for expression emojis must explicitly require this frontal view, including when the identity/style reference is a profile, three-quarter portrait or action pose; reference perspective must not override emoji perspective. Visually inspect every expression for this before accepting the sheet. Do not include rear-view cells in a facial expression emoji set; use a frontal neutral expression instead. Directional world-sprite heads and explicitly requested alternate-view studies retain their separately authored camera angles. Preserve Cir's approved three-quarter v1 sheet as alternate artwork; the corrected frontal source sheet and exact prompt are in `public/assets/sources/keru/cir/expressions/v2/`. This supplements GAME.md's expression emoji orientation rule and supersedes conflicting older emoji perspective guidance.

- Cir windstorm planes (Eric, 2026-10-27): surround the first-frame Cir portrait with independently painted cream/cyan/gold wind ribbons and speed strokes behind and in front of her. Keep the character pixels intact, render near/far gusts as separate transparent layers through the shared card spring, and give foreground gusts greater travel than the subject and rear gusts. Preserve her face, rules/cost readability, reduced-motion and foundation stills. Runtime overlays: `runtime/keru/cir/windstorm/v1/`; original masters and exact prompts: `public/assets/sources/keru/cir/windstorm/v1/`. This is card presentation, not a gameplay effect.

- Cir first-frame entity portrait (Eric, 2026-10-27): `runtime/keru/cir/cir-phoenix-gather-still-v5.png` selects frame 0 (Gather) from the existing dive atlas for shared `CIR_ART`. Export its existing paint/alpha directly, retaining the raised wings and meteor train. Supersedes Unfurl as the entity portrait. Original source, selection metadata and earlier poses remain in `public/assets/sources/keru/cir/`.

- Shared ability holocard properties (Eric, 2026-10-27): ability cards use the same TradingCard tilt spring, foil/glare finish and layered scenery/subject parallax as actor holocards. Reuse LayeredCardArt for Keru and ActorCardArt for actor-based ability faces; do not flatten existing layered portraits. Jumbo inspection uses the shared pointer/touch/device controls and forward rules panel, with readable costs and text. Preserve reduced-motion stills and existing stable drag/cast behavior. Supersedes the earlier ability-specific foil-opacity and motion reductions.

- Ability hold lift (Eric, 2026-10-27): after a short hold, show only the held card and target cues over the unobscured board; suppress the radial, foundation copies, gauge copy and dark backdrop. Keep the full painted card face under mouse/touch control. Use dashed potential-target cues for undefined draft effects, returning those cards without spending or casting.

- Ability tap jumbo (Eric, 2026-10-27): ability hand cards open the shared jumbo holocard on tap/click or Enter/Space, preserving their artwork, full description and cost. Include unavailable abilities and presentation drafts. Available abilities expose Choose target as an explicit action; hold-drag remains the direct casting gesture. Keep the hand inert under jumbo and restore its focus on dismissal.

- Cir selected dive still (Eric, 2026-10-27): use `runtime/keru/cir/cir-phoenix-dive-still-v4.png` for shared `CIR_ART`, selecting the Unfurl painting (frame index 5) from the dive study. Export the exact isolated frame with existing alpha; retain the white-hot breast, partly opened wings and long painted meteor train. This is static character art over the separate painted card background. The animation request was a wording correction, not a new default motion requirement. Earlier portrait and animation assets remain historical. Selection metadata: `public/assets/sources/keru/cir/cir-phoenix-dive-still-v4.json`.

- Cir meteor dive study (Eric, 2026-10-27): animate the accepted storybook phoenix with authored wing gathering, folding, meteor tuck and recovery poses, retaining the white-hot breast and broad gold-orange painted train. Review at `?cirsbx` (also linked from Cir’s Keru gallery): accelerating diagonal travel, pause/replay, speed, scrubbing, isolated poses and a reduced-motion still. This is an animation study, not an automatic holocard idle loop or a change to Meteor mechanics. Preserve the approved portrait. Source master/prompt and packing measurements: `public/assets/sources/keru/cir/dive/v1/`; runtime atlas: `runtime/keru/cir/dive/v1/cir-dive-atlas-v1.png`.

- Cir storybook pass (Eric, 2026-10-27): `runtime/keru/cir/cir-phoenix-storybook-v3.png` applies the existing Hero/Dem authoring standard to Cir, using Hero's current holocard as the direct style reference. Retain the fierce meteor phoenix, opaque white-hot breast and gold-orange train; use broad angular feather masses, grouped shadows and an expressive face. Shared `CIR_ART` selects this version; earlier art remains historical. Source master, exact prompt and notes: `public/assets/sources/keru/cir/` and `docs/art/cir-storybook-v3.md`.

- Element suit icons (Eric, 2026-10-27): Earth, Air, Fire, Water, Nature and Chaos use separate authored transparent watercolor symbols matching the Spiraling Ember Momentum icon’s pigment, selective ink and pale painted highlights. Distinguish each suit by silhouette as well as color; no circular emoji badge, lettering, paper rectangle, ground shadow or baked external glow. Shared suit art appears in tableau headers and foundation markers while rank text stays separate. Preserve original generated masters and exact prompts under `public/assets/sources/ui/element-suits/v1/`; runtime exports live in `public/assets/runtime/ui/element-suits/`. Light/Dark remain valid unrelated character/ability themes, but are replaced by Nature/Chaos as tableau suits.

- Mochi unified vine variant (Eric, 2026-10-24): preserve her original holocard cutout and author a separate same-pose, same-style painting with comfortable snug vines winding around her legs, body and tail. Paint vines with the character, including natural front/back occlusion; do not assemble them as independently moving limb stamps. `mochi-watercolor-v3-vines.png` is the alternate, previewed with a single variant switch in motifsbx. Original remains the ordinary game portrait. This supersedes Mochi's separate vine-guard overlays; Hero retains her layered flame treatment.

- Mochi vine guards (Eric, 2026-10-24): replace scattered mane/tail foliage with coherent living vines that follow and wrap her forelegs and hind ankles like soft wrist guards. Use broad moss/jade gouache strokes, open loops showing fur, and sparse integrated leaf tips. Preserve exposed black paws, original portrait pixels, optional per-limb toggles and the same character-art plane. Original fur overlaps the upper vine roots. Current overlays: `runtime/ui/holocards/motifs/v3/`; this supersedes Mochi's v1 leaf placements.

- Motif plane rollback (Eric, 2026-10-24): keep Hero's flame fur and Mochi's greenery on the character-art plane, restoring the earlier subtle relative X/Y motion. Remove the closer-camera Z projection and enlarged parallax. Preserve original artwork, natural-fur overlap, toggles and static foundation/reduced-motion views. Supersedes the closer motif inspection-plane experiment.

- Mochi layered holocard (Eric, 2026-10-24): use the approved softened-face tortoiseshell cutout `runtime/kin/mochi/portraits/raised-paw/mochi-watercolor-v2.png` over the separate shared painted night forest. Retain the charcoal forehead/face, pink nose top with dark underside, and warm mouth/chin lightened from the darker study. Preserve real alpha and opaque cream fur. This supersedes Mochi's flattened forest portrait and the background-preservation requirement below; prior art remains historical. Use the shared card parallax and reduced-motion behavior.

- Hero integrated flame-fur layers (Eric, 2026-10-24): reconstruct Hero's optional elemental fur from the approved `artifacts/hero-flame-motifs-v1/hero-flame-motifs-v1.png`, retaining its flame shapes and colors. Do not substitute newly invented wisps. Use registered source-image sampling with broad fur-root patches, softened root masks and original natural-fur occluders above the flames. Keep roots at Hero's plane and restrict relative movement to flame tips. Preserve the original base file and master/per-part toggles; expose Natural fur overlap in the motif preview. This supersedes Hero's v1 isolated flame stamps. Mochi's greenery is unchanged. See `docs/art/hero-flame-fur-v2.md`.

- Hero/Mochi separate elemental accents (Eric, 2026-10-24): keep the original Hero and Mochi portrait pixels intact. Overlay three separate painted flame patches on Hero's shoulders/lifted paw and three separate leaf/vine patches on Mochi's mane/raised paw/tail. Use small anchored effects with independent visibility, strength and bounded parallax through the shared card spring; no idle animation, new flame tail or gameplay effect. Preserve static foundation and reduced-motion views. Mochi's base painting includes her background, so only her greenery is an independent new plane. `/proto.html?motifsbx` reviews the six layers; `src/proto/art/actorMotifs.ts` exposes session presentation options. Asset inventory and exact built-in ImageGen prompts: `public/assets/sources/ui/holocards/motifs/v1/manifest.json`.

## Authoring standard: Hero's hand-painted storybook watercolor

The primary gold standard for new art is `public/assets/runtime/ui/quests/hero-snuffling-berries-blue-paint-v3.png` (Eric, 2026-10-29). Use the actual image as a direct style reference for ImageGen and compare results to it rather than relying on the word “watercolor.” Hero's identity and the forest composition are not requirements for other subjects; use separate identity and pose references when needed. This supersedes the earlier equal-weight Dem v3 standard and any instruction to make every stroke sharply angular or separately defined. Existing approved assets remain in use until explicitly changed.

- Paint like a hand-made storybook illustration: light, translucent watercolor washes, irregular pigment pooling and bleeding, broken edges, visible brushwork and areas of paper-like light within painted shapes. Use soft transitions alongside a few confident, loose opaque gouache accents. Color can be vivid without looking glossy, digitally airbrushed or uniformly saturated.
- Group fur, feathers and foliage into varied broad, loosely connected color masses. Let marks merge and overlap with irregular size and direction; leave quiet areas. Avoid repetitive pointed fur tiles, uniformly sharp geometric facets, evenly distributed detail, fine individual strands and texture that resembles a digital filter. Paper texture belongs within paint, not as a rectangular backing on transparent assets.
- Faces should feel painted with the same looseness as the rest of the subject: simple, readable eyes and features, soft pigment transitions, restrained outlines and minimal small details. Avoid glossy oversized eyes, heavy eyeliner, precise vector-like contours and a highly rendered face pasted onto a loose body. Preserve the character's recognizable identity and requested expression.
- Use a few readable light and shadow groups, with natural variation in edge softness and brush size. The reference's warm light, forest setting, colors and subject are composition-specific; choose the appropriate palette and lighting for the requested asset while retaining its hand-painted medium.
- For isolated character or card art, retain the existing separate subject/background layer rule, true alpha, opaque painted subject, appropriate framing and no baked UI. A full scene is appropriate when specifically requested. Ability artwork still shows its acting character in a readable action without enemy figures.

### Image generation and review

1. Supply the Hero berry painting as the **style reference** in the image-generation call, not just a path in a text prompt. Identify other references separately as identity, pose or composition references, and explicitly say that their rendering style must not override Hero's. When editing an existing asset, preserve requested features and pose while using Hero to guide the paint.
2. Adapt this prompt direction to the subject: “Hand-painted storybook watercolor in the style of the Hero reference: light translucent, softly merging washes; irregular pigment blooms and broken brush edges; broad varied paint masses and a few loose gouache accents. Simplify the face into softly painted, readable features with restrained outlines. Avoid dense repeated pointed fur marks, glossy eyes, sharp vector contours and uniformly crisp detail.” Add the task's specific anatomy, palette, composition, alpha and exclusions without copying Hero's scene or identity.
3. Inspect the result beside the reference at full size and intended display size, including the face. Check for loose wash transitions, varied brush sizes, grouped values, restrained features, and a unified hand-painted surface. Check transparent cutouts on both light and dark backgrounds for opaque pale fur and clean alpha. If it looks like a detailed digital mascot or a mosaic of sharp strokes, revise the prompt and regenerate before acceptance; a watercolor label alone is not evidence of a match.
4. Keep sources, exact prompts and reference roles with project-bound output, and preserve earlier studies as versioned alternatives. These checks guide visual judgment, not a guarantee of identical results.

Dem's natural-pose experiment is `artifacts/dem-style-v3/dem-natural-v1.png`: the same approved character/style without supernatural ice, glow or particles. It is an alternate study, not a replacement for their elemental design. Dem is named in reference to Demeter and uses they/them pronouns throughout character authoring and copy.

- Creature-based Keru direction (Eric, 2026-10-23): replace the first Dem/Bri/Sol/Vey/Flux/Axi spirit mascots with recognizable mature polar bear/stag/crane/panther/hyena/tortoise anatomy, respectively. Elemental ice, growth, radiance, shadow, chaotic weather and ordered stone motifs grow from the animal silhouette. Smaller eyes, mature proportions, natural posture and varied temperaments are required; avoid ubiquitous hyper-cuteness. Cir becomes a fierce meteor phoenix, retaining a white-hot core and long gold-orange shooting-star train; this supersedes preserving the orb/flame-arms design. Keep broad diffuse watercolor, separate transparent subjects and reusable scenery, and code-rendered card UI. Earlier sprite versions remain historical.

- Creature Keru asset v2: current draft cutouts are `artifacts/keru-creatures-v2/{dem,bri,sol,vey,flux,axi}-subject-v2.png`; Cir's active shared sprite is `runtime/keru/cir/cir-phoenix-watercolor-v2.png`. The gallery now includes all seven. Use contained full-silhouette sizing over the existing separate painted backgrounds. Inventory, prompts and checks: `docs/design/keru-elements/creature-v2.md`.

- Layered card drafts (Eric, 2026-10-23): generate watercolor subjects and potential backgrounds as separate reusable assets; compose previews with the game's card framework. Do not spend image generation on flattened cards or product mockups. Dem's former raster ability-card mockup is rejected.

- Major element Keru studies (Eric, 2026-10-23): Bri (Nature), Sol (Light), Vey (Dark), Flux (Chaos) and Axi (Order) have independent watercolor character and background drafts in `artifacts/keru-drafts/`. The `/proto.html?kerusbx` gallery composes these through TradingCard with live copy/costs and layer controls. These are exploratory assets, not approved replacements or production combat art. Prompts and proposal inventory: `docs/design/keru-elements/`.

- Cir ability holocard depth (Eric, 2026-10-23): place the existing `runtime/keru/cir/cir-watercolor-v1.png` cutout over the painted starry `runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png`. Reuse shared spring tilt and inspection holofoil, with opposing sky/subject parallax and forward title/cost/effect labels. Slightly enlarge Cir on inspection and allow her cutout beyond the frame; keep sky/foil contained, her face above readable copy, and reduced motion static. No regenerated artwork or idle shimmer.

- Ember Tongues combat gauge (Eric, 2026-10-23): promote the live Ember Tongues spiral to the combat sandbox Momentum dial and select it by default in the design lab. Replace the old central raster/ring presentation with the bounded twelve-point flame and hotter core-out overflow. Preserve fractional earnings, spending, decay and ability mechanics internally, but show only whole spendable points in reserves, projections and visible Momentum readouts. Use a stronger 6px dark text stroke. Render the raised radial dial as a real component rather than cloning canvas DOM; preserve pause, stagger bullet time, reduced motion, mobile fitting and a static icon fallback when WebGL is unavailable. Other small currency icons remain shared artwork. Supersedes the experimental-only restriction for this selected combat sandbox gauge.

- Exposed Momentum flame edge (Eric, 2026-10-23): containment is local to the newer spiral coil actually wrapping over each section, not completion of that section's own circumference. Keep the entire unwrapped outside edge alive, with large irregular outward billows and pointed licks strongest near the leading front; older exposed arcs still flare. Reserve drawing room for this eruption while retaining a tight wrapped core, strong silhouette ink and bounded shader work. Apply the local wrapping rule to all live studies; Ember Tongues is the billow tuning reference. Supersedes whole-turn completion as the containment trigger.

- Dense Momentum core and path-led eruption (Eric, 2026-10-23): preserve the luminous Solar Filaments texture while revealing it along one connected center-out spiral, never by a uniformly expanding perimeter. Pack the inner turns tightly with a filled burning heart; completed turns settle into dense coils while the exposed front has broad irregular tongues and a curling turbulent plume. Use progressively wider radial pitch toward the outside in every live study, retaining skinny inner ribbons, 12-point waves, hotter overflow and existing motion/performance controls. Experimental sandbox art only.

- Solar filament reference and completed-turn containment (Eric, 2026-10-23): add a fourth procedural Momentum study, Solar Filaments, inspired by the supplied fiery vortex reference’s luminous coiled core, translucent sheets and curling filaments; no source pixels or watermark are incorporated. Select it by default while retaining earlier designs. Completed concentric turns reduce width, distortion and tongue reach; unfinished leading regions remain loose and turbulent. Apply containment to the existing ribbon studies too, keyed to completed circumferences and local wave fill, retaining overflow and motion controls. This remains experimental sandbox art.

- Momentum-scaled ink and outward flame sizing (Eric, 2026-10-23): include the ethereal tail tip in a strong black contour around the aggregate particle plume (not individual bubble outlines). Increase stroke width with total Momentum, while retaining thinner inner-turn ink. Rebuild variation ranges so both minimum and maximum flame width grow from skinny inner turns to broader outer turns; scale tongue reach, tail particle radii and smoke billow ranges accordingly. Preserve free particle motion, colored overflow and top-layer silhouette rules. Supersedes unoutlined tail tips.

- Ethereal Momentum tail and smoke (Eric, 2026-10-23): replace dedicated tapered/curved tail geometry with 20 deterministic, respawning shader particles per visible wave. Their puffs drift buoyantly, shrink and fade like the supplied Canvas example; keep them unoutlined. Widen the hard opaque near-black contour of the main topmost flame. Add a separate nine-puff curling charcoal/rust smoke underlay behind the flame, with a Smoky billow comparison toggle. Preserve existing sparks, bounded three-wave overflow, reduced motion and transparent empty state. No new production combat changes.

- Flame silhouette and free tail (Eric, 2026-10-23): Momentum study tails should be the least structured element. Use independent wandering, curling wisps rather than one rigid taper. Remove transverse periodic pigment cutouts and discontinuities at turn joins so flame does not read as snake scales. Add hard cartoon-style dark contour strokes to the topmost flame expansion, preserving soft pigment inside and leaving sparks unoutlined. Retain bloom overlap, hotter overflow, reduced-motion stills and bounded rendering.

- Unconfined Momentum bloom/overflow studies (Eric, 2026-10-23): retain Ember Tongues width while adding seeded irregular spiral silhouettes, larger animated tongues, overlapping outer blooms and fixed-budget leading-tail embers. Add Bloom overlap and Rekindle shape controls. Set the study base range to 12, previewing overflow up to 60. Each additional 12 starts another core-out expansion over prior flame; render only the three latest waves for bounded work. Cooler inner red/orange warms toward outer yellow/white; overflow introduces hotter cyan/blue-white as a temperature-inspired artistic cue, not a physical combustion model. Keep animation pause/reduced motion, hidden-tab culling and production combat unchanged.

- Living flame Momentum studies (Eric, 2026-10-23): continue `proto.html?momentumsbx` with three web-rendered alternatives (Ember Tongues, Windcoil, Painted Vortex). The original icon’s cream/gold/orange/red pigment and flame licks/tails govern the direction; avoid uniform molten channels. Use an internal spiral fill field with live irregular ribbons, curved leading tails, negative-space breakup and layered rotating/scaling procedural noise informed by the three user-supplied JS/GLSL examples. No remote texture dependencies or capture helpers. Provide motion/energy controls, transparent backgrounds, focus comparison, reduced-motion stills, bounded 480px backing resolution and 30fps draw throttling; skip drawing offscreen/hidden and dispose GPU resources on unmount. Earlier procedural/ImageGen studies remain optional references; do not change combat. Supersedes continuing the pre-rendered Tidal Halo as the primary direction.

- Connected Momentum spiral (Eric, 2026-10-23): in the pigment study sandbox, each variant is one continuous spiral starting at the center, not disconnected concentric rings. Map Momentum linearly to cumulative path length and advance a narrow watercolor wet front along that path, leaving completed pigment behind and no disconnected paint ahead. Larger outer turns consequently consume more Momentum per turn. Cache path geometry and raster coverage; retain the five motifs, grain, comparison controls and combat isolation. Supersedes per-ring noisy fill.

- Momentum pigment study sandbox (Eric, 2026-10-23): `proto.html?momentumsbx` is a dedicated experimental art lab comparing five concentric Momentum motifs: Spiraling Ember, Ember Orbits, Tidal Halo, Solar Bloom and Ink Vortex. Fill inner bands before outer bands using the existing discovery-style multiscale noise threshold/soft bleed method, adapted to cached canvas pigment layers instead of live SVG filter stacks. Include shared value/range/size controls, builder/spend steps, animated fill, decay, value toggle, dark/light backgrounds, per-variant focus and the current icon reference. Keep combat and production Momentum artwork unchanged until a design is selected. Procedural art studies are code-native, not replacement approved raster assets. Validate desktop/mobile controls, full/empty/partial states, animations and viewport access.

- Momentum dial and sandbox config (Eric, 2026-10-23): enlarge the sandbox Momentum dial to 144px desktop/112px mobile before viewport fitting. Center the Spiraling Ember artwork inside the rings with the reserve number overlaid in outlined high-contrast type; retain raised radial presentation and cost previews. Move Momentum decay and Add/Remove Mochi controls into the keyboard-accessible Config flyout in the sandbox header. Preserve existing control effects, ordinary combat controls and viewport bounds.

- Ability description panels (Eric, 2026-10-22): reserve at least 45% of the ability face for a larger rules/actor panel that grows with its text. Show complete descriptions without line clamping, truncation or internal scrolling, preserving the 63:88 holocard ratio and responsive readable copy.

- Ability holocard framework (Eric, 2026-10-22): render combat ability faces through the same TradingCard framework as actor holocards, using the shared 63:88 aspect ratio across fan, Withdraw utility card, drag ghost and cast clone. Preserve costs, actor/self labels and effect copy, without per-card instruction footers. Fan owns input; disable nested card interactions/device tilt, use plain finish (no idle shimmer), and retain contact-only foil, actor focus and targeting behavior.

- Banks photo color and pose correction (Eric, 2026-10-22): supplied real Banks photo governs his predominantly dark charcoal/graphite shorthaired coat, low-contrast muted gray tabby markings, dark chest/belly/paws, subtly lighter smoky muzzle and pale sage-green eyes. Remove the pronounced cream/beige fur of earlier passes. Standing/sitting share the adult head/body ratio, smooth close coat and natural ringed tail of walking/flinch/down, rather than a fluffy ruff or kitten silhouette. Retain Hero's loose watercolor medium and current action holocard pose. Active portrait v7, rigs v5, expressions v4, nuzzle v4 supersede earlier colors and shapes. See `docs/art/banks-watercolor-v5.md`.

- Banks global action/watercolor pass (Eric, 2026-10-22): `runtime/kin/banks/portraits/reaching-paws/banks-watercolor-v6.png` is the current Banks portrait, with both forepaws reaching toward the viewer in the supplied action reference's pose. Retain mature athletic slate-gray tabby identity, pale green eyes, cream muzzle/chest and natural ringed tail. Hero's approved watercolor art governs broad merged washes, diffuse pigment and selective ink across the portrait, eight rig sheets (v4), nine expressions (v3) and four protective Banks/Hero nuzzle frames (v3). The action reference supplies pose only; no card text, copied character markings or frame. Preserve existing pose states and paired protective behavior. This supersedes the v5 portrait-preservation rule; earlier assets remain historical. Inventory, prompts and validation: `docs/art/banks-watercolor-v4.md`.

- Mochi iconic face coloring (Eric, 2026-10-22): closely follow her supplied real-cat photo: asymmetrical charcoal/copper coloring extends down the full nose bridge, with a pink nose top, black nose underside and philtrum, warm copper/tan muzzle and dark mouth/chin. Preserve those marking boundaries in diffuse watercolor rather than replacing them with pale cream smile patches. Holocard face angles slightly downward toward the reference. Prompts: `public/assets/sources/kin/mochi/portraits/identity-references/mochi-face-identity.prompt.txt`.

- Mochi muzzle refinement (Eric, 2026-10-22): repaint the approved holocard nose, mouth, whisker pads and chin as soft feathered pigment and broken watercolor marks; whiskers are short, faint and partly lost in the fur. Preserve the enlarged face, green eyes, poofy mane, black paws, raised-paw pose and starry forest. Retain `runtime/kin/mochi/portraits/flat-watercolor/mochi-card-watercolor-v1.png`. Built-in ImageGen prompts: `public/assets/sources/kin/mochi/portraits/identity-references/mochi-muzzle-watercolor.prompt.txt`.

- Find a way out repaint (Eric, 2026-10-22): use `runtime/ui/quests/hero-leaving-cave-night-paint-v2.png` for discovery and active quest art, preloaded with opening media. Retain the rear-view cave-exit night composition, with broader merged washes, simplified foliage/rock/fur detail and red stemless broadly lobed manaberries surrounded by blue light. The previous night painting remains a historical variant. Built-in ImageGen prompt and references are recorded in `public/assets/sources/hero-leaving-cave-night-v2.json`.

- Foundation emoji sizing (Eric, 2026-10-22): enlarge player emoji portraits to span both foundation rows within the existing inner margins. Place the larger title in a clearly outlined pill at the upper right. Keep HP/stagger/status meters beside the portrait with a clear gap; no overlap (supersedes the 15% overlap trial). Preserve responsive sizing, readable values, stationary portraits and foundation bounds.

- Foundation emoji faces (Eric, 2026-10-22): player foundation portraits use the existing Hero/Mochi/Banks watercolor emoji faces instead of holocard artwork. Default happy; brief 1.5-second stars on landing attacks, heart-eyes on finishing blows, upset on damage (prioritized over simultaneous attacks/Thorns), and persistent sad while downed. Pause reaction expiry during combat inspection/pause, reset with battle state, and keep portrait geometry stationary. Enemy artwork remains its own entity portrait.

- Momentum cost badge (Eric, 2026-10-22): use the Spiraling Ember itself as an enlarged ability cost badge. Center the numeric cost over the artwork with a dark text stroke for readability; omit the written Momentum label and separate badge enclosure. Keep responsive sizing and accessible ability cost labels.

- Foundation polish and receipt motion (Eric, 2026-10-22): keep all foundation content inside its border with readable, full-height meter labels and consistent portrait/value alignment. Ability-menu foundation hosts must not inherit sandbox shell padding or clipping. Sandbox tableau receipt flights land on the numeric foundation value tile; unified actor portraits remain stationary during their automatic receipt-triggered attacks. Preserve enemy hit feedback and ordinary encounter motion.

- Foundation ownership and Sticky Paws (Eric, 2026-10-22): sandbox foundations share a strong bordered title, left portrait, HP/stagger/status meters and a right-hand current card value, with floating statuses above. Use character artwork without the holocard frame. Track actual foundation stacks. Mochi’s Sticky Paws costs 3 Momentum and pulls the latest actual card from any living friendly or enemy foundation onto the loose tableau; it does no damage, stagger or Momentum generation. Loose cards are top cards but require normal golf adjacency. Remove all automatic stagger spills. Taking the only card leaves an empty Disarmed foundation; its owner spends its next team turn only taking the lowest-value exposed tableau card, without an attack or Momentum, and remains unable to play cards or abilities that turn. These rules supersede earlier automatic spill guidance.

- Momentum icons (Eric, 2026-10-22): approved warm amber/gold watercolor Comet Spark and Spiraling Ember. Runtime transparent sprites: `public/assets/runtime/ui/momentum/comet-spark-v1.png` and `spiraling-ember-v1.png`. Original comparison boards live in `public/assets/sources/ui/momentum/`. Spiraling Ember marks reserve identity, ability costs and spending; Comet Spark marks gains. Preserve pigment texture, pale luminous cores and recognizable silhouettes. `MomentumIcon` shares the assets across Proto/combat sandbox without replacing accessible labels or altering resource rules. Generated/extracted with built-in ImageGen; extraction prompt retained with the sources.

- Approved Mochi holocard (Eric, 2026-10-21): the final version uses the face enlarged approximately 10% from the pre-eye-reduction painting, retaining its eye-to-face proportions, enlarged paws, poofy mane and colored ankles blending into black feet. The subsequent smaller-eye variant is rejected. Use the existing `mochi-card-watercolor-v1.png` runtime path; remove other project holocard variants.

- Mochi holocard proportions (Eric, 2026-10-21): Hero is the styling baseline, including eye size relative to the face and softer broad watercolor masses. Reduce Mochi's oversized eyes to Hero's scale while retaining green irises; exaggerate all four paws by approximately 20% relative to the preceding holocard pass. Keep the poofy mane, colored ankles feathering into black paws, raised-paw pose and forest composition. ImageGen's proportional changes are approximate.

- Mochi identity refinement (Eric, 2026-10-21): her defining traits include jet-black paws on all four feet, confined to the rounded feet/toes: tortoiseshell color continues through the ankles and bleeds down into the paw tops with a soft irregular transition; black must not extend up the ankles like socks and a prominent, voluminous poofy mane framing her cheeks, neck, shoulders and chest, as shown in the supplied real-cat photos. The holocard incorporates both traits while retaining its approved pose, forest and watercolor treatment. These are standing identity details for future Mochi art; this revision updates only the holocard.

- Mochi holocard (Eric, 2026-10-21): use `runtime/kin/mochi/portraits/flat-watercolor/mochi-card-watercolor-v1.png`, with Hero-matched ink/watercolor brushwork and a cool starry forest. The supplied reference governs the three-quarter raised-paw pose only; Mochi retains her fluffy tortoiseshell cat identity, green eyes, tufted feline ears and plume tail. This is a complete painted portrait using the shared card presentation; separate subject/background parallax is unavailable because ImageGen did not produce usable alpha. The replaced `mochi-card-v4.png` is removed and excluded from legacy art sync. Character sprites remain independent.

- Khad Root parity jank (Eric, 2026-10-20): default to a 256px transparent orthographic capture of the animated weed, displayed as a camera-facing cutout. Hold discrete yaw and elevation faces during orbiting rather than continuously revealing volume; use boundary hysteresis to prevent flicker. Keep the attacking Thorn Whip vine in world space. Smooth 3D and 4/8/16-face comparisons remain sandbox controls.

- Responsive Khad Root enemy (Eric, 2026-10-20): the first enemy is a dangerous noxious woody weed with hooked crimson thorns, dark winding stems, red fissures and sickly foliage/motes. Use a world-space segmented vine rig for Thorn Whip: anticipation coil, lash at impact, then recoil; rooted idle, hit and wilt states. The faceted procedural rig in `?khad-combat` is iteration scaffolding for silhouette and motion, not final painted enemy art. This supersedes the slime/shadow comparison as the first-encounter design.

- Scenery-only tableau windows (Eric, 2026-10-20): preserve spatial continuity with the surrounding landscape using opaque scenery samples inside numbered cards. Exclude other cards, roots and UI from the samples; soften and slightly desaturate the scenery under a light warm/cool watercolor wash, subtle pooled edges and close contact shadows. Keep rank ink crisp and sample artwork in card flights. This supersedes true-transparent tableau faces.

- Relief prop silhouettes (Eric, 2026-10-20): render the lit monochrome relief layer at 60% brightness so concealed props recede into the scene while retaining branch/facet detail and directional lighting. Preserve alpha, discovery masks and revealed artwork.

- Khad Roots quest illustration (Eric, 2026-10-20): use `runtime/ui/quests/khad-roots-berry-bush-night-paint-v1.png` for the Khad Roots discovery and active card. Built-in ImageGen uses First Fruits as its paint/night/root material reference, with hooked crimson-fissured woody roots constricting a low leafy berry bush, red bumpy manaberries surrounded by blue light, and a moonlit forest; no Hero. Prompt/provenance: `public/assets/sources/khad-roots-berry-bush-night-v1.json`.

Read this with [GAME.md](./GAME.md). This is the standing home for art direction, watercolor rendering, asset production, scene styling, lighting and visual themes. Gameplay legality, resource ownership, progression and interaction remain governed by GAME.md and the safeguards in the migrated contracts below.

## Current direction and precedence

Procedural Paint woods (Eric, 2026-10-20): procedural pines replace the approved `pine-sprite-v1.png` and `woods-cluster-sprite-v1.png` cutouts on every Paint pine and woods surface: map woods, edge trees and the Old Tree, tile inspection art, card backgrounds, the tableau scenery and Three.js woods landscape, and the combat arena. Six pine variants bake in the paint worker during the loading screen, counted in its progress, and four three-pine clusters are composed from them in the static cluster's framing. Each surface picks a variant by a stable key (tile, card view, layer), so woods vary per tile and per view. Procedural woods take the replaced cutouts' treatment: painted camera-facing cutouts, woods height 8, raised crowns, fixed ground anchors and actor peek-through. If a bake fails, or before one lands, the static cutouts are used, and they stay in the repository as that fallback. Pixel and the static woods overhead print (`woods-overhead-v1.png`) are unchanged. See `src/proto/proceduralWoods.ts` and `docs/art/procedural-woods-v1.md`. This supersedes using the supplied pine and cluster cutouts directly in the "Painted trees/woods" contract; their aesthetic remains the reference the pine rules are measured against.

Procedural pine rules (Eric, 2026-10-20; the Paint woods default since the cutover above): a procedurally painted pine (`src/proto/pinePainter.ts`, `pine-study-v1`) must never be a symmetric cone, have ruler-straight flanks, evenly spaced tiers, tiers paired across the trunk, flat-bottomed (unsagging) shelves, a crown floating off its trunk, a lean or forked leader, a ruled column trunk or bulb foot, proportions outside the approved pines' range, flat airbrushed value or lit undersides, an enclosed hole or a clipped edge, or incoherent lighting. Coherent lighting was approved by Eric on 2026-10-20: lit foliage must cluster with lit neighbours, and the left/right lit balance must show a light direction without leaving a flank in total shadow. `PINE_RULES` holds the approved limits, `pineSilhouette` and `pineGeometry` measure them, the approved `pine-sprite-v1.png` passes every raster rule, and a seed sweep plus a negative check per rule in `pinePainter.test.ts` enforce them. A bake that still breaks a rule regrows from the next deterministic sub-seed. Approved ImageGen woods stay the default until Eric approves a replacement side by side. See `docs/art/procedural-woods-v1.md`.

Procedural trunk growth (Eric, 2026-10-20): every main limb grows from one shared root and only diverges as it rises. Limbs that start apart and converge, cross or rejoin, such as an A-frame or twin roots meeting at the top, are illegal because no tree or bush grows that way. Each limb's heading is kept within its own lane, ordered left to right, so the gap between limbs can only widen. `BUSH_TRUNK_RULES` and `trunkStructure` encode and measure this. Trunk variety: each seed chooses one of four grown forms: a two-limb split at the ground, a single stem forking inside the trunk window, a one-sided lean (long low limb plus short upright one inside it), or a three-stem fan. The root sits slightly off-centre. Trunks use their own random stream, so changing a trunk never reshuffles foliage or fruit.

Procedural manaberry counts (Eric, 2026-10-20): a procedural bush carries any count from 0 to `BUSH_MAX_FRUIT` (5) manaberries. Each bush plans one ordered set of fruit slots and shows the first N, so changing the count adds or removes only the last berry while foliage and the other berries stay put. Every berry follows the existing manaberry identity and is apple-sized relative to the bush (radius 6.1–6.5% of the bake). Berries sit fully inside the foliage silhouette, never on or past the crown edge, above the trunk window, without overlapping each other. A leaf may cross only a berry's lower edge, and never another berry. Planning relaxes in stages so all 1,200 swept bushes fit five. Rendered fruit marks remain presentation; harvest state and rewards stay governed by GAME.md.

Procedural bush crown closure (Eric, 2026-10-20): a procedurally generated bush is one closed foliage mass. A large central gap, arch or tunnel under or inside the crown is illegal output. Foliage must hang down between the limbs to a drape line no more than 30% of the bush height above the ground; only the trunk below that line may show as an open window. No transparent hole enclosed by foliage above the drape line may exceed 0.4% of the bush's bounding area. `BUSH_CROWN_RULES` and the planner's mandatory closure pass in `src/proto/bushPainter.ts` encode this, `crownStructure` measures it on the painted output, and a seed sweep in `bushPainter.test.ts` enforces it. Amendment (Eric, 2026-10-20): open background under the crown beside the trunk is also a central gap, even when it opens to the side. Across the central 72% of the crown's width, foliage hangs to a low, irregular hem about 12% of the bush height above the ground, rising toward the sides into a rounded underside. Only narrow notches hugging each limb may open up to the 30% trunk window, and the crotch between limbs may open only to 16%. Filling extends foliage only downward from existing crown, so the crown's top keeps its natural outline. `crownStructure` reports `skirt`, the worst shortfall above the hem. A shortfall narrower than 2.5% of the bake width is a hairline between leaves rather than a gap.

Khad Roots bark-plate painter (Eric, 2026-10-20; review flag only): `src/proto/khadRootPainter.ts` (`khad-paint-v1`) paints the grown v2 geometry as a raster, without a browser. Wood is painted along and across each vine: a near-black wine base, crimson bark plates (warped near-round cells, each a slightly raised scale) separated by dark crevices, and moonlight on the upper shoulder that rolls off toward the rim. One wandering, broken glowing crack runs along each vine's upper shoulder, with short branches at plate borders and a faint bloom; undersides never glow. A restrained red wash sits above upper edges and beneath everything. Thorns are crucial to the aesthetic and must read clearly (Eric, 2026-10-20): a mid-crimson body lighter than the wood, a moonlit flank with a bright ridge, a fine static shimmer of brighter flecks (the painted counterpart of the grain the SVG filter gives v1/v2), a thin near-black outline, and only the very tip darkening. Only upward-pointing thorns carry a hot edge. A test requires the thorn body's median brightness to be at least 1.25 times the wood's, and above an absolute floor. The bush painter's watercolour glaze and granulation finish it, then the reward and value windows are cut out (the value window only when `obscureValue` is off). Embers stay SVG. It is the game default (approved by Eric, 2026-10-20); `?khad-paint=svg` shows the SVG pigment, which also displays until a card's bake is ready or if a bake fails.

Khad Roots grown geometry (Eric, 2026-10-20): Khad Roots vines are grown, not drawn through fixed points. Each vine steers loosely toward a few seeded waypoints along a course, with a bounded side-to-side sway, decaying kinks and a curvature limit. Girth bulges and pinches irregularly, while horizontal runs stay heaviest per the trunk-girth rule. Thorns vary in size and hook. Route topology varies per card: which side the base wrap leads from, which way the crown curl runs and how high, an optional climbing shoot and an optional loose tendril. `KHAD_ROOT_RULES` makes these mandatory for every vine and group link: no nearly straight run over 16 card units; visible girth variation; tapered tips; no tight knots (self-crossing within 40 units of vine); no thorn tip cut off by a clearance window; no vine through the value window unless the binding opts in with `obscureValue`, which adds only the crossing vine; and moon glow only on upper surfaces. Across cards, silhouette overlap must stay within a mean of 0.4 and a 99th percentile of 0.5, with no pair at 0.6 or above. A vine that fails is regrown from its next deterministic sub-seed. `khadRootStructure` and `khadSilhouette` measure the rules; the frozen first version (`khadRootGeometryBaseline.ts`) fails them, which the tests use as a negative check. Paint, clearance masks, embers, pause and reduced motion are unchanged. Review in `/proto.html?khad-compare`; `?khad-geometry=v1` shows the frozen version in place.

Khad Roots trunk girth (Eric, 2026-10-20): emphasize substantial woody volume, especially on horizontal runs across card crowns/bases and group connectors. Blend increased thickness smoothly through bends, keep tapered tips and recognizable thorns, upper-surface-only red emission and existing default value/reward masks.

Khad Roots moon response (Eric, 2026-10-20): red emission belongs only on upward-facing vine surfaces, as if reacting to moonglow. Keep undersides dark, vary hook/connector curvature in both directions, and allow vines across card crowns. Protect rewards and values by default; the per-binding `obscureValue` flag explicitly permits value overlap and defaults to false. This supersedes all-around seam glow and the full header clearance band.

Spherical shadow volume (Eric, 2026-10-20): use Gastly's floating spherical ghost motif as the form reference, preserving this creature's dark watercolor identity and mouthless design. Render a rounded deformed core and shifting ink cloud in world space, with eyes anchored to its physical surface. Orbiting must reveal volume, foreshorten the eyes and occlude the far side; never rotate the entire entity/face to follow the camera. Keep the enlarged comparison scale and spacing, global/local pause and reduced motion. This supersedes the camera-facing procedural plane.

Khad Roots tactile refinement (Eric, 2026-10-20): bring procedural roots closer to the painted quest reference with thicker winding woody vines, denser broad-shouldered hooked thorns, broken raised bark highlights and brighter crimson seam glow with a red surrounding wash. Preserve dark wood depth, seeded asymmetric growth, value/reward clearance, bindings and pause/reduced-motion behavior. This supersedes the thin-stem and restrained-emission limits of the earlier silhouette correction.

Shadow comparison scale (Eric, 2026-10-20): double the procedural shadow entity's previous linear size and separate it farther from the bespoke reference in the woods-combat trial, keeping both visible together.

Shadow entity (Eric, 2026-10-20): the procedural woods-combat creature is an entity of shadow and darkness rather than a corporeal slime. Its watercolor pigment remains, but its boundary continuously changes through spreading, thinning and dissolving ink lobes, inspired by the supplied QvEbVZ stamp lifecycle. Keep hostile eyes, no mouth/fangs or crest, subdued ground contact, shared global/local pause and a settled reduced-motion form. This supersedes the maintained crawling-body silhouette for this comparison entity; the bespoke reference and encounter mechanics remain unchanged.

Procedural slime watercolor refinement (Eric, 2026-10-19): avoid flat/cartoon fill and clean vector facial shapes. Model the body with broad irregular overlapping pigment masses, pale wet centers, broken pooled rims, feathered edges and restrained sediment. Keep deposited markings stable while the body deforms, with the same mouthless, crestless menacing design. This refines the comparison trial rather than approving a replacement for bespoke slime assets.

Procedural slime direction (Eric, 2026-10-19): keep the watercolor stamp method, but match the bespoke slime's dark, menacing character: saturated indigo/violet pigment, heavy asymmetric crawling lobes, a low uneven crown and hostile narrowed eyes. No mouth, fangs or tail-like crest/hat. Avoid friendly gumdrop proportions and round sparkling eyes. The woods-combat comparison remains temporary art scaffolding.

Radial dabs remain the preferred default for procedural ground washes (Eric, 2026-10-19). Preserve their original soft gradient appearance and give them seeded variation, tunable count/radii/spread/opacity, editable biome palettes, bounded caching and preset tooling. Keep pigment-field rendering as an explicit experiment. See [the current tooling contract](#radial-dab-tooling-and-defaults-2026-10-19).

Manaberry fruit identity (Eric, 2026-10-19): manaberries are red/raspberry fruit approximately apple-sized, with no stems or attached leaves. Use a visibly bumpy dragonfruit-like circumference and broad painted lobes; apple size does not imply apple anatomy. Blue magical light surrounds/backs the red fruit rather than turning its body blue. Apply this to individual fruit, scenery and bespoke illustrations. First Fruits depicts only the single fruit beside Hero's nose in the approved card crop, preserving that crop, its soft watercolor scene and Khad Roots. This supersedes the earlier two-fruit illustration requirement; gameplay fruit counts remain unchanged.

Khad Roots silhouette correction (Eric, 2026-10-19): use thin, uneven, tapered near-black woody stems with clearly projecting concave hooked thorns, including on inter-card connectors. Keep red light restrained to short internal fissures, faint wine-colored haze and sparse embers. The wood and thorn silhouette must remain primary; avoid thick crimson bands, continuous luminous contours and noise that erodes the thorn tips. Preserve stable asymmetric per-card growth, protected values/rewards, pause and reduced motion. This supersedes the saturated-crimson thorn pigment in the earlier danger-glow contract.

Use approved watercolor artwork with broad merged wet washes, selective ink accents, varied soft/hard edges, saturated identity colors and readable silhouettes. Grain supports paint; it must not replace brushwork or add fine fur detail. Hero has a natural short bobtail, and Banks follows his approved mature v5 design. Gameplay uses Paint; Pixel assets are historical fallbacks, without a gameplay style selector. Modular body/expression registration is the standing actor workflow.

The dated contracts below are preserved verbatim from GAME.md, including superseded experiments, scope limits and temporary scaffolding. A move does not reactivate old rules: explicit supersession and later user decisions still win. In particular, later natural-bobtail, modular-expression, Paint-only and painted-cutout decisions override their older flame-tail, full-body-expression, selectable-Pixel and voxel trials. New tooling proposals in the next sections are recommendations, not shipped features or permission to repaint approved assets.

## Asset library and production

Follow [the asset taxonomy](./public/assets/README.md): approved runtime art by purpose/character, original production inputs and provenance in `sources`, retired pixel art in `deprecated/pixel`. Preserve versioned originals, prompts, source sheets, alpha, rig/atlas registration and fallback behavior. Keep exploratory renders in `output/` or `artifacts/`.

ImageGen supplies authored characters, foliage, rocks, illustrations and other recognizable forms. Code-generated assets may supplement or, once Eric approves, replace ImageGen art; follow the [procedural asset playbook](#procedural-asset-playbook-2026-10-20). HTML/CSS/JS supplies composition, deposited washes, lighting, motion, masking and interactive tuning around those assets. Preserve opaque cream/white body areas and genuine translucent edges. Never bake a diagnostic paper rectangle, UI lettering, ground shadow or gameplay glow into a transparent sprite.

## Reviewed reference: Watercolor Pigment Lab

Source: sroman81, [watercolor 3](https://codepen.io/sroman81/pen/jEypxaB), reviewed 2026-10-19 through the CodePen HTML editor. The embedded document calls itself Watercolor Pigment Load Lab, pass 1.2. Its HTML pane contains the complete HTML, CSS and JavaScript. This review describes observed source; the game adaptations below are proposals. Retain attribution and verify applicable source/asset licensing before copying code.

### What the reference actually computes

- **Canvas 2D, static raster generation.** JavaScript builds scalar fields in `Float32Array`s, writes `ImageData`, and scales an offscreen canvas into the display. CSS lays out a collapsible control panel and preview. This is a procedural paint approximation, without a time-stepped fluid solver, WebGL simulation or SVG watercolor filter.
- **Reproducible conditions.** FNV-style string hashing and Mulberry32 seed the paper, mask, front and deposit noise. Seeds include a rerun nonce and offsets. Same seed alone is insufficient to reproduce a rerun; preserve the nonce and settings too. Random/Wild use unseeded randomness to choose a new configuration, then rendering uses the seeded paths.
- **Paper relief.** `makeSmoothNoise` interpolates random grids with smoothstep. `makePaper` combines broad, middle, fine and micro noise with sinusoidal short fibers and pits into height/grain maps. Paper height influences deposition; visible grain is also added at composition time.
- **Shape and loading masks.** Noisy signed-distance rounded rectangles and ellipses produce soft masks and interior edge distances. `frontAt` describes top, diagonal, side, center, pooled or bottom loading. A smooth transition mixes thin and heavy pigment. Separate low-frequency density variation and a broken narrow front deposit prevent uniform fills.
- **Water-shaped pigment fields.** Fixed water sources are transformed into along/cross-flow coordinates, stretched according to mobility and current direction, and perturbed by noise. Analytic core, broad-wash and rim functions lighten the center, concentrate a broken rim and add downstream pigment. Density and staining alter removal/retention. This does not advect conserved pigment or simulate drying over time.
- **Granulation and edge pooling.** Paper valleys and sparse speck masks add concentration according to the profile's granulation. A narrow interior edge band deposits more pigment, with extra lower-edge pooling. These are concentration changes before color composition, rather than a blurred noise overlay.
- **Pigment color model.** Twelve artistic profiles contain RGB observations over white/black plus mobility, density, staining and granulation. `deriveKS` estimates per-channel absorption/scattering coefficients. A 1,025-entry lookup table per channel stores layer reflectance R and transmission T for thickness 0–4.8; thickness saturates at that range. `compositeKM` interpolates the table and applies `R + T² * substrate / (1 - R * substrate + epsilon)`. Composition mode layers these results in shape order. It approximates Kubelka–Munk optics in RGB; its values are artistic controls, not measured spectral pigment data or a physically calibrated color pipeline.
- **Comparison and iteration.** Single swatch, twelve-profile comparison and overlapping composition views share controls. Comparison shares paper/front conditions, but water-source RNG also uses the profile offset, so it is not a perfectly controlled same-water-position comparison. The lab offers a black stripe for opacity inspection, seed history, rerun, random/wild and PNG export. PNG export does not save the complete settings/nonce. Controls debounce rendering by 90 ms; render tickets suppress stale publication, but synchronous pixel loops still block the main thread.

### Useful controls to carry into a game art lab

| Group | Reference controls | Game use |
| --- | --- | --- |
| Pigment load | heavy/thin load, loaded area, front slope/irregularity/softness/deposit | Broad masses, broken wash boundaries and richness |
| Water | pattern, push, radius, rim, flow angle/stretch | Pale blooms, tidal edges and directional washes |
| Surface | edge deposit, granulation, dense variation, paper roughness/visibility | Sparse sediment and pooled boundaries |
| Pigment | white/black RGB, mobility, density, staining, granulation | Approved biome/material palettes with distinct behavior |
| Composition | shape count, overlap, accent load | Layered supporting washes beneath ImageGen forms |
| Reproduction | seed, nonce, view, dimensions, all settings | Exact presets and fair before/after comparisons |

Treat the Pen's slider ranges as exploration ranges. Start with its restrained Cerulean settings (heavy 1.48, thin .22, loaded area .52, water push .86, rim .76) only for lab comparison; tune game palettes against existing art and nighttime lighting. Do not substitute the demo's twelve colors for the game's approved palettes.

## Proposed HTML/CSS/JS tooling and runtime boundary

1. Add a development-only watercolor lab to the existing Proto authoring surface, sharing its actual asset loading and preview renderers. First extract pure seeded functions for paper, conditions, pigment field and color composition; pass settings explicitly instead of reading DOM controls. Keep asset identity/registration independent from pigment presets.
2. Provide three fixtures: swatches over white/black/checkerboard/game-dark grounds; the selected ImageGen asset over a wash; and the real target scene/card at game size. Add original/proposed split view, layer toggles (mask, paper height, thickness, final paint), bounded pan/zoom, reduced-motion and lighting previews. Keep all conditions including water coordinates identical when comparing pigments.
3. Persist a versioned preset containing renderer version, seed, nonce, dimensions, palette/profile coefficients, loading/water/surface/composition settings, asset path/version and intended layer placement. Export/import validated JSON and a PNG preview together. Browser drafts are separate from explicit repository saves; do not serialize session resources, progression or live card removals.
4. Generate on demand at small fixed resolutions, cache by the full preset/asset/version key and reuse textures. Start near existing 256px ground atlases and 378px card masters, then benchmark. Debounce edits, use a worker where worthwhile, cap cache memory and dispose replaced Three.js textures/materials. A ticket check alone cannot cancel a long synchronous loop.
5. Keep the default gameplay result static. If animated paint is later requested, animate an existing shared-clock reveal mask over a cached field, with global/journey pause and a completed static reduced-motion result. Never rebuild pigment fields in per-frame React state or let an effect gate a reward, legal play or discovery.
6. Use CSS custom properties for theme palette references, wash opacity and layer placement; CSS handles layout, opacity and transform. Canvas handles pigment/paper synthesis. SVG/alpha masks constrain paint to authored surfaces. The existing Three.js pipeline receives cached textures and its normal light/shadow treatment. Keep decorative DOM layers `pointer-events: none` and excluded from accessible gameplay content.

### Alpha, color and lighting adaptation

The demo uses an opaque context, opaque ImageData alpha and cream paper. Copying that output onto game sprites creates rectangular paper backings. For game use, separate substrate from pigment and shape coverage. Preserve the original asset alpha with a mask (`destination-in` or equivalent) for interior treatment; render deliberate exterior bleed on a separate bounded layer. Never make cream markings transparent by color-keying white.

Kubelka–Munk R/T composition depends on the substrate: one RGBA overlay cannot exactly reproduce it over every background. Either bake against a known local substrate for a bounded ground/card texture, or retain R/T maps and composite against the actual substrate in a dedicated material if justified. A transparent decorative wash with ordinary alpha/multiply is a cheaper artistic approximation; label it as such and compare over dark/light grounds. Do not claim that deleting the paper fill preserves the demo's optics.

Keep ImageGen identity colors and facial features intact; prefer surrounding washes over globally recoloring approved art. Define color-space conversion explicitly if moving the RGB math into Three.js/shaders: existing `CanvasTexture` ground art is tagged sRGB, while lighting works in linear space. Avoid applying lighting twice, baking night darkness into a reusable texture, or making ordinary pigment emissive. Mana, quest attention and danger emission remain separate authored effects.

## Recommended Proto integration order

| Priority | Existing implementation | Improvement and boundary |
| --- | --- | --- |
| 1 | `src/proto/tableauGroundCover.ts` | Its 256px wash atlas currently uses 85 radial-gradient dabs. Trial loaded umber/ochre soil and olive woodland washes here first. Seeded rims and sparse sediment would add paint structure with little runtime cost. Preserve the separate shadow/grass/stone layers and world anchors. |
| 2 | `src/proto/biomeCardArt.ts` | Bake restrained pigment variation beneath existing ImageGen scenery in its cached portrait compositions. Reuse the twelve stable card views; add preset version to cache identity. Protect ranks/rewards and preserve art during burial and flights. |
| 3 | `src/proto/components/TileSpillArt.tsx`, `src/proto/tileSpill.ts` | Add small cached wash decals between compatible revealed terrain to soften cutout seams. Preserve actual spill rules, ground height, labels, water exclusions and discovery. Do not replace stone/foliage silhouettes with noise. |
| 4 | `src/proto/components/KhadRoots.tsx` and `KhadRoots.css` | Current fixed SVG turbulence/displacement provides ragged pigment. Compare a cached wine/crimson concentration texture clipped into existing vine paths, adding pooled dark interiors while retaining thorn geometry, clearance masks, static glow and the seven-mote bound. Keep the existing filter as fallback. |
| 5 | `src/proto/components/TileDiscoveryArt.tsx` | Enrich the existing broad-stroke fill using a precomputed field. Its comments already document CPU cost of live SVG filtering; do not add another continuously animated filter. Keep movement-earned reveal and ink-only neighbors on their existing clock. |
| 6 | `src/proto/components/InkLoader.tsx` | A baked pigment strip could improve front pooling with the existing cloth/displacement treatment. Lower priority: loader must remain cheap and progress must still follow actual asset preparation. |

Start with ground cover plus the lab, then card backgrounds; those give the clearest comparison without changing recognizable artwork or interaction. Keep the established manaberry blob backsplash, quest luminosity and WebGL/FBM burn as distinct effects. This reference models deposited paint, not a replacement for those effects.

The earlier [Watercolor Bloom inventory](./docs/art/watercolor-bloom-reference.md) describes a different technique: recursively jittered polygon washes. Use it for coarse wash silhouettes if useful, and this pigment lab for concentration/deposit structure. Neither technique changes the approved broad-brush art direction.

## Validation for a future implementation

- Check deterministic output for the full preset, identical-condition comparisons, thickness bounds, finite color math, versioned round trips and cache invalidation. Validate any new save endpoint through the existing authored-data boundary.
- Compare original/proposed at actual game size and 3x detail in the applicable desktop fixtures. Follow GAME.md's current validation priorities for any additional viewport/input work. Inspect alpha on light/dark/checkerboard grounds, seams, protected values/rewards, labels, discovery, lighting, orbit and fixed anchors.
- Measure generation time, interaction latency, idle/travel frame times and cache/GPU memory. Verify pause/resume, static reduced motion, low effects and failed-generation fallback. Do not infer visual correctness or phone performance from a bundle build.
- The initial documentation review did not implement runtime rendering. The first two runtime trials are now recorded below; the remaining proposals stay recommendations.

## Initial pigment-field trial (2026-10-19)

This initial trial is retained as the experimental method; the radial-dab follow-up below defines the current default. `src/proto/watercolorWash.ts` supplies original seeded analytic wash fields: broad irregular pigment pools, water-cleared centers, broken pooled edges and sparse paper-valley deposits. It uses transparent ordinary-alpha composition, rather than the reference's substrate-dependent Kubelka–Munk model. No reference source was copied, and no new ImageGen assets were needed.

- Ground cover replaces radial dabs with a shared 256px wash atlas in woodland/soil palettes, retaining the original litter, grass, contact shadows, placement RNG and anchors. Pixel/failure paths keep the original dabs; each scene still owns and disposes its GPU textures.
- Biome cards bake subtle 128px wash variation beneath the approved scenery and existing rank/resource shading. All twelve stable views remain; full preset/version keys distinguish cached compositions. Unknown terrain gets no wash or biome hint.
- [Watercolor lab](./tools/watercolor-lab.html) opens from tile tooling. It compares the actual original/proposed ground atlases and card compositions, with six paint controls, seeds, biome/view selection, transparency/light/dark preview, browser-local drafts, validated preset import/export and PNG export. Drafts never affect live gameplay. Reviewed settings live in `src/data/watercolorPresets.json`; exporting a file does not save repository changes automatically.
- The renderer has no animation clock or per-frame raster work. CPU canvases use a 24-entry bounded cache; generated card compositions use the existing bounded cache. New paint inherits existing world lighting. Thorn rendering remains outside this pass.

Validation, controls and limitations are recorded in [the implementation note](./docs/art/watercolor-procedural-pass-v1.md). This is an initial artistic approximation: full pigment optics, flow simulation, debug field views and automatic preset saves remain unimplemented.

## Radial dab tooling and defaults (2026-10-19)

The follow-up restores the original radial recipe as the default through `watercolorPaint.ts`. `radialDabs.ts` caches native Canvas gradient bakes using the complete preset, palette, variation and raster size. The default 85 dabs, seed 81723, 18–62px radii, 145px spread and .15 opacity reproduce the original ground wash. Litter, grass, shadows and scene placement continue using their original independent stream; tuning paint must not change them.

The lab now compares **Original / Tuned**. Radial controls include seed, dab count, minimum/maximum radius, horizontal/vertical spread, opacity and two colors for each selectable woodland/soil palette. Additional card-biome colors are carried in the preset JSON. Method switching retains each method's current in-memory draft. The selected draft survives reloads in a separate browser-local v2 key; old pigment-only drafts do not silently select the experimental method on upgrade. Radial exports target `src/data/radialDabPresets.json`; existing pigment presets remain importable and export to their separate file. Export is a review artifact, not a repository save or live-game override.

Radial paint can also enrich the existing cached card-ground layer; all twelve composition views, original source art, unknown-terrain concealment and flight snapshots remain. Both methods retain their bounded CPU caches and scene-owned GPU disposal. The field-based method remains selectable for comparison. Neither method generates plant structure by itself.

Feasibility and a suggested boundary for future plant variation are documented in [Procedural bush variation](./docs/art/procedural-bush-variation.md). That proposal does not authorize replacing the approved bush art.

## Procedural bush prototype (2026-10-20)

The [bush study](./tools/bush-lab.html), linked from the watercolor lab, is an explicit code-only replacement experiment. `src/proto/proceduralBush.ts` constructs a constrained seeded crown layout, tapered curved branches, overlapping yellow/olive/teal directional leaf washes and independent red, stemless, bumpy fruit with blue surrounding light. It does not load, crop, sample or repaint ImageGen imagery. Only the comparison's left reference uses the approved PNG. The second pass adds bent broad brush profiles, warm foreground planes over cool hanging foliage, irregular chipped bark and raster-painted fruit. `src/proto/proceduralBushBaseline.ts` freezes the first renderer for a same-preset comparison with identical growth geometry.

Controls cover renderer, seed, crown fullness/spread, brush edges, warmth and sample fruit count. Show both cutouts on the same generated landscape or checkerboard, enlarged and at true 128px game size; six seed buttons make variation review immediate. Export the transparent 512px cutout and validated JSON containing the renderer version plus preset; legacy plain presets still import. Browser drafts remain scoped to this lab. Runtime bush assets, world placement, fruit counts/rewards and other ongoing art experiments remain unchanged.

Each renderer uses a 12-entry CPU canvas cache, with generation on preset changes rather than animation frames. It is a frontal art study, not an OTT/directional plant renderer or a fluid simulation. The latest same-session desktop comparison measured about 49 ms median per fresh 512px refined bush versus 45 ms for the original, with cached lookups around 0–0.1 ms. These are ten cache-miss bakes after lab startup, excluding PNG encoding; they are not phone/gameplay FPS evidence.

The second pass makes brush direction, warm/cool overlap, bark breakup and fruit less synthetic, but repeated leaf fans and simpler surface painting still differ visibly from the approved illustration. Keep the result as an evaluated prototype; it is not approval to replace the production asset. See the [first-pass record](./docs/art/procedural-bush-prototype-v1.md) and [second-pass methods, comparison and validation](./docs/art/procedural-bush-refinement-v2.md).

A third pass (`bush-study-v3`, `src/proto/bushPainter.ts`) is a DOM-free painter with its own growth model. It paints a lit crown of serrated palmate leaf planes, each either sunlit or shaded, which cast soft shade on the planes behind them. It also includes organically grown limbs (wandering heading, kinks, pinched crotch, uneven girth; not geometric curves) with foliage hanging in front, painted as matte, rim-pooled bark dabs along the grain over a darker lumpy base, painted fruit, and an edge-aware watercolor dab glaze (matte, rim-pooled transparent blots, without relief lighting) that imitates the reference's physical dabbing, plus pigment granulation on every surface (requested 2026-10-20 as a supplement to brushwork, not a replacement). It renders without a browser through `tools/bush-painter-render.mjs`, and the lab opens on it. It is the closest code-only result so far, but remains an evaluated prototype, not approval to replace the production asset. `/proto.html?bushsbx` compares it in-world against the approved bush. See the [third-pass record](./docs/art/procedural-bush-v3.md).

## Procedural asset playbook (2026-10-20)

This is the standing method for code-generated art, distilled from the procedural bush (`bushPainter.ts`, `docs/art/procedural-bush-v3.md`) and Khad Roots (`khadRootGeometry.ts`, `khadRootPainter.ts`, `docs/art/khad-roots-*.md`). Follow it when generating new assets such as trees, woods, rocks or other props. Asset-specific rules elsewhere in this file still win.

### When to generate rather than use ImageGen

- **ImageGen** suits featured, close-up and unique art, where hand-painted quality matters most and a fixed image is acceptable.
- **Procedural generation** suits art that should vary or respond to state: many instances, background or secondary scenery, art that changes with game state (such as fruit counts), or art built from structure (vines, limbs). It costs a per-asset bake and memory instead of downloads and generation runs.
- A **hybrid**, with procedural structure dressed by a small library of approved painted pieces, is a valid middle path.
- A procedural asset replaces approved art only after Eric approves it in a side-by-side review. Until then it lives behind a flag or in a sandbox.

### Architecture

- **DOM-free painter.** It writes straight-alpha RGBA from a preset and a seed, so it runs in the lab, a worker and Node alike. Share primitives instead of copying them: `Layer` (premultiplied float), `dabPass` (watercolour glaze and granulation), `cells` (cellular noise), `noise` and `rng` from `bushPainter.ts`.
- **Off the UI thread.** Add the asset to `paintJobs.ts` and bake it through `paintOffThread` (`paintWorkerClient.ts`). That pool runs up to two workers, encodes the PNG off-thread where supported, and falls back to the main thread when workers are unavailable. Never bake per frame.
- **Caching and fallback.** Cache by renderer version plus the full preset, with bounded entries and revoked object URLs. Show the existing art (or SVG) until a bake lands, and keep it if the bake fails.
- **Versions and baselines.** Version every renderer and geometry (for example `bush-study-v3`, `khad-geometry-v2`, `khad-paint-v1`). Freeze the previous version as a baseline module for comparison and for negative tests, and add a URL flag to show it in place.
- **Painted extent.** Paint into a fixed frame in the asset's own units; clearance masks and protected windows are cut from the painted pixels last.

### Structure: grow, don't draw

- **Grow natural forms.** Clean primitives (quadratic arcs, linear tapers, symmetric layouts, sharp meeting points) read as man-made and are rejected. Grow forms with a walker instead:
  - a course steered loosely toward a few seeded waypoints;
  - a bounded side-to-side sway, with alternating noise control values so it never goes flat, indexed over about twice the planned length so it never saturates;
  - decaying kinks and a curvature limit, so forms bend but never knot.
- **Guard the walker.** Move waypoints that fall inside protected areas to just outside them. Skip a waypoint once it is passed rather than orbiting it. Use step budgets for waypoints that can't be reached. Soft boundaries turn only forms heading outward. A hard guard keeps steps out of protected windows.
- **Divergence by lanes.** Branches from one root get ordered heading lanes, so they only diverge. Converging, crossing or A-frame limbs are illegal.
- **Separate random streams per subsystem** (crown, trunk, fruit, paint), so retuning one never reshuffles the others.
- **Counts as stable prefixes.** For countable features such as fruit, plan the full ordered slot set and show the first N; harvesting removes one without moving anything else.
- **Regrow on failure.** Check each generated part against its rules; a failing part regrows from its next deterministic sub-seed (`id#part#attempt`).

### Paint

- **Value structure over gradients.** Organise form into lit and shaded planes (two-value structure). Light the upper shoulder of a rounded form and let it roll off toward the rim. Never peak lighting at the outline (it turns into dashes), and never use a cylindrical highlight band (it reads as plastic or gloss).
- **Paint along the form.** Paint wood and bark in limb space (along and across the form): a darker lumpy base, plates or dabs laid along the grain with pooled rims and gaps reading as crevices, and stepped tones.
- **Watercolour, not relief.** Use transparent glazes with pigment pooled at the rims and a few lifted centres. Never light the dabs as raised relief; that reads as oil or plastic. Granulation supplements brushwork where requested and never replaces it.
- **Paint order.** Washes and glows go beneath everything. Attachments such as thorns go under their parent, so the parent overlaps their bases. Emission belongs only on upward-facing surfaces where moon response applies.
- **Visibility.** Defining features (thorns, fruit) must stay clearly visible: a lighter body than their surroundings, a lit edge, fine static shimmer and a thin dark outline. Enforce this with a brightness-ratio test.

### Rules as code

- **Name illegal output.** Every illegal output Eric names becomes a named rule constant (`BUSH_CROWN_RULES`, `BUSH_TRUNK_RULES`, `KHAD_ROOT_RULES`), with three things:
  1. a measure run on the generated output or geometry (`crownStructure`, `trunkStructure`, `khadRootStructure`);
  2. a seed sweep in tests;
  3. a negative check (the frozen baseline or a synthetic bad shape) proving the measure catches it.
- **Measures must match the renderer's maths.** Project onto segments rather than nearest samples. Credit pixels to the topmost painted layer. Ignore hairline slits below a minimum width. Use the painted extent, not the ellipse it came from. A measure that disagrees with what you see is debugged before the art is changed.
- **Robust statistics** for population rules: a mean, a 99th percentile and a hard ceiling, never a single worst-case maximum. If a limit changes after measuring, say so and record why.

### Review workflow

- **Render and compare in Node.** Render with Node tools (`node --import ./tools/ts-resolve.mjs …`). Compare against the reference at 1:1 crops, enlarged, and at real game size, then iterate on what the crops show.
- **Give Eric a review surface:** a sandbox or compare view in Proto (`?bushsbx`, `?khad-compare`) with flags to switch versions in place. Browser testing on this machine is prohibited, so Eric reviews in the browser.
- **Record and measure.** Record failed attempts and why in the asset's doc. Measure bake timing (warm medians, per size) and state that it is not a phone or frame-time figure.
- **No commits before approval.** Do not commit procedural art changes as improvements before Eric approves them.

## Migrated standing contracts

These retain their original wording and source context so mixed gameplay/presentation safeguards and historical supersession remain reviewable. GAME.md links directly to each contract.

<a id="contract-001"></a>

### Organic Khad Root growth

Source context: GAME.md / Development baseline.

- Organic Khad Root growth (Eric, 2026-10-19): avoid repeating a stamped binding silhouette on every card. Generate stable per-card asymmetric winding routes, uneven crossings, loose ends and varied hooked thorns; derive group connectors from those strand attachment points and authored card rotation. Preserve value/reward clearance, pigment, glow and bounded embers.

<a id="contract-002"></a>

### Khad Roots wrapping clearance

Source context: GAME.md / Development baseline.

- Khad Roots wrapping clearance (Eric, 2026-10-19): vines may climb and wrap beyond the card base, including side edges and the face, but must never obstruct the card value or any reward. Reserve clear value/reward windows for root paint and particles; preserve recognizable thorn silhouettes and danger effects.

<a id="contract-003"></a>

### Khad Roots danger glow

Source context: GAME.md / Development baseline.

- Khad Roots danger glow (Eric, 2026-10-19): make rooted cards visibly menacing with saturated crimson thorn pigment, a dark contact silhouette and a red/magenta miasma bloom. Add sparse rising red embers using the danger tile's fixed-seed CSS transform/opacity approach, bounded to seven motes per binding without per-frame React updates. Keep the glow static to avoid animating blur filters. Retain painted shapes and clear ranks, pause motes with global/journey pause and show only the steady glow under reduced motion.

<a id="contract-004"></a>

### Khad Roots gloom palette

Source context: GAME.md / Development baseline.

- Khad Roots gloom palette (Eric, 2026-10-19): preserve the thorn shapes but remove pale outlines and fine light accents. Use near-black wine shadows, deep crimson/burgundy pigment and a restrained dark red miasma wash, inspired by Tears of the Kingdom gloom. This supersedes the plum/dry-brush highlight palette; keep procedural painted edges and gameplay intact.

<a id="contract-005"></a>

### Khad Roots brushwork

Source context: GAME.md / Development baseline.

- Khad Roots brushwork (Eric, 2026-10-19): approximate the shared painted art direction with existing CSS/JS/SVG methods first. Use layered charcoal/plum pigment, irregular brush edges and broken dry-brush accents on bindings and connecting vines; retain readable thorns, card values and all per-card/group release rules. Reference: https://codepen.io/scifriday/pen/QvEbVZ (inaccessible during this pass; implemented with the existing procedural SVG approach).

<a id="contract-006"></a>

### Dark tutorial quest art defaults

Source context: GAME.md / Development baseline.

- Dark tutorial quest art defaults (Eric, 2026-10-19): preserve the approved daylight cave-exit and berry-snuffling illustrations as variants. Default both quests to dark, gloomy night variants with a few stars piercing the skies and luminous blue manaberries casting the primary light onto Hero and the surroundings. Retain the approved compositions and watercolor treatment to match the dark game render.

<a id="contract-007"></a>

### Tutorial quest illustrations

Source context: GAME.md / Development baseline.

- Tutorial quest illustrations (Eric, 2026-10-19): Find a way out shows Hero leaving the cave toward manaberries, viewed in third person from behind her deeper inside the cave. Pick the first berry uses the existing Hero-snuffling woodland composition with blue-glowing manaberries. Share each illustration between its discovery pickup and active quest card; preserve progression and other quest art.

<a id="contract-008"></a>

### Loader Hero

Source context: GAME.md / Development baseline.

- Loader Hero (Eric, 2026-10-19): replace the loader’s EXPLORITAIRE label with the matching seated watercolor Hero pose from the supplied reference. Gently wag only her natural short bobtail while assets prepare, keeping her body/paws planted and the existing loading text and ink progress. Reduced motion shows the static pose.

<a id="contract-009"></a>

### Ink asset loader

Source context: GAME.md / Development baseline.

- Ink asset loader (Eric, 2026-10-19): show “Finding Hero so we can assemble...” above a polished textured-canvas bar with flowing ink, referencing https://codepen.io/adnavHenry/pen/BaMjdPK. Progress follows actual opening asset preparation; preserve background warming, accessible progress and static reduced-motion presentation. The reference was inaccessible during implementation; the current procedural SVG cloth/displaced-pigment treatment implements the described effect independently.

<a id="contract-010"></a>

### Asset organization

Source context: GAME.md / Development baseline.

- Asset organization (Eric, 2026-10-17): use the lifecycle/purpose taxonomy documented in `public/assets/README.md`: runtime art grouped by purpose and character, original production inputs in `sources`, and retired pixel artwork in `deprecated/pixel`. Preserve approved versions, provenance and existing fallback behavior; update runtime references and offline production/sync tools when assets move. This supersedes the former mixed actors/biomes/art/vis folder organization.

<a id="contract-011"></a>

### Opening travel quest card

Source context: GAME.md / Development baseline.

- Opening travel quest card (Eric, 2026-10-17): replace the nearby-bush quest textbox with the shared QuestCard, titled “Visit the nearby bush,” using the existing watercolor Hero-snuffling-berries art. Explain dragging Hero’s upper-left card from the Den to the actual sparse-patch reference (normally table:0,1). Preserve quest highlighting, target location, enlarged card inspection and the movement demonstration. Keep this as an active objective without inventing rewards or claim steps; other objective trackers retain their current presentation.

<a id="contract-012"></a>

### Day 01 Happy default

Source context: GAME.md / Development baseline.

- Day 01 Happy default (Eric, 2026-10-16): use the new closed-mouth Happy artwork throughout Day 01, including opening/foraging/supper dialogue, between bubbles and during travel. Dialogue emoji uses the matching Happy art. This supersedes the Day 01 Curious default; Curious remains selectable and Day 02 remains Sad. Preserve explicit browser-saved Scenario emotion and callout overrides. Story default restores Happy on Day 01; sleeping and combat reactions retain their authored poses.

<a id="contract-013"></a>

### Opening-days Hero art and expression naming

Source context: GAME.md / Development baseline.

- Opening-days Hero art and expression naming (Eric, 2026-10-16): use the prone-in-den Hero's broad angular watercolor pigments, grain, warm ears and compact puppy character as the aesthetic for bespoke sitting, standing and four-phase walking artwork across low, elevated and overhead views. Preserve the approved prone pose and combat reactions. Happy is a separate closed-mouth, small/cautious smile; relabel the existing open-mouth Happy artwork as Joyful and preserve it as its own selectable variation, including saved callout choices. Keep Day 01 Curious and Day 02 Sad defaults, with matching bespoke head art and dialogue emoji. Preserve explicit scenario overrides, directional selection, movement and pose registration.

<a id="contract-014"></a>

### Immersive starfield skybox

Source context: GAME.md / Development baseline.

- Immersive starfield skybox (Eric, 2026-10-16): reveal a fixed distant star dome above the physical horizon at steep camera tilts. Follow live camera yaw/pitch without translation or zoom parallax, fade stars toward the horizon and in daylight, and keep terrain, atmosphere, dialogue and controls in front. Top-down has no sky; this is presentation only.

<a id="contract-015"></a>

### Combined actor outline

Source context: GAME.md / Development baseline.

- Combined actor outline (Eric, 2026-10-16): apply the visibility stroke to the assembled actor silhouette, excluding internal watercolor transparency and head/body joins. Expression replacement must retain a continuous neck/shoulder silhouette without rectangular cuts or exposed remnants of the original face.

<a id="contract-016"></a>

### Day 01 Curious default

Source context: GAME.md / Development baseline.

- Day 01 Curious default (Eric, 2026-10-16): use the approved Curious expression for Hero throughout Day 01, including opening/foraging/supper dialogue and between bubbles or during travel. Dialogue emoji uses the same Curious artwork. This supersedes Day 01's earlier Sad default; Day 02 remains Sad. Preserve explicit browser-saved Scenario emotion and callout overrides; Story default restores the authored day mood. Sleeping and combat reactions keep their authored artwork.

<a id="contract-017"></a>

### Curious Hero expression

Source context: GAME.md / Development baseline.

- Curious Hero expression (Eric, 2026-10-16): keep the existing Sad and Neutral assets; Curious is a separate brighter, attentive expression with open alert eyes, inquisitive brows, perked ears and a subtle closed-mouth smile. Reuse the new directional head set across existing bodies via the expression rig and offer Curious as its own saved Scenario emotion choice.

<a id="contract-018"></a>

### Condensed bottom tile labels

Source context: GAME.md / Development baseline.

- Condensed bottom tile labels (Eric, 2026-10-16): use tight natural character spacing without stretching or justifying lines to the tile width. Pack multiline titles with compact leading and anchor the complete block to the padded bottom edge selected by the existing camera-facing quarter-turn orientation, for individual tiles and connected regions in both views. Preserve full titles, biome pigment, physical perspective, relief occlusion, discovery and scene pins. This supersedes centered/top title placement.

<a id="contract-019"></a>

### Hero painted face layers

Source context: GAME.md / Development baseline.

- Hero painted face layers (Eric, 2026-10-16): separate actor facial expression from the painted body pose. Share the resolved expression with dialogue emoji, including saved callout edits, and register faces to each authored pose/view and its moving head joint. Preserve existing body artwork, lighting, heading and animation. The first implementation covers Day 01 sad dialogue with seated low/elevated directional faces; walking, sleeping, combat reactions and additional painted emotions remain future work. Back and true overhead views retain their authored artwork where the face is not readable.

<a id="contract-020"></a>

### Biome tile-label pigments

Source context: GAME.md / Development baseline.

- Biome tile-label pigments (Eric, 2026-10-16): derive physical label styling from the owning tile/region biome. Hero’s Den uses the existing painted rocky den artwork as a textured text fill with brush-like pigment variation, dark outline and pale outer glow for contrast. Retain quarter-turn orientation, physical perspective, relief occlusion, reveal and scene pins.

<a id="contract-021"></a>

### Mana-infused objects

Source context: GAME.md / Development baseline.

- Mana-infused objects (Eric, 2026-10-16): mana and manaberries emit a gentle steady pale-blue glow wherever shown, including exposed tableau cards, card delivery/inspection and resource stacks. Use explicit mana-infused identity for additional item types; ordinary food and foliage do not glow merely because they can yield mana. Keep buried rewards concealed and preserve finite resources, discovery and gameplay.

<a id="contract-022"></a>

### Opening darkness and sparse berry light

Source context: GAME.md / Development baseline.

- Opening darkness and sparse berry light (Eric, 2026-10-16): give the opening den/berry cinematic scenes heavier cool darkness. The single manaberry on the sparse (0,1) bush emits pale blue light with a soft registered halo in immersion and OTT; extinguish the light after its finite harvest. Keep the existing clock, discovery and travel rules.

<a id="contract-023"></a>

### Brush color fill

Source context: GAME.md / Development baseline.

- Brush color fill (Eric, 2026-10-15): use the supplied https://codepen.io/adnavHenry/pen/BaMjdPK SVG/CSS technique as the sketch color-fill reference: progressive broad strokes, fractal-noise displacement of the brush alpha, and subtle multiply-lit paper grain. Preserve authored artwork colors, transparency, movement-earned progress and ink-only neighbor sketches; retain the independent default-on watercolor bleed toggle. This replaces the noise-threshold pigment fill on main terrain/relief surfaces; tiny detail surfaces retain their inexpensive fade.

<a id="contract-024"></a>

### Watercolor bleed

Source context: GAME.md / Development baseline.

- Watercolor bleed (Eric, 2026-10-15): sketch-to-paint pigment gently spreads beyond stroke borders as soft irregular translucent washes, inspired by https://codepen.io/pimskie/pen/VBNdZP. Shared presentation config defaults `bleed` to true; Game settings exposes Watercolor bleed for live toggling without restarting reveal. Follow earned pigment progress in OTT and immersion, retain adjacent ink-only sketches, and taper the bleed into the finished art.

<a id="contract-025"></a>

### The development scenario selector opens Day 01 (Before dark), Day 02 (The darker woods), Day 03 (...

Source context: GAME.md / Authored days and Banks rescue cinema (Eric, 2026-10-15).

- The development scenario selector opens Day 01 (Before dark), Day 02 (The darker woods), Day 03 (Home with Banks), or the existing authored-map sandbox. Restart and switching reset session progress, pending interactions, travel and cinema. Day 03 currently stages the following morning, rather than implementing its full day.
- Sparse manaberries (Eric, 2026-10-15): permanently replace the dirt at (0,1) with Manaberry Patch (sparse), keeping all other saved tiles intact. It has exactly one small watercolor bush on the approach edge beside the direction of travel, one finite manaberry earned by completing its travel solitaire, and no separate gathering tableau or infinifill. Persist the sparse variant as authored data, expose it in the tile editor, and keep harvest depletion in session state. Revisiting does not replenish it. This is an authorized saved-map edit, not a scenario-specific replacement.
- Day 01 visits that sparse bush, then the denser patch at (-1,1) for its finite six-play deal yielding two more manaberries. Use Hero's Callout after the nearby harvest to recall when there was enough food right outside her den and explain why she must now wander farther. Return before dark with three: eat two for supper and retain one carried berry, emitting free light through rest and into Day 02. Scenario day switching starts Day 02 with one reserved berry; the Begin Day 02 action carries the actual remainder. On Day 02 the nearby bush is already picked clean and the denser patch offers only one fresh berry, so preserving the light reserve still requires searching the darker woods. Starting STA is at least 4/6 respectively and adapts to the full authored route. Other scenario travel adds no food. These deals and rewards are slice tuning; stable berry asset, type and source identifiers remain compatible.
- Scripted days advance lighting at milestones, never while reading or waiting. Day 01 returns Hero before sunset and reserves nighttime for home. Their authored clocks supersede the fixed-midnight opening for these scenarios; the sandbox retains manual time controls. Daytime remains dark and moody: noon ambient is 0.38, with meaningful local lights. Global lights remains an explicit presentation bypass.
- Carrying mana emits light without consuming mana. Eating and carried illumination use the same finite reserve. Current shared-expedition scaffolding assigns unstored mana to Hero/the leader; deposited food does not count as carried light. Two manaberries provide a small glow, insufficient for the authored night journey. Independent personal inventories remain future work.
- Day 02's buried mana card glows once exposed; playing it triggers the one-time authored rescue. A Hungry Slime card bursts out and flies into the combat arena, spawning its actor and attack tableau. Hero cowers and falls unconscious after one ordinary enemy attack. This one-hit outcome is scenario tuning, not a global Hero health change. Downed party members retain their authored prone art and orbiting gold stars; reduced motion holds the stars steady. They are unconscious, not dead.
- The reusable cinema beat lifecycle coordinates timed actions, dialogue, pause and completion. Dialogue uses Proto Callout and watercolor expressions. Reading, pause and hidden tabs stop narrative progression; restart tears down timers, card flights and the scene. Cinematic entities bring their tableaus and foundations on entry. Banks's card arrives from off-camera and he is AI-controlled, with no player attack controls.
- Banks is an episodic, overwhelmingly strong visitor. His rank-9 foundation legally clears the complete fourteen-card seeded run through the shared Auto-Solve assessment and ordinary play/AP rules, then spends AP on Scratch and Bite to defeat the slime. His HP, damage and AP prices are mentor encounter tuning; Hunt and Stealth remain unauthored. Actor movement, hit effects and unconsciousness use the shared combat renderer.
- After combat Banks approaches downed Hero, gently nuzzles her using the four-frame watercolor asset, and the whole screen fades to black. Day 03 begins with Hero and Banks in Hero's Den. This request authorizes the additional nuzzle pose sequence, superseding the earlier Banks pose limit for this interaction only. The mature protective v2 paired sequence and its prompts are recorded in `docs/art/banks-watercolor-v3.md`; the original sequence remains archived in `docs/art/banks-rescue-nuzzle-v1.md`.

<a id="contract-026"></a>

### Proto speech bubbles use the dedicated `src/proto/components/Callout.tsx` component and its optio...

Source context: GAME.md / Reusable Proto callouts (Eric, 2026-10-15).

- Proto speech bubbles use the dedicated `src/proto/components/Callout.tsx` component and its optional bounded `useCallouts` lifecycle hook. Reuse actor watercolor emoji atlases, wrap readable sentence-case text, fit bubbles to the viewport, respect reduced motion and preserve underlying pointer input. Live anchors may follow deprecated/pixel/characters/cameras without per-frame React state updates. Callers own discovery gates, pause policy and authored dialogue triggers; this component does not assign new gameplay dialogue. The legacy shared/Golf callouts remain available to their existing consumers.

<a id="contract-027"></a>

### Approved global Banks design

Source context: GAME.md / Banks character artwork (Eric, 2026-10-15).

- Approved global Banks design (Eric, 2026-10-15): `public/assets/runtime/kin/banks/portraits/panther-inspired/banks-watercolor-v5.png` is the authority for all Banks artwork, including travel/combat directions and gait, reactions, expressions and paired images. Rebuild all active Banks assets in its simplified soft watercolor style and mature panther-influenced proportions. Preserve the approved holocard. In Banks + Hero artwork, Banks has a calm, almost parental protective posture: his strong body shelters Hero and his lowered head/nuzzle conveys reassurance. Hero retains her established tricolor identity and natural bobtail. This supersedes the first-pass holocard-only scope and the earlier small-cat/peer-like rescue composition; preserve existing gameplay and pose states.
- Mature redesign (Eric, 2026-10-15): globally move Banks toward an athletic, mature panther-influenced silhouette, with a presence roughly between Luxio and Luxray. Use a stronger chest/shoulders, longer body and legs, proportionately smaller head/ears, broader muzzle and smaller watchful almond eyes; avoid kitten proportions. Retain his gray/slate tabby identity, pale green eyes, light muzzle and natural ringed tail, without accessories or copied Pokémon markings. Keep the broad loose watercolor medium across holocard, sprites, emojis and paired cinema. This supersedes matching Hero's juvenile proportions and earlier large round eye guidance for Banks.
- Banks's brushwork reference is `public/assets/runtime/abilities/takedown/light-wash/takedown.webp`: soft broad flowing strokes, merged wet washes and feathered pigment boundaries, with deeper charcoal/indigo contrast and richer slate saturation. Preserve his mature redesign; simplify hard tiny fur marks and serrated edges into larger soft masses. Deliberately omit fine fur rendering and most individual stripes: the torso reads as a handful of large merged washes. Mature anatomy must not introduce photorealistic surface detail; keep line accents minimal.
- Banks is the supplied gray shorthaired tabby cat, with pale green eyes, a light muzzle and a long ringed natural tail. Draw him without a collar, tag or accessories. Baseline abilities: Bite, Scratch, Hunt, Stealth; new Hunt/Stealth mechanics remain unauthored.
- Use Hero's existing travel/combat sheets only as pose, direction, elevation and gait templates: standing, sitting, four walking phases, flinch and down. The approved Banks v5 holocard governs his mature proportions and simplified soft brushwork. Do not add ability-specific, belly-up, hunt, stealth, pounce or loaf sprite poses. His holocard uses the same character identity and watercolor direction.

<a id="contract-028"></a>

### Hero has a natural bobtail, with no fire tail, tail emitter or flame response to spirits. Preserv...

Source context: GAME.md / Mana survival and spirit discovery direction (Eric, 2026-10-15).

- Hero has a natural bobtail, with no fire tail, tail emitter or flame response to spirits. Preserve archived effect code and assets, but exclude them from active engine loading, rendering and settings. This supersedes earlier flame-tail requirements. The active ordinary-day portrait has no flame tail.
- The next vertical slice opens with a guided basic day: Hero gathers food and returns to her cave before dark. This sequence is on rails; free nighttime travel with increased danger is future work. The scripted day is planned work, not an implemented deadline; its eventual clock explicitly supersedes the fixed-midnight opening for that sequence.
- Daytime remains fairly dark and moody, with meaningful local light.
- Mana serves as both food and carried light. Actors carrying mana illuminate their surroundings. The scarcity decision is finding enough to eat today while retaining enough light to find food tomorrow. Food and carried light must use the same finite reserve. Ownership, quantities and recovery need implementation and tuning; passive light does not imply mana consumption over time.
- Cir is a distant, unusually luminous flame spirit visible from the den. Finding Cir may relieve the food-versus-light constraint, allowing Hero to eat enough mana to journey beyond the berry bush. Longer journeys introduce sleeping away from the den, more mana sources, less luminous spirits, Mochi and other animals. Motivation must not depend on Hero having a fire tail. Encounter fiction and exact companion benefits remain to be authored.
- The intended loop is gather and budget mana, venture by its light, discover spirits or animals and new sources, then extend future expeditions. The first basic day establishes the constraint before Cir expands the possibilities.

<a id="contract-029"></a>

### Adjacent terrain sketches

Source context: GAME.md / Mana survival and spirit discovery direction (Eric, 2026-10-15).

- Adjacent terrain sketches (Eric, 2026-10-15): earned traversal progress also develops the closest relief outlines of orthogonally adjacent, discovered unfinished tiles. Trees/woods and berry bushes should become recognizable along the shared border as the neighboring crossing is solved. Neighbor progress contributes ink only, never pigment, terrain completion, rewards or discovery; distant terrain remains concealed. Derive the ink from persistent traversal progress so the world retains this detail when returning. This supersedes withholding adjacent terrain shape hints.

<a id="contract-030"></a>

### Sketch relief placement

Source context: GAME.md / Mana survival and spirit discovery direction (Eric, 2026-10-15).

- Sketch relief placement (Eric, 2026-10-15): while traversable terrain retains its unfinished sketch/watercolor presentation, group its relief props along the tile border nearest the traveler, leaving the central travel lane clear. Use world-space approach rather than camera facing; finished terrain retains its normal layout and fully concealed terrain stays hidden.

<a id="contract-031"></a>

### Mobile settings and art retirement

Source context: GAME.md / Mana survival and spirit discovery direction (Eric, 2026-10-15).

- Mobile settings and art retirement (Eric, 2026-10-14): settings hidden by the mobile layout remain available in the settings menu, including time of day, day/night cycling, table lights and light readout. Keep the menu within the viewport and scrollable on short screens. Remove the art-style selector and saved-style gameplay wiring; gameplay always uses the approved watercolor presentation. Pixel art is deprecated. This supersedes earlier Pixel/Paint switching and preservation requirements for gameplay UX; historical assets and isolated legacy helpers may remain pending cleanup.

<a id="contract-032"></a>

### Actor and compact actor-card drags propose a destination and preview a legal route. Confirm its c...

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Actor and compact actor-card drags propose a destination and preview a legal route. Confirm its cell count, travel-card count and estimated STA before moving. Remove the manual travel-speed slider. Preserve grid targeting, camera controls, actor follow, arrival encounters and persistent gathering deals.
- Traversal difficulty is terrain data with actor-specific affinity multipliers (for example water affinity for an Otter). Initial defaults: open table/path/den 0, dirt 1, berries 2, woods 3, water 4 STA per orthogonal cell; diagonals scale by distance. Positive difficulty seeds seven dirt cards or twelve other terrain cards per crossed cell. Never seed the origin. Unknown terrain remains unnamed in route previews. Locks and impassable terrain remain blocked; dangerous terrain is an encounter destination.
- A finite master travel tableau retains each card's source terrain, uses a seven-column visible window with at most 28 cards and feeds remaining travel cards beneath removals. Adjacent ranks wrap A–K. Any legal play advances the current route segment, regardless of card provenance; finishing its work reaches its Cairn milestone. Cairns are milestones, not mandatory special cards. Movement animates only earned distance; zero-cost stretches need no cards. Gathering, rest and combat deals remain separate.
- STA is independent of INSP and is spent fractionally as travel is earned. Consecutive legal plays earn 2% less STA per additional play, capped at 20%. Initial playtest balance: a shared 24 STA travel pool, replenished on an awake return to the den. Confirming requires enough STA for the undiscounted estimate. Travel cards still bank one utility AP per legal play. Travel spending supersedes the stamina-free card-play rule for this mode only.
- Berry travel cards have an independent seeded 20% chance to carry berries. On each Berry Patch crossing, a seven-card uninterrupted local streak grants three bonus berries once; subsequent streaks on that same segment cannot repeat the bonus. Global streaks span tile boundaries; the berry qualifying streak begins anew on each tile. Collected berries convert to mana in the existing haul. Reset trail costs one foundation INSP, guarantees a legal continuation, and breaks both streaks; invalid actions and pauses grant nothing. These values are initial tuning, not permanent balance targets.
- Travel occupies the existing tableau area and supports tap/click/Enter, explicit pause/resume and confirmation cancellation. Traveling actors cannot be rerouted until arrival. Ordinary-day gathering progress remains intact.
- Newly discovered traversable terrain uses the shared sketch/watercolor filter driven by persistent traversal progress, replacing elapsed-time completion. Early progress shows rough contours; pigment arrives after the first quarter; its final Cairn removes the filter and restores full color and prop animation. Waiting, camera changes and Paint/Pixel changes never finish or restart this fill. Previously finished terrain stays finished. Non-traversable terrain retains timed discovery. Keep gameplay discovery from actual actor movement and preserve fog on distant cells.
- Random travel obstacles/enemies and extra high-streak reward tiers remain follow-up work; existing authored arrival encounters continue to run.

<a id="contract-033"></a>

### Curious Sapling

- Village seedling variant: paint the grid-map seedling in a straight-down orthographic view. The user’s maple seedling photo guides its scale and the Hero berry painting guides the watercolor treatment. The transparent sprite keeps light and particles separate for live fog and camera movement. Runtime is `public/assets/runtime/village/ground/curious-sapling-overhead-seedling-v2.png`; the matching master and exact prompt are under `public/assets/sources/village/ground/curious-sapling-overhead-seedling-v2/`. The side-view v1 study is retained.

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Curious Sapling (Eric, 2026-10-13): add a safe woods tile at (0,-2), with a small loose watercolor sapling in OTT and immersion. Set immersive relief height to 2 with uniform scaling that preserves its silhouette; retain normal discovery and wood-only exploration. Connect it as a scenery emitter to the shared light engine, activating on discovery and following the Table lights toggle. Its soft warm-green light uses strength 0.65, radius 3 cells and crown height 2.

<a id="contract-034"></a>

### Hero main-card brushwork

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Hero main-card brushwork (Eric, 2026-10-13): redraw Hero's main Paint card using the same hand-dabbed watercolor styling as the "An ordinary day" quest illustration. Maintain the starry forest background and warm flame lights on the trees, with matching portrait/landscape layers and existing parallax. Preserve her main-card pose, identity, large ears, flame placement and shared foundation/inspection artwork. Current assets and prompts are recorded in `docs/art/hero-main-ordinary-day-v1.md`.

<a id="contract-035"></a>

### Ability artwork subjects

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Ability artwork subjects (Eric, 2026-10-13): ability-card paintings show only the acting friendly character demonstrating the action. **No enemies or slimes**, including slime fragments, stretched gel, droplets or substitute opponents. Preserve the approved soft diffuse watercolor, distinct actions and readable card framing. Fetch and Dig retain their ordinary card/earth props. Enemy-free combat revisions are recorded in `docs/art/ability-watercolor-v3.md`.

<a id="contract-036"></a>

### Ability watercolor softness

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Ability watercolor softness (Eric, 2026-10-13): use more diffuse broad wet brush strokes and softer diluted colors for all ability-card paintings. Merge small fur/foliage marks into larger washes, feather and lose edges, reduce dense ink contrast and harsh orange/purple saturation, while retaining recognizable actor markings, faces and actions. Current sources, prompts and runtime assets are in `docs/art/ability-watercolor-v2.md`; retain the first pass for reference.

<a id="contract-037"></a>

### Watercolor ability cards

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Watercolor ability cards (Eric, 2026-10-13): give every authored Proto ability dedicated action artwork using the shared loose watercolor methods. Use it consistently in Paint playable/held cards, compact and jumbo inspection, and cards opened from actor loadouts. Keep title, AP and effect text separate and readable, retain Pixel fallbacks and gameplay. Sources, prompts and runtime assets are recorded in `docs/art/ability-watercolor-v1.md`.

<a id="contract-038"></a>

### Mochi watercolor sprites

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Mochi watercolor sprites (Eric, 2026-10-13): Paint uses matching loose watercolor Mochi directional artwork in OTT, map immersion and battle, retaining her chunky long-haired tortoiseshell identity, asymmetric charcoal/copper/tawny markings, bright eyes, tufted ears and plume tail. Preserve the shared rig, world headings, lighting, alpha and smooth sampling, with Pixel originals available. Sources, prompts and packing are recorded in `docs/art/mochi-watercolor-v1.md`. This supersedes the earlier Pixel-only Mochi direction for these sprites; den sleeping/cuddle and card artwork retain their existing art until requested.

<a id="contract-039"></a>

### Tile discovery drawing

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Tile discovery drawing (Eric, 2026-10-13): newly discovered tiles etch their terrain contours over about 1.1 seconds, then slowly fill with an irregular watercolor wash over 6.2 seconds, inspired by Scott Kellum's Watercolor fill (https://codepen.io/scottkellum/pen/PoVjeEZ). OTT ground/prints and immersive scenery share one discovery clock; camera and Paint/Pixel changes never restart it. Preserve alpha, lighting, actor occlusion, clear deprecated/pixel/characters/titles and immediate gameplay discovery. Previously known startup/load tiles remain finished; reduced motion shows full art immediately. Remove the temporary filter after completion. This supersedes the instantaneous full-color discovery presentation, not discovery/travel or tableau-work rules.

<a id="contract-040"></a>

### Hero's natural tail

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Hero's natural tail (Eric, 2026-10-13): Hero has a natural furry bobtail, following the supplied real-dog reference. The ethereal flame tail is an optional effect layered over that anatomy, never baked into the body artwork. Keep its visibility controllable at runtime and its flame pieces independently animatable in OTT and immersion, with reduced-motion support. Expose a moving emitter attachment and intensity for the planned light-source integration; do not introduce new gameplay activation rules or a new lighting system as part of this asset change. This supersedes earlier plume/long-tail art prompts.

<a id="contract-041"></a>

### Actor environment matching

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Actor environment matching (Eric, 2026-10-13): world actor sprites receive reusable surrounding light rather than retaining full unlit asset brightness. The Three.js battle uses one linear-space diffuse sample per actor from the landscape's hemisphere, moon and local lights, shared across all joints and directional poses. Preserve authored palettes, alpha, gameplay tints and readable hit flashes; camera orbit must not change illumination through billboard normals. Reuse uniforms and avoid per-frame raster processing or extra render passes.

<a id="contract-042"></a>

### Battle actor peek-through

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Battle actor peek-through (Eric, 2026-10-13): apply actor-centered irregular cutout openings to foreground props in the Three.js battle scene, tracking live actor poses, movement and camera views. Keep scenery behind actors and outside openings intact. The feature is called **actor peek-through** (`actorPeek.ts`, with the Three.js material integration in `actorPeekThree.ts`).

<a id="contract-043"></a>

### Biome card variation

Source context: GAME.md / Tableau card sizing (Eric, 2026-10-12).

- Biome card variation (Eric, 2026-10-13): use 12 cached views per biome/style. Stable card-ID seeds select framing, zoom, prop placement and foliage density independently of rank. Preserve views through burial, reveal and flight; prioritize exposed cards and warm the remaining pool between interactions.

<a id="contract-044"></a>

### Biome tableau card backgrounds

Source context: GAME.md / Tableau card sizing (Eric, 2026-10-12).

- Biome tableau card backgrounds (Eric, 2026-10-13): dynamically compose tableau playing-card faces from the selected biome's existing tile ground/overhead artwork and immersive scenery through reusable biome recipes. Share cached portrait compositions across cards, respect live Paint/Pixel selection, preserve readable ranks/resource icons and buried-card silhouette/reveal behavior, and retain the displayed biome background during card flights. Cover rest, exploration and combat; keep actor foundation artwork separate. This supersedes the universal Hero holocard night landscape background.
- Exploration, rest and combat tableau cards never exceed their rendered foundation card's width or height. Keep complete portrait cards at the same standard 63:88 playing-card ratio as actor foundation cards, including buried cards. Fit narrower or shorter viewports by uniformly reducing card size and retaining stack overlap; extra tableau space does not enlarge cards beyond the foundation.

<a id="contract-045"></a>

### Use CJ Gammon's “Winter Trees” (https://codepen.io/cjgammon/pen/ONWeZX) as spatial inspiration fo...

Source context: GAME.md / Starlit woods tableaus (Eric, 2026-10-12).

- Use CJ Gammon's “Winter Trees” (https://codepen.io/cjgammon/pen/ONWeZX) as spatial inspiration for woods tableau backgrounds: scattered layered trees, rolling woodland ground and soft distance haze, with a darker starlit sky. Build the forest from our original watercolor tree cutouts in Paint; retain Pixel tree artwork when selected. Share this landscape with the combat arena. Trees sway gently about fixed ground anchors; reduced motion keeps them still. Woods tableau freecam starts enabled, with mouse/touch orbit, pan and zoom plus keyboard movement, without taking input from cards or foundations. This does not change the map's explicit immersion selection.

<a id="contract-046"></a>

### Modular sprite and art workflow

Source context: GAME.md / Scope and workflow.

- Modular sprite and art workflow (Eric, 2026-10-16): default to reusable rigged artwork for sprite and actor-art efforts, especially immersive sprites. Keep body artwork independent from swappable expression heads/faces. Reuse existing approved expression artwork (including Hero's sad faces) across compatible body poses; mask the original head/face where needed so it cannot show through or double up. Register attachments per authored pose and view with position, scale, rotation, pivot and neck overlap, and attach them to the animated head joint so heading, gait, lighting, opacity and occlusion remain coherent. Provide reusable registration/preview controls rather than baking each expression into a fresh body atlas. Generate only missing expression heads or directional/elevation angles; do not force a front face onto a profile. Preserve existing bodies and animation, using full-body redraws only when the requested body design/pose actually requires them. Carry the approach into OTT wherever applicable; retain authored back/overhead art when a face is not readable. Validate attachment seams, angle selection and expression switching in the live game. This is the standing direction and does not require reaffirmation for each sprite/art task; implementation gaps noted elsewhere describe current coverage, not exceptions to this workflow. This supersedes expression-driven full-body redraws while preserving existing asset versioning and source/provenance requirements.

<a id="contract-047"></a>

### Sprite requests

Source context: GAME.md / Scope and workflow.

- Sprite requests (Eric, 2026-10-11): whenever it is plausible to build sprites for both immersive and over-the-top (OTT) modes, build both and wire them into the game immediately after ImageGen. This authorizes built-in ImageGen for requested sprite work despite the earlier Gemini preference.

<a id="contract-048"></a>

### Sprite artwork workflow

Source context: GAME.md / Scope and workflow.

- Sprite artwork workflow (Eric, 2026-10-10): Gemini handles image generation for sprite artwork; reserve Codex usage for development, asset preparation/integration and validation. The handoff in `docs/gemini-sprites/START-HERE.md` records prompts and the current rig contract. Its proposed delivery packaging is a production convention, not a new runtime loader requirement.

<a id="contract-049"></a>

### Natural border balance

Source context: GAME.md / Presentation.

- Natural border balance (Eric, 2026-10-13): dirt and berry tiles share earth underfoot, so do not spill raised soil clods over berry foliage. On vegetation–mountain borders use smaller separated foliage patches mixed with clearly visible slate/cream stone groups from the mountain, retaining gaps instead of a continuous hedge. Printed stones remain legible above nearby foliage; retain varied immersive relief and the minimum height of 1. This supersedes the earlier raised earth spill onto vegetation.

<a id="contract-050"></a>

### Intermingled tile borders

Source context: GAME.md / Presentation.

- Intermingled tile borders (Eric, 2026-10-13): foliage, earth and stones from compatible adjacent tiles overlap both sides of their shared seam, including berry–mountain borders. Preserve the strongest coverage at the dividing line and use deterministic varied immersive heights (at least 1) for local scenic topography. Hidden tile titles must not reserve empty gaps in this border scenery; keep visible titles legible. Retain fixed anchors, overhead presentation, discovery and gameplay rules; ground itself remains at elevation 0.

<a id="contract-051"></a>

### Woods height proportions

Source context: GAME.md / Presentation.

- Woods height proportions (Eric, 2026-10-13): retain height 8 for immersive painted woods and pines, scaling both width and height uniformly around their fixed ground anchors so trees preserve their authored silhouettes. Share these proportions with shadows and atmosphere masks. This supersedes vertical-only compression for woods; mountains retain height 11.6 and their current presentation.

<a id="contract-052"></a>

### Woods and mountain heights

Source context: GAME.md / Presentation.

- Woods and mountain heights (Eric, 2026-10-13): swap their calibrated Paint immersive reference heights: full woods/tree scenery is 8 and mountain peaks are 11.6, at a fitted 46-world-pixel footprint. Scale vertical artwork only, keeping ground widths and anchors fixed; share the change with silhouette shadows and atmosphere masks. Mountain connectors follow the peak increase, and painted edge trees follow the woods height. OTT and inspection artwork retain their authored prints. This supersedes preserving these two immersive scenery heights.

<a id="contract-053"></a>

### World scenery height

Source context: GAME.md / Presentation.

- World scenery height (Eric, 2026-10-13): use an uncapped, non-negative height scale independent of camera zoom, footprint and ground elevation. Height 1 is 20% of the current painted berry scenery crown envelope; berry reference height is 5. The fixed conversion is `46 × (3/7) / 5` world pixels per unit (about 3.943), defined in `sceneryHeight.ts`. Ground stays at elevation 0. Spill rules may author a `relief` height, with minimum and default 1 in immersion; den stone spill is 1 in immersion and remains an overhead print in OTT. Relief meets the ground and stays fixed in world space through orbit. Larger heights, including spires above existing mountains, have no mountain-based cap; keep ground footprint separate. Preserve existing scenery proportions unless explicitly reauthored.

<a id="contract-054"></a>

### Ground and edge spill brushwork

Source context: GAME.md / Presentation.

- Ground and edge spill brushwork (Eric, 2026-10-13): Paint dirt tiles, den stone spills and berry/earth spillover use matching broad watercolor washes, slate/cream/indigo stones and moss/olive foliage with pink/wine accents, with smooth sampling in OTT and immersion. Preserve Pixel artwork and presentation-only deterministic placement. Runtime assets and generation prompt are recorded in `docs/art/watercolor-spill-v1.md`.

<a id="contract-055"></a>

### Painted den interiors

Source context: GAME.md / Presentation.

- Painted den interiors (Eric, 2026-10-12): present resting Hero inside the directional den paintings, on their authored interior floor and clipped behind the entrance's inner stone edges. Front and front-quarter views show her within the hollow; closed side, rear-quarter and rear walls hide her naturally, as explicitly requested. Do not cut windows through these walls. Reuse existing actor art and share the painting's trim, mirror, lighting and camera projection. Suppress the duplicate outside ground drawing in Paint immersion while retaining the original world actor, occupied-square grip, visible-body interaction, keyboard inspection, travel and arrival behavior. This supersedes the independent overhead floor drawing for Paint den occupants; OTT and Pixel keep their existing roof/floor layering. No new actor rig or raster art is required.

<a id="contract-056"></a>

### Den painted orbit views

Source context: GAME.md / Presentation.

- Den painted orbit views (Eric, 2026-10-12): provide original front, front-quarter, side, rear-quarter and closed rear watercolor assets for Paint immersion, covering eight camera directions with mirrored side/quarter views. The den entrance remains fixed toward world north; select the appropriate painting relative to that heading as the camera orbits. The display plane may face the camera to present the authored view, like the directional actor renderer, but must never keep showing the entrance from behind or collapse to a thin plane from the side. Keep a fixed contained ground anchor, smooth sampling, shared lighting, silhouette shadows, atmosphere and actor occlusion. Do not voxelize, carve or reconstruct these paintings. Preserve the existing OTT print/roof, inspection front, actor placement/interaction and Pixel north-facing cave volume. This supersedes both the carved Paint den and single-view fixed-plane experiments. Trees, bushes and mountains retain their approved cutouts. The independent resting-actor heading and den occlusion exception remain applicable. Sources and prompts are recorded in `docs/art/watercolor-den-orbit-v1.md`.

<a id="contract-057"></a>

### Den and impassable mountain brushwork

Source context: GAME.md / Presentation.

- Den and impassable mountain brushwork (Eric, 2026-10-12): apply the same broad wet-dab, merged-wash and deliberately simplified painting method as the revised berry bushes to the den and impassable mountains in OTT and immersion. Use matching slate/cream/indigo source art, overhead prints and painted mountain floor/ridge connectors, with smooth Paint sampling and shared live inspection selection. Pixel retains the carved north-facing cave and closed rear; preserve resting actor floor placement and the den occlusion exception. Paint mountains use their original camera-facing cutouts like the bushes, with fixed contained ground anchors, connected terrain placement and shared light/shadow/occlusion; this supersedes solid reconstruction for Paint mountains. Retain impassable/discovery behavior and Pixel solids. Keep historical painted sources. Assets and prompts are recorded in `docs/art/watercolor-den-mountains-v2.md`.

<a id="contract-058"></a>

### Den occlusion exception

Source context: GAME.md / Presentation.

- Den occlusion exception (Eric, 2026-10-12): do not cut actor peek-through holes in the Den for actors using its resting artwork inside it. Cave walls and roof naturally obscure those actors during orbit; other scenery and traveling actors retain the shared peek-through behavior.

<a id="contract-059"></a>

### Den visual correction

Source context: GAME.md / Presentation.

- Den visual correction (Eric, 2026-10-12): place resting actors as compact, fixed north-facing overhead artwork on the cave floor in immersion, rather than oversized vertical cards. The resting print follows ground perspective and remains behind cave stone. Cave reconstruction uses a broad dome and roof stone colors rather than sweeping the entrance's painted bands into concentric shelves. Preserve the entrance, roof, rear, shared lighting and actor interaction.

<a id="contract-060"></a>

### Den orbit correction

Source context: GAME.md / Presentation.

- Den orbit correction (Eric, 2026-10-12): the painted Den uses the shared carved cave relief with a fixed world-north entrance, closed rear and substantial side walls. Preserve painted source colors, ground, overhead print and roof. This supersedes the painted Den camera-facing cutout requirement; trees and bushes retain their approved cutouts. Immersive static den/rest actor artwork retains its fixed world-north orientation during camera orbit; OTT rest artwork retains its placed heading. Do not turn resting actors toward the camera. This single-view rest artwork remains a presentation approximation, not a directional 3D actor rig.

<a id="contract-061"></a>

### Physical table cards

Source context: GAME.md / Presentation.

- Physical table cards (Eric, 2026-10-12): cards rest above the table on shared card-stock layers, with a thin visible edge and contact shadow that follow camera orbit and zoom. Held cards retain their readable pickup presentation with greater shadow clearance. Tableau cards share the stock-edge and contact-shadow treatment; empty slots remain recessed.

<a id="contract-062"></a>

### Fixed immersive reliefs

Source context: GAME.md / Presentation.

- Fixed immersive reliefs (Eric, 2026-10-12): tiles and their relief geometry retain their authored world position and heading during orbit. Volume projection canvases may counter-rotate to display the camera's view of fixed geometry; this must not be removed or replaced by fixed flat planes. Painted scenery currently uses the camera-facing cutouts specified below, not relief geometry; locking those planes edge-on is not an equivalent to fixed 3D scenery. Actor and UI facing behavior remains unchanged.

<a id="contract-063"></a>

### Berry brushwork correction

Source context: GAME.md / Presentation.

- Berry brushwork correction (Eric, 2026-10-12): in both OTT and immersion, berry bushes follow the broad wet-dab painting guidance below. Suggest each crown with a few large merged foliage washes and pink/wine pigment accents; deliberately lose individual leaf, branching and berry-bead detail. Avoid glossy berry highlights, repetitive tiny marks and grain used as a watercolor substitute. Keep the separate low bushes, transparent gaps and existing gameplay. Revised assets and prompts are recorded in `docs/art/watercolor-berries-v2.md`.

<a id="contract-064"></a>

### Painted den and berry patch

Source context: GAME.md / Presentation.

- Painted den and berry patch (Eric, 2026-10-12): extend the approved painted woods approach to Hero's Den and the Berry Patch. Paint uses loose watercolor slate-rock den and separate low leafy berry-bush masses with pink/wine berries, rendered as original transparent, smoothly sampled camera-facing cutouts in immersion, without voxel/relief reconstruction. Supply matching painted overhead prints and earth floors, preserve the separate actor/foreground-roof layers, contained fixed anchors, shared lighting, shadows and actor peek-through. Update inspection art through the same live Paint/Pixel selection. Pixel retains its existing assets, orientation and volumes; den/berry gameplay, actor poses, discovery, mana rewards and unrelated scenery remain unchanged. This supersedes earlier pixel/voxel presentation requirements for these two places in Paint mode. Assets and prompts are recorded in `docs/art/watercolor-den-berry-v1.md`.

<a id="contract-065"></a>

### Painted trees/woods

Source context: GAME.md / Presentation.

- Painted trees/woods (Eric, 2026-10-12): use the supplied three-pine watercolor image's aesthetic and render the original painted cutouts directly in-game. Preserve their loose brushwork, pigment, silhouette, true alpha and smooth sampling; do not voxelize or reconstruct them as 3D reliefs. Immersive cutouts face the orbital camera with fixed, contained ground anchors, shared lighting, silhouette shadows and actor peek-through. Show their painted color once discovered, independently of foraging/exploration progress; undiscovered tiles remain concealed. Use the matching painted OTT print, card art and combat-demo woods; preserve the Pixel variants and unrelated scenery. This supersedes the painted relief trial and the earlier solid-form requirement for Paint trees/woods. Retain that experiment for reference; the current assets and integration are documented in `docs/art/watercolor-woods-sprites-v1.md`.

<a id="contract-066"></a>

### Immersive actor peek-through

Source context: GAME.md / Presentation.

- Immersive actor peek-through (Eric, 2026-10-12): when reliefs or props block the camera's view of an actor, cut an actor-centered oval opening with a stable irregular, chipped edge like the supplied reference. Apply the opening only to overlapping foreground artwork, reveal the normal live actor, and keep scenery opaque outside the opening and behind the actor. Share the behavior across reliefs and plane props; track live travel, orbit and zoom without another actor rig, full-screen pass or per-frame pixel readbacks. A cached browser-composited alpha mask is an equivalent to a shader. OTT remains unchanged. This supersedes whole-prop dimming/transparency and the x-ray actor outline in earlier environment/opaque-relief rules.

<a id="contract-067"></a>

### Paint asset audit

Source context: GAME.md / Presentation.

- Paint asset audit (Eric, 2026-10-12): Hero's static sleeping den pose uses matching painted immersion and overhead cutouts in Paint mode, including rest quest decoration. Keep Pixel originals and live switching. Unconverted companion/cuddle and scenery assets retain their existing presentation. Source and measurements are recorded in `docs/art/hero-sleeping-watercolor-v1.md`.

<a id="contract-068"></a>

### Game art selection

Source context: GAME.md / Presentation.

- Game art selection (Eric, 2026-10-12): Paint is the default. An upper-right settings cog exposes a Pixel/Paint art style selector, remembers the choice locally and updates available map, combat and card artwork immediately. Preserve both asset sets. Assets without a painted counterpart retain their existing presentation; this selector does not authorize generating replacement scenery or actors outside the requested art scope.

<a id="contract-069"></a>

### The approved reference is `output/imagegen/hero-watercolor-v7-rich-loose-preview.png`

Source context: GAME.md / Presentation.

- The approved reference is `output/imagegen/hero-watercolor-v7-rich-loose-preview.png`: loose hand-dabbed watercolor with the richer charcoal/orange palette, not the finely rendered earlier versions. Apply this default to new actor artwork and explicitly requested art passes, including friendly actors and enemies in OTT, immersion and combat. This supersedes earlier pixel-art requirements for actor entities; scenery, typography, card frames and unrelated assets keep their existing directions. Do not silently repaint actors outside the requested scope.
- Build the image from broad, irregular wet brush dabs and a small number of large pigment pools. Suggest fur or other surface features with masses, not individual hairs, neatly cut triangular shards, ear-hair veins or repeated tiny strokes. Deliberately lose small details. Soft wet-on-wet transitions, water-diluted fades and occasional pooled richer pigment should explain form. Retain saturated identity colors and deep values where appropriate; watercolor does not require a uniformly pale/desaturated palette.
- Edges vary: uneven brush-dab boundaries, feathered washes, softly lost edges and selective harder pigment boundaries. Permit controlled color bleed beyond the sparse drawn contours and imperfect wash registration. Do not make every fur clump into a crisp serrated cutout. Avoid polished digital shading, vector-clean shapes, dense continuous outlines, photographic gloss and uniformly sharp borders. Do not simulate the medium with grain, stippling, gritty paper noise or procedural microtexture.
- Use sparse expressive charcoal/indigo ink-brush accents, with pressure variation and broken/tapered strokes, to clarify eyes, nose, mouth, stance and a few major anatomical separations. Preserve expressive readable faces and silhouettes at game scale. Ink accents support the broad paint rather than outlining every surface detail. Small highlights may clarify eyes; extensive glossy rendering is inappropriate.
- Preserve each actor's species, identity colors, marking placement, anatomical side differences, proportions and authored directional/pose behavior. Hero uses rich charcoal/slate, warm copper/golden-orange, creamy white blaze/muzzle/chest/paws, amber eyes, gentle curious brows and approved large perky ears. Her tail is a small ethereal red/orange/yellow watercolor flame apparition with real partial transparency and fading edges, not burning fire or a solid fur plume. Dark slimes retain their irregular purple/indigo gelatinous forms and cyan eyes; broad pooled washes replace pixel highlights and tiny surface detail.
- Production sprites have true transparent backgrounds and gutters, no paper rectangle/checkerboard, text, signature, scenery or baked ground shadow. Cream/white body areas remain opaque; fading edge bleed and spectral effects may be partially transparent. Preserve this alpha through packing and rendering. Use smooth sampling for painted actors while keeping pixel scenery sharp.
- Generate complete coherent bodies for each direction and pose, then deterministically measure and pack them. Never assemble independently generated anatomical pieces. Retain the shared world-heading, directional/elevation selection, joint hierarchy, paw-cycle registration, reaction priority and OTT proportions. Do not let stylization change gameplay hit areas or movement.
- Preserve existing artwork. New paint passes use versioned sibling files and retain prompts, source sheets, atlas measurements and validation evidence. Hero and combat-sandbox enemy slimes are the current authorized sprite conversion; other actors remain future work.

<a id="contract-070"></a>

### Hero holocard

Source context: GAME.md / Presentation.

- Hero holocard (Eric, 2026-10-12): use the approved smooth ink-and-watercolor Hero cutout with enlarged perky ears and a small translucent flame tail over the separate starry night forest. Compact and jumbo art planes follow the existing pointer/touch/device spring with modest opposing parallax and background overscan; foundations and reduced motion remain static. Keep warm tail-light baked into the landscape aligned through bounded motion. These approved layered runtime assets and prompts are currently retained in this game checkout, separately from legacy flat portraits in Exploritaire-art.

<a id="contract-071"></a>

### Hero walking

Source context: GAME.md / Presentation.

- Hero walking (Eric, 2026-10-12): use the shared directional animation rig for a four-phase generated walk cycle in overworld travel (OTT and immersion) and combat movement. Authored paw phases retain the existing head/torso/hind hierarchy, low/elevated/overhead selection, world heading, longer OTT proportions, lighting and hit/fall priority. Ground distance advances the gait; stopping restores sitting, stationary attacks retain standing, and reduced motion holds the first walk phase. Preserve existing idle and den/rest artwork.

<a id="contract-072"></a>

### Hero OTT proportions

Source context: GAME.md / Presentation.

- Hero OTT proportions (Eric, 2026-10-12): lengthen Hero's sitting and standing overhead presentation along her nose-to-tail axis at the same width. The flat print and shared sectional rig use a 1.25 length scale about their ground center; elevated/low artwork and den rest poses retain their authored proportions.

<a id="contract-073"></a>

### Dirt tile

Source context: GAME.md / Presentation.

- Dirt tile (Eric, 2026-10-11): reusable `dirt` ground with pixel earth artwork, flush with the table in OTT and immersion. Place it at (0,1). Retain shared ground travel, discovery, inspection and resource-free exploration behavior.

<a id="contract-074"></a>

### Berry Patch ground

Source context: GAME.md / Presentation.

- Berry Patch ground (Eric, 2026-10-11): use a textured pixel woodland floor beneath the distinct bushes in both OTT and immersion, flush with the table. Bushes remain grounded and fully rendered without the ground plane truncating their voxel projections.

<a id="contract-075"></a>

### Den ground

Source context: GAME.md / Presentation.

- Den ground (Eric, 2026-10-11): extend the cave's brown pixel dirt across the entire den ground tile, including the formerly dark green area outside the rocky mouth. Use the same flat earth beneath OTT artwork and immersive cave reliefs, retaining the established rock, actor, roof and title layers.

<a id="contract-076"></a>

### Den and berry scenery

Source context: GAME.md / Presentation.

- Den and berry scenery (Eric, 2026-10-11): redraw the OTT den in the adjacent impassable mountains' slate pixel palette, with continuous rock joining the left, right and southern neighboring tiles and no table-ground gaps at those joins. Keep its north-facing hollow, separate resting actors and complete title. Immersive den voxel height is 50% of its former height; berry-patch voxel height is 30% of its former height (a 70% reduction). Compress vertical geometry only, preserving ground footprint, fixed heading, lighting, shadows and interactions. This supersedes preserving those scenery types' original height proportions.

<a id="contract-077"></a>

### Opaque voxel reliefs

Source context: GAME.md / Presentation.

- Opaque voxel reliefs (Eric, 2026-10-11): tile outlines, table grid lines and the horizon where tile rendering stops must never show through opaque voxel rock or foliage. Keep the finite ground-light wash behind the physical scene; voxel faces already receive world lighting. When reliefs obscure actors, dim their material while preserving opaque coverage and the shared actor outline. This supersedes transparency-based fading for voxel scenery and the ground wash projected over objects; actual open cave mouths and gaps retain their geometry.

<a id="contract-078"></a>

### Den actor artwork

Source context: GAME.md / Presentation.

- Den actor artwork (Eric, 2026-10-11): whenever an actor occupies the den and has authored den/rest artwork, use it in both OTT and immersion, including foundation occupants and awake actors. Hero and Mochi use their individual rest sprites or their shared cuddle sprite when together. This is presentation only: awake-at-home gameplay, supper and explicit Curl up remain unchanged. Travel keeps movement artwork; actors without den/rest artwork retain their normal presentation. The OTT rocky roof also remains present over awake actors using den art. This supersedes the awake sitting/standing presentation at home.

<a id="contract-079"></a>

### Mochi artwork

Source context: GAME.md / Presentation.

- Mochi artwork (Eric, 2026-10-11): globally match Hero's chunky, cute and expressive pixel style, with a larger rounded head, bright expressive eyes, compact fluffy body, rounded paws and simpler fur shading. Preserve Mochi's long-haired tortoiseshell cat identity, asymmetric charcoal/copper/tawny markings, pointed tufted ears and plume tail. Apply this to all low/elevated/overhead sprites and her shared card illustration. This artwork request authorizes built-in ImageGen for the redesign despite the earlier Gemini workflow preference.

<a id="contract-080"></a>

### Hero sitting and expression

Source context: GAME.md / Presentation.

- Hero sitting and expression (Eric, 2026-10-10): Hero sits while idle and stands during movement, using complete low/elevated/overhead directional sitting artwork with the shared rig. Her explicit bedtime sleeping pose remains separate. Every Hero art asset uses gentle curious/inquisitive tan brows rather than inward-downward angry brows; closed sleeping eyes stay closed. This request authorizes built-in ImageGen for these artwork additions and corrections despite the earlier Gemini workflow preference.

<a id="contract-081"></a>

### Ordinary day artwork

Source context: GAME.md / Presentation.

- Ordinary day artwork (Eric, 2026-10-13): the "An ordinary day" quest card uses dedicated loose brush-dab watercolor art of Hero snuffling through the berry patch in Paint mode, retaining her tricolor Australian Shepherd identity. Draw her tiny natural furry bobtail close to the rump, matching the supplied smaller-bobtail redesign, with no flame tail in this illustration. Preserve the original scene in Pixel mode. Use the scene throughout the day, with card text and actions rendered separately. This supersedes the earlier pixel-only quest illustration.

<a id="contract-082"></a>

### Hero at home

Source context: GAME.md / Presentation.

- Hero at home (Eric, 2026-10-10): in immersion, Hero always faces out toward world north while within the Hero's Den tile, awake or resting, including foundation occupancy and travel through the tile. Camera orbit never changes that heading. Outside the den retain movement/authored facing; tabletop keeps its existing presentation.

<a id="contract-083"></a>

### Berry Patch

Source context: GAME.md / Presentation.

- Berry Patch (Eric, 2026-10-10; planting updated 2026-10-11): use the distinct `berry-patch` tile type, with dedicated overhead pixel art and low, rounded berry bush voxel scenery. Present multiple small, distinct bushes with visible ground gaps between their crowns rather than one continuous oblong mass, in both views. Show leafy crowns, short woody stems and visible fruit clusters on all sides, occupying most of the tile. Do not substitute pine trees or woods edge scenery. Discovered bush art is fully visible independently of foraging progress; retain the finite berry deal, travel and discovery rules.

<a id="contract-084"></a>

### Hero's Den orientation

Source context: GAME.md / Presentation.

- Hero's Den orientation (Eric, 2026-10-11): hardcode the den mouth facing away from the mountains, toward world north. Reverse the OTT sprite and foreground roof by 180 degrees and align den rest actors with the opening. The immersive voxel recipe retains its fixed north heading (180 degrees baked into geometry, lighting normals and shadows); its source axes differ from the OTT print. Keep the den asymmetric, with a visibly open dark arch, closed rear and distinct side walls. Camera orbit and occupancy never change its orientation.

<a id="contract-085"></a>

### Voxel tile scenery

Source context: GAME.md / Presentation.

- Voxel tile scenery (Eric, 2026-10-10): Hero's Den uses the shared voxel renderer with a carved entrance, substantial walls, roof and rear. Default voxel scenery is centered and sized by its ground width to occupy most of its tile, with complete two-axis containment. Preserve authored height proportions, world orientation, lighting, shadows, actor occlusion and top-down prints. This supersedes the den's flat-plane renderer and edge-biased placement; reeds retain their authored planes.

<a id="contract-086"></a>

### Pixel-to-voxel materials

Source context: GAME.md / Presentation.

- Pixel-to-voxel materials (Eric, 2026-10-10): default sprite-derived solids wrap source detail over both ground axes, with continuous material on side faces and stepped ledges. Do not stretch a sprite column or its dark outline through the entire depth. Preserve explicitly authored asymmetric materials, carved openings and world lighting. Reuse geometry and lighting variants during orbit, batch projection transfers, and keep destination bitmaps at their source raster size instead of redundantly enlarging them before upload.

<a id="contract-087"></a>

### Default day quest size

Source context: GAME.md / Presentation.

- Default day quest size (Eric, 2026-10-10): reduce its width and height by 35% to 163.8 × 228.8 CSS pixels, preserving 63:88 geometry. Keep text and actions readable; the compact objective preview provides the full text through the shared mouse/touch tooltip.
- Immersive actor names (Eric, 2026-10-10): keep complete names at a bounded readable screen size below the sprite's feet, clear of its body at every zoom and heading. This supersedes world-scaled front-rim lettering for map actors; top-down and foundation labels retain their existing presentation.

<a id="contract-088"></a>

### Immersion actor shrink scaling

Source context: GAME.md / Presentation.

- Immersion actor shrink scaling (Eric, 2026-10-09): actor sprite bodies and their cast shadows shrink inversely with camera zoom above the starting 1.7× view, down to one-quarter world size at 6.8×. Scale uniformly about their feet for every sprite pose, retaining heading, lighting and occlusion. Props keep their world scale; token bases, readable names and full-square actor grabs retain their existing size. OTT and foundation/inspection artwork retain their authored sizing. Zooming out restores the body size.

<a id="contract-089"></a>

### Scenery depth

Source context: GAME.md / Presentation.

- Scenery depth (Eric, 2026-10-09): immersive trees and mountains must retain recognizable solid forms from the front, sides and rear throughout camera orbit. Extend existing pixel artwork through reusable sprite-derived volumes, with fixed world placement, two-axis ground footprints, world lighting and solid-derived shadows. The display canvas may billboard while the depicted solid retains its world orientation. Preserve top-down overhead art and discovery/input rules. This supersedes the single-plane scenery trial for trees and mountains; the cave and reeds retain their current authored planes until extended separately. Reconstructed side/rear detail is a presentation approximation that can be replaced by authored geometry or materials.

<a id="contract-090"></a>

### Global actor orientation

Source context: GAME.md / Presentation.

- Global actor orientation (Eric, 2026-10-08): every world actor and pose has a world heading independent of the camera. Travel turns actors along their movement; stationary actors retain that heading across camera/view and pose changes. Scene/pose authors can set a resting heading (Hero sleeps aligned with her den). Directional rigs choose authored views relative to this heading; their render canvas may billboard, but their depicted facing must not follow the camera. Single-view poses use a fixed world plane until directional artwork exists, including Hero's sleeping sprite. Top-down body prints inherit world rotation. Camera-facing names, UI tokens and inspection cards remain readable UI, separate from actor body orientation.

<a id="contract-091"></a>

### Use a dark board-game aesthetic with pixel typography, strong borders, high contrast, and consist...

Source context: GAME.md / Presentation.

- Use a dark board-game aesthetic with pixel typography, strong borders, high contrast, and consistent 2D depth and shadows.
- Ground baseline (Eric, 2026-10-08): keep the square table grid for now. Existing biome ground is flush with the table at elevation 0 (sea level), with square corners and no bezel, thickness shadow or raised ground surface. Scenery and physical objects retain their own depth; selection and drop cues mark the ground without lifting it. Future topography supplies actual terrain elevation.
- "Card" means a portrait playing-card-sized/aspect-ratio object, not an arbitrary rectangular panel. Use a locked playing-card ratio (63:88 by default); an established explicitly authored card ratio must also remain locked. Wide panels and variable-proportion surfaces are board pieces or objects, not cards.
- Maintain card aspect ratios. Available layout space must not distort resource cards, foundations, quest cards, or detail cards. Fit the entire stack by adjusting uniform card scale and overlap offsets, never by independently resizing a card's width or height.
- A stack contains full-size cards. Every underlying card retains its normal dimensions, aspect ratio, border, and corner radius. Use positional offsets and layer order to reveal portions of those cards. Upper cards physically cover the borders and corners beneath them. Never render an underlying card as a shortened, independently rounded horizontal band.
- Apply the stacking rule to existing and future card-stack components, including quest stacks and tableau stacks, while preserving each stack's intended exposed edge and interaction order.
- Keep text inside padded object boundaries. Wrap at word boundaries where possible and handle long unbroken text safely.
- Text-fitting components must define a readable minimum and maximum size. Do not shrink indefinitely or allow copy to escape its parent. If content cannot fit at the minimum, provide an explicit contained fallback with access to the full text.
- Minimum game text size: **16 CSS px (12 pt)**, including secondary labels, counters, instructions, and text-fitting floors. The prior quest subtitle was 12 CSS px (9 pt); this raises the floor by 3 pt, meeting the requested increase of at least 2 pt. Responsive rules must not reduce text below this floor. Adapt layout rather than shrinking text; review existing smaller text against this baseline when changing its component.
- Tile names stay stable as the camera zooms; zoom must not replace names with initials or different copy.
- Tile names have transparent backing and a dark outline outside the characters for contrast, rather than a black label box.
- Immersive label visibility (Eric, 2026-10-09): actor sprites take priority over tile and terrain titles. Lift conflicting titles above actors in the camera projection; resolve title collisions from nearby places to background terrain. Hero's Den clears Hero, and Impassable Mountains clears both with a farther-back, slightly smaller and dimmer presentation. Keep text upright and at a readable bounded screen size rather than stretching it with low-angle ground perspective. Recompute for travel, occupancy, zoom and camera orbit; keep complete names and leave OTT title placement unchanged.
- Tile labels on demand (Eric, 2026-10-11): tile and terrain titles (including shared region titles such as Impassable Mountains, and Hero's Den) are hidden by default in both cameras. A title shows while its tile (or its scenery) is under the mouse or pen, while the tile has keyboard focus, and for about four seconds after a tap or click; a tap still opens the tile's details as before. Placement and collision rules above apply whenever a title is showing. Actor names are unaffected.
- Connected tile labels (Eric, 2026-10-09): discovered tiles sharing the same type and title and touching along an edge show one complete label per connected group. Place it in the group's largest filled rectangular area and hide every other member's smaller label, in both camera views. Keep distinct named types, disconnected groups and diagonal-only contacts separate. Hidden tiles never join a group; labels never bridge the den, fog, gaps or other terrain. This label rule applies to mutable biomes too, without merging their artwork, deals, inspection cards or interactions.
- OTT tile titles (Eric, 2026-10-08): place discovered biome and terrain titles at the top of their footprint in top-down mode, keeping complete upright text inside the rotated ground bounds. Immersion retains its existing title placement.
- Hero's Den title (Eric, 2026-10-09): in OTT, keep the complete label on a single row at the bottom of its tile, inside the rotated footprint. Immersion retains its existing placement.
- Hero's Den aesthetics (Eric, 2026-10-09): when unoccupied in immersion, place the cave at the opposite (north) end of its tile, aligned with the adjacent mountain sprite props; retain its occupied sleeping-hollow placement. In OTT, the foreground roof follows the irregular outlines of its boulders and protrudes over Hero's crown, leaving her face and paws visible; never cut the roof with a straight horizontal edge.
- Game layouts must not use scrollbars. Allocate space according to content needs, using available tableau space for foundation content. For genuinely constrained views, use deliberate reflow or navigation rather than hiding inaccessible content or merely concealing scrollbar chrome.
- On mobile, use Table / Tableau / Quests panel navigation so each field receives usable space without vertical page scrolling. Preserve every authored tableau column (six for den rest, seven for existing exploration/combat) and check portrait and landscape layouts in isolated headless browser tests.
- Inside each actor's foundation border, the energy bubble (⚡ and the actor's current energy) and the collected-cards count stack in a column to the left of the actor's card; the border widens to hold them. Resources collected during tableau play are listed beneath the foundation as icon and count pills (uncollected ones dimmed); there is no separate resources badge.

<a id="contract-092"></a>

### Exploration foundations omit the separate Energy / Next / Turn / Mobility summary strip; use its ...

Source context: GAME.md / Presentation.

- Exploration foundations omit the separate Energy / Next / Turn / Mobility summary strip; use its vertical space for larger player foundation cards while preserving portrait proportions and fitting short screens.

<a id="contract-093"></a>

### Cleared tableau columns retain their layout space without a dashed placeholder.

Source context: GAME.md / Presentation.

- Cleared tableau columns retain their layout space without a dashed placeholder.
- Permanent tableau (Eric, 2026-10-09): the tableau and foundation surfaces are permanent parts of the table layout. Keep their space visible when no tableau is selected, with no cards, actors or controls in the empty field. Mobile panel navigation retains an enabled Tableau tab for this empty surface.

<a id="contract-094"></a>

### Quest aesthetics

Source context: GAME.md / Quest cards.

- Quest aesthetics (Eric, 2026-10-09): use the supplied illustrated trading-card reference as a motif: worn terracotta framing, a gold quest emblem, bold pixel title panels, framed character artwork, dark inset objectives, and bottom-anchored rewards or actions. Use Exploritaire's own artwork and retain portrait geometry, readable text, completion cues and mouse/touch behavior. Compact tray cards may reduce the illustration to preserve their readable title and contained objective preview.

<a id="contract-095"></a>

### Preserve the day/night scaffold, moving global light source, local table lights, and consistent o...

Source context: GAME.md / Lighting.

- Preserve the day/night scaffold, moving global light source, local table lights, and consistent object shadows.
- Keep lighting compatible with 2D rendering and object interaction.
- The default table has no placed light object. Actors carry their own light through a `luminosity` property (0-1). The default is candlelight: enough to find an actor in the dark, but never enough to explore by (it lifts its surroundings only to "dim"), and it fades out in daylight.
- A carried light moves with its actor every frame of travel, never jumping to the destination when the move ends.
- The light wash is all soft gradients, so it paints at reduced resolution (half a CSS pixel flat, a quarter tilted). Full-resolution flicker redraws of the oversized tilted plane stall input and slow reward holds on phones.
- The table opens at 09:00 (`TABLE_OPENING_HOUR`), and every later day starts at 09:00 too.
- The time slider must track a dragging pointer smoothly, even on a slow phone: the clock text beside it has a fixed width so the slider never shifts as the phase changes, and the table re-lights at most every 120ms during a drag as an interruptible update. `tools/time-slider-playwright.cjs` checks it.
- Tabletop/immersion playtest (Eric, 2026-10-08): top-down is a static physical board-game presentation for moving actors. No cardboard pop-ups, prop scenery, cast shadows, live light wash or atmospheric effects appear there, including the Dark Woods. Actors use flat named tokens. Biomes use dedicated overhead pixel sprites (`*_topdown.svg`) only in top-down, with the shared exploration reveal and stable names; the Dark Woods has a fixed printed danger marker. Staffed encounters automatically tilt and zoom toward their biome; leaving restores the previous tabletop framing. Manual camera controls remain available. This is the current playtest direction.
- In the tilted camera, an actor with sprite art (`WORLD_ACTOR_SPRITES`) stands up as a pop-up cut-out instead of the cardboard token: padding trimmed so its feet meet its base, pixel-sharp, shaded by the light reaching it with a warm rim toward the strongest nearby lamp, and casting its silhouette away from the sun or moon and each lamp (never from its own carried candle). Art that fails to load falls back to the token. The actor's details card may use dedicated portrait artwork inspired by the standee, with its own background.
- Tilted pixel-art standees (actors, biome pop-ups and edge scenery) stay sharp at every zoom. The browser rasterizes 3D layers at their layout size and stretches them with the camera, so each standee is laid out `STANDEE_OVERSAMPLE` (6) times larger and scaled back down inside its own 3D transform. The raster allowance covers the 4.5× close-up camera and near-side perspective. `tools/standee-sharpness-playwright.cjs` checks it.
- Standees rotate about their foot before being placed, and the camera zooms in 3D, so pieces stay planted on the table at every zoom level.
- Biome tiles can carry pop-up scenery (`BIOME_TILE_SPRITES`): Small Woods shows a cluster of pixel-art pines (`public/assets/deprecated/pixel/environment/small_woods_pines.png`, drawn by `tools/make-pine-sprite.py`). Tilted, the pines stand at the back of the tile, taller than the Hero, so the tile's label stays readable in front; top-down, dedicated overhead tile art replaces the pop-up. The tile itself is their base. Tapping the pines counts as the tile; drops go by the grid square under the pointer, so tall scenery never takes a drop meant for a neighbouring square. `tools/biome-popup-playwright.cjs` checks it.
- Camera direction (Eric, 2026-10-08): moving actors uses the static top-down tabletop; engaging with the world enters an immersive camera view. Upright scenery, lighting, shadows and atmosphere are exclusive to immersion.
- Tilted, biome tiles are lined with scenery down their left and right sides and, shortened, along their front edge (the pond with reeds, the woods with young pines and ferns; drawn by `tools/make-edge-scenery-sprites.py`, laid out by `biomeEdgeScenery.ts`). The props shrink toward the camera. None may cover the tile's label: the label reports where its text sits, and a prop in front of it steps outward to clear it, is cut down to the height that clears it, or is left out. Flat tiles carry no edge scenery. `tools/biome-popup-playwright.cjs` checks it.
- Tilted ("immersion") lighting aims for an HD-2D look (Octopath Traveler, Sea of Stars). Lit pixel art, meaning actors, biome pop-ups and edge scenery, catches the strongest nearby light: the side facing it glows in the light's colour and the far side falls into shade (`LightWash`, masked to the sprite's pixels). Each edge prop is lit and casts shadows where it stands. Biome ground stays at sea level; label ink has a small rendering offset above cut-out shadows to preserve legibility without raising the ground.
- Tilted ambiance (`atmosphere.ts`, `TableAtmosphere.tsx`): a glow hangs in the air around each lamp and carried light, flickering with it. Sun shafts slant across the view, faint at noon and strong at golden hour, with dust motes drifting through them by day. Everything is anchored to the world: shafts are pinned along the table's x axis and motes are scattered per world cell (only the cells in view), so they pan and zoom with the table. Each biome's particles come from `BIOME_AMBIANCE` (one line per effect: kind, count per tier, patch around the tile); world-wide effects come from `WORLD_AMBIANCE`. Mist and smoke sit behind a tile so they never cover its label. Cool moonbeams fall after dark. Fireflies come out over the woods and pond from dusk. The pond fizzes: glints by day, glowing bubbles at night. It is all a few small elements animated by CSS transform and opacity, never takes input and never feeds game rules. The low tier (`?fx=low`, reduced motion, or a small device) keeps halos and rays and drops the particles and prop shadows; `?fx=high` forces the full set. Top-down has none of it, including danger effects. `tools/tilt-ambiance-playwright.cjs` checks it.
- Immersive volumetric direction (Eric, 2026-10-07): light should feel weighty and occupy the air between pieces. The high tier uses world-anchored shafts, slow uneven haze and scenery occlusion, with clear dark gaps and protected labels and sprite edges. Pools, airborne glow and dust response share a visual clock; the gameplay light field stays steady. The current implementation is a bounded WebGL billboard volume with a sprite-derived canopy height atlas, adaptive resolution/cadence, and a simpler Canvas fallback. Its canopy and air-depth approximations are presentation scaffolding rather than new gameplay geometry. Low quality keeps CSS rays. `?atmosphere=off` permits a development comparison; `?atmosphere=canvas` exercises fallback. `tools/volumetric-lighting-playwright.cjs` checks rendering, occlusion, fallback, desktop layouts and pointer/touch camera input.
- Immersive fallback token standees have a 1.5px die-cut edge. Top-down has no cardboard edges.
- While a piece is dragged across the table, a biome that would accept it glows gold with a pulsing outline; the cue clears when the pointer leaves it or the piece is dropped. `tools/drop-target-playwright.cjs` checks it.
- Neighbouring tiles lay their edge scenery out together (`layoutTableScenery`): where two tiles share an edge neither keeps its own props there, and one run follows the seam instead (side-style where it runs away from the camera, the short front fringe where it runs across the view), so a row of woods reads as one wood. Between different terrains the run alternates the two sets (reeds thinning into ferns), each prop lit and revealed with the tile whose set it's from. Every prop keeps clear of every label as the camera sees it, and a pop-up standing just in front of another tile's label is fitted to clear it. Pop-up fitting scales width and height together and uses the live perspective: narrowing the art can retain a readable middle prop at a low camera angle, so an authored-width height limit must not make it disappear during zoom.
- Pop-up shadows are the shadows of a flat board facing the camera: the base stays on the piece's foot line and the silhouette leans away from the light (a shear, never a rotation about the foot), so wide pieces like the pines cast from their trunks.
- Switching between Flat and Tilt eases the camera both ways (about half a second) instead of snapping: the table and its light wash lean together, the table never shows its edge mid-move, pieces pop up from their bases halfway into the lean and return to printed tiles and flat tokens halfway out. Reduced-motion users get an instant switch. `tools/tilt-animation-playwright.cjs` checks it.
- The table camera spins about the view centre, in Flat (like turning the board on the table) and Tilt: Q / E and the toolbar's ↺ ↻ buttons turn it 45° with an ease, a middle-button drag spins it freely, and a three-finger twist spins it with the fingers. Double-clicking a turn button or Reset View eases it back to 0°. W, A, S and D glide the camera relative to the view while held (W always toward the far side of the screen); keys are ignored while typing or in a dialog.
- Camera input (Eric, 2026-10-07): mouse left-drag grabs pieces and pans from empty table; right-drag pans from anywhere, pieces included, and never opens a context menu (a plain right-click still reaches the dev menu); middle-drag spins; the wheel zooms anywhere over the table, pieces included. Touch: one finger grabs pieces and pans from empty table; two fingers pan and pinch-zoom together; three fingers spin. Pans follow the pointer at any spin, and a press on an actor's square still takes the actor.
- A standee's base is a true circle lying on the table, so the camera's tilt draws it as the same level ellipse at any spin.
- Immersion actor names stand vertically around the front circular rim of their token bases, with tight natural character spacing and the word centered on the camera-facing middle of the token rather than stretched across its visible width. The name arc follows the camera's yaw so it stays readable as the view turns; lettering remains anchored to the moving actor and top-down retains its flat named token.
- The spin lives in the camera's world transform (`rotate(yaw) translate scale`, `useCameraControls`), published as `--camera-yaw`. Everything facing the camera turns against it: standees, edge scenery and ambiance billboards, flat round tokens, flat token names and tile labels stay upright. Table quest cards retain their placed heading until picked up. Lighting is given in the camera's frame (rim light, LightWash and standee shadows), the light canvas redraws turned, shafts take the sun's screen side, and pointer input (drops, hover, grab-on-square, quest-card drags) undoes the spin. Scenery that sits at the back or front of a tile (pop-ups, edge scenery's front row, mist) follows the tile side nearest the camera by quarter turn, and edge props keep clear of the upright label in the camera's own frame. `tools/camera-spin-playwright.cjs` checks it.
- In immersive mode, tableau cards stand upright facing the player, like cards in a vertical rack. Preserve full portrait card surfaces and the existing vertical peek spacing: only each buried card's value/icon row shows above the card in front. Keep ranks sharp and readable. Flat retains the tabletop presentation.
- Immersive tableau scenery reuses the selected biome's pixel prop theme behind the cards, with layered parallax, light shafts, mist and motes. Cards and foundation props sample the shared ambient and local-light engine; decoration never intercepts input. Reduced motion removes movement and the low FX tier drops particles.
- The camera tilt also leans each foundation card back, and an actor with sprite art pops up from the top edge of its actor card, standing above the card so it never covers the energy bubble, card count or resource summary. The foundation makes room above for it (less on short screens).

<a id="contract-096"></a>

### Fixed immersive scenery trial

Source context: GAME.md / Temporary scaffolding.

- Fixed immersive scenery trial (Eric, 2026-10-08): tile pop-ups and edge props use fixed vertical world planes and fixed world placement. Orbiting the camera must not turn, relocate or resize them to face the player. Lighting, shadow feet, owning footprints and actor occlusion follow the same world orientation. Current single-view artwork becomes thin edge-on and is mirrored from behind; this is a presentation trial, not a requirement for new directional prop assets. Camera-facing labels and actor rendering retain their separate behavior. This trial supersedes the camera-following scenery placement rules below while active.

<a id="contract-097"></a>

### Connected mountains

Source context: GAME.md / Grid coordinates.

- Connected mountains (Eric, 2026-10-08): adjacent immutable mountain cells overlap into one continuous rocky range. The tabletop print has opaque interior rock and transparency only along the range's outer boundary, with no transparent per-cell gutters. Every mountain cell uses its type's upright sprite in immersion; overhead peaks are omitted there. Connected scenery may overlap neighboring mountain cells, with its ground foot constrained to the shared region rather than each individual cell. Per-cell blocked interactions, shared titles, lighting and actor occlusion remain active.

<a id="contract-098"></a>

### Occupied den layering

Source context: GAME.md / Grid coordinates.

- Occupied den layering (Eric, 2026-10-11): keep Hero's Den text clear of every actor sprite throughout camera orbit and zoom. In OTT, a complete single-row title may extend below the tile when actor clearance requires it, superseding strict tile containment. Resting sprites sit deeper beneath the irregular foreground roof; roof stones cover their crowns while faces and paws remain visible. Immersion retains actor-priority label placement and physical cave height.

<a id="contract-099"></a>

### Movement-driven sketch/watercolor reveal

Source context: GAME.md / Grid coordinates.

- Movement-driven sketch/watercolor reveal (Eric, 2026-10-15): persistent reveal follows actual party movement through each tile, bounded by tableau-earned distance. Begin at the entry border, paint through the center, and finish at the exit border (or destination center on arrival). Banked card distance paints only as walked; pauses freeze painting. Preserve earned paint and adjacent ink-only sketches. This supersedes immediate card-play reveal progress.

<a id="contract-100"></a>

### Actor card text refinement

Source context: GAME.md / Ordered traversal and point-of-interest iteration (Eric, 2026-10-17).

- Actor card text refinement (Eric, 2026-10-17): place the actor name at the top of the holocard, retain the prominent value below, and use translucent text/backing so the painted art remains visible. Omit the visible Foundation label and sub-card inspection/travel help text; retain accessible interaction labels. This supersedes the name beside the lower value.

<a id="contract-101"></a>

### Actor card text backsplash

Source context: GAME.md / Ordered traversal and point-of-interest iteration (Eric, 2026-10-17).

- Actor card text backsplash (Eric, 2026-10-17): put a subtle translucent dark backing directly beneath the actor name, live value and any resource text, preserving the visible painted artwork around them.

<a id="contract-102"></a>

### Actor card typography polish

Source context: GAME.md / Ordered traversal and point-of-interest iteration (Eric, 2026-10-17).

- Actor card typography polish (Eric, 2026-10-17): style the translucent name/value/resource plates as a coordinated trading-card frame with restrained champagne edges, cool glass gradients, inset highlights and refined typography. Retain the top name, prominent lower value, artwork visibility and existing interactions.

<a id="contract-103"></a>

### Actor card plate placement

Source context: GAME.md / Ordered traversal and point-of-interest iteration (Eric, 2026-10-17).

- Actor card plate placement (Eric, 2026-10-17): tighten the nameplate’s vertical padding and raise it to the top while keeping its text size. Place the prominent value in a round translucent panel inside the lower-right corner.

<a id="contract-104"></a>

### Actor value breathing room

Source context: GAME.md / Ordered traversal and point-of-interest iteration (Eric, 2026-10-17).

- Actor value breathing room (Eric, 2026-10-17): inset the round value panel from the card’s bottom and right edges and reduce its numeral size to leave clear space inside its circumference.

<a id="contract-105"></a>

### Actor value inset adjustment

Source context: GAME.md / Ordered traversal and point-of-interest iteration (Eric, 2026-10-17).

- Actor value inset adjustment (Eric, 2026-10-17): move the value panel halfway from its expanded inset back toward the former 6px bottom/right placement, preserving its smaller numeral and panel size.

<a id="contract-106"></a>

### Cave tableau prop detail

Source context: GAME.md / Ordered traversal and point-of-interest iteration (Eric, 2026-10-17).

- Cave tableau prop detail (Eric, 2026-10-18): surround the frontal cave composition with existing impassable mountain cutouts behind and at both flanks. Blend the mouth into a warm dirt foreground using the shared deterministic ground-cover and spill-clutter methods, with earthy washes, clods and stones instead of a green woodland floor. Share the composition between the cave exit and idle/home cave scenes; keep cards, quest pickups and gameplay unobstructed. These are scenery props, not added terrain or resources.

<a id="contract-107"></a>

### Cave mountain backdrop scale

Source context: GAME.md / Ordered traversal and point-of-interest iteration (Eric, 2026-10-17).

- Cave mountain backdrop scale (Eric, 2026-10-18): enlarge the mountain group from its grounded base so the peaks and ridges fill the empty space behind the den. Use stronger scaling in narrow portrait fields; retain the cave, foreground dirt, card positions and interactions.

<a id="contract-108"></a>

### World quest attention shimmer

Source context: GAME.md / Ordered traversal and point-of-interest iteration (Eric, 2026-10-17).

- World quest attention shimmer (Eric, 2026-10-18): all diegetically spawned quest pickups share a warm luminous edge and a recurring pale gold/cool-white gleam across the printed face until picked up or redeemed. Apply to tutorial ground discoveries and world-table quest cards, keeping normal quest slots unlit. Preserve readable art, physical perspective, input and game/journey pause; reduced motion uses a steady gentle highlight with no sweep. Remove the discovery shimmer during the pickup flight.

<a id="contract-109"></a>

### Quest pickup luminosity

Source context: GAME.md / Ordered traversal and point-of-interest iteration (Eric, 2026-10-17).

- Quest pickup luminosity (Eric, 2026-10-19): darken the tableau behind a waiting ground quest card, keeping its printed face bright with a luminous warm edge and a small pool of light. Remove the darkening and pickup glow when the card lifts; preserve the shared pause-aware shimmer, reduced motion and pickup interaction.

<a id="contract-110"></a>

### Painted berry icons

Source context: GAME.md / Ordered traversal and point-of-interest iteration (Eric, 2026-10-17).

- Painted berry icons (Eric, 2026-10-19): replace all Unicode berry presentation with the existing watercolor manaberry fruit artwork, including tableau faces, travel cards, delivery flights and collection effects. Preserve icon sizing, accessible labels, emission and pause behavior. This supersedes Unicode manaberry clusters in the blob backsplash rule.

<a id="contract-111"></a>

### Hero travel expression coverage

Source context: GAME.md / Development baseline.

- Hero travel expression coverage (Eric, 2026-10-16): sad faces now attach to standing and every walking phase, in addition to sitting, by reusing the existing directional face-only atlases with per-view body registration and feathered joins. Preserve body artwork and gait. This supersedes the earlier notes listing travel faces as future work; sleeping/combat reactions and additional emotions retain their existing scope.

<a id="contract-112"></a>

### Hero scene mood

Source context: GAME.md / Development baseline.

- Hero scene mood (Eric, 2026-10-16): Hero is sad for most of Days 01 and 02, including between dialogue. Supper/rest and explicit dialogue reactions can relieve the default. The development Scenario pane offers a browser-persisted per-scenario Hero emotion override (Story default, Sad, Neutral) for composition, taking priority over dialogue until restored to Story default; include the resolved emotion in copied camera/dialog details. The current painted sad faces support seated low/elevated front/side views; movement, sleeping and combat keep authored artwork, and unseen back/overhead faces remain untouched. Additional painted emotions are still future work.

<a id="contract-113"></a>

### Independent Hero bobtail

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Independent Hero bobtail (Eric, 2026-10-13): disconnect the natural bobtail from every current Hero bobtail sprite and render it as a conditionally visible registered layer, **visible by default**. Share the setting across directional standing/sitting/walking/reaction sprites, OTT, immersion/battle and sleeping den artwork. Keep the natural bobtail and optional flame effect independently controllable, following the live pose and lighting without changing gameplay or body proportions. This supersedes the baked natural bobtail requirement; sources and validation are recorded in `docs/art/hero-bobtail-v3.md`.

<a id="contract-114"></a>

### Actor visibility

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Actor visibility (Eric, 2026-10-13): map actors always use a pale stroke following their live sprite silhouette in OTT and immersion rather than a square outline, starting immediately with Hero in her den before selection or movement. Include the painted den interior artwork, retaining natural wall/roof occlusion. Remove immersive actor base circles; retain names, shadows and whole-square grabs. This supersedes actor token-base presentation requirements.

<a id="contract-115"></a>

### Automatic tile spillover

Source context: GAME.md / Card-driven travel (Eric, 2026-10-14).

- Automatic tile spillover (Eric, 2026-10-13): derive cosmetic edge spill from the live map's adjacent tile types, including tiles added, replaced, moved or removed. Register each type's spill artwork and compatible receiving surfaces once; preserve authored exceptions such as the den's north-facing mouth. Berry/woods foliage, earth and mountain stones blend compatible unlike land surfaces, including berry–mountain borders. Make spillover largest and densest along the shared dividing line to obscure tile seams, with smaller sparse pieces tapering into the receiving tile. Keep placement deterministic, avoid printed labels, conceal locked/undiscovered neighbors, leave empty cells and water clear, and preserve Paint/Pixel and OTT/immersion presentation. This is presentation only; the future map editor is not part of this work.

<a id="contract-116"></a>

### Biome tiles have no outer border for now, in either camera view.

Source context: GAME.md / Temporary scaffolding.

- Biome tiles have no outer border for now, in either camera view.

<a id="contract-117"></a>

### Exterior terrain presentation

Source context: GAME.md / Grid coordinates.

- Exterior terrain presentation (Eric, 2026-10-09): remove the black raised placeholder tiles around the table periphery in both camera views. Keep the existing 15x15 playable boundary and its movement, placement and lighting rules; exterior terrain has no visible tile surface for now. This supersedes the black placeholder rendering rule.

- Simple Steps quest artwork (Eric, 2026-10-22): `public/assets/runtime/ui/quests/hero-den-overhead-simple-steps-v3.png` uses relaxed lifted brows, attentive amber eyes and a neutral closed mouth for gentle curiosity; shows only Hero’s inquisitive head peeking out of the den from above, in moonlit watercolor. Generated with built-in image_gen; prompt and approved style/identity references recorded in `public/assets/sources/simple-steps-v3.json`. The realistic v1 was rejected and is retained only in artifacts. Shared by discovery, jumbo and dock.

- Dewi Whiteout contrast (Eric, 2026-10-29): use a soft, locally blurred slate-blue wash behind Dewi and attenuate foreground wind over her center, preserving the original scene and separate owl and wind assets. Keep the storm visible around her and retain the card's parallax and reduced-motion behavior.

- Demi ice ability drafts (Eric, 2026-10-29): Ice Armor and Rime Retort reward cards identify their owner as Demi, using polar-bear action cutouts over a separate winter background with the shared holocard parallax. These built-in ImageGen drafts use Hero's berry painting as the actual style reference and the glacial bear as the separate identity reference. Sources, exact prompts and review notes: `public/assets/sources/keru/demi/abilities/v1/`; active assets: `public/assets/runtime/keru/demi/abilities/`. Ice Armor remains sharper than the current Hero standard and is an initial draft for further refinement. This supersedes the prior prohibition on Demi art in ice rewards.
