# Tutorial quest illustrations · 2026-10-19

## Dark default variants

The daylight versions below remain preserved. Both quests now default to separately generated night variants, shared by pickups and the active deck and warmed by the loader:

- `public/assets/runtime/ui/quests/hero-leaving-cave-night-paint-v1.png`
- `public/assets/runtime/ui/quests/hero-snuffling-berries-night-paint-v1.png`

Built-in imagegen edited each corresponding daylight illustration independently. Both outputs were visually inspected for preserved composition, gloomy clouded skies, visible stars, blue berry luminosity and readable Hero silhouettes. TypeScript check passed. In-game browser appearance was not checked for this variant update.

Generated with the built-in imagegen tool using `public/assets/runtime/ui/quests/hero-snuffling-berries-paint-bobtail-v2.png` as the reference. Original artwork remains intact. Runtime exports are full-bleed 1536 × 1024 PNGs.

- `public/assets/runtime/ui/quests/hero-leaving-cave-paint-v1.png`: Find a way out.
- `public/assets/runtime/ui/quests/hero-snuffling-berries-blue-paint-v3.png`: Pick the first berry.

## Cave-exit prompt

### Night cave edit prompt

Use case: lighting-weather. Edit target: attached approved cave-exit illustration. Create a night variant, preserving the exact composition, Hero identity, anatomy, short bobtail, pose, rear third-person cave camera, rock shapes, vegetation and berry positions. Replace all sunny daylight with dark gloomy indigo/charcoal night, cloud-heavy skies with a few sharp stars piercing gaps visible beyond the cave mouth. The scene should match a dark moody game render. In the spirit of Thomas Kinkade's luminous paintings, the BLUE manaberries are the primary radiant light sources, with bright blue-white cores, rich soft cyan halos and convincing luminous spill across nearby leaves, stone, path and Hero's fur. Deep surrounding shadows, subtle atmospheric haze, gentle reflected light keep Hero readable, no daytime yellow sunshine. Retain the original broad angular watercolor pigments and paper texture. Full bleed 1536x1024 landscape, no text, border or UI.

### Night berry edit prompt

Use case: lighting-weather. Edit target: attached approved Hero-snuffling-blue-berries illustration. Create a night variant preserving the exact composition, Hero identity, face, anatomy, short bobtail, pose, forest and berry positions. Replace all sunny daylight with dark gloomy indigo/charcoal night, cloud-heavy skies with a few sharp stars piercing gaps in the canopy at the top. The scene should match a dark moody game render. In the spirit of Thomas Kinkade's luminous paintings, the BLUE manaberries are the primary radiant light sources, with bright blue-white cores, rich soft cyan halos and convincing luminous spill across nearby leaves, stone, forest floor and Hero's face and fur. Deep surrounding shadows, subtle atmospheric haze and reflected light keep Hero readable, no daytime yellow sunshine. Retain original broad angular watercolor pigments and paper texture. Full bleed 1536x1024 landscape, no text, border or UI.

### Original daylight cave prompt

Use case: illustration-story. Reference image: Hero character identity and watercolor style only. Create NEW full bleed landscape quest illustration for Find a way out. Camera is deeper inside a rocky cave, low third-person behind Hero, looking outward over her back towards the cave mouth and manaberry bushes outside. Hero is the same small tricolor merle puppy, large perked ears, white neck ruff and paws, tan legs, mottled charcoal gray back and natural very short bobtail (never a long tail). She is walking away from camera toward the cave exit, all four legs anatomically correct, rear three-quarter view, head looking toward the bushes. Dark cool rocky cave walls and floor frame a sunlit green woodland opening with clearly visible luminous BLUE manaberries on bushes ahead. Match reference broad angular watercolor pigment strokes and paper grain. Keep Hero and exit/berries readable within central square crop for card art. No text, borders, UI, humans, collar or gear.

## Berry-edit prompt

Use case: precise-object-edit. Edit target: supplied watercolor illustration. Preserve Hero exactly, her compact puppy proportions, natural short bobtail, pose, framing, forest and angular watercolor paper texture. Change only the manaberry fruit clusters: make their berries luminous blue/cyan with pale blue-white highlights and a soft blue magical glow spilling gently onto nearby leaves. Keep all original fruit locations. Full bleed landscape illustration, no card frame, no text. Save final image.

## Integration and validation

`tutorialQuestArtwork` shares step-specific painted artwork between the discovery pickup and active deck. The loader warms both new assets. Other tutorial steps and the legacy pixel fallback retain their artwork.

Visually inspected both generated images. TypeScript check passed; quest discovery and scene checkpoint suites passed (26 tests). In-game browser layout was not checked in this change.
