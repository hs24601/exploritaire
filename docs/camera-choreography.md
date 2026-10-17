# Camera shots and choreography

Open **Camera choreography** from Game settings or the Edit tiles panel. The floating panel stays open while you position the map camera. Use **Add current view** for each shot, adjust its fields, reorder the list and **Save sequence**. **Capture current view** replaces a shot's framing. **Preview shot** and **Play sequence** move the actual camera; pause/resume, stop and stop-and-return controls are available. The optional return setting restores the starting view after the last hold.

Each shot stores a world-space target X/Y (48 world units per tile), zoom, rotation in degrees, tilt from overhead, OTT/immersion mode, flight seconds, hold seconds and smooth/linear/cut movement. Smooth/linear yaw takes the shortest rotation; use intermediate shots for longer arcs. Reduced motion uses cuts with the authored hold times. Timelines pause while the document is hidden or travel is paused. Manual pan, zoom, orbit, camera toolbar controls and movement keys interrupt playback.

In a callout's pencil editor, **Camera on callout** chooses no preset, a custom shot, or a named saved sequence. A custom shot starts from the current view when selected. It runs once on the next appearance of that callout during gameplay. Preview is immediate; saving does not replay an already-triggered callout. The displayed callout ID can also be used by a choreography trigger. Callers still own story/discovery visibility; an offscreen active callout may fly its speaker into view.

Trigger types:

| Trigger | Target |
| --- | --- |
| Manual only | Play from the choreography panel or bind it directly to a callout |
| Callout appears | Stable callout ID, e.g. `day01.sparse-patch` or `day01.saved-light` |
| Scenario starts | `day01`, `day02`, `day03`, or `sandbox`; includes restart |
| Travel starts / arrives | Destination tile ID |
| Hero enters tile | Entered tile ID; follows actual actor movement |

An empty target matches any event of that type. Disabled triggers do not autoplay, but their sequences can still be previewed or assigned to a callout. The first matching saved sequence wins. Explicit callout presets take priority over callout trigger bindings. A new trigger replaces current playback. Cancellation of travel does not count as arrival. Editor map changes do not fire story triggers. The opening-day first pass now provides source-defined sequences for Day 01–03, controlled by Cinematic review. Other scenes receive no automatic defaults.

Callout overrides and named sequences persist in browser localStorage independently of tile documents. Saving an existing name updates that sequence; distinct sequences require unique names. Deleting a sequence leaves an assigned callout reference inactive until it is rebound. Existing authored callout text and tile data remain unchanged. This initial adapter controls the Proto map; the separate Three.js combat and Banks cinema rigs suspend the map adapter while displayed. The opening-day first pass supplies native per-beat rescue shots to that rig. See `opening-days-cinematic-first-pass.md`.

Implementation: `cameraChoreography.ts` defines validated shots and a deterministic timeline sampler. `cameraDirector.ts` owns the library, trigger matching, and a pluggable live camera port. `useMapCameraDirector` drives the existing camera frame API; it never moves actors or advances gameplay. `useCameraStoryTriggers` dispatches scenario/travel edges. Callouts and actual map crossings dispatch their own events. Future camera rigs can provide their own port rather than duplicating authoring or timeline rules.
