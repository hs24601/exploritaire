/** One document-space paint front drives pigment, sparkles, camera aims and
 * atmosphere. Units match the unfolded book, including its extension leaves. */
export const FOREST_PAINT_START=8.3;
export const FOREST_PAINT_END=17;
export const FOREST_PAINT_EDGE=.018;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(a:number,b:number,v:number)=>{const u=clamp((v-a)/(b-a));return u*u*(3-2*u);};
export function forestPaintProgress(t:number,end=FOREST_PAINT_END){return clamp((t-FOREST_PAINT_START)/(end-FOREST_PAINT_START));}
export function forestPaintWave(x:number){return .55*Math.sin(x*.65)+.18*Math.sin(x*2.1);}
export function forestPaintOrder(x:number,y:number,z:number){return clamp((3.8-z+forestPaintWave(x)+y*.28)/11.8+.02);}
export function forestPaintFront(progress:number,x:number,y=0){return 3.8+forestPaintWave(x)+y*.28-11.8*(progress-.02);}
export function forestPaintAmount(progress:number,x:number,y:number,z:number){
 if(progress<=0)return 0;if(progress>=1)return 1;
 const order=forestPaintOrder(x,y,z);return smooth(order-FOREST_PAINT_EDGE,order+FOREST_PAINT_EDGE,progress);
}
/** Delay atmospheric light beyond the fully painted edge, never ahead of it. */
export function forestPaintBehind(progress:number,x:number,y:number,z:number){
 if(progress<=0)return 0;if(progress>=1)return 1;
 const order=forestPaintOrder(x,y,z);return smooth(order+.028,order+.085,progress);
}
export const forestPaintGLSL=/* glsl */`
#ifndef FOREST_PAINT_FIELD
#define FOREST_PAINT_FIELD
uniform float forestPaintProgress;
float forestPaintOrder(vec3 p){return clamp((3.8-p.z+.55*sin(p.x*.65)+.18*sin(p.x*2.1)+p.y*.28)/11.8+.02,0.,1.);}
float forestPaintAmount(vec3 p){
 if(forestPaintProgress<=0.)return 0.;if(forestPaintProgress>=1.)return 1.;
 float order=forestPaintOrder(p);return smoothstep(order-.018,order+.018,forestPaintProgress);
}
float forestPaintBehind(vec3 p){
 if(forestPaintProgress<=0.)return 0.;if(forestPaintProgress>=1.)return 1.;
 float order=forestPaintOrder(p);return smoothstep(order+.028,order+.085,forestPaintProgress);
}
#endif
`;
