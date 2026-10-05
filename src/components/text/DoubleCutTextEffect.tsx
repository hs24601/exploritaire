import { memo, useMemo } from 'react';

export type DoubleCutTextConfig = {
  text: string;
  fontSize: string;
  fontFamily: string;
  color: string;
  glowColor: string;
  animationDuration: number;
};

export const DEFAULT_DOUBLE_CUT_TEXT_CONFIG: DoubleCutTextConfig = {
  text: 'Dark Claw',
  fontSize: 'calc(20px + 5vw)',
  fontFamily: "'Montserrat', Arial, sans-serif",
  color: '#ffffff',
  glowColor: '#1da9cc',
  animationDuration: 2.5,
};

type Props = {
  className?: string;
  config?: DoubleCutTextConfig;
};

export const DoubleCutTextEffect = memo(function DoubleCutTextEffect({
  className,
  config = DEFAULT_DOUBLE_CUT_TEXT_CONFIG
}: Props) {
  // Generate a unique ID for this instance to prevent style collisions
  const instanceId = useMemo(() => Math.random().toString(36).substring(2, 9), []);

  return (
    <div className={`flex justify-center items-center h-full w-full overflow-hidden ${className}`}>
      <style key={JSON.stringify(config)}>{`
        @keyframes double-cut-shake-${instanceId} {
            5%, 15%, 25%, 35%, 55%, 65%, 75%, 95% {
                filter: blur(0.018em);
                transform: translateY(0.018em) rotate(0deg);
            }

            10%, 30%, 40%, 50%, 70%, 80%, 90% {
                filter: blur(0.01em);
                transform: translateY(-0.018em) rotate(0deg);
            }

            20%, 60% {
                filter: blur(0.03em);
                transform: translate(-0.018em, 0.018em) rotate(0deg);
            }

            45%, 85% {
                filter: blur(0.03em);
                transform: translate(0.018em, -0.018em) rotate(0deg);
            }

            100% {
                filter: blur(0.007em);
                transform: translate(0) rotate(-0.5deg);
            }
        }

        @keyframes double-cut-crack1-${instanceId} {
            0%, 95% {
                transform: translate(0, 0);
            }

            100% {
                transform: translate(-3%, 2%);
            }
        }

        @keyframes double-cut-crack2-${instanceId} {
            0%, 95% {
                transform: translate(0, 0);
            }

            100% {
                transform: translate(3%, -3%);
            }
        }

        .double-cut-h1-${instanceId} {
            position: relative;
            font-family: ${config.fontFamily};
            font-size: ${config.fontSize};
            font-weight: 700;
            letter-spacing: 0.02em;
            text-transform: uppercase;
            user-select: none;
            white-space: nowrap;
            filter: blur(0.007em);
            animation: double-cut-shake-${instanceId} ${config.animationDuration}s linear forwards;
            display: inline-block;
            color: transparent; /* Hide the base text */
            text-shadow: none;
        }

        .double-cut-span-${instanceId} {
            position: relative; /* Give the h1 size */
            display: block;
            color: ${config.color};
            text-shadow: 0 0 0.15em ${config.glowColor};
            -webkit-clip-path: polygon(10% 0%, 44% 0%, 70% 100%, 55% 100%);
            clip-path: polygon(10% 0%, 44% 0%, 70% 100%, 55% 100%);
        }

        .double-cut-h1-${instanceId}::before,
        .double-cut-h1-${instanceId}::after {
            content: attr(data-text);
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: block;
            color: ${config.color};
            text-shadow: 0 0 0.15em ${config.glowColor};
        }

        .double-cut-h1-${instanceId}::before {
            animation: double-cut-crack1-${instanceId} ${config.animationDuration}s linear forwards;
            -webkit-clip-path: polygon(0% 0%, 10% 0%, 55% 100%, 0% 100%);
            clip-path: polygon(0% 0%, 10% 0%, 55% 100%, 0% 100%);
        }

        .double-cut-h1-${instanceId}::after {
            animation: double-cut-crack2-${instanceId} ${config.animationDuration}s linear forwards;
            -webkit-clip-path: polygon(44% 0%, 100% 0%, 100% 100%, 70% 100%);
            clip-path: polygon(44% 0%, 100% 0%, 100% 100%, 70% 100%);
        }
      `}</style>
      <h1 className={`double-cut-h1-${instanceId}`} data-text={config.text}>
        <span className={`double-cut-span-${instanceId}`}>{config.text}</span>
      </h1>
    </div>
  );
});
