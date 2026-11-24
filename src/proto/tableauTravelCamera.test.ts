import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { tableauDepartureEye, tableauDepartureProgress, tableauApproachProgress } from './tableauTravelCamera';
import type { TravelSegment } from './travelJourney';

const exit: TravelSegment = { title: 'Leave bush', kind: 'berry-patch', unknown: false, cards: 6, stamina: 1, start: .2, end: .4, traversalStage: 'exit' };

describe('tableau departure camera', () => {
  it('includes the den and reverses the dolly for incoming traversal',()=>{
    expect(tableauDepartureProgress({...exit,kind:'den-exit',traversalStage:undefined},.3)).toBeCloseTo(.5);
    const enter={...exit,traversalStage:'enter' as const};
    expect(tableauApproachProgress(enter,.2)).toBe(1);
    expect(tableauApproachProgress(enter,.3)).toBeCloseTo(.5);
    expect(tableauApproachProgress(enter,.4)).toBe(0);
    expect(tableauApproachProgress({...enter,traversalStage:'gather'},.3)).toBe(0);
  });
  it('tracks each walked step within its own exit and clamps at the boundaries', () => {
    for (let step = 0; step <= 6; step++) {
      expect(tableauDepartureProgress(exit, .2 + .2 * step / 6)).toBeCloseTo(step / 6);
    }
    expect(tableauDepartureProgress(exit, 0)).toBe(0);
    expect(tableauDepartureProgress(exit, 1)).toBe(1);
    expect(tableauDepartureProgress({ ...exit, traversalStage: 'enter' }, .3)).toBe(0);
    expect(tableauDepartureProgress(undefined, 1)).toBe(0);
  });

  it('makes the fixed bush recede on every step without changing field geometry', () => {
    const camera = new PerspectiveCamera(45, 1, .1, 100);
    let previousHeight = Infinity;
    for (let step = 0; step <= 6; step++) {
      const eye = tableauDepartureEye(step / 6, false);
      camera.position.set(0, eye.y, eye.z);
      camera.lookAt(0, 4, -8);
      camera.updateMatrixWorld();
      const height = new Vector3(0, 11, -8).project(camera).y - new Vector3(0, 0, -8).project(camera).y;
      expect(height).toBeLessThan(previousHeight);
      previousHeight = height;
    }
  });
});
