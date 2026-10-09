import { useEffect, useState } from 'react';

/** Sample browser frames without re-rendering the table on every frame. */
export function FpsCounter() {
  const [fps, setFps] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;
    let start: number | null = null;
    let frames = 0;
    const reset = () => { start = null; frames = 0; setFps(null); };
    const tick = (now: number) => {
      if (!document.hidden) {
        if (start === null) start = now;
        else {
          frames += 1;
          const elapsed = now - start;
          if (elapsed >= 1000) {
            setFps(Math.round(frames * 1000 / elapsed));
            start = now;
            frames = 0;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', reset);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', reset);
    };
  }, []);

  return <div className="proto-map-fps" title="Frames per second">FPS {fps ?? '—'}</div>;
}
