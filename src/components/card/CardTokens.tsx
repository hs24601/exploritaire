import type { CSSProperties } from 'react';

export type CardTokenTone = 'neutral' | 'alert' | 'reward';
export type CardTokenAnchor = 'top-left' | 'top-center' | 'top-right' | 'mid-center';

export type CardToken = {
  id: string;
  label: string;
  emoji: string;
  tone?: CardTokenTone;
  anchor?: CardTokenAnchor;
  prominent?: boolean;
  revealEffect?: 'rescue-flash';
};

const TOKEN_TONES: Record<CardTokenTone, { border: string; background: string; shadow: string }> = {
  neutral: {
    border: 'rgba(255,255,255,0.28)',
    background: 'linear-gradient(180deg, rgba(24,28,34,0.96), rgba(10,12,16,0.92))',
    shadow: '0 0 18px rgba(255,255,255,0.08)',
  },
  alert: {
    border: 'rgba(255,92,92,0.82)',
    background: 'linear-gradient(180deg, rgba(44,10,10,0.98), rgba(18,6,6,0.94))',
    shadow: '0 0 18px rgba(255,72,72,0.22)',
  },
  reward: {
    border: 'rgba(230,179,30,0.82)',
    background: 'linear-gradient(180deg, rgba(34,26,8,0.98), rgba(12,8,3,0.94))',
    shadow: '0 0 18px rgba(230,179,30,0.22)',
  },
};

function getAnchorStyle(anchor: CardTokenAnchor, tokenSize: number): CSSProperties {
  if (anchor === 'top-left') {
    return { left: 10, top: 10 };
  }
  if (anchor === 'top-center') {
    return { left: '50%', top: 12, transform: 'translateX(-50%)' };
  }
  if (anchor === 'mid-center') {
    return { left: '50%', top: '34%', transform: 'translate(-50%, -50%)' };
  }
  return { right: 10, top: 10 };
}

export function CardTokens({
  tokens,
  cardWidth,
}: {
  tokens: CardToken[];
  cardWidth: number;
}) {
  if (tokens.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {tokens.map((token) => {
        const tone = TOKEN_TONES[token.tone ?? 'neutral'];
        const tokenSize = token.prominent ? Math.max(34, Math.round(cardWidth * 0.26)) : Math.max(24, Math.round(cardWidth * 0.18));
        return (
          <div
            key={token.id}
            className="absolute flex items-center justify-center rounded-full"
            aria-hidden="true"
            title={token.label}
            style={{
              ...getAnchorStyle(token.anchor ?? 'top-right', tokenSize),
              width: tokenSize,
              height: tokenSize,
              border: `2px solid ${tone.border}`,
              background: tone.background,
              boxShadow: tone.shadow,
            }}
          >
            {/* Reveal flash handled at root level for screen-wide effect if revealEffect === 'rescue-flash' */}
            <span
              className={token.revealEffect === 'rescue-flash' ? 'token-reveal-breathe' : undefined}
              style={{
                fontSize: Math.round(tokenSize * 0.58),
                lineHeight: 1,
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))',
              }}
            >
              {token.emoji}
            </span>
          </div>
        );
      })}
    </div>
  );
}
