type CardCooldownOverlayProps = {
  active: boolean;
  durationMs: number;
  cooldownKey: number;
  elapsedMs?: number;
};

/**
 * Reusable gameplay policy for a card cooldown. Pressure encounters can opt
 * into restarting a cooldown after a premature interaction; cozy nodes keep
 * their original timer running.
 */
export type CardCooldownPolicy = {
  durationMs: number;
  restartOnPrematureInteraction: boolean;
};

/** Reusable visual layer for cards that temporarily cannot be used. */
export function CardCooldownOverlay({ active, durationMs, cooldownKey, elapsedMs = 0 }: CardCooldownOverlayProps) {
  if (!active) return null;
  const remainingPercent = Math.max(0, Math.min(100, 100 - elapsedMs / durationMs * 100));
  // The scrim is driven by simulation progress rather than CSS wall time, so
  // it faithfully pauses and respects the selected simulation speed.
  return <span key={cooldownKey} className="card-cooldown-overlay" aria-label="Cooling down" style={{ clipPath: `inset(0 0 ${remainingPercent}% 0)` }} />;
}
