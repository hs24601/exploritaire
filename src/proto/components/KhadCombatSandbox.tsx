import { useEffect, useRef, useState } from 'react';
import { gameTime } from '../../gameTime';
import { CombatDemo } from './CombatDemo';
import { GlobalPauseControl, useGlobalPaused, useGlobalPauseLifecycle } from './GlobalPause';
import type { BattleScene } from '../rules/battleCues';
import type { BattleEvent } from '../rules/battle';
import { HERO_ORBIT_ATLAS } from '../heroOrbitAtlas';
import './KhadCombatSandbox.css';

export function KhadCombatSandbox() {
  useGlobalPauseLifecycle();
  const paused=useGlobalPaused();
  const [generation,setGeneration]=useState(0),[events,setEvents]=useState<BattleEvent[]>([]);
  const [hp,setHp]=useState(32),[heroHp,setHeroHp]=useState(80);
  const [girth,setGirth]=useState(1),[sway,setSway]=useState(1),[distance,setDistance]=useState(6);
  const [spriteFaces,setSpriteFaces]=useState(true),[faceCount,setFaceCount]=useState(8);
  // Orbit v1 slice: Sol-painted standing views at the low camera tier (docs/art/hero-orbit-v1.md).
  const [heroOrbit,setHeroOrbit]=useState(()=>new URLSearchParams(window.location.search).has('hero-orbit'));
  const [auto,setAuto]=useState(false),[status,setStatus]=useState('Idle · rooted and watching');
  const serial=useRef(0),lastAction=useRef(-Infinity);
  const reset=()=>{setEvents([]);setHp(32);setHeroHp(80);setAuto(false);setStatus('Idle · rooted and watching');lastAction.current=-Infinity;setGeneration(g=>g+1);};
  const act=(kind:'whip'|'hurt'|'defeat')=>{
    if(gameTime.isPaused()||hp<=0||heroHp<=0||gameTime.now()-lastAction.current<700)return;
    lastAction.current=gameTime.now();
    if(kind==='whip') {
      setHeroHp(h=>Math.max(0,h-12));setStatus('Thorn Whip · coil → lash → recoil · 12 damage');
      setEvents(e=>[...e,{id:++serial.current,kind:'enemy-hit',sourceId:'dark-slime',targetId:'hero',amount:12,label:'Thorn Whip'},...(heroHp<=12?[{id:++serial.current,kind:'down' as const,targetId:'hero'}]:[])]);
    } else {
      const damage=kind==='defeat'?hp:4;setHp(h=>Math.max(0,h-damage));setStatus(damage>=hp?'Defeated · wilted crown':'Hit · woody recoil');
      setEvents(e=>[...e,{id:++serial.current,kind:'hit',sourceId:'hero',targetId:'dark-slime',amount:damage,label:'Scratch'},...(damage>=hp?[{id:++serial.current,kind:'ko' as const,targetId:'dark-slime'}]:[])]);
    }
  };
  const liveAct=useRef(act);liveAct.current=act;
  useEffect(()=>{if(!auto)return;const timer=gameTime.setInterval(()=>liveAct.current('whip'),2600);return()=>gameTime.clearInterval(timer);},[auto]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.code!=='Space'||e.repeat||(e.target instanceof Element&&e.target.closest('input,textarea,select,button,[contenteditable]')))return;e.preventDefault();gameTime.setPaused(!gameTime.isPaused());};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const battle:BattleScene={khadRoot:true,heroOrbit,weedOptions:{girth,sway,spriteFaces,faceCount},events,units:[
    {id:'hero',team:'party',down:heroHp<=0,position:[3-distance,0],markers:{health:{current:heroHp,max:80}}},
    {id:'dark-slime',team:'enemy',down:hp<=0,position:[3,0],markers:{health:{current:hp,max:32}}}
  ]};
  return <main className="khad-combat-sandbox">
    <header><div><h1>Khad Root · combat sandbox</h1><p>Noxious woodland weed · Thorn Whip · first encounter design</p></div><GlobalPauseControl /></header>
    <div className="khad-combat-sandbox__arena"><CombatDemo key={`${generation}-${heroOrbit}`} battle={battle} firstTeam="party" onClose={()=>gameTime.setPaused(!gameTime.isPaused())} onRestart={reset} cameraShot={{id:'khad-study',name:'Khad Root study',position:[0,4,11],target:[0,1,0],durationMs:0}} /></div>
    <section aria-label="Enemy iteration controls">
      <div className="khad-combat-sandbox__actions"><button disabled={paused||hp<=0||heroHp<=0} onClick={()=>act('whip')}>Thorn Whip · 12 damage</button><button disabled={paused||hp<=0||heroHp<=0} onClick={()=>act('hurt')}>Strike weed · 4 damage</button><button disabled={paused||hp<=0||heroHp<=0} onClick={()=>act('defeat')}>Preview defeat</button><button disabled={paused} aria-pressed={auto} onClick={()=>setAuto(a=>!a)}>{auto?'Stop attacks':'Repeat attacks'}</button><button onClick={reset}>Reset encounter</button></div>
      <div className="khad-combat-sandbox__actions khad-combat-sandbox__faces">
        <button aria-pressed={spriteFaces} onClick={()=>setSpriteFaces(true)}>Sprite faces</button>
        <button aria-pressed={!spriteFaces} onClick={()=>setSpriteFaces(false)}>Smooth 3D</button>
        <button aria-pressed={!heroOrbit} onClick={()=>setHeroOrbit(false)}>Hero · approved v3</button>
        <button aria-pressed={heroOrbit} onClick={()=>setHeroOrbit(true)}>Hero · orbit v1{HERO_ORBIT_ATLAS.placeholder?' (guides)':''}</button>
        <label>Orbit faces<select aria-label="Orbit faces" disabled={!spriteFaces} value={faceCount} onChange={e=>setFaceCount(Number(e.target.value))}>{[4,8,16].map(n=><option key={n} value={n}>{n} faces</option>)}</select></label>
      </div>
      <div className="khad-combat-sandbox__sliders">{([['Vine girth',girth,setGirth,.6,1.8],['Idle sway',sway,setSway,0,2],['Target distance',distance,setDistance,3,8]] as const).map(([label,value,set,min,max])=><label key={label}>{label} <output>{value.toFixed(1)}</output><input type="range" min={min} max={max} step=".1" value={value} onChange={e=>set(Number(e.target.value))}/></label>)}</div>
      <p role="status">{paused?'Paused':status} · Khad Root {hp}/32 HP · Hero {heroHp}/80 HP</p>
      <p className="khad-combat-sandbox__note">Orbit to compare held sprite faces with smooth 3D. Thorn Whip stays aimed in world space. Green motes are visual only; attacks preview independently of the card economy.</p>
    </section>
  </main>;
}
