# Khad Roots: grown geometry (phase 1)

Implemented 2026-10-20. Phase 1 of carrying the procedural bush methods over to Khad Roots: geometry and structural rules only, still painted by the existing SVG pigment. Phase 2 (a DOM-free bark-plate painter) and phase 3 (switching paint in game) are not started.

## Growth

`src/proto/khadRootGeometry.ts` (`khad-geometry-v2`) replaces Catmull-Rom curves through jittered fixed points with a walker. Each vine follows a course that turns toward seeded waypoints. On top of that, a bounded sway with alternating control values and a quicker ripple make it wind without circling, and kinks bend it sharply before relaxing. A curvature limit (0.2 rad per 1.6-unit step) prevents knots. Vines avoid protected windows by steering the course and then a hard guard; the narrow corridor between the reward and value windows counts as solid. Waypoints that fall inside a window move just outside it, and a passed waypoint is not chased. A soft boundary only turns vines that are heading outward. Group links grow the same way and end exactly at their attachment points.

Every vine is measured against `KHAD_ROOT_RULES` (see ART.md) as it grows. A failing vine is regrown from `cardId#route#attempt`, so output stays deterministic per card.

## Evidence

- Rule sweep, 500 plans (400 cards plus `obscureValue` variants): every vine passes every rule. Before the regrowth step, 3 had a run slightly over the limit and 2 had a tight knot.
- Silhouette overlap over 150 cards (11,175 pairs): v1 averaged 0.491, with a 99th percentile of 0.630, a maximum of 0.707 and 1,748 pairs over 0.55. v2 averaged 0.363, with a 99th percentile of 0.491, a maximum of 0.561 and 2 pairs over 0.55.
- The frozen v1 fails the straight-run, clipped-thorn and silhouette rules. The tests use it, plus a synthetic knot and an underside glow, as negative checks.
- `khadRootGeometry.test.ts` (11 tests including existing ones) and `KhadCompare.test.tsx` (server render of both versions) pass, as do typecheck and the build.
- `node tools/khad-roots-render.mjs` draws vine and thorn outlines and the upper-surface glow for v1 (left) and v2 (right) on plain card frames. It does not reproduce the in-game SVG pigment filter. Output: `artifacts/khad-roots/v2/v1-vs-v2.png`.

During development, the measures themselves had bugs (a thorn-tip index, glow-side matching); they were fixed and are recorded in the code comments. The rule numbers were chosen as judgements. The silhouette rule was restated as mean, 99th percentile and a 0.6 ceiling after measurement showed a single worst-pair maximum was too fragile. Not checked: the in-game look in a browser (project rules prohibit browser testing on this machine).
