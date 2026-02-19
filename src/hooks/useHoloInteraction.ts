import { useState, useCallback, useRef } from 'react';
import type { CSSProperties, MouseEvent, PointerEvent } from 'react';

export interface HoloInteractionStyles extends CSSProperties {
  '--mx': string;
  '--my': string;
  '--rx': string;
  '--ry': string;
  '--posx': string;
  '--posy': string;
  '--hyp': number;
}

export function useHoloInteraction() {
  const [styles, setStyles] = useState<HoloInteractionStyles>({
    '--mx': '50%',
    '--my': '50%',
    '--rx': '0deg',
    '--ry': '0deg',
    '--posx': '50%',
    '--posy': '50%',
    '--hyp': 0,
    transform: 'perspective(600px) rotateX(0deg) rotateY(0deg)',
  });

  const timerRef = useRef<number | null>(null);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const px = (x / rect.width) * 100;
    const py = (y / rect.height) * 100;
    
    const rx = (py - 50) / 2; // max 25deg tilt
    const ry = (50 - px) / 2;
    
    const hyp = Math.sqrt(Math.pow(py - 50, 2) + Math.pow(px - 50, 2)) / 50;
    
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    
    timerRef.current = requestAnimationFrame(() => {
      setStyles({
        '--mx': `${px}%`,
        '--my': `${py}%`,
        '--rx': `${rx}deg`,
        '--ry': `${ry}deg`,
        '--posx': `${px}%`,
        '--posy': `${py}%`,
        '--hyp': hyp,
        transform: `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`,
        transition: 'none',
      });
    });
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    
    setStyles({
      '--mx': '50%',
      '--my': '50%',
      '--rx': '0deg',
      '--ry': '0deg',
      '--posx': '50%',
      '--posy': '50%',
      '--hyp': 0,
      transform: 'perspective(600px) rotateX(0deg) rotateY(0deg)',
      transition: 'transform 0.5s ease, --mx 0.5s ease, --my 0.5s ease',
    });
  }, []);

  return {
    styles,
    handlePointerMove,
    handlePointerLeave,
  };
}
