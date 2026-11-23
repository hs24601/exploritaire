import {describe, expect, it} from 'vitest';
import {CASTLE_IDLE_VIEWS, CastleHeroIdle, castleIdleRect, castleIdleView} from './castleHeroIdle';
import {heroRigFrame} from './castleHeroRig';

describe('castle Hero activities', () => {
  it('keeps the activity key while the camera travels through every yaw and elevation', () => {
    const seen = new Set<string>();
    for (const elevation of [0, Math.PI / 3, Math.PI / 2]) {
      for (let yaw = 0; yaw < 8; yaw++) {
        const {view} = heroRigFrame(0, yaw * Math.PI / 4, 'idle', 0, undefined, elevation);
        seen.add(castleIdleView(view));
        expect(castleIdleRect(9)).toEqual([256, 512, 256, 256]);
        if (view.direction > 0 && view.direction < 4 && elevation < Math.PI / 2) {
          expect(view.flip).toBe(yaw < 4 ? 1 : -1);
        }
      }
    }
    expect([...seen].sort()).toEqual([...CASTLE_IDLE_VIEWS].sort());
  });

  it('blinks while standing, sits for a while, then stays prone until an activity', () => {
    const idle = new CastleHeroIdle(() => 0);
    const samples = Array.from({length: 1250}, () => idle.update(.02, true, false));
    expect(samples.some(pose => pose.action === 'blink' && pose.frame === 1)).toBe(true);
    expect(samples[0]).toEqual({frame: 0, action: 'stand'});
    expect(samples.slice(450, 950).every(pose => pose.action === 'sit' && pose.frame === 5)).toBe(true);
    expect(samples.slice(1050).every(pose => pose.action === 'prone' && pose.frame === 7)).toBe(true);
    expect(samples.filter(pose => pose.action === 'sit')[0].frame).toBe(4);
    expect(samples.filter(pose => pose.action === 'prone')[0].frame).toBe(6);
  });

  it('gets up to pant for a few breaths, then lies back down', () => {
    const idle = new CastleHeroIdle(() => 0);
    const samples = Array.from({length: 1650}, () => idle.update(.02, true, false));
    const pant = samples.filter(pose => pose.action === 'pant');
    expect(pant[pant.length - 1]?.frame).toBe(6);
    expect(pant.filter((pose, index) => pose.frame === 3 && pant[index - 1]?.frame !== 3)).toHaveLength(2);
    expect(samples[samples.length - 1]).toEqual({frame: 7, action: 'prone'});
  });

  it('gets up for other activities, returns to prone, and resets on movement', () => {
    const idle = new CastleHeroIdle(() => 0);
    const seen = new Map<string, number[]>();
    let previous = idle.update(0, true, false);
    const resettled = new Set<string>();
    for (let i = 0; i < 2300; i++) {
      const pose = idle.update(.04, true, false);
      const frames = seen.get(pose.action) ?? [];
      if (frames[frames.length - 1] !== pose.frame) frames.push(pose.frame);
      seen.set(pose.action, frames);
      if (pose.action === 'prone' && pose.frame === 7 && previous.action !== 'prone') resettled.add(previous.action);
      previous = pose;
    }
    expect(seen.get('scratch')).toEqual(expect.arrayContaining([5, 8, 9]));
    expect(seen.get('sniff')?.slice(0, 8)).toEqual([6, 0, 10, 11, 10, 12, 10, 6]);
    expect(seen.get('curious')?.slice(0, 7)).toEqual([6, 0, 13, 14, 15, 13, 6]);
    expect(resettled).toEqual(new Set(['pant', 'scratch', 'sniff', 'curious']));
    expect(idle.update(.04, false, false)).toEqual({frame: 0, action: 'stand'});
    expect(idle.update(.04, true, false)).toEqual({frame: 0, action: 'stand'});
    expect(idle.update(10, true, true)).toEqual({frame: 0, action: 'stand'});
  });
});
