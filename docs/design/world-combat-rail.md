# Playable world combat rail

The screen-space rail replaces the diegetic foundation/tableau prototype. Production Combat Woods creates no 3D card surfaces and never mounts `BattleTableauField`/combatsbx. The existing foundation layout remains at the sides, with six columns below. The surrounding layer has no background, tint, blur or modal backdrop; only individual card/control surfaces paint. Disabled cards are translucent. The 3D world remains rendered behind it.

The first playable woods update starts shared scenario 100 automatically, including default entry. Hero uses its original AP, HP, random deal and familiar kit, without musical preparation. Canonical receipts chip the enemy; it plays adjacent cards on its paced turn. The world enemy retains its Khadroot name and rig. Six-column normalization preserves every overflow card in stock and survives Withdraw redeals. Enemy contact no longer creates a second interface. Leaving the scene hides/suspends this encounter's UI/ticks; returning uses the same state. World movement and portal controls remain available. Pause remains explicit.

Select an eligible exposed card, then activate Hero's highlighted foundation. `receiveWorldRailCard` rechecks card identity, exposure, turn and receiver legality before invoking `playCard`. Rank, AP pips and the actual deck update together; a brief card flight links source and recipient. Native buttons support mouse/touch and Tab/Enter; covered, stale and illegal plays do not change state. Familiars opens compact controls for canonical value swaps, tier feeding, targeted one-use casts, upkeep and farewell/cooldown dismissal. Withdraw selects an actual row; End turn uses the canonical handoff. AP has a pip meter with an accessible current/max value. Card faces retain 63:88 proportions, including uniform scaling during flight. UI rerenders are keyed to displayed state rather than every battle-clock tick.

## Free and re-place Flurry

Both her inventory introduction and saved placement view offer Unstick Flurry. Detaching saves the existing reward as `available`, preserving the pickup and allowing the placement flow to reopen. Closing the inventory leaves her free. Re-placement selects one enhancement through the existing band and confirmation process. Detaching does not refund previous HP/AP or erase already-resolved effects. Same-tab events and storage changes synchronize the active rail and companion. No duplicate pickup is granted.

## Companion and released snow

The attached companion reuses the actual body/expression textures at .21 m, about one Hero ear. She bobs beside Hero, using Hero's heading as the base for her independent slow spin and existing curious/playful animations. Yaw-only readability preserves a vertical plane even at high cameras; front-side face culling prevents mirrored faces on the ice back. The original collectible uses the same upright, one-sided-face rule. It remains an independent world prop.

Each released flake retains world-space position/velocity after the emitter moves. At terrain contact it becomes a small horizontal settled flake with a roughly 35-second melting lifetime. Each owning scene has one depth-tested instanced batch containing at most 64 airborne and 160 settled flakes, with three scene pools maximum. Leaving a scene does not drag its old snow through the portal. Unsticking stops emission while existing snow finishes falling/melting. No new lights/bloom/captures are added; reflection captures skip these small batches. World/manual/inspection pause holds their clock. Reduced motion suppresses decoration movement.

## Validation

TypeScript and focused tests cover entry-started state, receipt legality/stale-card rejection, six-column deck preservation/redeal, AP changes, unstick persistence, ear-sized placement, yaw-only front/back facing, released trajectories, terrain contact, pool limits and melting. The isolated headless run used the actual woods, Hero atlas, live rail, sticker reward UI and companion renderer. It verified automatic activation with no combatsbx DOM, keyboard receipt/AP pips, pause blocking, transparent backing, unstick and re-placement, single-sided face material and vertical normal, and actual ground accumulation. It reported no page or shader errors.

The shared layout check found no defects at 1280×720 or 1912×914. Normal and 3× rail/portrait captures were visually reviewed. Evidence: `artifacts/world-rail-live-check.json`, `world-rail-live.png`, `world-rail-live-wide.png`, `world-rail-pips-3x.png`, and `world-rail-cards-3x.png`. Browser work used a focused scene fixture; a fresh full book/portal arrival playthrough and physical controller/mobile checks were not repeated.

The older `world-foundations` layout files and early harnesses are historical experiment scaffolding. Current fixture: `/artifacts/world-rail-preview.html`. The earlier `tools/world-rail-live-check.cjs` assumes the superseded 001 opening; use `tools/world-rail-100-check.cjs` for 100-series validation. Production: `/portals.html`.

## 100-series and mixed-paint follow-up validation

Typecheck and 18 focused tests passed (rail/100 parity, familiar rules, six-column preservation and Khadroot pigments/hurt recovery). Browser checks measured 63:88 card faces at widths 640, 900, 1280 and 1912, plus a uniformly scaled receipt flight. They exercised Riv's Surge, Cir familiarization, feeding to Rare and dismissal/cooldown. The receipt test authors one legal exposed rank in its isolated fixture because a random canonical opening may have none. Normal 1280/1912 rail captures and the close Khadroot paint capture were reviewed.

The browser script stopped at its material-count assertion: its constant Math.random override gave every Three.js material the same UUID. The independent rig test uses material IDs and confirms all four pigments. The harness now uses a seeded sequence; it has not been rerun after the permitted corrective browser run. Final layout assertions, error summary and new 3x capture remain incomplete. A subsequent CSS correction keeps disabled card faces opaque while the rail backing remains transparent; that correction has not been browser-reviewed. Captures: artifacts/world-rail-100.png, world-rail-100-wide.png and khadroot-mixed-paint.png.

Khadroot reuses worldMixedPaint's continuous normalized brush field with original-color preservation. Texture is applied to diffuse pigment before scene lighting, preserving emissive fissures and the hurt flash. No extra meshes, lights or per-frame texture updates. Brush/field textures are disposed with the rig.
