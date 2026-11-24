import * as THREE from 'three';

export const BASIN_MIST={start:30,dense:38.4,waterfallTop:48};
export function basinMistAmount(y:number){return .992*THREE.MathUtils.smoothstep(y,BASIN_MIST.start,BASIN_MIST.dense);}
export function perimeterMistRegion(x:number,z:number){
  const rim=Math.pow((Math.abs(x)/110)**4+(Math.abs(z+4)/106)**4,.25);
  const waterfall=1-THREE.MathUtils.smoothstep(Math.hypot(x+72,z+78),18,38);
  return Math.max(THREE.MathUtils.smoothstep(rim,.72,.94),waterfall);
}
const PERIMETER_MIST_GLSL=`float groveMistRegion(vec3 p){float rim=pow(pow(abs(p.x)/110.,4.)+pow(abs(p.z+4.)/106.,4.),.25);float waterfall=1.-smoothstep(18.,38.,length(p.xz-vec2(-72.,-78.)));return max(smoothstep(.72,.94,rim),waterfall);}`;

/** Shared altitude veil includes custom waterfall/particle shaders, which do
 * not participate in Three's ordinary scene fog. No capture or bloom passes. */
export function createBasinMist(root:THREE.Group,height:(x:number,z:number)=>number=()=>0,litMaterials:ReadonlySet<THREE.Material>=new Set(),options:{localized?:boolean}={}){
  const localized=Boolean(options.localized),tint=new THREE.Color(localized?'#c3cec6':'#243b3e'),uniforms={basinMistTint:{value:tint},basinMistReach:{value:1}};
  const materials=new Set<THREE.Material>();
  function decorate(mat:THREE.Material,lit=litMaterials.has(mat),worldExpression:string|undefined=mat.userData.basinMistWorld){if(materials.has(mat))return mat;materials.add(mat);
    const before=mat.onBeforeCompile,key=mat.customProgramCacheKey();
    mat.onBeforeCompile=(shader,renderer)=>{before.call(mat,shader,renderer);Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec3 basinMistWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace(/void main\s*\(\s*\)\s*\{/,`void main(){
        vec4 mistWorld=vec4(position,1.);
        #ifdef USE_INSTANCING
          mistWorld=instanceMatrix*mistWorld;
        #endif
        basinMistWorld=(modelMatrix*mistWorld).xyz;
      `);
      if(worldExpression){const end=shader.vertexShader.lastIndexOf('}');shader.vertexShader=shader.vertexShader.slice(0,end)+`\nbasinMistWorld=${worldExpression};\n`+shader.vertexShader.slice(end);}
      shader.fragmentShader='varying vec3 basinMistWorld;uniform vec3 basinMistTint;uniform float basinMistReach;\n'+(localized?PERIMETER_MIST_GLSL+'\n':'')+shader.fragmentShader;
      const strength=lit?'.28':'.992';
      const amount=localized?`float mistRegion=groveMistRegion(basinMistWorld);float distanceMist=1.-exp(-pow(length(cameraPosition-basinMistWorld)*.014*basinMistReach,2.)*mistRegion);float altitudeMist=1.-(1.-${strength}*smoothstep(30.,38.4,basinMistWorld.y)*mistRegion)*(1.-distanceMist);`:'float altitudeMist='+strength+'*smoothstep(30.,38.4,basinMistWorld.y);';
      const blend=amount+(mat.blending===THREE.AdditiveBlending?'gl_FragColor.a*=1.-altitudeMist;':'gl_FragColor.rgb=mix(gl_FragColor.rgb,basinMistTint,altitudeMist);'+(localized&&mat.transparent?'gl_FragColor.a*=1.-distanceMist;':''))+'\n';
      if(shader.fragmentShader.includes('#include <tonemapping_fragment>'))shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',blend+'#include <tonemapping_fragment>');
      else{const last=shader.fragmentShader.lastIndexOf('}');shader.fragmentShader=shader.fragmentShader.slice(0,last)+blend+(shader.fragmentShader.includes('#include <colorspace_fragment>')?'':'\n#include <colorspace_fragment>\n')+shader.fragmentShader.slice(last);}
    };mat.customProgramCacheKey=()=>key+(lit?'-basin-luminous-mist':'-basin-altitude-mist-v2')+(localized?'-localized-daylight':'');mat.needsUpdate=true;return mat;
  }
  root.traverse(object=>{const material=(object as THREE.Mesh).material;for(const mat of Array.isArray(material)?material:material?[material]:[])decorate(mat);});
  // A background haze layer fills the empty air too, avoiding visible silhouettes
  // against an otherwise clear sky. Foreground depth still occludes this shell.
  const sky=new THREE.Mesh(new THREE.SphereGeometry(2200,24,12),new THREE.ShaderMaterial({side:THREE.BackSide,transparent:true,depthWrite:false,uniforms,
    vertexShader:'varying vec3 w;void main(){w=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 w;uniform vec3 basinMistTint;void main(){vec3 d=normalize(w-cameraPosition);float span=0.;if(d.y>.0001){float entry=max(0.,(34.-cameraPosition.y)/d.y);span=max(0.,700.-entry);}else if(cameraPosition.y>34.)span=d.y<-.0001?min(700.,(34.-cameraPosition.y)/d.y):700.;float a=(1.-exp(-span*.025))*.985;gl_FragColor=vec4(basinMistTint,a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`}));sky.name='basin-upper-air-mist';sky.renderOrder=-20;sky.visible=!localized;root.add(sky);
  const count=144,centers=new Float32Array(count*3),shapes=new Float32Array(count*3);let seed=12051;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++){const x=-103+(i%12+.2+random()*.6)*206/12,z=-101+(Math.floor(i/12)+.2+random()*.6)*202/12;centers.set([x,height(x,z)+1.7+random()*1.2,z],i*3);shapes.set([30+random()*14,5+random()*4,random()*30],i*3);}
  const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.setIndex(plane.index!.clone());geometry.setAttribute('position',plane.attributes.position.clone());geometry.setAttribute('uv',plane.attributes.uv.clone());plane.dispose();geometry.setAttribute('mistCenter',new THREE.InstancedBufferAttribute(centers,3));geometry.setAttribute('mistShape',new THREE.InstancedBufferAttribute(shapes,3));geometry.instanceCount=count;
  const clock={value:0},hero={value:new THREE.Vector3()};
  const pockets=new THREE.Mesh(geometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{...uniforms,time:clock,mistHero:hero},
    vertexShader:`attribute vec3 mistCenter,mistShape;uniform float time;uniform vec3 mistHero;varying vec2 q;varying vec3 mistField;varying float clear;void main(){q=uv;vec3 p=mistCenter;p.x+=sin(time*.045+mistShape.z)*2.5;p.z+=cos(time*.035+mistShape.z)*1.6;p.y+=sin(time*.08+mistShape.z)*.4;mistField=vec3(p.x,p.z,mistShape.z);clear=.28+.72*smoothstep(3.,11.,distance(p.xz,mistHero.xz));vec4 v=modelViewMatrix*vec4(p,1.);v.xy+=position.xy*mistShape.xy;gl_Position=projectionMatrix*v;}`,
    fragmentShader:`varying vec2 q;varying vec3 mistField;varying float clear;uniform float time;uniform vec3 basinMistTint;void main(){vec2 p=(q-.5)*2.;vec2 w=mistField.xy+p*12.;float first=.5+.5*sin(w.x*.055+sin(w.y*.041+time*.06)*1.4+time*.035);float second=.5+.5*cos(w.y*.073-w.x*.028-time*.048);float density=.22+.78*first*(.45+.55*second);float edge=exp(-dot(p,p)*2.4)*(1.-smoothstep(.78,1.,max(abs(p.x),abs(p.y))));float a=edge*(.2+.36*density)*clear;gl_FragColor=vec4(basinMistTint,a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`}));pockets.name='basin-low-drifting-mist';pockets.frustumCulled=false;root.add(pockets);
  return {decorate,
    /** Scales camera-distance mist; 0 lets survey cameras see unveiled paint. */
    setDistanceMist(scale:number){uniforms.basinMistReach.value=scale;},
    update(seconds:number,player?:{x:number;z:number}){clock.value=seconds;if(player)hero.value.set(player.x,0,player.z);},diagnostics:{enabled:true,localized,wholeSkyVeil:!localized,startHeight:30,denseHeight:38.4,waterfallTop:48,lowPockets:count,terrainFollowing:true,dynamicDensity:true,extraDraws:localized?1:2}};
}
