import type { ReactNode } from 'react';
import type { BattleState } from '../rules/battle';
import { WITHDRAW_INTERRUPT_COST } from '../rules/battle';
import './MomentumEngine.css';
import { MomentumIcon } from './MomentumIcon';
import { WebMomentumFlame } from './WebMomentumFlame';
import { MomentumNumberFire } from './MomentumNumberFire';

/** Keep fractional earnings in the engine; display only spendable whole points. */
export const wholeMomentum = (value:number) => Math.floor(Math.max(0,value)+1e-8);
export const MOMENTUM_FLAME_CAPACITY = 12;
export type MomentumValueStyle = 'flamelab' | 'stroked';

/** Shared by the board and raised ability hand; canvas pixels cannot be DOM-cloned. */
export function MomentumFlameDial({value,paused=false,timeScale=1,valueStyle='flamelab',onOpenSkills,children}:{value:number;paused?:boolean;timeScale?:number;valueStyle?:MomentumValueStyle;onOpenSkills?:()=>void;children?:ReactNode}) {
  return <div className="momentum-engine__chamber" data-flame-dial data-value-style={valueStyle}>
    <WebMomentumFlame variant={0} value={value} capacity={MOMENTUM_FLAME_CAPACITY} size={180} numbers={false} animated={!paused} energy={timeScale} tailEmphasis={1.65} fallback={<MomentumIcon className="momentum-engine__fallback-art" />} />
    <strong className="momentum-engine__value">{valueStyle==='flamelab'?<><span className="sr-only">Momentum {wholeMomentum(value)}</span><MomentumNumberFire decorative value={wholeMomentum(value)} paused={paused} timeScale={timeScale}/></>:<><span className="sr-only">Momentum </span>{wholeMomentum(value)}</>}</strong>
    {children}
    {onOpenSkills && <button type="button" className="momentum-engine__open-skills" aria-label="Open Momentum abilities" aria-haspopup="dialog" onClick={onOpenSkills} />}
  </div>;
}

/** A shared persistent reserve, rendered as a living twelve-point flame spiral. */
export function MomentumEngine({pool,onDecayChange,onOpenSkills,showDecay=true,paused=false,timeScale=1,valueStyle='flamelab'}:{pool:NonNullable<BattleState['momentum']>;onDecayChange:(enabled:boolean)=>void;onOpenSkills?:()=>void;showDecay?:boolean;paused?:boolean;timeScale?:number;valueStyle?:MomentumValueStyle}) {
  const ready=pool.value>=WITHDRAW_INTERRUPT_COST;
  const overflow=Math.max(0,pool.value-MOMENTUM_FLAME_CAPACITY);
  const gain=wholeMomentum(pool.lastGain ?? 0);
  return <div className="momentum-engine" data-ready={ready} data-overfill={overflow>0 || undefined} data-source={pool.lastActorId} aria-label="Shared party Momentum">
    <MomentumFlameDial value={pool.value} paused={paused} timeScale={timeScale} valueStyle={valueStyle} onOpenSkills={onOpenSkills}>
      {pool.earned>0 && <span key={`gain-${pool.earned}`} className="momentum-engine__gain" aria-hidden="true">{gain>0?`+${gain}`:'Combo'}</span>}
      {pool.spent>0 && <span key={`spend-${pool.spent}`} className="momentum-engine__spend" aria-hidden="true">−{wholeMomentum(pool.lastSpend ?? WITHDRAW_INTERRUPT_COST)}</span>}
    </MomentumFlameDial>
    {showDecay && <label className="momentum-engine__decay" title="Playtest: lose 1 Momentum every 2 seconds during your turn. Pauses and enemy responses hold the reserve.">
      <input type="checkbox" checked={pool.decayEnabled!==false} onChange={event=>onDecayChange(event.target.checked)} /> Decay
    </label>}
  </div>;
}
