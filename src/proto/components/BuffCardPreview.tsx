import { useLayoutEffect, useRef, useState } from 'react';
import { TradingCard } from './TradingCard';
import { useCardJumbo } from './CardJumbo';
import { MoteOrb } from './MoteOrb';
import { isLightMote } from '../rules/lightMoteData';
import { gameTime } from '../../gameTime';
import './BuffCardPreview.css';

/** A held buff first opens a nearby physical card; a deliberate tap enlarges it. */
export function BuffCardPreview({ anchor, text, onClose }: { anchor: HTMLElement; text: string; onClose: () => void }) {
  const jumbo = useCardJumbo(), [position, setPosition] = useState({ left: 8, top: 8 });
  const host = useRef<HTMLElement>(null);
  const id = anchor.dataset.status ?? anchor.dataset.buff ?? 'buff';
  const title = anchor.dataset.tooltipTitle || anchor.getAttribute('aria-label')?.split(' · ')[0] || 'Buff';
  const art = isLightMote(id) ? <MoteOrb id={id}/> : <span className="buff-card-preview__glyph" aria-hidden="true">{anchor.querySelector('span')?.textContent || anchor.textContent?.replace(/\d+/g, '').trim() || '✦'}</span>;
  const face = (large = false) => <TradingCard id={'buff-'+id} title={title} art={art} hideBody={!large} state={large ? 'jumbo' : 'compact'} interactive={false} description={large ? text : undefined}/>;
  useLayoutEffect(() => {
    const place = () => { const r = anchor.getBoundingClientRect(), width = Math.min(210, innerWidth - 16), height = host.current?.getBoundingClientRect().height ?? 390; setPosition({ left: Math.max(8, Math.min(innerWidth - width - 8, r.right + width + 12 < innerWidth ? r.right + 12 : r.left - width - 12)), top: Math.max(8, Math.min(innerHeight - height - 8, r.top - 80)) }); };
    place(); window.addEventListener('resize', place); const release = gameTime.hold();
    return () => { window.removeEventListener('resize', place); release(); };
  }, [anchor]);
  return <aside id="combat-buff-card" ref={host} className="buff-card-preview" style={position} aria-label={`${title} card`}>
    <button type="button" className="buff-card-preview__close" aria-label="Close buff card" onClick={onClose}>×</button>
    <button type="button" className="buff-card-preview__card" aria-label={`Enlarge ${title}`} onClick={() => jumbo?.open({ title, content: face(true) })}>{face()}</button>
    <p>{text}</p>
  </aside>;
}
