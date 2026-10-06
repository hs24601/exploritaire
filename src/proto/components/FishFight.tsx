import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { rankLabel, type Card } from '../protoState';
import { FIGHT_LIMIT, FIGHT_ZONE, createFight, fishInZone, playReelCard, reelDirection, stepFight, type FightState } from '../rules/fishFight';
import { catchForRank } from '../rules/fishing';
import { CATCH_GLYPH } from '../pondCatchFlight';
import { ProtoCard } from './ProtoCard';

export const CATCH_GLYPHS = CATCH_GLYPH;
const DIRECTIONS = { 1: 'up', [-1]: 'down', 0: 'none' } as Record<number, 'up' | 'down' | 'none'>;

/**
 * The fight after a bite: a Stardew-style fishing meter played with reel cards
 * (rules/fishFight.ts). Renders two pieces of the pond grid: the meter, in the
 * water's place, and the reel hand, in the bait hand's place.
 *
 * Reel cards play on press (pointer down, so touch and mouse both feel instant),
 * on Enter or Space, and from anywhere with the arrow keys (up plays a +1 card,
 * down a -1 card).
 */
export const FishFight = ({ seed, rank, onEnd }: {
  seed: number;
  rank: number;
  /** Called once when the fight ends, with where the fish and the line card were. */
  onEnd: (landed: boolean, fish: DOMRect | null, line: DOMRect | null) => void;
}) => {
  const [fight, setFight] = useState<FightState>(() => createFight(seed, rank));
  const fightRef = useRef(fight);
  const ended = useRef(false);
  const fishRef = useRef<HTMLSpanElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const tetherRef = useRef<SVGLineElement | null>(null);
  const kind = catchForRank(rank);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const update = (next: FightState) => {
    fightRef.current = next;
    setFight(next);
  };
  const play = (card: Card) => update(playReelCard(fightRef.current, card.id));
  const playDirection = (direction: number) => {
    const current = fightRef.current;
    const card = current.hand.find((entry) => reelDirection(current.line, entry.rank) === direction);
    if (card) play(card);
  };

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Long frames (a background tab) are capped so the fish cannot teleport.
      const next = stepFight(fightRef.current, Math.min(0.05, (now - last) / 1000));
      last = now;
      if (next !== fightRef.current) update(next);
      if (next.result) {
        if (!ended.current) {
          ended.current = true;
          onEndRef.current(next.result === 'landed', fishRef.current?.getBoundingClientRect() ?? null, lineRef.current?.getBoundingClientRect() ?? null);
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        playDirection(event.key === 'ArrowUp' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The line ties the line card to the fish, measured after each frame's layout.
  useLayoutEffect(() => {
    const panel = panelRef.current?.getBoundingClientRect();
    const line = lineRef.current?.getBoundingClientRect();
    const fish = fishRef.current?.getBoundingClientRect();
    const tether = tetherRef.current;
    if (!panel || !line || !fish || !tether) return;
    tether.setAttribute('x1', String(line.right - panel.left - 6));
    tether.setAttribute('y1', String(line.top - panel.top + 10));
    tether.setAttribute('x2', String(fish.left - panel.left + fish.width / 2));
    tether.setAttribute('y2', String(fish.top - panel.top + fish.height * 0.3));
  }, [fight]);

  const inZone = fishInZone(fight);
  const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
  return (
    <>
      <div ref={panelRef} className="proto-fight" role="group" aria-label={`Fighting a ${kind === 'fish' ? 'fish' : kind}, rank ${rankLabel(rank)}`}
        data-fish-pos={fight.fish.pos.toFixed(3)} data-zone-pos={fight.zone.pos.toFixed(3)} data-zone-goal={fight.zone.goal.toFixed(3)}
        data-progress={fight.progress.toFixed(3)} data-in-zone={inZone ? 'true' : undefined} data-result={fight.result ?? undefined}>
        <div className="proto-fight__line">
          <div ref={lineRef} className="proto-fight__line-card" title="The line card: play one rank above it to lift the zone, one below to drop it">
            <ProtoCard card={{ id: 'line', rank: fight.line }} disabled />
          </div>
          <div className="proto-fight__time" role="meter" aria-label="Line strength" aria-valuemin={0} aria-valuemax={FIGHT_LIMIT} aria-valuenow={Math.max(0, FIGHT_LIMIT - fight.time)}>
            <span style={{ width: percent(Math.max(0, 1 - fight.time / FIGHT_LIMIT)) }} />
          </div>
        </div>
        <div className="proto-fight__meter" aria-hidden="true">
          <div className="proto-fight__rail">
            <span className="proto-fight__zone" data-in={inZone ? 'true' : undefined} style={{ height: percent(FIGHT_ZONE), bottom: percent(fight.zone.pos - FIGHT_ZONE / 2) }} />
            <span ref={fishRef} className="proto-fight__fish" data-kind={kind} style={{ bottom: percent(fight.fish.pos) }}>{CATCH_GLYPHS[kind]}</span>
          </div>
        </div>
        <div className="proto-fight__bar" role="meter" aria-label="Catch" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fight.progress * 100)}>
          <span style={{ height: percent(fight.progress), ['--catch-hue' as string]: String(Math.round(fight.progress * 120)) }} />
        </div>
        <svg className="proto-fight__tether" aria-hidden="true"><line ref={tetherRef} /></svg>
      </div>
      <div className="proto-pond__hand proto-fight__hand" aria-label="Reel cards">
        {fight.hand.map((card) => {
          const direction = DIRECTIONS[reelDirection(fight.line, card.rank)];
          return (
            <div key={card.id} className="proto-fight__reel" data-reel={direction}
              onPointerDown={(event) => { if (event.pointerType !== 'mouse' || event.button === 0) { event.preventDefault(); play(card); } }}>
              <ProtoCard card={card} disabled={Boolean(fight.result)}
                onClick={(event) => { if (event.detail === 0) play(card); }} />
            </div>
          );
        })}
      </div>
    </>
  );
};
