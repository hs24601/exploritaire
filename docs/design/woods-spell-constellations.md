# Woods spell constellations

Current dev-test behavior, authorized 2026-11-16. Supersedes the initial actor-drop charging and zero-receipt casting experiment.

Grab an ability from the hand to reveal that spell's four cornerstone stars and base shape. There is no visible drop prompt, oval or button. Release over the highlighted constellation to start the smooth sky flight and shared stellar grid; releasing outside it cancels the preview. Keyboard/tap selection reveals the same shape with an invisible accessible placement target. Previewing awards no receipts or power. No combatants render in the hand or charging cosmos. Accepted tableau receipts add one active star and +1 spell power; foundation picks and stock draws add neither.

The first four receipts establish an ability's authored cornerstones. Fireball follows Eric's annotated positions: leading tip, far tail, upper shoulder, lower bowl. One receipt shows just the leading star; two establish its complete long axis; three complete the upper triangle; four complete the base Fireball asterism. Casting requires all four, enforced in UI, target acceptance and the pure spell resolver.

Every later star adds a complete local motif anchored to two earlier cornerstones. Its two incident edges and their existing or newly supplied base edge form a closed triangle immediately. No edge points to an unlit/future star, no long perimeter awaits completion, and existing stars/edges persist unchanged. Each possible stopping point therefore keeps a complete simpler composition. Authored details add flame tongues, head/core volume and interior clusters; each ability has distinct cornerstone/detail positions. Fine links and soft local pigment glows keep the four primary stars dominant.

The render budget is 64 stable stars; further receipts still add power and grow the established stars' luminosity. Extra interior positions are deterministic, with no random reroll on repaint, stock draw or target selection. Completion advances through the first four single-star stages, then a further level per four enrichment receipts.

Choose target smoothly returns to the actual Woods camera and live actors, where the player drags the charged ability onto the eligible target. The stars/tableau are hidden during targeting. Back to stars preserves the same grid, stock, receipt count and constellation. Pulling a ready charged card also begins target selection. Returning to Woods without casting cancels this temporary test charge. Legacy encounters, AP, enemy turns and receipt damage remain disabled.

Eligible actors use exterior-only red hostile / blue support strokes from their actual live geometry/painted alpha, never an ellipse or opaque hit region. The HTML target remains transparent under hover, focus, drag and disabled states. A bounded 960×640 mask batches repeated Khadroot pieces with instancing, then composites the contour; source geometry, materials, texture alpha and actor transforms are retained. The render-target viewport uses physical pixels directly, independent of the world's quality pixel ratio.

## Grab-preview and silhouette revision validation

- TypeScript and the twelve spell-rule/Ctrl tests passed.
- Initial headless browser run passed immediate per-ability previews, outside-drop cancellation, activation over highlighted stars with zero awarded receipts, the four-receipt gate, casting, transparent hover hit regions and narrow placement. Visual screenshot review caught the mask viewport being scaled twice at low world quality.
- One corrective browser run verified aligned red Khadroot geometry and blue Hero alpha contours at that low pixel ratio, transparent hover hit regions, and no shader/runtime errors. Screenshots reviewed directly against the live actors. Both runs and visual review stayed within the five-minute browser budget. Physical touch hardware remains untested.
- Screenshots: `output/woods-fireball-grab-preview.png`, `output/woods-spell-grab-preview-narrow.png`, `output/woods-khadroot-silhouette-aligned.png`, `output/woods-hero-silhouette-aligned.png`.

## Prior cornerstone revision validation

- TypeScript passed.
- Twelve focused tests passed: spell damage gate, target allegiance, cornerstone order, bounded growth, complete base graph, stable prefixes and closed motifs at every count 1–64 for all four abilities, plus the existing Ctrl tap/hold tests.
- Initial headless browser run passed placement and stages 1–3, then its harness attempted to click the intentionally disabled charged card and correctly timed out. The corrective run asserted the lock instead.
- Corrective browser run passed starfield drop, hidden pre-placement constellation, actor-free charging, stages 1–4, eight-star enrichment, four-receipt gate, Ctrl taps, stock reselection without losing charge, no receipt damage, actual Woods target/cast, Back to stars preserving charge/tableau, exact world actor/camera restoration and 390×844 placement. No runtime errors. Screenshots reviewed at 1432×900 and 390×844.
- Browser setup through screenshot review stayed within the single initial run / one corrective run / five-minute cap. The final broadened free-starfield hit test was typechecked after that check, without a third browser run. Physical touch hardware remains untested.

Screenshots: `output/woods-fireball-cornerstones-{1,2,3,4}.png`, `output/woods-fireball-enriched.png`, `output/woods-spell-world-targeting.png`, `output/woods-spell-starfield-hand.png`, `output/woods-spell-cornerstone-narrow.png`.
