import * as THREE from 'three';
import {seeded} from './castlePaint';
import type {TreeLimb,TreeIvyPath} from './worldTreeIvy';
// WebGL adaptation of GeometryPainterThreeJS / mohamedachrefelouafi and Patch
// geometry-painter 0596b4bc (MIT). Notices: vendor/patch-geometry-painter/.
// Preserve the reference's doubled curtains, traveling folds/rays and colony
// pulse, without replacing this game's renderer or installing its BVH hooks.
export function createWorldTreeGeometryPaint(parent:THREE.Group,limbs:TreeLimb[],low=false,ivyPaths:TreeIvyPath[]=[]){
 let budgetLow=low;
 const root=new THREE.Group();root.name='Yggdrasil Aurora Silk and Glowing Reef';parent.add(root);
 const random=seeded(111109),clock={value:0},materials:THREE.Material[]=[],positions:number[]=[],ups:number[]=[],sides:number[]=[],styles:number[]=[],indices:number[]=[],motes:number[]=[];
 const segments=low?28:44,rows=15,selected=[1,3,5,7,9,11,13,16,19,22].filter(index=>index<limbs.length);
 const aligned=ivyPaths.filter(p=>p.vine===0||(p.limb===0&&p.vine<4)).slice(0,32);
 const routes=aligned.length?aligned.map(path=>({limbIndex:path.limb,path})):selected.map(limbIndex=>({limbIndex,path:undefined as TreeIvyPath|undefined}));
 for(const {limbIndex,path} of routes){const limb=limbs[limbIndex],frames=limb.curve.computeFrenetFrames(segments,false),points:THREE.Vector3[]=[],normals:THREE.Vector3[]=[],side:THREE.Vector3[]=[],distances:number[]=[];let length=0;
  for(let i=0;i<=segments;i++){const t=.16+i/segments*.79,tangent=limb.curve.getTangentAt(t).normalize(),normal=new THREE.Vector3(0,1,0).addScaledVector(tangent,-tangent.y);if(normal.lengthSq()<.01)normal.copy(frames.normals[i]);normal.normalize();const p=limb.curve.getPointAt(t).addScaledVector(normal,limb.radius*(1-.7*t)+.12);if(path){const slot=Math.min(path.points.length-1,Math.round(i/segments*(path.points.length-1)));p.copy(path.points[slot]);normal.copy(path.normals[slot]);p.addScaledVector(normal,.04);}
   if(i)length+=p.distanceTo(points[i-1]);points.push(p);normals.push(normal);side.push(new THREE.Vector3().crossVectors(tangent,normal).normalize());distances.push(length);}
  for(let layer=0;layer<2;layer++){const base=positions.length/3;
   for(let i=0;i<=segments;i++)for(let row=0;row<rows;row++){points[i].toArray(positions,positions.length);normals[i].toArray(ups,ups.length);side[i].toArray(sides,sides.length);styles.push(distances[i],row/(rows-1),layer,Math.min(distances[i],length-distances[i]));}
   for(let i=0;i<segments;i++)for(let row=0;row<rows-1;row++){const a=base+i*rows+row,b=a+rows;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  for(let i=0;i<(low?12:22);i++){const index=Math.floor(random()*points.length),p=points[index].clone().addScaledVector(normals[index],random()*1.8).addScaledVector(side[index],(random()-.5)*.7);motes.push(p.x,p.y,p.z);}
 }
 const curtainGeometry=new THREE.BufferGeometry();curtainGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));curtainGeometry.setAttribute('silkUp',new THREE.Float32BufferAttribute(ups,3));curtainGeometry.setAttribute('silkSide',new THREE.Float32BufferAttribute(sides,3));curtainGeometry.setAttribute('silkStyle',new THREE.Float32BufferAttribute(styles,4));curtainGeometry.setIndex(indices);
 const silkMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{time:clock},
  vertexShader:`attribute vec3 silkUp,silkSide;attribute vec4 silkStyle;uniform float time;varying vec4 ribbon;varying float silkDim;varying vec3 effectWorld;
   void main(){float d=silkStyle.x,v=silkStyle.y,phase=silkStyle.z*2.4,stature=mix(1.,.72,silkStyle.z);float breath=.8+.2*sin(time*.23+phase);
    float foldPhase=d*6.3+time*1.1+phase;float sway=sin(foldPhase)+sin(d*11.7-time*.7+v*1.8+phase)*.5;float ripple=sin(d*23.+time*1.9+v*4.+phase)*.02*v;
    vec3 p=position+silkUp*(1.05*v*stature+ripple*.4)+silkSide*(.55*.17*pow(v,1.35)*breath*sway+ripple);
    silkDim=mix(1.,.55,silkStyle.z);effectWorld=(modelMatrix*vec4(p,1.)).xyz;ribbon=vec4(d,v,foldPhase,silkStyle.w);gl_Position=projectionMatrix*viewMatrix*vec4(effectWorld,1.);
   }`,
  fragmentShader:`uniform float time;varying vec4 ribbon;varying float silkDim;varying vec3 effectWorld;
   void main(){float d=ribbon.x,v=ribbon.y;float folds=pow(abs(cos(ribbon.z)),1.6)*.85+.4;
    float rayWave=sin(d*36.+sin(time*.45)*1.6+v*2.2)*.5+.5;float rays=mix(1.,pow(rayWave,2.4)*1.7+.25,.7);float hem=1.+(1.-smoothstep(0.,.22,v))*1.3;
    vec3 color=mix(vec3(.046,1.,.392),vec3(.037,.584,1.),smoothstep(.03,.45,v));color=mix(color,vec3(.445,.147,1.),smoothstep(.45,.95,v));
    float travel=pow(.5+.5*sin(d*2.2-time*2.1),6.);float alpha=pow(1.-v,1.15)*smoothstep(0.,.22,ribbon.w)*(.88+sin(d*17.+v*9.+time*.8)*.12)*(.28+travel*.45);
    gl_FragColor=vec4(color*folds*rays*hem*(.55+travel*3.8)*silkDim,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 silkMaterial.userData.basinMistWorld='effectWorld';materials.push(silkMaterial);const silk=new THREE.Mesh(curtainGeometry,silkMaterial);silk.name='aurora-silk-double-curtains';silk.frustumCulled=false;root.add(silk);
 function reefMaterial(kind:number){const material=new THREE.ShaderMaterial({transparent:kind===3,depthWrite:kind!==3,side:THREE.DoubleSide,uniforms:{time:clock,kind:{value:kind}},
   vertexShader:`attribute float reefSeed;uniform float time,kind;varying vec3 effectWorld;varying vec2 q;varying float localHeight,phase;
    void main(){vec3 p=position;localHeight=clamp(position.y,0.,1.);phase=reefSeed;q=uv;float w=pow(localHeight,2.);
     if(kind>1.5)p+=vec3(sin(time*.9+phase),0.,sin(time*.7+phase*1.6))*w*.5*.35;
     effectWorld=(modelMatrix*instanceMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(effectWorld,1.);
    }`,
   fragmentShader:`uniform float time,kind;varying vec3 effectWorld;varying vec2 q;varying float localHeight,phase;
    void main(){float pulse=pow(sin(dot(effectWorld,vec3(1.6,1.1,1.35))*2.6-time*2.1)*.5+.5,2.5);float blink=.85+.15*sin(time*.8+phase);vec3 glow=mix(vec3(.18,.9,.84),vec3(.31,.54,1.),sin(phase)*.5+.5);
     vec3 color=vec3(.055,.025,.095);float alpha=1.;
     if(kind>.5&&kind<1.5)color=glow*(pulse*2.6+.2)*blink*1.2;
     if(kind>1.5)color+=glow*pow(localHeight,2.5)*(pulse*1.6+.25)*1.2;
     if(kind>2.5){vec2 p=vec2((q.x-.5)*2.,q.y);float edge=abs(p.x);float vein=abs(p.x);
      for(int i=1;i<=4;i++){float branch=abs(abs(p.x)-(p.y-.08)*float(i)*.24);vein=min(vein,branch);}
      float lattice=1.-smoothstep(.012,.032,vein);float silhouette=(1.-smoothstep(.7,.95,edge))*smoothstep(0.,.08,p.y)*(1.-smoothstep(.85,1.,p.y));alpha=lattice*silhouette;if(alpha<.35)discard;color=glow*(.3+pulse*1.4)*alpha;
     }gl_FragColor=vec4(color,alpha);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
    }`});material.userData.basinMistWorld='effectWorld';materials.push(material);return material;}
 const colonies=low?64:112,bodyGeometry=new THREE.CylinderGeometry(.55,1,1,6,3).translate(0,.5,0),tipGeometry=new THREE.IcosahedronGeometry(1,1),tendrilGeometry=new THREE.CylinderGeometry(.06,1,1,5,6).translate(0,.5,0),fanGeometry=new THREE.PlaneGeometry(1.4,1,6,6).translate(0,.5,0);
 const body=new THREE.InstancedMesh(bodyGeometry,reefMaterial(0),colonies*7),tips=new THREE.InstancedMesh(tipGeometry,reefMaterial(1),colonies*4),tendrils=new THREE.InstancedMesh(tendrilGeometry,reefMaterial(2),colonies*9),fans=new THREE.InstancedMesh(fanGeometry,reefMaterial(3),colonies);
 const batches=[body,tips,tendrils,fans],counts=[0,0,0,0],dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
 batches.forEach((mesh,index)=>{mesh.name=['reef-staghorn-colonies','reef-pulsing-polyps','reef-swaying-anemones','reef-luminous-sea-fans'][index];mesh.geometry.setAttribute('reefSeed',new THREE.InstancedBufferAttribute(Float32Array.from({length:mesh.count},()=>random()*Math.PI*2),1));mesh.frustumCulled=false;root.add(mesh);});
 function segment(a:THREE.Vector3,b:THREE.Vector3,radius:number){dummy.position.copy(a);dummy.quaternion.setFromUnitVectors(up,b.clone().sub(a).normalize());dummy.scale.set(radius,a.distanceTo(b),radius);dummy.updateMatrix();body.setMatrixAt(counts[0]++,dummy.matrix);}
 function polyp(p:THREE.Vector3){dummy.position.copy(p);dummy.quaternion.identity();dummy.scale.setScalar(.075+random()*.035);dummy.updateMatrix();tips.setMatrixAt(counts[1]++,dummy.matrix);}
 for(let i=0;i<colonies;i++){const limbIndex=i%3===0?0:13+i%Math.max(1,limbs.length-13),limb=limbs[Math.min(limbIndex,limbs.length-1)];if(!limb)break;const t=limbIndex===0?.04+random()*.34:.12+random()*.76,frame=limb.curve.computeFrenetFrames(24,false),slot=Math.min(24,Math.round(t*24)),angle=random()*Math.PI*2,normal=frame.normals[slot].clone().multiplyScalar(Math.cos(angle)).addScaledVector(frame.binormals[slot],Math.sin(angle)).normalize();if(limbIndex!==0&&normal.y<.2)normal.y=.45;normal.normalize();const base=limb.curve.getPointAt(t).addScaledVector(normal,limb.radius*(1-.7*t)+.07),size=.35+random()*.4;
  const grow=(a:THREE.Vector3,direction:THREE.Vector3,length:number,radius:number,depth:number)=>{const end=a.clone().addScaledVector(direction,length);segment(a,end,radius);if(depth===2){polyp(end);return;}for(const sign of [-1,1]){const side=new THREE.Vector3(Math.cos(angle+depth),.3,Math.sin(angle+depth));grow(end,direction.clone().multiplyScalar(.75).addScaledVector(side,sign*.6).normalize(),length*.7,radius*.62,depth+1);}};
  grow(base,normal,size,.055,0);
  for(let j=0;j<9;j++){dummy.position.copy(base).add(new THREE.Vector3((random()-.5)*.3,0,(random()-.5)*.3));dummy.quaternion.setFromUnitVectors(up,normal.clone().add(new THREE.Vector3((random()-.5)*.6,.25,(random()-.5)*.6)).normalize());dummy.scale.set(.035,size*(.8+random()),.035);dummy.updateMatrix();tendrils.setMatrixAt(counts[2]++,dummy.matrix);}
  dummy.position.copy(base);dummy.quaternion.setFromUnitVectors(up,normal);dummy.rotateY(angle);dummy.scale.setScalar(size*1.2);dummy.updateMatrix();fans.setMatrixAt(counts[3]++,dummy.matrix);
  for(let j=0;j<2;j++)motes.push(base.x+(random()-.5)*1.5,base.y+random()*1.5,base.z+(random()-.5)*1.5);
 }
 batches.forEach((mesh,index)=>{mesh.count=counts[index];mesh.instanceMatrix.needsUpdate=true;});
 // Soft per-polyp coronas reveal traveling energy in daylight without lamps.
 const haloGeometry=new THREE.PlaneGeometry(1,1);haloGeometry.setAttribute('reefSeed',tips.geometry.attributes.reefSeed.clone());
 const haloMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{time:clock},vertexShader:`uniform float time;attribute float reefSeed;varying vec2 q;varying float pulse;varying vec3 effectWorld;void main(){q=uv;effectWorld=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;pulse=pow(sin(dot(effectWorld,vec3(1.6,1.1,1.35))*2.6-time*2.1)*.5+.5,2.5);vec4 view=viewMatrix*vec4(effectWorld,1.);float size=length((modelMatrix*instanceMatrix)[0].xyz)*6.;view.xy+=position.xy*size;gl_Position=projectionMatrix*view;}`,fragmentShader:`varying vec2 q;varying float pulse;void main(){float r=length((q-.5)*2.);float halo=exp(-r*r*5.)*(1.-smoothstep(.7,1.,r));gl_FragColor=vec4(.12,.75,1.,halo*(.04+pulse*.42));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 haloMaterial.userData.basinMistWorld='effectWorld';materials.push(haloMaterial);const halos=new THREE.InstancedMesh(haloGeometry,haloMaterial,tips.count);halos.instanceMatrix=tips.instanceMatrix;halos.name='reef-soft-polyp-coronas';halos.frustumCulled=false;root.add(halos);

 const moteGeometry=new THREE.BufferGeometry();moteGeometry.setAttribute('position',new THREE.Float32BufferAttribute(motes,3));const moteMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{time:clock},vertexShader:'uniform float time;varying vec3 effectWorld;varying float twinkle;void main(){vec3 p=position;p+=vec3(sin(time*.3+p.y),sin(time*.45+p.x),cos(time*.25+p.z))*.12;effectWorld=(modelMatrix*vec4(p,1.)).xyz;vec4 view=viewMatrix*vec4(effectWorld,1.);gl_Position=projectionMatrix*view;gl_PointSize=clamp(450./max(1.,-view.z),1.,4.);twinkle=.4+.6*pow(sin(time+p.x*9.)*.5+.5,3.);}',fragmentShader:'varying vec3 effectWorld;varying float twinkle;void main(){vec2 p=gl_PointCoord-.5;gl_FragColor=vec4(.38,.9,1.,exp(-dot(p,p)*18.)*twinkle*.6);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});moteMaterial.userData.basinMistWorld='effectWorld';materials.push(moteMaterial);const particles=new THREE.Points(moteGeometry,moteMaterial);particles.frustumCulled=false;root.add(particles);
 root.traverse(object=>{object.userData.skipWaterReflection=true;});
 return {root,materials,update(seconds:number){clock.value=seconds;},setLow(){if(budgetLow)return;budgetLow=true;halos.count=Math.min(halos.count,256);batches.forEach((mesh,index)=>mesh.count=Math.min(mesh.count,[64*7,64*4,64*9,64][index]));curtainGeometry.setDrawRange(0,Math.floor(indices.length*.65/6)*6);moteGeometry.setDrawRange(0,Math.min(motes.length/3,248));},get diagnostics(){return {enabled:true,auroraStrokes:routes.length,ivyAligned:aligned.length>0,doubleCurtains:true,reefColonies:budgetLow?Math.min(colonies,64):colonies,polyps:tips.count,draws:7,motes:Math.min(motes.length/3,moteGeometry.drawRange.count),time:clock.value,renderer:'WebGL adaptation of Geometry Painter'};},dispose(){root.removeFromParent();curtainGeometry.dispose();haloGeometry.dispose();batches.forEach(mesh=>mesh.geometry.dispose());moteGeometry.dispose();materials.forEach(material=>material.dispose());}};
}
