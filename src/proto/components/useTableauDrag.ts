import { useEffect, useRef, type PointerEvent } from 'react';
import { gameTime } from '../../gameTime';
import { flickPosition, flickVelocity, useFlickPhysics, type FlickSample } from '../flickPhysics';

/** Pointer capture keeps mouse, pen and touch drags alive across both fields. */
export function useTableauDrag(onDrop?: (target: HTMLElement) => void) {
  const enabled = useFlickPhysics();
  const drop = useRef(onDrop); drop.current = onDrop;
  const frame = useRef<number | undefined>(undefined);
  const flying = useRef(false);
  const press = useRef<{ id: number; x: number; y: number; source: HTMLElement; ghost?: HTMLElement; samples: FlickSample[] } | undefined>(undefined);
  const suppressClick = useRef(false);
  const clear = () => { if (frame.current !== undefined) gameTime.cancelAnimationFrame(frame.current); frame.current = undefined; flying.current = false; press.current?.ghost?.remove(); press.current = undefined; };
  const targetAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-map-actor-card], [data-travel-foundation], [data-foundation-index], [data-battle-actor]');
  useEffect(() => { if (!onDrop || !enabled) clear(); }, [!!onDrop, enabled]);
  useEffect(() => {
    window.addEventListener('blur', clear);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') clear(); };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('blur', clear); window.removeEventListener('keydown', escape); clear(); };
  }, []);
  return {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      suppressClick.current = false;
      if (!onDrop || event.button !== 0 || gameTime.isPaused()) return;
      clear();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      press.current = { id: event.pointerId, x: event.clientX, y: event.clientY, source: event.currentTarget, samples: [{x:event.clientX,y:event.clientY,t:event.timeStamp}] };
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const drag = press.current;
      if (!drag || drag.id !== event.pointerId || flying.current) return;
      if (gameTime.isPaused()) { clear(); return; }
      drag.samples.push({x:event.clientX,y:event.clientY,t:event.timeStamp});
      drag.samples = drag.samples.filter(sample => sample.t >= event.timeStamp - 120);
      if (!drag.ghost && Math.hypot(event.clientX-drag.x, event.clientY-drag.y) < 6) return;
      if (!drag.ghost) {
        const rect = drag.source.getBoundingClientRect();
        drag.ghost = drag.source.cloneNode(true) as HTMLElement;
        drag.ghost.removeAttribute('id');
        drag.ghost.setAttribute('aria-hidden', 'true');
        drag.ghost.inert = true;
        const computed = getComputedStyle(drag.source);
        for (const property of computed) if (property.startsWith('--')) drag.ghost.style.setProperty(property, computed.getPropertyValue(property));
        Object.assign(drag.ghost.style, { position:'fixed', width:`${rect.width}px`, height:`${rect.height}px`, margin:'0', transform:'translate(-50%, -50%)', pointerEvents:'none', zIndex:'2147483647', opacity:'.8', transition:'none' });
        document.body.append(drag.ghost);
        suppressClick.current = true;
      }
      drag.ghost.style.left = `${event.clientX}px`;
      drag.ghost.style.top = `${event.clientY}px`;
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      const drag = press.current;
      if (!drag || drag.id !== event.pointerId) return;
      const moved = !!drag.ghost;
      if (moved) {
        if (gameTime.isPaused() || !drop.current) { clear(); return; }
        const target = targetAt(event.clientX, event.clientY);
        if (target) { clear(); drop.current?.(target); return; }
        const start = {x:event.clientX,y:event.clientY,t:event.timeStamp};
        drag.samples.push(start);
        const velocity = flickVelocity(drag.samples);
        if (enabled && Math.hypot(velocity.x,velocity.y) > 0) {
          flying.current = true;
          const began = gameTime.now();
          let previous = start;
          const tick = () => {
            if (!drop.current || !drag.source.isConnected) { clear(); return; }
            const elapsed = (gameTime.now()-began)/1000;
            const point = flickPosition(start,velocity,elapsed);
            // Sweep the path in small steps so fast flicks cannot skip a receiver.
            const steps = Math.max(1,Math.ceil(Math.hypot(point.x-previous.x,point.y-previous.y)/6));
            for(let i=1;i<=steps;i++) {
              const target = targetAt(previous.x+(point.x-previous.x)*i/steps,previous.y+(point.y-previous.y)*i/steps);
              if(target) { clear(); drop.current?.(target); return; }
            }
            drag.ghost!.style.left = `${point.x}px`; drag.ghost!.style.top = `${point.y}px`;
            previous = {...point,t:0};
            if(elapsed >= 1 || point.x<0 || point.y<0 || point.x>innerWidth || point.y>innerHeight) { clear(); return; }
            frame.current = gameTime.requestAnimationFrame(tick);
          };
          frame.current = gameTime.requestAnimationFrame(tick);
          return;
        }
      }
      clear();
    },
    onPointerCancel: clear,
    onLostPointerCapture: () => { if (!flying.current) clear(); },
    onClickCapture: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (suppressClick.current) { suppressClick.current = false; if (event.detail !== 0) { event.preventDefault(); event.stopPropagation(); } }
    },
  };
}
