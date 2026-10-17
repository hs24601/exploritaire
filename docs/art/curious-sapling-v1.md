# Curious Sapling v1

Added at grid (0,-2). Safe woods exploration uses the existing finite 13-card wood deal. The tile retains proximity discovery.

Built-in ImageGen created `public/assets/biomes/sources/watercolor-v1/curious-sapling-sheet-v1.png`. The alpha-preserving two-panel crops are `public/assets/biomes/watercolor-v1/curious-sapling-sprite-v1.png` and `curious-sapling-overhead-v1.png`.

Immersion uses uniform scaling to relief height 2; OTT uses the overhead crown. Inspection shares the immersive illustration. No surrounding full-height pine fringe is added to this small sapling.

Generation prompt:
Create a transparent game sprite sheet, two equally sized panels side by side, no dividing line, no text. Left panel: one small young deciduous sapling viewed straight on for immersive scenery, thin gently crooked brown trunk, a few small rounded foliage washes, trunk foot centered. Right panel: the same sapling viewed from directly overhead for a tabletop map print, compact crown with sparse transparent gaps. Each subject contained within its own half with generous clear margins. Match Exploritaire loose hand-dabbed watercolor: broad irregular wet dabs, merged soft diluted moss/olive green pigment pools, muted warm brown trunk, subtle slate/indigo shadow, feathered lost edges. Deliberately simple few large washes, no individual leaf detail, no dense ink, no glossy highlights, no pixel art, no background ground or cast shadow, no pot, no additional props. True transparent alpha outside artwork. Small charming natural sapling, not a mature tree, no face.

Light integration: the tile authors a shared scenery emitter (warm green #d4ed9b, strength 0.65, radius 3 cells, heightToWorld(2), flicker 0.15). biomeLights derives live visible/unlocked tile positions; the Table lights toggle gates emission. The existing terrain/actor light sampling, shadows, atmosphere and tableau rig receive the same source. Browser validation at midnight measured 71% tile light with emission and 27% without it, restored by toggling back on; no extra lamp token is rendered. Typecheck and 28 focused tests passed.
