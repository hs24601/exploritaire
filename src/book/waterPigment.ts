/** Shared river/falls paint: broad blue-green washes, pooled boundaries and
 * restrained world-anchored tooth, rather than a filter over the scene. */
export const WATER_PIGMENT_GLSL = /* glsl */`
vec3 waterPigment(float wash,float shore,float warp,float paper){
  float middle=smoothstep(.32,.62,wash);
  float pale=smoothstep(.62,.81,wash);
  vec3 pigment=mix(vec3(.035,.105,.14),vec3(.10,.24,.25),middle);
  pigment=mix(pigment,vec3(.27,.37,.35),pale*.50);
  float edgeWash=1.-smoothstep(.3,3.6,shore+warp*.7);
  pigment=mix(pigment,vec3(.29,.40,.36),edgeWash*.30);
  float pool=middle*(1.-middle)*.28+exp(-shore*1.7)*.12;
  return pigment*(1.-pool)*(1.+paper*.09);
}
`;
