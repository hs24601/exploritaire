import * as THREE from 'three';
import {seeded} from './castlePaint';
import {PLAYER_FOG_GLSL} from './castlePlayerFog';
import type {createPlayerFog} from './castlePlayerFog';
import type {BookRenderQuality} from './viewportPolicy';

const CONSTELLATIONS=[
  {points:[[-30,38],[-25,36],[-20,40],[-12,39],[-9,44],[-15,47],[-23,46]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,2]]},
  {points:[[78,44],[86,53],[95,47],[90,38],[78,44],[104,37]],edges:[[0,1],[1,2],[2,3],[3,0],[3,5]]},
  {points:[[205,36],[216,41],[228,37],[222,29],[211,28],[239,43]],edges:[[0,1],[1,2],[2,3],[3,4],[4,0],[2,5]]},
] as const;
export const nightStarBudget=(quality:BookRenderQuality)=>quality==='low'?650:quality==='high'?4200:2400;
const direction=(az:number,elevation:number,radius=5000)=>{
  const a=THREE.MathUtils.degToRad(az),e=THREE.MathUtils.degToRad(elevation);
  return [Math.sin(a)*Math.cos(e)*radius,Math.sin(e)*radius,-Math.cos(a)*Math.cos(e)*radius] as const;
};

/** Three shared draws: sky washes, stars, and faint constellation threads.
 * The celestial sphere translates with the camera but never rotates with it. */
export function createCastleNightSky(quality:BookRenderQuality,reduced:boolean,fog:ReturnType<typeof createPlayerFog>){
  const group=new THREE.Group();group.name='grounds-galaxies-and-constellations';
  const clock={value:0},ratio={value:1},detail={value:quality==='low'?.45:1};
  let still=reduced||quality==='low';
  const backdrop=new THREE.Mesh(new THREE.SphereGeometry(6000,32,16),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,uniforms:{...fog.uniforms,uSkyDetail:detail},
    vertexShader:'varying vec3 skyDir;void main(){skyDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}',
    fragmentShader:/* glsl */`
      varying vec3 skyDir;uniform float uSkyDetail;
      ${PLAYER_FOG_GLSL}
      float skyHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float skyNoise(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(skyHash(i),skyHash(i+vec3(1,0,0)),f.x),mix(skyHash(i+vec3(0,1,0)),skyHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(skyHash(i+vec3(0,0,1)),skyHash(i+vec3(1,0,1)),f.x),mix(skyHash(i+vec3(0,1,1)),skyHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      vec3 galaxy(vec3 dir,vec3 center,float rx,float ry,vec3 pigment){
        vec3 right=normalize(cross(vec3(0,1,0),center)),up=cross(center,right);
        vec2 p=vec2(dot(dir,right)/rx,dot(dir,up)/ry);
        float r=length(p),face=smoothstep(.65,.95,dot(dir,center));
        float irregular=.65+.35*skyNoise(vec3(p*2.7,4.1));
        float wash=exp(-r*r*1.5)*face*irregular;
        float arms=pow(.5+.5*cos(atan(p.y,p.x)*2.-r*8.),2.);
        return pigment*wash*(.35+arms*.65)+vec3(.15,.12,.075)*exp(-r*9.)*face;
      }
      void main(){
        vec3 dir=normalize(skyDir);
        float h=max(0.,dir.y);
        vec3 color=mix(vec3(.012,.023,.040),vec3(.003,.006,.018),pow(h,.5));
        float clouds=skyNoise(dir*12.)*.65+skyNoise(dir*29.+8.1)*.35;
        float band=exp(-pow(dot(dir,normalize(vec3(.32,.77,.55)))*5.,2.));
        float dust=smoothstep(.28,.75,clouds);
        color+=vec3(.030,.032,.065)*band*dust*uSkyDetail;
        color+=galaxy(dir,normalize(vec3(-.44,.62,-.65)),.32,.10,vec3(.09,.055,.15))*uSkyDetail;
        color+=galaxy(dir,normalize(vec3(.78,.48,.39)),.18,.075,vec3(.045,.09,.13))*uSkyDetail;
        color*=.94+.06*clouds;
        color=castleFog(color,cameraPosition,cameraPosition+dir*220.);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  backdrop.renderOrder=-100;backdrop.frustumCulled=false;group.add(backdrop);

  const nodes=CONSTELLATIONS.flatMap(c=>c.points.map(([a,e])=>direction(a,e)));
  const field=nightStarBudget(quality),count=field+nodes.length;
  const pos=new Float32Array(count*3),sizes=new Float32Array(count),seeds=new Float32Array(count),colors=new Float32Array(count*3);
  const random=seeded(11873);
  for(let i=0;i<count;i++){
    if(i<nodes.length){pos.set(nodes[i],i*3);sizes[i]=3.2;}
    else{
      const a=random()*Math.PI*2,y=.025+random()*.975,r=Math.sqrt(1-y*y);
      pos.set([Math.sin(a)*r*5000,y*5000,-Math.cos(a)*r*5000],i*3);
      sizes[i]=.75+Math.pow(random(),9)*2.7;
    }
    seeds[i]=random()*100;
    const warm=random();colors.set(warm<.18?[1,.76,.55]:warm>.7?[.62,.78,1]:[.87,.91,1],i*3);
  }
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  starGeo.setAttribute('size',new THREE.BufferAttribute(sizes,1));starGeo.setAttribute('seed',new THREE.BufferAttribute(seeds,1));starGeo.setAttribute('starColor',new THREE.BufferAttribute(colors,3));
  const starMaterial=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{...fog.uniforms,time:clock,ratio},
    vertexShader:`attribute float size,seed;attribute vec3 starColor;uniform float time,ratio;
      varying vec3 color;varying float alpha;
      ${PLAYER_FOG_GLSL}
      void main(){
        color=starColor;vec3 dir=normalize(position);
        alpha=(.72+.28*sin(time*.32+seed))*exp(-castleFogOpticalDepth(cameraPosition,cameraPosition+dir*220.));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w*.99999;
        gl_PointSize=size*ratio;
      }`,
    fragmentShader:`varying vec3 color;varying float alpha;void main(){
      float d=length(gl_PointCoord-.5);float glow=exp(-d*d*24.)*(1.-smoothstep(.28,.5,d));
      gl_FragColor=vec4(color,glow*alpha);
      #include <colorspace_fragment>
    }`,
  });
  const stars=new THREE.Points(starGeo,starMaterial);stars.frustumCulled=false;stars.renderOrder=-98;
  stars.userData.celestial=true;group.add(stars);

  const lines:number[]=[];
  for(const c of CONSTELLATIONS)for(const [a,b]of c.edges){
    const start=c.points[a]!,end=c.points[b]!;
    lines.push(...direction(start[0],start[1]),...direction(end[0],end[1]));
  }
  const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  const lineMesh=new THREE.LineSegments(lineGeo,new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:fog.uniforms,
    vertexShader:`varying float transmission;
      ${PLAYER_FOG_GLSL}
      void main(){vec3 dir=normalize(position);transmission=exp(-castleFogOpticalDepth(cameraPosition,cameraPosition+dir*220.));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w*.99999;}`,
    fragmentShader:'varying float transmission;void main(){gl_FragColor=vec4(.37,.49,.7,.15*transmission);}',
  }));
  lineMesh.frustumCulled=false;lineMesh.renderOrder=-99;group.add(lineMesh);
  return {
    group,
    update(seconds:number,pixelRatio:number,cameraPosition:THREE.Vector3){clock.value=still?0:seconds;ratio.value=pixelRatio;group.position.copy(cameraPosition);},
    setLow(){still=true;detail.value=.45;clock.value=0;starGeo.setDrawRange(0,Math.min(count,nodes.length+nightStarBudget('low')));},
    get diagnostics(){return {stars:starGeo.drawRange.count===Infinity?count:starGeo.drawRange.count,constellations:CONSTELLATIONS.length,galaxies:2,draws:3,animated:!still};},
  };
}
