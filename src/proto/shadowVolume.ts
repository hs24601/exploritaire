import * as THREE from 'three';
import type { DirectionalSpriteInstance } from './directionalSpriteRig';

/** True world-space surfaces: the cloud and face never billboard toward the eye. */
export function createShadowVolume(rig: DirectionalSpriteInstance, height: number) {
  const body = rig.parts[0];
  const geometry = new THREE.SphereGeometry(1, 40, 28);
  const cloudGeometry = new THREE.SphereGeometry(1, 16, 12);
  const clock = { value: 0 };
  const decorate = (material: THREE.MeshBasicMaterial, cloud: boolean) => {
    const inherited = material.onBeforeCompile, key = material.customProgramCacheKey();
    material.customProgramCacheKey = () => key + ':shadow-volume-v1:' + cloud;
    material.side = THREE.FrontSide;
    material.onBeforeCompile = (shader, renderer) => {
      inherited.call(material, shader, renderer);
      shader.uniforms.shadowVolumeTime = clock;
      shader.vertexShader = `uniform float shadowVolumeTime; varying vec3 shadowPoint; varying vec3 shadowNormal; varying vec3 shadowView;
        ${shader.vertexShader}`.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float t=shadowVolumeTime;
        float wave=sin(position.x*5.+t*.7)*sin(position.y*4.-t*.6)*sin(position.z*5.+t*.4);
        transformed*=1.+wave*${cloud ? '.18' : '.045'};
        shadowPoint=position; shadowNormal=normalize(mat3(modelMatrix)*normal);
        shadowView=cameraPosition-(modelMatrix*vec4(transformed,1.)).xyz;
      `);
      shader.fragmentShader = `uniform float shadowVolumeTime; varying vec3 shadowPoint; varying vec3 shadowNormal; varying vec3 shadowView;
        float vHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float vNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(mix(vHash(i),vHash(i+vec3(1,0,0)),f.x),mix(vHash(i+vec3(0,1,0)),vHash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(vHash(i+vec3(0,0,1)),vHash(i+vec3(1,0,1)),f.x),mix(vHash(i+vec3(0,1,1)),vHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        ${shader.fragmentShader}`.replace('#include <map_fragment>', `
        vec3 p=shadowPoint, n=normalize(shadowNormal);
        vec3 weights=pow(abs(normalize(p)),vec3(3.)); weights/=weights.x+weights.y+weights.z;
        vec3 paint=texture2D(map,p.yz*.32+.5).rgb*weights.x+texture2D(map,p.xz*.32+.5).rgb*weights.y+texture2D(map,p.xy*.32+.5).rgb*weights.z;
        float wash=vNoise(p*5.);
        float light=max(0.,dot(n,normalize(vec3(-.6,.85,.5))));
        diffuseColor.rgb*=paint*(.40+light*.95);
        float edge=max(0.,dot(n,normalize(shadowView)));
        ${cloud ? `
          float ink=vNoise(p*5.+vec3(shadowVolumeTime*.14,0.,-shadowVolumeTime*.19));
          diffuseColor.a*=smoothstep(.24,.7,ink)*smoothstep(0.,.5,edge)*.48;
        ` : `
          diffuseColor.a*=smoothstep(0.,.16,edge)*.98;
          // Local spherical coordinates anchor the eyes on the physical front.
          // Back surfaces cannot repeat the face, and the globe occludes it.
          float front=smoothstep(.45,.75,p.z);
          float left=exp(-pow((p.x+.33)/.22,4.))*exp(-pow((p.y-.10+p.x*.20)/.055,2.));
          float right=exp(-pow((p.x-.33)/.20,4.))*exp(-pow((p.y-.10-p.x*.20)/.05,2.));
          float eyes=max(left,right)*front*(.70+wash*.3);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.27,.65,.70),eyes*.85);
        `}
      `);
    };
    material.needsUpdate = true;
  };
  // Clone before decorating so the existing environment/flash uniforms remain
  // shared with the actor while cloud coverage has its own shader program.
  const cloudMaterial = body.material.clone();
  cloudMaterial.onBeforeCompile = body.material.onBeforeCompile;
  cloudMaterial.customProgramCacheKey = body.material.customProgramCacheKey;
  decorate(body.material, false); decorate(cloudMaterial, true);
  const cloud = Array.from({ length: 18 }, (_, i) => {
    const mesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    body.pivot.add(mesh);
    const y = 1 - 2 * (i + .5) / 18, angle = i * 2.39996;
    return { mesh, direction: new THREE.Vector3(Math.cos(angle)*Math.sqrt(1-y*y),y,Math.sin(angle)*Math.sqrt(1-y*y)), phase:i*.618 };
  });
  return {
    update(seconds: number, reduced: boolean, heading: number) {
      clock.value = reduced ? 0 : seconds;
      // The shared rig owns combat root visibility/opacity; replace only its
      // view-dependent assembly after it updates, retaining normal cue hooks.
      rig.billboard.rotation.set(0,heading,0); rig.billboard.position.set(0,0,0);
      rig.facing.scale.set(1,1,1); rig.facing.position.set(0,0,0);
      body.pivot.position.set(0,height*.49,0); body.pivot.scale.set(1,1,1);
      body.mesh.geometry=geometry; body.mesh.position.set(0,0,0); body.mesh.scale.setScalar(height*.31);
      body.material.depthWrite=body.material.opacity>.98;
      cloudMaterial.opacity=body.material.opacity;
      cloud.forEach(({mesh,direction,phase},i)=>{
        const age=(clock.value/(4.5+i%3*.5)+phase)%1;
        const pulse=Math.sin(age*Math.PI);
        mesh.position.copy(direction).multiplyScalar(height*(.27+age*.09));
        mesh.scale.setScalar(height*(.07+pulse*.065));
        mesh.visible=pulse>.04;
      });
    },
    dispose(){cloud.forEach(({mesh})=>mesh.removeFromParent());cloudMaterial.dispose();geometry.dispose();cloudGeometry.dispose();},
  };
}
