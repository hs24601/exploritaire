# Combat Woods game opening

`portals.html` now spawns Hero at (0,0) inside the existing Combat Woods, near its return portal, facing the waiting Khadroot at (3.3,-7.3). Arrival is safely outside encounter range and does not create or advance combat. Deliberate grounded approach retains the existing battle trigger. `book.html?page=1111` keeps its grove opening.

The six-second camera flight approaches the actual grove-side Combat Woods card, crosses its paired transform at 2.6 seconds, then lands on the user's closer, lower shoulder composition: roughly 4.2 m behind Hero, 1.6 m above her floor, a small shoulder offset and nearly level aim. Framing expands only if needed for aspect ratio. This supersedes the original high overview. Each leg uses the existing terrain/solid-aware arrival planner. The unused grove-wide flight is skipped for this game entry. The woods shot fits Hero and Khadroot as a group and remains held after arrival until movement, a route, free camera or explicit look/center input releases it. Replay and reduced-motion/direct entry share the woods spawn and landing state, preserving the existing return portal and pause/settings controls.

Implementation: `src/book/combatWoodsArrival.ts` and the shared `castleWorld.ts` lifecycle. Development telemetry exposes the current camera space, held shot, route clearance diagnostics and actual woods start under `__castle1111.arrival.woods`.

Validation:

- TypeScript and focused tests cover portrait/landscape group framing, behind/above placement, paired-space camera position/aim continuity, stable terminal samples, safe spawn distance, existing contact gates and camera ownership helpers.
- Full game browser validation used its two-run budget. Both runs stopped before startup completed. The second exposed an invalid HTMLSelectElement.add call in the new Sentient overlap selector. The two options are now inserted separately. This fix and the full arrival/replay were not browser-verified afterward; no successful full-scene screenshot or replay check is claimed.
- The previous focused sentient renderer check did pass both depth orders, unchanged non-overlap pixels and distinct cutout/outline rendering. Hero scale calibration is checked against all 143 existing clip/view combinations without changing source artwork.

## Route-failure correction

The subsequent reported “No clear arrival route” had a geometry-classification root cause: broad textured soil patches matched a hierarchy/scale heuristic intended for trees. They produced invisible box proxies at their shared parent origin, including an approximately 8.06 m fake floor at Hero's spawn. `tableauLandscape` now marks terrain/tree roles explicitly, and `combatWoodsGeometry` consumes only those roles. It exports floor triangles separately from tree camera-solid boxes. The flight no longer inflates the entire ground plane into a solid slab.

Portal-leg clearance also uses the real near-plane bound: 0.12 m in the woods and the height-dependent grove lens, recomputed if the cleared grove route climbs. The default general flight planner remains conservative for existing callers. Regression tests reproduce the oversized soil wash at the same hierarchy depth, verify ground-level support and real-tree blocking, and preserve the exact 3.4 m threshold camera height instead of relocating it.

The corrected full scene rendered the Combat Woods card and its Hero/enemy view in the first follow-up browser run, with no route error. Its development-ready wait timed out. A later combined check loaded all four combat atlases in the focused preview, then timed out waiting for the full scene's readiness marker. Both task browser runs have ended; the latest full flight/close-shot runtime is not claimed verified. The user's subsequent live screenshot also shows the woods open with Hero and Khadroot.
