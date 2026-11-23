import { useId, useLayoutEffect, useRef, useState } from 'react';

type Move = { cardId: string; actorId: string };
/** Shows the solver's recommended card and destination, following the board layout. */
export function RecommendedMoveArrow({ move }: { move: Move | null }) {
  const ref = useRef<SVGSVGElement>(null);
  const marker = useId().replace(/:/g, '');
  const [path, setPath] = useState('');
  useLayoutEffect(() => {
    const board = ref.current?.parentElement;
    if (!board || !move) { setPath(''); return; }
    const measure = () => {
      const source = Array.from(board.querySelectorAll<HTMLElement>('[data-battle-card]')).find(node => node.dataset.battleCard === move.cardId);
      const target = Array.from(board.querySelectorAll<HTMLElement>('[data-battle-actor]')).find(node => node.dataset.battleActor === move.actorId);
      if (!source || !target) { setPath(''); return; }
      const bounds = board.getBoundingClientRect(), from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
      const scale = board.offsetWidth ? bounds.width / board.offsetWidth : 1;
      const x = (from.left + from.width / 2 - bounds.left) / scale, y = (from.bottom - bounds.top) / scale;
      const tx = (to.left + to.width / 2 - bounds.left) / scale, ty = (to.top - bounds.top) / scale;
      setPath(`M ${x} ${y} C ${x} ${(y + ty) / 2}, ${tx} ${(y + ty) / 2}, ${tx} ${ty}`);
    };
    const observer = new ResizeObserver(measure); observer.observe(board);
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true); measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [move?.cardId, move?.actorId]);
  return <svg ref={ref} className="recommended-move-arrow" aria-label="Recommended tableau move" role="img">
    <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ffe58a" /></marker></defs>
    {path && <path data-recommended-move d={path} fill="none" stroke="#ffe58a" strokeWidth="3" markerEnd={`url(#${marker})`} />}
  </svg>;
}
