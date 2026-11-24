import {CASTLE, FLIGHT, FLIGHT_SECONDS, SHOULDER, SURFACE, clearsCastleMasonry, resolveMove, shoulderPose, type FlightKey} from './castleLayout';

export type GroundPoint = readonly [x: number, z: number];
type Polygon = readonly GroundPoint[];
const [a,b,c,d,e,f,g,h,i,j] = [
  [-61,-35], [-45,-61], [42,-61], [64,-38], [67,19],
  [57,42], [35,57], [-37,57], [-61,36], [-68,3],
] as const;
const inletWest = [-108,-56] as const, inletEast = [-88,-85] as const;
const outletWest: Polygon = [[58,85], [71,130]];
const outletEast: Polygon = [[91,70], [117,104]];
export const WEST_RIM: Polygon = [...outletWest.slice(1), [-70,130], [-111,90], [-121,25], [-118,-26], inletWest];
export const EAST_RIM: Polygon = [outletEast[1], [130,49], [121,-60], [96,-98], [-45,-105], inletEast];

export const GROUNDS_MOAT: Polygon = [a,b,c,d,e,f,g,h,i,j];
export const GROUNDS_ISLAND: Polygon = [
  [-41,-30], [-30,-43], [30,-43], [42,-30], [43,28], [30,43], [-30,43], [-43,28],
];
export const GROUNDS_WEST: Polygon = [a,j,i,h,g,outletWest[0],...WEST_RIM];
export const GROUNDS_EAST: Polygon = [b,...EAST_RIM.slice().reverse(),outletEast[0],f,e,d,c];
export const GROUNDS_INLET: Polygon = [inletWest,a,b,inletEast];
export const GROUNDS_OUTLET: Polygon = [g,f,...outletEast,[118,137],[65,137],...outletWest.slice().reverse()];
export const GROUNDS_LAND = [GROUNDS_ISLAND,GROUNDS_WEST,GROUNDS_EAST] as const;

export const GROUNDS_PATHS = [
  [[-43,121],[-30,100],[-35,83],[-22,70],[0,63],[17,63],[30,63]],
  [[30,63],[0,63],[-37,65],[-58,49],[-72,30],[-78,9],[-74,-19],[-81,-40]],
  [[64,38],[74,23],[75,0],[73,-28],[61,-52],[42,-68],[11,-71],[-28,-71],[-61,-75]],
  [[-22,70],[2,77],[22,86],[42,95]],
] as const satisfies readonly Polygon[];

export const GROUNDS_START = {x: 0, z: 59.45};
export const GROUNDS_SHOULDER = {distance:8.5,pitch:.16};
export const GROUNDS_WELL: GroundPoint = [43,98];
export const GROUNDS_WATER_LEVEL = -1.6;
export const GROUNDS_BRIDGES = [
  {from: [0,35], to: [0,60], half: CASTLE.bridgeHalf},
  {from: [29,65], to: [67,36], half: 3.6},
] as const;

export function bridgeFootprint({from,to,half}: typeof GROUNDS_BRIDGES[number]): Polygon {
  const dx = to[0]-from[0], dz = to[1]-from[1], k = half / Math.hypot(dx,dz);
  const x = -dz*k, z = dx*k;
  return [[from[0]+x,from[1]+z],[to[0]+x,to[1]+z],[to[0]-x,to[1]-z],[from[0]-x,from[1]-z]];
}

const bridgeDecks = GROUNDS_BRIDGES.map(bridgeFootprint);

export const GROUNDS_RISE_START = 70;
const approachGrade = .10;
export const groundsMeadowHeight = (z: number) => Math.max(0, z - GROUNDS_RISE_START) * approachGrade;
export const groundsMeadowPitch = (z: number) => z > GROUNDS_RISE_START ? -Math.atan(approachGrade) : 0;

/** A full-radius inset from every shoreline. Decks overlap dry land at their
 * ends so they provide a continuous corridor even with the same inset. */
function contains(poly: Polygon, x: number, z: number, radius = 0) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax,az] = poly[j], [bx,bz] = poly[i];
    const dx = bx-ax, dz = bz-az;
    if (radius > 0) {
      const t = Math.max(0, Math.min(1, ((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
      if ((x-ax-t*dx)**2+(z-az-t*dz)**2 < radius**2) return false;
    }
    if ((az > z) !== (bz > z) && x < ax + (z-az)*dx/dz) inside = !inside;
  }
  return inside;
}

export function groundsWalkable(x: number, z: number, radius: number = CASTLE.heroRadius) {
  return (bridgeDecks.some(deck => contains(deck,x,z,radius)) || GROUNDS_LAND.some(land => contains(land,x,z,radius)))
    && clearsCastleMasonry(x,z,radius)
    && Math.hypot(x-GROUNDS_WELL[0],z-GROUNDS_WELL[1]) >= 1.65+radius;
}

export function groundsHeight(x: number, z: number) {
  if (bridgeDecks.some(deck => contains(deck,x,z))) return SURFACE.bridge;
  return Math.abs(x) <= CASTLE.court && Math.abs(z) <= CASTLE.court
    || Math.abs(x) <= CASTLE.gateHalf && z <= 35 && z > CASTLE.court ? SURFACE.paving : groundsMeadowHeight(z);
}

const drawbridgeRest = shoulderPose(GROUNDS_START.x,GROUNDS_START.z,0,GROUNDS_SHOULDER.pitch,
  GROUNDS_SHOULDER.distance,groundsHeight(GROUNDS_START.x,GROUNDS_START.z));
export const GROUNDS_FLIGHT: readonly FlightKey[] = [
  ...FLIGHT.slice(0,3),
  {t:7.2,position:[9,6.7,83],target:[0,6,26],fov:46},
  {t:8.6,position:[2.8,4.2,73.5],target:[0,4.9,38],fov:50},
  {t:FLIGHT_SECONDS,...drawbridgeRest,fov:SHOULDER.fov},
];

export function resolveGroundsMove(x: number, z: number, dx: number, dz: number) {
  // Sweep at less than half Hero's radius so a fast step cannot hop a channel.
  const steps = Math.max(1,Math.ceil(Math.hypot(dx,dz)/(CASTLE.heroRadius*.5)));
  for (let step = 0; step < steps; step++) {
    ({x,z} = resolveMove(x,z,dx/steps,dz/steps,groundsWalkable));
  }
  return {x,z};
}
