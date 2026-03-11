import { memo, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

export type FrostTextConfig = {
  text: string;
  duration: number;
};

export const DEFAULT_FROST_TEXT_CONFIG: FrostTextConfig = {
  text: 'Frost',
  duration: 7,
};

type Props = {
  config?: FrostTextConfig;
};

export const FrostTextEffect = memo(function FrostTextEffect({
  config = DEFAULT_FROST_TEXT_CONFIG
}: Props) {
  const [heading, setHeading] = useState(config.text);

  useEffect(() => {
    setHeading(config.text);
  }, [config.text]);

  const handleInput = (event: FormEvent<HTMLHeadingElement>) => {
    const nextText = event.currentTarget.innerText;
    setHeading(nextText);
    event.currentTarget.setAttribute('data-heading', nextText);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <style>{`
        @font-face {
          font-family: "Frozen";
          src: url("/assets/vis/fonts/ice-kingdom.woff");
          font-display: swap;
        }

        @keyframes frost-shine {
          0% { background-position: -120%; }
          10% { background-position: 120%; }
          100% { background-position: 120%; }
        }

        .frost-stage {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background:
            linear-gradient(to bottom, #000428, #004e92),
            radial-gradient(circle at 25% 30%, rgba(125, 204, 239, 0.2), transparent 55%);
          background-blend-mode: saturation;
          background-size: cover;
        }

        .frost-title {
          position: relative;
          transform: translateY(-10%);
          font-size: calc(20vw + 0.5rem);
          line-height: 0.9;
          font-family: "Frozen", serif;
          background-image: url("/assets/vis/textures/ice.jpg");
          background-size: contain;
          background-repeat: repeat;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          -webkit-text-stroke: 1px #4f90ab;
          filter:
            drop-shadow(0 0 2px rgba(255, 255, 255, 0.7))
            drop-shadow(0 0 2px rgba(41, 131, 172, 0.7))
            drop-shadow(0 0 30px rgba(125, 204, 239, 0.8))
            drop-shadow(0 0 30px rgba(58, 122, 155, 0.8));
          outline: none;
          white-space: nowrap;
        }

        .frost-animation {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            45deg,
            rgba(255, 255, 255, 0) 45%,
            rgba(255, 255, 255, 0.8) 50%,
            rgba(255, 255, 255, 0) 55%,
            rgba(255, 255, 255, 0) 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          background-size: 200%;
          animation: frost-shine ${config.duration}s infinite;
          pointer-events: none;
        }
      `}</style>
      <div className="frost-stage">
        <h1
          className="frost-title"
          data-heading={heading}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
        >
          {heading}
          <span className="frost-animation" aria-hidden="true">{heading}</span>
        </h1>
      </div>
    </div>
  );
});
