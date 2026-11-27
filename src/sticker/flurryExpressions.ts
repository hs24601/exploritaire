import {flurryFaceCell,type FlurryFaceId} from './flurryIdle';
export {createFlurryFaceRig,FLURRY_FACE_IDS,flurryFaceIndex,flurryFaceCell,type FlurryFaceId,type FlurryFacePose} from './flurryIdle';
export const FLURRY_FACE_ATLAS={url:`${import.meta.env.BASE_URL}assets/runtime/ui/stickers/snowflake-expressions-v2/faces.png`,columns:4,rows:5,tile:384};
export function flurryFaceUV(id:FlurryFaceId){const {column,row}=flurryFaceCell(id);return {x:column/4,y:1-(row+1)/5};}
