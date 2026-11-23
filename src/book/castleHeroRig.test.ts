import {describe, expect, it} from 'vitest';
import {bearing, heroRigFrame} from './castleHeroRig';

describe('page 117 Hero rig', () => {
  it('shows her rear view from the over-the-shoulder camera', () => {
    // she faces the keep (-z); the camera is behind her (+z)
    const f = heroRigFrame(bearing(0, -1), bearing(0, 1), 'idle', 0);
    expect(f.view.direction).toBe(4);
    expect(f.sheet).toBe('standing');
    expect(f.height).toBeGreaterThan(.9);
  });

  it('turns to a mirrored profile when she trots across the view', () => {
    const right = heroRigFrame(bearing(1, 0), bearing(0, 1), 'walk', 0), left = heroRigFrame(bearing(-1, 0), bearing(0, 1), 'walk', 0);
    expect(right.view.direction).toBe(2); expect(left.view.direction).toBe(2);
    expect(right.flip).toBe(-left.flip);
    expect(right.sheet).toBe('walking');
  });

  it('cycles four gait phases and keeps her size between sheets', () => {
    const rects = new Set([0, .2, .4, .6].map(t => heroRigFrame(0, Math.PI, 'walk', t).rect));
    expect(rects.size).toBe(4);
    const stand = heroRigFrame(0, 0, 'idle', 0), walk = heroRigFrame(0, 0, 'walk', 0);
    expect(Math.abs(stand.height - walk.height) / stand.height).toBeLessThan(.06);
  });

  it('uses authored elevated poses and keeps the overhead walk animated', () => {
    const quarter = heroRigFrame(0, 3 * Math.PI / 4, 'idle', 0, undefined, Math.PI / 3);
    expect(quarter.sheet).toBe('standingHigh');
    expect(quarter.view.direction).toBe(3);
    const overhead = heroRigFrame(0, Math.PI, 'idle', 0, undefined, Math.PI / 2);
    expect(overhead.view.elevation).toBe('top');
    expect(overhead.rect).toEqual([71, 1022, 174, 398]);
    const walk = [0, .2, .4, .6].map(t => heroRigFrame(0, Math.PI, 'walk', t, undefined, Math.PI / 2));
    expect(walk.every(frame => frame.sheet === 'walkingHigh' && frame.view.elevation === 'top')).toBe(true);
    expect(new Set(walk.map(frame => frame.rect)).size).toBe(4);
  });

  it('covers the full intermediate orbit without falling back to a low rear sprite', () => {
    const elevation = 39 * Math.PI / 180;
    const heading = Math.PI / 8;
    for (let sector = 0; sector < 8; sector++) {
      const yaw = heading + sector * Math.PI / 4;
      const low = heroRigFrame(heading, yaw, 'idle', 0).view;
      const idle = heroRigFrame(heading, yaw, 'idle', 0, low, elevation);
      expect(idle.view.elevation).toBe('high');
      expect(idle.view.direction).toBe(Math.min(sector, 8 - sector));
      expect(idle.view.flip).toBe(sector > 4 ? -1 : 1);
      expect(idle.sheet).toBe(sector === 4 ? 'standingRearHigh' : 'standingHigh');
      for (const gait of ['walk', 'run'] as const) {
        const moving = heroRigFrame(heading, yaw, gait, .2, idle.view, elevation);
        expect(moving.view).toEqual(idle.view);
        expect(moving.sheet).toBe('walkingHigh');
      }
    }
  });
});
