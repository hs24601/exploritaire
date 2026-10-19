import { gameTime } from '../../gameTime';
import { useEffect, useMemo, useRef } from 'react';
import type { ProtoState } from '../protoState';
import { buildDayCinematicBeats, dayCinematicBeatId, dayCinematicLabelBeatId } from '../dayCinematics';
import { getCameraPlayback, getCameraLibrary, useCameraLibrary, playCameraChoreography, setDefaultCameraLibrary, stopCameraPlayback } from '../cameraDirector';
import { useStoryCinematicsEnabled } from '../dayCinematicSettings';
export function useDayCinematics(state: ProtoState, run: number, editing: boolean, settledBeat?: string | null) {
  const enabled = useStoryCinematicsEnabled();
  const library = useCameraLibrary();
  const layout = JSON.stringify([state.dayScenarioTiles, state.biomeTiles.map(t => [t.id, t.position.x, t.position.y])]);
  const beats = useMemo(() => state.dayScenario ? buildDayCinematicBeats(state) : [], [layout, Boolean(state.dayScenario)]);
  const id = dayCinematicBeatId(state), beat = beats.find(b => b.id === id) ?? null;
  const seen = useRef(new Set<string>()), previousEnabled = useRef(enabled);
  useEffect(() => { setDefaultCameraLibrary(beats.map(b => b.choreography)); return () => setDefaultCameraLibrary([]); }, [beats]);
  useEffect(() => { seen.current.clear(); return () => { seen.current.clear(); }; }, [run]);
  useEffect(() => { if (!enabled && previousEnabled.current) stopCameraPlayback(); previousEnabled.current = enabled; }, [enabled]);
  useEffect(() => {
    if (!enabled || editing || !beat || beat.id === settledBeat || beat.calloutId || seen.current.has(beat.id)) return;
    let frame = 0;
    const play = () => {
      if (!getCameraPlayback().available) { frame = gameTime.requestAnimationFrame(play); return; }
      seen.current.add(beat.id);
      // Explicit authored triggers/callout edits retain priority over the first pass.
      if (!getCameraPlayback().playing && getCameraLibrary().find(c => c.id === beat.choreography.id)?.enabled) playCameraChoreography(beat.choreography.id);
    };
    frame = gameTime.requestAnimationFrame(play);
    return () => gameTime.cancelAnimationFrame(frame);
  }, [enabled, editing, beat, run, settledBeat]);
  useEffect(() => {
    if (state.journey && getCameraLibrary().some(c => c.id.startsWith('story.') && c.name === getCameraPlayback().name)) stopCameraPlayback();
  }, [Boolean(state.journey)]);
  // Travel temporarily releases the camera beat, but the tutorial section keeps
  // its labels until actual arrival/harvest changes the logical story section.
  const labelBeat = beats.find(b => b.id === dayCinematicLabelBeatId(state));
  const labelSequence = library.find(c => c.id === labelBeat?.choreography.id) ?? labelBeat?.choreography;
  const tileLabelIds = enabled && !editing ? labelSequence?.tileLabelIds ?? [] : [];
  // Releasing a camera shot for card-earned travel does not end the scene's
  // lighting. Keep its grade and peripheral darkness through the journey.
  return { enabled, beats, beat, presentationBeat: beat ?? labelBeat, tileLabelIds, active: Boolean(enabled && state.dayScenario && !editing) };
}
