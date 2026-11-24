/** Isolated presentation trial. These spreads do not read or write campaign saves. */
export type PaperProp = { id?:string; art: string; x: number; z: number; height: number; yaw?: number; action?: boolean; kirigami?: boolean };
export type StoryPlacement = { x: number; z: number; width: number; depth: number };
export type BookScene = { emptyBase?:boolean; id: string; name: string; ink: string; glow: number; action: string; result: string; story: [string, string]; storyPlacement?: [StoryPlacement, StoryPlacement]; symbol: string; props: PaperProp[] };
const env = 'environment/watercolor/v1/';
export const HERO_ART = 'characters/hero/rig/watercolor/v4/hero-directions-high-body-v4.png';
// Elevated front view, matching the shared directional rig registration.
export const HERO_BOOK_FRAME = {x:44,y:43,width:194,height:228} as const;
export const DEN_INTERIOR_INDEX = 3;
export const BOOK_SCENES: BookScene[] = [
  { emptyBase:true, id: 'den', name: 'The home tree', ink: '#768a61', glow: 0xffbc63, action: 'Wake the seed', result: 'The atlas stirs.', symbol: '⌂', story: ['Morning pooled beneath the oldest tree. Hero stirred in her little shelter, where the earth still held the warmth of home.', 'Beyond the doorway, a seed shone among the leaves. The forest waited in silence, as though it had a secret to tell.'], props: [
    { id:'home-den', art: env+'hero-den-front-quarter-v1.png', x: 3.9, z: -1.9, height: 2.2 },
    { id:'home-pine-west', art: env+'pine-relief-v1.png', x: -4.5, z: -1.8, height: 3.5, yaw: .12 },
    { id:'home-pine-middle', art: env+'pine-relief-v1.png', x: 0, z: -.6, height: 3.7, yaw: 0 },
    ...([["home-tree-01",-4.8,-2.9,2.8],["home-tree-02",-3.5,-2.45,4.1],["home-tree-03",-2,-2.9,3.2],["home-tree-04",-0.6,-2.7,4.4],["home-tree-05",1.1,-2.8,3.6],["home-tree-06",2.5,-2.9,2.7],["home-tree-07",-4.6,0.15,3],["home-tree-08",-3.2,-0.3,2.2],["home-tree-09",-1.8,0.3,3.5],["home-tree-10",1.1,0.15,2.4],["home-tree-11",4.75,0.25,3.4],["home-tree-12",3.6,1.25,2]] as const).map(([id,x,z,height])=>({id,art:env+'pine-relief-v1.png',x,z,height,yaw:0})),
    { id:'home-kirigami-pine', art: env+'pine-relief-v1.png', x: -1.25, z: -1.35, height: 3.2, kirigami: true },
    { id:'home-sapling', art: env+'curious-sapling-sprite-v1.png', x: 2.8, z: .1, height: 2.1 },
    { id:'home-seed', art: 'aldan/aldan-seed-watercolor-v1.png', x: 2.0, z: 1.3, height: .9, action: true },
  ] },
  { id: 'berries', name: 'The lantern wood', storyPlacement: [{x:-3.1,z:2.55,width:4.4,depth:1.15},{x:3.2,z:-2.6,width:4.1,depth:1.1}], ink: '#59877b', glow: 0x8fdcf4, action: 'Gather a manaberry', result: 'One manaberry gathered.', symbol: '❧', story: ['The trees parted around a hidden clearing. Fallen needles softened every step, and the scent of rain lingered beneath the boughs.', 'Manaberries ripened in their own pale light. Between the leaves, their glow marked a little island of plenty in the deep woods.'], props: [
    ...([['berry-tree-01',-4.3],['berry-tree-02',-2.6],['berry-tree-03',1.7],['berry-tree-04',4.2]] as const).map(([id,x],i) => ({ id, art: env+'pine-relief-v1.png', x, z: -1.7-(i%2)*.6, height: 2.9+(i%2)*.8 })),
    { id:'berry-main', art: env+'berry-patch-sprite-v2.png', x: 2.8, z: .8, height: 1.9, action: true },
    { id:'berry-side', art: env+'berry-patch-sprite-v1.png', x: -3.1, z: 1, height: 1.4 },
  ] },
  { id: 'frost', name: 'The frost refuge', ink: '#839aa5', glow: 0xa7e8ff, action: 'Kindle the refuge', result: 'A light in the cold.', symbol: '❄', story: ['Higher in the hills, winter had forgotten to leave. Frost silvered the stones, and the wind passed softly through the blue shadows.', 'An owl waited beneath the ridge, white as the last snow. Even here, there was a place where a small light could take hold.'], props: [
    { id:'frost-ridge-west', art: env+'mountain-ridge-sprite-v1.png', x: -3.1, z: -1.8, height: 3.3 },
    { id:'frost-ridge-east', art: env+'mountain-ridge-sprite-v1.png', x: 3, z: -2, height: 3.7 },
    { id:'frost-pine', art: env+'pine-relief-v1.png', x: -4.5, z: .4, height: 2.5 },
    { id:'frost-owl', art: 'keru/whiteout/v1/owl.png', x: 2.6, z: .5, height: 1.8, action: true },
  ] },
  { id: 'den-interior', name: 'Inside the den', ink: '#897965', glow: 0xffc57a, action: 'Warm the den', result: 'A little warmth fills the den.', symbol: '⌂', storyPlacement: [{ x: -3.45, z: 2.65, width: 4.2, depth: 1.15 }, { x: 3.45, z: 2.65, width: 4.2, depth: 1.15 }], story: ['Inside, the stone held the warmth of a thousand quiet mornings. A soft nest waited in the shelter of the earth.', 'Here, among moss and smooth stones, Hero could rest until the forest called her out again.'], props: [
    { id:'den-stones', art: env+'stone-spill-v1.png', x: -2.7, z: .7, height: 1.1 },
    { id:'den-seed', art: 'aldan/aldan-seed-watercolor-v1.png', x: 2.2, z: .7, height: .75, action: true },
  ] }
];

// Page 03 is the slower Hero edition of the same authored woodland.
BOOK_SCENES[2]={...BOOK_SCENES[1],id:'hero-woodland',name:"Hero’s woodland moments",story:['',''],action:'',result:'',props:BOOK_SCENES[1].props.map(p=>({...p,id:'hero-baseline-'+p.id}))};

// Page 04 repeats the woodland with Mochi and her connected tree-perch piece.
BOOK_SCENES[3]={...BOOK_SCENES[1],id:'mochi-woodland',name:'Mochi’s woodland moments',symbol:'♧',story:['',''],action:'',result:'',props:BOOK_SCENES[1].props.map(p=>({...p,id:'mochi-baseline-'+p.id}))};

// Page 05 replaces the cartography spread with an orbitable paper grove.
BOOK_SCENES[4]={...BOOK_SCENES[1],id:'radial-grove',name:'The turning grove',symbol:'✧',story:['',''],action:'',result:'',props:BOOK_SCENES[1].props.map(p=>({...p,id:'radial-baseline-'+p.id}))};
