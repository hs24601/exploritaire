import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import './CardJumbo.css';

type JumboCard = { title: string; content: ReactNode; ratio?: number; action?: () => void; actionLabel?: string };
const Context = createContext<{ open: (card: JumboCard) => void; close: () => void } | null>(null);
export const useCardJumbo = () => useContext(Context);

/** Card backs and stock/receiving cards retain their printed face in jumbo. */
export function JumboActionCard({children,onClick,disabled,cardRef,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{cardRef?:(node:HTMLButtonElement|null)=>void}) {
  const viewer=useCardJumbo();
  return <button ref={cardRef} {...props} disabled={!viewer&&disabled} data-gameplay-disabled={disabled||undefined} aria-haspopup="dialog" onClick={event=>{
    if(!viewer){if(!disabled)onClick?.(event);return;}
    const source=event.currentTarget;
    const faceData=Object.fromEntries(Object.entries(props).filter(([key])=>key.startsWith('data-')));
    viewer.open({title:props['aria-label']??'Card back',ratio:props.className?.includes('playing-card')||props.className?.includes('proto-rest-receiver')?56/74:63/88,content:<div {...faceData} className={props.className} style={{width:'100%',height:'100%'}}>{children}</div>,
      action:!disabled&&onClick?()=>onClick({...event,currentTarget:source,detail:0}):undefined,actionLabel:'Draw card'});
  }}>{children}</button>;
}

/** Shared modal for physical card faces. Their gameplay actions remain explicit. */
export function CardJumboProvider({ children }: { children: ReactNode }) {
  const [card,setCard]=useState<JumboCard|null>(null);
  const host=useRef<HTMLDivElement>(null),previousFocus=useRef<HTMLElement|null>(null);
  const close=()=>setCard(null);
  useEffect(()=>{
    if(!card)return;
    const root=document.getElementById('root'),wasInert=root?.inert??false;
    const wasBlurred=root?.classList.contains('details-card-game-blurred')??false;
    if(root){root.inert=true;root.classList.add('details-card-game-blurred');}
    host.current?.querySelector<HTMLButtonElement>('.card-jumbo__close')?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}
      if(event.key==='Tab'){
        const controls=Array.from(host.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]')??[]);
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',key,true);
    return()=>{
      document.removeEventListener('keydown',key,true);
      if(root){root.inert=wasInert;if(!wasBlurred)root.classList.remove('details-card-game-blurred');}
      if(previousFocus.current?.isConnected)previousFocus.current.focus({preventScroll:true});
    };
  },[card]);
  return <Context.Provider value={{open:next=>{previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setCard(next);},close}}>
    {children}
    {card&&createPortal(<div className="card-jumbo-backdrop" data-camera-ignore="true" onClick={event=>{if(event.target===event.currentTarget)close();}}>
      <div ref={host} className="card-jumbo" role="dialog" aria-modal="true" aria-label={`${card.title} jumbo card`} style={{'--jumbo-ratio':card.ratio??63/88} as React.CSSProperties}>
        <button type="button" className="card-jumbo__close" aria-label="Close jumbo card" onClick={close}>×</button>
        <div className="card-jumbo__face" onClick={event=>{if((event.target as HTMLElement).closest('.proto-ordinary-day__actions button'))close();}}>{card.content}</div>
        {card.action&&<button type="button" className="card-jumbo__action" onClick={()=>{close();card.action?.();}}>{card.actionLabel??'Play card'}</button>}
      </div>
    </div>,document.body)}
  </Context.Provider>;
}
