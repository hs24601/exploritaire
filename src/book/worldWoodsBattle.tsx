import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BattleTableauField} from '../proto/components/BattleTableauField';
import {CardJumboProvider} from '../proto/components/CardJumbo';
import {createPlayableSandboxScenario,startMusicalBattle,type BattleState} from '../proto/rules/battle';
import {readWorldFlurry} from '../sticker/worldFlurryInventory';
import '../index.css';
import './worldWoodsBattle.css';
import {sixColumnWoodsBattle} from './worldTableauLayout';

/** Mount only after physical contact. Retreatment keeps this encounter's state;
 * no battle state, enemy turn or timer exists while the woods are waiting. */
export function openWorldWoodsBattle(onClose:(won:boolean,state:BattleState)=>void,previous?:BattleState,onChange?:(state:BattleState)=>void){
 const host=document.createElement('dialog');host.className='world-woods-battle';host.setAttribute('aria-label','Khadroot encounter');document.body.append(host);
 const initial:BattleState=sixColumnWoodsBattle(previous&&!previous.result?previous:{...startMusicalBattle(createPlayableSandboxScenario('001')),snowflakeReward:readWorldFlurry()});let latest=initial;
 onChange?.(initial);
 const root=createRoot(host);let closed=false;
 function close(){if(closed)return;closed=true;host.close();root.unmount();host.remove();onClose(latest.result==='won',latest);}
 function Battle(){const [state,setState]=useState(latest);return <CardJumboProvider><header className="world-woods-battle__header"><h2>Khadroot · Combat Woods</h2><button type="button" onClick={close}>{state.result==='won'?'Return to woods':'Retreat to woods'}</button></header><main className="combat-sandbox"><div className="proto-main-layout combat-sandbox__pane"><div className="proto-tableau-field proto-tableau-field--combat"><BattleTableauField sandbox musicalCombat active hours={0} lights={[]} onWatch={close}
   encounter={{initialState:initial,onChange:next=>{latest=next;setState(next);onChange?.(next);},onComplete:close}}/>
 </div></div></main></CardJumboProvider>;}
 host.addEventListener('cancel',event=>{event.preventDefault();close();});root.render(<Battle/>);host.showModal();
 return {close};
}
