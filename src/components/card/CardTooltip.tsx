import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface CardTooltipProps {
  x: number;
  y: number;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  zIndex?: number;
  children: ReactNode;
}

export function CardTooltip({
  x,
  y,
  offsetX = 18,
  offsetY = -12,
  scale = 1,
  zIndex = 2000,
  children,
}: CardTooltipProps) {
  return createPortal(
    <div
      className="fixed pointer-events-none"
      style={{
        left: x + offsetX,
        top: y + offsetY,
        zIndex,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      {children}
    </div>,
    document.body
  );
}
