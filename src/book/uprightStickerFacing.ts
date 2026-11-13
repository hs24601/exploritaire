import {FLAT_PLANE_MAX_ANGLE} from '../rendering/flatPlaneFacing';
/** Yaw-only readability keeps the card exactly vertical and preserves its back.
 * Correct the nearer side, rather than turning every back view into a front face. */
export function uprightStickerYaw(authoredYaw:number,viewYaw:number){
 const wrap=(n:number)=>Math.atan2(Math.sin(n),Math.cos(n));
 const relative=wrap(authoredYaw-viewYaw),back=Math.cos(relative)<0?Math.PI:0;
 const offset=wrap(authoredYaw+back-viewYaw),limited=Math.max(-FLAT_PLANE_MAX_ANGLE,Math.min(FLAT_PLANE_MAX_ANGLE,offset));
 return authoredYaw+limited-offset;
}
