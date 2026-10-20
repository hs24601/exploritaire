# Exploritaire development baseline

- Khad Roots explanation tableau (Eric, 2026-10-20): retain the sparse tableau through quest discovery, jumbo inspection and docking until onward travel replaces it. Keep the remaining Khad-bound cards face-up in their authored poses and inactive; do not turn/tap them or hide the field. The quest explains why those visible cards cannot be touched. This supersedes clearing the tray at pickup completion.

- Quest completion receipt (Eric, 2026-10-20): replace tutorial quest burns with a dynamically painted green brushstroke checkmark over the completed card, a face-down turnover (printed back toward the camera), then a flight to Hero's holocard invoking its existing received holo shimmer. Finish the outgoing receipt before the next pickup flies; preserve real progression, global pause, restart and brief reduced-motion presentation. This supersedes all tutorial burn/dissolve timing and queued-burn rules.
- Khad Roots dock dialogue gate (Eric, 2026-10-20): keep Hero's next sparse reflection/camera action suppressed through discovery and jumbo inspection; release it only after the player clicks the jumbo Khad Roots card and its flight to the quest dock finishes. This supersedes releasing the reflection at pickup completion.

- Khad Roots reveal waits for pickup (Eric, 2026-10-20): playing the final sparse berry 8 only exposes the quest card. Keep it at the same position beneath the 8, retaining its travel tableau even after Hero arrives. Wait for the player to click/tap or keyboard-activate that card before its spin/flight into the map jumbo position. Hold the sparse reflection and its camera sequence until pickup finishes; this supersedes the immediate sparse-berry dialogue trigger.

- Tableau backsplash trial (Eric, 2026-10-20): numbered tableau faces use a mostly transparent dark wash (14% opacity) instead of individual biome illustrations. Keep compact value backings, borders, rewards, buried-state cues, flights and input intact. This is a presentation trial superseding illustrated tableau backdrops while under evaluation.

- Tableau value readability (Eric, 2026-10-20): give center values and buried corner indices a compact dark ink backing at 85% opacity with ivory lettering and a subtle light edge, independent of the card illustration. Keep lettering and edges crisp, buried indices cooler, tactical concealed values hidden, reward clearance, card geometry, flights and interaction intact.

- Procedural bush study (Eric, 2026-10-20): `/tools/bush-lab.html` compares the approved ImageGen bush with an entirely code-generated watercolor plant, seeded variations, paint/growth controls and exported PNG/JSON. This is temporary art tooling, with no change to runtime bush assets, harvest state or encounter rules. See [ART.md](./ART.md#procedural-bush-prototype-2026-10-20).

- Shadow entity comparison (Eric, 2026-10-20): the procedural twin in `?woods-combat` now represents an amorphous shadow entity; follow the shifting ink-boundary direction in ART.md. Keep its comparison-only encounter lifecycle and shared pause/reduced-motion behavior.

- Slime paint comparison (Eric, 2026-10-19): `proto.html?woods-combat` opens the woodland mana / Banks rescue checkpoint with the original painted slime and a procedural watercolor comparison twin. This is temporary art scaffolding; the twin shares the encounter lifecycle and does not add attacks, rewards or a required kill. Adapt the supplied scifriday QvEbVZ stamp-mask compositing idea using locally generated pigment shapes, the shared pause-aware clock and a static reduced-motion wash. Keep ordinary rescue scenes unchanged.

- [Manaberry fruit identity — art/presentation contract](./ART.md#current-direction-and-precedence): stemless red fruit with a bumpy circumference and blue surrounding glow; see ART.md for the standing design.

Read [ART.md](./ART.md) alongside this baseline for all art direction, theming, asset production, watercolor rendering and lighting/presentation contracts. Gameplay, interaction, authoring and validation requirements remain here; linked mixed contracts retain their gameplay safeguards in ART.md. The documentation split does not change runtime behavior or supersede approved decisions.

- Radial dab tooling (Eric, 2026-10-19): follow [the radial-dab direction in ART.md](./ART.md#radial-dab-tooling-and-defaults-2026-10-19). Preserve the original soft ground appearance and gameplay while exposing reproducible paint controls.

- [Organic Khad Root growth — art/presentation contract](./ART.md#contract-001).

- Khad Roots silhouette correction: follow the current [ART.md direction](./ART.md#current-direction-and-precedence) for tactile thicker winding wood, denser hooked thorns and brighter crimson glow; preserve all binding and clearance rules.

- [Khad Roots wrapping clearance — art/presentation contract](./ART.md#contract-002).

- [Khad Roots danger glow — art/presentation contract](./ART.md#contract-003).

- [Khad Roots gloom palette — art/presentation contract](./ART.md#contract-004).

- Scene deep links (Eric, 2026-10-19): Proto accepts unique scene bookmark names as query flags, for example `?khad-roots-exposed`, and full bookmark IDs via `?scene=day02.opening`. Restore the same checkpoint and settled presentation as scene-tree selection on initial load; ignore unknown or ambiguous flags and keep authoring startup independent.

- Compact scene bookmarks (Eric, 2026-10-19): keep each scene-tree entry on one row without repeated status subtitles and close the tree after a successful selection. Include Khad roots exposed during the sparse crossing at 10/12 required plays, Hero rank 6, with 7/8 and bound J/Q remaining; retain actual earned costs, uncollected fruit and playable continuation.

- [Khad Roots brushwork — art/presentation contract](./ART.md#contract-005).

- Sparse berry final-card placement (Eric, 2026-10-19): place the required final berry card (normally 8) on the left beneath the 7, upright at the supplied mockup position. Preserve explicit coverage, play order, reward and the separate rooted J/Q grouping. This supersedes its previous lower-right pose and the J-behind-8 overlap.

- Khad Roots (Eric, 2026-10-19): reusable dark twisting thorn vines bind individual tableau cards and join multiple cards in a shared grouping. Store bindings per card; removing one frees only that card unless it is an authored cornerstone, whose removal releases its entire grouping. Khad Roots are a play on the Hebrew word kadrut, for gloom/misery/bleakness. In the first sparse bush scene bind the optional J and Q with no available removal ability; keep the J left behind the 8, above the Q in stacking order, and clear of the Q value. Preserve the six-card required route and finite harvest.

- Queued quest burn handoff (Eric, 2026-10-19): when an incoming quest pickup is queued during the previous card's burn, rapidly finish the remaining dissolve before starting the incoming flip/flight. Fully remove the burned card first; preserve pause, reduced motion and progression. The ordinary unqueued burn remains four seconds.

- Quest flight flips (Eric, 2026-10-19): spin/flip quest cards during tableau-to-map flights and land discovered tutorial quests directly in the map-contained jumbo position. Clicking the jumbo card flips and flies it into the upper-right dock; activating the dock reverses the flight into jumbo. Preserve pickup/progression gates, global pause, restart and reduced-motion presentation. This supersedes the intermediate dock stop on discovery.

- [Dark tutorial quest art defaults — art/presentation contract](./ART.md#contract-006).

- [Tutorial quest illustrations — art/presentation contract](./ART.md#contract-007).

- Independent authoring controls (Eric, 2026-10-19): development callouts expose their edit pencil without tile Edit mode; opening the editor suspends callout progression. Jumbo quest cards expose a floating edit pencil for title/text editing, with Save to disk and Restore original backed by src/data/questCardEdits.json. Preserve quest requirements, rewards, discovery and progression. Callout persistence remains browser-local.

- Map quest presentation (Eric, 2026-10-19): newly loaded tutorial quest cards first appear as a nonmodal jumbo centered and fitted within the map scene, never covering or blocking the sibling tableau. Clicking/tapping or keyboard-activating the card docks it at the existing upper right; activating the docked card reopens this map-contained view. Preserve discovery/pickup gates, real progression, burn/flip transitions, pause and restart. This supersedes opening tutorial quest inspection in a viewport-wide modal.

- [Loader Hero — art/presentation contract](./ART.md#contract-008).

- Loader tail motion (Eric, 2026-10-20): keep Hero’s seated bobtail rooted at her rump with a gentle lateral bend and subtle foreshortening, completing each wag cycle in 0.275 seconds. Avoid rigid picture-plane swiveling into her spine; keep her body/paws planted and reduced motion static.

- [Ink asset loader — art/presentation contract](./ART.md#contract-009).

- Quest burn duration (Eric, 2026-10-19): the quest-card burn takes four seconds before the next-card flip. Preserve the brief reduced-motion fade and pause-aware timing.

- Manaberry blob backsplash (Eric, 2026-10-19): blend the blue-white merging blob motion from Tiffany Rayside’s Blob State Matter (https://codepen.io/tmrDevelops/pen/GoWmaM) beneath Unicode manaberry clusters and painted fruit in tableau and map scenes. Preserve purple fruit detail, buried icon peeks, depletion, input and global pause; reduced motion keeps a static wash. This supersedes steady-only emission presentation.

- Conditional tableau field (Eric, 2026-10-19): hide the tableau field and let the map fill its space whenever no tableau is loaded, including the tutorial opening. An actor's idle location alone must not open an empty scenery field. Preserve active travel, selected encounters, combat and actionable quest pickups. This supersedes the permanent empty tableau surface rule.

- Quest card burning (Eric, 2026-10-19): replace the sequential quest CSS burn wipe with the DOM-texture/WebGL FBM dissolve method from https://codepen.io/ksenia-k/pen/yLQLyZa. Burn irregularly inward with charred edges and orange fire; preserve the real card face, ordered next-card reveal, global pause and restart. Reduced motion and unavailable WebGL/capture use a fade. This supersedes the former CSS scorched-edge/ember treatment.

- Flick physics (Eric, 2026-10-19): exposed playable tableau cards inherit recent mouse/touch release velocity and coast with friction. Accept trajectory hits on foundations through the existing receiving-actor legality checks; misses and illegal moves leave game state unchanged. Offer a browser-saved Flick physics toggle in Game settings, enabled by default. Preserve direct drops, click/keyboard play, cancellation and global pause.

- Sandbox global pause (Eric, 2026-10-18): Space and a persistent onscreen pause/resume button toggle the shared global clock in combat sandbox tooling, freezing simulation and card effects and blocking combat input until resumed. Preserve text editing and ignore held-key repeats; keep the battle's separate local pause state independent.

- Combat sandbox (Eric, 2026-10-18): `/proto.html?combatsbx` opens dedicated Proto combat playtesting with lighting bypassed and one cards/foundations pane. Its purpose is mechanics iteration from a Z Fold 7, approximating the main game's tableau field with compact chrome and accessible touch controls. Fully disable the Three.js combat camera/arena in this tooling; retain card/foundation effects, combat rules, targeting, scenarios, solver, pause and restart. Keep the normal Proto layout and saved lighting preference independent. This is development scaffolding and supersedes the sandbox background-arena trial.
- Bush sandbox (Eric, 2026-10-20): `/proto.html?bushsbx` stages the approved ImageGen sparse bush and the procedural `bush-study-v3` bush side by side in the shared Three.js tableau landscape. It uses that landscape's freecam, fog, ground cover, mana halo, global lights and combat tint. Controls cover the procedural seed and paint, the bake size, woods/combat scenery, fruit and mana state, swapping sides, and light previews (moon, azimuth, ambient). Lit cutouts and the light sliders are preview-only; shipped scenery cutouts remain unlit. This is temporary art tooling; it does not change runtime bush assets, harvest state or encounters. A Manaberries slider (0–5) sets the procedural bush's fruit count; the ImageGen bush's single fruit shows whenever the count is above zero. It opens on seed 5150, which passes the crown-closure and trunk-growth rules. See [ART.md](./ART.md#procedural-bush-prototype-2026-10-20).
- Khad Roots compare (Eric, 2026-10-20): `/proto.html?khad-compare` shows the same rooted cards with the frozen v1 and grown v2 Khad Roots geometry side by side, on real card faces at game size, 2× and 3×, with a two-card group link and the `obscureValue` opt-in. Grown v2 is the game default; `?khad-geometry=v1` shows the frozen version in place on any Proto scene. A third column shows grown v2 with the bark-plate painter, which is the game default (Eric, 2026-10-20); `?khad-paint=svg` shows the SVG pigment in place on any Proto scene. Bakes run in the shared paint worker pool (`paintWorkerClient.ts`, with a main-thread fallback) and cache per card. This is review tooling; bindings, clearance and release rules are unchanged. See [ART.md](./ART.md#current-direction-and-precedence).

- Scene and actor debug references (Eric, 2026-10-18): show the scene ID above the table coordinates in the map's lower-right corner. In development builds, show each upper-left actor holocard's current table-grid reference beneath the card; follow actual walked position during travel rather than the destination or earned movement buffer. Keep debug text out of drag previews and production actor cards.

- Tutorial scene tree (Eric, 2026-10-18): provide a collapsed Scenes tab on the left screen border with expandable day branches for implemented tutorial beats. Selecting a beat replaces the current playtest with its completed checkpoint, restoring the applied world's actor placement, camera composition, lighting, finite resources, spent deals and quest milestones. Skip completed dialogue and opening flights; subsequent gameplay continues normally. Keep this as development navigation, with scenario restart restoring the full introduction.

- Denser berry traversal scene (Eric, 2026-10-17): rebuild the default known denser-patch approach as three fitted bush/card clusters, using the first sparse scene’s stable freeform arrangement. Keep the three clusters side by side on desktop and stack them on narrow portrait screens. Twelve cards mix marked ±1 steps, equal-rank matches and ±2 skips (wrapping A–K). Show a readable rule legend and per-card marks; input, recovery and solver use the same rules. Keep custom authored layouts, the sparse tutorial, finite forage rewards, travel costs, physical-arrival reveals, pause and restart intact.

- Holocard drag ghost (Eric, 2026-10-17): while dragging an actor holocard onto the map grid, show a translucent copy of that holocard at the pointer, matching the passive tutorial preview rather than the former circular name ghost. Preserve the original card, live dimensions, mouse/touch input and destination/drop behavior.

- Individual quest dealing and arrival reveals (Eric, 2026-10-17): deal each tutorial quest card separately from Hero with rapid staggered flip flights, building the upper-right stack. After a traversal deal finishes, keep the next tableau face-down and unavailable until the party physically reaches that tile threshold, then rapidly flip its cards face-up one by one. Preserve layout, card contents, pause, restart and reduced motion. This supersedes flying the whole quest stack as one and immediately exposing the next deal.

- Sequential tutorial quest cards (Eric, 2026-10-17): represent each authored Day 01 tutorial subtask as a distinct immutable card in an ordered face-down stack. Deal the whole stack from Hero to the upper-right at the existing opening camera arrival. Satisfied requirements burn away the active card with a scorched edge and embers, then flip the next card face-up. Derive completion from real travel, collection, home/supper and rest milestones; queue visual transitions without blocking play or inventing rewards. Preserve inspection, target tracking, pause and restart; reduced motion uses brief fades without fire or rotation. This supersedes rewriting/typewriter/strike-through updates for the tutorial, while generic quest text support may remain for other cards.

- Den tableau gesture demonstration (Eric, 2026-10-17): at the first den-exit tableau, reuse the passive hand-and-translucent-card drag preview to take the exposed playable rank-3 card farthest from Hero’s UI holocard and carry its preview to that holocard. Wait for the updated quest instructions and camera movement to finish, repeat quietly until the player uses a tableau card or play advances, and preserve the real cards, rank, stamina and gameplay. Span both panels, follow live layout, honor global and journey pause, and use a static source-hand/destination cue under reduced motion.

- Conditional quest instructions (Eric, 2026-10-17): the nearby-bush card initially says “Leave the den.”, with no written drag directions. Starting travel updates it to guidance about playing cards one rank higher or lower to guide Hero out of the den toward the nearby berry bushes. Shared quest descriptions support conditional updates: briefly apply a holographic shimmer, bold the outgoing instruction, draw a stylized strike through it, fade it, then type the next instruction. This acknowledges the completed step without completing/rewarding the whole quest. Honor global pause and reduced motion, keep the latest text available to accessibility/inspection, and retain the separate drag demonstration and target locator. This supersedes the earlier written drag instruction.

- Opening card arrival (Eric, 2026-10-17): hide Hero’s UI holocard and the nearby-bush quest card until the second opening-dialogue camera pan reaches its composition. Flip and fly each card from Hero’s actual projected position in the den into its respective UI slot, then enable normal interaction and the existing drag demonstration. Preserve live card state, camera overrides and global pause; reduced motion reveals the cards at camera arrival without the flight. Restarting the scenario replays the introduction.

- [Asset organization — art/presentation contract](./ART.md#contract-010).

- [Opening travel quest card — art/presentation contract](./ART.md#contract-011).

- Opening movement demonstration (Eric, 2026-10-17): after the nearby-bush quest camera handoff, show a passive hand grabbing a translucent preview of Hero’s upper-left holocard and dragging it to the actual sparse-patch target (normally table:0,1). Repeat with a quiet pause until Hero’s card is used or travel starts. Follow the live camera, preserve the real card and all gameplay state, honor global pause, and use a static hand/target cue under reduced motion.

- Cave tableau card backdrop (Eric, 2026-10-17): use rocks rather than the cave entrance inside Den tableau card faces. Retain the cave entrance in the surrounding tableau scene and preserve card values, readability and gameplay.

- Sparse tableau bush framing (Eric, 2026-10-17): enlarge and center the existing sparse bush behind the card cluster so the upper and side cards roughly follow its branching crown and the front card sits near its base. Preserve stable card positions, live fruit/depletion and gameplay; this changes tableau scenery only.

- [Day 01 Happy default — art/presentation contract](./ART.md#contract-012).

- [Opening-days Hero art and expression naming — art/presentation contract](./ART.md#contract-013).

- [Immersive starfield skybox — art/presentation contract](./ART.md#contract-014).

- [Combined actor outline — art/presentation contract](./ART.md#contract-015).

- [Day 01 Curious default — art/presentation contract](./ART.md#contract-016).

- [Curious Hero expression — art/presentation contract](./ART.md#contract-017).

- Free-positioned sparse tableau (Eric, 2026-10-16): replace the six-card sparse approach's ordered column with a loose cluster matching the supplied reference: upper-left 5, upper-right 2, lower-left 4, lower-right 6, central buried 3 and front 3, with small rotations. Explicit coverage stacks are [5,4], [2], [3,3], [6]; corner overlap alone does not block play. The route from rank 2 is 3 → 2 → 3 → 4 → 5 → 6. Keep positions stable as cards leave, finite harvest on completion and existing travel costs. Other deals retain their layouts. This supersedes the sparse single-column rule.

- Neutral Hero expression (Eric, 2026-10-16): Neutral is a distinct painted expression, midway between happy and sad with calm open amber eyes, a relaxed closed mouth and slight curiosity. It must not fall back to the happy body face. Reuse the directional head atlas across sitting, standing and walking. Replace the original head region when applying whole heads so happy mouths/ears cannot double up; keep body art and gait. Unreadable rear-quarter/back/overhead views retain authored art; seated sadness keeps its existing registered face washes.

- Travel configuration (Eric, 2026-10-16): put the stamina readout and Follow traveling actor / Cinematic travel checkboxes inside the Game settings config menu. Preserve their live values and camera behavior; keep actor close-up magnification available during close-up.

- Scenario collapse (Eric, 2026-10-16): start the development Scenario pane collapsed at every screen size, with its compact visibility-toggle tab on the right side of the game. Expanded controls retain their existing responsive layout and actions. This supersedes the narrow-screen-only collapsed default and the below-game collapsed toggle; scenario tools remain development scaffolding.

- Mobile simultaneous fields (Eric, 2026-10-16): keep the map and active tableau side by side without panel tabs in portrait and landscape; preserve authored columns and touch/mouse interactions. Scenario development data collapses to a visibility-toggle button, initially collapsed on narrow screens. This supersedes mobile panel navigation and the desktop-only layout validation exception for this work. Scenario tools remain development scaffolding.

- Opening quest cue fade (Eric, 2026-10-16): once the Day 01 opening quest camera reaches its nearby-bush composition, fade the automatic yellow target highlight, marker and connecting line over 0.8 seconds. Keep the tracker and its hover, focus and tap cues available; global pause freezes the fade. This supersedes the persistent automatic opening cue.

- [Hero travel expression coverage — art/presentation contract](./ART.md#contract-111).

- Visible manaberry emission (Eric, 2026-10-16): both the berry icon visible in a buried card’s peek and the fruit on its tableau bush glow pale blue. Keep the rest of buried card faces veiled and extinguish bush fruit and emission on depletion.

- [Hero scene mood — art/presentation contract](./ART.md#contract-112).

- Peripheral darkness (Eric, 2026-10-16): scene composition supports an optional static screen-space vignette with configurable strength, clear radius, softness and center. Dark opening-day cinematic compositions use a heavy cool preset to make surrounding darkness feel enclosing. Keep dialogue and controls above it, honor Global lights bypass and leave gameplay illumination/discovery unchanged. Use a single gradient without per-frame projection, blur or additional light passes.

- Edit workspaces (Eric, 2026-10-16): editor surfaces own mouse/wheel input, including modal callout editing; camera wheel handlers must skip them. Tile, callout and camera authoring use top ribbons for section/component browsing rather than long stacked forms. Keep apply-to-playtest, save-authored-data, JSON export and close in the tile workspace command toolbar above its fields. Panels can be dragged by their title bars and remain within the viewport. Use local overflow only as a fallback on constrained screens; preserve drafts, validation and each tool's existing persistence scope. This supersedes the fixed right editor dock.

- Callout development references (Eric, 2026-10-16): show the Dev · Dialog reference, configuration key and bubble number beneath callouts only while Edit mode is active. Hide this development label during normal play. This supersedes the always-visible development callout reference below.

- Callout reading controls (Eric, 2026-10-16): use a larger actor name with a little extra horizontal clearance beside the emoji for both name and opening text. Replace the continuation caption with a separate glowing blue bordered bubble to the right containing continuously animated ellipsis dots (static under reduced motion). Both bubbles share reveal/advance behavior. Place the parenthesized bubble count above the main bubble at the upper right. Include the controls in viewport and actor-clearance bounds.

- Callout effect tuning (Eric, 2026-10-16): selected phrase effects expose color and potency controls with live preview and local persistence. Potency adjusts emphasis weight, shake distance, wave height, glow radius, whisper softness and rainbow saturation; rainbow color sets its starting hue. Preserve reduced motion and existing saved effects.

- Callout corner expressions (Eric, 2026-10-16): enlarge the emoji and float it above the upper-left bubble corner at a raised stacking level with a gentle left tilt. Taper text wrapping closely around the cheeks and reclaim the full left inset by the second dialogue line. Include the overhang in viewport and actor clearance; preserve reveal, advance and editing.

- Berry tableau ground cover (Eric, 2026-10-16): ground sparse/dense berry bushes with soft contact shadows, feathered moss/soil and a broken grass fringe, plus deterministic low-contrast leaf/stone/grass clusters across the field. Keep cards readable, decoration outside hit testing and fruit tied to live depletion. This is presentation only; it adds no bushes or resources.

- Sparse bush travel tableau (Eric, 2026-10-16): the nearby sparse bush approach uses six cards in one ordered column, played 3, 4, 5, 6, 7, 8 from the initial rank-2 foundation. Keep the single finite manaberry on the final card and preserve travel stamina cost. Other travel tableaus retain their existing layout.

- Dynamic berry bushes (Eric, 2026-10-16): draw independent berries over berry-free foliage only while the tile has berries in live game logic. Depletion removes all fruit while preserving the bushes in OTT, immersion and tableau scenery. Sparse bushes follow their harvest flag; dense patches follow remaining berry rewards, including hidden cards and stock. Fruit distribution is presentation scaffolding, not per-bush inventory.

- Target confirmation (Eric, 2026-10-16): show only OK! and X near the selected destination, with no summary panel, cost readout or editing instructions. Keep route editing, legal travel checks and collision-aware button placement. This supersedes the detailed travel confirmation summary.

- Target selection readout (Eric, 2026-10-16): omit the floating cell-count readout while selecting a target grid. Preserve the route line, target highlights and travel confirmation estimates. This supersedes the route-end length label below.

- [Condensed bottom tile labels — art/presentation contract](./ART.md#contract-018).

- [Hero painted face layers — art/presentation contract](./ART.md#contract-019).

- [Biome tile-label pigments — art/presentation contract](./ART.md#contract-020).

- Opening quest handoff (Eric, 2026-10-16): completing Day 01 opening dialogue bubble 2/2 smoothly flies over 1.8 seconds to target den + (4.11,-43.47), zoom 10.469, yaw 200.4°, tilt 54.8°, framing 24%. Automatically activate the existing nearby-bush quest tracker line, marker and tile highlight. Preserve reveal-before-advance, manual camera takeover and explicit travel; normal tracker dismissal clears the cue.

- Physical tile-label occlusion (Eric, 2026-10-16): immersive tile labels participate in the physical world depth scene. Closer relief props obscure the ink naturally; do not draw labels through foreground foliage or stone. Preserve nearest-edge quarter-turn snapping, perspective, discovery and scene pins. This supersedes the foreground-label-over-relief rule for immersion.

- Tile-edge label orientation (Eric, 2026-10-16): text shares the tile border axes and its physical perspective/foreshortening. Snap to the nearest camera-facing tile edge in discrete 90-degree increments; never rotate continuously. Between quarter-turn snaps keep local placement, wrapping and font size fixed through camera pan, zoom and tilt. This supersedes the fixed-orientation trial and the earlier continuous camera-facing title orientation.

- Camera-aware tile labels (Eric, 2026-10-16): hover, keyboard focus, touch and scene-pinned labels use one complete-title surface renderer. Keep ink registered to its tile/connected region through live pan, rotation, zoom and tilt, including physical perspective and foreshortening; preserve foreground terrain readability and discovery gates. Scene controls can pin labels without pointer input and release them at the section boundary. Day 01's opening tutorial pins Hero's Den and the actual sparse bush through the first trip, clearing when that section completes. Camera choreography can also author labels for its playback lifetime. This supersedes the flat immersive tile-title overlay.

- Global pause and shortcuts (Eric, 2026-10-16): Space toggles a global pause for all timer-based gameplay and presentation, including actor movement, flights, solvers, cinematic/reveal clocks, route animations and effects. Preserve remaining durations and resume without wall-time catch-up; retain independent local pause states. Show a Pause/Resume control. O replaces Space for OTT/immersion. Capture both key phases and ignore repeats; preserve editable text, IME and modified shortcuts.

- Day 01 first-bush departure camera (Eric, 2026-10-16): confirming Hero’s first den → sparse bush trip overrides native travel camera activity. Pull back smoothly over 1.8 seconds to the supplied immersion shot (target -11.4,58.7 relative to the current den at 0,96; scale 9.1, yaw 217.2°, tilt 52°, framing 24%). Derive the target from the applied den position. Then hold the physical eye stationary and turn/tilt to track Hero’s actual incremental motion toward the bush, with no automated orbit or dolly. Preserve card-earned movement and manual camera takeover; other trips retain their normal camera behavior.

- [Mana-infused objects — art/presentation contract](./ART.md#contract-021).

- Scenario pane placement (Eric, 2026-10-16): place the development scenario controls and live camera readout in a separate right-hand pane outside the main game frame. Stack it below the game on narrow screens; retain scenario actions and camera/dialog copying. This remains development scaffolding.

- Day 01 opening camera (Eric, 2026-10-16): `day01.opening` (Dialog #0001) holds the supplied reference composition in immersion: den target (currently world 0,96), zoom 9.165×, yaw 194°, tilt 17.6°, framing 24%. Start directly in this shot for bubble 1/2. On reaching bubble 2/2, smoothly swing over 1.8 seconds to zoom 9.935×, yaw 186.4°, tilt 82°, framing 24%, keeping the den target. Reading alone triggers the second shot; derive its target from the authored den position. This replaces the first-pass opening establish/push sequence for Day 01 only.

- Scenario camera references (Eric, 2026-10-16): show live map camera target, zoom, yaw, tilt, mode and framing in the scenario pane, with a camera/dialog copy action. Beneath each development callout show its stable configuration key, permanent short Dialog reference and current bubble number. Reuse the existing authoring keys for edits/triggers; keep the source reference catalogue append-only across reloads and restarts. This is development scaffolding, not a new dialogue database or gameplay requirement.

- [Opening darkness and sparse berry light — art/presentation contract](./ART.md#contract-022).

- Familiar nearby patch (Eric, 2026-10-16): the sparse manaberry tile at table:0,1 starts fully discovered and painted; Hero has visited it many times. Author it as initially revealed so it skips fog and first-discovery sketching. Preserve its normal travel cost, finite harvest and story progression.

- Callout playback and actor priority (Eric, 2026-10-16): callouts must clear every visible scene actor, including their speaker, throughout live camera/actor movement and viewport clamping. Prefer a nearby free position with clearance for the tail; never fall back to covering an actor. Longer dialogue uses sequential bubbles, with blank lines for explicit authored breaks and automatic sentence/word pagination. Reveal letters within stable word layouts at a configurable speed, gently slowing marked/emphasized text and pausing at punctuation. Reduced motion shows complete text immediately; hidden scenes and cinematic pause freeze reveal. Click/tap or Enter reveals the current bubble first, then advances on another activation; the final bubble closes or invokes its owner's continuation. Only the bubble and editor capture pointer input. This supersedes passive-only callouts; reading never advances story automatically. The existing editor persists authored breaks and per-callout letter speed locally.

- Quest tracker (Eric, 2026-10-16): replace the map-edge objective tag with a fixed right-side quest tracker beneath the config buttons. Hovering, keyboard-focusing or tapping the quest title draws its live target line and highlights the actual target grid, with a steady reduced-motion cue. Taps toggle the cue; tapping elsewhere dismisses it. Keep a separate center-map action, stable grid reference and story progression. This supersedes the daily objective edge tag and cinematic corner-label placement; never start travel, reveal terrain or overwrite routes through tracker interactions.

- Camera keyboard ownership (Eric, 2026-10-16): WASD remains assigned to map/camera movement while cards, previews, dialogs, buttons or other non-text controls have focus. Relinquish it only while an editable text/data input, textarea or contenteditable region has focus; read-only fields and non-text inputs do not capture WASD. Focusing an editable field, hiding the page or losing window focus releases held movement keys. Preserve modified keyboard shortcuts and text composition.

- [Brush color fill — art/presentation contract](./ART.md#contract-023).

- [Watercolor bleed — art/presentation contract](./ART.md#contract-024).

## Authored days and Banks rescue cinema (Eric, 2026-10-15)

- Daily objective waypoints (Eric, 2026-10-15): mark each scripted day's current destination on the map with its objective and stable grid reference, using its actual saved/applied landmark position. Day 01 guides sparse bush → denser patch → den, Day 02 denser patch → darker woods, and Day 03 marks the den staging. Keep an edge arrow when the target leaves the camera; mouse, touch and keyboard activation centers the view without starting travel. Update markers with story progress; do not change authored tiles, reveal concealed terrain or overwrite the player's editable travel route.

- Saved-world preservation (Eric, 2026-10-15): every scenario uses the entire saved/applied tile document. Scenarios must never filter out, add, move, retheme or retune authored tiles. Story beats and finite deals attach to existing eligible landmarks as live session state; keep authored population/resource density, deal-size settings, travel costs, lights, passages and scenery intact. Restart, day switching and the Day 02→03 transition retain the latest applied document. Adapt scenario actor stamina to the authored route when necessary, rather than changing terrain costs. Normal discovery still controls which existing tiles are visible. This supersedes the initial miniature scenario layouts and fixed scenario tile positions.

- [The development scenario selector opens Day 01 (Before dark), Day 02 (The darker woods), Day 03 (... — art/presentation contract](./ART.md#contract-025).

## Callout authoring tools (Eric, 2026-10-16)

- The Edit tiles control is a pencil icon immediately left of the map settings cog. Edit mode retains active callouts and gives each a pencil action for an emoji selector, editable text and live preview. Select specific words or phrases to apply RPG emphasis, shake, wave, glow, whisper or rainbow effects, or clear their effect. Respect reduced motion, retain plain accessible text, and keep ordinary callouts passive outside editing. Save callout overrides locally across reloads and scenario restarts, with Cancel and Restore original; these browser-local overrides do not change repository dialogue or authored tile data.

## Opening days cinematic first pass (Eric, 2026-10-16)

- Temporary review scaffolding: enable authored first-pass cinematics for Day 01, Day 02 and the staged Day 03 morning. Establish the actual saved den, approach Hero for food/light decisions, let the woods dwarf her, and return to a gentle Hero/Banks morning composition. Named sequences resolve actual applied landmark positions; the north-facing den mouth must remain open to the camera. Use existing milestone lighting and finite carried-mana glow, with restrained presentation-only scene grading and vignette. Place objective labels in a free corner during idle story portraits, preserving their pin, grid reference and focus action. Remove the decorative table grid during idle story framing; restore it for travel, editing, sandbox or disabled cinematics.
- Use shared Callout and camera choreography authoring. Built-in first-pass sequences are source defaults, exposed for preview/tuning without writing them into browser saves. User sequence/callout overrides retain priority; Reset first pass removes a local sequence override. No repeated camera grabs on ordinary rerenders; travel and manual camera input release the shot. Dialogue does not advance automatically. Day 02 rescue uses authored native Three.js camera cues on its existing cinema beats, with reading, hidden-tab and manual-pause behavior preserved. Keep the existing unconsciousness, legal AI combat, paired nuzzle and fade.
- Cinematic review exposes the current day's shot intentions, lighting notes, camera-only previews, release/pause controls and an off switch. Previews do not move actors, advance time/progress, reveal terrain or change the saved map. Day 03 remains morning staging, not a newly implemented full day. Framing/timings and color grade are a first pass for review, not final art direction. This request supersedes the earlier no-default-choreography policy for these scripted days only; sandbox retains manual camera behavior.

## Camera shot authoring (Eric, 2026-10-16)

- Callout editing includes an optional captured/custom map-camera shot or a named choreography, automatically played once when the callout appears during gameplay. Camera choreography tools author named ordered shots with world target, zoom, rotation, tilt, OTT/immersion mode, fly/hold durations and smooth/linear/cut transitions. Capture the current view, preview, reorder/remove shots, save/delete sequences, pause/resume/stop and optionally return to the starting view. A preset explicitly authorizes switching camera mode for that shot, superseding manual-only immersion for authored shots only.
- Browser-local choreography triggers support manual playback, a callout ID, scenario start, travel start/arrival (destination tile ID) and Hero entering a tile. Blank targets match any; the first matching saved enabled sequence wins, explicit callout presets take precedence, and a new trigger replaces current playback. No default choreography or triggers are installed. Manual camera input interrupts playback. Restart/map teardown cancels it; hidden tabs and paused travel freeze its clock. Reduced motion cuts to each shot while preserving hold time. Tools and callout overrides share local persistence; tile documents and repository dialogue remain unchanged. The initial camera adapter targets the map; separate combat/cinema camera rigs retain their existing shots.

## Reusable Proto callouts (Eric, 2026-10-15)

- [Proto speech bubbles use the dedicated `src/proto/components/Callout.tsx` component and its optio... — art/presentation contract](./ART.md#contract-026).

## Banks character artwork (Eric, 2026-10-15)

- [Approved global Banks design — art/presentation contract](./ART.md#contract-027).

## Mana survival and spirit discovery direction (Eric, 2026-10-15)

- [Hero has a natural bobtail, with no fire tail, tail emitter or flame response to spirits. Preserv... — art/presentation contract](./ART.md#contract-028).

- Forest coverage and clarity (Eric, 2026-10-15): completed woods populate their full tile interior with deterministic scattered planting, rather than corner rows or an empty central corridor. Keep small trunk clearances for centered actors and orthogonal movement; canopy overlap uses actor peek-through. Unfinished neighbor sketches retain their approach-border layout. Render tall trees at their painted proportions from a sufficiently detailed raster, without enlarging a small filtered layer or stretching its height. This supersedes restricting woodland props to fixed corner footprints and the earlier vertical-only tree enlargement.

- Tile population and tree scale (Eric, 2026-10-15): tiles author a population density from 0–10, separate from reward/resource density, editable and saved with tile data. Woods default to 3/10 and berries to 2/10; higher values add deterministic relief props, including the approach-border sketches, while zero removes them. Preserve actor centers and travel lanes. Raise woodland relief crowns to three times their previous height with contained ground widths so trees tower over actors; keep the Curious Sapling small. Mountain height may increase if required, but is not a ceiling on trees. This supersedes uniform shrinking of tree height with the corner footprint.

- [Adjacent terrain sketches — art/presentation contract](./ART.md#contract-029).

- [Sketch relief placement — art/presentation contract](./ART.md#contract-030).

- Tile inspection gestures (Eric, 2026-10-15): suppress the native browser context menu across game pages while retaining authored menus and right-drag camera movement. Right-click a discovered, unlocked tile to open its shared details card. Touch uses a 650 ms stationary hold with a circular progress indicator; movement, multiple fingers, release, cancellation or focus loss cancels it. Completed holds consume the resulting tap, never select or travel, and inspect only the tile even when occupied. Reduced motion uses a steady indicator. Keep normal tile taps and actor inspection unchanged; preserve editor right-click placement tools and discovery/lock gates.

- Terrain passage POC (Eric, 2026-10-15): authored single-cell passages connect east↔west or north↔south, retaining the other axis as blocked even after opening. A single visible obstruction (initially Hastily Buried Trapdoor, #buried) conceals a tile-local crossing deal, initially seven columns. Assigned abilities declare terrain tag capabilities; DIG matches #buried and spends the displayed breach AP. Opening grants no movement, AP, pickups, rank change or combo credit; subsequent ordinary plays earn the crossing. Breaches persist in live tile state for both travel directions until restart, and never serialize as authored data. Rank resets, party ranks and Auto-Solve cannot bypass obstructions. Players can replan or cancel at the safe approach. Unknown passages retain neutral knowledge-based routing until discovery. Ordinary travel retains its existing journey-wide deal. The mountain directly south of the den has a north–south passage as the initial non-balanced POC, with 14 crossing cards, 3 STA and a 1 AP breach. Passage title, tags, axis, revealed columns (1–10) and AP cost are editable; tuning and the painted-card placeholder are temporary. This supersedes blanket mountain impassability only for explicitly authored passages.

- Tile editor quick placement (Eric, 2026-10-15): right-click an empty editor grid cell to replace the dev placeholder with a five-entry recent tile picker. Successful adds, duplicates and property updates populate session-memory recents, newest first, preserving authored tile settings. Fill available slots from the first supported terrain templates when needed; never duplicate the unique den. Placement uses normal draft validation and undo.

- Tile editor entry (Eric, updated 2026-10-16): Edit tiles can stop active travel and leave a tableau to enter editing directly, preserving earned resources and completed progress. Preserve the current Global lights setting on entry; disable Table lights and time cycling. Lighting controls remain available. This supersedes requiring the player to finish travel and leave the tableau manually.

- Actor/prop clearance (Eric, 2026-10-15): reserve tile centers and orthogonal travel lanes for actors. Traversable scenery occupies fixed corner footprints, including the Curious Sapling; fit its full ground width within that footprint at every camera heading. Screen-space foreground occlusion remains supported. The den retains its authored sleeping hollow. Small painted scenery must retain sufficient raster detail at close immersion zoom.

- Orthogonal pathing default (Eric, 2026-10-15): disable diagonal grid pathing by default. Automatic routes and routes through edited waypoints use north/south/east/west grid steps. Preserve legal terrain and discovery checks, and calculate travel estimates from the resulting route.

- Map tableau test default (Eric, 2026-10-15): start with Map tableau (test) disabled. Keep the settings toggle available for explicitly enabling the travel presentation trial.

- Click-to-add waypoints (Eric, 2026-10-15): proposed routes start with a numbered draggable destination. Clicking or tapping any intermediate grid cell along the active proposed waypath adds a numbered draggable waypoint in route order. Preserve destination, estimates, discovery and legal-route rules; duplicate nodes and origin clicks add nothing. Existing waypoint drag and keyboard adjustments remain available.

- Travel card framing (Eric, 2026-10-15): exposed world-card faces constrain the automatic cinematic shot. Frame the actor and all seven nonempty columns with a tapping margin, including cards already behind the actor. Prefer the close shoulder view, ease toward a raised three-quarter view or widen when needed, and return toward shoulder framing as cards clear. Accessibility takes priority over actor anchoring and decorative sweep. Briefly steady orientation and inward zoom during card interaction; continue following actual actor movement. Stations remain fixed world props, with unchanged card rules and peek-through. This supersedes the strict screen anchor and minimum tile span below when they conflict with card accessibility.

- Shoulder tracking (Eric, 2026-10-15): translate the world-travel camera in tandem with the actor’s live animated position on every movement frame, including acceleration, braking and route turns. Card presses and travel controls preserve tracking; explicit manual camera input still releases it. Pause freezes the shot. Keep shoulder distance steady while adding a slow, shallow cinematic sweep (about ±3° yaw and less than 1° pitch); hold the actor’s screen anchor, keep tapping stable, and disable drift for reduced motion.

- Immersive tile traversal (Eric, 2026-10-15): world travel uses a close, steady behind-the-shoulder camera; one 48-unit tile must span the viewport at minimum, with surrounding full-sized relief creating an interior space. Permit deep manual zoom while retaining near-eye clipping, darkness and discovery. Legal plays bank distance under unchanged seven-column/rank/STA/AP rules. Actual walking smoothly accelerates into the earned buffer and brakes toward its endpoint, never overshooting; gait follows ground distance. Pause freezes movement. Keep the seven column stations in the physically occupied crossing (card provenance and play rules remain unchanged), distributing fixed stations along that crossing, including ground and elevated placements, without requiring attachment to scenery. Exposed cards share actor peek-through and remain clickable through occluding props; covered cards gain no play privilege. Keep the actor holocard foundation and compact controls. This is a travel presentation trial; broader puzzle migration remains future work.

- Map click inspection (Eric, 2026-10-14): clicking or tapping a tile does not open a tile detail card or inspect an actor merely because it occupies that tile. Retain tile selection/labels and existing discovery/lock rules. Clicking or tapping an actor still opens that actor's detail card; actor inspection does not add a tile card alongside it.

- Danger particle light (Eric, 2026-10-14): visible danger embers emit bounded red light onto the surrounding ground, scenery and haze in OTT and immersion. Use one pooled source per visible warning cloud, shared by the normal light renderers and Table lights toggle. Preserve warning visibility gates so concealed or locked tiles do not leak danger; reduced motion keeps a steady glow.

- Travel Auto-Solve availability (Eric, 2026-10-14): Auto-Solve is immediately available on active travel tableaus, including first-time easy crossings. Remove the Trail Familiarity unlock gate for the current playtest; keep tracking terrain mastery. Preserve legal plays, normal stamina/AP/rewards and stopping on pause, blocked routes, insufficient stamina or arrival. This supersedes the five-crossing Auto-Solve lock below.

- Event cards suspended (Eric, 2026-10-14): remove event cards from live tableau spawning for now, including optional travel SEARCH, event utilities and the discard-pile controls. Ordinary crossing deals, stamina, combos and terrain mastery remain active; travel continues without an event decision. Retain event scaffolding for later iteration. This supersedes the event-spawning requirements below while suspended.

- Opaque, illuminated tableaus (Eric, 2026-10-14): tableau cards remain opaque, including covered and currently unplayable cards. Dim ink or surface lighting instead of reducing card opacity. Tableau backgrounds follow the same global day/night lighting and Global lights bypass as the map; visible player foundations cast enough local light to keep tableau cards readable. This lighting is presentation only and must not alter world visibility, discovery or gameplay light sampling.

- Standard tableau presentation (Eric, 2026-10-14): use the shared TableauTemplate/TableauPlayArea components for new tableaus, with measured card fitting, existing ProtoCard faces, overlapping covered rows, foundation size caps and the active tile's landscape/card background. Travel follows the same template as gathering and rest; concealed terrain retains a neutral background.
- No game scrollbars (Eric, 2026-10-14): no game element may display a scrollbar. Tableaus must fit their cards and controls in the available viewport, rather than using a scrolling tableau. Use fitted layouts, pagination or inspection views for overflow content. This supersedes earlier instructions for scrollable game panels.

- Nonblocking event decisions (Eric, 2026-10-14): an event does not lock its tableau. SEARCH appears in the active easy tile's deal, allowing its ordinary legal plays, rank/combo/AP gains, resets and supported solver actions while the event remains unresolved. Only that tile's transition/refill/arrival waits when its crossing work is complete; resolving or discarding the event releases that boundary. This supersedes the tableau-wide wait for an event decision below.

- Tableau events and easy travel (Eric, 2026-10-14): event cards carry explicit alternative solutions: exposed wildcard, legal adjacent rank, permitted Fetch/Dig, or party characteristic tags. Visible covered events open in jumbo immediately; inspection never bypasses play depth, AP, rank or characteristic requirements. Exposed events can be declined into an inspectable discard pile. Wildcard/characteristic events preserve foundation rank and events themselves grant no work AP or travel distance.
- Easy crossings and SEARCH (initial tuning, 2026-10-14): known free/easy terrain uses a three-card crossing deal by default, retaining authored overrides and actor affinities. On completing each easy grid crossing, offer one wildcard SEARCH: commit 1.5 STA for four additional rank plays and one terrain-appropriate reward (woods: wood; other easy terrain: mana), or discard without cost. Maintain the combo; search plays earn AP but no distance. Hold arrival/continuation while the choice or search is pending. Offers, AP/pickups and mastery credit do not refresh on same-day revisits to that grid; a new day refreshes the opportunity. Five fresh crossings of an easy terrain kind earn Trail Familiarity and unlock travel Auto-Solve for that kind; Best Move remains available. Solvers stop for event decisions. These values are tuning, not permanent balance targets. Random ambushes and the early-warning unlock are explicitly deferred for this first SEARCH version.

- Travel confirmation placement (Eric, 2026-10-14): measure the summary and OK!/X group and find free map space near the destination, avoiding the entire route, every node and map controls. Recalculate after route edits, camera changes and viewport resizing rather than covering the route with a fixed destination offset.

- Editable travel destination (Eric, 2026-10-14): the final target grid has its own numbered draggable route node, including adjacent destinations. Mouse, touch and arrow keys update the destination, arrival and estimates; illegal targets preserve the last legal route.

- Map settings placement (Eric, 2026-10-14): anchor the settings cog to the map's upper-right corner. Reclaim the old header space when it has no active content; retain necessary mobile panel navigation.

- Settings consolidation (Eric, 2026-10-14): party controls and all former lighting-rail content live in the settings menu on desktop and mobile, including clock, time/cycle/light controls, development tile editing and build identification. Keep the menu bounded and scrollable.

- Continuous transition darkness (Eric, 2026-10-14): keep global darkness and undiscovered-cell haze visible throughout OTT/immersive transitions in both directions. Camera transitions must never expose the map by hiding or fading in its visibility mask. Preserve the explicit Global lights bypass.

- Default time (Eric, 2026-10-14): Proto starts and resets to midnight (00:00), including the Ordinary Day opening, and holds there unless the player manually changes time or enables optional cycling. Gameplay progress, including travel plays, gathering, supper and bedtime, never changes the lighting clock or overrides a manually selected time. This supersedes the morning opening and progress-based time changes below.

- Cinematic tableau travel (Eric, 2026-10-14): extend actor follow with a default-enabled Cinematic travel option. Slowly pan, sweep and zoom around the traveling party's actual incremental position, using wider framing for multiple members. Enter immersion on confirmation when follow and cinematic travel are enabled, yielding actor close-up framing. Pause and blocked travel freeze the shot; manual camera input releases automatic tracking. Reduced motion uses steady framing. Camera movement never earns distance, spends resources or discovers terrain; preserve card-driven progress and arrival encounters.

- OTT night haze and Global lights (Eric, 2026-10-14): overhead shares the dense night fog, local light openings and extra undiscovered-cell density with immersion. Known relief contributes height-weighted neighbourhood fog and obstruction through its footprint without rendering raised props in OTT; never use concealed relief geometry. Tune overhead fog to keep actors and route controls readable and omit immersive sky shafts. Settings exposes a persisted Global lights toggle, enabled by default and independent of Table lights and carried/scenery emitters. Checked applies global day/night lighting and haze; unchecked bypasses global shading and haze for a bright view. It changes presentation only, retaining the clock, gameplay light sampling and discovery.

- Sapling glow (Eric, 2026-10-14): Curious Sapling emits faint warm-green light even while undiscovered (strength 0.16, radius 1.25 cells), with 3–5 tiny gently drifting fireflies in OTT and immersion. Preserve its stronger discovered light, Table lights toggle and normal terrain/title discovery. Reduced motion freezes particles. This supersedes discovery-gated sapling emission below.

- Party system (Eric, 2026-10-14): co-located player-controlled actors can join a party on the world map, travel together, and each contribute an additional foundation to shared travel and exploration tableaus. Plays choose a receiving member and retain individual foundation ranks and AP. Membership changes require idle map actors. Current scaffolding caps the roster at three existing authored actors and exposes an explicit Add playtest companion control; these roster controls are temporary. Den rest and the authored combat sandbox retain their existing specialized rules.

- [Mobile settings and art retirement — art/presentation contract](./ART.md#contract-031).

- Heavy night atmosphere (Eric, 2026-10-14): immersion at midnight has dense, nearly opaque dark haze. Local sources open bounded pockets of visibility; unlit relief recedes into darkness, and tall visible scenery increases density in surrounding areas. Fully undiscovered cells carry additional dark fog without revealing hidden terrain shapes. Preserve gameplay discovery, steady light rules, readable controls, camera interaction and day/night transitions. Low effects, reduced motion and Canvas fallback retain this dark presentation; reduced motion freezes haze drift. This supersedes the earlier broadly readable moonlit volumetric presentation.

- Auto-solve availability (Eric, 2026-10-14): every Proto tableau puzzle exposes Auto-Solve and Best Move, including travel and the shared battle tableau as well as gathering, rest and hut construction. Travel uses normal stamina/rewards and stops on pause, completion or a blocked move. Battle uses legal foundation plays and real attacks, waits for card flights and stops when the fight ends. New surfaces expose only supported solver options.

## Developer tile authoring (Eric, 2026-10-14)

- Proto offers an explicit development-only Edit tiles mode with the actual OTT/immersive table as its preview and a separate editor module. Enter it after finishing travel and leaving the tableau. Pause gameplay while editing, retain camera and Paint/Pixel controls, and reveal terrain for editor inspection without discovering it in the playtest.
- Select cells through the shared table grid, or use coordinate and tile selectors. Support adding, moving, duplicating and removing tiles, validated footprints, and draft undo/redo. Keep Hero's Den unique, unlocked and free to enter at (0,2) while current home/rest rules depend on it.
- Keep shared terrain travel defaults distinct from optional per-cell overrides. Tile properties include titles, footprints, traversal costs, deal tuning for woods, locks, initial visibility, flags, road prints and scenery lights. Berry/path/rest deals and authored encounters retain their current game generators; this editor does not introduce an encounter catalog.
- Apply to playtest changes the live session without writing disk; closing discards unapplied draft changes. Save authored data writes the validated layout and defaults to `src/data/protoTiles.json` through the trusted local development endpoint, then the normal development reload loads the authored layout. Existing session card deals, rewards, discovery, traversal progress and combat completion must never be serialized as authored data. Keep the schema, validation and persistence reusable by the separate tooling surface. JSON export is also available.

## Card-driven travel (Eric, 2026-10-14)

- Reaching a Cairn automatically continues the journey and refreshes newly discovered next-tile tableau cards. Do not require another OK! confirmation for ordinary tile transitions or revised terrain estimates. Preserve the actor foundation rank, earned rewards, expenditure and global streak; enforce available STA on actual plays. Newly discovered impassable terrain still halts for route replanning.

- Travel uses the moving actor's shared ActorHoloCard as its foundation, with matching puzzle foundation artwork, frame, live rank bubble, inspection and resource receipt feedback. Resolve identity and INSP/AP from the moving actor, rather than using an anonymous rank box or assuming Hero. Preserve travel rules and keep tableau cards no larger than the foundation.

- Knowledge-based navigation (2026-10-14, implemented): plan by player knowledge, assuming unknown cells are provisionally traversable and preferring the shortest presumably legal route. At safe Cairns, discover adjacent terrain and halt before entering any newly revealed impassable cell on the remaining route. Prompt waypoint replanning from that Cairn toward the original destination, preserving earned progress, expenditure and rewards. Unknown costs/colors/cards must not reveal hidden terrain. The detailed behavior and validation contract are in `docs/travel-fog-routing.md`; this supersedes using concealed obstacle truth to choose a detour. Unknown cells provisionally cost 1 STA and seven neutral travel cards; their route colour is neutral gray.

- Route colours are determined per grid cell by actor-adjusted traversal difficulty: pale green for free ground, green for easy, amber for moderate, orange for hard, red for very hard. Never colour by distance along the journey. Preview, edited and travelling routes share this presentation.

- Travel has no destination card. Destinations open directly in route-edit mode, with OK! (confirm) and X (cancel) buttons anchored to the target grid, kept reachable near viewport edges. The destination summary and button row share a layout with the buttons beneath the summary, never covering it. Keep the live route/card/STA estimate visible while editing. Confirm requires sufficient estimated STA; cancel discards the proposal without costs or movement.
- Same-square actor drops are no-ops. Numbered route handles support mouse/touch dragging and arrow-key grid adjustments, recalculating legal paths and estimates. Blocked waypoints preserve the last valid route. Route counts use actual grid crossings.

- [Actor and compact actor-card drags propose a destination and preview a legal route. Confirm its c... — art/presentation contract](./ART.md#contract-032).

- Non-combat foundation utilities (Eric, 2026-10-13): Hero’s foundation minicard exposes Fetch and Dig for non-combat tableau puzzles, independent of combat loadout slots. Normal puzzle plays bank 1 AP per actor; retrieval spends AP without earning play AP. Fetch costs 2 AP for an exposed card; Dig costs the card’s current depth starting at 1. Keep pickups, rest recovery, refill and rank-independent retrieval. AP persists during travel and resets with the game.

- [Curious Sapling — art/presentation contract](./ART.md#contract-033).

- [Hero main-card brushwork — art/presentation contract](./ART.md#contract-034).

- [Ability artwork subjects — art/presentation contract](./ART.md#contract-035).

- [Ability watercolor softness — art/presentation contract](./ART.md#contract-036).

- [Watercolor ability cards — art/presentation contract](./ART.md#contract-037).

- [Independent Hero bobtail — art/presentation contract](./ART.md#contract-113).

- [Mochi watercolor sprites — art/presentation contract](./ART.md#contract-038).

- Den cave occlusion (Eric, 2026-10-14): remove den actor peek-through in Paint and Pixel. Keep cave stone opaque at every orbit and zoom; painted occupants appear only within the authored mouth opening and are clipped by its walls and roof. Preserve live occupants, inspection, whole-square grabs and OTT. This supersedes the earlier den mouth peek and den occlusion-outline requirements; other scenery retains shared actor peek-through.

- Inspiration and foundation receipts (Eric, 2026-10-13): use 💫 for Inspiration. A foundation receiving resources triggers the shared expanding holographic shimmer, including wood, mana and Inspiration; preserve berry-to-mana conversion, repeated receipts, readable cards and reduced-motion static glow. Effects are presentation only and never gate rewards.

- Berry tableau vegetation (Eric, 2026-10-13): bushes sway gently with independent timing about fixed ground anchors. Taking a nearby tableau card triggers a brief damped rustle, weighted by screen proximity and world distance so closer props respond more strongly. Reduced motion keeps vegetation still; scenery remains outside hit testing and gameplay.

- [Tile discovery drawing — art/presentation contract](./ART.md#contract-039).

- Tile label layering (Eric, 2026-10-13): every revealed tile title renders above all terrain props and ground roughage in OTT and immersion through the shared foreground title compositor. Keep complete title fitting, connected-region labels, hover/focus/touch reveal and tile interactions.

- [Actor visibility — art/presentation contract](./ART.md#contract-114).

- Mana terminology and woods rewards (Eric, 2026-10-13): rename the former manna resource to mana throughout state, rules, UI and tooling. For now, woods tableaus provide wood only: remove mana and food/herb pickups that convert to mana, along with mana work and completion/combat rewards. Preserve rank sequences, encounters, wood rewards, and berry/pond mana collection and supper behavior. This supersedes earlier woods food and mana rewards.

- Woodland ground texture (Eric, 2026-10-13): OTT and immersion share a flush grass-and-earth base beneath woods props, with scattered ground flecks at least as visible as the Three.js battle floor. Keep texture anchored in world space, use broad washes in Paint and crisp flecks in Pixel, tint combat ground dark red/gray, and conceal undiscovered/locked terrain. Preserve existing textured dirt, berry, den and mountain bases.

- Woods roughage (Eric, 2026-10-13): woods floors carry deterministic foliage, earth clumps and stones throughout their contained footprint, rising 1–2 shared height units in immersion and lying flat in OTT. Combat scenery uses an alpha-preserving dark red/gray material/filter on existing props, retaining Paint/Pixel, discovery, lighting, actor peek-through and gameplay.

- Actor card travel (Eric, 2026-10-13): dragging a compact floating actor inspection card onto a map tile initiates the actor's existing pathfinding and travel, with the same route preview, terrain restrictions and arrival behavior as a scene actor drag. Hide the original card during an active drag and show the held card at 35% opacity so highlighted terrain grids remain visible for precise targeting; restore the original on release or cancellation. Support mouse and touch, keep the held card above scenery, preserve click/Enter jumbo inspection, and cancel safely without traveling or opening jumbo.

- [Automatic tile spillover — art/presentation contract](./ART.md#contract-115).

- Actor ability management (Eric, 2026-10-13): jumbo actor cards show unassigned available abilities to the left. Drag abilities between that tray and the card’s assigned tray; preserve the four-slot limit and remember actor loadouts locally. Dropping onto an assigned row replaces it when all four slots are occupied. Hero can assign Fetch (2 AP, retrieve any exposed top-row card) and Dig (retrieve any tableau card for AP equal to its depth from the exposed top row, starting at 1). Retrieval moves the card onto Hero’s foundation regardless of rank and spends AP without granting the normal play AP.

- Berry Patch Inspiration pickup (Eric, 2026-10-13): hardcode one INSP pickup on the first seeded Jack (step 8), using ⚡ as a temporary Unicode icon. Playing it grants exactly one Inspiration to the receiving actor's foundation pool, funding the existing random foundation redraw. Keep this separate from carried berries/mana and their mandatory quota; preserve the ten-card opening sequence.

- Jumbo actor abilities (Eric, 2026-10-13): show selected Ability Tray moves on the actor's jumbo card as icon-and-name rows only. Selecting an assigned or available ability hides the actor jumbo, its trays and external controls while showing the centered portrait Ability Card; pause the hidden actor's animations. Closing the Ability Card restores the actor jumbo and focus to the selected row. Keep costs and effect text on the Ability Card, with mouse, touch and keyboard selection and dismissal. Inspection does not spend AP or execute an attack. This supersedes the side-by-side and overlay ability layouts.

- Jumbo overlay layout (Eric, 2026-10-13): put the description above the abilities. Each ability is a separate rounded, translucent bubble with a thin gap between rows. Description and ability overlays share an independent foreground parallax layer with configurable depth; use a distinct third plane above the actor artwork, with 12px maximum travel per axis and 48px foreground depth projected through local card perspective. Retain this text parallax on small screens and keep reduced motion static. Float stat, equipment and effect bubbles beneath the physical card; put the Playtest values button below that row. Reserve screen space for these external controls while preserving portrait proportions, readable text and existing ability inspection behavior.

- Berry Patch infinifill (Eric, 2026-10-13): preserve the deterministic ten-card 3-through-Queen foundation sequence and its two mana rewards. Place random A–K cards beneath that sequence to fill seven columns of four rows. Every removal replenishes the same column beneath its remaining cards; random cards become playable after the seeded Queen. Mandatory resource seeding maintains the nearest whole-card 20% quota: six of the 28 tableau cards bear berries yielding mana, including the two authored rewards in the ten-card opening. Randomize initial filler reward placement; each refill restores that quota. Preserve the live deal when leaving and returning. This supersedes the finite Berry Patch deal; Old Tree remains finite.

- Offscreen table waypoints (Eric, 2026-10-13): key props can opt into a shared screen-edge reference system. Quest cards, including the ordinary-day story card, show a small preview of their actual face and a directional arrow at the nearest viewport edge when fully off-camera. Always place the arrow between the offscreen object and its preview: viewport border, arrow, thumbnail, proceeding inward. Follow the live table projection through pan, zoom and orbit; hide the reference when the prop is visible or held. References are passive and do not intercept table gestures.

- Physical table cards (Eric, 2026-10-13): placed cards, including quest cards, keep a fixed world size and scale with tiles and props as the camera zooms. Cards may be dragged and released anywhere on the visible table, beyond the actor movement boundary; retain unsnapped placement and collision avoidance around actual tiles and buildings. This supersedes screen-constant day quest sizing and terrain-boundary restrictions for cards. Floating inspections retain their readable screen sizing.

- Friendly combat targeting (Eric, 2026-10-13): combat targeting accepts living party actors, including self, through foundations and live scene sprite drops, with shared outlines and focused HP predictions. Current abilities allow friendly fire and spend normal AP; party targets take direct damage and can fall. Party stagger and enemy-specific status effects remain unimplemented. Preserve enemy, trap, inspection and tactical-hold interactions.

- Ability inspection and tactical hold (Eric, 2026-10-13): tray abilities remain clickable regardless of available AP. Show their ability card and open the shared jumbo inspection when that card is clicked, tapped or keyboard-activated; inspection never bypasses normal AP costs or target eligibility. Grabbing an ability card starts a tactical pause immediately on pointer-down and keeps combat timers, effects and actions frozen until release, cancellation, lost capture or focus loss. Hide every tableau card's value, including buried values and accessible labels, for the entire hold; suspend tableau play, redraw and deal actions so the pause cannot be used for sequence planning. Resume without advancing through the held interval, preserve any separate manual pause, and retain targeting previews and scene drops while holding an affordable ability. Opening the tray card or its jumbo inspection alone does not start the tactical pause.

- [Hero's natural tail — art/presentation contract](./ART.md#contract-040).

- Combat scene ability drops (Eric, 2026-10-13): ability cards can be dragged onto living slimes in the combat scene as well as their tableau targets, using the same attack, target outline and HP prediction. Forgiving drop regions follow live sprite geometry, animation, camera orbit and zoom; overlapping scene targets prefer the sprite under the pointer, then the closest centre and nearer depth. Exclude defeated, absent and offscreen actors; minimap and camera tools are not drop targets. Scene drop regions must not intercept camera controls or alter normal tableau targeting. Retain mouse and touch dragging, cancellation and existing keyboard targeting in the tableau.

- Combat target feedback (Eric, 2026-10-13): while an ability is armed or dragged, mirror tableau target outlines on the combat scene's live slime silhouettes: faint gold for valid targets and strong gold for the focused target. Draw predicted HP loss only on the focused target, identically in its tableau HP bar and scene health marker. Clear feedback on cancellation, loss of focus, attack, restart or defeat; retain mouse, touch and keyboard targeting. Derive predictions from the existing attack rules, with no gameplay changes or new artwork.

- [Actor environment matching — art/presentation contract](./ART.md#contract-041).

- [Battle actor peek-through — art/presentation contract](./ART.md#contract-042).

## Tableau play costs (Eric, 2026-10-12)

- Playing tableau cards consumes no stamina, Inspiration or exploration energy. Legal plays remain available at zero energy. This supersedes earlier tableau energy costs; foundation redraw and other action costs retain their existing rules.

## Tableau card sizing (Eric, 2026-10-12)

- [Biome card variation — art/presentation contract](./ART.md#contract-043).

- [Biome tableau card backgrounds — art/presentation contract](./ART.md#contract-044).

## Starlit woods tableaus (Eric, 2026-10-12)

- [Use CJ Gammon's “Winter Trees” (https://codepen.io/cjgammon/pen/ONWeZX) as spatial inspiration fo... — art/presentation contract](./ART.md#contract-045).

## Manual immersion (Eric, 2026-10-12)

- Immersive mode starts only through the player's explicit O or camera-mode button. Startup, actor availability, travel follow and staffed encounters never activate it automatically. Start in OTT without automatic actor close-up. Follow traveling actor operates only when immersion is already selected; preserve the player's mode on arrival, departure and encounter changes. This supersedes earlier automatic close-up, travel and encounter immersion entry rules.

## Map and tableau layout (Eric, 2026-10-13)

- When no tableau is present, the map fills the available play area beneath the header; hide empty tableau and foundation panes.
- When a tableau is present, put it and its foundations in the narrower left pane (1 share), keeping the map in the larger right pane (1.7 shares). A selected deal remains visible even when cleared or unstaffed.
- During combat, keep the combat tableau and all foundations in the narrower left pane and the combat scene in the larger right pane. Overlay the world minimap on the combat scene with working zoom and View map controls.
- These rules supersede the former persistent empty fields, map-left exploration order and larger combat tableau. Mobile retains explicit Table / Tableau navigation when a tableau is present.
- All tableau scenes retain their Three.js landscape behind cards and foundations, with shared Paint/Pixel scenery outside card hit testing. Ponds retain their separate fishing presentation.
- Berry tableau framing (Eric, 2026-10-13): frame the card rack with closer, layered berry-bush cutouts and an exposed scenery band above the cards. Ease the background readability wash in that band so the biome is recognizable while keeping ranks and controls clear. Reuse Paint/Pixel artwork, retain portrait card sizing and foundation limits, and keep scenery outside hit testing; this is presentation only.

## Actor close-up (Eric, 2026-10-12)

- Vertical camera tilt input is inverted for both middle-mouse drag and three-finger vertical touch motion: dragging up increases tilt from overhead, dragging down decreases it. Keep horizontal turning unchanged.

- Actor close-up (photo framing) starts automatically when an actor is available, anchored to the selected actor (or traveling/first actor when none is selected). It starts at 3× and permits 1–6× magnification by slider, wheel and pinch. Keep actor world-body scale fixed at entry; magnify the shared scene, retain live scenery occlusion and lighting, and orbit with existing turn/twist controls. Elevation starts at the entry angle and can be changed by manual tilt. Translation remains anchored during movement and selection changes; this is not a free camera. Escape restores the previous framing and view; Reset View exits to the default camera. After dismissal, normal zoom/pan remains available without automatically reopening close-up. There is no photo/close-up button in the camera controls. Mouse, touch and keyboard input remain supported. While close-up is active, actor clicks and grabs remain available from their body and whole occupied square, including at game start and through foreground scenery; holding an actor locks camera gestures. Other scene grabs and tile actions are suspended so remaining gestures belong to the camera; other game panels continue to work. This supersedes the earlier toolbar toggle and actor-grab suspension.

- Middle-mouse orbit: horizontal movement turns the camera; vertical movement adjusts tilt from 0° (overhead) to 82° (8° above ground). Three-finger touch twist retains turning and vertical three-finger motion supplies the same tilt. Manual tilt remains stable while zooming and uses the shared scenery, actor, lighting and pointer projection. A vertical orbit from tabletop enters immersion; Reset View restores the default zoom-driven tilt. Existing left/right pan, wheel/pinch zoom and keyboard controls remain available.

## Travel controls (Eric, 2026-10-11)

- Travel starts immediately at the manual slider value, with live changes throughout the trip. Remove the temporary enforced 5% opening and one-second ramp now that immersion is selected manually (Eric, 2026-10-12).

- Put a Travel speed slider at the top of the table, ranging from 5% to 500%, defaulting to 100%. The former travel pace is equivalent to 300%; 100% takes three times as long on the same route. Changes apply during travel without restarting it, retaining terrain weighting and discovery.
- Follow traveling actor is enabled by default. When enabled, travel enters immersion and smoothly zooms to 300%, turns behind the actor's movement heading and follows the moving actor. Manual camera input takes control for the remainder of that trip. Turning follow off stops camera tracking; arrival retains immersion and existing encounter framing. Reduced motion removes camera easing. This supersedes the earlier tabletop-only travel presentation.
- Travel rendering (Eric, 2026-10-12): actor position, heading, walking distance and automatic camera follow use one live frame clock. Keep scene/lighting snapshots separate from that clock; delayed React snapshots must not rewind the camera or actor. Reuse GPU geometry and lighting uniforms, prepare known scenery before immersion, and bound ground-light projection to the viewport. Keep CPU rendering and context-loss fallbacks. Travel speed follows the manual slider immediately.

## Tile map update (Eric, 2026-10-11)

- Dirt tiles have no tableau deal, tableau inspection field or open-tableau action. Arrival at any dirt tile leaves the actor on the map without staffing a foundation or opening a tableau, including (0,1) and (-2,1). A future explicit flag may enable an encounter; that flag is not implemented (Eric, 2026-10-13).

- Place dirt at (-2,1), impassable mountains at (-2,2), and the Dark Woods combat sandbox tile at (-3,1). Retain dirt at (0,1) and the other ordinary-day places. This supersedes the Dark Woods placement at (-2,2); preserve its existing combat sandbox behavior and discovery rules.

## Food collection (Eric, 2026-10-11)

- Exactly 20% of Berry Patch cards yield a resource: the finite ten-card deal contains two mana-bearing cards and eight cards without resource rewards. Picking cards still advances exploration; cleared cards stay picked.
- Collected foodstuffs convert one-for-one to **mana**, including berries, edible herbs and pond catches. Berries are no longer a distinct tracked resource. Use mana in carried supplies, resource stacks, counters, recipes and supper. Authored food source names and scenery can still describe berries or fish. This supersedes earlier species-specific food inventory/rewards.
- Supper consumes two mana once at home and retains its Well Fed and bedtime behavior.
- Berry collection presentation (Eric, 2026-10-11): resource-bearing Berry Patch cards show berries in the tableau and during delivery. On arrival at the player's foundation, convert their presentation to mana: the berry lands at a random point inside the actor's card, bursts into sparkles and triggers a holographic shimmer expanding from that same point. The foundation and inventory retain mana only. Effects never gate gameplay; reduced motion uses a brief static glow.

## Resource terminology (Eric, 2026-10-11)

- **Inspiration** is the resource spent to redraw a foundation's active value. Use Inspiration throughout Proto state, rules, UI, recovery/rewards, playtest controls and validation; compact counters may use **INSP**. This supersedes the former Stamina terminology without changing costs, caps, recovery or temporary consumption overrides.
- **Stamina** is reserved for a different future mechanic. Do not reuse it for foundation redraws or implement that future mechanic as part of this rename. The existing reserve and per-foundation Inspiration pools remain separate during this taxonomy refactor; travel still costs none.

## Ordinary Day 1 opening (Eric, 2026-10-09)

- Ordinary Day quest counters (Eric, 2026-10-13): show carried mana on the quest card; omit the Inspiration/INSP counter in every card view.
- Begin Hero awake in her den with full travel and foundation inspiration. No tableau is selected and Zzz does not open at startup or on returning home. This supersedes the zero-inspiration opening and initial Rest objective.
- Keep the den and its five neighbouring mountains; add a nearby Berry Patch at (-1,1) and an optional Old Tree at (1,0). This supersedes the six-cell-only setup. Both places use short, reliable food solitaire deals; picked cards remain gone. Add the optional Dark Woods combat tile at (-2,2) (Eric, 2026-10-11), using its existing danger, discovery and combat behavior. This supersedes the prior no-combat Day 1 rule; no larger adventure is introduced.
- Do not spawn the Ordinary Day quest card at game start or restart (Eric, 2026-10-14). Keep the Day 1 gameplay state and existing card implementation; this supersedes the automatic portrait quest card drop onto the physical table. Keep the detached quest/resource trays detached.
- Two gathered mana supply supper at home, consumed exactly once and applying Well Fed. Surplus remains available. Supper unlocks an explicit Curl up action at the den to open the existing finite Zzz game. Finish resting closes the day without requiring a perfect deal; earned recovery persists.
- Morning, afternoon, dusk and night follow progress rather than a real-time deadline. The manual lighting tools remain available. Hero is awake at home until choosing bedtime. The global inspiration-consumption testing override remains temporary scaffolding; starting inspiration is nevertheless full.
- Day 1 establishes a quiet daily routine; the later Hero's Journey is not implemented by this opening.

This document records agreed project preferences and behavior from the Proto development conversations. It guides implementation and review; it does not replace the user's latest instructions or establish requirements for unrequested features.

## Scope and workflow

- Effort estimates (Eric, 2026-10-13): default to the agent's expected elapsed delivery time in this workspace, including implementation and appropriate validation. Use a realistic range grounded in inspected code, available tooling and comparable completed work; state the main assumptions and uncertainty rather than implying a guaranteed deadline. Label human developer effort explicitly when requested or useful, keeping it separate from agent elapsed time. Identify external waits or blockers separately and revise the estimate when new evidence materially changes scope or difficulty. Never reduce authorized scope or validation to meet an estimate.

- [Modular sprite and art workflow — art/presentation contract](./ART.md#contract-046).

- [Sprite requests — art/presentation contract](./ART.md#contract-047).

- [Sprite artwork workflow — art/presentation contract](./ART.md#contract-048).

- Target Proto unless the user requests another variant or broader scope.
- Build reusable components and shared behavior where multiple game objects need the same functionality. Avoid accumulating object-specific fixes for common problems.
- Preserve unrelated changes in the shared workspace.
- Treat obvious visual defects as implementation defects: overlapping labels, distorted cards, escaping text, clipped controls, and improperly rendered stacks should be caught during development rather than delegated to the user to discover.

## Presentation

- [Natural border balance — art/presentation contract](./ART.md#contract-049).

- [Intermingled tile borders — art/presentation contract](./ART.md#contract-050).

- [Woods height proportions — art/presentation contract](./ART.md#contract-051).

- [Woods and mountain heights — art/presentation contract](./ART.md#contract-052).

- [World scenery height — art/presentation contract](./ART.md#contract-053).

- [Ground and edge spill brushwork — art/presentation contract](./ART.md#contract-054).

- [Painted den interiors — art/presentation contract](./ART.md#contract-055).

- [Den painted orbit views — art/presentation contract](./ART.md#contract-056).

- [Den and impassable mountain brushwork — art/presentation contract](./ART.md#contract-057).

- [Den occlusion exception — art/presentation contract](./ART.md#contract-058).

- [Den visual correction — art/presentation contract](./ART.md#contract-059).

- [Den orbit correction — art/presentation contract](./ART.md#contract-060).

- [Physical table cards — art/presentation contract](./ART.md#contract-061).

- [Fixed immersive reliefs — art/presentation contract](./ART.md#contract-062).

- [Berry brushwork correction — art/presentation contract](./ART.md#contract-063).

- [Painted den and berry patch — art/presentation contract](./ART.md#contract-064).

- [Painted trees/woods — art/presentation contract](./ART.md#contract-065).

- [Immersive actor peek-through — art/presentation contract](./ART.md#contract-066).

- [Paint asset audit — art/presentation contract](./ART.md#contract-067).

- [Game art selection — art/presentation contract](./ART.md#contract-068).

- [The approved reference is `output/imagegen/hero-watercolor-v7-rich-loose-preview.png` — art/presentation contract](./ART.md#contract-069).

- [Hero holocard — art/presentation contract](./ART.md#contract-070).

- [Hero walking — art/presentation contract](./ART.md#contract-071).

- [Hero OTT proportions — art/presentation contract](./ART.md#contract-072).

- [Dirt tile — art/presentation contract](./ART.md#contract-073).

- [Berry Patch ground — art/presentation contract](./ART.md#contract-074).

- [Den ground — art/presentation contract](./ART.md#contract-075).

- [Den and berry scenery — art/presentation contract](./ART.md#contract-076).

- [Opaque voxel reliefs — art/presentation contract](./ART.md#contract-077).

- [Den actor artwork — art/presentation contract](./ART.md#contract-078).

- [Mochi artwork — art/presentation contract](./ART.md#contract-079).

- [Hero sitting and expression — art/presentation contract](./ART.md#contract-080).

- [Ordinary day artwork — art/presentation contract](./ART.md#contract-081).

- [Hero at home — art/presentation contract](./ART.md#contract-082).

- [Berry Patch — art/presentation contract](./ART.md#contract-083).

- [Hero's Den orientation — art/presentation contract](./ART.md#contract-084).

- [Voxel tile scenery — art/presentation contract](./ART.md#contract-085).

- [Pixel-to-voxel materials — art/presentation contract](./ART.md#contract-086).

- [Default day quest size — art/presentation contract](./ART.md#contract-087).

- [Immersion actor shrink scaling — art/presentation contract](./ART.md#contract-088).

- [Scenery depth — art/presentation contract](./ART.md#contract-089).

- [Global actor orientation — art/presentation contract](./ART.md#contract-090).

- [Use a dark board-game aesthetic with pixel typography, strong borders, high contrast, and consist... — art/presentation contract](./ART.md#contract-091).

- [Exploration foundations omit the separate Energy / Next / Turn / Mobility summary strip; use its ... — art/presentation contract](./ART.md#contract-092).

- [Cleared tableau columns retain their layout space without a dashed placeholder. — art/presentation contract](./ART.md#contract-093).

## Interaction

- OTT camera controls (Eric, 2026-10-12): restore mouse pan, wheel zoom, touch pan/pinch, horizontal middle-drag/three-finger turning, Q/E turning, WASD movement, True Center and Reset View in OTT. Lock the camera to a 2D top-down view: vertical orbit input does not change tilt or enter immersion. Keep explicit O/camera-mode switching and normal actor, card and tile interactions. This supersedes the earlier OTT input lock and vertical-orbit entry behavior.

- Card jumbo views (Eric, 2026-10-10; tableau exception 2026-10-11): clicking/tapping a card or activating it with Enter opens its readable, centered jumbo variant, except for tableau cards. Tableau cards never open jumbo: activation plays them directly onto the single valid foundation with the existing flight, or highlights valid foundations when multiple choices exist. Buried and otherwise unavailable tableau cards remain disabled; preserve tableau drags and drag-to-play. Other cards retain their authored portrait proportions and complete visible information, with Escape/backdrop/close dismissal, background input blocked and focus returned. Other playable cards offer an explicit gameplay action in jumbo. Preserve uninterrupted reward holds, without opening jumbo after a drag or completed hold. Hidden card backs enlarge without exposing their face. This supersedes the all-cards jumbo rule for tableau cards and retains jumbo for other cards.

- Persistent immersion (Eric, 2026-10-10): never automatically revert immersion to tabletop when actors leave foundations, an encounter ends, travel starts, or the day finishes. Only the player's O or camera-mode button returns to tabletop. Newly staffed encounters may still enter immersion automatically; encounter focus can still restore its previous pan and zoom on exit.

- O toggles immersion; Space toggles global pause under the global pause/shortcut rule above. Enter remains the keyboard action key. Danger particles appear only in immersion.

- Suppress the browser context menu throughout the Proto document. Development builds provide a custom context menu for future object inspection/actions; production builds suppress the native menu without exposing developer tools. The initial `dev` entry is a disabled placeholder. Dismiss on outside interaction or Escape and keep the menu inside the viewport.

- Dragging table objects, including cards and tokens, must not pan, zoom, or otherwise affect the camera.
- Held objects take priority above all table scenery, labels, pieces and floating inspection cards. Render their complete readable face outside the camera's depth and clipping layers during mouse and touch pickup; restore normal table layering on release or cancellation.
- Picked-up table cards face the camera directly while held or moved, cancelling the table's tilt and camera spin. Releasing or cancelling the pickup restores their alignment with the table plane and their placed angle.
- Quest card rotation (Eric, updated 2026-10-12): resting quest cards keep their placed world heading fixed to the table throughout camera orbit. Pressing/holding lifts and turns the face toward the camera for reading; release resets the heading toward the player's current camera direction with a fresh random tilt within ±4°. Cancellation restores the previous table heading. Click/tap inspection retains the shared upright jumbo reader. This supersedes camera-following rotation for resting table quest cards.
- Distinguish clicks from drags. An actor click opens details; a completed drag must not open the viewer.
- Provide keyboard activation and visible focus for interactive objects where appropriate. Dialogs support dismissal and restore focus.
- Every user input is built for both touch and mouse. Drags, holds, taps and clicks use pointer events (or equivalent handling for each input type), work with a finger on a phone as well as a mouse on desktop, and set `touch-action` so a touch gesture on a game object does not scroll or zoom the page. Automated checks exercise touch as well as mouse for each new interaction.
- The square under the pointer decides what a press takes. A press anywhere on a square an actor stands on picks up the actor and never pans the camera, even where scenery or a piece standing in front covers that square in the tilted view. Pieces get an invisible grab area over their whole square for this; `tools/cell-grab-playwright.cjs` checks it by mouse and touch.
- Camera gestures (Eric, 2026-10-09): biome ground and scenery, including discovered impassable mountains, support the same mouse pan/spin/wheel and touch pan/pinch/twist gestures as empty table in both camera views. Stationary clicks and taps retain tile actions; completed camera drags never activate a tile. Actor and movable-piece grabs retain priority.
- Holo-card device tilt (Eric, 2026-10-09): visible compact and jumbo inspection cards respond to device orientation through the same bounded spring tilt, depth, shadow and foil as pointer input. Calibrate relative to the opening pose and remap portrait/landscape axes. Pointer interaction takes priority until leave/release; device tilt resumes afterwards. Request browser sensor access from the opening gesture where required, keep pointer fallback when unavailable or denied, suspend sensor response while hidden, and respect reduced motion. Tableau foundation cards never tilt or lift in response to mouseover, touch or gyro input; retain their authored table/camera alignment and static foil finish.
- Holo-card tilt strength (Eric, 2026-10-09): cap shared pointer, touch and device tilt at 4° pitch and 4° yaw, matching the gentle reference pose so inspection buttons remain easy to click. Preserve calibration, foil coordinates, spring timing and reduced-motion behavior. This supersedes the earlier triple-strength tilt.

## Crafting and actor progression

- The table is a clear 15x15-cell square around True Center. Every cell outside it is impassable terrain, drawn for now as black placeholder tiles; a world map will theme them by biome, and golf will open some of them up. Actors, quest cards and placements never land on terrain. Table-level lights (lamps, carried candles) never reach terrain or pass through it; terrain takes only sun, moon and sky light (`worldBounds.ts`, `tableLightReaches`).
- Leave Tableau returns each actor from its foundation to the map at its existing world position on the same tile, without moving it to an adjacent cell (Eric, 2026-10-12).
- Returning expedition actors deposit collected resources into the settlement supply tray, with visible token flights into labeled counters, instead of spilling loose resource stacks onto the table.
- Stored supplies and table ingredients must not be spendable twice. Drawing supplies debits storage and creates a deliberate crafting stack. Camp construction consumes deposited supplies; pending expedition haul is not settlement stock.
- Craft by stacking eligible resource tokens and advancing a build timer. Do not introduce a workbench.
- Keep crafting composable and recipe-driven: declare ingredient eligibility, quantities, output, build time, and applicable staffing, inspiration, or solitaire requirements.
- Recipes can require solitaire work alongside timed progress. Appropriate buildings can require an actor stationed within their foundation and actor inspiration to perform that work.
- Support low-tier food combinations into rations, consumption by actors, and a Well Fed effect supporting recovery and exploration.
- A provisions hut can use the same ingredient sourcing to produce enhanced outputs through actor staffing and solitaire effort.

## Biome flags and exploration

- Grassland ground cover and grass tufts are removed for now (Eric, 2026-10-07) to reduce immersive rendering cost. Open cells show the table grid; open-ground movement and dedicated biome scenery remain in place. This is a temporary presentation simplification.

- A biome tile carries `flags`; `biomeFlags.ts` is the one place that says what each does to travel and to opening its tableau, and a new flag is one entry. `unexplored`: conceals the biome and keeps its tableau closed; clicks, taps, keyboard activation and hovering show no popup or tooltip (Eric, 2026-10-09). Actor entry removes this flag on paths/roads; other terrain retains proximity discovery. Unknown paths/roads remain crossable; unknown woods cannot be crossed until discovered but can be approached as a destination. `rough`: crossable at three times the cost per cell (Small Woods, once discovered). `danger`: a foe is about (the Dark Woods), so no passing through; going there starts the fight, and beaten for the day the tile drops the flag. A discovered biome with no travel flags is crossed at normal cost.
- Every biome starts unexplored. Layout: the pond at (-1,-1), Small Woods at (0,-1), a second Small Woods (`woods-east`, its own deal; the quests still point at the first) at (1,-1), the Dark Woods at (-2,1); the Hero starts in her den at (0,2).
- Expedition work retains its tableau progress (`biomeExploration`, 0-1) separately from map discovery. Completing a deal advances work and rewards; it is never required to identify terrain. Ponds keep their fishing rules and the Dark Woods their combat completion rules.
- Unknown biomes have no visible name, overhead terrain sprite, immersive pop-up, edge scenery, shadow, danger effect or terrain hint. Discovered biomes show their entire name and full-colour art in both views, with immersive lighting still applied. Solitaire completion no longer masks map art. Cached silhouette relief remains a presentation material for other shared reveal surfaces, including tableau cards.
- Tableau cards that aren't in the front row (not playable) wear the same silhouette: a veil over the card body and its resource, with the rank above it, dimmed but readable (buried ranks matter for planning), and they take no input and never lift on hover. When a card reaches the front, colour sweeps back in behind the same slanted edge. `tools/tableau-silhouette-playwright.cjs` checks it.
- A front-row tableau card shows its value large in the middle of the face (`ProtoCard` `centerRank`, at least 24px), with its resource icon kept in the top corner; buried cards keep the small corner value for the peek row. This applies in the exploration, combat and battle tableaus. `tools/tableau-immersion-playwright.cjs` checks it.

- Unknown squares (Eric, 2026-10-08): every uncovered square of the 15×15 table defaults to `unexplored`. Before actor discovery, all tiles render the same neutral ground with the shared grayscale silhouette filter, without terrain sprites, scenery, shadows, danger effects or terrain hints. Paths and roads remain concealed until an actor enters their own square; proximity alone reveals neither their names nor road prints, including the squares beside Hero's starting den. Crossing or occupying a path square opens its exploration tableau; arrival permits foundation work. Roads and default paths retain their resource-free 13-card deals and completion rewards independently of terrain discovery.

- Unexplored tile ground (Eric, 2026-10-08): darken every unvisited tile with the shared silhouette filter followed by full grayscale and 45% brightness, in both tabletop and immersion. Omit unexplored name labels; keep interaction cues readable above the darkened ground.

- Road tiles (Eric, 2026-10-08): reusable straight, four-way, curved and three-way fork prints support quarter-turn rotation. Initial roads: straight north/south at (0,0), straight east/west at (1,1), crossroads at (0,1). Roads use biome silhouette/reveal and immersive lighting, are always crossable, and use the path exploration tableau and completion rules above (including the occupied initial Hero square).

## Hero's Den rest tableau

- Hero's Den opens as the selected tableau at game start, with one foundation staffed by Hero and zero starting inspiration. Rest plays cost neither inspiration nor exploration energy and grant no foraging/work/cache rewards.
- Rest deal (Eric, 2026-10-09): replace the den's infinifill with Pocket Card Jockey style finite golf solitaire: six columns of five face-up, overlapping full cards, plus 22 face-down stock cards. Deal a shuffled standard 52-card rank distribution (four of each A–K). Buried ranks remain readable; only each column's exposed bottom card can be taken. Empty columns retain their space without backfill.
- Den receiving card (Eric, 2026-10-09): reveal the first of the 22 stock cards at startup, leaving 21 draws. The face-up stock card receives tableau cards; Hero's actor foundation has no default rank or rank bubble in this mode. Every tableau play, including the first, must be one rank above or below the receiving card, with A↔K wrapping and suits/colors irrelevant. A stock draw spends exactly one card to replace the receiving rank without collecting a sleep reward. Draw at any time; no stock recycling or bonus wildcards. Keep the receiving card and its rank visible after stock reaches zero, continue legal plays, and finish when all tableau cards are cleared or no legal plays and no stock remain.
- All tableau cards carry `Zzz` (💤); taking one restores +1 inspiration up to the existing cap. This reward/cap is temporary playtest tuning, not a valuation of a day's inspiration needs. Earned inspiration persists even if the tableau cannot be cleared. Recovery works while the temporary inspiration-consumption override is enabled. Show stock remaining, tableau cards remaining, inspiration and a clear finished/perfect state.
- Rest has no countdown timer, sleep disruptions, wake meter, lock or automatic redeal. Timers are reserved for pressure scenarios such as combat and fires. Start with 22 stock and playtest; no Monte Carlo balance target is defined yet.
- Future idea, not current gameplay: daytime injuries and unsuitable work may eventually interrupt an authored, reliable sleep deal. Do not add those interruptions in this iteration or assume an optimal-deal recovery target.
- **Infinifill** remains the term for a random deal whose taken front-row card immediately receives a random replacement and therefore never runs out. Hero's Den no longer uses this behavior.

## Pond and fishing

- Every pond biome becomes fully explored on its first visit by any actor, regardless of catches. Selecting a visited pond uses the Go Fish hook and fishing fight instead of a tableau; recognize ponds by water biome type rather than a specific tile ID.

- The pond is the first water biome: a 1x1 water tile with pixel-art cattails as its pop-up scenery (`public/assets/deprecated/pixel/environment/pond_reeds.png`, drawn by `tools/make-reeds-sprite.py`), at (-1,-1), beside Small Woods on the row above True Center. It has no tableau; with the pond selected, the tableau field shows the pond panel (`PondField`).
- Fishing has two phases: a Go Fish hook (luck) and a fight (skill). Each fishing event, from cast to the catch landing in the tray, stays under ten seconds.
- The hook (`rules/fishing.ts`): the pond hides six fish (the water) with four more in the school below; the angler holds four bait cards from a tin of sixteen. The fish keep the card motif: they lie face down in the water as cards (the established 56:74 tableau card shape), each back showing a ripple sized to its band and the band itself (A–4, 5–9, 10–K). Casting is drag and drop: drag a bait card (mouse or touch) into the pond, which lights up as the drop target; a tap or click on bait only explains how to cast; keyboard players press Enter on a bait card, then Enter on the pond. A matching fish bites and is hooked (one fish per cast) and the fight begins with the bait tethered by a fishing line. No match ("Go fish!") loses the bait and costs 1 inspiration, and fish one rank away (golf adjacency, A and K wrap) nibble and flip face up. Casting needs that inspiration. Every cast spends its bait and draws a fresh one; missed bait ranks dim until the water changes. The line holds ten casts a day, fewer than the tin holds bait; the opening hand always holds two bites; the pond restocks each new day. Fishing needs an actor stationed at the pond.
- The fight (`rules/fishFight.ts`, `FishFight`) is a Stardew-style fishing meter played with cards. The meter has nine notches; the hooked fish swims between them and the catch zone must stay on it. The cast bait is the line card. Playing a reel card one rank above the line card (+1, marked ▲) lifts the zone a notch; one rank below (−1, ▼) drops it; others do nothing; A and K wrap. The played card becomes the line card, so the + and − cards change with every play. Reel cards play on press (pointer down, touch or mouse), on Enter, or with the arrow keys.
- The fish is smart about the hand: on each beat it turns to a notch that a card in the player's hand answers, measured from where the zone is (one notch, or two in a dash when the hand holds a two-card run that way). Fish and zone glide at the same speed, so a perfect player, or an auto-solve ability or item playing the answering card at once (`solveFight`), keeps the fish dead centre and lands it in the time the catch bar takes to fill (about four seconds). The skill is reading the hand quickly, never counting cards. The hand holds four cards drawn near the line card, always at least one playable, and a fresh card usually fills a missing direction.
- The zone adapts to the player: each beat the fish stayed inside it tightens the zone a little; each beat it slipped out widens it, within each fish's limits (always under two notches, so a fish one notch off is out). Bigger fish turn sooner, glide faster, dash more and start with a tighter zone. In the zone the catch bar fills; out of it, it drains. Empty, or eight seconds on the line, loses the fish, which stays in the water face up. Unit tests simulate players with different reaction times to hold the balance: the auto-solve never lets the fish out, quick readers land everything, typical players land every fish below a king and over half of Kingfish, slow readers handle the small fish, an idle angler rarely lands one.
- Each rank is its own species, smallest to largest (`rules/pondSpecies.ts`): A Minnow, 2 Shiner, 3 Bluegill, 4 Perch, 5 Crappie, 6 Trout, 7 Bass, 8 Walleye, 9 Carp, 10 Pike, J Catfish, Q Sturgeon, K Kingfish. Eating one restores inspiration to the party and the actor by size: A–4 +1 (these count toward rations), 5–9 +2, 10–Q +3; the Kingfish is a feast that restores both in full. Species share the fish glyph for now (the Kingfish has its own); catch pills name the rank and the supplies show the name on tap.
- A landed fish is rewarded at once, as its species: it flies from the meter into the catch tray, which sits beneath the cards in the same pill style as a foundation's collected resources and counts it when it lands (`pondCatchFlight.ts`; reduced-motion users skip the flight). Rarer offerings come from luck rolls on landed fish, not from ranks: for now, one landed fish in five also brings up a glowfish. Caught fish join the haul and reach the supplies when the actor leaves; pond catches only appear in the supplies tray once there are some.
- A glowfish lying on the table lights its spot to "dim" with a cool cyan light and no lamp token. Eating a glowfish (drag it onto the actor) gives +2 max inspiration, restores 3 inspiration, and raises the actor's carried light to 0.6 in the same cyan, enough to light their surroundings; the glow ends when the day ends. `tools/pond-fishing-playwright.cjs` checks mouse, touch and keyboard casting and fighting, that the fish turns where the hand can follow, event length, species, the luck roll, the glowfish light, eating and the pond and fight layouts.

## Dark Woods and combat

- Battle actors have a world-space orientation separate from the camera billboard. By default each actor faces the opposing team's live centre; scene authors can override this with a target actor, a world point or a fixed heading (for example an ambush). Camera orbits must preserve the face-to-face relationship. Authored front, quarter, side, rear-quarter and rear views select by the camera's angle relative to the world heading, with mirrored quarter/side art and hysteresis at view boundaries. Elevated views support Overview and free orbit; true overhead art lies on a world-aligned footprint pointing along the actor's heading.
- Sprite rigs use reusable directional atlases with explicitly authored source rectangles, anatomical regions and configurable pivots. Hero's head, torso/front legs and hind-legs/tail share one coherent silhouette and pixel scale per view; the original separately generated sections distorted the proportions and are retained only as unused source material. `quadrupedSprite.ts` builds the same rig for dogs, cats and other quadrupeds from actor-specific neck/hip seams, pivots and motion profiles. Definitions can provide five views with mirroring or eight independently drawn views at each elevation, plus overhead. Authored convex atlas boundaries can exclude neighboring art from irregular crops. Authored UV geometry defines the regions without runtime image segmentation. Neck and hip joints attach to the torso at anatomical pivots, and coordinated idle/action motion preserves proportions with uniform scaling. Normal sprites use opaque alpha-tested cutouts to avoid blending fur twice at seams; faded echoes use transparency. Instances of each actor share textures and geometry while retaining independent joints. Reduced motion restores the original drawn proportions. This modular sprite contract is reusable; the ten-second battle scene remains temporary scaffolding.

- The Dark Woods are the first dangerous biome: a 1x1 woods tile at (-2,2) (`DANGER_WOODS_TILE`, relocated 2026-10-11), its pines darkened and reddened, giving off dark red versions of the woods' particles (embers in place of fireflies, a blood-red mist behind the tile). In immersion they show at every hour as a warning; top-down uses the printed danger marker. Moving an actor there starts a fight instead of a tableau, the way Small Woods starts deterministic golf exploration. Like every biome they start unexplored ("???", silhouette props, the embers still showing as a warning) and carry the `danger` flag; their effects are `BIOME_AMBIANCE.danger`.
- Combat is a real-time skirmish played as golf (`rules/skirmish.ts`, `CombatField`). The hero and the foe share seven face-up columns and each keeps a foundation; either takes a column's top card one rank from its own card (A and K wrap). Every card the hero plays strikes for 1. Stuck, the hero draws from an endless stock. Emptied columns are dealt fresh cards.
- The foe plays on its own clock: each beat it eyes a card it can take, marked with a paw and a draining bar, and takes it when the bar runs out. Each take builds fury; the take that fills fury (3) is a pounce, telegraphed longer, that hits the hero for 3. A hero who plays the eyed card first snaps it from its jaws: 3 damage, the foe staggers and loses a point of fury. The skill is reacting in the moment, never counting. With nothing to take, the foe prowls to the next stock card.
- Cards play by drag onto the hero's foundation or by a tap or click in place (mouse and touch), Enter from the keyboard, keys 1–7 for a column and Enter on the Draw button to draw. The first foe is the Shadow Wolf (12 HP); the hero fights with their own HP. Winning adds 2 wood, 2 berries and 2 herbs to the haul and quiets the woods until the next day; losing leaves the hero on 1 HP; fleeing keeps the wounds. Unit tests simulate heroes with different reaction times: quick readers always win, typical ones win about nine in ten in under half a minute, slow ones about half, an idle hero never. `tools/combat-skirmish-playwright.cjs` checks immersive embers and the flat printed warning, tap, mouse-drag and touch-drag play, a won fight, the quiet woods and the panel layout at desktop sizes.
- The older ambush combat (the Deep Woods' Shadow Wolf cub encounter inside a tableau) is unchanged for now.

### Battle abilities and stagger (Dark Woods battle field)

- Combat ability tray costs (Eric, 2026-10-13): show each selected ability's AP cost against the right margin of its row, with the title on the left. Vice Grip shows its minimum as 3+ AP; retain the separate commitment control on its Ability Card. This supersedes title-only tray rows.

- Ability card drop surface (Eric, 2026-10-13): use the dragged Ability Card's full visible rectangle for target overlap, for both highlighting and release, with mouse and touch. The pointer need not enter the target. If multiple valid foundations overlap, choose the greatest overlap; invalid drops keep the ability primed.

- Floating marker polish (Eric, 2026-10-13): health/marker rows use rounded corners, dark borders, a restrained meter gradient and padded readable text. Keep the world anchor attached to the actor, but face the actual camera plane so bars retain parallel edges and a stable rectangular aspect ratio at close range, off-axis positions and steep orbit angles. This supersedes inheriting the sprite plane's tilt for the bar face; movement, bounded perspective scale, modular rows and presentation-only behavior remain intact.

- maxAP debug control (Eric, 2026-10-13, temporary dev/test scaffolding): put a **maxAP** checkbox beside the scenario picker, off by default. Enabling it makes every living player's selected abilities available without tableau plays and bypasses AP spending for direct attacks and traps. Show unlimited AP in the actor UI, retain finite banked AP internally, and restore normal availability/costs when disabled. Keep Vice Grip's AP commitment configurable and finite for duration calculations. Preserve the checkbox through restart/scenario/roster changes. This bypasses AP only: targeting, four-ability loadouts, defeated actors, pause, completed fights, tableau legality and Inspiration costs retain their rules.

- Floating actor markers (Eric, 2026-10-13): every combat-scene actor has a reusable floating status object, initially displaying live HP. Attach it to the actor's stable body/billboard anchor so it follows movement, lunges, knockback and camera angle without idle head jitter or mirrored text/fill. Preserve perspective with bounded readable scale, keep status legible above scenery, retain 0 HP on down party actors, and remove enemy markers with their evaporated sprites. The data/object supports ordered meter and label rows for future AP, debuffs and other markers; those additional indicators are extension slots, not new gameplay. Keep it presentation-only and decoupled from targeting/input. Update marker artwork only when content changes; reuse geometry and the existing arena frame clock.

- Combat scope guardrail (Eric, 2026-10-13): each actor has at most **four selected combat abilities**. Use a reusable, fixed-height **Ability Tray** with exactly four equal title-only rows; populate selected abilities first, then draw inert empty rectangles for unfilled slots (Mochi currently has one). AP, redraw and release controls remain outside the four ability slots. Match the actor foundation border's height and vertical alignment to the tray, preserving the actor artwork's portrait proportions. No ability-selection editor is introduced by this scaffolding. Keep combat-scene interactivity decoupled from foundation/Ability Card targeting; do not build scene target picking or cross-pane drops as part of speculative feel experiments.

- Ability revision (Eric, 2026-10-13): Takedown retains 3 AP/3 damage, stuns for **2 seconds**, and interrupts the current enemy attack/forage tell (reset attack progress, cancel eyed card). Vice Grip retains its sustained hold and AP/card investment, but only its first 6 seconds receive full duration credit; each further 3 seconds of raw investment contributes half the previous block (1.5s, .75s, .375s...), approaching 9 seconds total per hold. A 3-AP hold therefore lasts 7.5s; a new card extends its raw budget by 3 rather than bypassing diminishing returns.
- Bite revision (Eric, 2026-10-13): 3 AP, **2 damage**, **25% chance** to inflict existing Bleeding (1/s for 4s), and guaranteed bleed susceptibility. Recommended name **Exposed** and initial tuning duration **6 seconds**: subsequent direct attacks from any source gain +10 percentage points of bleed chance (Nip/Scratch 10%, another Bite 35%). The initiating Bite rolls at 25%, before applying Exposed. Susceptibility does not ramp per hit; only Bite refreshes its duration, without stacking. DoT ticks never roll. Seeded effect RNG is separate from card deals; previews do not consume it. These explicit probabilities supersede the former blanket 100% testing default for Bite/Exposed procs; other authored debuffs retain their existing guaranteed application.
- Ability Card UX (Eric, 2026-10-13): each ability has a fixed-height title-only row. Clicking/keyboard activation primes it, highlights valid foundations, and spawns a reusable portrait **Ability Card**, using the parent actor's art and shared trading-card aesthetics until dedicated ability art exists. Its cost and rules appear on that card. The primed card can be dragged to an enemy foundation with mouse/touch; existing click/keyboard targeting remains available. Invalid drops retain the primed ability, Escape/close cancels it, and AP is spent only on a successful target. Scene targeting is a proposed follow-up, not implemented by these foundation controls.

- Banked combat AP (Eric, 2026-10-13): each foundation play banks 1 AP with no ten-point cap. Attacks spend only their chosen cost, retain leftover AP and foundation cards/rank, and can be used in any order against any living target. Enemy hits no longer erase banked AP. Hungry-card snatches retain their +1 bonus AP. Hero has a vertical ability list: **Nip (1 AP)** deals 1 damage, +1 against bleeding; **Bite (3 AP)** deals 3 and inflicts bleeding; **Takedown (3 AP)** deals 3 and stuns for 5 seconds; **Vice Grip (3 AP minimum)** is a sustained hold, dealing 1 on contact and stunning for 3 seconds per AP committed. The player chooses committed AP, retaining the rest. Each additional card played to Hero extends her current hold by 3 seconds and still earns AP. Hero maintains one hold; another Hero ability or trap, an explicit release, her defeat, or the target's defeat ends it. Mochi also uses a vertical list with her existing attack values at their former thresholds: Scratch (1 AP), Claw (4 AP), Lacerate (7 AP); each spends that cost and retains surplus. Stun/hold stop attack and forage clocks, without granting stagger vulnerability. This supersedes the automatic Hero upgrades, full-bank spending, ten-AP bank limit and bank reset on enemy hits below.
- Combat test defaults (2026-10-13, temporary tuning): all debuffs apply with 100% certainty. Bite bleeding uses the existing 1 damage/second for 4 seconds and refreshes without stacking. Vice Grip deals its 1 damage once rather than every second; stun and hold timers refresh without stacking. Sustained holds cannot be planted as traps. Cal retains fire above 3 AP in the available attack bank (the selected commitment for Vice Grip), with the existing damage multiplier and burn. Balance recommendations are proposals, not new standing rules.

- Player's ambush opening (Eric, 2026-10-11): the first Dark Woods battle (Basic) starts with every enemy facing 180 degrees away from the party. Playing cards to build charge does not wake their attack clocks. The first successful player ability attack announces "Enemy ambushed" and begins a visible 10-second "Free next turn" countdown; further card plays and attacks remain available and never restart it. Enemy attack and foraging clocks stay stopped throughout the opening and countdown, while damage effects and stagger still resolve. At expiry enemies turn toward the party and their normal attack timers begin, retaining the existing stagger and staggered-slime rules. Pause freezes the countdown; restarting Basic restores the ambush. Other battle scenarios retain their existing opening.

- Each party actor has one combat ability (`rules/battleAbilities.ts`, data). Every card played onto the actor's foundation adds 1 charge, up to 10. The ability's damage grows faster than the charge (`comboPower`: 1, 2, 3, 5, 7, 9, 11, 14, 17, 20) and its stagger equals the charge times the actor's stagger scale.
- Abilities upgrade in place at charge breakpoints, as data: Hero Nip (1) > Bite (4) > Takedown (7, knockdown: extra stagger and timer knockback); Mochi Scratch (1) > Claw (4) > Lacerate (7, bleed). Hero deals the damage; Mochi does half damage and half again the stagger.
- Spirits accompany actors and layer on top at their own breakpoint. Cal, a fire spirit, joins above combo 3: the ability gains fire (×1.5 damage and a 3 s burn) and the name prefix Inferno (Inferno Bite, Inferno Takedown). Spirits can also carry a `playRule` hook that widens legal play beside golf adjacency (`legalPlay` in `rules/battle.ts`); the shared table is taken through `takeTop`, so sentient foes that take cards (and trapped cards) can use the same path later.
- Cards are never consumed by an attack: an attack spends only the actor's charge, so the foundation's run carries on and the next cards build a fresh charge. (A 1-card Nip can finish a 1 HP slime, then the next 9 plays build a Takedown for the other.)
- The ability card sits beside each foundation, showing its current form, charge, damage (⚔), stagger (✦) and charge pips notched at breakpoints. Drag it onto a slime by mouse or touch, or press it (tap, click, Enter) to arm it and then press a slime; Escape cancels. While held, every living slime previews the result (HP loss, stagger gain, timer knockback, KO, BREAK, ×1.5 and added burn or bleed), the hovered one highlighted. The preview and the drop use the same rule (`previewAttack` runs `applyAttack`).
- Slimes (14 HP) attack on an ATB timer (7 s; later slimes start a little behind so they don't strike together). Each hits the living actor holding the most charge (shown on the timer as → Hero) for 2 and resets that actor's charge, not its cards. Attacks fill a stagger gauge (10, decaying slowly) and knock the timer back. A full gauge staggers the slime for 4 s: its timer stops and it takes ×1.5 damage from every source, burn and bleed included; then the gauge resets. Timers wait for the party's first play.
- Emptied columns refill with 2 cards; Deal a row puts a card on every column below 6 cards. The battle panel's controls add or remove Mochi, add or remove slimes (1-3), toggle Cal on Hero, pause and restart. The 3D arena keeps fallen party actors on the field (down) and lets beaten slimes leave once they have evaporated. This battle grants no world rewards or wounds yet.
- A scenario selector on the battle panel (`rules/battleScenarios.ts`, setup data over the same rules) restarts the fight as one of: **Basic** (Hero and Mochi against two slimes); **Hungry slimes** (`rules.hungry`: each slime keeps its own foundation rank and eats from the shared table golf-style. It eyes a card one rank from its own, marked on the table with an eye and a draining bar, and eats it when the eye runs out. Every card eaten adds 1 to its next hit (up to +3). Playing the eyed card first snatches it for +1 bonus charge. A staggered slime stops foraging, and a slime with nothing to eat turns up a stock card); **Booby traps** (hungry slimes plus `rules.traps`: an ability can be dropped on a table card instead of a slime. The slime that eats that card takes the attack ×1.5 (with its stagger and effects) and the card beneath opens for the party. A trapped card can't be played by the party); **Spirit grove** (three hungry slimes; rule spirits Wisp, on Hero, lets cards two ranks away play, and Moss, on Mochi, lets a matching rank play; Cal adds fire). Roster controls still adjust the current fight; Restart keeps the scenario. Pause, Restart and Deal a row sit with the status line under the tableau.
- Battle animations (Eric, 2026-10-11): every ability play, hit and fall plays an animation in both the 3D arena and on the battle cards. `rules/battleCues.ts` turns battle events into cues (pure, tested); the arena (`combatCueFx.ts`) and the cards (`useBattleFx.ts`, `BattleFx.css`) draw them. Hero's Nip/Bite/Takedown lunges at the target and a pair of fanged jaws snaps shut on it at impact (larger per form; orange with Cal's fire); Mochi's Scratch/Claw/Lacerate lunges and rakes three claw streaks (red for Lacerate). A trap that goes off snaps on the slime that ate it. Slimes hop at their target with a goo splash. Every unit hit flinches: knocked back from the attacker with a red flash (an orange one for burn or bleed ticks). A beaten slime flashes white, then evaporates upward in pixels and leaves the arena; its card dims to Defeated. A party actor at 0 HP stays greyed and down for as long as its HP is 0; Hero uses her authored collapsed sprite, while actors without down artwork tip over like knocked standees. Fight again restores their normal poses. Effects are presentation only: the rules never wait on them, and a missed effect changes nothing. The held states (down, defeated) come from the battle state, so they hold whether or not an effect played. Reduced motion skips motion and particles (states still change at once); the low effects tier (`?fx=low`, or small devices) uses about a third of the particles and no impact light. Hero combat reaction sprites (Eric, 2026-10-11): dedicated transparent directional flinch artwork plays on damage; dedicated grounded down artwork holds at 0 HP and clears on revival/restart. Down takes priority over flinch and replaces Hero's procedural standee tip. Reduced motion retains the authored states. Other actors and battle cards retain their procedural effects. Atlases and generation prompts are retained in `public/assets/deprecated/pixel/characters/battle/hero-{flinch,down}-atlas-v1.png` and `docs/art/hero-combat-reactions.md`. `tools/battle-fx-playwright.cjs` checks the bite, scratch, evaporation, the held down pose, reduced motion and the layout with an actor down at 1912, 1600 and 1280 wide.
- `rules/battle.test.ts` pins the rules and a balance simulation (a steady player at a card a second beats two slimes; a slow one at 1.5 s does not; one who never spends loses). `tools/battle-abilities-playwright.cjs` checks mouse drag with preview, tap-to-arm, keyboard, touch drag, roster controls, each scenario (eyes and feeding, a trap dragged onto an eyed card going off, grove spirits) and the layout at 1912, 1600 and 1280 wide. `rules/battleScenarios.test.ts` pins hungry, trap and grove rules and simulates each scenario: a steady player wins, a slow one (a card every 1.8 s) loses.

## Quest cards

- [Quest aesthetics — art/presentation contract](./ART.md#contract-094).

- Present quests in a physical tray with three identically sized foundation-style quest slots whose outer borders retain the portrait 63:88 playing-card aspect ratio. The slots must never stretch to fill a tall grid track; scale width and height together. Slot 1 holds the current expedition chain as a compact deck of full-size cards; slots 2 and 3 are visibly disabled scaffolding. Queued cards are almost fully occluded, rather than cascading beneath the active card. The compact deck identifies the selected quest; its readable title, objective and reward appear in the tray detail area below (beside the slots on short landscape screens).
- Place the title at the top, instructions beneath it, and rewards at the bottom.
- Clearly distinguish incomplete objectives from completed objectives ready for redemption.
- Completing an objective does not automatically redeem it. Holding a completed active card for one second grants its reward once and reveals the next quest card.
- Record accomplishments so moving away or losing a temporary buff does not revert a completed objective awaiting redemption.
- Completed active quests fly from the tracker onto free table space near their quest location. Hold the landed card for one continuous second to redeem its reward and expose the next tracker card. On redemption, flip and fly the table card to the quest tray discard pile, then remove it from the table. If the tray is stowed, fly toward the approximate off-screen discard location without opening the tray. Redeemed quest data supplies the discard count. The discard pile is a compact card icon with a count in the tray controls row, with the tray toggle aligned at the right. Discard flights target the icon after redemption layout updates, rather than capturing a stale pre-redemption position.
- Each occupied actor foundation provides an exit icon retaining the return/resource-deposit behavior while keeping the actor on the same tile. When multiple actors occupy the selected biome's foundations, an everyone-exit icon sits at the foundation section's lower right and preserves each actor's world position.
- Opening quest (Eric, 2026-10-08): remove the entire original ten-card happy-path queue. Start with one card, **Rest**, with objective "solve enough tableaus for Hero to recover energy for the day" and reward **Energy**, shown with a bolt and no number. Energy rewards will be attached to cards in the den's tableau; until that work defines recovery and completion, Rest remains an incomplete objective rather than borrowing the old Camp/rest condition or a fixed quest reward.

## Established quest component contract

- `QuestField` accepts an ordered `quests` array, optional field `title` and `subtitle`, `onRedeem(questId)`, and optional `onClose`.
- Each quest supplies a stable `id`, `title`, objective `text`, `status` (`incomplete`, `complete`, or `redeemed`), and a `rewards` array. Rewards support `{ kind: 'inspiration', amount }` and unquantified `{ kind: 'energy' }`.
- Counts are derived from the array: total, incomplete, complete awaiting redemption, redeemed, and accomplished (complete plus redeemed). Do not supply contradictory independent counts.
- The first unredeemed quest is active. Later quests render as opaque full-size cards beneath it. An empty field and a fully redeemed chain have explicit states.
- `QuestCard` presents the active title, objective, completion state, and bottom-anchored reward, and invokes its redemption callback only when complete.
- `PlayingCardStack` owns shared 63:88 geometry, uniform sizing, overlap, and layering. Verify its rendered surfaces and occlusion with isolated headless Playwright, not sizing math alone.

## Details Card Viewer

- Use an object-agnostic component that can represent actors now and other game objects later.
- Tile inspection (Eric, 2026-10-09): discovered map tiles are inspectable as portrait game cards using the shared TradingCard viewer, artwork, terrain/travel status and exploration or fishing action. Replace tile notice popups with these cards. Clicking or tapping an occupied tile shows the actor card nearest the tile, followed by the tile card to its right; keep the row together and on screen. Each card supports compact/jumbo inspection and its own close control. Actor grabs and camera drags never open inspection, and unexplored tiles remain silent and anonymous.
- General layout: name at the top, a circular × close button to its right (replacing the chess-piece badge), art in the center, descriptor beneath the art, and extensible trays below the descriptor. The close button dismisses compact details and returns jumbo details to compact; support mouse, touch and keyboard activation.
- Support actor inspection on the table and in foundations. Keep inspection separate from dragging.
- Clicking, tapping or pressing Enter on a tableau foundation actor card opens that actor directly in jumbo mode. Completed drags never open inspection; pending foundation target selection takes priority. Foundation-triggered inspection closes completely on ×, Escape or backdrop dismissal, without showing a compact card. Compact inspection and jumbo-to-compact dismissal are for grid triggers only.
- Present details as a nonmodal floating playing card to the right of the inspected object, above the table. Reposition near viewport edges to keep it visible; use the light engine for its elevated shadow. Do not use a full-screen backdrop or centered zoom presentation.

## Solver tools

- Tableau fields expose Auto-Solve and Best Move controls at the top of the field, with Divine Intervention and Guidance checkboxes.
- Normal mode applies the same RPG constraints and costs as human play.
- Divine Intervention ignores RPG constraints and does not decrement actor values.
- Tableau-to-foundation card flights use the auto-solve speed for manual plays too. While a manual exploration play is in flight, the tableau already shows where it lands, so the next eligible card can be clicked at once; the flying card lands immediately and the next one takes off. `tools/card-flight-playwright.cjs` checks it.
- A Guidance checkbox sits right of Divine Intervention and is off by default. Only while it is checked do playable tableau cards (and ready encounters) get the eligible-move highlight; a card picked for targeting stays highlighted either way. The highlight is the gold outline; no theme rule may outline a card just for being playable. Guidance works without a staffed foundation.
- All solver controls, including Divine Intervention, require an actor stationed in the applicable foundation. Disable them when unstaffed and stop an active solver if staffing is lost.
- Auto-Solve and Best Move use visible card-flight animations. Main tableau moves apply on landing; solver sequencing waits for the current flight.
- Use deterministic reasoning for authored seeds and bounded Monte Carlo-style assessment for random deals.
- Keep solver interfaces extensible for future limited-use guidance effects such as Astral Guidance.

## Lighting

- [Preserve the day/night scaffold, moving global light source, local table lights, and consistent o... — art/presentation contract](./ART.md#contract-095).

## Temporary scaffolding

- World tableau travel trial (Eric, 2026-10-14): the default-enabled Map tableau (test) alternative uses seven logical columns in the shared 3D map. Cards are fixed roadside props anchored to their source grid crossing with route-aligned depth and physical perspective; camera movement must never repack them into screen space. Preserve exposed-card adjacency, seven-column deals, normal rewards/costs and solver rules; proximity never gates a legal play. The traveling actor's popped-up holocard is the foundation, with applicable travel utilities beside it. Only pause, solver controls and summary use a compact HUD. No tableau tray, landscape or floating card overlay. Keep the route corridor clear and retain the original layout when disabled. This presentation experiment supersedes the earlier map-overlay trial.

- [Fixed immersive scenery trial — art/presentation contract](./ART.md#contract-096).

- Dark Woods at (-2,1) temporarily starts the Three.js battle scene in the table viewport when an actor arrives, replacing its real-time skirmish entry. The CSS map and its camera are unmounted while the battle scene occupies that viewport and restored on Escape or Return to table. The adjacent field is the live battle (see Battle abilities and stagger): Hero and Mochi player foundations and a card for each dark slime, with their authored sprites. Combat entry stows the resource and quest trays and hides their edge handles while the battle scene is open, keeping them clear of the cards. Returning to the table restores the usual tray handles. Battle tableau cards fill a snug seven-column rack with uniform portrait scaling constrained by its available width and height. While the combat camera is open, its single continuous Three.js render extends beneath the tableau field using an off-axis viewport extension that preserves the arena framing. Cards and foundations overlay it with a strong dark readability gradient (78–88% opacity) that dims the world behind the combat tableau; there is no separate sprite scenery behind the active combat tableau. On mobile, the same render follows the visible Table or Tableau panel. The inactive field retains its forest fallback. Enemy foundations sit at the top of the field and player foundations at the bottom, with seven shared tableau stacks between them, reusing the safe Small Woods at (0,-1) deal, scenery and lighting; the deal and initial foundation values remain temporary scaffolding. Front cards can be clicked, tapped or keyboard-activated when adjacent to a current player foundation (A/K wrap), automatically flying only when a single party actor is eligible. If multiple foundations are eligible, the card activates with a gold highlight and the eligible foundations highlight as choices; the player chooses one to start the flight. Clicking the selected card again cancels the choice. This follows the existing Proto combat playColumn / chooseFoundationTarget sequence. A play lands at once (rank, collected count and charge), so consecutive plays never wait on a flight; the flight is only the card's journey. For example, the opening 4 flies to Mochi (5). Plays charge the actor's ability; they do not spend energy, grant world rewards or advance initiative. The older Deep Woods ambush remains intact. Entry runs only the overview camera sweep while the actors remain in their starting poses. The scripted battle action starts only on an explicit Cinematic or Replay scene press, runs ten seconds, holds its final pose, and grants no combat rewards or damage. `?combatdemo` opens the same embedded scene directly for iteration. `tools/battle-viewport-playwright.cjs` checks this layout and camera lifecycle.
- The camera study pairs Hero with Mochi, the fluffy tortoiseshell cat based on Eric's photos, against generated dark slimes. Mochi has eight authored low views, eight elevated views and a true overhead view; right-side art preserves asymmetric coat markings. Slimes select corresponding front/rear/elevated/overhead art and gently squash around their ground anchor. These scene actors are presentation assets, not a change to biome encounter rules. `tools/actor-rig-playwright.cjs` checks heading/view selection, shared atlases, articulation, desktop layouts and reduced-motion touch input.
- The embedded battle scene has compact camera preset buttons floating over the lower viewport, with no dock: Combat opens with an elevated sweep circling both teams and settling behind the team with first turn priority. Players go first for now, so the resting camera is Party; the shared priority order is a placeholder for future initiative. Reduced motion goes straight to that resting view, and manual camera selection interrupts the opening. Cinematic is available only by button and starts the action and its timed camera rig from the beginning; Side frames both teams at a low angle; Party looks over the party toward the foe; Enemy reverses that angle; Overview rises above the arena. Manual choices hold independently of the scene clock, including after the final shot, ease between views, and switch instantly with reduced motion. Replay scene restarts the action while preserving the chosen view. Restart battle scene and Escape float with the scene controls, rather than appearing in the tableau field. Restart reruns the entry overview; Escape uses the former Leave Woods actor-return behavior, or closes the direct preview. An inactive tableau retains only Watch battle scene to reopen the scene. Camera properties expand above the controls. These controls are part of the temporary battle presentation study.
- The Three.js battle study offers Freecam as an independent toggle for manual camera control, enabled by default (Eric, 2026-10-11). Preset and Cinematic selection preserve the toggle; enabled manual input takes over from the current pose, and disabling it clears held keys and gestures and blocks manual movement without changing the pose. WASD pans relative to the view, Q/E moves down/up, mouse or touch drag orbits around the aim, wheel changes orbit distance, and Shift/right/middle drag pans. The Freecam instruction strip and on-screen movement hold buttons are removed; mouse/touch orbit and pan gestures and keyboard movement remain available. All camera modes show live position and aim XYZ, Euler angles, orbit yaw/elevation/distance, FOV, aspect and clipping planes alongside scene time; Copy camera cue exports the current `{t, p, target, fov}` for sequence authoring. These tools remain part of the temporary presentation study.

- Inspiration pays for a foundation redraw (`rules/redraw.ts`). Each actor has their own inspiration (`actorInspiration`, max 4). When nothing on the tableau plays on an actor's foundation, the player can abandon the foundation's value for a new one, and the actor spends 1 inspiration; at 0 inspiration there is no redraw. A redraw draws a random rank other than the abandoned one, or takes a spirit companion's fixed value (`SpiritDef.redrawRank`, offered through `redrawOptions` / `actorRedrawOptions`) at the same cost. No spirit offers a value yet, so there is no choice UI.
- In the Dark Woods battle each party foundation has a "↻ Redraw N" button under its ability card, N being the inspiration left (`redrawActor` in `rules/battle.ts`). It works by mouse, touch and keyboard, keeps the actor's charge and collected cards, and is disabled at 0 inspiration, for a downed actor, while paused and after the fight. The Hero comes in with their world inspiration and a redraw spends it; Restart keeps what was spent. Exploration tableaus have no Redraw: their quest deals are scripted to always play, so they never get stuck. `tools/battle-redraw-playwright.cjs` checks it at desktop widths.
- Inspiration is not a travel cost: moving to or leaving any biome costs none, and tiles carry no travel cost. Tableau plays cost no inspiration either; an actor's work cycle (the "TABLEAU COMPLETE" reward) comes every `WORK_CYCLE_CARDS` (4) cards played. Food, quest rewards and resting still restore inspiration.
- The remaining inspiration costs, pond misses and staffed hut crafting, are disabled in Proto for testing (`src/proto/inspirationTesting.ts`); set `DISABLE_INSPIRATION_CONSUMPTION` to false to restore them. Redraws always cost inspiration. Energy costs remain active.

- [Biome tiles have no outer border for now, in either camera view. — art/presentation contract](./ART.md#contract-116).

These are current implementation defaults for iteration, not permanent game-design requirements:

- Quest and settlement resource trays are detached from the Proto runtime for now (Eric, 2026-10-09). Preserve their reusable component code and styles, but do not mount the trays or their restore handles, reserve layout columns, or expose their navigation tabs. Proto currently uses Table / Tableau navigation; the tray contracts below remain available for future integration.
- The retired expedition chain's +1 INSP quest bonuses no longer apply to the opening quest. Rest advertises unquantified energy earned through the den's tableau cards; that reward attachment is future work.
- Hero detail art uses the dedicated generated forest portrait (`public/assets/runtime/ui/holocards/actors/hero-card-v2.png`); the world standee retains `hero.png`.
- DCV Stats, Equipment, and Buffs trays are placeholders awaiting further design.
- Auto-Solve and Best Move initially serve developer testing.
- Exploration tableau backgrounds extend the existing CSS map camera projection behind the tableau and foundation shelf at desktop widths. Keep one world layer and the original map viewport, camera pivot and input coordinates; remove the independent tableau forest scrim and dim the shared view beneath readable cards and controls. Combat retains its separate Three.js viewport extension.
- Combat tableau foundations use exploration-style wide trays, portrait playing-card sizing, and energy and collected-card counters to the left. In the Dark Woods battle, party foundations show only the collected-card count, under the card, with the ability card beside them. Combat and immersive exploration trays share the 24-degree tilt. Hero and Mochi player foundations use one full-art holographic TradingCard (63:88), replacing the plain rank card and separate sprite/name base. Hero uses deprecated/pixel/characters/hero-card-v2.png; Mochi uses deprecated/pixel/characters/mochi-card-v1.png. Live rank and resource glyphs overlay the art; actor names remain at least 16px. Both cards retain static foil without pointer/touch or gyro tilt animations. Enemy foundations retain upright sprites. Foundation inspection, dragging, exits, target selection and card flights remain available. World actors retain their directional rigs.

## Validation and delivery

- Inspect relevant layout, sizing, overflow, layering, and interaction paths before delivery. Do not claim visual verification that was not performed.
- Fast prototyping (Eric, 2026-10-07, until he says otherwise): do layout work and visual/layout checks at desktop widths only (for example 1912x914 and 1280x720). Skip phone-width polish and phone-only checks; input still works by touch and mouse.
- Enforce that inspection with the shared layout check (`tools/lib/layout-check.cjs`, used by `tools/tray-layout-playwright.cjs`) for every UI change, at desktop sizes down to 1280x720 and at phone portrait and landscape: no element may overlap another or a frame decoration such as corner studs, escape its container, clip its content, or render text under 16px. Also review a zoomed (3x) screenshot of each changed element; a defect the check misses gets a new check, not just a fix.
- Run checks appropriate to the change, including meaningful tests for reward redemption, progression, or other consequential state changes. Report pre-existing failures separately from regressions.
- Isolated headless Playwright testing is authorized for this project. Use a separate browser/context against the local app; do not control the desktop, move the user's mouse, steal keyboard focus, or interact with personal browser sessions.
- Ensure Vite is running for requested playtests and provide the verified local Proto URL.
- After completing a piece of work, leave it ready to playtest immediately: get the changes onto the user's PC checkout, make sure Vite is running there with the new code, verify the Proto URL loads, and report the local URL (plus the tailnet phone URL when available).
- Report what changed, what was actually checked, and material remaining limitations. Avoid treating a successful bundle build as proof of correct visual appearance.

- Quest tracking is a physical recessed tray. Stow moves the entire tray off-screen and releases its layout space to the table; the quest tray’s viewport-edge restore handle brings it back. Do not merely hide cards inside a still-visible tray. Stowing preserves progression and the card queue. Only an accomplished quest can leave the tray and fly to the table; never use the next queued card as a flight source. After departure, the next objective is visible in the tray but remains there until complete. Pending reward redemption remains explicit.

- A stowed tray leaves a small handle on its viewport edge (quests right, supplies left): the tray's drawn emblem (a sealed quest card, a supply sack) above the same leather pull tab used to stow it, with no text label. Restoring from mobile opens that tray's panel.

- Quest rewards are redeemed only by pressing and holding the card on the table; the tray has no separate hold control. There is no separate teaching card: the card's own status line ("Hold 1s to redeem") teaches the hold.

- The quest tray is one quest card wide plus its recess and frame. The active card lies face up in a card-shaped slot with its title, objective and reward readable at 16px; the two locked slots below it are identical in size to the active slot, each with a lock. The discard counter and the stow control share the tray's top row. The quest well never scrolls: the three identical slots shrink to fit its height (on phone landscape they sit in a row), and the face-up card always shows its whole title, then clamps the objective to the lines left (ending in an ellipsis, or hidden when no line is left), with the full text in the toast. Quest cards on the table also show their whole title at 16px: the status line gives way first. Tapping the active card also pins its text in a closable toast (`PinnedToast`).
- Hover text never uses the browser's own tooltip. Any element's `title` is shown by the shared parchment `GameTooltip` (mounted once in `src/proto/main.tsx`): on hover or keyboard focus with a mouse, and on long-press with touch (a tap on plain text also shows it). It stays on screen at every size and fades on its own after a touch.
- Reward holds last 2 seconds. Generous drift (12px mouse, 24px touch) is allowed before a hold turns into a drag. A touch long-press never opens developer menus. The hold fills the card from the bottom like a meter.

- Settlement supplies live in a slim, stowable tray on the left that mirrors the quest tray: one token and count per resource, no labels. Tapping a resource opens its details (category, held count, recipes that use it, Place 1 on table). Phones show it as a Supplies tab.
- Tray stow controls are physical pull tabs (a stitched leather strap with rivets), never arrow or media-style glyph buttons.

- Table zoom preserves the world point at the viewport center, including after panning. Wheel and pinch calculations must use the same centered coordinate origin as rendered table content.

- Actor destinations snap to a table grid square (biome entry and building staffing keep their designated positions). Routes are the fastest legal path on the table grid (`gridPathfinding.ts`): weighted A*, 8-way, never cutting diagonally past a blocked cell. Open table costs 1 per cell; a biome costs what its flags say (below); locked biomes, buildings and the impassable terrain can't be crossed. The start and the destination are always allowed, except that a destination is never terrain. With no route, the actor stays put and the "No clear route" note shows. Travel slows through costly ground (`pointAlongTimedPath`). Unit tests cover crossing an explored biome to save time, going around an unexplored one, taking rough ground only when it's faster, an unexplored destination, walking back to the starting square, and no route.
- While an actor is dragged, the square it would land on lights up (the grid square under the pointer at any spin; red over terrain or with no route), and the route is drawn on the table like a tactics game's movement preview (`RouteLine`): short dashes drifting toward the destination, cool at the actor and warm at the end, tighter over slow ground, passing under tile labels, with its length in cells at the end. On drop the actor walks it and the line is used up behind it; it is gone on arrival. `tools/biome-pathing-playwright.cjs` and `tools/drop-target-playwright.cjs` check them.
- Actor drop targets and biome highlights use the table grid square under the pointer, including in immersive mode. Raised biome scenery must not capture actor drops onto neighbouring squares.

- Reward-hold diagnostics: opening the page with `?holdlog` shows a timeline of each hold (press, start, cancel and its cause, completion, redeem outcome, worst frame). Without the flag nothing is recorded or shown, so builds carry no dev UI.
- Completed table quest cards support pointer/touch dragging without camera movement. First interaction switches them to the shared table-card size (96 world units wide, locked 63:88 ratio). Drops are unsnapped, avoid biome/building footprints, and may settle with a small tilt. Reward holds show progress on the card, cancel on movement/release, support keyboard holds, and require one uninterrupted second before rewards and discard flight.

- For now, Hero details uses the shared default table-card screen size (96 world units × default 1.7 scale = 163.2 CSS px wide, 63:88 ratio). Its floating presentation remains independent of camera zoom. The details card uses the shared modular `TradingCard` face: title/close control, dedicated full-art background, description, configurable sections (stats, equipment, buffs/debuffs) and optional footer. Its dark metallic V-inspired frame and diagonal holographic gradients respond to mouse and touch pointer position; the card tilts in perspective and rises with a shifting shadow, with damped spring follow-through and a smooth return on leave/release; a stationary input stage prevents hover feedback; foil stays beneath text, and reduced motion keeps a static finish. Hero uses a short description caption with the full description in the shared GameTooltip on hover, keyboard focus and touch. The upper-right × button, outside press and Escape dismiss it and restore focus. Compact tray icons and a contained descriptor preview preserve the text-size floor; full descriptor and tray labels remain available through accessible text and hover titles.

## Grid coordinates

- Map camera controls live as styled icon buttons in the bottom row alongside zoom and the pointer grid reference. The map has no separate Quest button; use the quest tray’s stow/restore controls.

- Shared `GridCoordinates` defines a stable grid ID, configurable cell size, fixed world origin, signed column/row indices, and named landmarks. Camera pan/zoom and responsive layout never alter cell identity.
- The table uses 48 world units per cell. `True Center` is cell `(0, 0)`, absolute reference `table:0,0`, and world center `(0, 0)`. Positive columns point right/east; positive rows point down/south. Cell boundaries are half a cell from their centers; boundary ties select the cell on the right/bottom.
- Use shared cell/reference parsing, world/cell conversion, region bounds and screen/world conversion helpers instead of adding object-specific offsets or hardcoded grid sizes. Actors snap to cell centers; freely placed cards retain fractional world positions and can still be associated with a containing cell.
- The table exposes an origin guide, pointer-cell reference readout, and True Center camera control. Update the readout on grid presses as well as pointer movement so stationary touchscreen taps select the pressed cell. Object grid references remain absolute after moving the camera.

- Clicking or keyboard-activating the compact details card opens its jumbo state, centered at 82% of viewport height with its portrait ratio preserved. Jumbo keeps the spring tilt, depth and diagonal foil, blurs and disables the game behind it, shows the full description in a dedicated section, and replaces the stats, equipment and effects lines with one strip of icon chips (Hero: ♥ HP, ⚡ inspiration, ⚔ equipment, ✦ effects) so the face goes to art and description; each chip explains itself on hover, keyboard focus or tap through GameTooltip, and the card holds its tilt while the pointer is over the strip (Eric, 2026-10-11). The upper-right × button, Escape or the backdrop returns to compact; compact’s × dismisses the viewer. Jumbo traps keyboard focus and restores compact focus when dismissed.

- Table camera (Eric, updated 2026-10-08): top-down (overTheTop/OTT) zoom caps at 5.95× (350% of the starting view). Immersion continues to 6.8× (400%): beyond 265%, zoom smoothly lowers the camera from 30° to 8° above the ground and gently raises its aim toward the upper half of the actor's pop-up. Through 265%, immersion retains its 60° tilt from top-down. The rig, lighting, scenery and pointer projection follow the same live angle and aim; returning to top-down preserves framing up to its 350% cap, and Reset View restores the starting framing.

- Build identification (updated 2026-10-12): the top bar shows only the current build time as `mmddHHmm` (zero-padded month, day, 24-hour hour and minute in the player's local timezone), replacing the visible build number. Keep source revision and full build time in the tooltip. Local source and asset edits count as new versions even before commit; refresh the build time rather than using the last commit time.

- Holocard artwork and original generation notes are owned by the dedicated sibling `Exploritaire-art` Git repository. Run `npm run art:sync` to refresh portable game copies in `public/assets/runtime/ui/holocards/actors`; Hero details and foundations share `src/proto/art/actorCardArt.ts`. The TradingCard frame and animated foil remain game components.

- Unknown map presentation (Eric, 2026-10-08): show every undiscovered tile as dark grayscale ground in both map camera views, using the shared silhouette filter with full grayscale and 45% brightness. It has no visible name label until actor discovery (entry for paths and roads, proximity for other terrain); keep terrain art and scenery concealed and preserve actor-entry tableau behavior.

- Hero's Den (Eric, 2026-10-08): (0,2) is the unique `hero-den` tile, replacing the mountain there and retaining its resource-free exploration deal. Hero starts in the den; the former den at (0,1) is a path concealed until entered. The inclusive rectangle from (-7,2) through (7,7), except the den at (0,2), contains 89 `impassable-mountain` landmarks named "Impassable Mountains": no crossing, actor placement or tableau. Mountains start concealed and follow the shared actor discovery rule. Discovered mountains use a dedicated overhead print and immersive standee.

- Tile titles (Eric, 2026-10-08; connected labels updated 2026-10-09): show the entire title for each visited tile or its connected same-type label group; never crop letters, abbreviate the name or rely on a tooltip to recover missing title text. Dynamically size and reflow the title inside its actual rotated footprint. The full-title fit takes priority over the general text-size floor when a tile is constrained, using a bounded compact fit rather than clipping.
- Adjacent identical immutable tiles (Eric, 2026-10-08; label rule updated 2026-10-09): permanently impassable, non-explorable and unchangeable terrain can form a shared visual region. Keep per-cell terrain and blocked interactions, with one complete title in the connected group's largest filled rectangle. Refuse label rectangles over holes or other tile types. Refitting follows live camera rotation and zoom so upright text remains within that footprint, including diagonal angles. The 89 impassable mountains from (-7,2) through (7,7) remain one connected terrain print with a den notch at (0,2); separate filled rectangular scenery bounds keep physical feet out of the den without producing extra titles.

- Environment presentation (Eric, 2026-10-08): actors retain their physical depth among immersive environment props. One shared compositor detects overlapping foreground scenery, reduces that scenery's opacity while keeping its structure visible, and draws the obscured actor as a dim silhouette with a pale glowing outline through it, like the BG3 camera reference. Use the existing live sprite/token, with no second animated rig or per-biome visibility exceptions; inspection, occupied-square grabs, touch and keyboard input remain available. Unobscured actors and background scenery retain their normal appearance. All immersive scenery billboards keep their complete ground foot line inside their owning tile at every live camera angle; height rises above that footprint. Top-down mountain prints have transparent pixels outside the rocks over the same dark neutral ground as adjacent unknown cells.
- Hero's Den artwork and pose (Eric, 2026-10-08): use a rocky den with dedicated overhead and immersive pixel sprites. The overhead print has a partially roofed sleeping hollow: the northern rocky roof covers the top part of Hero’s sleeping body while leaving her face and paws visible. Outside the rocks, the tile backing is transparent over the same shared dark neutral ground as adjacent unknown cells. Immersion uses a substantial roof, side walls and a deep arched cave entrance, omitting the overhead print; the known home’s authored cave material stays fully visible while its resource-free exploration deal retains its progression. Hero curls up in her authored sleeping pose while occupying the den, including when stationed there; travel wakes her and returning settles her back to sleep. Immersion retains the rocky roof and uses the shared occlusion outline through it. Sleeping Hero rests directly in the den rather than standing on her round token base. The sleeping pose remains presentation; the Hero's Den rest tableau defined above now supplies inspiration recovery and supersedes its former resource-free exploration deal. Assets live in `public/assets/deprecated/pixel/environment/hero-den-*.png` and `public/assets/deprecated/pixel/characters/hero-sleeping*.png`; original atlases and generation prompts are retained with their sources. `tools/heros-den-playwright.cjs` checks both camera views, camera turns, mouse/touch/keyboard inspection, leaving/returning and scenery fading.
- Camera performance (Eric, 2026-10-08): live rotation uses imperative camera transforms; synchronize React scenes and report title bounds when rotation settles. Title ink and scenery footprint constraints still follow the live camera. Scope camera variables to their viewport, batch identical neutral ground into one flat surface, and project cached lighting guards instead of measuring DOM layout each frame. Validate rotation frame times with an isolated browser benchmark.

- [Connected mountains — art/presentation contract](./ART.md#contract-097).

- Actor discovery (Eric, 2026-10-08): a player actor discovers paths and roads only by entering their square. Woods, water and impassable terrain retain discovery in the occupied square plus the eight immediately neighbouring squares, diagonals included. Apply these rules at startup, during actual travel and on arrival, including foundation occupants. Discovery is permanent; discovered tiles do not recursively reveal more tiles. All distant tiles, including rows 4–7, start as indistinguishable dark ground. Hero's den and nearby mountains are visible at startup, while adjacent paths and roads remain anonymous. Discovery reveals the full biome type and art without golf/tableau work, preserves `rough`, `danger`, `impassable` and locks, and never starts a neighbour's encounter or assigns an actor to its foundation. Connected mountain prints and shared titles include only discovered cells and never bridge fog. Mountains remain impassable, so deeper mountain rows stay hidden unless an actor can legally get nearby. `tileDiscovery.ts` owns the shared rule; `tools/tile-discovery-playwright.cjs` checks mouse, touch, keyboard and both camera views.

- Current table setup (Eric, 2026-10-09): keep only the six cells in the inclusive rectangle (-1,2) through (1,3): Hero's Den at (0,2) and five impassable mountains. Clear all other biome, road, path and concealed tiles from the table. The surrounding table stays empty; retain its grid and exterior terrain boundary. This supersedes the former 89-mountain starting layout and full-table concealed tile fill.

- [Exterior terrain presentation — art/presentation contract](./ART.md#contract-117).

- Playtesting values (Eric, 2026-10-09): Hero's jumbo inspection offers an explicit Playtest values editor for current/max HP, inspiration reserve, foundation inspiration and energy. Apply changes live session state; Cancel edits discards the draft. Gameplay continues to change these values, recovery honors edited caps, and restarting clears overrides. This is playtesting scaffolding, not actor progression or permanent authored balance.

- [Occupied den layering — art/presentation contract](./ART.md#contract-098).

- [Movement-driven sketch/watercolor reveal — art/presentation contract](./ART.md#contract-099).

## Tableau layout workshop (Eric, 2026-10-17)

- Tooling → Tableaus authors reusable travel layouts with free card positions, rotation and drawing layers, explicit named coverage stacks (buried-to-exposed order), and fixed A–K or deterministic random ranks. Geometry and play blocking are independent; card positions and fitting stay stable as cards leave.
- Assign layouts to terrain types, with sparse berries as a distinct target. Assigned travel crossings use the authored card count while retaining normal stamina, AP, discovery, finite harvest and rank-reset rules. Explicit passages keep their own deals. Gathering, rest and combat retain their specialized generators. Unassigned terrain retains existing deals, including the approved sparse cluster.
- Include a berry-cluster starter, creation/duplication/deletion, pointer dragging and numeric placement, undo/redo, local draft recovery, validation, JSON import/export, and an interactive seeded foundation/coverage test. Random values are independent A–K samples and need not produce a solvable deal.
- Apply to playtest stores a separate browser-local override for new journeys/restarts; clear it to return to repository defaults. Save authored data validates and writes only the layout catalog and assignments to src/data/tableauLayouts.json through the trusted development endpoint. Never serialize session card removals, ranks, resources or progression. Custom free-positioned travel deals use the fitted tray even when the optional world-station trial is enabled.

## Proto authoring surface (Eric, 2026-10-17)

- `/tooling.html` is a Proto-only tile/tableau authoring workspace. Use ProtoVariant, its actual map, shared TileEditor, tile schema/validation and runtime generators. Do not expose the legacy Kin, ability, encounter or combat-log editors here; their existence elsewhere in the expansive codebase does not make them requested or shipping features.
- Start in the authored-map sandbox with tile editing open and gameplay paused. Keep map selection and a bounded authoring workspace simultaneously visible on desktop and phone. Select actual authored tiles by map or selector; edit identity/footprint, traversal overrides and passage rules, population and gathering tuning, arrival/discovery/flags, road prints and scenery lights, with separate shared terrain defaults.
- Provide travel-layout authoring in the same workspace, with selected tile/type context. Type assignments affect every matching Proto tile; passages, gathering, rest and fishing retain their existing specialized rules. Show generated gathering/rest samples through Proto's materializeTiles and shared card/template components. Explain the actual type-specific generator and scripted-day overrides instead of exposing unrelated engine ideas as supported properties.
- Tile Apply changes only the current Proto session and survives its scenario restart through the existing applied-document mechanism. Tile Save and Export use the existing authored-data boundary, excluding session deals and progression. Keep tile commands distinct from layout catalog commands. Closing discards unapplied tile drafts and permits playtesting the applied state. This supersedes the generic entity-tooling entry point.

## Den exit traversal trial (Eric, 2026-10-17)

- Trial a separate six-card tableau from the Den center to its north mouth before the destination crossing. Use the map-tableau presentation automatically for this stage, with fixed pins on the two flanks and four across the arch, a smooth close frontal camera swing, and a complete adjacent-rank progression from the incoming foundation. Solving earns the half-tile exit; the berry approach follows with its existing stamina and finite harvest. The Den permits entry/exit only through its north face. General eight-way tile traversal remains under consideration; retain orthogonal routing elsewhere. This is temporary gameplay/presentation scaffolding and supersedes the optional-map-trial default for this Den stage only.

## Den tableau-field revision (Eric, 2026-10-17)

- Present the Den exit trial in the separate tableau field with a fixed frontal replica of the painted cave. Fit the cave and six card pins together: four across the arch and one on each lower flank; keep their positions stable as cards leave. Use the shared tableau template, foundations and normal play/solver rules. Remove the exit-specific map camera shot and automatic map-tableau activation; the puzzle composition supplies its own solving view. Preserve the north-only exit, earned movement and subsequent berry crossing. This supersedes the map presentation and exit-camera portions of the previous trial; general eight-way traversal remains deferred.

- Tableau biome continuity and Den background (Eric, 2026-10-17): give the cave tableau the shared painted landscape floor/ground-cover and atmospheric backdrop behind its single frontal cave composition. On completing a travel deal, retain the final crossing biome rather than falling back to the origin/Den; keep that scene through arrival until the actor moves to another biome. Preserve depletion and finite rewards.

- Immediate sparse-berry dialogue (Eric, 2026-10-17): start Hero’s nearby-bush reflection on the final legal sparse-tableau play, without waiting for the earned walking buffer to settle. Preserve actual earned movement, camera/callout anchoring, global pause, reading progress through arrival and the single finite berry reward.

- Denser-patch handoff (Eric, 2026-10-17): on the second nearby-bush reflection bubble (trying the denser patch), smoothly pan over 1.8 seconds to frame Hero and the actual denser quest target, and face Hero toward that target. Briefly highlight its tile/quest line with the existing 0.8-second fade after the pan. Derive target and heading from the applied tile positions; retain manual takeover, pause and dialogue reading. New travel restores movement-facing.

- Route preview temporarily suspended (Eric, 2026-10-17): a valid actor/destination drop starts the normal card-driven journey immediately, without the OK!/X route-preview step. Keep same-cell no-ops, legal/discovery routing, scenario rails and stamina checks. Retain preview/waypoint scaffolding for reinstatement. Blocked journeys stay halted until a new valid destination drop starts a checked route directly; do not reopen OK!/X automatically. This is a temporary playtest flow change.

## Ordered traversal and point-of-interest iteration (Eric, 2026-10-17)

- Leaving the sparse patch adds a six-card, solvable, reward-free exit deal in the planned direction. For that journey, present each exit and destination traversal deal separately in route order; unlock the next deal only when actual earned walking reaches its boundary. Keep the tile biome visible until Hero crosses its threshold, including depletion. Split the existing crossing STA estimate between the two halves instead of adding cost; retain rank, AP, streak and reserves across stage handoffs. Use bounded acceleration and finite braking into earned endpoints rather than an asymptotic motion tail.
- Automatically open the authored point-of-interest tableau at arrival. Traversal earns movement; that gathering/event deal earns its own resources/event progression without movement. Preserve the finite sparse harvest. Carry Hero’s travel rank forward, and register a fresh scripted gathering ladder to that incoming rank once, retaining its reward positions and subsequent saved deal. Origin/departure, route-direction and stage-isolation scaffolding initially apply to journeys leaving the sparse patch; explicit passages and other existing journey generators retain their current behavior.

- Travel solver scopes (Eric, 2026-10-17): replace travel Auto-Solve with Auto-S Tile and Auto-S All. Tile captures the current tile’s outgoing threshold and stops earning cards there, allowing earned walking to finish without playing the next tile. All continues through the ordered travel stages to the destination; point-of-interest deals remain separate. Preserve Best Move, Stop, legal plays, resources, pause and blocking rules.

- Cave threshold presentation handoff (Eric, 2026-10-17): the final cave exit card immediately switches both cards and tableau scenery to the next deal, independently of Hero’s animated walking progress. Keep actual movement card-earned and preserve Auto-S Tile stopping at that threshold. This supersedes movement-gated cave scenery only; the sparse-patch exit retains its existing boundary behavior.

- Unified actor holocard (Eric, 2026-10-17): keep Hero’s single live holocard in the map’s upper-left corner. It replaces the travel/gathering actor foundation face and compact actor popup, shows the active foundation rank and resource receipts, receives tableau card flights, opens full inspection on activation, and initiates the normal checked travel gesture when dragged. Keep tableau controls and the distinct rest stock receiver available.

- Actor card value identity (Eric, 2026-10-17): print the live foundation value prominently inside the actor holocard’s lower identity band beside the actor’s name. Replace the detached upper-right rank bubble; retain artwork, card proportions, live rank, inspection, receiving feedback and movement gestures.

- [Actor card text refinement — art/presentation contract](./ART.md#contract-100).

- [Actor card text backsplash — art/presentation contract](./ART.md#contract-101).

- [Actor card typography polish — art/presentation contract](./ART.md#contract-102).

- [Actor card plate placement — art/presentation contract](./ART.md#contract-103).

- [Actor value breathing room — art/presentation contract](./ART.md#contract-104).

- [Actor value inset adjustment — art/presentation contract](./ART.md#contract-105).

- Diegetic tutorial quest discovery (Eric, 2026-10-18): retain the first opening quest arrival, but do not predeal future quest cards. On starting the Day 01 cave exit, hold all six value cards face-down and place Find a way out near the tableau cave mouth. Tapping or keyboard-activating the found quest flies it to the upper-right quest slot, then rapidly reveals the value cards in sequence. Preserve pause, restart, reduced motion and real progression. Later tutorial cards currently appear individually at their existing milestone handoffs; additional world discovery locations remain to be authored. This supersedes dealing the entire tutorial stack at opening and automatically exposing the second card. Scene navigation to Start leaving the den retains its completed, quest-collected checkpoint.

- Remaining diegetic tutorial quests (Eric, 2026-10-18): every Day 01 quest after the opening Leave the den card is discovered on the tableau ground at its preceding task milestone. Place the berry instructions beside the brush, the homeward instruction at the harvested patch, and supper/rest instructions in the den. Each must be picked up to fly into the quest slot; do not automatically expose future instructions there. Hold the active tableau input until pickup, retaining existing travel arrival reveals. Lay found cards into the ground plane with perspective, a small irregular rotation and a close contact shadow; lift them upright during pickup. Keep the first opening card, pause, keyboard/touch, restart and reduced motion. This supersedes the later-card milestone auto-arrivals in the previous discovery iteration. Existing scene checkpoints reconstruct milestones and offer the next uncollected instruction.

- [Cave tableau prop detail — art/presentation contract](./ART.md#contract-106).

- [Cave mountain backdrop scale — art/presentation contract](./ART.md#contract-107).

- [World quest attention shimmer — art/presentation contract](./ART.md#contract-108).

- Idle tableau shelf removal (Eric, 2026-10-18): omit the unused Empty foundations placeholder and let the idle tableau background span the whole field. Retain active gathering/rest foundations and their controls.

- [Quest pickup luminosity — art/presentation contract](./ART.md#contract-109).

- Tableau drag input (Eric, 2026-10-19): allow mouse and touch dragging of exposed playable tableau cards onto actor foundations, including the unified map holocard. Preserve receiving-actor legality, click/keyboard play and cancellation outside valid foundations.

- Callout draft preview (Eric, 2026-10-19): show the unsaved callout output while editing text, effects and expression. Match runtime bubble styling, speaker, tone, pagination and word effects, with bubble navigation and reveal replay at the draft speed. Preview leaves saved overrides and scene camera unchanged; retain Cancel and explicit Save.

- Callout character wave (Eric, 2026-10-19): animate Wave sequentially per character across the selected phrase in gameplay and draft previews. Keep word wrapping, color/potency controls and static reduced-motion presentation.

- Callout layout resilience (Eric, 2026-10-19): reserve viewport- and container-bounded minimum bubble space independently of effect markup, including expression and edit-control clearance. Keep speaker names from breaking between letters. Validate short/long text across effects, narrow screens and editor previews using tools/callout-layout-playwright.cjs.

- First berry quest placement (Eric, 2026-10-19): center the Pick the first berry pickup over the sparse bush’s middle tableau cards at the highest tableau card layer. Use a slight flat tilt without perspective distortion, including its pickup flight; retain glow, darkened backdrop and interaction. This supersedes the ground-plane perspective for this pickup only.

- Unfailable first berry deal (Eric, 2026-10-19): retain the sparse bush’s six-card poses and explicit coverage, but use consecutive ranks relative to the incoming foundation (normally 3 → 4 → 5 → 6 → 7 → 8). Every legal play path must finish without redraws, with the one finite berry on completion. Exhaustively validate legal choices, including cave handoff and A/K wrapping. This supersedes the branching 3 → 2 → 3 → 4 → 5 → 6 rank arrangement.

- Playtest actor description (Eric, 2026-10-19): allow editing the inspected actor’s description alongside Playtest values. Apply updates the live actor card for the current session; Cancel edits restores the applied text and restart clears overrides. Keep descriptions scoped per actor and preserve numeric validation.

- Travel-first quest arrival (Eric, 2026-10-19): reveal Hero at opening camera arrival, then let the player drag the upper-left card onto the grid. Starting cave-exit travel automatically spins Find a way out from the projected destination grid into the upper-right quest slot before revealing traversal cards. Supersedes the opening Leave the den flight and manual cave-mouth pickup; preserve later pickups, pause, restart and reduced motion.

- Mobile quest previews (Eric, 2026-10-19): fixed quest cards use compact art thumbnails on phones and short touch screens; tap opens the full shared jumbo view. Preserve accessible instructions and the target locator.

- [Painted berry icons — art/presentation contract](./ART.md#contract-110).

- Sparse patch second berry (Eric, 2026-10-19): show two manaberries in tableau and map foliage. Add an optional buried berry behind a cover whose rank is illegal throughout Hero’s six-card route. Crossing still completes with one mana; the second fruit remains uncollected and visible. This supersedes the one-fruit sparse presentation while preserving the unfailable required route.

- Sparse Khad Roots quest pickup (Eric, 2026-10-19): place a glowing quest card beneath the final reachable berry 8. Collecting its manaberry exposes the card; clicking/tapping or keyboard-activating it replaces the active quest with “Khad Roots”: “Dark vines with dangerous-looking thorns have wrapped around parts of the bushes. Look elsewhere for more manaberries.” Preserve onward travel to the denser patch and existing pickup transitions.

- Khad Roots value coverage (Eric, 2026-10-20): per-card bindings support `obscureValue?: boolean`, off by default. Normal roots may cross card tops but never the value or reward; explicit opt-in adds a value-crossing vine and removes only the value clearance. Follow ART.md for upper-surface moonglow and varied curvature.
