# Occupants inside the painted den

Requested 2026-10-12: Hero must rest within the painted cave, rather than outside its threshold. The user explicitly chose natural wall occlusion over a rear cutaway.

The shared scenery art renderer can now composite occupants in an authored interior. Each opening profile uses the original painting's coordinate grid, so the actor's placement and clip follow the sprite's trim, mirrored view, zoom and lighting. Front and front-quarter profiles place the existing sleeping artwork on the inner floor and clip it at the stone mouth. Side, rear-quarter and rear views supply no opening; they hide Hero completely. The original cave artwork is unchanged.

The world actor remains in her actual grid square for gameplay, camera focus, keyboard inspection and occupied-square pickup. Paint immersion suppresses that token's separate outside drawing and uses the cave interior as its visible body. The interior image shares the same pointer handlers as the normal actor, so clicking or dragging it works. Departure removes the interior occupant and restores the normal traveling actor; arrival restores the sheltered resting pose. Existing companion/cuddle artwork is selected by the same actor rules. OTT and Pixel retain their previous floor and foreground-roof layers.

This reuses existing PNGs; no images were regenerated or edited, and no additional animated actor rig was created. Opening polygons are authored vector clip paths on the retained raster artwork. The closed den does not acquire actor peek holes, and invisible world placeholders do not create phantom holes in other props. Like the den's directional artwork, the interior remains a static painted approximation with discrete view changes.

Implementation: [opening registration](C:/dev/Exploritaire/src/proto/sceneryInterior.ts), [interior compositor](C:/dev/Exploritaire/src/proto/components/SceneryInterior.tsx). Real game validation and enlarged screenshots are in `artifacts/painted-den-interior-v1/`.
