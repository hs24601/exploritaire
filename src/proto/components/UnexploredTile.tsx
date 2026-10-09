import { memo } from 'react';

/** Unvisited ground is invariant under camera spin. Keep its hundreds of
 * identical surfaces out of camera-driven scene reconciliation. */
export const UnexploredTile = memo(function UnexploredTile({ id, x, y, width, height, reference,
  tabletop, unlocked, selected, dropTarget }: {
  id: string; x: number; y: number; width: number; height: number; reference: string;
  tabletop: boolean; unlocked: boolean; selected: boolean; dropTarget: boolean;
}) {
  return <button data-board-piece="tile" data-tabletop={tabletop || undefined}
    data-grid-reference={reference} data-biome-id={id} data-explored="0.00" data-unexplored="true"
    data-tile-type="unexplored" data-selected={selected || undefined} data-drop-target={dropTarget || undefined}
    type="button" aria-label="Unexplored biome"
    className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center text-center transition ${dropTarget ? 'proto-drop-target ' : ''}${unlocked ? selected ? 'border-[#8ef2d4]/85 bg-[#8ef2d4]/12 text-[#cafff4]' : 'border-white/25 bg-[#0b1211]/95 text-white/68 hover:border-[#8ef2d4]/60' : 'cursor-not-allowed border-white/10 bg-black/40 text-white/25 opacity-65'}`}
    style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, width, height, background: 'transparent' }} />;
});
