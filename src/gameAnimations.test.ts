import { describe, expect, it, vi } from 'vitest';

const animation = () => {
  let finish!: () => void;
  const a = { playState: 'running', pause: vi.fn(() => { a.playState='paused'; }), play: vi.fn(() => { a.playState='running'; }), finished: new Promise<void>(resolve => { finish=resolve; }) };
  return { a: a as unknown as Animation, finish };
};
describe('global pause of browser-native flights', () => {
  it('resumes existing flights and freezes flights created during the pause', async () => {
    vi.resetModules();
    const { gameTime }=await import('./gameTime'), { trackGameAnimation }=await import('./gameAnimations');
    const first=animation(), next=animation(); trackGameAnimation(first.a);
    gameTime.setPaused(true); expect(first.a.pause).toHaveBeenCalledOnce();
    trackGameAnimation(next.a); expect(next.a.pause).toHaveBeenCalledOnce();
    gameTime.setPaused(false); expect(first.a.play).toHaveBeenCalledOnce(); expect(next.a.play).toHaveBeenCalledOnce();
    first.finish(); next.finish(); await Promise.resolve();
    gameTime.setPaused(true); expect(first.a.pause).toHaveBeenCalledOnce(); gameTime.setPaused(false);
  });
  it('preserves an independently paused animation', async () => {
    vi.resetModules();
    const { gameTime }=await import('./gameTime'), { trackGameAnimation }=await import('./gameAnimations');
    const local=animation(); local.a.pause(); trackGameAnimation(local.a);
    gameTime.setPaused(true); gameTime.setPaused(false); expect(local.a.play).not.toHaveBeenCalled(); local.finish();
  });
});
