import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { TABLE_CARD_WIDTH, settleTableCard, readableTableCardAngle, type TableSolid } from '../tableCardPlacement';
import { useHeldVisual } from './useHeldVisual';
import { useCardJumbo } from './CardJumbo';
import { TableCardLayers } from './TableCardLayers';

// Lay out the readable compact face at the default zoom, then CSS reduces it
// by that fixed factor to TABLE_CARD_WIDTH world units. Camera zoom is inherited.
export const STORY_CARD_WIDTH = TABLE_CARD_WIDTH * 1.7;

/** A readable portrait quest on the physical table; its face can be moved by mouse or touch. */
export function TableStoryCard({ children, toWorld, solids }: { children: ReactNode; toWorld: (x: number, y: number) => { x: number; y: number }; solids: TableSolid[] }) {
  const [position, setPosition] = useState({ x: -144, y: -48 });
  const [pickedUp, setPickedUp] = useState(false);
  const [angle, setAngle] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const jumbo = useCardJumbo();
  const press = useRef({x:0,y:0,moved:false});
  useHeldVisual(() => ref.current, pickedUp);
  const drag = useRef<{ id: number; offset: { x: number; y: number }; origin: { x: number; y: number } } | null>(null);
  return <div ref={ref} className="proto-story-card" data-board-piece="quest" data-offscreen-waypoint="quest" data-camera-ignore="true" data-picked-up={pickedUp || undefined}
    role="button" tabIndex={0} aria-haspopup="dialog" aria-label="An ordinary day quest card"
    onClick={event=>{if(!press.current.moved&&!(event.target as HTMLElement).closest('button'))jumbo?.open({title:'An ordinary day',content:children});}}
    onKeyDown={event=>{if(event.key==='Enter'&&event.target===event.currentTarget){event.preventDefault();jumbo?.open({title:'An ordinary day',content:children});}}}
    style={{ left: `calc(50% + ${position.x}px)`, top: `calc(50% + ${position.y}px)`, width: STORY_CARD_WIDTH, height: STORY_CARD_WIDTH * 88 / 63, '--placed-angle': `${angle}deg` } as CSSProperties}
    onPointerDown={event => {
      event.stopPropagation();
      if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
      press.current={x:event.clientX,y:event.clientY,moved:false};
      const point = toWorld(event.clientX, event.clientY);
      drag.current = { id: event.pointerId, offset: { x: point.x - position.x, y: point.y - position.y }, origin: position };
      setPickedUp(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (drag.current?.id !== event.pointerId) return;
      if(Math.hypot(event.clientX-press.current.x,event.clientY-press.current.y)>6)press.current.moved=true;
      const point = toWorld(event.clientX, event.clientY);
      setPosition({ x: point.x - drag.current.offset.x, y: point.y - drag.current.offset.y });
    }}
    onPointerUp={event => {
      if (drag.current) {
        const nextAngle = readableTableCardAngle(event.currentTarget);
        setPosition(settleTableCard(position, TABLE_CARD_WIDTH, nextAngle, solids) ?? drag.current.origin);
        setAngle(nextAngle);
      }
      drag.current = null; setPickedUp(false);
    }}
    onPointerCancel={() => { if (drag.current) setPosition(drag.current.origin); drag.current = null; setPickedUp(false); }}
    onLostPointerCapture={() => { drag.current = null; setPickedUp(false); }}>
    <TableCardLayers>{children}</TableCardLayers>
  </div>;
}

