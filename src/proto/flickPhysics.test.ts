import { describe, it, expect } from 'vitest';
import { flickVelocity, flickPosition } from './flickPhysics';

describe('flick physics', () => {
  it('inherits recent direction and speed, with a bounded launch speed', () => {
    expect(flickVelocity([{x:0,y:0,t:0},{x:60,y:-30,t:60}])).toEqual({x:1000,y:-500});
    expect(flickVelocity([{x:0,y:0,t:0},{x:1000,y:0,t:10}]).x).toBe(3200);
  });
  it('does not launch slow drags or motion followed by a hold', () => {
    expect(flickVelocity([{x:0,y:0,t:0},{x:5,y:0,t:80}]).x).toBe(0);
    expect(flickVelocity([{x:0,y:0,t:0},{x:100,y:0,t:50},{x:100,y:0,t:250}]).x).toBe(0);
  });
  it('slows to a finite endpoint without reversing or depending on frame count', () => {
    const start = {x:10,y:20,t:0}, velocity = {x:1000,y:-500};
    const early = flickPosition(start,velocity,.1), late = flickPosition(start,velocity,1);
    expect(late.x).toBeGreaterThan(early.x);
    expect(late.x).toBeLessThan(210);
    expect(late.y).toBeGreaterThan(-80);
    const next = flickPosition(start,velocity,.2);
    expect(next.x-early.x).toBeLessThan(early.x-start.x);
    expect((late.y-start.y)/(late.x-start.x)).toBeCloseTo(-.5);
  });
});
