import { memo, useState } from 'react';

const CARDS = [
  { id: 1, front: '/assets/Bluevee.png' },
  { id: 2, front: '/assets/actors/fox_cub.png' },
  { id: 3, front: '/assets/actors/wolf_cub.png' },
];

const BACK_IMAGE = '/assets/Blueevee.png';

export const MidairFlipDemo = memo(function MidairFlipDemo() {
  const [flippedStates, setFlippedIds] = useState<Record<number, boolean>>({});

  const toggleFlip = (id: number) => {
    setFlippedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="h-full flex items-center justify-center bg-[#003d52] rounded-xl overflow-hidden relative" style={{ perspective: '1000px' }}>
      <style>{`
        .midair-board {
          --card-width: min(120px, 15vmin);
          display: flex;
          align-items: center;
          justify-content: center;
          width: calc(4 * var(--card-width));
          box-sizing: content-box;
          aspect-ratio: 16/9;
          transform: rotateX(60deg);
          border: 4px solid black;
          border-radius: 16px;
          padding: 1rem 3rem;
          background: hsl(201deg, 100%, 32%);
          transform-style: preserve-3d;
          position: relative;
        }

        .midair-card {
          --duration: 1200ms;
          position: absolute;
          width: var(--card-width);
          aspect-ratio: 20/29;
          outline: none;
          border: none;
          cursor: pointer;
          padding: 0;
          background-color: transparent;
          transition: transform 200ms;
          pointer-events: none;
          transform-style: preserve-3d;
        }

        /* Initial positions (stacked) */
        .midair-card:nth-child(1) { transform: translateZ(3px); }
        .midair-card:nth-child(2) { transform: translateZ(6px); }
        .midair-card:nth-child(3) { transform: translateZ(9px); }

        .midair-card.flipped:nth-child(1) { transform: translateZ(9px); }
        .midair-card.flipped:nth-child(2) { transform: translateZ(6px); }
        .midair-card.flipped:nth-child(3) { transform: translateZ(3px); }

        .midair-wrapper {
          pointer-events: initial;
          display: block;
          position: relative;
          height: 100%;
          transition: all var(--duration) ease-out;
          transform-origin: 200% 50%;
          transform-style: preserve-3d;
        }

        .midair-content {
          display: block;
          height: 100%;
          transition: all var(--duration);
          transform-style: preserve-3d;
        }

        .midair-face {
          transition: transform calc(var(--duration) * 3 / 4);
          transition-delay: calc(var(--duration) / 6);
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          border-radius: calc(var(--card-width) / 20);
          background-size: cover;
          background-position: center;
          background-color: white;
        }

        .midair-front {
          transform: rotateZ(0.5turn) rotateY(-0.5turn);
          border: 1px solid black;
        }

        .midair-back {
          background-image: url("${BACK_IMAGE}");
          border: 1px solid black;
        }

        .midair-card.flipped .midair-wrapper {
          transform: rotateY(0.5turn);
        }

        .midair-card.flipped .midair-content {
          transform: rotateX(-0.5turn) rotateY(1.5turn);
        }
      `}</style>

      <article className="midair-board">
        {CARDS.map((card, idx) => (
          <button 
            key={card.id}
            className={`midair-card ${flippedStates[card.id] ? 'flipped' : ''}`}
            onClick={() => toggleFlip(card.id)}
          >
            <span className="midair-wrapper">
              <span className="midair-content">
                <span className="midair-face midair-back"></span>
                <span className="midair-face midair-front" style={{ backgroundImage: `url(${card.front})` }}></span>
              </span>
            </span>
          </button>
        ))}
      </article>
    </div>
  );
});
