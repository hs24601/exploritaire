import { memo, type ReactNode } from 'react';

export interface CombatOverlayBaseProps {
  visible: boolean;
  interactive?: boolean;
  dimOpacity?: number;
  blurPx?: number;
  zIndex?: number;
  children: ReactNode;
}

const DEFAULT_OVERLAY_Z_INDEX = 9988;

export const CombatOverlayFrame = memo(function CombatOverlayFrame({
  visible,
  interactive = false,
  dimOpacity = 0.5,
  blurPx = 1.5,
  zIndex = DEFAULT_OVERLAY_Z_INDEX,
  children,
}: CombatOverlayBaseProps) {
  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{
        zIndex,
        backgroundColor: `rgba(0, 0, 0, ${dimOpacity})`,
        backdropFilter: `blur(${blurPx}px)`,
      }}
    >
      {children}
    </div>
  );
});
