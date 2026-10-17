import defaults from '../data/tableauLayouts.json';
export type LayoutCard = { id:string; group:string; order:number; x:number; y:number; rotation:number; layer:number; rank:number|'random' };
export type TableauLayout = { id:string; name:string; cards:LayoutCard[] };
export const LAYOUT_TARGETS = ['path','dirt','woods','water','berry-patch','berry-patch-sparse','hero-den'] as const;
export type LayoutDocument = { version:1; layouts:TableauLayout[]; assignments:Record<string,string> };
export function validateLayouts(value:unknown): asserts value is LayoutDocument {
  const d=value as LayoutDocument;
  if(!d||d.version!==1||!Array.isArray(d.layouts)||!d.assignments||typeof d.assignments!=='object'||Array.isArray(d.assignments))throw Error('Expected version 1 layouts and assignments');
  if(Object.keys(d).some(k=>!['version','layouts','assignments'].includes(k)))throw Error('Unexpected layout document fields');
  if(d.layouts.length>100)throw Error('Maximum 100 layouts');
  const ids=new Set<string>();
  for(const l of d.layouts){
    if(!l||typeof l.id!=='string'||!/^[-\w]{1,80}$/.test(l.id)||ids.has(l.id)||typeof l.name!=='string'||!l.name.trim()||l.name.length>120)throw Error('Layout IDs must be unique; names are required');
    if(Object.keys(l).some(k=>!['id','name','cards'].includes(k)))throw Error('Unexpected layout fields');
    ids.add(l.id);
    if(!Array.isArray(l.cards)||!l.cards.length||l.cards.length>28)throw Error('Each layout needs 1–28 cards');
    const cards=new Set<string>(),orders=new Set<string>();
    for(const c of l.cards){
      if(!c||typeof c.id!=='string'||!c.id||c.id.length>80||cards.has(c.id)||typeof c.group!=='string'||!c.group.trim()||c.group.length>80)throw Error('Card IDs must be unique and stack names required');
      if(Object.keys(c).some(k=>!['id','group','order','x','y','rotation','layer','rank'].includes(k)))throw Error('Unexpected card fields; session state cannot be authored');
      cards.add(c.id);
      if(!Number.isInteger(c.order)||c.order<0||c.order>27||orders.has(`${c.group}:${c.order}`))throw Error('Stack order must be unique within each stack (0–27)');
      orders.add(`${c.group}:${c.order}`);
      if(!Number.isFinite(c.x)||c.x<.2||c.x>9||!Number.isFinite(c.y)||c.y<.2||c.y>9||!Number.isFinite(c.rotation)||Math.abs(c.rotation)>45||!Number.isInteger(c.layer)||c.layer<0||c.layer>100)throw Error('Positions .2–9, rotation ±45°, layer 0–100 required');
      if(c.rank!=='random'&&(!Number.isInteger(c.rank)||c.rank<1||c.rank>13))throw Error('Rank must be A–K or random');
    }
  }
  for(const [target,id] of Object.entries(d.assignments))if(!(LAYOUT_TARGETS as readonly string[]).includes(target)||!ids.has(id))throw Error('Assignment references an unsupported terrain or missing layout');
}
export const authoredLayouts=defaults as LayoutDocument;
export const LAYOUT_PREVIEW_KEY='exploritaire.tableau-layouts.preview.v1';
export function activeLayouts():LayoutDocument {
  try { const raw=localStorage.getItem(LAYOUT_PREVIEW_KEY); if(raw){const d=JSON.parse(raw);validateLayouts(d);return d;} }catch{/* Invalid browser drafts never break gameplay. */}
  return authoredLayouts;
}
export function resolveLayout(kind:string,sparse=false):TableauLayout|undefined {
  const d=activeLayouts(); const id=d.assignments[sparse?'berry-patch-sparse':kind];return d.layouts.find(l=>l.id===id);
}
/** Stable per-deal random ranks; no solver guarantee is implied. */
export function dealLayout(l:TableauLayout,seed:number){
  let s=seed>>>0;
  const groups=new Map<string,(LayoutCard&{rank:number})[]>();
  for(const c of l.cards){s=(Math.imul(s,1664525)+1013904223)>>>0;const rank=c.rank==='random'?s%13+1:c.rank;const stack=groups.get(c.group)??[];stack.push({...c,rank});groups.set(c.group,stack);}
  return [...groups.values()].map(g=>g.sort((a,b)=>a.order-b.order));
}
export function layoutBounds(cards:readonly {pose?:{x:number;y:number}}[]){return {width:Math.max(1,...cards.map(c=>(c.pose?.x??0)+1.2)),height:Math.max(1.4,...cards.map(c=>(c.pose?.y??0)+1.6))};}
