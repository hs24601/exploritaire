# Exploritaire development baseline

This document records agreed project preferences and behavior from the Proto development conversations. It guides implementation and review; it does not replace the user's latest instructions or establish requirements for unrequested features.

## Scope and workflow

- Target Proto unless the user requests another variant or broader scope.
- Build reusable components and shared behavior where multiple game objects need the same functionality. Avoid accumulating object-specific fixes for common problems.
- Preserve unrelated changes in the shared workspace.
- Treat obvious visual defects as implementation defects: overlapping labels, distorted cards, escaping text, clipped controls, and improperly rendered stacks should be caught during development rather than delegated to the user to discover.

## Presentation

- Use a dark board-game aesthetic with pixel typography, strong borders, high contrast, and consistent 2D depth and shadows.
- "Card" means a portrait playing-card-sized/aspect-ratio object, not an arbitrary rectangular panel. Use a locked playing-card ratio (63:88 by default); an established explicitly authored card ratio must also remain locked. Wide panels and variable-proportion surfaces are board pieces or objects, not cards.
- Maintain card aspect ratios. Available layout space must not distort resource cards, foundations, quest cards, or detail cards. Fit the entire stack by adjusting uniform card scale and overlap offsets, never by independently resizing a card's width or height.
- A stack contains full-size cards. Every underlying card retains its normal dimensions, aspect ratio, border, and corner radius. Use positional offsets and layer order to reveal portions of those cards. Upper cards physically cover the borders and corners beneath them. Never render an underlying card as a shortened, independently rounded horizontal band.
- Apply the stacking rule to existing and future card-stack components, including quest stacks and tableau stacks, while preserving each stack's intended exposed edge and interaction order.
- Keep text inside padded object boundaries. Wrap at word boundaries where possible and handle long unbroken text safely.
- Text-fitting components must define a readable minimum and maximum size. Do not shrink indefinitely or allow copy to escape its parent. If content cannot fit at the minimum, provide an explicit contained fallback with access to the full text.
- Minimum game text size: **16 CSS px (12 pt)**, including secondary labels, counters, instructions, and text-fitting floors. The prior quest subtitle was 12 CSS px (9 pt); this raises the floor by 3 pt, meeting the requested increase of at least 2 pt. Responsive rules must not reduce text below this floor. Adapt layout rather than shrinking text; review existing smaller text against this baseline when changing its component.
- Tile names stay stable as the camera zooms; zoom must not replace names with initials or different copy.
- Game layouts must not use scrollbars. Allocate space according to content needs, using available tableau space for foundation content. For genuinely constrained views, use deliberate reflow or navigation rather than hiding inaccessible content or merely concealing scrollbar chrome.
- On mobile, use Table / Tableau / Quests panel navigation so each field receives usable space without vertical page scrolling. Preserve all seven tableau columns and check portrait and landscape layouts in isolated headless browser tests.
- Inside each actor's foundation border, the energy bubble (⚡ and the actor's current energy) and the collected-cards count stack in a column to the left of the actor's card; the border widens to hold them. Resources collected during tableau play are listed beneath the foundation as icon and count pills (uncollected ones dimmed); there is no separate resources badge.

## Interaction

- Suppress the browser context menu throughout the Proto document. Development builds provide a custom context menu for future object inspection/actions; production builds suppress the native menu without exposing developer tools. The initial `dev` entry is a disabled placeholder. Dismiss on outside interaction or Escape and keep the menu inside the viewport.

- Dragging table objects, including cards and tokens, must not pan, zoom, or otherwise affect the camera.
- Distinguish clicks from drags. An actor click opens details; a completed drag must not open the viewer.
- Provide keyboard activation and visible focus for interactive objects where appropriate. Dialogs support dismissal and restore focus.
- Every user input is built for both touch and mouse. Drags, holds, taps and clicks use pointer events (or equivalent handling for each input type), work with a finger on a phone as well as a mouse on desktop, and set `touch-action` so a touch gesture on a game object does not scroll or zoom the page. Automated checks exercise touch as well as mouse for each new interaction.

## Crafting and actor progression

- The table is a clear 15x15-cell square around True Center. Every cell outside it is impassable terrain, drawn for now as black placeholder tiles; a world map will theme them by biome, and golf will open some of them up. Actors, quest cards and placements never land on terrain. Table-level lights (lamps, carried candles) never reach terrain or pass through it; terrain takes only sun, moon and sky light (`worldBounds.ts`, `tableLightReaches`).
- Leave Tableau steps each actor out onto the free table cell touching the biome tile, nearest the middle of its bottom edge.
- Returning expedition actors deposit collected resources into the settlement supply tray, with visible token flights into labeled counters, instead of spilling loose resource stacks onto the table.
- Stored supplies and table ingredients must not be spendable twice. Drawing supplies debits storage and creates a deliberate crafting stack. Camp construction consumes deposited supplies; pending expedition haul is not settlement stock.
- Craft by stacking eligible resource tokens and advancing a build timer. Do not introduce a workbench.
- Keep crafting composable and recipe-driven: declare ingredient eligibility, quantities, output, build time, and applicable staffing, stamina, or solitaire requirements.
- Recipes can require solitaire work alongside timed progress. Appropriate buildings can require an actor stationed within their foundation and actor stamina to perform that work.
- Support low-tier food combinations into rations, consumption by actors, and a Well Fed effect supporting recovery and exploration.
- A provisions hut can use the same ingredient sourcing to produce enhanced outputs through actor staffing and solitaire effort.

## Pond and fishing

- The pond is the first water biome: a 1x1 water tile with pixel-art cattails as its pop-up scenery (`public/assets/biomes/pond_reeds.png`, drawn by `tools/make-reeds-sprite.py`), one cell down and left of the Hero's starting cell, so it is in the starting view on desktop and phone portrait and clear of where quest cards land. Reaching it costs no stamina. It has no tableau; with the pond selected, the tableau field shows the pond panel (`PondField`).
- Fishing has two phases: a Go Fish hook (luck) and a fight (skill). Each fishing event, from cast to the catch landing in the tray, stays under ten seconds.
- The hook (`rules/fishing.ts`): the pond hides six fish (the water) with four more in the school below; the angler holds four bait cards from a tin of sixteen. The fish keep the card motif: they lie face down in the water as cards (the established 56:74 tableau card shape), each back showing a ripple sized to its band and the band itself (A–4, 5–9, 10–K). Casting is drag and drop: drag a bait card (mouse or touch) into the pond, which lights up as the drop target; a tap or click on bait only explains how to cast; keyboard players press Enter on a bait card, then Enter on the pond. A matching fish bites and is hooked (one fish per cast) and the fight begins with the bait tethered by a fishing line. No match ("Go fish!") loses the bait and costs 1 stamina, and fish one rank away (golf adjacency, A and K wrap) nibble and flip face up. Casting needs that stamina. Every cast spends its bait and draws a fresh one; missed bait ranks dim until the water changes. The line holds ten casts a day, fewer than the tin holds bait; the opening hand always holds two bites; the pond restocks each new day. Fishing needs an actor stationed at the pond.
- The fight (`rules/fishFight.ts`, `FishFight`) is a Stardew-style fishing meter played with cards. The meter has nine notches; the hooked fish swims between them and the catch zone must stay on it. The cast bait is the line card. Playing a reel card one rank above the line card (+1, marked ▲) lifts the zone a notch; one rank below (−1, ▼) drops it; others do nothing; A and K wrap. The played card becomes the line card, so the + and − cards change with every play. Reel cards play on press (pointer down, touch or mouse), on Enter, or with the arrow keys.
- The fish is smart about the hand: on each beat it turns to a notch that a card in the player's hand answers, measured from where the zone is (one notch, or two in a dash when the hand holds a two-card run that way). Fish and zone glide at the same speed, so a perfect player, or an auto-solve ability or item playing the answering card at once (`solveFight`), keeps the fish dead centre and lands it in the time the catch bar takes to fill (about four seconds). The skill is reading the hand quickly, never counting cards. The hand holds four cards drawn near the line card, always at least one playable, and a fresh card usually fills a missing direction.
- The zone adapts to the player: each beat the fish stayed inside it tightens the zone a little; each beat it slipped out widens it, within each fish's limits (always under two notches, so a fish one notch off is out). Bigger fish turn sooner, glide faster, dash more and start with a tighter zone. In the zone the catch bar fills; out of it, it drains. Empty, or eight seconds on the line, loses the fish, which stays in the water face up. Unit tests simulate players with different reaction times to hold the balance: the auto-solve never lets the fish out, quick readers land everything, typical players land every fish below a king and over half of Kingfish, slow readers handle the small fish, an idle angler rarely lands one.
- Each rank is its own species, smallest to largest (`rules/pondSpecies.ts`): A Minnow, 2 Shiner, 3 Bluegill, 4 Perch, 5 Crappie, 6 Trout, 7 Bass, 8 Walleye, 9 Carp, 10 Pike, J Catfish, Q Sturgeon, K Kingfish. Eating one restores stamina to the party and the actor by size: A–4 +1 (these count toward rations), 5–9 +2, 10–Q +3; the Kingfish is a feast that restores both in full. Species share the fish glyph for now (the Kingfish has its own); catch pills name the rank and the supplies show the name on tap.
- A landed fish is rewarded at once, as its species: it flies from the meter into the catch tray, which sits beneath the cards in the same pill style as a foundation's collected resources and counts it when it lands (`pondCatchFlight.ts`; reduced-motion users skip the flight). Rarer offerings come from luck rolls on landed fish, not from ranks: for now, one landed fish in five also brings up a glowfish. Caught fish join the haul and reach the supplies when the actor leaves; pond catches only appear in the supplies tray once there are some.
- A glowfish lying on the table lights its spot to "dim" with a cool cyan light and no lamp token. Eating a glowfish (drag it onto the actor) gives +2 max stamina, restores 3 stamina, and raises the actor's carried light to 0.6 in the same cyan, enough to light their surroundings; the glow ends when the day ends. `tools/pond-fishing-playwright.cjs` checks mouse, touch and keyboard casting and fighting, that the fish turns where the hand can follow, event length, species, the luck roll, the glowfish light, eating and the pond and fight layouts.

## Quest cards

- Present quests in a physical tray with three identically sized foundation-style quest slots whose outer borders retain the portrait 63:88 playing-card aspect ratio. The slots must never stretch to fill a tall grid track; scale width and height together. Slot 1 holds the current expedition chain as a compact deck of full-size cards; slots 2 and 3 are visibly disabled scaffolding. Queued cards are almost fully occluded, rather than cascading beneath the active card. The compact deck identifies the selected quest; its readable title, objective and reward appear in the tray detail area below (beside the slots on short landscape screens).
- Place the title at the top, instructions beneath it, and rewards at the bottom.
- Clearly distinguish incomplete objectives from completed objectives ready for redemption.
- Completing an objective does not automatically redeem it. Holding a completed active card for one second grants its reward once and reveals the next quest card.
- Record accomplishments so moving away or losing a temporary buff does not revert a completed objective awaiting redemption.
- Completed active quests fly from the tracker onto free table space near their quest location. Hold the landed card for one continuous second to redeem its reward and expose the next tracker card. On redemption, flip and fly the table card to the quest tray discard pile, then remove it from the table. If the tray is stowed, fly toward the approximate off-screen discard location without opening the tray. Redeemed quest data supplies the discard count. The discard pile is a compact card icon with a count in the tray controls row, with the tray toggle aligned at the right. Discard flights target the icon after redemption layout updates, rather than capturing a stale pre-redemption position.
- The tableau field provides a Leave Tableau button for stationed actors, using the same return/resource-deposit behavior as dragging an actor out.
- The first quest chain uses all seven tableaus and maintains a reliable, completable happy path with sufficient resources and progression opportunities.

## Established quest component contract

- `QuestField` accepts an ordered `quests` array, optional field `title` and `subtitle`, `onRedeem(questId)`, and optional `onClose`.
- Each quest supplies a stable `id`, `title`, objective `text`, `status` (`incomplete`, `complete`, or `redeemed`), and a `rewards` array. Rewards currently use `{ kind: 'stamina', amount }`.
- Counts are derived from the array: total, incomplete, complete awaiting redemption, redeemed, and accomplished (complete plus redeemed). Do not supply contradictory independent counts.
- The first unredeemed quest is active. Later quests render as opaque full-size cards beneath it. An empty field and a fully redeemed chain have explicit states.
- `QuestCard` presents the active title, objective, completion state, and bottom-anchored stamina reward, and invokes its redemption callback only when complete.
- `PlayingCardStack` owns shared 63:88 geometry, uniform sizing, overlap, and layering. Verify its rendered surfaces and occlusion with isolated headless Playwright, not sizing math alone.

## Details Card Viewer

- Use an object-agnostic component that can represent actors now and other game objects later.
- General layout: name at the top, a circular badge to its right, art in the center, descriptor beneath the art, and extensible trays below the descriptor.
- Support actor inspection on the table and in foundations. Keep inspection separate from dragging.
- Present details as a nonmodal floating playing card to the right of the inspected object, above the table. Reposition near viewport edges to keep it visible; use the light engine for its elevated shadow. Do not use a full-screen backdrop or centered zoom presentation.

## Solver tools

- Tableau fields expose Auto-Solve and Best Move controls in their lower-left area, with a Divine Intervention checkbox.
- Normal mode applies the same RPG constraints and costs as human play.
- Divine Intervention ignores RPG constraints and does not decrement actor values.
- Tableau-to-foundation card flights use the auto-solve speed for manual plays too. While a manual exploration play is in flight, the tableau already shows where it lands, so the next eligible card can be clicked at once; the flying card lands immediately and the next one takes off. `tools/card-flight-playwright.cjs` checks it.
- A Guidance checkbox sits right of Divine Intervention and is off by default. Only while it is checked do playable tableau cards (and ready encounters) get the eligible-move highlight; a card picked for targeting stays highlighted either way. The highlight is the gold outline; no theme rule may outline a card just for being playable. Guidance works without a staffed foundation.
- All solver controls, including Divine Intervention, require an actor stationed in the applicable foundation. Disable them when unstaffed and stop an active solver if staffing is lost.
- Auto-Solve and Best Move use visible card-flight animations. Main tableau moves apply on landing; solver sequencing waits for the current flight.
- Use deterministic reasoning for authored seeds and bounded Monte Carlo-style assessment for random deals.
- Keep solver interfaces extensible for future limited-use guidance effects such as Astral Guidance.

## Lighting

- Preserve the day/night scaffold, moving global light source, local table lights, and consistent object shadows.
- Keep lighting compatible with 2D rendering and object interaction.
- The default table has no placed light object. Actors carry their own light through a `luminosity` property (0-1). The default is candlelight: enough to find an actor in the dark, but never enough to explore by (it lifts its surroundings only to "dim"), and it fades out in daylight.
- A carried light moves with its actor every frame of travel, never jumping to the destination when the move ends.
- The light wash is all soft gradients, so it paints at reduced resolution (half a CSS pixel flat, a quarter tilted). Full-resolution flicker redraws of the oversized tilted plane stall input and slow reward holds on phones.
- The table opens at 09:00 (`TABLE_OPENING_HOUR`), and every later day starts at 09:00 too.
- The time slider must track a dragging pointer smoothly, even on a slow phone: the clock text beside it has a fixed width so the slider never shifts as the phase changes, and the table re-lights at most every 120ms during a drag as an interruptible update. `tools/time-slider-playwright.cjs` checks it.
- In the flat camera the view is straight down, so an actor with sprite art shows only as its pop-up seen from directly above: the thick corrugated-cardboard top edge of the board (kraft liners on both faces, fluting between), as wide as the cut-out, standing across a round base, plus the shadow the cut-out casts. The art itself isn't visible from there. It falls back to the token if the art fails.
- In the tilted camera, an actor with sprite art (`WORLD_ACTOR_SPRITES`) stands up as a pop-up cut-out instead of the cardboard token: padding trimmed so its feet meet its base, pixel-sharp, shaded by the light reaching it with a warm rim toward the strongest nearby lamp, and casting its silhouette away from the sun or moon and each lamp (never from its own carried candle). Art that fails to load falls back to the token. The same art is the portrait on the actor's details card.
- Tilted pixel-art standees (actors, biome pop-ups and edge scenery) stay sharp at every zoom. The browser rasterizes 3D layers at their layout size and stretches them with the camera, so each standee is laid out `STANDEE_OVERSAMPLE` (4) times larger and scaled back down inside its own 3D transform. `tools/standee-sharpness-playwright.cjs` checks it.
- Standees rotate about their foot before being placed, and the camera zooms in 3D, so pieces stay planted on the table at every zoom level.
- Biome tiles can carry pop-up scenery (`BIOME_TILE_SPRITES`): Small Woods shows a cluster of pixel-art pines (`public/assets/biomes/small_woods_pines.png`, drawn by `tools/make-pine-sprite.py`). Tilted, the pines stand at the back of the tile, taller than the Hero, so the tile's label stays readable in front; flat, only their board edge shows across the top of the tile. The tile itself is their base. Tapping or dropping a piece on the pines counts as the tile. `tools/biome-popup-playwright.cjs` checks it.
- Camera direction (Eric, 2026-10-07): the flat top-down camera is the physical tabletop with physical pieces; tilting the camera immerses the player in the world, so tilted presentation favours depth over the board-game look. Flat stays the tabletop.
- Tilted, biome tiles are lined with scenery down their left and right sides and, shortened, along their front edge (the pond with reeds, the woods with young pines and ferns; drawn by `tools/make-edge-scenery-sprites.py`, laid out by `biomeEdgeScenery.ts`). The props shrink toward the camera. None may cover the tile's label: the label reports where its text sits, and a prop in front of it steps outward to clear it, is cut down to the height that clears it, or is left out. Flat tiles carry no edge scenery. `tools/biome-popup-playwright.cjs` checks it.
- Tilted ("immersion") lighting aims for an HD-2D look (Octopath Traveler, Sea of Stars). Lit pixel art, meaning actors, biome pop-ups and edge scenery, catches the strongest nearby light: the side facing it glows in the light's colour and the far side falls into shade (`LightWash`, masked to the sprite's pixels). Each edge prop is lit and casts shadows where it stands. Tilted biome tiles sit just above cut-out shadows, so no shadow falls across a label.
- Tilted ambiance (`atmosphere.ts`, `TableAtmosphere.tsx`): a glow hangs in the air around each lamp and carried light, flickering with it. Sun shafts slant across the view, faint at noon and strong at golden hour, with dust motes drifting through them by day. Everything is anchored to the world: shafts are pinned along the table's x axis and motes are scattered per world cell (only the cells in view), so they pan and zoom with the table. Each biome's particles come from `BIOME_AMBIANCE` (one line per effect: kind, count per tier, patch around the tile); world-wide effects come from `WORLD_AMBIANCE`. Mist and smoke sit behind a tile so they never cover its label. Cool moonbeams fall after dark. Fireflies come out over the woods and pond from dusk. The pond fizzes: glints by day, glowing bubbles at night. It is all a few small elements animated by CSS transform and opacity, never takes input and never feeds game rules. The low tier (`?fx=low`, reduced motion, or a small device) keeps halos and rays and drops the particles and prop shadows; `?fx=high` forces the full set. Flat has none of it. `tools/tilt-ambiance-playwright.cjs` checks it.
- Cardboard pop-ups are thin board: the top-down board edge is 3.5 table px and token standees have a 1.5px die-cut edge.
- While a piece is dragged across the table, a biome that would accept it glows gold with a pulsing outline; the cue clears when the pointer leaves it or the piece is dropped. `tools/drop-target-playwright.cjs` checks it.
- Pop-up shadows are the shadows of a flat board facing the camera: the base stays on the piece's foot line and the silhouette leans away from the light (a shear, never a rotation about the foot), so wide pieces like the pines cast from their trunks.
- Switching between Flat and Tilt eases the camera both ways (about half a second) instead of snapping: the table and its light wash lean together, the table never shows its edge mid-move, pieces pop up from their bases halfway into the lean and fold back to their flat boards halfway out. Reduced-motion users get an instant switch. `tools/tilt-animation-playwright.cjs` checks it.
- The camera tilt also applies to the tableau field, like a battle camera seen from behind the player: the tableau leans back from its front row, back rows shrink toward the horizon and soften with a depth-of-field blur, and the front row stays sharp and playable. Flat restores the 2D tableau.
- The camera tilt also leans each foundation card back, and an actor with sprite art pops up from the top edge of its actor card, standing above the card so it never covers the energy bubble, card count or resource summary. The foundation makes room above for it (less on short screens).

## Temporary scaffolding

These are current implementation defaults for iteration, not permanent game-design requirements:

- Each expedition quest currently awards +1 STA, represented by a lightning/energy bolt. Quest bonuses can exceed the normal resting cap so redemption at full stamina does not waste a reward. The reward also reaches the actors: each actor's own stamina (up to its cap) and the party's energy.
- Actor detail art is a temporary pixel-style portrait.
- DCV Stats, Equipment, and Buffs trays are placeholders awaiting further design.
- Auto-Solve and Best Move initially serve developer testing.

## Validation and delivery

- Inspect relevant layout, sizing, overflow, layering, and interaction paths before delivery. Do not claim visual verification that was not performed.
- Enforce that inspection with the shared layout check (`tools/lib/layout-check.cjs`, used by `tools/tray-layout-playwright.cjs`) for every UI change, at desktop sizes down to 1280x720 and at phone portrait and landscape: no element may overlap another or a frame decoration such as corner studs, escape its container, clip its content, or render text under 16px. Also review a zoomed (3x) screenshot of each changed element; a defect the check misses gets a new check, not just a fix.
- Run checks appropriate to the change, including meaningful tests for reward redemption, progression, or other consequential state changes. Report pre-existing failures separately from regressions.
- Isolated headless Playwright testing is authorized for this project. Use a separate browser/context against the local app; do not control the desktop, move the user's mouse, steal keyboard focus, or interact with personal browser sessions.
- Ensure Vite is running for requested playtests and provide the verified local Proto URL.
- After completing a piece of work, leave it ready to playtest immediately: get the changes onto the user's PC checkout, make sure Vite is running there with the new code, verify the Proto URL loads, and report the local URL (plus the tailnet phone URL when available).
- Report what changed, what was actually checked, and material remaining limitations. Avoid treating a successful bundle build as proof of correct visual appearance.

- Quest tracking is a physical recessed tray. Stow moves the entire tray off-screen and releases its layout space to the table; the table Quest control brings it back. Do not merely hide cards inside a still-visible tray. Stowing preserves progression and the card queue. Only an accomplished quest can leave the tray and fly to the table; never use the next queued card as a flight source. After departure, the next objective is visible in the tray but remains there until complete. Pending reward redemption remains explicit.

- A stowed tray leaves a small handle on its viewport edge (quests right, supplies left): the tray's drawn emblem (a sealed quest card, a supply sack) above the same leather pull tab used to stow it, with no text label. Restoring from mobile opens that tray's panel.

- Quest rewards are redeemed only by pressing and holding the card on the table; the tray has no separate hold control. When the first quest card flies to the table, a teaching card ("Clearing quests", outside the quest deck) flies out beside it; holding it 1s clears it without a reward, and it does not return.

- The quest tray is one quest card wide plus its recess and frame. The active card lies face up in a card-shaped slot with its title, objective and reward readable at 16px; the two locked slots below it are identical in size to the active slot, each with a lock. The discard counter and the stow control share the tray's top row. The quest well never scrolls: the three identical slots shrink to fit its height (on phone landscape they sit in a row), and the face-up card clamps its title and objective to the lines that fit, ending in an ellipsis, with the full text in the toast. Tapping the active card also pins its text in a closable toast (`PinnedToast`).
- Reward holds last 2 seconds. Generous drift (12px mouse, 24px touch) is allowed before a hold turns into a drag. A touch long-press never opens developer menus. The hold fills the card from the bottom like a meter.

- Settlement supplies live in a slim, stowable tray on the left that mirrors the quest tray: one token and count per resource, no labels. Tapping a resource opens its details (category, held count, recipes that use it, Place 1 on table). Phones show it as a Supplies tab.
- Tray stow controls are physical pull tabs (a stitched leather strap with rivets), never arrow or media-style glyph buttons.

- Table zoom preserves the world point at the viewport center, including after panning. Wheel and pinch calculations must use the same centered coordinate origin as rendered table content.

- Actor destinations snap to a table grid square. Only the destination snaps: travel follows continuous diagonal segments with distance-based speed and obstacle avoidance. Biome entry and building staffing retain their designated positions. Continuous pathfinding routes around biome and building footprints with actor clearance; only intentional destination entry and departure from an occupied structure may cross that structure boundary. An unreachable destination must never produce a route through a solid object.

- Reward-hold diagnostics: opening the page with `?holdlog` shows a timeline of each hold (press, start, cancel and its cause, completion, redeem outcome, worst frame). Without the flag nothing is recorded or shown, so builds carry no dev UI.
- Completed table quest cards support pointer/touch dragging without camera movement. First interaction switches them to the shared table-card size (96 world units wide, locked 63:88 ratio). Drops are unsnapped, avoid biome/building footprints, and may settle with a small tilt. Reward holds show progress on the card, cancel on movement/release, support keyboard holds, and require one uninterrupted second before rewards and discard flight.

- For now, Hero details uses the shared default table-card screen size (96 world units × default 1.7 scale = 163.2 CSS px wide, 63:88 ratio). Its floating presentation remains independent of camera zoom. Compact tray icons and a contained descriptor preview preserve the text-size floor; full descriptor and tray labels remain available through accessible text and hover titles.

## Grid coordinates

- Shared `GridCoordinates` defines a stable grid ID, configurable cell size, fixed world origin, signed column/row indices, and named landmarks. Camera pan/zoom and responsive layout never alter cell identity.
- The table uses 48 world units per cell. `True Center` is cell `(0, 0)`, absolute reference `table:0,0`, and world center `(0, 0)`. Positive columns point right/east; positive rows point down/south. Cell boundaries are half a cell from their centers; boundary ties select the cell on the right/bottom.
- Use shared cell/reference parsing, world/cell conversion, region bounds and screen/world conversion helpers instead of adding object-specific offsets or hardcoded grid sizes. Actors snap to cell centers; freely placed cards retain fractional world positions and can still be associated with a containing cell.
- The table exposes an origin guide, pointer-cell reference readout, and True Center camera control. Object grid references remain absolute after moving the camera.
