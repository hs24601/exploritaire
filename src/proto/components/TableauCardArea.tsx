import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export function fitTableauCards(width: number, height: number, columns: number, rows: number) {
  const gap = 4;
  const usableWidth = Math.max(0, width - 12 - gap * (columns - 1));
  const usableHeight = Math.max(0, height - 12);
  const cardWidth = Math.max(0, Math.min(usableWidth / columns, usableHeight / (74 / 56 + Math.max(0, rows - 1) * 0.48)));
  return { cardWidth, step: cardWidth * 0.48, gap, stackHeight: cardWidth * 74 / 56 + Math.max(0, rows - 1) * cardWidth * 0.48 };
}

/** Measures only the play area, excluding the foundation shelf and solver rail. */
export function TableauCardArea({ columns, rows, children }: { columns: number; rows: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setBounds({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const layout = fitTableauCards(bounds.width, bounds.height, columns, rows);
  return <div ref={ref} className="proto-tableau-card-area" style={{
    '--classic-card-w': `${layout.cardWidth}px`,
    '--classic-stack-step': `${layout.step}px`,
    '--classic-tableau-gap': `${layout.gap}px`,
    '--classic-stack-height': `${layout.stackHeight}px`,
  } as CSSProperties}>{children}</div>;
}
