import { holdSlop, useRewardHold } from '../useRewardHold';
import { logHold } from '../holdLog';
import { TABLE_CARD_WIDTH, CARD_RATIO, settleTableCard, type TableSolid } from '../tableCardPlacement';
import { useEffect, useRef, useState } from 'react';
import { QuestCard } from './QuestCard';
import { tableObjectShadow, type TableLight } from '../protoLighting';

export type PlacedQuestCard = {
  questIndex: number;
  position: { x: number; y: number };
  tableState?: boolean;
  tilt?: number;
  flightFrom?: { x: number; y: number; width: number; height: number };
};

/** A teaching card outside the quest deck. It flies out with the first quest and
 * clears with the same press-and-hold, without a reward. */
export const TUTORIAL_QUEST_INDEX = -1;
export const TUTORIAL_QUEST = { title: 'Clearing quests', text: 'Press and hold a finished card for 2s.' };

export function TableQuestCard({ placement, title, text, redeemed, onRedeem, timeOfDay, lights, cameraScale, toWorld, solids, onMove, staminaReward = 1 }: {
  placement: PlacedQuestCard; title: string; text: string; redeemed: boolean; staminaReward?: number;
  onRedeem: () => void; timeOfDay: number; lights: TableLight[];
  cameraScale: number; solids: TableSolid[];
  /** Client point to table world point; follows a tilted camera. */
  toWorld?: (clientX: number, clientY: number) => {x:number;y:number}; onMove: (position: {x:number;y:number}, tilt:number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [displayPosition, setDisplayPosition] = useState(placement.position);
  const hold = useRewardHold(onRedeem, !redeemed);
  const [tableState, setTableState] = useState(Boolean(placement.tableState));
  // The teaching card keeps its arrival size so its instructions stay readable.
  const tutorial = placement.questIndex === TUTORIAL_QUEST_INDEX;
  const cardWidth = tableState && !tutorial ? TABLE_CARD_WIDTH : 120;
  const [tilt, setTilt] = useState(placement.tilt ?? 0);
  const drag = useRef<{pointerId:number;x:number;y:number;origin:{x:number;y:number};moved:boolean;angle:number} | null>(null);
  // Where a drag that started at (x,y) has moved the card to, in world units.
  const draggedTo = (current:{x:number;y:number;origin:{x:number;y:number}}, clientX:number, clientY:number) => {
    if (!toWorld) return {x:current.origin.x+(clientX-current.x)/cameraScale,y:current.origin.y+(clientY-current.y)/cameraScale};
    const from=toWorld(current.x,current.y),to=toWorld(clientX,clientY);
    return {x:current.origin.x+to.x-from.x,y:current.origin.y+to.y-from.y};
  };
  const [landed, setLanded] = useState(!placement.flightFrom);
  useEffect(() => {
    const element = ref.current;
    if (!element || !placement.flightFrom) return;
    let destination = element.getBoundingClientRect();
    const viewport = element.closest('.proto-map-viewport')?.getBoundingClientRect();
    if (viewport && destination.width) {
      const scale = destination.width / 120;
      const dx = Math.max(viewport.left + 12, Math.min(destination.left, viewport.right - destination.width - 12)) - destination.left;
      const dy = Math.max(viewport.top + 72, Math.min(destination.top, viewport.bottom - destination.height - 150)) - destination.top;
      const adjusted = { x: placement.position.x + dx / scale, y: placement.position.y + dy / scale };
      element.style.left = 'calc(50% + ' + adjusted.x + 'px)';
      element.style.top = 'calc(50% + ' + adjusted.y + 'px)';
      setDisplayPosition(adjusted);
      destination = element.getBoundingClientRect();
    }
    // Mobile may currently show the tableau/quest panel rather than the table.
    if (!destination.width || !destination.height) { setLanded(true); return; }
    const source = placement.flightFrom;
    const ghost = element.querySelector('.quest-card')!.cloneNode(true) as HTMLElement;
    ghost.classList.add('quest-card-flight');
    ghost.style.cssText = `position:fixed;left:${source.x}px;top:${source.y}px;width:${source.width}px;height:${source.height}px;z-index:60000;pointer-events:none;transform-origin:0 0;`;
    document.body.appendChild(ghost);
    const animation = ghost.animate([
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${destination.x - source.x}px,${destination.y - source.y}px) scale(${destination.width / source.width})` },
    ], { duration: 550, easing: 'ease-in-out' });
    animation.onfinish = () => { ghost.remove(); setLanded(true); };
    return () => { animation.cancel(); ghost.remove(); };
  }, [placement.questIndex]);
  return <div ref={ref} className={`table-quest-card${tutorial ? ' table-quest-card--tutorial' : ''}`} data-table-quest={placement.questIndex} data-camera-ignore="true" data-table-state={tableState}
    style={{ left: `calc(50% + ${displayPosition.x}px)`, top: `calc(50% + ${displayPosition.y}px)`,
      width: cardWidth, height: cardWidth / CARD_RATIO,
      transform: `translate(-50%,-50%) rotate(${tilt}deg)`, touchAction: 'none', cursor: drag.current?.moved ? 'grabbing' : 'grab',
      opacity: landed ? 1 : 0, boxShadow: tableObjectShadow(timeOfDay, displayPosition, 8, lights) }}
    onFocus={()=>setTableState(true)}
    onPointerDown={event => {
      event.stopPropagation(); if(!landed||redeemed||drag.current||event.button!==0)logHold(`card ${placement.questIndex} ignored the press: ${!landed?'still landing':redeemed?'already redeemed':drag.current?'already pressed':'not the main button'}`); if(event.button!==0||!landed||redeemed||drag.current)return;
      event.preventDefault(); setTableState(true);
      drag.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY,origin:{...displayPosition},moved:false,angle:tilt};
      event.currentTarget.setPointerCapture(event.pointerId); hold.start(event.pointerType);
    }}
    onPointerMove={event=>{
      const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
      const dx=event.clientX-current.x,dy=event.clientY-current.y;
      if(!current.moved&&Math.hypot(dx,dy)>holdSlop(event.pointerType)){current.moved=true;hold.cancel(`moved ${Math.round(Math.hypot(dx,dy))}px`);}
      if(current.moved){setTilt(0);setDisplayPosition(draggedTo(current,event.clientX,event.clientY));}
    }}
    onPointerUp={event=>{
      const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
      hold.cancel('released');drag.current=null;
      const angle=current.moved ? (Math.random()*8-4) : current.angle;
      const requested=current.moved ? draggedTo(current,event.clientX,event.clientY) : current.origin;
      const settled=settleTableCard(requested,cardWidth,angle,solids) ?? current.origin;
      setDisplayPosition(settled);setTilt(angle);onMove(settled,angle);
    }}
    onPointerCancel={()=>{hold.cancel('pointercancel');if(drag.current){setDisplayPosition(drag.current.origin);setTilt(drag.current.angle);}drag.current=null;}}
    onLostPointerCapture={()=>{hold.cancel('lost pointer capture');drag.current=null;}}>
    <QuestCard title={title} text={text} staminaReward={staminaReward} complete={!redeemed} onRedeem={onRedeem} redeemed={redeemed} rewardHold={hold} />
  </div>;
}
