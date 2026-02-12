import { memo } from 'react';
import type { CombatOverlayBaseProps } from './CombatOverlayFrame';
import { CombatOverlayFrame } from './CombatOverlayFrame';

interface PauseOverlayProps extends Omit<CombatOverlayBaseProps, 'visible' | 'children' | 'interactive'> {
  paused: boolean;
}

export const PauseOverlay = memo(function PauseOverlay({ paused, zIndex }: PauseOverlayProps) {
  return (
    <CombatOverlayFrame visible={paused} interactive={false} zIndex={zIndex}>
      <div
        className="flex items-center justify-center rounded-full border-2"
        style={{
          width: 132,
          height: 132,
          borderColor: 'rgba(255, 229, 120, 0.9)',
          backgroundColor: 'rgba(10, 8, 6, 0.8)',
          boxShadow: '0 0 28px rgba(230, 179, 30, 0.45)',
        }}
      >
        <span
          className="font-bold tracking-[8px]"
          style={{
            color: '#f7d24b',
            fontSize: '56px',
            textShadow: '0 0 14px rgba(230, 179, 30, 0.65)',
            transform: 'translateX(4px)',
            lineHeight: 1,
          }}
        >
          ||
        </span>
      </div>
    </CombatOverlayFrame>
  );
});
