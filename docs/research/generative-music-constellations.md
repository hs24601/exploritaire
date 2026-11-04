# Generative music and constellation skybox

Research for Eric, 2026-11-04, from the "Explore generative music constellation skybox" thread. It reviews the Emergent Mind "Generative Music" visualization (<https://www.emergentmind.com/visualizations/generative-music>), then assesses (1) borrowing its music-to-visual mapping to light paths between stars in Exploritaire's night skybox as constellations, and (2) what it suggests for our instrumentation (the synth voices and audio routing).

Code checked against `refactor/proto-components` at `0328b2b` on GitHub. Uncommitted work on the PC may differ.

## Summary

1. **The technique is a good fit and cheap.** The demo is pure Web Audio (oscillators, filters, envelopes, generated reverb) plus a 2D canvas. No samples, no libraries. Its core visual idea is a fixed mapping from pitch to position (pitch class to an angle on the circle of fifths, octave to radius), so every note has a place and a phrase draws a path. That maps directly onto a star dome.
2. **Best hook: a run of card plays draws a constellation.** Golf solitaire runs are already ±1 steps. Map rank to a scale degree and every run is a rising or falling scale melody. Each play lights the next star of a constellation and draws the line to it. A long run completes the figure and plays its motif. This makes the sky a record of the night's good runs, without touching rules.
3. **It is cosmetic only.** Constellations never feed `protoLighting.ts`, rules or rewards. The tilt camera is the only view with sky, so flat view loses nothing it needs. A low tier draws static lines with no bloom.
4. **Proto has no sound today.** `src/audio/gameAudio.ts` has a synth card-place sound, but nothing in `src/` calls it (the only other audio is Golf's mp3 Navi lines). So "changing instrumentation" is really "choose a first palette". The demo gives a solid one: pluck, pad, soft bass, melody, a generated reverb and a dotted-eighth delay, with mode and brightness as the expressive controls.
5. **Recommended first slice (about a day):** pitched card plays (rank to scale degree, combo to brightness and harmony) through a reverb/delay bus, plus one constellation that lights star by star on a run in tilt view at night. Hear and see it before building the ambient pad or more figures.

## What the demo does

The page shows rings and ripples that bloom per voice, a radial spectrum, and a small sky of drifting stars. Pointer x picks the mode, pointer y the tempo. The source is minified; the details below come from reading it.

**Music**

| Part | How it works |
|---|---|
| Key and mode | Root D. Five modes from dark to bright: Aeolian, Dorian, Mixolydian, Ionian, Lydian (pointer x). |
| Harmony | Seventh chords stacked on scale degrees. One chord per bar, 4-bar loops picked from a "bright" or "dark" pool. Every 32 bars the root may move up a fourth. |
| Time | Sixteenth-note grid, 74–116 BPM (pointer y; idle wanders 80–104), 8% swing. Scheduled 0.12 s ahead on `audioContext.currentTime`. |
| Sections | Every 8 bars a density level picks full, light, or sparse (no drums or bass, 22%). |
| Melody | 2-bar phrases from rhythm cells. Steps of ±1 (70%) or ±2 degrees. Strong beats snap to chord tones; the last note resolves to the root. Phrases rotate echo, echo, contrast, cadence, so motifs repeat with variation. |

**Voices**

| Voice | Synthesis |
|---|---|
| Pad | Two detuned sawtooths per chord tone, lowpass sweeping 380 → 1100 → 500 Hz, slow attack, once per bar. |
| Bass | Triangle plus a sine an octave down, lowpass 900 → 260 Hz, short pluck. Approaches the next chord's root at bar ends. |
| Arpeggio | Square wave through a resonant lowpass, 3200 → 500 Hz in 0.16 s: a pluck. Up, up-down or a fixed pattern. |
| Melody | Triangle plus a quiet sine an octave up, 5.2 Hz vibrato fading in. |
| Drums | Sine kick (130 → 42 Hz), filtered-noise snare and hat. |
| Effects | Convolver reverb with a generated 3.4 s noise impulse (no file). Dotted-eighth feedback delay, lowpassed. Compressor on the master. Per-voice pan and send levels. |

**Visual mapping**

| Sound | Picture |
|---|---|
| Any note | A position: angle = pitch class on the circle of fifths, radius grows with octave. |
| Melody note | A comet springs toward the note's position (stiffness 40, critically damped) leaving a 140-point trail, plus three staggered ripple rings (0.12 s apart, cubic ease-out). |
| Arpeggio | Short sparks and a ray outward. |
| Current chord | A faint polygon joining the chord tones' positions, and glow sprites on them. |
| Mode | 12 ticks on the ring; in-scale pitch classes are brighter. |
| Kick | Global pulse: background glow, ring scale, stars pushed outward. |
| Snare / hat / bass | Expanding ring, step dots, low wave bands. |

Colour comes from the chord's root (a hue per degree, darker in minor modes); each voice offsets that hue.

**What to take:** the fixed pitch-to-place mapping, the comet-and-trail way of drawing a path from one note to the next, staggered ripple rings, the chord-as-polygon idea, mode as the main mood control, and the generated reverb. **What to leave:** the neon hue cycling and kick-driven screen pulse (they fight the board-game look), and the drum kit for exploration.

## Fit with the current sky

`src/proto/components/StarfieldSky.tsx` already draws a fixed celestial hemisphere: 2400 seeded stars on a dome, projected through the tilt camera's pitch and yaw, faded in by `atmosphereSky(...).night` (or forced on by dark story moods). It is event-driven, redrawing on camera frames with no animation loop, and returns early when the camera is flat. That is a good base:

- The dome is fixed, so constellations can live in dome coordinates and stay put as the player pans and zooms.
- Stars only show at night and in tilt, so constellations inherit both rules.
- Animation needs a loop the sky doesn't have. Put constellations on their own small canvas layer that runs `requestAnimationFrame` only while a line or bloom is animating, then stops. The static result redraws with the sky on camera frames.

GAME.md's effects budget (2026-10-25, `fxQuality.ts`) says many-instance effects must not use per-element CSS blur or keyframes. Glows should be one pre-rendered sprite drawn with `drawImage`, as the demo does.

The actor inspect overlay already has a "constellation" skill tree (`definition.constellation` nodes and links in `src/engine/types.ts`). It shares the word only; the sky feature should not reuse that type, to avoid coupling a skill tree to a backdrop.

## Idea 1: runs draw constellations

**Core loop**

1. Each card that lands on a foundation plays a note. Rank picks the scale degree: A = degree 0 (the root) up to K = degree 12 (the sixth, an octave and a half up). A run of 5-6-7-8 is a rising scale; a falling run falls. The K–A wrap jumps back to the root, which reads as "starting over".
2. While the sky is visible, the run lights an authored constellation star by star. Play 1 lights the first star with a ripple. Each later play draws a line from the last lit star to the next one, as a short comet: the head travels the edge in about 250 ms and leaves a thin line behind it. The note sounds as the head arrives.
3. When the run lights every star in the figure (a 5–9 star constellation needs a run that long), the figure completes: its lines brighten once, a short melody motif plays (the constellation's "name tune"), and it stays faintly lit for the rest of the night, then fades at dawn.
4. A broken run leaves its partial lines, which fade over a few seconds. The next run picks up the next unfinished constellation, so the sky slowly fills through a night.

**Why runs, not free composition:** the player's own play drives both the tune and the picture, so it feels earned and reactive. It matches the satisfying-run feel already in combo Momentum. It needs no new input.

**Where stars sit.** Two options:

- *Authored figures (recommended).* Each constellation is a small list of points in dome coordinates (azimuth, altitude), drawn as slightly brighter stars on top of the seeded field, plus an ordered path. Authored shapes can be recognisable (a fox, a lantern, a fish, Hero's den) and tie into biomes and quests later. They don't break if the seeded star count changes.
- *Pitch-placed stars (the demo's literal mapping).* Place each note on the dome: azimuth = pitch class on the circle of fifths, altitude = octave. Any phrase then draws a true picture of its melody. Truer to the demo, but shapes look random, and the same scale run always draws the same zig-zag. Better saved for a special "music of the spheres" moment.

A middle path keeps the demo's spirit inside authored figures: give each star in a figure the note it would have under the pitch mapping, and author the figure so that stepping along it moves up or down the scale. Then a rising run visibly climbs the figure.

**Chord shapes.** The demo's chord polygon suggests a second, ambient layer: when the background pad changes chord (see below), a very faint triangle or quad joins the current chord's stars. Optional, and High tier only.

**Look.** Pale gold or silver-thread lines, not neon; the stars warm slightly when lit. That keeps the brass-and-felt tabletop look, and in tilt reads as an immersive night sky. No line or glow crosses text; the sky sits behind all scenery (z-index −1) already.

**Quality tiers**

| Tier | What draws |
|---|---|
| High | Comet heads with trails, three-ring ripples on lit stars, glow sprite on completion, faint chord shapes. Loop only while animating. |
| Low (phones, reduced motion, slow frames) | Lines appear at once at their final alpha, lit stars get a static brighter dot, no ripples, no loop. |
| Flat camera | No sky, so nothing draws. Sound still plays. |

**Gameplay boundary.** Constellation progress is presentation only. It is not a light source in `protoLighting.ts` (so Light % and light rules don't change), not a reward, and not a quest condition. If you later want named constellations as collectibles (a star chart in the journal, say), that becomes a game rule and needs a non-visual record such as a journal list, so it works in flat view and on the low tier. That is your call; this report doesn't assume it.

**Risks**

- A run's notes must sound at the moment of the play. Never wait for the beat or for the comet; the line animation follows the sound, not the other way round.
- In combat, many plays land fast. Cap one comet in flight per foundation and let later plays snap lines in, so it never queues behind the player.
- Sky visibility depends on camera pitch. If the sky is off screen, light the stars silently (state still advances) so the figure is there when the player looks up.

## Idea 2: instrumentation

Today Proto is silent. `gameAudio.ts` has one voice (a triangle thunk with a click and noise, pitch rising in raw Hz with combo, a thud at combo 5 and a fifth above at combo 10) and a mute flag, but it isn't wired in, and its Hz-based rise drifts off any scale. The demo suggests this palette:

| Role | Voice (from the demo) | Our use |
|---|---|---|
| Card play | Arpeggio pluck: square or triangle into a resonant lowpass, fast filter drop | Every foundation receipt. Pitch from rank on the current scale. Combo raises the filter cutoff (brighter) instead of the pitch. |
| Combo layers | Melody voice, triangle with soft vibrato | At combo 5, add the third above; at combo 10, the full chord. Replaces today's out-of-key fifth. |
| Constellation motif | Melody voice | The 4–8 note tune when a figure completes. |
| Night bed | Pad: detuned saws, slow lowpass swell | Ambient, one chord every few seconds, very quiet. Only at night or in dark moods; a lighter bed by day. |
| Low end | Bass pluck | Sparse, combat only, or not at all at first. |
| Drums | Kick, snare, hat | Skip for exploration. Possibly a soft shaker or low drum in combat for tempo. |
| Space | Generated reverb and dotted-eighth delay | One shared bus. Wetter at night and in caves and woods, drier by day. |

**Expressive controls.** The demo's pointer mapping becomes game state:

- **Mode follows the hour and mood.** Dawn Lydian, day Ionian or Mixolydian, dusk Dorian, night and dark moods Aeolian. Change mode only at a phrase boundary so it never jars.
- **Brightness follows light.** Filter cutoff on pad and plucks follows the light level at Hero (dark/dim/lit/bright from `protoLighting.ts`). Reading the light for sound is fine; nothing writes back.
- **Tempo follows context.** Exploration around 80 BPM, combat around 104–116. Only the bed and echoes follow the grid; card plays never wait for it.

**Plumbing changes to `gameAudio.ts`**

1. Split buses: SFX and music gains into the existing limiter, each with its own volume, and keep the one mute.
2. Add the reverb (generated impulse, about 3 s) and the delay as sends.
3. Add a pure helper, say `src/audio/musicScale.ts`: root, mode and rank in, MIDI note and frequency out, with unit tests (rank 1 is the root, wrap behaviour, every mode stays in key).
4. Add `playCardNote({ rank, combo, lane })` next to the existing sound, then wire it at the foundation receipt in Proto and combat.
5. Add a lookahead scheduler only when the night bed lands; the card voice doesn't need one.
6. Keep the browser unlock: start the context on the first pointer or key, as `ensureReady()` already does.

Everything stays synthesized, so there is nothing to download, which suits the web, Electron and Capacitor plans. Watch CPU on phones: a pad with 8 sawtooths plus a convolver is the most costly part. Give the low tier a single-oscillator pad and a shorter impulse.

## Suggested slices

| # | Slice | Size | You check |
|---|---|---|---|
| 1 | `musicScale.ts` with tests, reverb/delay bus, pitched `playCardNote`, wired to foundation receipts. | Half a day | Does a run sound good? Is it too much on every play? |
| 2 | `skyProjection.ts`: lift the projection out of `StarfieldSky` (now used twice) with tests. One authored constellation, a constellation layer canvas, run-lights-stars, completion motif, Low tier. | About a day | Tilt view at night on desktop: lines line up with stars, no text overlap, frame time. |
| 3 | Mode by hour and mood, brightness by light level. | Half a day | Dusk to night feel. |
| 4 | Night pad bed with lookahead scheduler, chord shapes on High. | About a day | Is it calm, not busy? Music volume slider. |
| 5 | More figures tied to biomes; decide whether a star chart is a collectible. | Your call | |

A small audition lab page (like the book lab) would speed up tuning slices 1 and 4 without any debug UI in Proto.

## Open questions for Eric

1. Should card plays always be pitched, or only during a run of 3 or more (quieter otherwise)?
2. Recognisable authored figures (fox, lantern, fish) or abstract ones?
3. Should constellations stay purely cosmetic, or later become a collectible star chart?
