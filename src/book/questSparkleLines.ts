import * as THREE from 'three';

export type QuestFloor=(x:number,z:number)=>number|undefined;
export function sampleQuestFloorPath(origin:{x:number;z:number},end:{x:number;z:number},floor:QuestFloor,knots:number,out:Float32Array,offset=0){
  const dx=end.x-origin.x,dz=end.z-origin.z,length=Math.max(.001,Math.hypot(dx,dz));
  for(let i=0;i<knots;i++){
    const t=i/(knots-1),bend=Math.sin(t*Math.PI)*Math.sin(t*Math.PI*2)*.28;
    const x=origin.x+dx*t-dz/length*bend,z=origin.z+dz*t+dx/length*bend,y=floor(x,z),valid=y!==undefined&&Number.isFinite(y);
    out.set([x,valid?y+.045:0,z,valid?1:0],offset+i*4);
  }
}

/** One depth-tested batch for all quest-object guides. Curves, moving motes,
 * star cores and soft colored halos are GPU-only; no bloom or light passes. */
export function createQuestSparkleLines(scene:THREE.Scene,targets:THREE.Vector3[],reduced=false,low=false,floor:QuestFloor=()=>0){
  if(!targets.length||targets.length>8)throw Error('Quest sparkle lines support one to eight targets.');
  const perLine=low?96:192,count=targets.length*perLine,geometry=new THREE.BufferGeometry(),attributes=new Float32Array(count*3);
  for(let id=0;id<targets.length;id++)for(let i=0;i<perLine;i++){const at=(id*perLine+i)*3;attributes.set([id,i/perLine,i*.61803398875+id*7.13],at);}
  geometry.setAttribute('position',new THREE.BufferAttribute(attributes,3));
  const strength=targets.map(()=>0),knots=low?33:65,field=new Float32Array(knots*targets.length*4);
  const floorMap=new THREE.DataTexture(field,knots,targets.length,THREE.RGBAFormat,THREE.FloatType);floorMap.generateMipmaps=false;floorMap.minFilter=floorMap.magFilter=THREE.NearestFilter;
  const lastOrigin=new THREE.Vector2(),lastTargets=targets.map(()=>new THREE.Vector2());let initialized=false;
  const uniforms={questFloor:{value:floorMap},questStrength:{value:strength},questTime:{value:0},questStill:{value:reduced?1:0},questHeight:{value:720}};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,uniforms,
    vertexShader:/* glsl */`
      uniform sampler2D questFloor;uniform float questStrength[${targets.length}],questTime,questStill,questHeight;
      varying float alpha,seed,halo,travel;
      vec4 floorAt(float index,int id){return texture2D(questFloor,vec2((index+.5)/${knots}.,(float(id)+.5)/${targets.length}.));}
      void main(){int id=int(position.x);seed=position.z;halo=step(.74,fract(seed));
        travel=fract(position.y+questTime*.11*(1.-questStill));
        float sampleIndex=travel*${knots-1}.;float index=floor(sampleIndex);
        vec4 a=floorAt(index,id),b=floorAt(min(index+1.,${knots-1}.),id);
        vec3 p=mix(a.xyz,b.xyz,fract(sampleIndex));
        vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(questHeight*mix(.085,.55,halo)/max(.3,-view.z),1.5,42.);
        float pulse=mix(.65,.35+.65*pow(.5+.5*sin(seed*21.+questTime*7.),2.),1.-questStill);
        alpha=questStrength[id]*pulse*mix(1.,.55,halo)*smoothstep(0.,.05,travel)*a.w*b.w*step(abs(a.y-b.y),.3);
      }`,
    fragmentShader:/* glsl */`
      varying float alpha,seed,halo,travel;
      void main(){vec2 p=gl_PointCoord-.5;float r=dot(p,p);
        float glow=exp(-r*18.);float core=exp(-r*140.);
        float star=exp(-abs(p.x)*75.-abs(p.y)*9.)+exp(-abs(p.y)*75.-abs(p.x)*9.);
        vec3 tint=mix(vec3(.22,.45,1.),vec3(.88,.25,1.),.5+.5*sin(travel*8.+seed*.1));
        vec3 color=mix(vec3(1.,.87,.57)+vec3(.7)*core,tint*2.6,halo);
        float shape=mix(core+star*.7,glow,halo);if(shape*alpha<.005)discard;
        gl_FragColor=vec4(color,alpha*shape);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const points=new THREE.Points(geometry,material);points.name='quest-sparkle-lines';points.frustumCulled=false;points.visible=false;points.userData.skipWaterReflection=true;scene.add(points);
  return {
    update(dt:number,origin:{x:number;y?:number;z:number},enabled:boolean[],visible:boolean,pixelHeight:number){
      if(visible&&enabled.some(Boolean)&&(!initialized||Math.hypot(origin.x-lastOrigin.x,origin.z-lastOrigin.y)>.1||targets.some((target,i)=>enabled[i]&&Math.hypot(target.x-lastTargets[i].x,target.z-lastTargets[i].y)>.1))){
        for(let i=0;i<targets.length;i++)if(enabled[i]){sampleQuestFloorPath(origin,targets[i],floor,knots,field,i*knots*4);lastTargets[i].set(targets[i].x,targets[i].z);}
        lastOrigin.set(origin.x,origin.z);initialized=true;floorMap.needsUpdate=true;
      }
      if(!reduced)uniforms.questTime.value+=dt;uniforms.questHeight.value=pixelHeight;
      for(let i=0;i<strength.length;i++)strength[i]=THREE.MathUtils.damp(strength[i],visible&&enabled[i]?1:0,12,dt);
      points.visible=visible&&strength.some(value=>value>.01);
    },
    get diagnostics(){return {draws:points.visible?1:0,targets:strength.filter(s=>s>.01).length,particles:count,animated:!reduced,visible:points.visible,newLights:0,surfaceBound:true};},
    points,
    dispose(){points.removeFromParent();geometry.dispose();material.dispose();floorMap.dispose();},
  };
}
