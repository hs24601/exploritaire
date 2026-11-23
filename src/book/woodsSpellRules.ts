/** Temporary Woods spell-design slice. No legacy encounter or receipt chip hits. */
export type WoodsEntity='lustro'|'flurry'|'hero';
export type WoodsSpell='meteo'|'bite'|'ice-armor'|'rime-retort'|'whiteout'|'glacial-lance'|'shatterstrike'|'snow-golem'|'star';
export type SpellActor='hero'|'khadroot';
export const WOODS_ENTITIES=[
 {id:'lustro',name:'Lustro',abilities:['meteo'],description:'Meteo'},
 {id:'flurry',name:'Flurry',abilities:['ice-armor','rime-retort','whiteout','glacial-lance','shatterstrike','snow-golem'],description:'Six ice abilities'},
 {id:'hero',name:'Hero',abilities:['bite'],description:'Bite'},
] as const;
export const entityDefinition=(id:WoodsEntity)=>WOODS_ENTITIES.find(e=>e.id===id)!;
export const WOODS_SPELLS=[
 {id:'meteo',entity:'lustro',name:'Meteo',base:1,kind:'hostile',effect:'Fire damage. +1 per receipt.',symbol:'✦',result:'damage'},
 {id:'bite',entity:'hero',name:'Bite',base:2,kind:'hostile',effect:'Physical damage. A focused bite.',symbol:'⌁',result:'damage'},
 {id:'ice-armor',entity:'flurry',name:'Ice Armor',base:2,kind:'support',effect:'Shield Hero with ice armor.',symbol:'◇',result:'armor'},
 {id:'rime-retort',entity:'flurry',name:'Rime Retort',base:1,kind:'support',effect:'Prepare a freezing retort for Hero.',symbol:'❄',result:'retort'},
 {id:'whiteout',entity:'flurry',name:'Whiteout',base:1,kind:'hostile',effect:'Frost damage. Slows the target.',symbol:'❄',result:'damage'},
 {id:'glacial-lance',entity:'flurry',name:'Glacial Lance',base:4,kind:'hostile',effect:'Pierce the target with frost.',symbol:'❅',result:'damage'},
 {id:'shatterstrike',entity:'flurry',name:'Shatterstrike',base:3,kind:'hostile',effect:'Shatter the target with ice damage.',symbol:'✧',result:'damage'},
 {id:'snow-golem',entity:'flurry',name:'Snow Golem',base:5,kind:'support',effect:'Summon a Snow Golem for Hero.',symbol:'☃',result:'summon'},
 // Legacy support helper remains available to saved dev callers, outside all hands.
 {id:'star',entity:'hero',name:'Star',base:2,kind:'support',effect:'Restore Hero’s health.',symbol:'✧',result:'heal'},
] as const;
export const entityForSpell=(id:WoodsSpell)=>spellDefinition(id).entity;
export const isIceSpell=(id:WoodsSpell)=>entityForSpell(id)==='flurry';
export const spellDefinition=(id:WoodsSpell)=>WOODS_SPELLS.find(s=>s.id===id)!;
export const spellCanTarget=(id:WoodsSpell,actor:SpellActor)=>spellDefinition(id).kind==='support'?actor==='hero':actor==='khadroot';
export const spellPower=(id:WoodsSpell,receipts:number)=>spellDefinition(id).base+Math.max(0,Math.floor(receipts));
export const MIN_SPELL_RECEIPTS=0;
export const spellReady=(receipts:number)=>receipts>=MIN_SPELL_RECEIPTS;
export const spellLevel=(receipts:number)=>receipts<4?Math.max(0,Math.floor(receipts)):4+Math.floor((receipts-4)/4);
// Four authored cornerstones, ordered like Eric's annotated Fireball: leading
// tip, far tail, upper shoulder, lower bowl. Later points enrich this base.
export const FIREBALL_NODES = [
 [.055,.79],[.964,.065],[.35,.253],[.29,.94],
 [.18,.68],[.73,.28],[.49,.27],[.54,.65],[.38,.55],
 [.14,.85],[.65,.36],[.43,.76],[.27,.43],[.78,.18],
 [.46,.43],[.31,.78],[.59,.47],[.22,.6],[.68,.24],[.4,.66],
] as const;
export const LUSTRO_NODES=[
 [.50,.91],[.55,.09],[.18,.53],[.83,.56],
 [.33,.72],[.69,.72],[.44,.49],[.63,.34],[.35,.36],
 [.24,.66],[.76,.64],[.50,.66],[.45,.28],[.59,.22],
 [.38,.56],[.58,.77],[.70,.48],[.29,.48],[.55,.42],[.48,.80]
] as const;
export const SPELL_NODES:Record<WoodsSpell,readonly (readonly [number,number])[]>={
 meteo:FIREBALL_NODES,
 star:[[.5,.06],[.5,.94],[.06,.5],[.94,.5],[.35,.35],[.65,.65],[.65,.35],[.35,.65],[.5,.5]],
 whiteout:[[.5,.06],[.5,.94],[.1,.3],[.9,.7],[.1,.7],[.9,.3],[.5,.5],[.35,.2],[.65,.8],[.35,.8],[.65,.2]],
 bite:[[.14,.25],[.86,.25],[.5,.48],[.5,.92],[.28,.36],[.72,.36],[.26,.76],[.74,.76],[.4,.37],[.6,.37]],
 'ice-armor':[[.15,.2],[.85,.2],[.18,.72],[.82,.72],[.5,.92],[.5,.48]],
 'rime-retort':[[.2,.25],[.8,.75],[.8,.25],[.2,.75],[.5,.5]],
 'glacial-lance':[[.5,.92],[.5,.08],[.25,.4],[.75,.4],[.5,.6]],
 shatterstrike:[[.5,.1],[.5,.9],[.1,.5],[.9,.5],[.3,.3],[.7,.7]],
 'snow-golem':[[.5,.2],[.5,.85],[.15,.55],[.85,.55],[.35,.45],[.65,.45]],
};
const MAX_CONSTELLATION_STARS=64;
export type SpellConstellationStar={x:number;y:number;cornerstone:boolean;parents:number[]};
/** A prefix-complete graph: each enrichment closes a local triangle against
 * already established stars. No future point is needed to finish its edges. */
export function spellConstellation(id:WoodsSpell,receipts:number){
 const count=Math.min(MAX_CONSTELLATION_STARS,Math.max(0,Math.floor(receipts))),authored=SPELL_NODES[id];
 const stars:SpellConstellationStar[]=[];
 const pairs=[[0,3],[1,2],[0,2],[1,3],[0,1],[2,3]];
 for(let i=0;i<count;i++){
  const parents=i===0?[]:i===1?[0]:i<4?[0,1]:pairs[(i-4)%pairs.length];
  let point=authored[i];
  if(!point){
   // Bounded deterministic interior clusters, never another perimeter walk.
   const a=authored[parents[0]],b=authored[parents[1]],c=authored[[0,1,2,3].find(index=>!parents.includes(index))!];
   const u=.2+((i*.61803398875)%1)*.45,v=.16+((i*.41421356237)%1)*.24;
   point=[a[0]*u+b[0]*v+c[0]*(1-u-v),a[1]*u+b[1]*v+c[1]*(1-u-v)];
  }
  stars.push({x:point[0],y:point[1],cornerstone:i<4,parents:[...parents]});
 }
 const edges:(readonly [number,number])[]=[],known=new Set<string>();
 const edge=(a:number,b:number)=>{const from=Math.min(a,b),to=Math.max(a,b),key=`${from}:${to}`;if(!known.has(key)){known.add(key);edges.push([from,to]);}};
 stars.forEach((star,to)=>{if(star.parents.length===2)edge(star.parents[0],star.parents[1]);star.parents.forEach(from=>edge(from,to));});
 return {stars,edges,cornerstones:Math.min(4,count),ready:spellReady(receipts),level:spellLevel(receipts),overflow:Math.max(0,receipts-MAX_CONSTELLATION_STARS)};
}
export const activeSpellNodes=(receipts:number,_id:WoodsSpell='meteo')=>Math.min(MAX_CONSTELLATION_STARS,Math.max(0,Math.floor(receipts)));
export function resolveWoodsSpell(id:WoodsSpell,receipts:number,hp:{hero:number;khadroot:number}){
 if(!spellReady(receipts))return null;
 const power=spellPower(id,receipts),def=spellDefinition(id),heal=def.result==='heal',damage=def.result==='damage';
 return {power,hp:{hero:heal?Math.min(32,hp.hero+power):hp.hero,khadroot:damage?Math.max(0,hp.khadroot-power):hp.khadroot},slowed:id==='whiteout'||id==='glacial-lance',effect:def.result,armor:def.result==='armor'?power:0,retort:def.result==='retort'?power:0,summon:def.result==='summon'?power:0};
}
