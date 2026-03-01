interface TableauNoMovesOverlayProps {
  active: boolean;
  className?: string;
}

export function TableauNoMovesOverlay({ active, className = '' }: TableauNoMovesOverlayProps) {
  if (!active) return null;
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 rounded-md bg-black/45 shadow-[inset_0_0_28px_rgba(0,0,0,0.6)] ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

