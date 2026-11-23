import * as THREE from 'three';
import {readableFlatPlane} from '../rendering/flatPlaneFacing';
export type PacketLights={positions:THREE.Vector3[];power:{value:number[]}};
export const PACKET_WIDTH=1.8,PACKET_HEIGHT=PACKET_WIDTH*88/63;
const geometry=new THREE.PlaneGeometry(PACKET_WIDTH,PACKET_HEIGHT);

/** Three wrappers share one geometry/material. The existing six lanterns supply
 * their positions and live flicker powers: no new lights, captures or shadows. */
export function plankPacketMaterial(map:THREE.Texture,lights:PacketLights){
  const material=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{packetLamps:{value:lights.positions},packetLampPower:lights.power});
    shader.vertexShader='varying vec3 packetWorld,packetNormal;varying vec2 packetUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npacketWorld=(modelMatrix*vec4(position,1.)).xyz;packetNormal=normalize(mat3(modelMatrix)*normal);packetUv=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 packetWorld,packetNormal;varying vec2 packetUv;
      uniform vec3 packetLamps[6];uniform float packetLampPower[6];`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec3 pn=normalize(packetNormal)*(gl_FrontFacing?1.:-1.);
      vec3 pv=normalize(cameraPosition-packetWorld);
      float diffuse=0.,metal=0.;
      for(int i=0;i<6;i++){
        vec3 delta=packetLamps[i]-packetWorld;float d=length(delta);
        vec3 ld=delta/max(d,.001);float reach=max(0.,1.-d/18.);
        float power=reach*reach*packetLampPower[i];
        diffuse+=power*(.2+.8*max(0.,dot(pn,ld)));
        metal+=power*pow(max(0.,dot(pn,normalize(ld+pv))),38.);
      }
      float angle=dot(pn,pv),grain=sin((packetUv.x+packetUv.y*.65)*92.);
      vec3 film=.5+.5*cos(vec3(0.,2.1,4.2)+angle*15.+packetUv.x*9.+packetUv.y*5.);
      float rim=1.-smoothstep(.025,.08,min(min(packetUv.x,1.-packetUv.x),min(packetUv.y,1.-packetUv.y)));
      // Keep lettering readable under the film; metallic edges catch the lamps.
      float ink=smoothstep(.10,.4,dot(outgoingLight,vec3(.2126,.7152,.0722)));
      outgoingLight=outgoingLight*(.65+diffuse*.4)+film*(.035+metal*.22+rim*.12)*ink;
      outgoingLight+=vec3(1.,.72,.34)*metal*(.25+rim*.65)*(1.+grain*.06);
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'wood-plank-packet-foil-v1';return material;
}
export function plankPacket(material:THREE.MeshBasicMaterial){
  const mesh=readableFlatPlane(new THREE.Mesh(geometry,material));mesh.castShadow=false;mesh.receiveShadow=false;return mesh;
}
