import { memo } from 'react';

interface PauseOverlayProps {
  paused: boolean;
}

export const PauseOverlay = memo(function PauseOverlay({ paused }: PauseOverlayProps) {
  if (!paused) return null;

  return (
    <div
      className="absolute inset-0 z-[10080] flex items-center justify-center pointer-events-none"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(1.5px)',
      }}
    >
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
    </div>
  );
});