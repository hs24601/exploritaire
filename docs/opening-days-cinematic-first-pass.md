# Opening days — cinematic first pass

This is review scaffolding, not final camera or color direction. It follows the existing Day 01/02 rails and the staged Day 03 morning without changing the saved world, resources, clocks, combat outcomes or day progression.

Open **Cinematic review** beside the scenario selector. It lists the current day's compositions and lighting intent. **Preview** replays camera framing only: actors stay in their real positions and the clock stays at the current story milestone. **Opening-day cinematics** turns the automatic first pass on or off. **Release camera**, map gestures and camera controls hand control back immediately. Restart replays that day's opening. Sandbox remains manual.

## Shot intentions

| Beat | Composition | Light |
| --- | --- | --- |
| Day 01 — A small home | Establish mountains and shelter, then push through the north-facing den entrance toward Hero | Existing muted morning and stone palette |
| Not enough nearby | Hero small beside the sparse bush, then a quiet reaction with the den in the background | Afternoon; first earned berry glow |
| Farther from home | A playable shoulder-height view at the denser patch | Existing afternoon greens |
| Three small lights | A closer food-versus-light decision, with room toward home | Existing late afternoon |
| Before the dark | Repeat the shelter composition with a closer return | Existing 17:30 milestone |
| One for tomorrow / rest | Stay on the open side of the den, close and still | Existing 19:00/21:00, remaining mana and the stone palette |
| Day 02 — Yesterday's light | A familiar den angle, closer this morning | Cool morning; retained food/light reserve |
| Almost picked clean | Hero and the last branches, keeping the deal accessible | Existing morning |
| Beyond the familiar | Close reaction, then widen toward departure | Existing 15:30; no reveal of distant woods |
| Under the canopy | A small traveler under tall trees, then a readable playable view | Actual woodland shadows and local lights |
| Banks rescue | Establish → hope → threatening reverse → Hero reaction → shared action axis → protective entrance → action wide → gentle two-shot → existing nuzzle/fade | Existing Three.js woodland lighting |
| Day 03 — Someone stayed | Familiar hollow, then a soft two-character frame that includes Banks | Existing 09:00 morning; no new full-day mechanics |

In story portraits, the objective label moves to a free corner, retaining its ground pin, grid reference and focus action. The idle story view removes the decorative grid and applies restrained viewport grading/vignette. This does not create emitters, change light sampling, advance the clock or uncover terrain. Editing, travel, disabled cinematics and sandbox restore the ordinary grid. Hero's thoughts reuse the authored scenario text, watercolor expressions and a few quiet word accents through Callout. They wait for player actions.

## Tuning

Map compositions are source defaults in `src/proto/dayCinematics.ts`, resolved from actual applied landmark positions. They appear as named sequences in **Camera choreography**. Save a change as a local override; **Reset first pass** removes the override and restores the source default. Built-in defaults are not copied into localStorage. User-authored callout edits and matching camera triggers take precedence.

`framing` is an optional fraction of viewport height below center; it reserves room for Hero's head and speech. Capture and the shared shot fields retain it. A value of `.24` shifts the shot's ground aim down by 24% of the viewport height. Scale, yaw, pitch, hold and flight timings remain editable through the existing system.

The native Three.js rescue shots live in `src/proto/dayRescueShots.ts` and are selected by the existing cinema beat IDs. They use the existing camera's smooth orbital transitions, preserve manual takeover, pause their authored camera clock while paused/hidden, and cut under reduced motion. They do not invoke the combat demo's unrelated scripted action sequence. The paired watercolor nuzzle and final fade are retained.

The review previews intentionally do not manufacture future actors or story state. To assess the complete lighting, acting and dialogue of a later beat, play the scenario normally. Day 03 remains a morning staging scene. Assets, scenery arrangements and gameplay rules are unchanged.

## Validation of this pass

Type checking and 29 focused tests passed, including world preservation, scenario rules, source-default overrides/reset, camera sampling and rescue cues. Live Day 01 gathering, supper/rest and carried light passed. The native rescue fixture passed hope/cower/Banks/safety shots, pause, the legal AI run, nuzzle and completion. The complete Day 02-to-03 path passed at the existing low-effects tier with a longer travel wait. The high-effects software-browser run exceeded its original 45-second travel wait; it is not a performance pass. Desktop 1280×720 and 1912×914 checks passed for the review UI, callout layout, source override/reset, toggle, Day 03 actor/objective clearance and sandbox preservation; 3× captures were inspected.
