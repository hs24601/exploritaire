import {HeroLoading} from '../ui/HeroLoader';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { LIGHT_MOTES, MOTE_IDS } from '../proto/rules/lightMoteData';
import { apCap } from '../proto/rules/battle';
import { ROAM_RESCUE_SAVE, crimsonLoot, decodeRoamRescue, initialRoamRescue, roamRescueReducer, type RoamRescueAction } from './roamRescue';
import { FogMap } from './RescueFogMap';
import { RescueReward } from './RescueReward';
import { RunMenu } from './RunMenu';
import '../proto/components/CombatSandbox.css';
import './SceneRunVariant.css';
import './RoamRescue.css';

const noSelection = () => {};
const BattleTableauField = lazy(() => import('../proto/components/BattleTableauField').then(module => ({ default: module.BattleTableauField })));
function load() { try { return decodeRoamRescue(localStorage.getItem(ROAM_RESCUE_SAVE)) ?? initialRoamRescue(); } catch { return initialRoamRescue(); } }

export function RoamRescueVariant() {
  const [state, setState] = useState(load), live = useRef(state);
  const [loadout, setLoadout] = useState(false), [saveError, setSaveError] = useState(false);
  // Synchronous interception prevents a walking route crossing a pending encounter.
  const send = useCallback((action: RoamRescueAction) => {
    const next = roamRescueReducer(live.current, action);
    if (next !== live.current) { live.current = next; setState(next); }
    return next;
  }, []);
  const step = useCallback((position: {x:number;y:number}) => send({ type:'step', position }), [send]);
  useEffect(() => { try { localStorage.setItem(ROAM_RESCUE_SAVE, JSON.stringify(state)); setSaveError(false); } catch { setSaveError(true); } }, [state]);
  useEffect(() => {
    if (!state.notice) return;
    const timer = window.setTimeout(() => send({ type: 'dismiss' }), 4400);
    return () => window.clearTimeout(timer);
  }, [state.notice, send]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.code === 'Escape') setLoadout(false); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  const e = state.encounter, loot = e?.kind === 'red' ? crimsonLoot(state) : undefined;
  const verdant = e?.kind === 'surge' && [1,3].includes(state.returnEncounters);
  return <main className="roam-rescue" data-phase={e ? 'fight' : state.safe ? 'safe' : state.joined ? 'return' : 'outward'}>
    {!e && <FogMap state={state} onStep={step}/>}
    {!e && <>
      <button type="button" className="roam-pocket" aria-label="Party and motes" aria-expanded={loadout} onClick={() => setLoadout(v => !v)}>
        ♥ {state.hero.hp}{state.demi ? ` · ${state.demi.hp}` : ''}{state.haul['frost-mote'] ? `　❄ ${state.haul['frost-mote']}` : ''}{state.safe ? '　⌂ ✓' : ''}
      </button>
      {loadout && <div className="roam-motes" role="dialog" aria-label="Party and motes">
        <button type="button" className="roam-motes__close" onClick={() => setLoadout(false)} aria-label="Close party">×</button>
        <p className="roam-supplies">Wood {state.supplyHaul?.wood ?? 0} · Stone {state.supplyHaul?.stone ?? 0}<br/>Banked: Wood {state.supplies?.wood ?? 0} · Stone {state.supplies?.stone ?? 0}</p>
        {(['hero', 'demi'] as const).map(who => { const actor = state[who]; return actor && <div key={who}>
          <span>{actor.name}　♥ {actor.hp}/{actor.maxHp}{apCap(actor) > 0 ? `　AP ${apCap(actor)}` : ''}</span>
          <div>{MOTE_IDS.filter(id => (actor.lightMotes?.[id] ?? 0) > 0).map(id => <button type="button" key={id} data-transfer={who + '-' + id} disabled={!state.demi || state.safe || Boolean(state.pendingFrost)}
            title={`${LIGHT_MOTES[id].description} +1 max AP. Transfer one to ${who === 'hero' ? 'Demi' : 'Hero'}.`}
            onClick={() => send({ type: 'transfer', id, from: who })}>{LIGHT_MOTES[id].glyph} ×{actor.lightMotes![id]} {state.demi && !state.safe ? '⇄' : ''}</button>)}</div>
          {(actor.lightMotes?.['frost-mote'] ?? 0) >= 2 && <small>{who === 'hero' ? 'Ice Climber' : 'Glacial Armor'}</small>}
        </div>; })}
      </div>}
    </>}
    {e && <div className="roam-battle scene-run"><div className="combat-sandbox scene-combat"><div className="proto-tableau-field proto-tableau-field--combat">
      <Suspense fallback={<HeroLoading className="roam-battle-loading">Preparing battle…</HeroLoading>}><BattleTableauField key={`${state.attempts}:${e.id}`} sandbox active hours={0} lights={[]} onWatch={noSelection} encounter={{ recipes: true, suppressCompletion: true,
        initialState: e.battle, onChange: battle => send({ type: 'battle', id: e.id, battle }), onComplete: noSelection }}/></Suspense>
    </div></div>{e.battle.result && (e.battle.result === 'won' ? <RescueReward title={loot ? loot.phoenix ? 'Heart of the Phoenix' : 'Building supplies' : e.kind === 'boss' ? 'Demi' : verdant ? 'Verdant Mote' : 'Recovery'}
      mote={verdant ? 'verdant-mote' : undefined} tier={loot?.phoenix ? loot.tier : undefined}
      description={(loot ? loot.description + ' ' : e.kind === 'boss' ? 'Demi joins your party with 24 HP. Return to the den together. ' : verdant ? 'Gain 1 Verdant Mote and +1 max AP. Every 6 tableau receipts, heal 1 HP. ' : '') + 'Restore 3 HP to each living ally.'}
      onApply={() => send({type:'continue'})}/> : <button type="button" className="roam-continue" onClick={() => send({type:'continue'})}>Return to den</button>)}</div>}
    {state.pendingFrost && <RescueReward title="Mote of Frost" mote="frost-mote" description="Gain 1 Frost Mote and +1 max AP. Gain 1 ice armor at turn end, up to 6. Two Frost motes unlock the holder’s Frost recipe." onApply={() => send({type:'claim-frost'})}/>}
    <RunMenu onRestart={() => send({ type: 'restart' })} onPurge={() => send({ type: 'purge' })}
      purgeWarning="Erase all saved progress, including banked motes, supplies, recipes and Demi's safety? This cannot be undone."/>
    {(state.notice || saveError) && <div className="roam-notice" role="status">{saveError ? 'Saving unavailable' : state.notice}</div>}
  </main>;
}

