
type Point=readonly [number,number];
export type SceneryInteriorProfile={canvas:readonly [number,number];opening:readonly Point[];actor:readonly [number,number,number,number]};

/** Opening coordinates belong to the source painting, before trim or mirroring.
 * Closed side/rear views have no opening; never reveal occupants through stone. */
const openings:Record<string,SceneryInteriorProfile>={
  'hero-den-sprite-v2.png':{canvas:[1609,977],opening:[[482,806],[474,685],[530,552],[625,460],[751,414],[882,440],[960,496],[1006,579],[1050,675],[1080,801],[1014,844],[534,846]],actor:[570,546,465,292]},
  'hero-den-front-quarter-v1.png':{canvas:[1609,977],opening:[[393,749],[414,637],[470,532],[566,466],[683,467],[778,523],[822,615],[861,766],[824,809],[732,840],[451,792]],actor:[424,539,408,288]},
};
export function sceneryInterior(src:string|undefined){const name=src?.split('/').pop()?.split('?')[0];return name?openings[name]:undefined;}

