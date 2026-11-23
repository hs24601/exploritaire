import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {applyWatercolor} from './castleWatercolor';

/** World-space lamps: two gate sconces, two drawbridge posts, two courtyard
 * sconces. Facing confines wall lights to their own side of the masonry. */
export const GROUNDS_LANTERNS = [
  {position:[-7.6,4.2,38.9], facing:[0,0,1], post:false},
  {position:[7.6,4.2,38.9], facing:[0,0,1], post:false},
  {position:[-4.4,2.8,59], facing:[0,0,0], post:true},
  {position:[4.4,2.8,59], facing:[0,0,0], post:true},
  {position:[-31,4.2,12], facing:[1,0,0], post:false},
  {position:[31,4.2,12], facing:[-1,0,0], post:false},
] as const;

export function createCastleLanterns(reduced: boolean,postHalfWidth=4.4) {
  const time = {value:0};
  const positions = GROUNDS_LANTERNS.map(l => new THREE.Vector3(l.post?Math.sign(l.position[0])*postHalfWidth:l.position[0],l.position[1],l.position[2]));
  const facing = GROUNDS_LANTERNS.map(l => new THREE.Vector3(...l.facing));
  const power = {value: GROUNDS_LANTERNS.map(() => 1)};
  let still = reduced;
  let fogDecorator:((material:THREE.MeshLambertMaterial)=>THREE.MeshLambertMaterial)|undefined;
  const group = new THREE.Group(); group.name = 'grounds-candle-lanterns';

  function shade(material: THREE.MeshLambertMaterial) {
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      Object.assign(shader.uniforms, {uLanternPosition:{value:positions}, uLanternFacing:{value:facing}, uLanternPower:power, uLanternTime:time});
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uLanternPosition[6], uLanternFacing[6];
          uniform float uLanternPower[6], uLanternTime;`)
        .replace('#include <opaque_fragment>', `
          vec3 candleGlow = vec3(0.);
          for (int lamp = 0; lamp < 6; lamp++) {
            vec3 delta = uLanternPosition[lamp] - vWcPos;
            float d = length(delta);
            float reach = max(0., 1. - d / 18.);
            float side = smoothstep(-1.4, -.1, dot(-delta, uLanternFacing[lamp]));
            vec3 lightDirection = normalize((viewMatrix * vec4(delta, 0.)).xyz);
            float diffuse = .18 + .82 * max(0., dot(normal, lightDirection));
            candleGlow += vec3(1., .40, .095) * reach * reach * side * diffuse * uLanternPower[lamp] * 1.8;
          }
          // Local illumination follows the watercolor shading, which deliberately
          // quantizes the key light. No extra PointLight loops or shadow maps.
          outgoingLight += diffuseColor.rgb * candleGlow;
          #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => 'castle-lantern-fog-v1';
    return fogDecorator ? fogDecorator(material) : material;
  }

  function build(glow: THREE.Texture) {
    const parts: THREE.BufferGeometry[] = [];
    const box = (w:number,h:number,d:number,x=0,y=0,z=0) => new THREE.BoxGeometry(w,h,d).translate(x,y,z);
    parts.push(box(.86,.12,.86,0,-.65),box(.86,.1,.86,0,.65));
    for (const x of [-.37,.37]) for (const z of [-.37,.37]) parts.push(box(.07,1.3,.07,x,0,z));
    parts.push(new THREE.ConeGeometry(.67,.48,4).rotateY(Math.PI/4).translate(0,.94,0));
    parts.push(new THREE.TorusGeometry(.16,.035,4,12).translate(0,1.32,0));
    const frameGeo = mergeGeometries(parts.map(g=>g.toNonIndexed()))!;
    for (const part of parts) part.dispose();
    const frame = new THREE.InstancedMesh(frameGeo, shade(applyWatercolor(new THREE.MeshLambertMaterial({color:'#554834',emissive:'#1c1005'}))), positions.length);
    const candle = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.15,.42,8), new THREE.MeshBasicMaterial({color:'#ffe4b4'}), positions.length);
    const supports: THREE.BufferGeometry[] = [];
    const matrix = new THREE.Matrix4();
    GROUNDS_LANTERNS.forEach((lamp,i) => {
      const {x,y,z} = positions[i];
      frame.setMatrixAt(i,matrix.makeTranslation(x,y,z));
      candle.setMatrixAt(i,matrix.makeTranslation(x,y-.37,z));
      if (lamp.post) supports.push(new THREE.CylinderGeometry(.1,.15,y-.65,8).translate(x,(y-.65)/2,z));
      else {
        const [nx,,nz] = lamp.facing;
        supports.push(box(.14,.9,.14,x-nx*.55,y+.8,z-nz*.55));
        supports.push(box(nx ? .8 : .12,.12,nz ? .8 : .12,x-nx*.3,y+1.25,z-nz*.3));
      }
    });
    frame.instanceMatrix.needsUpdate = candle.instanceMatrix.needsUpdate = true;
    const support = new THREE.Mesh(mergeGeometries(supports.map(g=>g.toNonIndexed()))!, frame.material);
    for (const part of supports) part.dispose();
    group.add(frame,candle,support);
    const approaches=positions.map(p=>({x:p.x,z:p.z,radius:.5,label:'lantern'}));
    for(const mesh of [frame,candle,support])mesh.userData.pointApproachInstances=approaches;

    const billboardVertex = `
      varying vec2 vUv; varying float vSeed;
      void main(){vUv=uv;vSeed=instanceMatrix[3].x*.7+instanceMatrix[3].z*.3;
        vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
        gl_Position=projectionMatrix*(center+vec4(position.xy,0.,0.));}`;
    const flames = new THREE.InstancedMesh(new THREE.PlaneGeometry(.48,.85), new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, uniforms:{time}, vertexShader:billboardVertex,
      fragmentShader:`uniform float time;varying vec2 vUv;varying float vSeed;
        void main(){
          float y=vUv.y;
          float sway=sin(time*3.7+vSeed+y*4.)*.045*y;
          float x=abs(vUv.x-.5-sway);
          float width=.30*pow(max(0.,1.-y),.7)*smoothstep(0.,.16,y);
          float alpha=(1.-smoothstep(width*.58,width+.025,x))*smoothstep(0.,.1,y)*(1.-smoothstep(.86,1.,y));
          vec3 color=mix(vec3(1.,.28,.025),vec3(1.,.88,.48),(1.-y)*(1.-smoothstep(0.,max(.001,width),x)));
          gl_FragColor=vec4(color,alpha);
          #include <colorspace_fragment>
        }`,
    }), positions.length);
    const halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(5,5), new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      uniforms:{glow:{value:glow}},vertexShader:billboardVertex,
      fragmentShader:`uniform sampler2D glow;varying vec2 vUv;void main(){
        float a=texture2D(glow,vUv).a*.28;
        gl_FragColor=vec4(vec3(1.,.40,.10),a);}`,
    }), positions.length);
    positions.forEach((p,i)=>{
      flames.setMatrixAt(i,matrix.makeTranslation(p.x,p.y+.05,p.z));
      halos.setMatrixAt(i,matrix.makeTranslation(p.x,p.y+.2,p.z));
    });
    flames.instanceMatrix.needsUpdate = halos.instanceMatrix.needsUpdate = true;
    flames.frustumCulled = halos.frustumCulled = false;
    flames.renderOrder = 4; halos.renderOrder = 2;
    group.add(flames,halos);
    group.traverse(object=>{object.castShadow=false;object.receiveShadow=false;});
    return group;
  }

  return {
    shade, build,
    lights:{positions,power},
    setFogDecorator(decorate:(material:THREE.MeshLambertMaterial)=>THREE.MeshLambertMaterial){fogDecorator=decorate;},
    update(seconds:number) {
      time.value = still ? 0 : seconds;
      for (let i=0;i<positions.length;i++) power.value[i] = still ? 1 : 1 + .035*Math.sin(seconds*3.7+i*2.3)+.02*Math.sin(seconds*6.1+i);
    },
    setLow() { still=true; time.value=0; power.value.fill(1); },
    sample(x:number,y:number,z:number) {
      let light=0;
      for (let i=0;i<positions.length;i++) {
        const p=positions[i], f=facing[i], dx=x-p.x, dy=y-p.y, dz=z-p.z;
        const reach=Math.max(0,1-Math.hypot(dx,dy,dz)/18);
        const side=THREE.MathUtils.smoothstep(dx*f.x+dz*f.z,-1.4,-.1);
        light+=reach*reach*side*power.value[i];
      }
      return Math.min(.78,light*.8);
    },
    get diagnostics() { return {count:positions.length,draws:group.children.length,animated:!still,power:[...power.value]}; },
  };
}
