import { describe, expect, it } from 'vitest';
import {
  CARD_TRANSPORT_BASE_SPEED_PX_PER_SECOND,
  CARD_TRANSPORT_MAX_DURATION_MS,
  CARD_TRANSPORT_MIN_DURATION_MS,
  getCardTransportDurationMs,
  interpolateCardTransport,
} from './protoTransport';

describe('Proto card transport', () => {
  it('uses the deliberately slower shared baseline', () => {
    expect(CARD_TRANSPORT_BASE_SPEED_PX_PER_SECOND).toBe(460);
    expect(CARD_TRANSPORT_MIN_DURATION_MS).toBe(520);
    expect(CARD_TRANSPORT_MAX_DURATION_MS).toBe(1800);
  });

  it('honors actor transport speed while preserving duration bounds', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 460, y: 0 };

    expect(getCardTransportDurationMs(from, to, 1)).toBe(1000);
    expect(getCardTransportDurationMs(from, to, 2)).toBe(520);
    expect(getCardTransportDurationMs(from, to, 0.5)).toBe(1800);
  });

  it('eases from the source to the target without overshoot', () => {
    const from = { x: 20, y: 40 };
    const to = { x: 120, y: 240 };

    expect(interpolateCardTransport(from, to, 0)).toEqual(from);
    expect(interpolateCardTransport(from, to, 1)).toEqual(to);
    expect(interpolateCardTransport(from, to, 0.5)).toEqual({ x: 107.5, y: 215 });
  });
});
