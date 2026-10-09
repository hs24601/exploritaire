export type CardTransportPoint = {
  x: number;
  y: number;
};

// Deliberately measured: card delivery is part of the combat readable state,
// not just a flourish. These defaults are half the original speed.
export const CARD_TRANSPORT_BASE_SPEED_PX_PER_SECOND = 460;
export const CARD_TRANSPORT_MIN_DURATION_MS = 520;
export const CARD_TRANSPORT_MAX_DURATION_MS = 1800;

export const getCardTransportDurationMs = (
  from: CardTransportPoint,
  to: CardTransportPoint,
  speedMultiplier: number = 1,
) => {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const safeMultiplier = Math.max(0.25, speedMultiplier);
  const duration = (distance / (CARD_TRANSPORT_BASE_SPEED_PX_PER_SECOND * safeMultiplier)) * 1000;
  return Math.round(Math.max(CARD_TRANSPORT_MIN_DURATION_MS, Math.min(CARD_TRANSPORT_MAX_DURATION_MS, duration)));
};

export const interpolateCardTransport = (
  from: CardTransportPoint,
  to: CardTransportPoint,
  progress: number,
): CardTransportPoint => {
  const clamped = Math.max(0, Math.min(1, progress));
  // Ease-out keeps the source readable, then makes the final target arrival clear.
  const eased = 1 - ((1 - clamped) ** 3);
  return {
    x: from.x + ((to.x - from.x) * eased),
    y: from.y + ((to.y - from.y) * eased),
  };
};
