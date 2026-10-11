// Isolated browser fixture; never imported by the game or production build.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {CardJumboProvider,JumboActionCard} from '../src/proto/components/CardJumbo';
import {QuestCard} from '../src/proto/components/QuestCard';
import {ProtoCard} from '../src/proto/components/ProtoCard';
import {PondField} from '../src/proto/components/PondField';
import {CombatField} from '../src/proto/components/CombatField';
import {FishFight} from '../src/proto/components/FishFight';
import {createPondDeal} from '../src/proto/rules/fishing';
import '../src/index.css';
window.redeems=0;window.casts=0;
const root=createRoot(document.getElementById('root')!);
const slot=(id:string,child:React.ReactNode)=><div id={id} style={{width:200,height:280}}>{child}</div>;
window.renderScenario=(scenario:string)=>root.render(<CardJumboProvider>{scenario==='pond'?<PondField pond={createPondDeal(17,1)} angler="Hero" tired={false} landed={{}} onCast={()=>window.casts++} onFightEnd={()=>{}} onLeave={()=>{}}/>
  :scenario==='combat'?<CombatField seed={17} hero={{label:'Hero',hp:30,maxHp:30}} onEnd={()=>{}} onLeave={()=>{}}/>
  :scenario==='reel'?<FishFight seed={17} rank={5} onEnd={()=>{}}/>
  :<main style={{display:'flex',gap:24,padding:50}}>
    {slot('quest',<QuestCard title="Find food" text="Gather two ripe berries from the nearby berry patch, then carry them home for supper." staminaReward={1} complete={false} onRedeem={()=>window.redeems++}/>)}
    {slot('reward',<QuestCard title="Supper ready" text="Food is gathered. Hold to claim the reward." staminaReward={1} complete onRedeem={()=>window.redeems++}/>)}
    {slot('back',<JumboActionCard className="quest-card-back" style={{width:'100%',height:'100%'}} aria-label="Hidden quest card back"/>)}
    {slot('blocked',<ProtoCard card={{id:'blocked',rank:9}} disabled/>)}
  </main>}</CardJumboProvider>);
window.renderScenario('quests');window.fixtureReady=true;
