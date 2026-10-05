import { memo } from 'react';

export type ComboPunchTextConfig = {
  text: string;
  duration: number;
};

export const DEFAULT_COMBO_PUNCH_TEXT_CONFIG: ComboPunchTextConfig = {
  text: 'Combo: 43!',
  duration: 1,
};

type Props = {
  config?: ComboPunchTextConfig;
};

function splitComboText(text: string): { first: string; second: string } {
  const trimmed = text.trim();
  if (!trimmed) return { first: 'Combo: ', second: '43!' };

  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace <= 0 || lastSpace >= trimmed.length - 1) {
    return { first: `${trimmed} `, second: '43!' };
  }

  return {
    first: `${trimmed.slice(0, lastSpace)} `,
    second: trimmed.slice(lastSpace + 1),
  };
}

export const ComboPunchTextEffect = memo(function ComboPunchTextEffect({
  config = DEFAULT_COMBO_PUNCH_TEXT_CONFIG
}: Props) {
  const { first, second } = splitComboText(config.text);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`
        @font-face {
          font-family: "Luckiest Guy Local";
          src: url('/assets/vis/fonts/luckiest-guy-0.ttf') format('truetype');
          font-display: swap;
        }

        .combo-punch-root {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle, rgba(255, 252, 0, 1) 0%, rgba(240, 237, 23, 1) 100%);
          font-family: "Luckiest Guy Local", cursive;
        }

        .combo-punch-title {
          margin: 0;
          padding: 0;
          color: #ffffff;
          line-height: 1;
          font-size: clamp(2rem, 8vw, 8rem);
          text-shadow:
            0 0.1em 20px rgba(0, 0, 0, 1),
            0.05em -0.03em 0 rgba(0, 0, 0, 1),
            0.05em 0.005em 0 rgba(0, 0, 0, 1),
            0 0.08em 0 rgba(0, 0, 0, 1),
            0.05em 0.08em 0 rgba(0, 0, 0, 1),
            0 -0.03em 0 rgba(0, 0, 0, 1),
            -0.03em -0.03em 0 rgba(0, 0, 0, 1),
            -0.03em 0.08em 0 rgba(0, 0, 0, 1),
            -0.03em 0 0 rgba(0, 0, 0, 1);
          user-select: none;
          white-space: nowrap;
        }

        .combo-punch-title span {
          transform: scale(0.9);
          display: inline-block;
        }

        .combo-punch-title span:first-child {
          animation: combo-punch-bop ${config.duration}s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards infinite alternate;
        }

        .combo-punch-title span:last-child {
          animation: combo-punch-bop-b ${config.duration}s ${config.duration * 0.2}s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards infinite alternate;
        }

        @keyframes combo-punch-bop {
          0% { transform: scale(0.9); }
          50%, 100% { transform: scale(1); }
        }

        @keyframes combo-punch-bop-b {
          0% { transform: scale(0.9); }
          80%, 100% { transform: scale(1) rotateZ(-3deg); }
        }
      `}</style>
      <div className="combo-punch-root">
        <h1 className="combo-punch-title">
          <span>{first}</span>
          <span>{second}</span>
        </h1>
      </div>
    </div>
  );
});
