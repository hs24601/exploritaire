import { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';

type Props = {
  className?: string;
};

type SparkSpec = {
  tx: number;
  ty: number;
  duration: number;
  delay: number;
  size: number;
};

export const SpawnNaviEffect = memo(function SpawnNaviEffect({ className }: Props) {
  const sparks = useMemo<SparkSpec[]>(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        tx: (Math.random() - 0.5) * 320,
        ty: (Math.random() - 0.5) * 320,
        duration: 1.6 + Math.random() * 1.1,
        delay: -(i * 0.11),
        size: 10 + Math.random() * 6,
      })),
    []
  );

  return (
    <div className={`navi-root w-full h-full ${className ?? ''}`}>
      <style>{`
        .navi-root {
          position: relative;
          overflow: hidden;
          background: linear-gradient(to bottom, #0a2342 0%, #283e51 100%);
        }
        .navi-frame {
          position: absolute;
          inset: -15% -5%;
          background: radial-gradient(ellipse at center, rgba(30,50,66,0.42) 0%, rgba(10,20,28,0.78) 100%);
        }
        .navi-fairy-container {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: navi-move 12s ease-in-out infinite;
        }
        .navi-heart-container {
          position: absolute;
          width: 58px;
          height: 58px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          border: solid 1px #f6edd1;
          background: radial-gradient(circle, #ffffff 35%, #f6edd1 100%);
          box-shadow: 0 0 12px 6px #e8c8a1, 0 0 36px 16px hotpink;
          animation: navi-bounce 1.5s ease-in-out infinite;
        }
        .navi-wing-container {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 220px;
          height: 220px;
          transform: translate(-50%, -50%);
          animation: navi-bounce 1.5s ease-in-out infinite;
        }
        .navi-wing-side {
          position: absolute;
          inset: 0;
        }
        .navi-wing-side-left {
          animation: navi-rotation-left 12s ease-in-out infinite;
        }
        .navi-wing-side-right {
          animation: navi-rotation-right 12s ease-in-out infinite;
        }
        .navi-wing-container-top,
        .navi-wing-container-bottom {
          position: absolute;
          inset: 0;
          animation: navi-flap 0.55s ease-in-out infinite;
          transform-style: preserve-3d;
        }
        .navi-wing {
          position: absolute;
          opacity: 0.65;
        }
        .navi-wing-top {
          border-radius: 40%;
          bottom: 50%;
          width: 72px;
          height: 97px;
          background: radial-gradient(ellipse at bottom, #ffffff 25%, #3d966e 100%);
        }
        .navi-wing-bottom {
          border-radius: 45%;
          top: 50%;
          width: 64px;
          height: 72px;
          background: radial-gradient(ellipse at top, #ffffff 25%, #3d966e 100%);
        }
        .navi-wing-side-left .navi-wing {
          right: calc(50% + 11px);
          transform-origin: right;
        }
        .navi-wing-side-right .navi-wing {
          left: calc(50% + 11px);
          transform-origin: left;
        }
        .navi-wing-side-left .navi-wing-top {
          transform: skew(20deg, 30deg);
        }
        .navi-wing-side-left .navi-wing-bottom {
          transform: skew(-25deg, -10deg);
        }
        .navi-wing-side-right .navi-wing-top {
          transform: skew(-20deg, -30deg);
        }
        .navi-wing-side-right .navi-wing-bottom {
          transform: skew(25deg, 10deg);
        }
        .navi-spark-container {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .navi-spark {
          position: absolute;
          left: 50%;
          top: 50%;
          border-radius: 50%;
          width: var(--spark-size, 12px);
          height: var(--spark-size, 12px);
          background: #f6edd1;
          opacity: 0;
          box-shadow: 0 0 12px rgba(246, 237, 209, 0.6);
          animation: navi-spark var(--spark-duration, 2s) linear infinite;
          animation-delay: var(--spark-delay, 0s);
        }
        .navi-label {
          position: absolute;
          inset: 0;
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .navi-label span {
          color: rgba(127, 219, 202, 0.3);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
        }
        @keyframes navi-move {
          0%, 100% { transform: translate(calc(-50% + 87px), calc(-50% + 87px)); }
          50% { transform: translate(calc(-50% - 87px), calc(-50% - 87px)); }
        }
        @keyframes navi-bounce {
          0%, 100% { transform: translate(-50%, calc(-50% + 14px)); }
          50% { transform: translate(-50%, calc(-50% - 14px)); }
        }
        @keyframes navi-rotation-left {
          0%, 100% { transform: perspective(290px) translateX(-14px) rotateY(10deg); }
          50% { transform: perspective(290px) translateX(0) rotateY(-80deg); }
        }
        @keyframes navi-rotation-right {
          0%, 100% { transform: perspective(290px) translateX(0) rotateY(80deg); }
          50% { transform: perspective(290px) translateX(14px) rotateY(-10deg); }
        }
        @keyframes navi-flap {
          0%, 100% { transform: rotateX(-5deg) rotateY(-35deg); }
          50% { transform: rotateX(5deg) rotateY(35deg); }
        }
        @keyframes navi-spark {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1);
            background: #f6edd1;
          }
          50% { opacity: 0.92; }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--spark-tx, 0px)), calc(-50% + var(--spark-ty, 0px))) scale(0);
            background: hotpink;
          }
        }
      `}</style>
      <div className="navi-frame" />
      <div className="navi-fairy-container">
        <div className="navi-wing-container">
          <div className="navi-wing-side navi-wing-side-left">
            <div className="navi-wing-container-top">
              <div className="navi-wing navi-wing-top" />
            </div>
            <div className="navi-wing-container-bottom">
              <div className="navi-wing navi-wing-bottom" />
            </div>
          </div>
          <div className="navi-wing-side navi-wing-side-right">
            <div className="navi-wing-container-top">
              <div className="navi-wing navi-wing-top" />
            </div>
            <div className="navi-wing-container-bottom">
              <div className="navi-wing navi-wing-bottom" />
            </div>
          </div>
        </div>
        <div className="navi-spark-container">
          {sparks.map((spark, index) => (
            <div
              key={`navi-spark-${index}`}
              className="navi-spark"
              style={
                {
                  '--spark-tx': `${spark.tx.toFixed(2)}px`,
                  '--spark-ty': `${spark.ty.toFixed(2)}px`,
                  '--spark-duration': `${spark.duration.toFixed(2)}s`,
                  '--spark-delay': `${spark.delay.toFixed(2)}s`,
                  '--spark-size': `${spark.size.toFixed(2)}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="navi-heart-container" />
      </div>
      <div className="navi-label">
        <span>Active Effect: spawn_navi</span>
      </div>
    </div>
  );
});
