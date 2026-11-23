/**
 * ?city: one open table of loose cards. Everything (kin, resource cards, token piles, zones, enemies, recipes, buildings,
 * the den) is a card you can drag anywhere and stack onto another card to act. Pinch or wheel to zoom; three fingers,
 * or a mouse drag on empty table, to pan.
 */
import { StrictMode, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import {
  build, BUILDINGS, canAfford, canExplore, CARD_KINDS, clearZone, combine, createCity, dryBerries, ENCOUNTERS, exploreCost, explore,
  foodNeed, foodStored, gather, has, housing, activeKin, KIN, kinOf, learn, load, maxHp, maxStamina, receiptYield, RESOURCE_ORDER,
  RESOURCES, rest, SAVE_KEY, spendStamina, storage, ZONES,
  type BuildingId, type CityState, type KinId, type ResourceId, type ZoneId,
} from './rules/cityRules';
import { createBattle, type Battle } from './rules/combatRules';
import { FoePortrait, KinPortrait, ResourceGlyph } from './cityArt';
import { GatherTable, LayoutSwitch, StaminaPegs } from './GatherTable';
import { BattleTable } from './BattleTable';
import './cityGame.css';

// ---- table entities ------------------------------------------------------------------------------
export const CARD_W = 132, CARD_H = 184, PILE = 104, STACK_OFFSET = 40;
type Pos = { x: number; y: number };
type Entity =
  | { id: string; kind: 'den' }
  | { id: string; kind: 'kin'; kin: KinId }
  | { id: string; kind: 'source'; card: string }
  | { id: string; kind: 'zone'; zone: ZoneId }
  | { id: string; kind: 'enemy'; zone: ZoneId }
  | { id: string; kind: 'pile'; res: ResourceId }
  | { id: string; kind: 'recipe'; building: BuildingId }
  | { id: string; kind: 'building'; building: BuildingId; index: number };
const sizeOf = (e: Entity) => e.kind === 'pile' ? { w: PILE, h: PILE } : { w: CARD_W, h: CARD_H };

const ZONE_ANCHOR: Record<ZoneId, Pos> = {
  den: { x: 0, y: 0 }, thicket: { x: -600, y: -430 }, hollow: { x: 40, y: -470 }, stream: { x: 640, y: -430 }, frost: { x: -640, y: 330 }, ember: { x: 760, y: 300 },
};

function entitiesOf(s: CityState): Entity[] {
  const list: Entity[] = [{ id: 'den', kind: 'den' }];
  s.kin.forEach(k => list.push({ id: `kin:${k.id}`, kind: 'kin', kin: k.id }));
  s.zones.forEach(z => {
    if (!z.revealed) { list.push({ id: `zone:${z.id}`, kind: 'zone', zone: z.id }); return; }
    if (!z.cleared && ZONES[z.id].encounter) list.push({ id: `enemy:${z.id}`, kind: 'enemy', zone: z.id });
    s.cards.filter(c => c.zone === z.id).forEach(c => list.push({ id: `source:${c.id}`, kind: 'source', card: c.id }));
  });
  RESOURCE_ORDER.forEach(r => { if (s.tokens[r] > 0) list.push({ id: `pile:${r}`, kind: 'pile', res: r }); });
  s.recipes.forEach(b => { if (BUILDINGS[b].repeatable || !has(s, b)) list.push({ id: `recipe:${b}`, kind: 'recipe', building: b }); });
  s.buildings.forEach((b, index) => list.push({ id: `building:${index}`, kind: 'building', building: b, index }));
  return list;
}

/** Where a newly appearing card wants to sit before overlap avoidance. */
function anchorOf(e: Entity, s: CityState, table: Record<string, Pos>): Pos {
  switch (e.kind) {
    case 'den': return { x: 0, y: 0 };
    case 'kin': return { x: -200 + KIN_INDEX[e.kin] * 150, y: 250 };
    case 'zone': return ZONE_ANCHOR[e.zone];
    case 'enemy': return ZONE_ANCHOR[e.zone];
    case 'source': {
      const c = s.cards.find(x => x.id === e.card)!, at = ZONE_ANCHOR[c.zone], i = s.cards.filter(x => x.zone === c.zone).indexOf(c);
      return c.zone === 'den' ? { x: 170 + i * 150, y: 0 } : { x: at.x + (i - 0.5) * 150, y: at.y + (ZONES[c.zone].encounter ? 210 : 0) };
    }
    case 'pile': { const i = RESOURCE_ORDER.indexOf(e.res); return { x: -150 - (i % 3) * 120, y: (i < 3 ? 0 : 130) }; }
    case 'recipe': return { x: 480, y: -40 };
    case 'building': return table.den ? { x: table.den.x - 170, y: table.den.y } : { x: -170, y: 0 };
  }
}
const KIN_INDEX: Record<KinId, number> = { hero: 0, mochi: 1, banks: 2, riv: 3, demi: 4, cir: 5 };

const overlaps = (a: Pos, as: { w: number; h: number }, b: Pos, bs: { w: number; h: number }) =>
  a.x < b.x + bs.w - 8 && b.x < a.x + as.w - 8 && a.y < b.y + bs.h - 8 && b.y < a.y + as.h - 8;

/** Fill in positions for cards that have none yet, spiralling out from their anchor to a free spot. */
function placeMissing(s: CityState, list: Entity[]): Record<string, Pos> | null {
  const table = { ...(s.table ?? {}) };
  let changed = false;
  for (const e of list) {
    if (table[e.id]) continue;
    const anchor = anchorOf(e, s, table), size = sizeOf(e);
    const taken = list.filter(o => table[o.id]).map(o => ({ p: table[o.id], s: sizeOf(o) }));
    let spot = anchor;
    outer: for (let ring = 0; ring < 30; ring++) {
      for (let i = 0; i < Math.max(1, ring * 8); i++) {
        const a = ring ? (i / (ring * 8)) * Math.PI * 2 : 0;
        const p = { x: Math.round(anchor.x + Math.cos(a) * ring * 80), y: Math.round(anchor.y + Math.sin(a) * ring * 80) };
        if (!taken.some(t => overlaps(p, size, t.p, t.s))) { spot = p; break outer; }
      }
    }
    table[e.id] = spot; changed = true;
  }
  return changed ? table : null;
}

// ---- persistence ----------------------------------------------------------------------------------
const readSave = () => { try { return load(localStorage.getItem(SAVE_KEY)); } catch { return null; } };
const writeSave = (s: CityState) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage unavailable: play continues unsaved */ } };
const seedNow = () => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;

type Session =
  | { kind: 'gather'; kin: KinId; cardId: string; seed: number }
  | { kind: 'battle'; zone: ZoneId; kin: KinId[]; battle: Battle }
  | { kind: 'reset' }
  | null;
type Camera = { x: number; y: number; z: number };

function CityGame() {
  const [city, setCityState] = useState<CityState>(() => readSave() ?? createCity(seedNow()));
  const cityRef = useRef(city);
  const setCity = (next: CityState) => { cityRef.current = next; setCityState(next); };
  useEffect(() => { writeSave(city); }, [city]);
  const [session, setSession] = useState<Session>(null);
  const [note, setNote] = useState<string | null>(null);
  const flash = (text: string) => setNote(text || null);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 2800); return () => clearTimeout(t); }, [note]);
  // Kin stacked on an enemy card form that fight's party.
  const [party, setParty] = useState<Partial<Record<ZoneId, KinId[]>>>({});
  const [z, setZ] = useState<Record<string, number>>({});
  const zTop = useRef(10);
  const raise = (id: string) => setZ(m => ({ ...m, [id]: ++zTop.current }));

  const entities = useMemo(() => entitiesOf(city), [city]);
  useEffect(() => { const t = placeMissing(city, entities); if (t) setCity({ ...cityRef.current, table: t }); }, [entities]); // eslint-disable-line react-hooks/exhaustive-deps
  const table = city.table ?? {};
  const pos = (id: string): Pos => table[id] ?? { x: 0, y: 0 };
  const moveTo = (id: string, p: Pos) => setCity({ ...cityRef.current, table: { ...(cityRef.current.table ?? {}), [id]: { x: Math.round(p.x), y: Math.round(p.y) } } });
  const stackOn = (id: string, target: string, depth = 1) => { const t = cityRef.current.table?.[target] ?? pos(target); moveTo(id, { x: t.x, y: t.y + STACK_OFFSET * depth }); raise(id); };

  // ---- camera --------------------------------------------------------------------------------------
  const viewport = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, z: 0.7 });
  const camRef = useRef(cam); camRef.current = cam;
  const fit = (campOnly = false) => {
    const v = viewport.current; if (!v) return;
    const camp = (e: Entity) => e.kind === 'den' || e.kind === 'kin' || e.kind === 'pile' || (e.kind === 'source' && e.card.startsWith('den-'));
    const ps = entities.filter(e => !campOnly || camp(e)).map(e => ({ p: table[e.id], s: sizeOf(e) })).filter(x => x.p);
    if (!ps.length) return;
    const minX = Math.min(...ps.map(x => x.p.x)), maxX = Math.max(...ps.map(x => x.p.x + x.s.w));
    const minY = Math.min(...ps.map(x => x.p.y)), maxY = Math.max(...ps.map(x => x.p.y + x.s.h));
    const zoom = clampZoom(Math.min(1.1, v.clientWidth / (maxX - minX + 60), (v.clientHeight - 120) / (maxY - minY + 60)));
    setCam({ z: zoom, x: (minX + maxX) / 2 - v.clientWidth / 2 / zoom, y: (minY + maxY) / 2 - v.clientHeight / 2 / zoom });
  };
  const fitted = useRef(false);
  useEffect(() => { if (!fitted.current && city.table && Object.keys(city.table).length >= entities.length) { fitted.current = true; fit(true); } }); // eslint-disable-line react-hooks/exhaustive-deps
  const toWorld = (cx: number, cy: number): Pos => {
    const r = viewport.current!.getBoundingClientRect(), c = camRef.current;
    return { x: (cx - r.left) / c.z + c.x, y: (cy - r.top) / c.z + c.y };
  };
  const zoomAt = (cx: number, cy: number, factor: number) => {
    const r = viewport.current!.getBoundingClientRect(), c = camRef.current;
    const nz = clampZoom(c.z * factor), wx = (cx - r.left) / c.z + c.x, wy = (cy - r.top) / c.z + c.y;
    setCam({ z: nz, x: wx - (cx - r.left) / nz, y: wy - (cy - r.top) / nz });
  };
  useEffect(() => {
    const v = viewport.current; if (!v) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
      else setCam(c => ({ ...c, x: c.x + e.deltaX / c.z }));
    };
    const block = (e: Event) => e.preventDefault();
    v.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('gesturestart', block); document.addEventListener('gesturechange', block);
    return () => { v.removeEventListener('wheel', wheel); document.removeEventListener('gesturestart', block); document.removeEventListener('gesturechange', block); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- gestures: one pointer drags a card (or, with a mouse, pans empty table); two pinch; three pan --------
  const pointers = useRef(new Map<number, Pos>());
  const gesture = useRef<null | { kind: 'card'; id: string; pointer: number; grab: Pos; start: Pos; moved: boolean; origin: Pos }
    | { kind: 'pan'; start: Pos; cam: Camera; count: number }
    | { kind: 'pinch'; dist: number; mid: Pos; cam: Camera }>(null);
  const [dragging, setDragging] = useState<{ id: string; at: Pos } | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const centroid = () => { const ps = [...pointers.current.values()]; return { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length }; };
  const spread = () => { const [a, b] = [...pointers.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const cancelCardDrag = () => { if (gesture.current?.kind === 'card') { setDragging(null); setHover(null); } };
  const beginMulti = () => {
    cancelCardDrag();
    const n = pointers.current.size;
    if (n === 2) gesture.current = { kind: 'pinch', dist: spread(), mid: centroid(), cam: camRef.current };
    else if (n >= 3) gesture.current = { kind: 'pan', start: centroid(), cam: camRef.current, count: n };
  };

  const hitTest = (p: Pos, exclude: string) => {
    const order = [...entities].filter(e => e.id !== exclude && table[e.id]).sort((a, b) => (z[b.id] ?? 0) - (z[a.id] ?? 0));
    return order.find(e => { const q = table[e.id], s = sizeOf(e); return p.x >= q.x && p.x <= q.x + s.w && p.y >= q.y && p.y <= q.y + s.h; })?.id ?? null;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, .city-hud, .city-note')) return;
    try { viewport.current!.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === 'touch' && pointers.current.size >= 2) { beginMulti(); return; }
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-entity]')?.dataset.entity;
    if (card && e.button === 0 && !(e.pointerType === 'mouse' && e.shiftKey)) {
      const w = toWorld(e.clientX, e.clientY), p = pos(card);
      gesture.current = { kind: 'card', id: card, pointer: e.pointerId, grab: { x: w.x - p.x, y: w.y - p.y }, start: { x: e.clientX, y: e.clientY }, moved: false, origin: p };
    } else if (e.pointerType !== 'touch') {
      gesture.current = { kind: 'pan', start: { x: e.clientX, y: e.clientY }, cam: camRef.current, count: 1 };
    } else gesture.current = null;
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'card' && e.pointerId === g.pointer) {
      if (!g.moved && Math.hypot(e.clientX - g.start.x, e.clientY - g.start.y) < 6) return;
      if (!g.moved) { g.moved = true; raise(g.id); }
      const w = toWorld(e.clientX, e.clientY), at = { x: w.x - g.grab.x, y: w.y - g.grab.y };
      setDragging({ id: g.id, at });
      setHover(hitTest(w, g.id));
    } else if (g.kind === 'pan') {
      const c = centroid();
      setCam({ ...g.cam, x: g.cam.x - (c.x - g.start.x) / g.cam.z, y: g.cam.y - (c.y - g.start.y) / g.cam.z });
    } else if (g.kind === 'pinch' && pointers.current.size === 2) {
      const r = viewport.current!.getBoundingClientRect(), mid = centroid(), nz = clampZoom(g.cam.z * spread() / g.dist);
      const wx = (g.mid.x - r.left) / g.cam.z + g.cam.x, wy = (g.mid.y - r.top) / g.cam.z + g.cam.y;
      setCam({ z: nz, x: wx - (mid.x - r.left) / nz, y: wy - (mid.y - r.top) / nz });
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g?.kind === 'card' && e.pointerId === g.pointer) {
      gesture.current = null;
      setDragging(null); setHover(null);
      if (!g.moved || e.type === 'pointercancel') return;
      const w = toWorld(e.clientX, e.clientY), at = { x: w.x - g.grab.x, y: w.y - g.grab.y };
      const target = hitTest(w, g.id);
      moveTo(g.id, at);
      if (target) dropOn(g.id, target, g.origin);
      else detach(g.id);
      return;
    }
    if (pointers.current.size >= 2) beginMulti();
    else if (!pointers.current.size) gesture.current = null;
    else if (g?.kind !== 'card') gesture.current = null;
  };

  // ---- stacking rules ------------------------------------------------------------------------------
  const detach = (id: string) => {
    if (!id.startsWith('kin:')) return;
    const kin = id.slice(4) as KinId;
    setParty(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, (v ?? []).filter(x => x !== kin)])) as typeof p);
  };
  const bounce = (id: string, origin: Pos, text: string) => { moveTo(id, origin); flash(text); };

  const dropOn = (id: string, target: string, origin: Pos) => {
    const s = cityRef.current;
    const [kind, key] = splitId(id), [tkind, tkey] = splitId(target);
    if (kind === 'kin') {
      detach(id);
      const kin = key as KinId, k = kinOf(s, kin)!;
      if (!k.housed) return bounce(id, origin, `${KIN[kin].name} needs a Burrow before working.`);
      if (tkind === 'source') {
        const card = s.cards.find(c => c.id === tkey)!;
        if (!s.zones.find(zn => zn.id === card.zone)!.cleared) return bounce(id, origin, 'Enemies guard this card.');
        if (k.stamina < 1) return bounce(id, origin, `${KIN[kin].name} is out of stamina. Rest at the den.`);
        if (card.yield <= 0) return bounce(id, origin, `The ${CARD_KINDS[card.kind].name} is picked clean for today.`);
        stackOn(id, target);
        setSession({ kind: 'gather', kin, cardId: card.id, seed: seedNow() });
      } else if (tkind === 'zone') {
        const zone = tkey as ZoneId;
        if (!canExplore(s, zone)) return bounce(id, origin, `${ZONES[zone].name} is cut off. It needs a ${BUILDINGS[ZONES[zone].requires!].name}.`);
        const next = explore(s, zone, kin);
        if (!next) return bounce(id, origin, `${KIN[kin].name} needs ${exploreCost(s)} stamina to scout.`);
        const zp = s.table?.[target] ?? ZONE_ANCHOR[zone];
        const t = { ...(next.table ?? {}) }; delete t[target];
        // Cards revealed by the zone appear where its face-down card lay.
        if (ZONES[zone].encounter) t[`enemy:${zone}`] = zp;
        next.cards.filter(c => c.zone === zone).forEach((c, i) => { t[`source:${c.id}`] = { x: zp.x + (i - 0.5) * 150, y: zp.y + (ZONES[zone].encounter ? 220 : 0) }; });
        t[id] = { x: zp.x + 170, y: zp.y - 40 };
        setCity({ ...next, table: t });
        const rescued = ZONES[zone].rescue && !ZONES[zone].encounter ? ZONES[zone].rescue : null;
        flash(rescued ? `${KIN[kin].name} found ${ZONES[zone].name}, and ${KIN[rescued].name} with it!` : `${KIN[kin].name} scouted ${ZONES[zone].name}.`);
      } else if (tkind === 'enemy') {
        const zone = tkey as ZoneId, cur = party[zone] ?? [];
        if (k.stamina < 1) return bounce(id, origin, `${KIN[kin].name} is out of stamina.`);
        if (cur.length >= 2 && !cur.includes(kin)) return bounce(id, origin, 'Two kin at most per fight.');
        const next = cur.includes(kin) ? cur : [...cur, kin];
        setParty(p => ({ ...p, [zone]: next }));
        stackOn(id, target, next.indexOf(kin) + 1);
      } else if (tkind === 'kin') {
        // Kin onto kin just tidies them into a stack.
        stackOn(id, target);
      }
      return;
    }
    if (kind === 'pile') {
      const res = key as ResourceId;
      if (tkind === 'pile') {
        const { state, found } = combine(s, res, tkey as ResourceId);
        if (found) { setCity({ ...state, table: { ...(state.table ?? {}), [id]: origin } }); flash(`Recipe discovered: ${BUILDINGS[found].name}!`); }
        else bounce(id, origin, 'Nothing comes of that combination.');
      } else if (tkind === 'recipe') {
        const b = tkey as BuildingId, cost = BUILDINGS[b].cost;
        if (!canAfford(s, cost)) return bounce(id, origin, `${BUILDINGS[b].name} needs ${costText(cost)}.`);
        const built = build(s, b);
        if (!built) return bounce(id, origin, `${BUILDINGS[b].name} can't be built.`);
        const rp = s.table?.[target];
        const t = { ...(built.table ?? {}), [id]: origin };
        t[`building:${built.buildings.length - 1}`] = rp ?? origin;
        if (!BUILDINGS[b].repeatable) delete t[target]; else if (rp) t[target] = { x: rp.x + 150, y: rp.y };
        setCity({ ...built, table: t });
        flash(`${BUILDINGS[b].name} built.`);
      } else if (tkind === 'building' && res === 'berry' && s.buildings[Number(tkey)] === 'rack') {
        const next = dryBerries(s);
        if (!next) return bounce(id, origin, 'The rack needs 3 berries and room to store them.');
        setCity({ ...next, table: { ...(next.table ?? {}), [id]: origin } });
        flash('Dried 3 berries into 2 dried berries.');
      }
    }
  };

  // ---- sessions ------------------------------------------------------------------------------------
  const fight = (zone: ZoneId) => {
    const picked = party[zone] ?? [];
    let s = cityRef.current;
    for (const kin of picked) { const paid = spendStamina(s, kin, 1); if (!paid) return flash(`${KIN[kin].name} is out of stamina.`); s = paid; }
    setCity(s);
    const kin = picked.map(id => { const k = kinOf(s, id)!; return { id, hp: k.hp, maxHp: maxHp(k) }; });
    setSession({ kind: 'battle', zone, kin: picked, battle: createBattle(seedNow(), kin, ENCOUNTERS[ZONES[zone].encounter!].foes) });
  };
  const finishBattle = (zone: ZoneId, b: Battle) => {
    let s = cityRef.current;
    s = { ...s, kin: s.kin.map(k => { const f = b.fighters.find(x => x.kin === k.id); if (!f) return k; return b.result === 'won' ? { ...k, hp: Math.max(1, f.hp) } : { ...k, hp: 1, stamina: 0 }; }) };
    const ep = s.table?.[`enemy:${zone}`];
    if (b.result === 'won') {
      const before = s;
      s = clearZone(s, zone);
      const rescued = ZONES[zone].rescue && !kinOf(before, ZONES[zone].rescue!) ? ZONES[zone].rescue! : null;
      const recipe = ZONES[zone].recipe && !before.recipes.includes(ZONES[zone].recipe!) ? ZONES[zone].recipe! : null;
      const t = { ...(s.table ?? {}) }; delete t[`enemy:${zone}`];
      if (ep && rescued) t[`kin:${rescued}`] = ep;
      if (ep && recipe) t[`recipe:${recipe}`] = { x: ep.x + 150, y: ep.y };
      s = { ...s, table: t };
      const bits = [`${ZONES[zone].name} is clear.`];
      if (rescued) bits.push(kinOf(s, rescued)!.housed ? `${KIN[rescued].name} joins the camp!` : `${KIN[rescued].name} is rescued and needs a Burrow.`);
      if (recipe) bits.push(`Recipe card: ${BUILDINGS[recipe].name}.`);
      flash(bits.join(' '));
    } else if (ep) {
      // Driven back: the party is pushed off the enemy card.
      const t = { ...(s.table ?? {}) };
      (party[zone] ?? []).forEach((k, i) => { t[`kin:${k}`] = { x: ep.x - 170 - i * 30, y: ep.y + 60 + i * STACK_OFFSET }; });
      s = { ...s, table: t };
    }
    setParty(p => ({ ...p, [zone]: [] }));
    setCity(s); setSession(null);
  };
  const doRest = () => {
    const s = rest(cityRef.current);
    setCity(s);
    const r = s.lastRest!;
    flash(r.hungry.length ? `Day ${s.day}. ${r.hungry.map(k => KIN[k].name).join(' and ')} went hungry and woke malnourished.` : `Day ${s.day}. Everyone ate and slept well.`);
  };

  const s = city;
  const need = foodNeed(s), stored = foodStored(s);
  const gatherSession = session?.kind === 'gather' ? session : null;
  const gatherCard = gatherSession ? s.cards.find(c => c.id === gatherSession.cardId)! : null;
  const gatherKin = gatherSession ? kinOf(s, gatherSession.kin)! : null;

  const renderCard = (e: Entity) => {
    switch (e.kind) {
      case 'den': return (
        <div className="city-c city-c--den">
          <header>Den</header>
          <div className="city-c__body"><span className="city-c__big">Day {s.day}</span><small>Food {stored} / {need} needed</small><small>{activeKin(s).length}/{housing(s)} housed</small></div>
          <button type="button" className="city-btn city-btn--bell" onClick={doRest}>Rest</button>
        </div>);
      case 'kin': {
        const k = kinOf(s, e.kin)!, max = maxStamina(s, k);
        return (
          <div className={`city-c city-c--kin${k.housed ? '' : ' is-waiting'}${k.stamina ? '' : ' is-spent'}`}>
            <header>{KIN[e.kin].name}</header>
            <KinPortrait kin={e.kin} label={KIN[e.kin].name} />
            <StaminaPegs value={k.stamina} max={max} />
            <small>HP {k.hp}/{maxHp(k)} · eats {KIN[e.kin].food}</small>
            {k.malnourished && <span className="city-badge city-badge--bad">Malnourished</span>}
            {!k.housed && <span className="city-badge">Needs a Burrow</span>}
          </div>);
      }
      case 'source': {
        const c = s.cards.find(x => x.id === e.card)!, kind = CARD_KINDS[c.kind];
        return (
          <div className={`city-c city-c--source city-c--${c.kind}${c.yield ? '' : ' is-bare'}`}>
            <header>{kind.name}</header>
            <span className="city-c__art"><ResourceGlyph r={kind.resource} size={64} /></span>
            <span className="city-c__yield">{c.yield}/{kind.max}</span>
          </div>);
      }
      case 'zone': {
        const blocked = !!ZONES[e.zone].requires && !has(s, ZONES[e.zone].requires!);
        return (
          <div className={`city-c city-c--back${blocked ? ' is-blocked' : ''}`}>
            <span className="city-c__q">?</span>
            <small>{blocked ? `Needs a ${BUILDINGS[ZONES[e.zone].requires!].name}` : exploreCost(s) ? 'Scout · 1 stamina' : 'Scout · free'}</small>
          </div>);
      }
      case 'enemy': {
        const enc = ENCOUNTERS[ZONES[e.zone].encounter!], p = party[e.zone] ?? [];
        return (
          <div className="city-c city-c--enemy">
            {/* Stacked kin cover the body, so the fight control lives in the header strip that stays visible. */}
            <header className="city-c__head">
              <span>{enc.name}</span>
              {p.length > 0 && <button type="button" className="city-fight" onClick={() => fight(e.zone)} aria-label={`Fight with ${p.map(k => KIN[k].name).join(' and ')}`}>Fight</button>}
            </header>
            <div className="city-c__foes">{enc.foes.map((f, i) => <FoePortrait key={i} kind={f} label={f === 'slime' ? 'Dark Slime' : 'Khad Root'} />)}</div>
            <small>{ZONES[e.zone].name}</small>
            <small>Stack up to two kin here, then Fight. 1 stamina each.</small>
          </div>);
      }
      case 'pile': {
        const n = s.tokens[e.res];
        return (
          <div className={`city-pile city-pile--${e.res}`} aria-label={`${n} ${RESOURCES[e.res].plural}`}>
            {Array.from({ length: Math.min(n, 6) }, (_, i) => <span key={i} className="city-pile__chip" style={{ translate: `0 ${-i * 5}px` }}><ResourceGlyph r={e.res} size={34} /></span>)}
            <b className="city-pile__count">{n}</b>
            <small className="city-pile__name">{RESOURCES[e.res].plural}{n >= storage(s) ? ' · full' : ''}</small>
          </div>);
      }
      case 'recipe': {
        const def = BUILDINGS[e.building];
        return (
          <div className="city-c city-c--recipe">
            <header>Recipe</header>
            <b className="city-c__title">{def.name}</b>
            <small>{def.text}</small>
            <span className="city-c__cost">{(Object.entries(def.cost) as [ResourceId, number][]).map(([r, n]) => <span key={r} className={s.tokens[r] >= n ? '' : 'is-short'}><ResourceGlyph r={r} size={18} />{n}</span>)}</span>
          </div>);
      }
      case 'building': {
        const def = BUILDINGS[e.building];
        return (
          <div className="city-c city-c--building">
            <header>{def.name}</header>
            <span className="city-c__roof" aria-hidden="true" />
            <small>{def.text}</small>
          </div>);
      }
    }
  };

  return (
    <div className="city">
      <div ref={viewport} className="city-viewport" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        style={{ backgroundPosition: `${-cam.x * cam.z}px ${-cam.y * cam.z}px`, backgroundSize: `${420 * cam.z}px ${420 * cam.z}px` }}>
        <div className="city-world" style={{ transform: `scale(${cam.z}) translate(${-cam.x}px, ${-cam.y}px)` }}>
          {entities.map(e => {
            const drag = dragging?.id === e.id ? dragging.at : null, p = drag ?? table[e.id];
            if (!p) return null;
            return (
              <div key={e.id} data-entity={e.id} className={`city-entity${drag ? ' is-dragging' : ''}${hover === e.id ? ' is-hover' : ''}`}
                style={{ transform: `translate(${p.x}px, ${p.y}px)`, zIndex: drag ? 100000 : (z[e.id] ?? (e.kind === 'kin' ? 5 : 1)), width: sizeOf(e).w, height: sizeOf(e).h }}>
                {renderCard(e)}
              </div>
            );
          })}
        </div>
      </div>

      <div className="city-hud city-hud--left">
        <span className="city-chip"><b>Day {s.day}</b></span>
        <span className={`city-chip${stored < need ? ' is-short' : ''}`}>Food {stored}/{need}</span>
      </div>
      <div className="city-hud city-hud--right">
        <LayoutSwitch layout={s.layout} onChange={layout => setCity({ ...cityRef.current, layout })} />
        <button type="button" className="city-btn" onClick={() => fit()} aria-label="Fit the whole table to the screen">Fit</button>
        <button type="button" className="city-btn city-btn--quiet" onClick={() => setSession({ kind: 'reset' })}>Reset</button>
      </div>

      {note && <div className="city-note" role="status">{note}</div>}

      {gatherSession && gatherCard && gatherKin && (
        <GatherTable
          key={gatherSession.seed}
          kin={gatherSession.kin} card={gatherCard} stamina={gatherKin.stamina} maxStamina={maxStamina(s, gatherKin)}
          layout={s.layout} seed={gatherSession.seed}
          full={s.tokens[CARD_KINDS[gatherCard.kind].resource] >= storage(s)}
          onLayout={layout => setCity({ ...cityRef.current, layout })}
          onFoundation={() => { const n = spendStamina(cityRef.current, gatherSession.kin, 1); if (!n) return false; setCity(n); return true; }}
          onReceipt={streak => {
            const cur = cityRef.current, res = CARD_KINDS[gatherCard.kind].resource;
            let { state, gained } = gather(cur, gatherSession.cardId, receiptYield(streak, gatherSession.kin, res));
            if (res === 'reed' && streak >= 6 && !state.recipes.includes('wheel')) {
              state = learn(state, 'wheel');
              const sp = state.table?.[`source:${gatherSession.cardId}`];
              if (sp) state = { ...state, table: { ...state.table, 'recipe:wheel': { x: sp.x + 150, y: sp.y + 60 } } };
              flash('Recipe card: Water Wheel!');
            }
            // A new pile drops out beside the card it came from.
            if (!cur.tokens[res] && gained) {
              const sp = state.table?.[`source:${gatherSession.cardId}`];
              if (sp) state = { ...state, table: { ...state.table, [`pile:${res}`]: { x: sp.x + 14, y: sp.y + CARD_H + 30 } } };
            }
            setCity(state);
            return gained;
          }}
          onClose={() => setSession(null)}
        />
      )}

      {session?.kind === 'battle' && (
        <BattleTable initial={session.battle} title={ENCOUNTERS[ZONES[session.zone].encounter!].name} onFinish={b => finishBattle(session.zone, b)} />
      )}

      {session?.kind === 'reset' && (
        <div className="city-overlay" role="dialog" aria-label="Reset the city">
          <div className="city-modal">
            <h2>Start over?</h2>
            <p>This clears the saved city, kin, tokens and recipes and deals a fresh Day 1.</p>
            <div className="city-modal__actions">
              <button type="button" className="city-btn" onClick={() => setSession(null)}>Keep playing</button>
              <button type="button" className="city-btn city-btn--danger" onClick={() => { fitted.current = false; setParty({}); setCity(createCity(seedNow())); setSession(null); }}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const clampZoom = (z: number) => Math.min(2.2, Math.max(0.15, z));
const splitId = (id: string) => { const i = id.indexOf(':'); return i < 0 ? [id, ''] : [id.slice(0, i), id.slice(i + 1)]; };
const costText = (cost: Partial<Record<ResourceId, number>>) => (Object.entries(cost) as [ResourceId, number][]).map(([r, n]) => `${n} ${RESOURCES[r].plural.toLowerCase()}`).join(' and ');

export function startCityGame() {
  document.title = 'City · Exploritaire';
  const font = document.createElement('link');
  font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=Alegreya+SC:wght@500;700&family=Alegreya+Sans:wght@400;500;700&family=Alegreya:wght@700&display=swap';
  document.head.append(font);
  // The table owns pinch and pan, so stop the browser zooming the page.
  let meta = document.querySelector<HTMLMetaElement>('meta[name=viewport]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.append(meta); }
  meta.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  document.documentElement.dataset.bookBoot = 'ready';
  const root = document.createElement('div');
  root.id = 'city-root';
  document.body.replaceChildren(root);
  document.body.style.margin = '0';
  document.body.style.overscrollBehavior = 'none';
  createRoot(root).render(<StrictMode><CityGame /></StrictMode>);
}
