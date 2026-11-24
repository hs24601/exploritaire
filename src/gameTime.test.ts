import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameClock } from './gameTime';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());
const clock = () => createGameClock({ now: () => Date.now(), frame: callback => setTimeout(() => callback(Date.now()), 16), cancelFrame: clearTimeout, timer: setTimeout, cancelTimer: clearTimeout });
describe('global simulation pause', () => {
  it('freezes a flight frame and resumes its timestamp without wall-time catch-up', () => {
    const c = clock(), frames: number[] = [];
    const fly = (time: number) => { frames.push(time); c.requestAnimationFrame(fly); };
    c.requestAnimationFrame(fly); vi.advanceTimersByTime(32);
    expect(frames).toEqual([16,32]); c.setPaused(true);
    vi.advanceTimersByTime(10000); expect(c.now()).toBe(32); expect(frames).toHaveLength(2);
    c.setPaused(false); vi.advanceTimersByTime(16); expect(frames).toEqual([16,32,48]);
  });
  it('retains timer remainder, local pause and cancellation across repeated global pauses', () => {
    const c = clock(), complete = vi.fn(), cancelled = vi.fn();
    c.setTimeout(complete,100); const id=c.setTimeout(cancelled,80);
    vi.advanceTimersByTime(40); c.setPaused(true); c.clearTimeout(id);
    vi.advanceTimersByTime(5000); expect(complete).not.toHaveBeenCalled();
    c.setPaused(false); vi.advanceTimersByTime(30); c.setPaused(true); vi.advanceTimersByTime(2000);
    c.setPaused(false); vi.advanceTimersByTime(29); expect(complete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(complete).toHaveBeenCalledTimes(1); expect(cancelled).not.toHaveBeenCalled();
  });
  it('does not burst interval ticks or start new actions while paused', () => {
    const c = clock(), tick=vi.fn(), next=vi.fn();
    const id=c.setInterval(tick,50); vi.advanceTimersByTime(75); c.setPaused(true);
    c.setTimeout(next,20); vi.advanceTimersByTime(10000); expect(tick).toHaveBeenCalledTimes(1); expect(next).not.toHaveBeenCalled();
    c.setPaused(false); vi.advanceTimersByTime(20); expect(next).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5); expect(tick).toHaveBeenCalledTimes(2); c.clearInterval(id);
    vi.advanceTimersByTime(100); expect(tick).toHaveBeenCalledTimes(2);
  });
  it('never resurrects a cancelled animation frame', () => {
    const c=clock(), frame=vi.fn(); const id=c.requestAnimationFrame(frame); c.setPaused(true); c.cancelAnimationFrame(id);
    c.setPaused(false); vi.advanceTimersByTime(100); expect(frame).not.toHaveBeenCalled();
  });
  it('keeps a loader hold through a reset of the player pause, and the player pause through its release', () => {
    const c=clock(), complete=vi.fn(); c.setTimeout(complete,50);
    const release=c.hold(); c.setPaused(false); vi.advanceTimersByTime(1000);
    expect(c.isPlayerPaused()).toBe(false);
    expect(c.isPaused()).toBe(true); expect(complete).not.toHaveBeenCalled();
    c.setPaused(true); release(); release(); vi.advanceTimersByTime(1000); expect(complete).not.toHaveBeenCalled();
    expect(c.isPlayerPaused()).toBe(true);
    c.setPaused(false); vi.advanceTimersByTime(50); expect(complete).toHaveBeenCalledTimes(1);
  });
});
