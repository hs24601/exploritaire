import * as THREE from 'three';
import {seeded} from './castlePaint';

/** Shared meadow crossing / reward sparkle style. Positions are seeded once;
 * only age changes on the GPU, with no per-frame particle buffer uploads. */
export function createMeadowPortalParticles(age:{value:number},direction:{value:number},count:number){
  const geometry=new THREE.BufferGeometry(),random=seeded(743);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(Array.from({length:count},()=>[random(),random(),random()]).flat(),3));
  const points=new THREE.Points(geometry,new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{age,direction},
    vertexShader:/* glsl */`
      uniform float age,direction;varying vec3 tint;varying float alpha;
      void main(){
        float t=max(0.,age-position.z*.29),a=position.x*6.2831853;
        vec2 jet=vec2(cos(a),sin(a));
        vec3 p=vec3(jet*(.17+position.y*.46+t*(.42+position.z)),.15+t*(.6+position.y*1.5));
        p.y+=1.12+t*.34;p.z+=direction<0.?t*.22:0.;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        tint=mix(vec3(.30,.88,1.),vec3(1.,.53,.89),position.z);
        alpha=exp(-t*2.4)*smoothstep(0.,.10,t)*step(position.z*.29,age);
        gl_PointSize=clamp((15.+position.y*20.)/max(1.,-mv.z),1.5,14.);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:/* glsl */`
      varying vec3 tint;varying float alpha;
      void main(){vec2 p=abs(gl_PointCoord-.5);float core=exp(-30.*dot(p,p));
        float rays=exp(-42.*min(p.x,p.y))*max(0.,1.-2.*max(p.x,p.y));
        gl_FragColor=vec4(tint,alpha*(core+rays*.44));
      }`,
  }));
  points.frustumCulled=false;points.visible=false;return points;
}
