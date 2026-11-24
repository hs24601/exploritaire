import type {BookCameraStep} from './bookCamera';
/** The page transition owns the first camera move; playback resumes at its hold. */
export function preparePageShotHandoff(steps:readonly BookCameraStep[],changesPage:boolean){const copy=structuredClone([...steps]),arrival=changesPage&&steps[0]&&steps[0].kind!=='paint'?structuredClone(steps[0]):undefined;if(arrival)copy[0].durationMs=0;return{arrival,steps:copy};}
