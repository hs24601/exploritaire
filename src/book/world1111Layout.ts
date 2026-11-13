/** Arrival orbit from Eric's supplied telemetry (2026-11-11).
 * Flurry's floating center is projected from the subsequent screenshot's
 * crosshairs through that camera, with the existing 2.5 m hover height. */
export const WORLD_1111_LAYOUT={
 hero:{x:4,z:74},portal:{x:8,z:71,yaw:.4},
 paintedValleyPortal:{x:15,z:68,yaw:.4},
 woodsPortal:{x:-.0963792005082889,z:75.95259342773834,yaw:Math.PI-.755},
 flurry:{x:10.146631245978893,z:78.06862133399913},
 camera:{yaw:1.026,pitch:.426,distance:12.5},
} as const;

export function canCollectFlurry(hero:{x:number;z:number},point:{x:number;z:number}){return Math.hypot(hero.x-point.x,hero.z-point.z)<=6;}
