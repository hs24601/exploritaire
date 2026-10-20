import { useState } from 'react';
import type { TravelCard } from '../travelJourney';
import { cardBackgroundFallback } from '../biomeCardArt';
import { useArtStyle } from '../artStyle';
import { ProtoCard } from './ProtoCard';
import { KhadRoots, KhadRootLinks, type KhadGeometryVersion, type KhadPaintMode } from './KhadRoots';
import './KhadCompare.css';

type Variant = { id: string; version: KhadGeometryVersion; paint: KhadPaintMode; label: string };
const VERSIONS: Variant[] = [
  { id: 'v1', version: 'v1', paint: 'svg', label: 'v1 · frozen' },
  { id: 'v2', version: 'v2', paint: 'svg', label: 'v2 · grown' },
  { id: 'v2p', version: 'v2', paint: 'painted', label: 'v2 · bark-plate painted' },
];

/** Proto review view (`?khad-compare`): the same rooted cards drawn with the
 * frozen first Khad Roots growth, the grown version, and the grown version
 * with the bark-plate painter side by side, on real
 * card faces at game size and enlarged, plus a group link. Review tooling only;
 * bindings, clearance and release rules are unchanged. */
export function KhadCompare() {
  const artStyle = useArtStyle();
  const [base, setBase] = useState(0);
  const [scale, setScale] = useState(2);
  const [obscure, setObscure] = useState(false);
  const ids = Array.from({ length: 4 }, (_, i) => `khad-compare-${base + i}`);
  const card = (id: string, rank: number): TravelCard => ({ id, rank, segment: 0, kind: 'berry-patch', khadRoot: { groupId: 'compare', obscureValue: obscure } });
  // Bake density follows the displayed size, so enlarged views stay crisp.
  const density = Math.min(6, Math.max(2.4, scale * 1.8 * Math.min(2, globalThis.devicePixelRatio || 1)));
  const face = (id: string, rank: number, v: Variant) => <div className="khad-compare__card" key={v.id}>
    <ProtoCard card={card(id, rank)} allowJumbo={false} disabled centerRank background={cardBackgroundFallback('berry-patch', artStyle)} actionLabel="Rooted card" />
    <KhadRoots groupId="compare" cardId={id} obscureValue={obscure} version={v.version} paint={v.paint} density={density} />
  </div>;
  // Two posed cards joined by one group link, as the dense patch lays them out.
  const linked = (v: Variant) => {
    const cards: TravelCard[] = [{ ...card(`khad-link-${base}-a`, 7), pose: { x: 0, y: .2, rotation: -6, layer: 1 } }, { ...card(`khad-link-${base}-b`, 9), pose: { x: 1.9, y: .7, rotation: 5, layer: 1 } }];
    return <div className="khad-compare__group" key={v.id}>
      <KhadRootLinks cards={cards} version={v.version} paint={v.paint} density={density} />
      {cards.map(c => <div key={c.id} className="khad-compare__posed" style={{ left: `calc(var(--classic-card-w) * ${c.pose!.x})`, top: `calc(var(--classic-card-w) * ${c.pose!.y})`, transform: `rotate(${c.pose!.rotation}deg)` }}>
        <ProtoCard card={c} allowJumbo={false} disabled centerRank background={cardBackgroundFallback('berry-patch', artStyle)} actionLabel="Rooted card" />
        <KhadRoots groupId="compare" cardId={c.id} obscureValue={obscure} version={v.version} paint={v.paint} density={density} />
      </div>)}
    </div>;
  };
  return <main className="khad-compare">
    <header className="khad-compare__header">
      <h1>Khad Roots · v1 frozen · v2 grown · v2 painted</h1>
      <button onClick={() => setBase(b => Math.max(0, b - 4))}>Previous cards</button>
      <button onClick={() => setBase(b => b + 4)}>Next cards</button>
      <label>Size<select value={scale} onChange={e => setScale(Number(e.target.value))}><option value={1}>Game size</option><option value={2}>2×</option><option value={3}>3×</option></select></label>
      <label><input type="checkbox" checked={obscure} onChange={e => setObscure(e.target.checked)} />obscureValue opt-in</label>
      <a href="proto.html">Proto</a>
    </header>
    <p className="khad-compare__note">Same card identities on both sides. In the game, <code>?khad-geometry=v1</code> shows the frozen version in place and <code>?khad-paint=svg</code> shows the SVG pigment instead of the bark-plate painter (the default). Painted cards show the SVG until their bake is ready.</p>
    <div className="khad-compare__body" style={{ ['--compare-scale' as string]: scale }}>
      {ids.map((id, i) => <section key={id} className="khad-compare__row" aria-label={`Card ${id}`}>
        {VERSIONS.map(v => <figure key={v.id}><figcaption>{v.label} · {id}</figcaption>{face(id, (i * 3) % 13 + 1, v)}</figure>)}
      </section>)}
      <section className="khad-compare__row" aria-label="Group link">
        {VERSIONS.map(v => <figure key={v.id}><figcaption>{v.label} · group link</figcaption>{linked(v)}</figure>)}
      </section>
    </div>
  </main>;
}
