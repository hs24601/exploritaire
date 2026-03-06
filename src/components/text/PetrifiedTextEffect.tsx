import { memo } from 'react';
import type { FormEvent } from 'react';

export type PetrifiedTextConfig = {
  text: string;
  duration: number;
  textColor: string;
  backgroundColor: string;
};

export const DEFAULT_PETRIFIED_TEXT_CONFIG: PetrifiedTextConfig = {
  text: 'Petrified',
  duration: 10,
  textColor: '#b3a2a2',
  backgroundColor: '#ffffff',
};

type Props = {
  config?: PetrifiedTextConfig;
};

const NOISE_DATA_URI = 'data:image/png;base64,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';

export const PetrifiedTextEffect = memo(function PetrifiedTextEffect({
  config = DEFAULT_PETRIFIED_TEXT_CONFIG
}: Props) {
  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    target.setAttribute('data-heading', target.innerText);
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Rubik+Distressed&display=swap");

        .petrified-root {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          text-align: center;
          background-color: ${config.backgroundColor};
          font-family: "Rubik Distressed", system-ui, sans-serif;
        }

        .petrified-root::before,
        .petrified-root::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: url("${NOISE_DATA_URI}");
          pointer-events: none;
        }

        .petrified-root::before {
          background-size: 10rem 10rem;
          opacity: 0.22;
        }

        .petrified-root::after {
          background-size: 2rem 2rem;
          background-position: 1rem 1rem;
          opacity: 0.18;
        }

        .petrified-text {
          position: relative;
          z-index: 1;
          color: ${config.textColor};
          line-height: 1;
          font-size: clamp(3rem, 12vw, 10rem);
          filter: url(#petrified-filter);
          transform-origin: center;
          animation: petrified-water-moving ${config.duration}s infinite;
          animation-delay: -5s;
          outline: none;
          white-space: nowrap;
          padding: 0 0.15em;
        }

        @keyframes petrified-water-moving {
          0%, 100% { transform: translateY(0) rotate(-0.4deg); }
          25% { transform: translateY(-0.02em) rotate(0.35deg); }
          50% { transform: translateY(0.02em) rotate(-0.25deg); }
          75% { transform: translateY(-0.01em) rotate(0.2deg); }
        }
      `}</style>
      <div className="petrified-root">
        <div
          className="petrified-text"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          data-heading={config.text}
        >
          {config.text}
        </div>
      </div>
      <svg width="0" height="0" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <filter id="petrified-filter">
            <feDropShadow dx="-2" dy="2" stdDeviation="0" floodColor="#000" floodOpacity="1" />
            <feDropShadow dx="4" dy="4" stdDeviation="0" floodColor="#fff" floodOpacity="1" />
            <feMorphology operator="erode" radius="3" />
            <feMorphology operator="dilate" radius="3" />
          </filter>
        </defs>
      </svg>
    </div>
  );
});
