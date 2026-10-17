# Watercolor den orbit views

Requested 2026-10-12: enough authored painted assets to view Hero's Den through a full camera orbit, including its closed rear and substantial sides. Built-in ImageGen produced four new PNGs from the unchanged front painting. Exact prompts and generated source names are retained in [watercolor-den-orbit-v1.json](C:/dev/Exploritaire/docs/art/watercolor-den-orbit-v1.json).

| Authored view | Runtime asset |
| --- | --- |
| Front (retained) | [hero-den-sprite-v2.png](C:/dev/Exploritaire/public/assets/biomes/watercolor-v1/hero-den-sprite-v2.png) |
| Front quarter | [hero-den-front-quarter-v1.png](C:/dev/Exploritaire/public/assets/biomes/watercolor-v1/hero-den-front-quarter-v1.png) |
| Side | [hero-den-side-v1.png](C:/dev/Exploritaire/public/assets/biomes/watercolor-v1/hero-den-side-v1.png) |
| Rear quarter | [hero-den-rear-quarter-v1.png](C:/dev/Exploritaire/public/assets/biomes/watercolor-v1/hero-den-rear-quarter-v1.png) |
| Closed rear | [hero-den-rear-v1.png](C:/dev/Exploritaire/public/assets/biomes/watercolor-v1/hero-den-rear-v1.png) |

Five authored views plus mirrored quarter/side paintings cover eight compass directions. The physical entrance stays world north. A camera-facing display plane presents the appropriate view of that fixed object; it no longer shows the entrance from behind or becomes edge-on at the sides. This supersedes the single-view fixed-plane experiment. The shared actor direction selector supplies wrapping and boundary hysteresis. View updates subscribe to the existing live camera clock and change React state only at view boundaries. Sources and trim bounds are prewarmed to avoid blank view changes; original alpha and full-resolution painted pixels remain intact, with no volume reconstruction.

The selected painting and mirroring also feed lighting, shadow silhouettes, atmospheric canopy and occlusion. Ground anchors and footprint remain constant; the den's existing resting-actor peek exception remains. Inspection uses the original front; OTT uses the existing painted overhead and foreground roof. Pixel retains its carved north-facing cave. No gameplay or actor artwork changes.

These are eight-direction painted views with discrete changes between them, not continuous 3D geometry. Opposite quarter/side views mirror the authored artwork, so tiny stone asymmetries are approximated.

Validation scripts, measurements and real game screenshots are saved in `artifacts/painted-den-orbit-v1/`.
