import { useState, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties, MouseEvent, PointerEvent } from 'react';

export interface HoloInteractionStyles extends CSSProperties {
  '--mx': string;
  '--my': string;
  '--rx': string;
  '--ry': string;
  '--posx': string;
  '--posy': string;
  '--hyp': number;
  '--bg-x'?: number;
  '--bg-y'?: number;
  '--bg-x-flipped'?: number;
  '--bg-y-flipped'?: number;
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
    '--bg-x': 0,
    '--bg-y': 0,
    '--bg-x-flipped': 0,
    '--bg-y-flipped': 0,
    transform: 'perspective(600px) rotateX(0deg) rotateY(0deg)',
  });

  const timerRef = useRef<number | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const updateStylesFromPercent = useCallback((px: number, py: number, rect: DOMRect) => {
    const rx = (py - 50) / 2;
    const ry = (50 - px) / 2;
    const hyp = Math.sqrt(Math.pow(py - 50, 2) + Math.pow(px - 50, 2)) / 50;
    const x = (px / 100) * rect.width;
    const y = (py / 100) * rect.height;
    const tiltX = -(x - rect.width / 2) / 20;
    const tiltY = -(y - rect.height / 2) / 20;

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
        '--bg-y': tiltX / 2,
        '--bg-x': tiltY / 2,
        '--bg-y-flipped': tiltX,
        '--bg-x-flipped': tiltY,
        transform: `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`,
        transition: 'none',
      });
    });
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const px = (x / rect.width) * 100;
    const py = (y / rect.height) * 100;

    elementRef.current = e.currentTarget;
    updateStylesFromPercent(px, py, rect);
  }, [updateStylesFromPercent]);

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
      '--bg-x': 0,
      '--bg-y': 0,
      '--bg-x-flipped': 0,
      '--bg-y-flipped': 0,
      transform: 'perspective(600px) rotateX(0deg) rotateY(0deg)',
      transition: 'transform 0.5s ease, --mx 0.5s ease, --my 0.5s ease, --bg-x 0.5s ease, --bg-y 0.5s ease',
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      return;
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const target = elementRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const gamma = event.gamma ?? 0;
      const beta = event.beta ?? 0;
      const clamp = (value: number) => Math.min(Math.max(value, 0), 100);
      const px = clamp(50 + (gamma / 90) * 50);
      const py = clamp(50 + (beta / 90) * 50);
      updateStylesFromPercent(px, py, rect);
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, [updateStylesFromPercent]);

  return {
    styles,
    handlePointerMove,
    handlePointerLeave,
    registerElement: (element: HTMLElement | null) => { elementRef.current = element; },
  };
}
