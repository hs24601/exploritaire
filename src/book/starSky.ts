import * as THREE from 'three';
/** One static point buffer; no textures, animated noise or per-star objects. */
export function createStarSky(world:THREE.Scene){
 const geometry=new THREE.BufferGeometry(),positions=new Float32Array(640*3),sizes=new Float32Array(640),tints=new Float32Array(640*3);
 for(let i=0;i<640;i++){const y=-1+2*(i+.5)/640,a=i*2.39996323,r=Math.sqrt(1-y*y);positions.set([Math.cos(a)*r*65,y*65,Math.sin(a)*r*65],i*3);sizes[i]=i%17===0?2.2:1.1+(i%4)*.2;tints.set([.55+(i%5)*.07,.65+(i%4)*.06,.85],i*3);}
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('starSize',new THREE.BufferAttribute(sizes,1));geometry.setAttribute('color',new THREE.BufferAttribute(tints,3));
 const material=new THREE.ShaderMaterial({depthWrite:false,depthTest:true,transparent:true,vertexColors:true,uniforms:{visibility:{value:0},pixelRatio:{value:1}},vertexShader:`attribute float starSize;uniform float pixelRatio;varying vec3 tint;void main(){tint=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=starSize*pixelRatio;}`,fragmentShader:`uniform float visibility;varying vec3 tint;void main(){float a=1.-smoothstep(.15,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(tint,a*visibility*.7);
#include <tonemapping_fragment>
#include <colorspace_fragment>}`});
 const root=new THREE.Points(geometry,material);root.name='book-star-sky';root.frustumCulled=false;root.renderOrder=-10;world.add(root);
 return {root,update(camera:THREE.Camera,enabled:boolean,open:number,ratio:number){root.visible=enabled;root.position.copy(camera.position);material.uniforms.visibility.value=THREE.MathUtils.smoothstep(open,.1,.85);material.uniforms.pixelRatio.value=Math.min(1.75,ratio);},dispose(){root.removeFromParent();geometry.dispose();material.dispose();}};
}
