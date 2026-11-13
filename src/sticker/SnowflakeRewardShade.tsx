import { useId, useLayoutEffect, useState, type RefObject } from 'react';

type Opening = { x: number; y: number; width: number; height: number };

/** Reveal the real drop targets through the shade, including their focus outlines. */
export function SnowflakeRewardShade({ fieldRef, revealedKin }: {
  fieldRef: RefObject<HTMLElement | null>;
  revealedKin: string;
}) {
  const mask = useId();
  const [openings, setOpenings] = useState<Opening[]>([]);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field || !revealedKin) {
      setOpenings([]);
      return;
    }
    const foundations = [...field.querySelectorAll<HTMLElement>('[data-snowflake-eligible]')];
    const padding = 7;
    const measure = () => setOpenings(foundations.flatMap(foundation => {
      const { x, y, width, height } = foundation.getBoundingClientRect();
      return width && height ? [{
        x: x - padding, y: y - padding, width: width + padding * 2, height: height + padding * 2,
      }] : [];
    }));
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(field);
    foundations.forEach(foundation => resize.observe(foundation));
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      resize.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [fieldRef, revealedKin]);

  return <svg className="snowflake-reward-shade" aria-hidden="true">
    <defs><mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
      <rect width="100%" height="100%" fill="white" />
      {openings.map((opening, index) => <rect key={index} {...opening} rx="12" fill="black" />)}
    </mask></defs>
    <rect width="100%" height="100%" fill="#020807" opacity=".79" mask={`url(#${mask})`} />
  </svg>;
}
