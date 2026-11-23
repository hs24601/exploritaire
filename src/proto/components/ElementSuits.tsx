import { ELEMENT_FACE, elementPlayReady, actorElements, type Element } from '../rules/elementSuits';
import type { BattleState } from '../rules/battle';
import './ElementSuits.css';

/** Shared authored watercolor suit art; the wrapper retains its accessible name. */
export const ElementGlyph = ({ element }: { element: Element }) =>
  <span className="element-glyph" data-element={element} role="img" aria-label={ELEMENT_FACE[element].name}>{element==='ice'
    ? ELEMENT_FACE.ice.glyph : <img src={`${import.meta.env.BASE_URL}assets/runtime/ui/element-suits/${element}-v1.png`} alt="" aria-hidden="true" draggable={false} />}</span>;

/** The team-wide element play: one pip, lit while it is unspent this party turn. */
export function ElementCharge({ battle }: { battle: BattleState }) {
  const ready = elementPlayReady(battle);
  const kin = battle.party.flatMap(actor => { const elements = actorElements(battle,actor.id); return elements.length ? [`${actor.name}: ${elements.map(e=>ELEMENT_FACE[e].name).join('/')}`] : []; }).join(', ');
  const cir=battle.party.some(a=>a.id==='cir')?` Cir’s own Fire/Air bridge is ${battle.keruElementSpent?.includes('cir')?'spent':'ready'}.`:'';
  const text = (ready ? `Team element play ready. ${kin || 'No allied affinity yet.'} A matching card may play at any rank.` : 'Team element play spent: returns next party turn. ±1 plays are unaffected.')+cir;
  return <span className="element-charge" data-ready={ready || undefined} tabIndex={0} role="img" aria-label={text} title={text}>
    <span className="element-charge__pip" aria-hidden="true" /><span className="element-charge__label" aria-hidden="true">Element</span>
  </span>;
}
