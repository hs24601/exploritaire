import {createWorldTreeGeometryPaint} from './worldTreeGeometryPaint';
import {createMeadowTerrain} from './castleMeadowNavigation';
import {createBasinMist} from './basinMist';
import {createWorldTreeGroundCover,worldTreeSoilPaint} from './worldTreeGroundCover';
import * as THREE from 'three';
import {seeded} from './castlePaint';
import {paintWcWood,paintWcBank,paintWcCliff} from './castleWatercolor';
import {WATERCOLOR_NOISE} from './castleWatercolor';
import {WATER_PIGMENT_GLSL} from './waterPigment';
import {createWaterfallFlow} from './waterfallParticles';
import {createGroveLights,createFruitSpectra,WATER_SPRITE_COUNT,WATER_SPRITE_GLSL} from './worldTreeLight';
import {createWorldTreeIvy,type TreeLimb} from './worldTreeIvy';

export const BASIN={halfWidth:110,halfDepth:106,treeZ:-42,sourceX:-72,sourceZ:-90};
export const RIVER_POINTS=[[-72,-76],[-76,-48],[-54,-32],[-28,-68],[9,-72],[44,-47],[66,-10],[101,44],[140,68]] as const;
export function riverAt(x:number,z:number){let distance=Infinity,along=0,total=0;for(let i=1;i<RIVER_POINTS.length;i++){const a=RIVER_POINTS[i-1],b=RIVER_POINTS[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(length*length),0,1),d=Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);if(d<distance){distance=d;along=total+t*length;}total+=length;}return {distance,along};}
export const riverX=(z:number)=>-72;
export function basinEdge(x:number,z:number){const angle=Math.atan2(z+4,x);return Math.pow((x/110)**4+((z+4)/106)**4,.25)+Math.sin(angle*7)*.018+Math.cos(angle*11)*.012;}
export function treeGround(x:number,z:number){
 const e=basinEdge(x,z),rear=1+.3*(1-THREE.MathUtils.smoothstep(z,-75,-20)),front=1-.6*THREE.MathUtils.smoothstep(z,45,105);
 let height=(6*THREE.MathUtils.smoothstep(e,.62,.78)+22*THREE.MathUtils.smoothstep(e,.78,.91)+28*THREE.MathUtils.smoothstep(e,.91,1.06))*rear*front;
 const shelf=(1-THREE.MathUtils.smoothstep(Math.abs(x+72),18,30))*(1-THREE.MathUtils.smoothstep(z,-83,-67));
 height=Math.max(height,45*shelf);
 // Cut the spillway into the front of the shelf so the upper curtain clears the rock.
 const spillway=(1-THREE.MathUtils.smoothstep(Math.abs(x+72),15,19))*THREE.MathUtils.smoothstep(z,-85,-82);
 height=THREE.MathUtils.lerp(height,Math.min(height,48-(z+84)*4-3),spillway*(1-THREE.MathUtils.smoothstep(z,-77,-75)));
 const river=riverAt(x,z).distance;
 if(z> -79)height=THREE.MathUtils.lerp(-4,height,THREE.MathUtils.smoothstep(river,12,23));
 return height;
}
export function treeWalkable(x:number,z:number,radius=.45){
 if(basinEdge(x,z)>.94-radius/110||riverAt(x,z).distance<19+radius||Math.hypot(x,z+42)<30+radius)return false;
 const slope=Math.hypot(treeGround(x+.5,z)-treeGround(x-.5,z),treeGround(x,z+.5)-treeGround(x,z-.5));return slope<1.1;
}
export const treeSurface={height:treeGround,wall:()=>false,move:(x:number,z:number,dx:number,dz:number)=>{
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.2));for(let i=0;i<steps;i++){if(treeWalkable(x+dx/steps,z))x+=dx/steps;if(treeWalkable(x,z+dz/steps))z+=dz/steps;}return {x,z};
}};
/** Sweep each small axis step against the same body clearance used by routes,
 * allowing a blocked diagonal to slide beside a root rather than hit a box. */
export function createTreeMovement(clear:(x:number,z:number,r:number,y:number)=>boolean){
 return {height:treeGround,wall:(x:number,z:number,y=treeGround(x,z))=>!clear(x,z,.45,y),
  move(x:number,z:number,dx:number,dz:number,y=treeGround(x,z),grounded=true){
   const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
   for(let i=0;i<steps;i++){
    const nx=x+dx/steps;if(clear(nx,z,.45,grounded?treeGround(nx,z):y))x=nx;
    const nz=z+dz/steps;if(clear(x,nz,.45,grounded?treeGround(x,nz):y))z=nz;
   }
   return {x,z};
  },
 };
}

/** Shared materials and instanced vegetation keep the dense grove inexpensive. */
export function createWorldTreeScene(scene:THREE.Scene,water:THREE.Material,shade:(m:THREE.MeshLambertMaterial)=>THREE.MeshLambertMaterial,low=false,paintedTrees:readonly {texture:THREE.Texture;aspect:number;foot:number}[]=[],options:{localizedAtmosphere?:boolean;geometryPaint?:boolean}={}){
  const root=new THREE.Group();root.name='Yggdrasil river grove';scene.add(root);
  const cameraObstacles:THREE.Box3[]=[];
  const movementMeshes:THREE.Mesh[]=[],forestTrunks:{x:number;z:number;base:number;height:number;radius:number}[]=[];
  const time={value:0},central=new THREE.Group();central.name='World tree — fourfold scale';central.scale.setScalar(4);central.position.z=BASIN.treeZ;root.add(central);
  const random=seeded(120);
  const wood=shade(new THREE.MeshLambertMaterial({map:paintWcWood(),color:'#bca27d',emissiveIntensity:0}));
  const leaf=shade(new THREE.MeshLambertMaterial({map:paintWcBank(),color:'#c4d595',emissiveIntensity:0}));
  const fern=shade(new THREE.MeshLambertMaterial({map:paintWcBank(89),color:'#8fbc75',side:THREE.DoubleSide}));
  const terrain=new THREE.PlaneGeometry(440,440,160,160).rotateX(-Math.PI/2),p=terrain.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,treeGround(p.getX(i),p.getZ(i)));terrain.computeVertexNormals();
  const soilPaint=worldTreeSoilPaint();
  const ground=new THREE.Mesh(terrain,new THREE.MeshLambertMaterial({map:soilPaint,color:'#c3ccb8',emissiveMap:soilPaint,emissive:'#ffffff',emissiveIntensity:.12}));root.add(ground);
  // Keep the expanded authoring camera inside a continuous misty landscape,
  // rather than revealing the rectangular edge of the playable heightfield.
  const apron=new THREE.Mesh(new THREE.RingGeometry(219,2500,96).rotateX(-Math.PI/2),ground.material);apron.position.y=48;root.add(apron);
  const river=new THREE.Mesh(new THREE.PlaneGeometry(440,440).rotateX(-Math.PI/2),water);river.position.y=-1.6;root.add(river);
  const limbs:TreeLimb[]=[];
  function branch(points:number[][],radius:number){const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)));limbs.push({curve,radius});const geometry=new THREE.TubeGeometry(curve,24,radius,7,false),positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){const center=curve.getPointAt(Math.floor(i/8)/24),t=Math.floor(i/8)/24,scale=1-t*.7;positions.setXYZ(i,center.x+(positions.getX(i)-center.x)*scale,center.y+(positions.getY(i)-center.y)*scale,center.z+(positions.getZ(i)-center.z)*scale);}geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,wood);mesh.name='World Tree solid wood';central.add(mesh);movementMeshes.push(mesh);}
  branch([[0,-2,0],[5,18,2],[-3,35,0],[1,53,-4]],7);
  const crowns:{x:number;y:number;z:number;s:number}[]=[];
  for(let i=0;i<12;i++){const angle=i*2.39996,y=19+i*2.5,r=27-i*.9,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
    branch([[1,y-8,0],[x*.45,y-1,z*.45],[x,y,z],[x*1.12,y+5,z*1.12]],2.8-i*.12);crowns.push({x,y:y+6,z,s:11-i*.15});}
  crowns.push({x:0,y:57,z:-4,s:15});
  for(let i=0;i<11;i++){const a=i/11*Math.PI*2;branch([[3,7,0],[Math.cos(a)*9,1,Math.sin(a)*9],[Math.cos(a)*20,-.1,Math.sin(a)*20]],2.4);}
  const canopy=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),leaf,180),dummy=new THREE.Object3D();
  for(let i=0;i<180;i++){const c=crowns[i%crowns.length];dummy.position.set(c.x+(random()-.5)*c.s*1.5,c.y+(random()-.5)*5,c.z+(random()-.5)*c.s*1.5);dummy.scale.set(c.s*(.45+random()*.35),2+random()*3,c.s*(.45+random()*.35));dummy.rotation.set(random(),random()*6,random()*.3);dummy.updateMatrix();canopy.setMatrixAt(i,dummy.matrix);}central.add(canopy);
  // Painted full-tree silhouettes replace only the grove; Yggdrasil stays modeled.
  // Crossed cards retain their authored proportions from every walking direction,
  // with static instance buffers and just three shared material batches.
  const forest=paintedTrees.map((art,v)=>{
    const geometry=new THREE.PlaneGeometry(1,1).translate(0,.5-art.foot,0);
    const material=new THREE.MeshLambertMaterial({map:art.texture,alphaTest:.25,side:THREE.DoubleSide,color:'#a2b6ac'});
    const mesh=new THREE.InstancedMesh(geometry,material,400);mesh.name=`painted-grove-trees-${v}`;root.add(mesh);return mesh;
  });
  for(let i=0;i<600;i++){let x=0,z=0;do{x=(random()-.5)*390;z=(random()-.5)*390;}while(Math.hypot(x,z+42)<70||riverAt(x,z).distance<24||Math.abs(x)<26&&z>-25&&z<150);
    const h=7+random()*17,angle=random()*Math.PI,v=i%paintedTrees.length,art=paintedTrees[v];
    if(!art)continue;
    const base=treeGround(x,z),half=h*art.aspect*.5;
    forestTrunks.push({x,z,base,height:h*.55,radius:.35+h*.015});
    cameraObstacles.push(new THREE.Box3(new THREE.Vector3(x-half,base-art.foot*h,z-half),new THREE.Vector3(x+half,base+(1-art.foot)*h,z+half)));
    for(let side=0;side<2;side++){dummy.position.set(x,treeGround(x,z),z);dummy.scale.set(h*art.aspect,h,1);dummy.rotation.set(0,angle+side*Math.PI/2,0);dummy.updateMatrix();forest[v].setMatrixAt(Math.floor(i/paintedTrees.length)*2+side,dummy.matrix);}
  }
  const paintedCover=createWorldTreeGroundCover(root,treeGround,(x,z)=>treeWalkable(x,z,.1)&&riverAt(x,z).distance>22,low);
  const ivy=createWorldTreeIvy(central,limbs,wood.map!,leaf.map!,shade,low,!!options.geometryPaint);
  const glow=new THREE.MeshLambertMaterial({color:'#ffffff',map:leaf.map,emissive:'#ffffff',emissiveMap:leaf.map,emissiveIntensity:.35}),berries=new THREE.InstancedMesh(new THREE.SphereGeometry(.35,10,8),glow,180);
  for(let i=0;i<180;i++){const c=crowns[i%crowns.length];dummy.position.set(c.x+(random()-.5)*c.s,c.y-8-random()*6,c.z+(random()-.5)*c.s);dummy.scale.setScalar(.6+random());dummy.rotation.set(0,0,0);dummy.updateMatrix();berries.setMatrixAt(i,dummy.matrix);berries.setColorAt(i,new THREE.Color(['#ffcd67','#f6a2c7','#bca8ff','#7ce9ce','#f1e7ac'][i%5]));}central.add(berries);
  const motes=new THREE.InstancedMesh(new THREE.SphereGeometry(.16,5,3),new THREE.MeshBasicMaterial({color:'#9cead5',toneMapped:false}),80);
  for(let i=0;i<80;i++){const segment=Math.floor(random()*(RIVER_POINTS.length-1)),a=RIVER_POINTS[segment],b=RIVER_POINTS[segment+1],t=random();dummy.position.set(THREE.MathUtils.lerp(a[0],b[0],t)+(random()-.5)*20,1+random()*5,THREE.MathUtils.lerp(a[1],b[1],t)+(random()-.5)*12);dummy.scale.setScalar(.7+random());dummy.updateMatrix();motes.setMatrixAt(i,dummy.matrix);}root.add(motes);
  // Reference-led stepped source pool, main curtain and lower rock cascade.
  const flows:ReturnType<typeof createWaterfallFlow>[]=[];
  const fallMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true,uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),time},
    vertexShader:`
      #include <fog_pars_vertex>
      varying vec2 q;
      varying vec3 world;
      void main(){
        q=uv;
        world=(modelMatrix*vec4(position,1.)).xyz;
        vec4 mvPosition=viewMatrix*vec4(world,1.);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader:`
      #include <fog_pars_fragment>
      varying vec2 q;
      varying vec3 world;
      ${WATER_SPRITE_GLSL}
      ${WATERCOLOR_NOISE}
      ${WATER_PIGMENT_GLSL}
      uniform sampler2D flowMask;
      void main(){
        float light=0.;
        for(int i=0;i<${WATER_SPRITE_COUNT};i++){
          float id=float(i);
          vec3 delta=world-waterSprite(id);
          light+=exp(-dot(delta,delta)*.016)*waterSpritePulse(id)*${9/WATER_SPRITE_COUNT};
        }
        float edge=smoothstep(0.,.10,q.x)*(1.-smoothstep(.9,1.,q.x));
        vec2 texel=vec2(1./128.,1./256.);
        float stroke=texture2D(flowMask,q).a*.4;
        stroke+=(texture2D(flowMask,q+vec2(texel.x,0.)).a+texture2D(flowMask,q-vec2(texel.x,0.)).a
          +texture2D(flowMask,q+vec2(0.,texel.y)).a+texture2D(flowMask,q-vec2(0.,texel.y)).a)*.15;
        // The river's broad paint fields stay anchored to the surface while
        // gravity-driven strokes carry water down through these washes.
        vec2 paint=vec2(world.x*.16,world.y*.09);
        float warp=wcNoise(vec3(paint*.75,2.7))-.5;
        float wash=wcFbm(vec3(paint*.65+warp*1.4,1.2));
        float paper=wcNoise(world*5.2+8.1)-.5;
        paper*=1.-smoothstep(.08,.65,length(fwidth(world)));
        vec3 pigment=waterPigment(wash,min(q.x,1.-q.x)*29.,warp,paper);
        float wet=stroke;
        vec3 color=mix(pigment,vec3(.48,.73,.74),wet*(.16+.32*smoothstep(.1,1.2,light))*(.45+.55*wash));
        float reach=1.;
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            reach=exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
          #else
            reach=1.-smoothstep(fogNear,fogFar,vFogDepth);
          #endif
        #endif
        float visibility=edge*(.22+.78*smoothstep(.10,1.05,light))*reach;
        gl_FragColor=vec4(color,visibility*(.10+wet*.86));
        #include <fog_fragment>
      }
    `
  });
  function curtain(top:number,bottom:number,back:number,front:number,width:number){
    const geo=new THREE.PlaneGeometry(width,1,24,16),position=geo.attributes.position;
    for(let i=0;i<position.count;i++){const u=geo.attributes.uv.getY(i),x=position.getX(i);position.setXYZ(i,x+Math.sin(u*7+x*.2)*.25,THREE.MathUtils.lerp(bottom,top,u),THREE.MathUtils.lerp(front,back,u)+Math.sin(x*.35)*.45);}geo.computeVertexNormals();
    const flow=createWaterfallFlow(top-bottom,low,12072+flows.length);flows.push(flow);
    const material=fallMaterial.clone();material.uniforms.time=time;material.uniforms.flowMask={value:flow.texture};
    material.addEventListener('dispose',()=>flow.dispose());
    const mesh=new THREE.Mesh(geo,material);mesh.name='watercolor-particle-waterfall';mesh.position.x=-72;root.add(mesh);
  }
  curtain(48,12,-84,-75,29);curtain(12,-1.5,-75,-64,34);
  fallMaterial.dispose();
  const pondShape=new THREE.Shape();pondShape.moveTo(-89,-104);pondShape.lineTo(-53,-104);pondShape.quadraticCurveTo(-48,-91,-56,-83);pondShape.lineTo(-87,-83);pondShape.quadraticCurveTo(-98,-92,-89,-104);
  const pondGeo=new THREE.ShapeGeometry(pondShape);const pondPosition=pondGeo.attributes.position;for(let i=0;i<pondPosition.count;i++){const x=pondPosition.getX(i),z=pondPosition.getY(i);pondPosition.setXYZ(i,x,48,z);}const pondIndex=pondGeo.index!;for(let i=0;i<pondIndex.count;i+=3){const b=pondIndex.getX(i+1);pondIndex.setX(i+1,pondIndex.getX(i+2));pondIndex.setX(i+2,b);}pondGeo.computeVertexNormals();root.add(new THREE.Mesh(pondGeo,water));
  const stone=shade(new THREE.MeshLambertMaterial({map:paintWcCliff(),color:'#c2a777',emissive:'#342b1e',emissiveIntensity:.22}));
  const rockGeo=new THREE.CylinderGeometry(.8,1,1,6,2),rp=rockGeo.attributes.position;for(let i=0;i<rp.count;i++){const y=rp.getY(i);rp.setX(i,rp.getX(i)*(1+.13*Math.sin(y*9+rp.getZ(i)*4)));}rockGeo.computeVertexNormals();
  const rocks=new THREE.InstancedMesh(rockGeo,stone,180),caps=new THREE.InstancedMesh(new THREE.CircleGeometry(1,9).rotateX(-Math.PI/2),fern,180);
  for(let i=0;i<180;i++){
    let x:number,z:number,height:number,width:number,base:number;
    if(i<24){const side=i%2?-1:1;x=-72+side*(19+random()*14);z=-102+random()*49;height=12+random()*40;width=5+random()*6;base=0;}
    else{const a=(i-24)/156*Math.PI*2,r=.8+random()*.18;x=Math.cos(a)*110*r;z=Math.sin(a)*106*r-4;height=8+random()*25;width=4+random()*6;base=Math.max(0,treeGround(x,z)-height*.6);}
    const wet=i>=24&&(riverAt(x,z).distance<18||z>45&&Math.abs(x)<55);dummy.position.set(x,base+height*.5,z);dummy.scale.set(wet?0:width,height,wet?0:width*(.7+random()*.6));dummy.rotation.set(0,random()*6,0);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
    dummy.position.y=base+height+.04;dummy.scale.set(wet?0:width*.65,1,wet?0:width*.7);dummy.updateMatrix();caps.setMatrixAt(i,dummy.matrix);
  }root.add(rocks,caps);
  root.updateWorldMatrix(true,true);
  // Use the rendered limb/crown/fruit and rock bounds, not only the old trunk
  // cylinder used by the close follow camera. Atlas-tree alpha cards have
  // conservative solid footprints recorded above.
  function cameraBounds(mesh:THREE.Mesh){
    mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox!;
    if(mesh instanceof THREE.InstancedMesh){const local=new THREE.Matrix4(),world=new THREE.Matrix4();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,local);if(Math.hypot(local.elements[0],local.elements[1],local.elements[2])<.001)continue;world.multiplyMatrices(mesh.matrixWorld,local);cameraObstacles.push(bounds.clone().applyMatrix4(world));}}
    else cameraObstacles.push(bounds.clone().applyMatrix4(mesh.matrixWorld));
  }
  for(const child of central.children)if(child instanceof THREE.Mesh)cameraBounds(child);
  cameraBounds(rocks);
  // Camera bounds deliberately enclose whole limbs and merged decorative ivy.
  // They are not player solids: index actual wood/rock triangles separately,
  // and use only narrow trunk footprints for painted forest silhouettes.
  const rockInstance=new THREE.Matrix4();
  for(let i=0;i<rocks.count;i++){
    rocks.getMatrixAt(i,rockInstance);if(Math.hypot(rockInstance.elements[0],rockInstance.elements[1],rockInstance.elements[2])<.001)continue;
    const mesh=new THREE.Mesh(rocks.geometry);mesh.matrixWorld.multiplyMatrices(rocks.matrixWorld,rockInstance);movementMeshes.push(mesh);
  }
  const movementTerrain=createMeadowTerrain(movementMeshes,{minX:-111,maxX:111,minZ:-111,maxZ:107,minY:-1000,cellSize:4});
  function movementClear(x:number,z:number,r=.45,y=treeGround(x,z)){
    if(forestTrunks.some(t=>y<t.base+t.height&&y+1.2>t.base&&Math.hypot(x-t.x,z-t.z)<t.radius+r))return false;
    return movementTerrain.bodyClear(x,y,z,r-.45);
  }
  const middlePool=new THREE.Mesh(new THREE.CircleGeometry(1,22).rotateX(-Math.PI/2),water);middlePool.position.set(-72,12.05,-75);middlePool.scale.set(17,1,4);root.add(middlePool);
  const glowPositions=new Float32Array(260*3),glowColors=new Float32Array(260*3),fruitRadii=new Float32Array(180),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  for(let i=0;i<260;i++){(i<180?berries:motes).getMatrixAt(i<180?i:i-180,matrix);point.setFromMatrixPosition(matrix);if(i<180){fruitRadii[i]=1.4*new THREE.Vector3().setFromMatrixScale(matrix).x;point.multiplyScalar(4);point.z+=BASIN.treeZ;}glowPositions.set(point.toArray(),i*3);const tint=new THREE.Color(i<180?['#ffcd67','#f6a2c7','#bca8ff','#7ce9ce','#f1e7ac'][i%5]:'#72e8ce');glowColors.set(tint.toArray(),i*3);}
  const fruitLights=createGroveLights(glowPositions.slice(0,540),glowColors.slice(0,540),new Float32Array(180).fill(800),time,'fruit');
  const fruitSpectra=createFruitSpectra(glowPositions.slice(0,540),glowColors.slice(0,540),fruitRadii,time,low);root.add(fruitSpectra);
  const riverLights=createGroveLights(glowPositions.slice(540),glowColors.slice(540),new Float32Array(80).fill(760),time,'fruit');
  const pollenCount=low?1900:4400,pollenRandom=seeded(12061);
  const pollenPositions=new Float32Array(pollenCount*3),pollenColors=new Float32Array(pollenCount*3),pollenSizes=new Float32Array(pollenCount);
  const pollenPalette=['#b6f4e9','#a9d9ff','#e0c2ff','#fff0c2'].map(color=>new THREE.Color(color));
  for(let i=0;i<pollenCount;i++){
    const crown=crowns[i%crowns.length],angle=pollenRandom()*Math.PI*2;
    if(i%3!==0){
      const radius=18+pollenRandom()*90;
      pollenPositions.set([Math.cos(angle)*radius,3+pollenRandom()*42,BASIN.treeZ+Math.sin(angle)*radius],i*3);
    }else{
      const radius=crown.s*(.55+pollenRandom()*.85);
      pollenPositions.set([4*(crown.x+Math.cos(angle)*radius),4*(crown.y-10+pollenRandom()*16),BASIN.treeZ+4*(crown.z+Math.sin(angle)*radius)],i*3);
    }
    pollenPalette[i%pollenPalette.length].toArray(pollenColors,i*3);
    pollenSizes[i]=180+pollenRandom()*480;
  }
  const pollen=createGroveLights(pollenPositions,pollenColors,pollenSizes,time,'pollen');
  const spriteColors=new Float32Array(WATER_SPRITE_COUNT*3),spriteIds=new Float32Array(WATER_SPRITE_COUNT);
  const waterTint=new THREE.Color('#83efff');
  for(let i=0;i<WATER_SPRITE_COUNT;i++){waterTint.toArray(spriteColors,i*3);spriteIds[i]=i;}
  const sprites=createGroveLights(new Float32Array(WATER_SPRITE_COUNT*3),spriteColors,spriteIds,time,'water');
  fruitLights.renderOrder=pollen.renderOrder=sprites.renderOrder=2;
  root.add(fruitLights,riverLights,pollen,sprites);
  const mistGeometry=new THREE.BufferGeometry(),mistPositions=new Float32Array(90*3);for(let i=0;i<90;i++)mistPositions.set([-72+(random()-.5)*38,-.5+random()*4,-65+random()*15],i*3);mistGeometry.setAttribute('position',new THREE.BufferAttribute(mistPositions,3));
  root.add(new THREE.Points(mistGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time},vertexShader:'uniform float time;varying float a;void main(){vec3 p=position;p.y+=sin(time*.6+position.x)*.7;p.x+=sin(time*.3+position.z);vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(3500./max(1.,-v.z),3.,100.);a=.12;}',fragmentShader:'varying float a;void main(){vec2 p=gl_PointCoord-.5;gl_FragColor=vec4(.65,.83,.81,a*exp(-dot(p,p)*14.));}'})));
  const geometryPaint=options.geometryPaint?createWorldTreeGeometryPaint(central,limbs,low,ivy.paths):undefined;
  const basinMist=createBasinMist(root,treeGround,new Set([glow,ivy.stems.material,ivy.leaves.material,fruitSpectra.material,fruitLights.material,pollen.material,...(geometryPaint?.materials??[])]),{localized:options.localizedAtmosphere});
  return {root,ground,river,tree:canopy,cameraObstacles,movementClear,atmosphere:basinMist,setLow:()=>geometryPaint?.setLow(),update:(seconds:number,hero?:{x:number;z:number})=>{time.value=seconds;geometryPaint?.update(seconds);for(const flow of flows)flow.update(seconds);basinMist.update(seconds,hero);},diagnostics:{geometryPaint:geometryPaint?.diagnostics,mist:basinMist.diagnostics,trees:600,paintedTrees:true,forestDraws:forest.length,clutter:paintedCover.grassCards,paintedGround:paintedCover,berries:180,treeBioluminescence:false,ivy:ivy.diagnostics,vines:ivy.diagnostics.climbers,wisps:pollenCount,waterWisps:WATER_SPRITE_COUNT,fruitSpectralParticles:fruitSpectra.geometry.attributes.position.count,river:true,puzzle:false,treeScale:4,waterfall:true,waterfallParticles:{drops:2,maxStrokes:low?320:640,maxBubbles:low?48:96,texturePixels:49152,fps:low?20:30},waterfallSource:"reference-led two-stage basin cascade",basin:[220,212],rockColumns:180,treeZ:BASIN.treeZ}};
}
