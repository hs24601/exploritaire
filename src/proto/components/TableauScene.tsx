import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BIOME_EDGE_SCENERY } from '../protoData';
import type { TableauLightRig } from '../tableauLighting';
import { getTableLighting, rgba } from '../protoLighting';
import { detectFxQuality } from '../atmosphere';
import { SpriteStandeeArt } from './SpriteStandee';

/** Decoration stays behind the cards and never participates in hit testing. */
export function TableauScene({ children, immersive, terrain, rig, hours, fillScenery = false }: {
  children: ReactNode; immersive: boolean; terrain: 'woods' | 'water'; rig: TableauLightRig; hours: number; fillScenery?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [sceneryHeight, setSceneryHeight] = useState(150);
  useEffect(() => {
    if (!fillScenery || !ref.current) return;
    const observer = new ResizeObserver(([entry]) => setSceneryHeight(entry.contentRect.height * .9));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [fillScenery]);
  const sky = getTableLighting(hours);
  const props = BIOME_EDGE_SCENERY[terrain];
  // The effects tier is fixed for the session, as on the table.
  const [particles] = useState(() => detectFxQuality() === 'high');
  const move = (x: number, y: number) => {
    const el = ref.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--scene-pan-x', `${(x - rect.left - rect.width / 2) / rect.width * 10}px`);
    el.style.setProperty('--scene-pan-y', `${(y - rect.top - rect.height / 2) / rect.height * 5}px`);
  };
  return <div ref={ref} className={`proto-tableau-scene${immersive ? ' proto-tableau-scene--immersive' : ''}`} data-terrain={terrain}
    style={{ '--scene-sky': rgba(sky.skyTint, 0.5), '--scene-ray': rgba(sky.sunColor, 0.09 + sky.twilight * 0.1) } as CSSProperties}
    onPointerMove={event => move(event.clientX, event.clientY)} onPointerLeave={() => {
      ref.current?.style.setProperty('--scene-pan-x', '0px'); ref.current?.style.setProperty('--scene-pan-y', '0px');
    }}>
    {immersive && <div className="proto-tableau-scenery" aria-hidden="true">
      <span className="proto-tableau-fixture" />
      <div className="proto-tableau-scenery__rays" />
      <div className="proto-tableau-scenery__ground" />
      {[0, 1, 2].map(layer => <div key={layer} className={`proto-tableau-scenery__layer proto-tableau-scenery__layer--${layer}`}>
        {[0, 1, 2, 3, 4, 5, 6].map(index => {
          const x = (index - 3) * 34, y = -70 + layer * 30;
          // A receding forest of complete tree clusters, rather than stretching
          // the tiny edge-prop sprite into a wall across the whole field.
          const sprite = fillScenery && terrain === 'woods'
            ? `${import.meta.env.BASE_URL}assets/biomes/small_woods_pines.png`
            : layer === 2 ? props.front.src : props.side.src;
          const size = fillScenery ? Math.min(220, sceneryHeight * .48) * (.82 + layer * .12) * (.88 + (index % 3) * .08) : layer === 2 ? 70 : 150;
          return <span key={index} className="proto-tableau-scenery__prop" style={fillScenery
            ? { left: `${index * 17 + (layer % 2 ? 7 : 0)}%`, bottom: `${[60,32,3][layer] + (index % 3) * 2}%`, width: size, height: size, transform: 'translateX(-50%)' }
            : { left: `${index * 17 - 2}%`, bottom: `${8 + (index % 3) * 5}%`, width: layer === 2 ? 70 : 88, height: layer === 2 ? 55 : 150 }}>
            <SpriteStandeeArt sprite={sprite} lighting={rig.standee(x, y, 88)} size={size} />
          </span>;
        })}
      </div>)}
      <div className="proto-tableau-scenery__mist" />
      {particles && <div className="proto-tableau-scenery__motes">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} style={{ left: `${12 + i * 15}%`, top: `${25 + i % 3 * 20}%`, animationDelay: `${-i * 1.7}s` }} />)}</div>}
    </div>}
    {children}
  </div>;
}
