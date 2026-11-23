import {BiteOpticsControls} from '../proto/components/BiteOpticsCanvas';
import {CARD_RARITIES,type CardRarity} from '../proto/cardRarity';
import {tableauMusicSeed,newMusicDeal,battleMusicIntensity} from './battleScore';
import type {BattleTheme} from '../audio/battleComposer';
import { useEffect, useRef, useState } from 'react';
import { CombatSandbox } from '../proto/components/CombatSandbox';
import type { BattleState } from '../proto/rules/battle';
import { createTableauMusic, type TableauMusicEngine,type OrchestraState,type SpessaState } from '../audio/tableauMusic';
import type { MusicKey } from '../audio/musicScale';
import { ConstellationSky, type ConstellationSkyHandle } from './ConstellationSky';
import { CONSTELLATIONS, initialSky, motifDegrees, skyReceipt, skyRunEnd, type SkyEffect, type SkyState } from './constellations';
import { battleReceipts } from './battleReceipts';
import './MusicalTableaus.css';

/** The 100-series encounters (Motes of Darkness and the frost trio). */
export const MUSICAL_SCENARIOS = ['100', '101', '102', '103', '104', '105'] as const;

/** Combat phrasing uses minor colors across the test encounters. */
const keyFor = (_scenario?: string): MusicKey => ({root:62,mode:'aeolian'});

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ } };

/** Combat sandbox 100-series with pitched card plays and a constellation sky drawn by party runs. */
export function MusicalTableaus() {
  const [engine] = useState<TableauMusicEngine>(createTableauMusic);
  const skyCanvas = useRef<ConstellationSkyHandle>(null);
  const [sky, setSky] = useState<SkyState>(initialSky);
  const skyState = useRef(sky);
  const previous = useRef<BattleState | null>(null);
  const [theme,setTheme]=useState<BattleTheme|null>(null);
  const themeRef=useRef<BattleTheme|null>(null);
  const [sound, setSound] = useState(() => read('musical-tableaus:sound') !== 'off');
  // Seeded combat feedback is active; continuous music stays opt-in on each visit.
  const [biteRarity,setBiteRarity]=useState<CardRarity>(()=>{const saved=read('musical-tableaus:bite-foil');return CARD_RARITIES.includes(saved as CardRarity)?saved as CardRarity:'common';});
  const [bed, setBed] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [orchestral,setOrchestral]=useState(()=>read('musical-tableaus:orchestra')==='on');
  const [demoState,setDemoState]=useState<'idle'|'loading'|'playing'|'error'>('idle');
  const [spessa,setSpessa]=useState(()=>read('musical-tableaus:spessa')==='on');
  const [spessaState,setSpessaState]=useState<SpessaState>({phase:'idle',progress:0});
  const [orchestraState,setOrchestraState]=useState<OrchestraState>({phase:'idle',loaded:0,total:0});

  useEffect(() => {
    const unlock = () => { if (engine.unlock()) setUnlocked(true); };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => { window.removeEventListener('pointerdown', unlock, true); window.removeEventListener('keydown', unlock, true); engine.dispose(); };
  }, []);
  useEffect(() => { engine.setMuted(!sound); write('musical-tableaus:sound', sound ? 'on' : 'off'); }, [sound]);
  useEffect(() => { engine.setBed(bed); write('musical-tableaus:bed', bed ? 'on' : 'off'); }, [bed]);
  useEffect(()=>engine.subscribeDemo(setDemoState),[engine]);
  useEffect(()=>engine.subscribeSpessa(setSpessaState),[engine]);
  useEffect(()=>{engine.setSpessa(spessa);write('musical-tableaus:spessa',spessa?'on':'off');},[engine,spessa]);
  useEffect(()=>engine.subscribeOrchestra(setOrchestraState),[engine]);
  useEffect(()=>{engine.setOrchestral(orchestral);write('musical-tableaus:orchestra',orchestral?'on':'off');},[engine,orchestral]);

  const applySky = (step: { state: SkyState; effects: SkyEffect[] }) => {
    skyState.current = step.state;
    setSky(step.state);
    if (step.effects.length) skyCanvas.current?.play(step.effects);
    for (const effect of step.effects) if (bed && effect.kind === 'complete') engine.playMotif(motifDegrees(effect.notes));
  };

  const onBattleChange = (battle: BattleState) => {
    const before = previous.current;
    previous.current = battle;
    engine.key = keyFor(battle.sandboxScenario);
    if(newMusicDeal(before,battle)){const next=engine.setBattleTheme(tableauMusicSeed(battle.columns));themeRef.current=next;setTheme(next);}
    engine.setBattleIntensity(battleMusicIntensity(battle));
    const change = battleReceipts(before, battle);
    for (const note of change.party) {
      engine.playReceipt({ rank: note.rank, combo: note.combo, lane: note.index, lanes: note.of });
      applySky(skyReceipt(skyState.current, note.rank));
    }
    for (const rank of change.enemy) engine.playEnemyReceipt(rank);
    if (change.runEnded) applySky(skyRunEnd(skyState.current));
  };

  const figure = CONSTELLATIONS[sky.figure];
  const sceneInfo=<section className="musical-tableaus__scene-info" aria-label="Scene information">
      <h1>Musical tableaus</h1>
      <p className="musical-tableaus__figure" aria-live="polite">
        <span>{figure.name}</span> <span className="musical-tableaus__pips" aria-label={`${sky.lit} of ${figure.stars.length} stars lit`}>{figure.stars.map((_, index) => <i key={index} data-lit={index < sky.lit || undefined} />)}</span>
        <span className="musical-tableaus__count">{sky.completed.length} of {CONSTELLATIONS.length} drawn</span>
      </p>
      {!unlocked && sound && <p className="musical-tableaus__hint">Sound starts on your first play</p>}

    </section>;

  const musicSettings=<section className="musical-tableaus__settings" aria-label="Music settings"><label>Bite foil<select aria-label="Bite foil rarity" value={biteRarity} onChange={e=>{const rarity=e.target.value as CardRarity;setBiteRarity(rarity);write('musical-tableaus:bite-foil',rarity);}}>{CARD_RARITIES.map(r=><option key={r} value={r}>{r[0].toUpperCase()+r.slice(1)}</option>)}</select></label><BiteOpticsControls/><h2>Music</h2>
      <div className="musical-tableaus__toggles">
        <button type="button" aria-pressed={sound} onClick={() => setSound(value => !value)}>{sound ? 'Sound on' : 'Sound off'}</button>
        <button type="button" aria-pressed={bed} disabled={!sound} onClick={() => {if(!bed&&!themeRef.current&&previous.current){const next=engine.setBattleTheme(tableauMusicSeed(previous.current.columns));themeRef.current=next;setTheme(next);}setBed(value => !value);}}>{bed ? 'Battle theme on' : 'Battle theme off'}</button>
        <button type="button" aria-pressed={orchestral} aria-label="Orchestral instruments" title="VSCO chamber orchestra: pizzicato cello, harp, flute, strings and glockenspiel. Turn off to compare the original synth." onClick={()=>{if(orchestral&&orchestraState.phase==='error')engine.setOrchestral(true);else setOrchestral(value=>!value);}}>{orchestral?(orchestraState.phase==='ready'?'Orchestra on':orchestraState.phase==='error'?'Retry orchestra':`Loading orchestra${orchestraState.total?' '+Math.round(orchestraState.loaded/orchestraState.total*100)+'%':'…'}`):'Orchestra off'}</button>
        <button type="button" aria-label="SpessaSynth instruments" aria-pressed={spessa} onClick={()=>{if(spessa&&spessaState.phase==='error')engine.setSpessa(true);else setSpessa(v=>!v);}}>{!spessa?'SpessaSynth off':spessaState.phase==='ready'?'SpessaSynth on':spessaState.phase==='loading'?`Loading sound bank ${Math.round(spessaState.progress*100)}%`:spessaState.phase==='error'?'Retry SpessaSynth':spessaState.phase==='unavailable'?'SpessaSynth needs HTTPS':'Starting SpessaSynth…'}</button>
        <button type="button" disabled={!sound||demoState==='playing'||demoState==='loading'} onClick={()=>engine.previewInstrument()}>Test cello</button>
        <button type="button" title="TO MAKE THE END OF BATTLE (Ys II), Yuzo Koshiro / Nihon Falcom; SC-88 arrangement by kou1. Played through GeneralUser GS." disabled={!sound||!spessa||spessaState.phase!=='ready'} onClick={()=>{if(demoState==='playing'||demoState==='loading')engine.stopDemo();else void engine.playDemo();}}>{demoState==='playing'||demoState==='loading'?'Stop demo':demoState==='error'?'Retry battle demo':'Play battle demo'}</button>
        {demoState==='playing'&&<span>TO MAKE THE END OF BATTLE · SC-88 by kou1</span>}
        <button type="button" disabled={!sound||!theme} title="Hear two bars of this deal’s battle theme" onClick={()=>engine.previewTheme()}>Preview</button>
        <button type="button" disabled={!theme} onClick={()=>{const battle=previous.current;if(!battle)return;const seed=tableauMusicSeed(battle.columns);const next=engine.setBattleTheme(seed,themeRef.current?.seed===seed?themeRef.current.variation+1:0);themeRef.current=next;setTheme(next);}}>Regenerate</button>
        {theme&&<span title={theme.seed}>Theme {theme.id} · v{theme.variation+1}</span>}
      </div>
      {spessa&&spessaState.phase!=='ready'&&<span role="status">{spessaState.message||'Loading SpessaSynth; current instruments remain available.'}</span>}
      {orchestral&&orchestraState.phase!=='ready'&&<span className="musical-tableaus__audio-status" role="status">{orchestraState.phase==='error'?'Orchestra could not load. Synth remains available; tap Retry.':'Synth plays until the orchestra is ready.'}</span>}
  </section>;

  return <div className="musical-tableaus">
    <ConstellationSky ref={skyCanvas} sky={sky} />

    <CombatSandbox biteRarity={biteRarity} configContent={<>{sceneInfo}{musicSettings}</>} scenarioIds={MUSICAL_SCENARIOS} onBattleChange={onBattleChange} showFps={false} musicalCombat followTurnCamera />
  </div>;
}
