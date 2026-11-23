/**
 * Rally and Break: kin foundations take ±1 receipts from seven columns until no move remains (or End Turn),
 * then every enemy acts one visible step at a time. Each receipt chips the target and builds stagger;
 * a full gauge breaks the enemy so it loses its next turn. Khad roots telegraph a Thorn Whip intent the party
 * can play onto to defuse (borrowed from Deep Breath: removing the last pip discards it and breaks the owner).
 */
import { KIN, type KinId } from './cityRules';
import { adjacent, nextRandom, randomRank, type Rng } from './golfRules';

export type FoeKind = 'slime' | 'root';
export const FOES: Record<FoeKind, { name: string; hp: number; plays: number; staggerMax: number }> = {
  slime: { name: 'Dark Slime', hp: 6, plays: 1, staggerMax: 5 },
  root: { name: 'Khad Root', hp: 12, plays: 1, staggerMax: 6 },
};
export const THORN_WHIP = { name: 'Thorn Whip', pips: 3, damage: 4, feeds: 1 };
export const AP_CAP = 6;
export const COLUMNS = 7;
export const DEPTH = 4;

export type Intent = { name: string; rank: number; pips: number; capacity: number; base: number; damage: number };
export type Foe = { kind: FoeKind; name: string; hp: number; maxHp: number; rank: number; stagger: number; staggerMax: number; broken: boolean; intent: Intent | null; rearm: number };
export type Fighter = { kin: KinId; hp: number; maxHp: number; rank: number; ap: number };
export type BattleStep = { kind: 'play' | 'chip' | 'feed' | 'pip' | 'fire' | 'broken' | 'rearm' | 'pity' | 'handoff'; text: string; foe?: number; fighter?: number; column?: number };
export type Battle = {
  rng: Rng;
  columns: number[][];
  fighters: Fighter[];
  foes: Foe[];
  target: number;
  turn: 'party' | 'enemy';
  result: 'won' | 'lost' | null;
  round: number;
  cursor: { foe: number; stage: 'start' | 'feed' | 'pip' | 'play' | 'done'; count: number };
  last: BattleStep | null;
};

export function createBattle(seed: number, kin: { id: KinId; hp: number; maxHp: number }[], foes: FoeKind[]): Battle {
  const rng = { seed };
  const columns = Array.from({ length: COLUMNS }, () => Array.from({ length: DEPTH }, () => randomRank(rng)));
  const b: Battle = {
    rng, columns, target: 0, turn: 'party', result: null, round: 1, last: null,
    cursor: { foe: 0, stage: 'start', count: 0 },
    fighters: kin.map(k => ({ kin: k.id, hp: k.hp, maxHp: k.maxHp, rank: randomRank(rng), ap: 0 })),
    foes: foes.map(kind => ({ kind, name: FOES[kind].name, hp: FOES[kind].hp, maxHp: FOES[kind].hp, rank: randomRank(rng), stagger: 0, staggerMax: FOES[kind].staggerMax, broken: false, intent: null, rearm: 0 })),
  };
  b.foes.forEach(f => { if (f.kind === 'root') f.intent = newIntent(rng); });
  return openPartyTurn(b);
}

const newIntent = (rng: Rng): Intent => ({ name: THORN_WHIP.name, rank: randomRank(rng), pips: 0, capacity: THORN_WHIP.pips, base: THORN_WHIP.pips, damage: THORN_WHIP.damage });
export const intentDamage = (i: Intent) => Math.round(i.damage * i.capacity / i.base);
const clone = (b: Battle): Battle => structuredClone(b);
export const exposedRank = (b: Battle, col: number) => b.columns[col][b.columns[col].length - 1];
export const alive = <T extends { hp: number }>(x: T) => x.hp > 0;

/** Take the exposed card; infinifill slides a fresh card in at the back so each column keeps its depth. */
function take(b: Battle, col: number) {
  const rank = b.columns[col].pop()!;
  b.columns[col].unshift(randomRank(b.rng));
  return rank;
}

export function canPlayOnFighter(b: Battle, col: number, f: number) {
  const x = b.fighters[f];
  return b.turn === 'party' && !b.result && !!x && alive(x) && adjacent(exposedRank(b, col), x.rank);
}
export function canPlayOnIntent(b: Battle, col: number, foe: number) {
  const i = b.foes[foe]?.intent;
  return b.turn === 'party' && !b.result && !!i && alive(b.foes[foe]) && adjacent(exposedRank(b, col), i.rank);
}
export function partyHasMove(b: Battle) {
  for (let c = 0; c < b.columns.length; c++) {
    if (b.fighters.some((_, f) => canPlayOnFighter(b, c, f))) return true;
    if (b.foes.some((_, i) => canPlayOnIntent(b, c, i))) return true;
  }
  return false;
}

function hit(b: Battle, foe: number, damage: number, stagger: number) {
  const x = b.foes[foe];
  if (!x || !alive(x)) return;
  x.hp = Math.max(0, x.hp - damage);
  if (!alive(x)) { x.intent = null; return; }
  if (x.broken) return;
  x.stagger += stagger;
  if (x.stagger >= x.staggerMax) breakFoe(x);
}

/** Break: the enemy loses its next turn; each later break needs twice the stagger. */
function breakFoe(x: Foe) {
  x.broken = true; x.stagger = 0; x.staggerMax *= 2;
}

function settle(b: Battle) {
  if (b.foes.every(f => !alive(f))) b.result = 'won';
  else if (b.fighters.every(f => !alive(f))) b.result = 'lost';
  if (!alive(b.foes[b.target] ?? { hp: 0 })) b.target = Math.max(0, b.foes.findIndex(alive));
}

export function playOnFighter(b0: Battle, col: number, f: number): Battle | null {
  if (!canPlayOnFighter(b0, col, f)) return null;
  const b = clone(b0);
  const x = b.fighters[f];
  x.rank = take(b, col);
  x.ap = Math.min(AP_CAP, x.ap + 1);
  hit(b, b.target, 1, 1);
  b.last = { kind: 'play', text: `${KIN[x.kin].name} takes ${x.rank}`, fighter: f, column: col };
  settle(b);
  return b;
}

export function playOnIntent(b0: Battle, col: number, foe: number): Battle | null {
  if (!canPlayOnIntent(b0, col, foe)) return null;
  const b = clone(b0);
  const x = b.foes[foe], i = x.intent!;
  i.rank = take(b, col);
  if (i.pips > 0) i.pips--; else i.capacity--;
  b.last = { kind: 'play', text: `${i.name} weakened`, foe, column: col };
  if (i.capacity <= 0) {
    x.intent = null; x.rearm = 2;
    if (!x.broken) breakFoe(x);
    b.last = { kind: 'broken', text: `${i.name} unravels and ${x.name} is broken`, foe };
  }
  return b;
}

export function setTarget(b: Battle, foe: number): Battle {
  return alive(b.foes[foe] ?? { hp: 0 }) ? { ...b, target: foe } : b;
}

export function canUseAbility(b: Battle, f: number, target: { foe?: number; ally?: number }) {
  const x = b.fighters[f];
  if (!x || !alive(x) || b.turn !== 'party' || b.result) return false;
  const a = KIN[x.kin].ability;
  if (x.ap < a.cost) return false;
  if (a.heal) return target.ally !== undefined && alive(b.fighters[target.ally] ?? { hp: 0 }) && b.fighters[target.ally].hp < b.fighters[target.ally].maxHp;
  return target.foe !== undefined && alive(b.foes[target.foe] ?? { hp: 0 });
}

export function useAbility(b0: Battle, f: number, target: { foe?: number; ally?: number }): Battle | null {
  if (!canUseAbility(b0, f, target)) return null;
  const b = clone(b0);
  const x = b.fighters[f], a = KIN[x.kin].ability;
  x.ap -= a.cost;
  if (a.heal) {
    const ally = b.fighters[target.ally!];
    ally.hp = Math.min(ally.maxHp, ally.hp + a.heal);
    b.last = { kind: 'play', text: `${KIN[x.kin].name} mends ${KIN[ally.kin].name}`, fighter: target.ally };
  } else {
    hit(b, target.foe!, a.damage, a.stagger);
    b.last = { kind: 'play', text: `${a.name}!`, foe: target.foe };
  }
  settle(b);
  return b;
}

export function endPartyTurn(b0: Battle): Battle {
  if (b0.turn !== 'party' || b0.result) return b0;
  return { ...clone(b0), turn: 'enemy', cursor: { foe: 0, stage: 'start', count: 0 }, last: { kind: 'handoff', text: 'Enemy turn' } };
}

/** Party turn opens with a free pity flip when nothing is playable: one living kin takes a fresh foundation value. */
function openPartyTurn(b: Battle): Battle {
  b.turn = 'party';
  if (!partyHasMove(b)) {
    const f = b.fighters.findIndex(alive);
    if (f >= 0) {
      const options = b.columns.map((_, c) => exposedRank(b, c));
      const pick = options[Math.floor(nextRandom(b.rng) * options.length)];
      b.fighters[f].rank = pick === 13 ? 12 : pick + 1;
      b.last = { kind: 'pity', text: `Pity flip: ${KIN[b.fighters[f].kin].name} turns up a fresh card`, fighter: f };
    }
  }
  return b;
}

const lowestFighter = (b: Battle) => {
  let best = -1;
  b.fighters.forEach((x, i) => { if (alive(x) && (best < 0 || x.hp < b.fighters[best].hp)) best = i; });
  return best;
};
const matchingColumn = (b: Battle, rank: number) => {
  let best = -1;
  for (let c = 0; c < b.columns.length; c++) if (adjacent(exposedRank(b, c), rank) && (best < 0 || exposedRank(b, c) > exposedRank(b, best))) best = c;
  return best;
};

/** Advance the enemy turn by exactly one visible action. Returns the new battle; `turn` flips back to party when done. */
export function enemyStep(b0: Battle): Battle {
  if (b0.turn !== 'enemy' || b0.result) return b0;
  const b = clone(b0);
  const cur = b.cursor;
  for (;;) {
    if (cur.foe >= b.foes.length) {
      b.round++;
      const opened = openPartyTurn(b);
      if (!opened.last || opened.last.kind !== 'pity') opened.last = { kind: 'handoff', text: 'Your turn' };
      return opened;
    }
    const x = b.foes[cur.foe];
    const advance = () => { cur.foe++; cur.stage = 'start'; cur.count = 0; };
    if (!alive(x)) { advance(); continue; }
    if (cur.stage === 'start') {
      if (x.broken) {
        x.broken = false; advance();
        b.last = { kind: 'broken', text: `${x.name} is broken and loses its turn`, foe: cur.foe - 1 };
        return b;
      }
      if (!x.intent && x.kind === 'root') {
        if (x.rearm > 1) x.rearm--;
        else { x.intent = newIntent(b.rng); x.rearm = 0; cur.stage = 'feed'; b.last = { kind: 'rearm', text: `${x.name} coils a new ${THORN_WHIP.name}`, foe: cur.foe }; return b; }
      }
      cur.stage = x.intent ? 'feed' : 'play';
      continue;
    }
    if (cur.stage === 'feed') {
      const i = x.intent;
      const col = i && cur.count < THORN_WHIP.feeds ? matchingColumn(b, i.rank) : -1;
      if (i && col >= 0) {
        i.rank = take(b, col); i.pips = Math.min(i.capacity, i.pips + 1); cur.count++;
        b.last = { kind: 'feed', text: `${x.name} feeds ${i.name}`, foe: cur.foe, column: col };
        return b;
      }
      cur.stage = 'pip'; cur.count = 0; continue;
    }
    if (cur.stage === 'pip') {
      const i = x.intent!;
      cur.stage = 'play';
      if (i.pips < i.capacity) { i.pips++; if (i.pips < i.capacity) { b.last = { kind: 'pip', text: `${i.name} gathers (${i.pips}/${i.capacity})`, foe: cur.foe }; return b; } }
      const dmg = intentDamage(i);
      b.fighters.forEach(f => { if (alive(f)) f.hp = Math.max(0, f.hp - dmg); });
      i.pips = 0;
      b.last = { kind: 'fire', text: `${i.name} lashes everyone for ${dmg}`, foe: cur.foe };
      settle(b);
      return b;
    }
    if (cur.stage === 'play') {
      const col = cur.count < FOES[x.kind].plays ? matchingColumn(b, x.rank) : -1;
      const target = lowestFighter(b);
      if (col >= 0 && target >= 0) {
        x.rank = take(b, col); cur.count++;
        const f = b.fighters[target];
        f.hp = Math.max(0, f.hp - 1);
        b.last = { kind: 'chip', text: `${x.name} takes ${x.rank} and hits ${KIN[f.kin].name}`, foe: cur.foe, fighter: target, column: col };
        settle(b);
        return b;
      }
      advance(); continue;
    }
  }
}
