/** Pure pitch helpers for the musical tableaus: card ranks become scale notes.
 *
 * A golf run steps ±1 in rank, so mapping rank to scale degree turns every run
 * into a rising or falling scale. A is the root, K is degree 12 (the sixth, an
 * octave and a half up); the K→A wrap drops back to the root. Research:
 * docs/research/generative-music-constellations.md. */
export type ModeName = 'aeolian' | 'dorian' | 'mixolydian' | 'ionian' | 'lydian';

export const MODES: Record<ModeName, readonly number[]> = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

export type MusicKey = { root: number; mode: ModeName };

/** A = 0 … K = 12. Out-of-range ranks wrap like the tableau does. */
export const rankDegree = (rank: number) => (((Math.round(rank) - 1) % 13) + 13) % 13;

/** MIDI note for a scale degree; degrees past 6 climb octaves, negative ones fall. */
export const degreeMidi = (key: MusicKey, degree: number) => {
  const steps = MODES[key.mode], octave = Math.floor(degree / 7);
  return key.root + 12 * octave + steps[((degree % 7) + 7) % 7];
};

export const rankMidi = (key: MusicKey, rank: number) => degreeMidi(key, rankDegree(rank));

export const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Combo harmony stays in key: a third above from combo 5, a triad from combo 10. */
export const comboHarmony = (key: MusicKey, rank: number, combo: number): number[] => {
  const degree = rankDegree(rank);
  if (combo >= 10) return [degreeMidi(key, degree + 2), degreeMidi(key, degree + 4)];
  if (combo >= 5) return [degreeMidi(key, degree + 2)];
  return [];
};

/** Brightness (lowpass cutoff in Hz) rises with the combo instead of the pitch. */
export const comboCutoff = (combo: number) => Math.min(5200, 1300 + Math.max(0, combo) * 260);

/** A quiet seventh chord for the night bed, stacked in thirds on a degree. */
export const chordMidi = (key: MusicKey, degree: number) => [0, 2, 4, 6].map(step => degreeMidi(key, degree + step));
