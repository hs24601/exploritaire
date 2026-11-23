/** Rally and Break battle table: play receipts until nothing is legal, then watch each enemy act one step at a time. */
import { useEffect, useState } from 'react';
import { KIN } from './rules/cityRules';
import {
  alive, canPlayOnFighter, canPlayOnIntent, canUseAbility, endPartyTurn, enemyStep, exposedRank, intentDamage, partyHasMove,
  playOnFighter, playOnIntent, setTarget, useAbility, AP_CAP, type Battle,
} from './rules/combatRules';
import { RANK_LABEL } from './rules/golfRules';
import { startDrag } from './cityDrag';
import { FoePortrait, KinPortrait } from './cityArt';
import { CardFace, FitBox } from './GatherTable';

const STEP_MS = 700;

export function BattleTable({ initial, title, onFinish }: { initial: Battle; title: string; onFinish: (b: Battle) => void }) {
  const [b, setB] = useState(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [wiggle, setWiggle] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  const anyAbility = b.fighters.some((x, f) => x.ap >= KIN[x.kin].ability.cost && alive(x) && (b.foes.some((_, i) => canUseAbility(b, f, { foe: i })) || b.fighters.some((_, a) => canUseAbility(b, f, { ally: a }))));
  const noCards = b.turn === 'party' && !b.result && !partyHasMove(b);

  // Enemy turn: one visible action per step.
  useEffect(() => {
    if (b.turn !== 'enemy' || b.result || paused) return;
    setPicked(null);
    const t = setTimeout(() => setB(x => enemyStep(x)), STEP_MS);
    return () => clearTimeout(t);
  }, [b, paused]);
  // No card moves left and nothing affordable: the enemy takes its turn.
  useEffect(() => {
    if (!noCards || anyAbility || paused) return;
    const t = setTimeout(() => setB(x => endPartyTurn(x)), STEP_MS);
    return () => clearTimeout(t);
  }, [noCards, anyAbility, paused]);

  const shake = (col: number) => { setWiggle(col); setTimeout(() => setWiggle(w => w === col ? null : w), 320); };
  const dropCard = (col: number, key: string) => {
    const [kind, idx] = key.split(':'); const i = Number(idx);
    const next = kind === 'fighter' ? playOnFighter(b, col, i) : kind === 'intent' ? playOnIntent(b, col, i) : null;
    if (next) { setB(next); setPicked(null); } else shake(col);
  };
  const tapCard = (col: number) => {
    if (b.turn !== 'party' || b.result) return;
    const targets = b.fighters.map((_, f) => f).filter(f => canPlayOnFighter(b, col, f));
    // One kin: a tap plays straight onto it. Two kin: tap the card, then the kin (or intent) to receive it.
    if (b.fighters.length === 1 && !b.foes.some(x => x.intent)) { if (targets.length) dropCard(col, 'fighter:0'); else shake(col); return; }
    setPicked(p => p === col ? null : col);
  };
  const tapReceiver = (key: string) => { if (picked !== null) dropCard(picked, key); };
  const dropAbility = (f: number, key: string) => {
    const [kind, idx] = key.split(':'); const i = Number(idx);
    const next = kind === 'foe' ? useAbility(b, f, { foe: i }) : kind === 'fighter' ? useAbility(b, f, { ally: i }) : null;
    if (next) setB(next);
  };

  return (
    <div className="city-overlay" role="dialog" aria-label={`Battle: ${title}`}>
      <div className="city-battle" data-turn={b.turn}>
        <header className="city-gather__bar">
          <strong className="city-battle__title">{title}</strong>
          <span className="city-battle__turn">Round {b.round} · {b.turn === 'party' ? 'Your turn' : 'Enemy turn'}</span>
          <span className="city-battle__log" role="status" aria-live="polite">{b.last?.text ?? ''}</span>
          <button type="button" className="city-btn" onClick={() => setPaused(p => !p)} aria-pressed={paused}>{paused ? 'Resume' : 'Pause'}</button>
          <button type="button" className="city-btn city-btn--brass" disabled={b.turn !== 'party' || !!b.result} onClick={() => setB(endPartyTurn(b))}>End Turn</button>
        </header>

        <FitBox className="city-felt" render={portrait => (
        <div className={`city-battle__field${portrait ? ' is-portrait' : ''}`}>
          <div className="city-battle__foes">
            {b.foes.map((x, i) => (
              <div key={i} className={`city-foe${alive(x) ? '' : ' is-down'}${b.target === i ? ' is-target' : ''}${b.last?.foe === i ? ' is-acting' : ''}`}>
                <button type="button" className="city-foe__body" data-drop={`foe:${i}`} onClick={() => setB(setTarget(b, i))} aria-label={`${x.name}, ${x.hp} of ${x.maxHp} HP. Target`}>
                  <FoePortrait kind={x.kind} label={x.name} />
                  <span className="city-plaque">{RANK_LABEL[x.rank]}</span>
                </button>
                <div className="city-foe__meta">
                  <b>{x.name}</b>
                  <Bar value={x.hp} max={x.maxHp} kind="hp" />
                  <Bar value={x.broken ? x.staggerMax : x.stagger} max={x.staggerMax} kind="stagger" label={x.broken ? 'Broken' : 'Stagger'} />
                </div>
                {x.intent && alive(x) && (
                  <button type="button" className="city-intent" data-drop={`intent:${i}`} onClick={() => tapReceiver(`intent:${i}`)} aria-label={`${x.intent.name}: ${x.intent.pips} of ${x.intent.capacity} pips, ${intentDamage(x.intent)} damage to all`}>
                    <span className="city-intent__name">{x.intent.name}</span>
                    <span className="city-intent__rank">{RANK_LABEL[x.intent.rank]}</span>
                    <span className="city-intent__pips">{Array.from({ length: x.intent.capacity }, (_, k) => <i key={k} className={k < x.intent!.pips ? 'on' : ''} />)}</span>
                    <span className="city-intent__dmg">{intentDamage(x.intent)} to all</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="city-battle__columns">
            {b.columns.map((cards, c) => (
              <div key={c} className="city-battle__column">
                {cards.map((rank, i) => {
                  const top = i === cards.length - 1;
                  return (
                    <div key={`${c}-${i}-${cards.length}`} className={`city-card${top ? ' is-top' : ''}${top && picked === c ? ' is-picked' : ''}${top && wiggle === c ? ' is-wiggle' : ''}${top && b.last?.column === c ? ' is-fresh' : ''}`} style={{ top: `${i * 30}px` }}
                      onPointerDown={top ? e => startDrag(e, { onDrop: key => dropCard(c, key), onTap: () => tapCard(c), disabled: b.turn !== 'party' || !!b.result }) : undefined}>
                      <CardFace rank={top ? exposedRank(b, c) : rank} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="city-battle__party">
            {b.fighters.map((x, f) => {
              const ability = KIN[x.kin].ability;
              const ready = x.ap >= ability.cost && alive(x) && b.turn === 'party' && !b.result;
              return (
                <div key={f} className={`city-fighter${alive(x) ? '' : ' is-down'}${b.last?.fighter === f ? ' is-acting' : ''}`}>
                  <button type="button" className="city-fighter__found" data-drop={`fighter:${f}`} onClick={() => tapReceiver(`fighter:${f}`)} aria-label={`${KIN[x.kin].name} foundation ${RANK_LABEL[x.rank]}`}>
                    <div className="city-card"><CardFace rank={x.rank} /></div>
                  </button>
                  <div className="city-fighter__meta">
                    <div className="city-fighter__who"><KinPortrait kin={x.kin} label={KIN[x.kin].name} /><b>{KIN[x.kin].name}</b></div>
                    <Bar value={x.hp} max={x.maxHp} kind="hp" />
                    <span className="city-ap" aria-label={`AP ${x.ap} of ${AP_CAP}`}>{Array.from({ length: AP_CAP }, (_, k) => <i key={k} className={k < x.ap ? 'on' : ''} />)}</span>
                    <div className={`city-ability${ready ? ' is-ready' : ''}`} title={ability.text}
                      onPointerDown={e => startDrag(e, { onDrop: key => dropAbility(f, key), disabled: !ready })}
                      aria-label={`${ability.name}, ${ability.cost} AP: ${ability.text}. Drag onto ${ability.heal ? 'an ally' : 'an enemy'}`} role="button" aria-disabled={!ready}>
                      <span className="city-ability__cost">{ability.cost}</span>
                      <span>{ability.name}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )} />

        {b.result && (
          <div className="city-gather__end" role="status">
            <h2>{b.result === 'won' ? 'Victory' : 'Driven back'}</h2>
            <p>{b.result === 'won' ? 'The zone is clear.' : 'The party limps home, spent for the day.'}</p>
            <button type="button" className="city-btn city-btn--brass" onClick={() => onFinish(b)}>Back to the table</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Bar({ value, max, kind, label }: { value: number; max: number; kind: 'hp' | 'stagger'; label?: string }) {
  return (
    <span className={`city-bar city-bar--${kind}`} aria-label={`${label ?? 'HP'} ${value} of ${max}`}>
      <span style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%` }} />
      <em>{label ? label : `${value}/${max}`}</em>
    </span>
  );
}
