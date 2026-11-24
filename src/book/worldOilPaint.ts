import * as THREE from 'three';
import {seeded} from './castlePaint';
import {MIXED_PALETTE_GLSL} from './worldMixedPaint';
import {createBrushSheet} from './vendor/patch-oil-paint/brush.js';
import {STUDIO_HEIGHT_GLSL} from './worldStudioField';
import type {WorldStudioDocument} from './worldStudioDocument';

type Surface={mesh:THREE.Mesh;palette:number;budget:number};
type Pin={position:THREE.Vector3;normal:THREE.Vector3;direction:THREE.Vector3;palette:number;seed:number;width:number;height:number};

/** Patch's world-pinned, directional dab method, adapted to the existing
 * renderer, transparent water, watercolor palettes and altitude/distance fog.
 * Area-weighted barycentric pins are baked once; no camera-dependent sampling. */
export function sampleSurfacePins(surfaces:Surface[],seed:number,accept?:(p:THREE.Vector3,palette:number)=>boolean){
 const random=seeded(seed),pins:Pin[]=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 for(const {mesh,palette,budget}of surfaces){
  mesh.updateWorldMatrix(true,false);const geometry=mesh.geometry,pos=geometry.attributes.position,index=geometry.index,triangles=(index?.count??pos.count)/3;
  const vertex=(t:number,k:number)=>index?index.getX(t*3+k):t*3+k;
  const sums=new Float64Array(triangles);let total=0;
  for(let t=0;t<triangles;t++){a.fromBufferAttribute(pos,vertex(t,0));b.fromBufferAttribute(pos,vertex(t,1));c.fromBufferAttribute(pos,vertex(t,2));total+=b.sub(a).cross(c.sub(a)).length();sums[t]=total;}
  const instance=new THREE.Matrix4(),matrix=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3();
  for(let made=0,tries=0;made<budget&&tries<budget*12;tries++){
   const wanted=random()*total;let lo=0,hi=triangles-1;while(lo<hi){const mid=(lo+hi)>>1;if(sums[mid]<wanted)lo=mid+1;else hi=mid;}
   const t=lo;a.fromBufferAttribute(pos,vertex(t,0));b.fromBufferAttribute(pos,vertex(t,1));c.fromBufferAttribute(pos,vertex(t,2));
   const u=Math.sqrt(random()),v=random(),point=a.clone().multiplyScalar(1-u).addScaledVector(b,u*(1-v)).addScaledVector(c,u*v),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
   matrix.copy(mesh.matrixWorld);if(mesh instanceof THREE.InstancedMesh){mesh.getMatrixAt(Math.floor(random()*mesh.count),instance);if(Math.hypot(instance.elements[0],instance.elements[1],instance.elements[2])<.001)continue;matrix.multiply(instance);}
   point.applyMatrix4(matrix);normal.applyMatrix3(normalMatrix.getNormalMatrix(matrix)).normalize();
   if(accept&&!accept(point,palette))continue;
   const direction=new THREE.Vector3(palette===0?1:0,palette===0?0:1,palette===0?.3:0).addScaledVector(normal,-normal.dot(new THREE.Vector3(palette===0?1:0,palette===0?0:1,palette===0?.3:0))).normalize();
   if(direction.lengthSq()<.1)direction.set(1,0,0).cross(normal).normalize();
   const width=(palette===2?2.2:palette===0?.6:.55)*( .7+random()*.8),height=width*(palette===1?2.8:palette===2?1.3:1.8);
   pins.push({position:point,normal,direction,palette,seed:random()*10000,width,height});made++;
  }
 }
 for(let i=pins.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pins[i],pins[j]]=[pins[j],pins[i]];}
 return pins;
}

export function createWorldOilPaint(parent:THREE.Group,surfaces:Surface[],field:{heightMap:THREE.Texture;texture:THREE.Texture;terrainSize:number},accept:(p:THREE.Vector3,palette:number)=>boolean){
 const atlas=createBrushSheet(),uniforms={...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),brush:{value:atlas},uTerrain:{value:field.heightMap},uTerrainSize:{value:field.terrainSize},uField:{value:field.texture},strokeSize:{value:1.25},relief:{value:.16},variation:{value:.16},paletteShift:{value:0},pixelScale:{value:1/800},soilMoss:{value:.62},soilWet:{value:.25},mixedCoverage:{value:0},mixedRealLighting:{value:0},darkSoilPatch:{value:new THREE.Vector4()}};
 const material=new THREE.ShaderMaterial({fog:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms,
  vertexShader:`
   #include <fog_pars_vertex>
   attribute vec3 pinPosition,pinNormal,pinDirection;attribute vec4 pinStyle;
   uniform mat4 cameraMatrixWorld;uniform float strokeSize,pixelScale;varying vec2 q;varying vec3 world,N;varying vec4 style;
   ${STUDIO_HEIGHT_GLSL}
   void main(){
    style=pinStyle;N=pinNormal;q=uv;vec3 center=pinPosition+N*.045;
    vec4 view=viewMatrix*vec4(center,1.);float pixels=max(.0001,-view.z*pixelScale);
    vec2 dimensions=max(pinStyle.yz*strokeSize,vec2(1.8,2.8)*pixels);
    if(pinStyle.w>1.5&&pinStyle.w<2.5){
     vec3 d=mat3(viewMatrix)*pinDirection;vec2 along=normalize(d.xy+vec2(.001,0.)),across=vec2(along.y,-along.x);
     view.xy+=across*position.x*dimensions.x+along*position.y*dimensions.y;
     world=(cameraMatrixWorld*view).xyz;
    }else{
     vec3 along=normalize(pinDirection),across=normalize(cross(N,along));
     world=center+along*position.y*dimensions.y+across*position.x*dimensions.x;
     if(pinStyle.w<.5)world.y=groundHeightAt(world.xz)+.055;
     view=viewMatrix*vec4(world,1.);
    }
    vec4 mvPosition=view;gl_Position=projectionMatrix*view;
    #include <fog_vertex>
   }`,
  fragmentShader:`
   #include <fog_pars_fragment>
   varying vec2 q;varying vec3 world,N;varying vec4 style;uniform sampler2D brush,uField;
   uniform float relief,variation,paletteShift,soilMoss,soilWet;
   ${MIXED_PALETTE_GLSL}
   void main(){
    float cell=floor(mod(style.x,8.));vec2 atlas=(vec2(mod(cell,4.),floor(cell/4.))+q)/vec2(4.,2.);
    vec3 ink=texture2D(brush,atlas).rgb;float alpha=smoothstep(.04,.52,ink.g);if(alpha<.015)discard;
    vec3 sunDirection=paletteShift>2.5?vec3(-.44,.5,-.75):vec3(-.4,.7,.5);
    float sun=clamp(dot(normalize(N),normalize(sunDirection))*.55+.4,0.,1.);
    vec3 paint=mixedPaintColor(style.w,paletteShift,sun,variation,style.x);
    paint=mixedSoilTint(paint,world,texture2D(uField,world.xz/220.+.5).rg,style.w,paletteShift,soilMoss,soilWet);
    vec2 texel=vec2(1./512.,0.);float ridge=texture2D(brush,atlas+texel).r-texture2D(brush,atlas-texel).r;
    paint*=1.+ridge*relief*2.;paint*=.94+ink.b*.12;
    gl_FragColor=vec4(paint,alpha*.9);
    #include <fog_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 material.uniforms.cameraMatrixWorld={value:new THREE.Matrix4()};
 const mesh=new THREE.Mesh(new THREE.InstancedBufferGeometry(),material);mesh.name='world-pinned-paint-marks';mesh.frustumCulled=false;mesh.renderOrder=1;parent.add(mesh);
 let currentSeed=-1,count=0,budgetScale=1;
 function rebuild(seed:number){
  const pins=sampleSurfacePins(surfaces,seed,accept),n=pins.length,pos=new Float32Array(n*3),normal=new Float32Array(n*3),direction=new Float32Array(n*3),style=new Float32Array(n*4);
  pins.forEach((p,i)=>{p.position.toArray(pos,i*3);p.normal.toArray(normal,i*3);p.direction.toArray(direction,i*3);style.set([p.seed,p.width,p.height,p.palette],i*4);});
  const plane=new THREE.PlaneGeometry(1,1),g=new THREE.InstancedBufferGeometry();g.setIndex(plane.index);g.setAttribute('position',plane.attributes.position);g.setAttribute('uv',plane.attributes.uv);g.setAttribute('pinPosition',new THREE.InstancedBufferAttribute(pos,3));g.setAttribute('pinNormal',new THREE.InstancedBufferAttribute(normal,3));g.setAttribute('pinDirection',new THREE.InstancedBufferAttribute(direction,3));g.setAttribute('pinStyle',new THREE.InstancedBufferAttribute(style,4));g.instanceCount=n;mesh.geometry.dispose();mesh.geometry=g;count=n;currentSeed=seed;
 }
 return {mesh,surfaceUniforms:uniforms,setBudgetScale(scale:number){budgetScale=scale;},apply(doc:WorldStudioDocument){if(currentSeed!==doc.paint.seed)rebuild(doc.paint.seed);uniforms.mixedCoverage.value=doc.paint.enabled?doc.paint.coverage:0;mesh.visible=doc.paint.enabled;mesh.geometry.instanceCount=Math.floor(count*doc.paint.coverage*budgetScale);uniforms.strokeSize.value=doc.paint.size;uniforms.relief.value=doc.paint.relief;uniforms.variation.value=doc.paint.variation;uniforms.paletteShift.value=['grove','ochre','moonlit','autumn-wood','darker-autumn'].indexOf(doc.paint.palette);uniforms.soilMoss.value=doc.ground.moss;uniforms.soilWet.value=doc.ground.wetness;},update(camera:THREE.PerspectiveCamera,height:number){uniforms.pixelScale.value=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/height;(material.uniforms.cameraMatrixWorld.value as THREE.Matrix4).copy(camera.matrixWorld);},get count(){return count;},rebuild(){currentSeed=-1;},dispose(){mesh.removeFromParent();mesh.geometry.dispose();material.dispose();atlas.dispose();}};
}
