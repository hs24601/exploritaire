export const LUSTRO_FACE_IDS=['confident','happy','determined','surprised','content','sad','wink','blink-half','blink-closed'] as const;
export type LustroFaceId=typeof LUSTRO_FACE_IDS[number];
export const LUSTRO_ART=`${import.meta.env.BASE_URL}assets/runtime/ui/stickers/lustro-v1/`;
export function lustroFacePosition(id:LustroFaceId){const i=LUSTRO_FACE_IDS.indexOf(id);return `${i%3*50}% ${Math.floor(i/3)*50}%`;}
/** Discrete signed lateral exposures. Vertical input and time never select faces. */
export function lustroLenticularFace(x:number,enabled=true):LustroFaceId{return !enabled?'confident':x<-.6?'determined':x<-.25?'wink':x>.6?'surprised':x>.25?'happy':'confident';}
