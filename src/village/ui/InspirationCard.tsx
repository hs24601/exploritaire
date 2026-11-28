import type { CSSProperties } from 'react';
import { TradingCard } from '../../proto/components/TradingCard';
import { IMPROVED_DEN_WOOD } from '../rules/den';
import { useDrag } from './drag';

const SCENERY = '/assets/runtime/environment/watercolor/v1/';
const DEN = '/assets/runtime/village/simple-den/v1/';

export function InspirationHolocard({ improve = false, motion = 'pointer' }: {
  improve?: boolean; motion?: 'pointer' | 'parent' | 'static';
}) {
  return <TradingCard id={improve ? 'improved-den-inspiration' : 'simple-den-inspiration'}
    title={improve ? 'Improved Den' : 'Simple Den'}
    className="vg-inspiration-holocard" hideBody interactive={motion === 'pointer'} motionFromParent={motion === 'parent'}
    art={<div className="vg-inspiration-art" aria-hidden="true">
      <img className="vg-inspiration-land" src={SCENERY + 'woodland-ground-v1.png'} alt="" draggable={false} />
      <img className="vg-inspiration-subject" src={improve ? SCENERY + 'hero-den-sprite-v2.png' : DEN + 'puzzle-complete.png'} alt="" draggable={false} />
      <img className="vg-inspiration-relief" src={SCENERY + 'stone-spill-v1.png'} alt="" draggable={false} />
      <img className="vg-inspiration-understory" src={SCENERY + 'manaberry-sparse-standee-empty-v1.png'} alt="" draggable={false} />
      <img className="vg-inspiration-foreground" src={SCENERY + 'berry-patch-sprite-empty-v1.png'} alt="" draggable={false} />
    </div>}
    footer={<div className="vg-inspiration-caption"><span>Inspiration Card</span>
      <strong>{improve ? `${IMPROVED_DEN_WOOD} wood · Dig` : 'Dig · 1 resident'}</strong></div>} />;
}

export function InspirationCard({ improve, seed, armed, onArm, onPlace }: {
  improve: boolean; seed: number; armed: boolean; onArm: () => void; onPlace: (tile: number) => void;
}) {
  const { begin } = useDrag();
  return <button type="button" className="vg-inspiration-placement" aria-pressed={armed}
    aria-label={`${improve ? 'Improved Den' : 'Simple Den'} Inspiration Card`}
    style={{ '--inspiration-tilt': `${seed % 9 - 4}deg` } as CSSProperties}
    title={improve ? 'Apply to the finished Simple Den' : 'Drag onto an open plot, or select the card and then choose a plot'}
    onClick={event => { if (event.detail === 0) onArm(); }}
    onPointerDown={event => {
      const width = event.currentTarget.offsetWidth;
      begin(event, { kind: 'inspiration-card', id: 'den', anchor: 'top-left',
        ghost: <InspirationHolocard improve={improve} motion="static" />, width, height: width * 88 / 63 },
      (_, hit) => { if (hit.drop === 'tile') onPlace(hit.index); }, onArm);
    }}><InspirationHolocard improve={improve} motion="parent" /></button>;
}
