# Den rest sprites — 2026-10-11

Generated with built-in ImageGen from Hero's existing `hero-sleeping.png` and `hero-sleeping-topdown.png`, with `mochi-directions-low-v2.png` as Mochi's identity reference.

Prompt specification for Mochi: transparent two-view atlas; chunky stepped pixel clusters matching Hero, charcoal/copper/tawny fluffy tortoiseshell cat with tufted ears and plume tail; curled asleep with chin on rounded paws and closed eyes; low/front three-quarter and true overhead views, overhead nose toward the bottom; no text, scenery, den or shadows.

Prompt specification for the pair: same style and two-view atlas; larger tricolor Australian Shepherd Hero as the big spoon curled behind smaller tortoiseshell Mochi, chin beside her head and one white foreleg draped around her; two distinct heads and bodies, touching and sleeping peacefully; overhead noses toward the bottom; transparent background with no scenery or labels.

Original atlases are retained in `public/assets/deprecated/pixel/sources/characters/`. `node tools/prepare-den-rest-sprites.cjs` extracts the views by their clear atlas gutter, trims transparent margins and resizes to 128 pixels wide with nearest-neighbor sampling and retained alpha.

`ProtoMap` selects Mochi's individual sleep art when she rests in the den and the pair art when Hero and Mochi both rest in the same den cell. Hero renders the shared silhouette once; Mochi retains an independent keyboard and pointer target. Awake or travelling actors do not cuddle. Both views retain the existing den heading and immersion scaling.

Mochi remains a combat companion in the current Day 1 runtime. This artwork does not add her to the daily-life roster. `/tools/den-rest-preview.html` previews Hero, Mochi and the pair through the real map renderer in OTT and immersion.
