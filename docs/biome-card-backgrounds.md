# Biome playing-card backgrounds

`src/proto/biomeCardArt.ts` owns the reusable recipe registry and compositor.
Recipes reference existing tile floors/overhead prints and immersive cutouts,
with normalized portrait placements, ground anchors and a sky palette. They
contain no actor artwork, card values or gameplay state.

To add a biome, add its recipe to `BIOME_CARD_RECIPES` using its `tileType`
(or `terrain` for legacy woods/water). Sources are paths relative to
`assets/biomes`; `scenerySprite` and `woodsOverheadSprite` select existing
Paint variants, retaining original artwork where a counterpart is absent.
Roads use the path recipe. Unexplored and unregistered terrain use a neutral
scene. Individual tile IDs do not require background registrations.

The browser bakes 12 views per biome/style, selected by stable card-ID seeds.
Zoom, framing, foliage density and placement vary independently of card rank.
Paint uses a 378×528 master; Pixel uses a crisp 126×176 composition. Existing
decoded images are shared through `mediaCache`; transparent scenery bounds
are measured once per image. At most 96 composition promises are retained.
There is no per-card renderer, WebGL context, animation or camera dependence.

`BiomeCardBackgroundProvider` scopes the appearance to a tableau, including
React portals. It discards stale asynchronous results after a biome/style
change, shows a dark fallback while loading and preserves working layers if
an asset fails. `ProtoCard` puts the background beneath the existing veil and
rank/resource ink. Foundation actor cards keep their separate artwork.

Main tableau flights snapshot the displayed image at pickup. Battle flights
clone the displayed card, preserving its art automatically. Both retain their
source appearance after leaving the field. Flights use the same 63:88 ratio.

Validation: `tools/biome-card-background-playwright.cjs` checks registered asset
availability, composition caching/distinctness, Paint/Pixel changes, silhouette,
card layout, immersion and mouse/touch flights at 1280×720 and 1912×914. It
saves a recipe gallery and 3× rendered card details under
`artifacts/biome-card-backgrounds`. Run against the local Proto Vite server.
The focused unit tests cover live tile selection and concealed/unsupported
terrain. Water and mountains have reusable recipes for future card surfaces;
their current fishing/impassable gameplay is unchanged.
