import * as THREE from 'three';

export const WATER_SPRITE_COUNT = 28;

// Curtain lighting and particles use the same world-space light positions.
export const WATER_SPRITE_GLSL = `
uniform float time;
vec3 waterSprite(float id) {
  float phase = id * 2.39996;
  float y = 2. + id * ${31/(WATER_SPRITE_COUNT-1)} + sin(time * .42 + phase) * 2.;
  float x = -72. + sin(phase) * 8. + sin(time * .55 + phase) * 4.;
  float z = y < 12. ? mix(-64., -75., (y + 1.5) / 13.5) : mix(-75., -84., (y - 12.) / 36.);
  return vec3(x, y, z + 2.5 + sin(time * .63 + phase));
}
float waterSpritePulse(float id) {
  return .76 + .24 * sin(time * 1.6 + id * 2.39996);
}
`;

export function createGroveLights(
  positions: Float32Array, colors: Float32Array, sizes: Float32Array,
  time: {value: number}, kind: 'fruit' | 'pollen' | 'water',
) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('lightSize', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {...(kind==='water'?THREE.UniformsUtils.clone(THREE.UniformsLib.fog):{}),time},fog:kind==='water', vertexColors: true, transparent: true, depthWrite: false,
    toneMapped: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      ${kind==='water'?'#include <fog_pars_vertex>':''}
      ${WATER_SPRITE_GLSL}
      attribute float lightSize;
      varying vec3 tint;
      varying float power;
      void main() {
        vec3 p = position;
        float phase = dot(p, vec3(.47,.25,.33));
        float pulse = 1.;
        ${kind === 'water' ? 'p = waterSprite(lightSize); pulse = waterSpritePulse(lightSize);' : ''}
        ${kind === 'pollen' ? 'p += vec3(sin(time*.31+phase),cos(time*.41+phase),cos(time*.26+phase))*1.8; pulse = .55+.45*sin(time*1.1+phase);' : ''}
        vec4 view = modelViewMatrix * vec4(p, 1.);
        ${kind==='water'?'vec4 mvPosition=view;\n#include <fog_vertex>':''}
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp(${kind === 'water' ? '6300.' : 'lightSize'} * projectionMatrix[1][1] / max(1., -view.z), 2., 112.);
        tint = color;
        power = pulse * exp(-length(view.xyz) * .004);
        ${kind === 'water' ? 'power *= 1. - .992 * smoothstep(30.,38.4,p.y);' : ''}
      }
    `,
    fragmentShader: `
      ${kind==='water'?'#include <fog_pars_fragment>':''}
      varying vec3 tint;
      varying float power;
      void main() {
        vec2 p = (gl_PointCoord - .5) * 2.;
        ${kind!=='fruit'?`p.x+=sin(p.y*4.2)*.10;p.x*=3.2;`:''}
        float r = dot(p,p);
        float halo = exp(-r * 5.5) * (1. - smoothstep(.6,1.,r));
        float core = exp(-r * ${kind === 'water' ? '160.' : '46.'});
        gl_FragColor = vec4(mix(tint, vec3(1.,1.,.83), core * .55),
          power * (halo * ${kind === 'fruit' ? '.45' : '.33'} + core * .83));
        ${kind==='water'?`
          #ifdef USE_FOG
            #ifdef FOG_EXP2
              gl_FragColor.a*=exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
            #else
              gl_FragColor.a*=1.-smoothstep(fogNear,fogFar,vFogDepth);
            #endif
          #endif
        `:''}
      }
    `,
  });
  const lights = new THREE.Points(geometry, material);
  // Animated positions can extend beyond the static vertex buffer.
  if (kind !== 'fruit') lights.frustumCulled = false;
  return lights;
}

/** Broken spectral contours float just beyond each fruit's silhouette, then
 * peel outward/upward. Static source buffers; all motion happens on the GPU. */
export function createFruitSpectra(centers:Float32Array,colors:Float32Array,radii:Float32Array,time:{value:number},low=false){
  const perFruit=low?32:72,count=radii.length*perFruit;
  const positions=new Float32Array(count*3),tints=new Float32Array(count*3),seeds=new Float32Array(count*3);
  for(let fruit=0;fruit<radii.length;fruit++)for(let k=0;k<perFruit;k++){
    const i=fruit*perFruit+k;
    positions.set(centers.subarray(fruit*3,fruit*3+3),i*3);tints.set(colors.subarray(fruit*3,fruit*3+3),i*3);
    seeds.set([radii[fruit],k/perFruit,((k*0.61803398875+fruit*.137)%1)],i*3);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(tints,3));geometry.setAttribute('spectralSeed',new THREE.BufferAttribute(seeds,3));
  const material=new THREE.ShaderMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,uniforms:{time},
    vertexShader:`attribute vec3 spectralSeed;uniform float time;varying vec3 tint;varying float opacity;
      void main(){
        float age=fract(spectralSeed.z+time*.12);
        float angle=spectralSeed.y*6.283185+sin(spectralSeed.z*19.+time*.23)*.12;
        vec4 view=modelViewMatrix*vec4(position,1.);
        float radius=spectralSeed.x*(1.025+age*age*.9);
        view.xy+=vec2(cos(angle),sin(angle))*radius;
        view.y+=age*age*spectralSeed.x*1.7;
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp((14.+spectralSeed.z*25.)*projectionMatrix[1][1]/max(1.,-view.z),1.,10.);
        vec3 spectral=.58+.42*cos(vec3(0.,2.1,4.2)+spectralSeed.y*6.283185+spectralSeed.z*3.);
        tint=mix(color,spectral,.72);
        opacity=pow(1.-age,1.6)*(.35+.65*pow(.5+.5*sin(spectralSeed.y*53.+time*1.1),2.))*exp(-length(view.xyz)*.003);
      }`,
    fragmentShader:`varying vec3 tint;varying float opacity;void main(){
      vec2 p=(gl_PointCoord-.5)*2.;float r=dot(p,p);
      float ink=exp(-r*7.)*(1.-smoothstep(.55,1.,r));
      gl_FragColor=vec4(mix(tint,vec3(1.),exp(-r*45.)*.6),ink*opacity);
    }`});
  const points=new THREE.Points(geometry,material);points.name='fruit-spectral-edge-particles';points.frustumCulled=false;
  return points;
}
