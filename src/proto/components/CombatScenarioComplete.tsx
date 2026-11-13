import { isLightMote } from '../rules/lightMoteData';
import { MoteOrb } from './MoteOrb';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SceneButton } from './SceneButton';
import { COMBAT_SANDBOX_SCENARIOS, type CombatSandboxScenarioId } from '../rules/battleSandboxScenarios';
import { isSeriesEncounter, nextSeriesEncounter } from '../rules/combatSeries';
import type { BattleState } from '../rules/battle';
import { AbilityCardFace, KeruAbilityArt } from './AbilityCardFace';
import { GlacialLanceArt } from './GlacialLanceArt';
import { ICE_REWARDS, ICE_RARITY_NAMES, REWARD_THEMES, iceDescription, rewardTheme, rewardOwner, rollIceRewards, type IceRewardPick, type RewardTheme } from '../rules/iceRewards';
import { CombatRouteTree } from './CombatRouteTree';
import { sceneRoutes, sceneRewardTheme } from '../rules/sceneRoutes';
import './CombatScenarioComplete.css';

/** Series rewards float over the finished battle; other results retain their modal. */
export function CombatScenarioComplete({ scenarioId, won, onChoose, onHeal, heroHp, heroMaxHp, battle, detail, preview = false, rewardCount = 1, heroFoundation, expedition = false, rewardChoices, chooseLabel, rewardHeading }: {
  expedition?: boolean;
  rewardChoices?: IceRewardPick[]; chooseLabel?: string; rewardHeading?: string;
  scenarioId: CombatSandboxScenarioId; won: boolean; onChoose: (id: CombatSandboxScenarioId, rewards?: IceRewardPick[]) => void;
  onHeal?: (amount: 'five' | 'half' | 'full') => void; heroHp?: number; heroMaxHp?: number;
  battle: BattleState; detail?: string; preview?: boolean; rewardCount?: number; heroFoundation: () => HTMLElement | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const floating = won && (preview || isSeriesEncounter(scenarioId));
  const index = COMBAT_SANDBOX_SCENARIOS.findIndex(scenario => scenario.id === scenarioId);
  const scenario = COMBAT_SANDBOX_SCENARIOS[index];
  const suggested=sceneRoutes(scenarioId)[0] ?? nextSeriesEncounter(scenarioId) ?? COMBAT_SANDBOX_SCENARIOS[(index+1)%COMBAT_SANDBOX_SCENARIOS.length].id;
  const [view,setView]=useState<'rewards'|'debug'|'scene'>('rewards');
  const [cardIndex,setCardIndex]=useState(0);
  const [inspected,setInspected]=useState<IceRewardPick | null>(null);
  const [theme,setTheme]=useState<RewardTheme | 'all'>(()=>sceneRewardTheme(scenarioId));
  const [choices,setChoices]=useState<IceRewardPick[]>(()=>{
    if (rewardChoices) return rewardChoices;
    let seed = battle.seed + battle.nextEventId;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    return scenarioId==='100' ? [{id:'stone-shell',tier:0},{id:'heart-of-the-phoenix',tier:0},{id:'ice-armor',tier:0}] : rollIceRewards(expedition ? random : Math.random,3,sceneRewardTheme(scenarioId));
  });
  const reroll=()=>{setChoices(rollIceRewards(Math.random,3,theme));setRewards([]);setCardIndex(0);};
  const [rewards,setRewards]=useState<IceRewardPick[]>([]);
  const rewardDrag=useRef<{id:string;x:number;y:number;dragged:boolean}|null>(null), suppressClick=useRef(false);
  const addReward=(choice:IceRewardPick)=>{ const accepted=[...rewards.filter(item=>item.id!==choice.id),choice]; if (expedition) { onChoose(scenarioId, accepted.slice(-1)); return; } if(floating) { setRewards(accepted.slice(-Math.min(rewardCount,choices.length))); if(accepted.length>=Math.min(rewardCount,choices.length)) setView('scene'); } else if(accepted.length>=Math.min(rewardCount,choices.length)) onChoose(preview ? scenarioId : selected,accepted); else setRewards(accepted); };
  const [selected,setSelected]=useState<CombatSandboxScenarioId>(suggested);
  useEffect(() => { const element=dialog.current; if (!element) return; element.showModal(); return () => element.close(); }, [floating]);
  const content = <>
    {expedition && <p className="expedition-reward-title">{rewardHeading ?? 'A little stronger · choose one ability'}</p>}
    {!floating && <><span className="combat-scenario-complete__eyebrow">COMBAT TRAINING</span>
    <h2 id="combat-result-title">{preview ? 'Choose a reward' : won ? 'Scenario complete' : scenarioId==='1002' ? 'Aldan Seed destroyed' : 'Party defeated'}</h2>
    <p id="combat-result-description">{scenario.name}</p></>}
    {!won && scenarioId==='1002' && <p>The expedition ends when its Aldan Seed is destroyed, even if Keru survive.</p>}
    {detail && <p className="combat-scenario-complete__detail">{detail}</p>}
    {!expedition && won && (preview || isSeriesEncounter(scenarioId)) && <nav className="reward-tabs" aria-label="Reward views"><button type="button" aria-pressed={view==='rewards'} onClick={()=>setView('rewards')}>Rewards</button><button type="button" aria-pressed={view==='debug'} onClick={()=>setView('debug')}>Debug</button><button type="button" aria-pressed={view==='scene'} onClick={()=>setView('scene')}>Next scene</button>{view==='debug' && <button type="button" disabled={choices.length>0 && !rewards.length} onClick={()=>onChoose(selected,rewards)}>Go to scene</button>}</nav>}
    {view==='rewards' && won && (preview || isSeriesEncounter(scenarioId)) && <div className="ice-reward" role="group" aria-label={expedition ? "Choose ability reward" : "Choose Keru rewards"}><p aria-live="polite">{rewards.length ? `${ICE_REWARDS[rewards[0].id].name} selected for Hero` : "Choose a reward · drag to Hero or tap cards"}</p><div className="ice-reward__pages"><button type="button" aria-label="Previous reward" disabled={!choices.length} onClick={()=>setCardIndex((cardIndex+choices.length-1)%choices.length)}>‹</button><span>{choices.length ? cardIndex+1 : 0} / {choices.length}</span><button type="button" aria-label="Next reward" disabled={!choices.length} onClick={()=>setCardIndex((cardIndex+1)%choices.length)}>›</button><button type="button" className="ice-reward__reroll" hidden={expedition} aria-label="Reroll reward cards" title="Reroll reward cards" onClick={reroll}>⚄</button></div><div className="ice-reward__fan">{choices.map((choice,index)=>{const {id,tier}=choice, card=ICE_REWARDS[id], rarity=ICE_RARITY_NAMES[tier], description=iceDescription(id,tier);return<button key={id} type="button" className="ice-reward__card" data-ice-reward={id} data-current={cardIndex===index || undefined} data-page={Math.floor(cardIndex/3)===Math.floor(index/3) || undefined} data-rarity={rarity.toLowerCase()} style={{'--card-angle':`${((index%3)-1)*5}deg`} as React.CSSProperties} aria-label={`${rewardOwner(id) ? rewardOwner(id)+' · ' : ''}${card.name} · ${rarity}. ${description}`} aria-pressed={rewards.some(item=>item.id===id)}
      onDragStart={event=>event.preventDefault()}
      onPointerDown={event=>{if(event.button!==0)return;rewardDrag.current={id,x:event.clientX,y:event.clientY,dragged:false};event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={event=>{const drag=rewardDrag.current;if(!drag || drag.id!==id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>6)drag.dragged=true;if(!drag.dragged)return;event.currentTarget.style.transform=`translate3d(${dx}px,${dy}px,0) rotate(0deg)`;event.currentTarget.style.zIndex='100';event.currentTarget.setAttribute('data-dragging','');const rect=heroFoundation()?.getBoundingClientRect();heroFoundation()?.toggleAttribute('data-reward-drop',Boolean(rect && event.clientX>=rect.left && event.clientX<=rect.right && event.clientY>=rect.top && event.clientY<=rect.bottom));}}
      onPointerUp={event=>{const drag=rewardDrag.current;rewardDrag.current=null;event.currentTarget.style.removeProperty('transform');event.currentTarget.style.removeProperty('z-index');event.currentTarget.removeAttribute('data-dragging');const rect=heroFoundation()?.getBoundingClientRect();heroFoundation()?.removeAttribute('data-reward-drop');if(drag?.dragged){suppressClick.current=true;if(rect && event.clientX>=rect.left && event.clientX<=rect.right && event.clientY>=rect.top && event.clientY<=rect.bottom)addReward(choice);}}}
      onPointerCancel={event=>{rewardDrag.current=null;event.currentTarget.style.removeProperty('transform');event.currentTarget.style.removeProperty('z-index');event.currentTarget.removeAttribute('data-dragging');heroFoundation()?.removeAttribute('data-reward-drop');}}
      onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}setInspected(choice);}}><RewardFace choice={choice}/><span className="ice-reward__hover-description">{description}</span></button>})}</div><p className="ice-reward__summary">{choices[cardIndex] ? iceDescription(choices[cardIndex].id,choices[cardIndex].tier) : 'No rewards available.'}</p></div>}
    {inspected && <div className="reward-inspection" role="dialog" aria-modal="true" aria-label={ICE_REWARDS[inspected.id].name + ' details'} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setInspected(null);}}}><div className="reward-inspection__panel"><button type="button" className="reward-inspection__close" autoFocus onClick={()=>setInspected(null)} aria-label="Close reward details">×</button><div className="reward-inspection__card" data-rarity={ICE_RARITY_NAMES[inspected.tier].toLowerCase()}><RewardFace choice={inspected} jumbo/></div><p>{iceDescription(inspected.id,inspected.tier)}</p><label hidden={expedition} className="reward-inspection__rarity">Rarity <select value={inspected.tier} onChange={event=>{const tier=Number(event.target.value) as IceRewardPick["tier"]; setInspected({...inspected,tier}); setChoices(current=>current.map(choice=>choice.id===inspected.id?{...choice,tier}:choice));}}>{ICE_RARITY_NAMES.map((name,tier)=><option key={name} value={tier}>{name}</option>)}</select></label><button type="button" onClick={()=>{addReward(inspected);setInspected(null);}}>{chooseLabel ?? (expedition ? 'Keep ability & return to map' : 'Obtain reward')}</button></div></div>}
    {view==='debug' && won && (preview || isSeriesEncounter(scenarioId)) && <div className="reward-debug" aria-label="Reward debug options">
      <fieldset><legend>Debug · Heal Hero</legend><output aria-live="polite">HP {heroHp ?? '—'}/{heroMaxHp ?? '—'}</output><div><button type="button" onClick={()=>onHeal?.('five')}>Heal 5 HP</button><button type="button" onClick={()=>onHeal?.('half')}>Heal ½ max HP</button><button type="button" onClick={()=>onHeal?.('full')}>Heal to max</button></div></fieldset>
      <fieldset><legend>Debug · Reward pool</legend><label>Theme <select aria-label="Reward theme" value={theme} onChange={event=>{const next=event.target.value as RewardTheme | 'all';setTheme(next);setChoices(rollIceRewards(Math.random,3,next));setRewards([]);setCardIndex(0);}}><option value="all">All available themes</option>{REWARD_THEMES.map(item=><option key={item} value={item}>{item[0].toUpperCase()+item.slice(1)}</option>)}</select></label></fieldset>
      <fieldset><legend>Debug · any scene</legend><select aria-label="Debug next scene" value={selected} onChange={event=>setSelected(event.target.value as CombatSandboxScenarioId)}>{COMBAT_SANDBOX_SCENARIOS.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></fieldset>
    </div>}
    {won && view==='scene' && sceneRoutes(scenarioId).length > 0 && <CombatRouteTree current={scenarioId} disabled={floating && choices.length>0 && !rewards.length} onSelect={id=>onChoose(id,rewards)} />}
    {won && ((view==='scene' && !sceneRoutes(scenarioId).length) || !(preview || isSeriesEncounter(scenarioId))) && <label className="combat-scenario-complete__picker">Choose the next scene
      <select aria-label="Next scene" value={selected} onChange={event=>setSelected(event.target.value as CombatSandboxScenarioId)}>
        {COMBAT_SANDBOX_SCENARIOS.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>}
    {view==='scene' && (preview ? <p className="combat-scenario-complete__next">Choose a destination to begin the next encounter.</p> : won && isSeriesEncounter(scenarioId) && isSeriesEncounter(selected) && selected!==scenarioId && <p className="combat-scenario-complete__next">Your party carries forward to this encounter.</p>)}
    {!floating && <div className="combat-scenario-complete__actions">
      <SceneButton type="button" autoFocus onClick={() => onChoose(scenarioId)}>Replay scenario</SceneButton>
      {won && <SceneButton type="button" disabled={(preview || isSeriesEncounter(scenarioId)) && choices.length>0 && !rewards.length} onClick={() => onChoose(selected, rewards)}>Go to scene</SceneButton>}
    </div>}
  </>;
  return createPortal(floating ? <div className={`combat-scenario-complete combat-scenario-complete--floating${expedition ? ' expedition-rewards' : ''}`} aria-label="Victory rewards">{content}</div> : <dialog ref={dialog} className="combat-scenario-complete" aria-labelledby="combat-result-title" aria-describedby="combat-result-description" onCancel={event => event.preventDefault()}>{content}</dialog>, document.body);
}


function RewardFace({choice, jumbo=false}:{choice:IceRewardPick; jumbo?:boolean}) {
 const {id}=choice, base=import.meta.env.BASE_URL, name=ICE_REWARDS[id].name;
 const art=isLightMote(id) ? <MoteOrb id={id}/> : id==='whiteout' ? <div className="whiteout-art" role="img" aria-label="Snowy owl in a painted whiteout"><img className="whiteout-art__background" src={base+'assets/runtime/ui/holocards/layered/whiteout-scene-no-hero-v1.png'} alt="" draggable={false}/><img className="whiteout-art__rear" src={base+'assets/runtime/keru/whiteout/v1/wind-rear.png'} alt="" draggable={false}/><span className="whiteout-art__contrast" aria-hidden="true"/><img className="whiteout-art__owl" src={base+'assets/runtime/keru/whiteout/v1/owl.png'} alt="" draggable={false}/><img className="whiteout-art__front" src={base+'assets/runtime/keru/whiteout/v1/wind-front.png'} alt="" draggable={false}/></div> : id==='glacial-lance' ? <GlacialLanceArt/> : id==='ice-armor' || id==='rime-retort' ? <KeruAbilityArt subject={base+`assets/runtime/keru/demi/abilities/${id}-v1.png`} background={base+'assets/runtime/ui/holocards/layered/whiteout-scene-no-hero-v1.png'} label={'Demi · '+name}/> : <KeruAbilityArt subject={base+'assets/runtime/textures/snowflake.png'} label={name}/>;
 return <AbilityCardFace id={'ice-reward-'+id} title={<><span>{isLightMote(id) ? 'Mote' : rewardOwner(id) ?? 'Keru'}</span><em className="ice-reward__ability-name">{name}</em></>} badge={['ice','fire','water','air','earth','nature','chaos'].includes(rewardTheme(id))?<img className="ice-reward__element" src={base+'assets/runtime/ui/element-suits/'+rewardTheme(id)+'-v1.png'} alt=""/>:'✦'} badgeLabel={rewardTheme(id)+' element'} state={jumbo?'jumbo':'compact'} art={art}/>;
}
