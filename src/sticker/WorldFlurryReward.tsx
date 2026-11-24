import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {SnowflakeSticker,FlurryAmbiance} from './SnowflakeSticker';
import {FlurryMemory} from './FlurryMemory';
import {readWorldFlurry,saveWorldFlurry,unstickWorldFlurry} from './worldFlurryInventory';
import {createPlayableSandboxScenario,startMusicalBattle} from '../proto/rules/battle';
import {placeSnowflake,type StickerMemory} from '../proto/rules/snowflakeReward';
import './worldFlurryReward.css';

export function mountWorldFlurryReward(onOpenChange:(open:boolean)=>void,inventoryHost?:HTMLElement){
 const host=document.createElement('div');host.className='world-flurry-ui';document.body.append(host);let show=()=>{};
 function Reward(){
  const [open,setOpen]=useState(false),[placing,setPlacing]=useState(false),[reward,setReward]=useState(readWorldFlurry),dialog=useRef<HTMLDialogElement>(null);
  const battle=useRef(startMusicalBattle(createPlayableSandboxScenario('100'))),actor=battle.current.party.find(unit=>unit.id==='hero')!;
  useEffect(()=>{show=()=>{setReward(readWorldFlurry());setPlacing(false);setOpen(true);};return()=>{show=()=>{};};},[]);
  useEffect(()=>{onOpenChange(open);if(open)dialog.current?.showModal();else dialog.current?.close();return()=>{if(open)onOpenChange(false);};},[open]);
  const confirm=(memory:StickerMemory)=>{const next=placeSnowflake({...battle.current,snowflakeReward:'available'},'hero',memory);if(!next.snowflakeReward||next.snowflakeReward==='available')return false;saveWorldFlurry(next.snowflakeReward);setReward(next.snowflakeReward);return true;};
  const unstick=()=>{if(unstickWorldFlurry()){setReward('available');setPlacing(false);}};
  return <>
   {reward&&createPortal(<button type="button" className={inventoryHost?'castle-row':'world-flurry-inventory'} onClick={()=>show()}>❄ Flurry sticker</button>,inventoryHost??host)}
   <dialog ref={dialog} role="dialog" aria-label="Flurry sticker reward" className="flurry-collection-dialog" onCancel={event=>{event.preventDefault();setOpen(false);}} onClose={()=>setOpen(false)}>
    <button type="button" className="card-jumbo__close" aria-label="Close sticker reward" onClick={()=>setOpen(false)}>×</button>
    {placing?<FlurryMemory actor={actor} saved={reward&&reward!=='available'?reward.memory:undefined} onConfirm={reward==='available'?confirm:undefined} onUnstick={reward&&reward!=='available'?unstick:undefined}/>:<section className="flurry-collection-intro">
     <h2>{reward==='available'?'You found Flurry!':'Flurry’s sticker memory'}</h2><div className="flurry-collection-art"><FlurryAmbiance/><SnowflakeSticker floating/></div>
     <p>{reward==='available'?'Choose a vertical band on Hero’s card to enhance one ability.':'Flurry is helping Hero.'}</p>
     <div className="flurry-collection-actions"><button type="button" onClick={()=>setPlacing(true)}>{reward==='available'?'Place on Hero':'Inspect sticker'}</button>{reward&&reward!=='available'&&<button type="button" onClick={unstick}>Unstick Flurry</button>}<button type="button" onClick={()=>setOpen(false)}>Return to world</button></div>
    </section>}
   </dialog>
  </>;
 }
 const root=createRoot(host);root.render(<Reward/>);return {open(){show();},dispose(){root.unmount();host.remove();}};
}
