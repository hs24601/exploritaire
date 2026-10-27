import { useState, type CSSProperties } from 'react';
import { KERU_DRAFTS, KERU_DRAFT_ART, KERU_ABILITIES, type KeruDraft } from '../keruDrafts';
import demNatural from '../../../artifacts/dem-style-v3/dem-natural-v1.png';
import { TradingCard } from './TradingCard';
import { KeruAbilityArt } from './AbilityCardFace';
import { HeroEmoji } from './HeroEmoji';
import { MochiEmoji } from './MochiEmoji';
import { MomentumIcon } from './MomentumIcon';
import './DemDraftSandbox.css';
import './KeruDraftSandbox.css';

const targetName = { hero: 'Hero', mochi: 'Mochi', enemy: 'Enemy', self: 'Dem (self)', 'all-enemies': 'All affected enemies' };

function DraftPreview({ draft }: { draft: KeruDraft }) {
  const [showSubject, setShowSubject] = useState(true);
  const [showBackground, setShowBackground] = useState(true);
  const [natural, setNatural] = useState(false);
  const art = KERU_DRAFT_ART[draft.id];
  const usageLabel = { persistent: 'Persistent ability', 'single-use': 'Single-use ability', stance: 'Self-buff stance', temporary: 'Temporary ability', instant: 'Instant ability' };
  const abilities = KERU_ABILITIES.filter(ability => ability.keruId === draft.id).map(effect => ({ id: effect.id, effect, target: effect.targets[0], kind: usageLabel[effect.usage] }));
  return <div className="keru-abilities-workspace" style={{ '--keru-tint': draft.tint } as CSSProperties}>
    <section className="keru-drafts__notes"><h2>{draft.name} · {draft.element}</h2>
      <p className="keru-drafts__role">{draft.role}</p><p>{draft.identity}</p>
    </section>
    <div className="dem-draft__layers">
      <label><input type="checkbox" checked={showSubject} onChange={e => setShowSubject(e.target.checked)} />Character</label>
      <label><input type="checkbox" checked={showBackground} onChange={e => setShowBackground(e.target.checked)} />Watercolor background</label>
      {draft.id === 'dem' && <label><input type="checkbox" checked={natural} onChange={e => setNatural(e.target.checked)} />Natural Dem study</label>}
    </div>
    <section className="keru-abilities-grid" aria-label={draft.name + ' distinct abilities'}>
      {abilities.map(({ id, effect, target, kind }) => <article className="keru-ability-option" key={id} data-ability={draft.id + '-' + id}>
        <h3>{effect.name}</h3><p>{kind} · {target === 'enemy' ? 'Enemy target' : targetName[target]}</p>
        <div className="dem-draft__card keru-drafts__card" data-subject={showSubject} data-background={showBackground} data-keru={draft.id}>
          <TradingCard id={'keru-ability-' + draft.id + '-' + id} title={draft.name + ' · ' + effect.name} className="ability-holo-stage" finish="diagonal-holo"
            art={<KeruAbilityArt subject={draft.id === 'dem' && natural ? demNatural : art.subject} background={art.background} label={draft.name + ' · ' + effect.name} />}
            description={effect.text}
            headerAction={<span className="dem-draft__cost" aria-label={effect.cost + ' Momentum'}><MomentumIcon /><b>{effect.cost}</b></span>}
            cornerAdornment={target === 'hero' || target === 'mochi' ? <span className="ability-keru-target" role="img" aria-label={'Target: ' + targetName[target]}>
              {target === 'hero' ? <HeroEmoji emotion="happy" /> : <MochiEmoji emotion="happy" />}
            </span> : undefined} />
        </div>
        <details><summary>Resolution notes</summary><p>{effect.rules}</p></details>
      </article>)}
    </section>
    <section className="keru-drafts__notes"><h3>RPG inspiration</h3><p>{draft.inspiration}</p>
      <h3>Synergies</h3><ul>{draft.synergies.map(text => <li key={text}>{text}</li>)}</ul>
      <h3>Tradeoff</h3><p>{draft.tradeoff}</p>
      <p>Distinct abilities are available for authoring/playtesting without unlock requirements. Cir's three abilities are playable in the combat sandbox. The other six Keru retain proposed mechanics; the gallery does not resolve combat.</p>
    </section>
  </div>;
}

/** Layered design gallery, deliberately outside combat execution and save state. */
export function KeruDraftSandbox({ initialElement }: { initialElement?: string } = {}) {
  const [selected, setSelected] = useState(() => {
    const element = new URLSearchParams(window.location.search).get('element') ?? initialElement;
    return KERU_DRAFTS.find(d => d.element.toLowerCase() === element)?.id ?? 'bri';
  });
  const draft = KERU_DRAFTS.find(d => d.id === selected)!;
  const select = (id: string) => {
    setSelected(id);
    const url = new URL(window.location.href);
    url.searchParams.set('element', KERU_DRAFTS.find(d => d.id === id)!.element.toLowerCase());
    window.history.replaceState(null, '', url);
  };
  return <main className="dem-draft keru-drafts">
    <header className="keru-drafts__heading"><h1>Elemental Keru drafts</h1><p>Seven elemental creatures · layered watercolor designs</p></header>
    <nav className="keru-drafts__selection" aria-label="Elemental Keru">
      {KERU_DRAFTS.map(d => <button key={d.id} type="button" aria-pressed={d.id === selected} onClick={() => select(d.id)}><strong>{d.name}</strong><span>{d.element}</span></button>)}
      <a href={`${import.meta.env.BASE_URL}proto.html?demsbx`}>Dem · Ice preview</a>
    </nav>
    <DraftPreview key={draft.id} draft={draft} />
  </main>;
}
