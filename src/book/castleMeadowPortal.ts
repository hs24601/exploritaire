import * as THREE from 'three';
import {CASTLE, SURFACE} from './castleLayout';
import {seeded} from './castlePaint';
import {createMeadowPortalParticles} from './meadowPortalParticles';

const width = 4.4, height = 7, radius = width/2;
const edge = .27;
const approachDistance = 15*.3048;
const turnAround = new THREE.Matrix4().makeRotationY(Math.PI);
export const KEEP_MEADOW_DOOR = {
  x: CASTLE.keep.x + CASTLE.keep.half/Math.SQRT2,
  y: SURFACE.paving,
  z: CASTLE.keep.z + CASTLE.keep.half/Math.SQRT2,
  yaw: Math.PI/4,
};

const vertexShader = /* glsl */`
  varying vec2 doorPoint;
  varying vec3 eye;
  varying vec4 screen;
  void main() {
    doorPoint = position.xy;
    eye = (inverse(modelMatrix) * vec4(cameraPosition, 1.)).xyz - position;
    screen = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    gl_Position = screen;
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D viewTexture;
  uniform vec4 crop;
  uniform vec2 texel;
  uniform float hasView, foil, sealed, pulseAge, pulseDirection, card;
  varying vec2 doorPoint;
  varying vec3 eye;
  varying vec4 screen;

  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float arch(vec2 p) {
    if(card>.5){vec2 q=abs(p-vec2(0.,3.423))-vec2(2.04,2.913);return length(max(q,0.))+min(max(q.x,q.y),0.)-.16;}
    return max(length(vec2(p.x, max(p.y-4.8,0.))) - 2.2, -p.y);
  }
  // The grating equation samples first-order reflection across three bands.
  vec3 grating(float across, float period, float spread) {
    vec3 delta = (abs(across) - vec3(.67,.54,.44)/period) / spread;
    return exp(-delta*delta);
  }
  vec3 foilCells(vec2 p, vec3 view) {
    vec2 q=p*3.25, origin=floor(q), id=origin;
    float first=9., second=9.;
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
      vec2 c=origin+vec2(float(x),float(y));
      vec2 seed=c+.13+.74*vec2(hash(c),hash(c+vec2(23.,3.)));
      float d=length(q-seed);
      if(d<first) { second=first; first=d; id=c; }
      else second=min(second,d);
    }
    float theta=hash(id+11.)*6.2831853;
    vec2 grooves=vec2(cos(theta),sin(theta));
    float bevel=smoothstep(.025,.23,second-first);
    vec3 n=normalize(vec3((vec2(hash(id+4.),hash(id+31.))-.5)*(.43-.19*bevel),1.));
    vec3 lamp=normalize(vec3(-.54,.78,.68));
    vec3 reflected=reflect(-lamp,n);
    float shine=pow(max(0.,dot(view,reflected)),13.);
    float period=1.04+hash(id+81.)*.7;
    vec3 spectrum=grating(dot((view+lamp).xy,grooves),period,.108);
    vec3 metal=mix(vec3(.065,.11,.16),vec3(.37,.55,.57),hash(id+54.));
    return (metal+1.05*spectrum+shine*vec3(.78,.92,1.))*(.20+.80*bevel);
  }
  void main() {
    vec2 p=doorPoint;
    float border=arch(p);
    float aa=clamp(fwidth(border),.005,.07);
    if (border > .245) discard;
    vec3 dark=vec3(.00016,.00020,.00031);
    if (sealed>=.999) {
      gl_FragColor=vec4(dark,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      return;
    }
    vec3 v=normalize(eye);
    vec2 uv=((screen.xy/screen.w)*.5+.5-crop.xy)/crop.zw;
    vec2 d=p-vec2(0.,1.12);
    float r=length(d), ring=r-pulseAge*5.4;
    float wake=exp(-ring*ring*5.-pulseAge*2.5)*step(0.,pulseAge);
    float wave=cos(ring*15.)*wake;
    vec2 offset=d/max(r,.01)*wave*.018*pulseDirection;
    vec2 angle=vec2(v.x+.12,v.y-.06);
    vec2 prism=angle/max(length(angle),.035)*(.0013+foil*.0016);
    prism+=offset*.32;
    vec2 at=clamp(uv+offset,texel,1.-texel);
    vec3 forest=vec3(texture2D(viewTexture,clamp(at+prism,texel,1.-texel)).r,
      texture2D(viewTexture,at).g,texture2D(viewTexture,clamp(at-prism,texel,1.-texel)).b);
    forest=mix(vec3(.018,.025,.032),forest,hasView);
    float fresnel=pow(1.-max(0.,v.z),4.);
    vec3 film=grating(dot((v+vec3(-.32,.44,.72)).xy,vec2(.93,.37)),
      1.30+.14*p.y/7.,.094);
    vec3 frost=vec3(.24,.75,1.);
    forest=forest*(.81+.19*smoothstep(0.,.35,-border)) +
      (fresnel*.22+exp(-abs(border)*16.)*(.07+.19*foil))*frost +
      film*(.035+.095*foil) + wake*frost*(.27+.28*wave);
    vec3 frame=vec3(.10,.14,.16);
    if (foil>0. && border>-.1-aa) frame=mix(frame,foilCells(p,v),foil);
    frame+=frost*wake*.55;
    vec3 lit=mix(forest,frame,smoothstep(-.10-aa,-.10+aa,border));
    gl_FragColor=vec4(mix(lit,dark,sealed),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type Door = {x: number; y: number; z: number; yaw: number};

function createDoorFog(sealed: {value:number},time: {value:number},low: boolean) {
  const quad = new THREE.PlaneGeometry(1,1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',quad.attributes.position);
  geometry.setIndex(quad.index);
  const random = seeded(11839);
  geometry.instanceCount = low ? 10 : 18;
  geometry.setAttribute('aFogSeed',new THREE.InstancedBufferAttribute(Float32Array.from(
    {length:geometry.instanceCount*3},()=>random(),
  ),3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,2.6,2.7),8);
  quad.dispose();
  const fog = new THREE.Mesh(geometry,new THREE.ShaderMaterial({
    uniforms:{sealed,time},transparent:true,depthWrite:false,
    vertexShader:/* glsl */`
      attribute vec3 aFogSeed;
      uniform float sealed,time;
      varying vec2 puff;
      varying float opacity,seed;
      void main() {
        seed=aFogSeed.z;
        float age=fract(aFogSeed.x+time*(.105+.072*seed));
        float curl=sin(aFogSeed.x*12.+age*3.8);
        vec3 p=vec3((aFogSeed.y-.5)*3.25+curl*age*1.35,
          mix(.24+4.45*seed*seed,.48+seed*.68,age*.86)+curl*.22*age,
          .10+age*5.7);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        mv.xy+=position.xy*vec2(1.65+age*4.4,1.35+age*2.35);
        puff=position.xy*2.;
        opacity=sealed*smoothstep(0.,.12,age)*(1.-smoothstep(.46,1.,age))*(.52+seed*.20);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:/* glsl */`
      uniform float time;
      varying vec2 puff;
      varying float opacity,seed;
      float hash(vec2 p) {return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p) {
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
          mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
      }
      void main() {
        vec2 p=puff*2.8+seed*13.;
        float curl=noise(p+vec2(time*.18,-time*.12));
        float billow=.67*curl+.33*noise(p*2.05+curl*1.5+time*.09);
        float edge=1.-smoothstep(.20,1.,length(puff)+.31*(.5-billow));
        float alpha=opacity*edge*smoothstep(.15,.68,billow);
        gl_FragColor=vec4(mix(vec3(.0016,.002,.0032),vec3(.007,.009,.016),billow),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  fog.name = 'Dark fog at the meadow entrance';
  fog.renderOrder = 2;
  return fog;
}

export class MeadowPortalEnd {
  static readonly approach = .66;
  readonly group = new THREE.Group();
  readonly normal: THREE.Vector3;
  readonly plane: THREE.Plane;
  readonly aperture: THREE.Mesh;
  readonly uniforms = {
    viewTexture: {value: null as THREE.Texture | null}, hasView: {value: 0},
    crop: {value: new THREE.Vector4(0,0,1,1)}, texel: {value: new THREE.Vector2(.01,.01)},
    foil: {value: 0}, sealed: {value: 0}, pulseAge: {value: -1}, pulseDirection: {value: 1},
    card: {value:0},
  };
  private readonly fog?: THREE.Mesh;
  private readonly fogTime = {value:0};
  private readonly dust: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly glow = new THREE.PointLight('#83d6ff', 0, 8, 2);
  private pulseStart = -Infinity;

  constructor(readonly scene: THREE.Scene, readonly door: Door, reduced: boolean, low: boolean, shrouded = false, readonly cardTitle?:string) {
    this.uniforms.card.value=cardTitle?1:0;
    this.group.position.set(door.x,door.y,door.z);
    this.group.rotation.y = door.yaw;
    this.normal = new THREE.Vector3(Math.sin(door.yaw),0,Math.cos(door.yaw));
    this.plane = new THREE.Plane().setFromNormalAndCoplanarPoint(this.normal,this.group.position);
    const panel = new THREE.PlaneGeometry(width+2*edge,height+edge+.02).translate(0,(height+edge-.02)/2,.032);
    this.aperture = new THREE.Mesh(panel,new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:this.uniforms,side:cardTitle?THREE.DoubleSide:THREE.FrontSide}));
    this.aperture.name = cardTitle?`${cardTitle} portal card`:'Sacred Forest Meadow portal';
    this.group.add(this.aperture);
    if(cardTitle){
      this.group.name=`Stationary portal card — ${cardTitle}`;
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
      const ctx=canvas.getContext('2d')!;ctx.fillStyle='#0c202ced';ctx.fillRect(0,0,1024,128);ctx.strokeStyle='#b7e2dc';ctx.lineWidth=3;ctx.strokeRect(4,4,1016,120);ctx.fillStyle='#e4f5e2';ctx.font='bold 55px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(cardTitle,512,64,980);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const label=new THREE.Mesh(new THREE.PlaneGeometry(4.05,.51),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));label.position.set(0,6.15,.06);label.name='Portal card destination';this.group.add(label);
      this.group.userData.skipWaterReflection=true;
    }
    if (shrouded) {
      this.uniforms.sealed.value = 1;
      this.fog = createDoorFog(this.uniforms.sealed,this.fogTime,low);
      this.group.add(this.fog);
    }
    this.glow.position.set(0,1.4,.65);
    if(!cardTitle)this.group.add(this.glow);
    this.dust=createMeadowPortalParticles(this.uniforms.pulseAge,this.uniforms.pulseDirection,reduced?0:low?32:82);
    this.group.add(this.dust);
    scene.add(this.group);
    this.group.updateMatrixWorld(true);
  }

  point(depth: number, lateral = 0) {
    return {x:this.door.x+this.normal.x*depth+this.normal.z*lateral,
      z:this.door.z+this.normal.z*depth-this.normal.x*lateral};
  }

  lateral(x: number,z: number) {
    return (x-this.door.x)*this.normal.z-(z-this.door.z)*this.normal.x;
  }

  contains(point: THREE.Vector3) {
    const y = point.y-this.door.y;
    if(this.cardTitle)return y>=.35&&y<=6.496&&Math.abs(this.lateral(point.x,point.z))<=radius+edge;
    return y>=0 && Math.hypot(this.lateral(point.x,point.z),Math.max(0,y-(height-radius))) <= radius+edge;
  }

  distance(x: number,z: number) {
    return (x-this.door.x)*this.normal.x+(z-this.door.z)*this.normal.z;
  }

  mapTo(destination: MeadowPortalEnd, transform: THREE.Matrix4) {
    return transform.copy(this.group.matrixWorld).invert().premultiply(turnAround)
      .premultiply(destination.group.matrixWorld);
  }

  canCross(hero: {x:number;z:number;y:number;vx:number;vz:number}, routed: boolean) {
    if(!routed)return false;
    const depth = this.distance(hero.x,hero.z);
    return Math.abs(depth) < .90 && Math.abs(this.lateral(hero.x,hero.z)) < radius-CASTLE.heroRadius
      && this.fitsHeroHeight(hero.y);
  }

  fitsHeroHeight(feet:number){
    return feet>=this.door.y-.9&&feet<this.door.y+(this.cardTitle?6.0:3.5);
  }

  flash(t: number, direction: number) {
    this.pulseStart = t;
    this.uniforms.pulseDirection.value = direction;
  }

  update(t: number, x: number,z: number, reduced: boolean) {
    const range = Math.hypot(x-this.door.x,z-this.door.z);
    this.uniforms.foil.value = 1-THREE.MathUtils.smoothstep(range,approachDistance-.7,approachDistance);
    if (this.fog) {
      this.uniforms.sealed.value = 1-THREE.MathUtils.smoothstep(this.uniforms.foil.value,0,.85);
      this.fogTime.value = reduced ? 0 : t;
      this.fog.visible = this.uniforms.sealed.value>.001;
    }
    const age = t-this.pulseStart;
    this.uniforms.pulseAge.value = age < 2 && !reduced ? age : -1;
    this.dust.visible = this.uniforms.pulseAge.value >= 0;
    this.glow.intensity = this.cardTitle?0:this.uniforms.foil.value*2.5 + (this.dust.visible ? 17*Math.exp(-age*4) : 0);
  }
}

/** Air through the membrane and a short run of glass tones. Unlock from the
 * player's input; the actual cue stays synchronized to the threshold. */
export function createMeadowPortalSound() {
  let context: AudioContext | undefined;
  let noise: AudioBuffer | undefined;
  return {
    unlock() {
      if (!globalThis.AudioContext) return;
      context ??= new AudioContext();
      if (context.state==='suspended') void context.resume().catch(() => {});
    },
    play(entering: boolean) {
      const audio = context;
      if (audio?.state!=='running') return;
      const now = audio.currentTime;
      if (!noise) {
        noise = audio.createBuffer(1,audio.sampleRate,audio.sampleRate);
        const values = noise.getChannelData(0), random = seeded(83);
        for (let i=0;i<values.length;i++) values[i] = random()*2-1;
      }
      const air = audio.createBufferSource(), band = audio.createBiquadFilter(), swell = audio.createGain();
      air.buffer = noise;
      band.type = 'bandpass'; band.Q.value = 1.15;
      band.frequency.setValueAtTime(entering ? 290 : 2250,now);
      band.frequency.exponentialRampToValueAtTime(entering ? 2250 : 290,now+.62);
      swell.gain.setValueAtTime(0,now);
      swell.gain.linearRampToValueAtTime(.062,now+.28);
      swell.gain.linearRampToValueAtTime(0,now+.78);
      air.connect(band).connect(swell).connect(audio.destination);
      air.start(now); air.stop(now+.8);
      const tones = [587.33,739.99,880,1108.73,1318.51];
      if (!entering) tones.reverse();
      tones.forEach((frequency,index) => {
        const start = now+.17+index*.085;
        const tone = audio.createOscillator(), envelope = audio.createGain();
        tone.type = 'sine'; tone.frequency.value = frequency;
        envelope.gain.setValueAtTime(.0001,start);
        envelope.gain.exponentialRampToValueAtTime(.020,start+.015);
        envelope.gain.exponentialRampToValueAtTime(.0001,start+.62);
        tone.connect(envelope).connect(audio.destination);
        tone.start(start); tone.stop(start+.63);
      });
    },
  };
}

/** A paired-camera window. Crop the offscreen pass to the projected arch and
 * map the result back in screen space, so looking sideways reveals real depth. */
export function createMeadowPortalView(quality: string) {
  const target = new THREE.WebGLRenderTarget(1,1);
  const camera = new THREE.PerspectiveCamera(), drawing = new THREE.Vector2();
  const clip = new THREE.Vector3(), transform = new THREE.Matrix4();
  const size = {width:1,height:1};
  const cachedWorld = new THREE.Matrix4(), cachedProjection = new THREE.Matrix4();
  const cachedDrawing = new THREE.Vector2();
  let cachedSource: MeadowPortalEnd | undefined;
  let cachedFrame = -1;
  let low = quality === 'low';
  return {
    setLow() { low = true; cachedSource = undefined; },
    render(renderer: THREE.WebGLRenderer, view: THREE.PerspectiveCamera,
      source: MeadowPortalEnd, destination: MeadowPortalEnd, destinationFrame?: number) {
      const u = source.uniforms;
      u.hasView.value = 0;
      if (u.sealed.value>=.999) return;
      if (source.distance(view.position.x,view.position.z) < .045 ||
        view.position.distanceToSquared(source.group.position)>48**2) return;
      view.updateMatrixWorld();
      renderer.getDrawingBufferSize(drawing);
      if (destinationFrame!==undefined && cachedFrame===destinationFrame && cachedSource===source && drawing.equals(cachedDrawing)
        && view.matrixWorld.equals(cachedWorld) && view.projectionMatrix.equals(cachedProjection)) {
        u.hasView.value = 1;
        return;
      }
      let x0 = 1, y0 = 1, x1 = 0, y1 = 0, frontCorners = 0;
      for (const x of [-radius-edge,radius+edge]) for (const y of [-.02,height+edge]) {
        clip.set(x,y,.032).applyMatrix4(source.group.matrixWorld).applyMatrix4(view.matrixWorldInverse);
        if (clip.z >= -view.near) { x0 = y0 = 0; x1 = y1 = 1; }
        else {
          frontCorners++;
          clip.applyMatrix4(view.projectionMatrix).multiplyScalar(.5).addScalar(.5);
          x0 = Math.min(x0,clip.x); y0 = Math.min(y0,clip.y);
          x1 = Math.max(x1,clip.x); y1 = Math.max(y1,clip.y);
        }
      }
      if (!frontCorners) return;
      const left = Math.max(0, Math.floor((x0-.025)*drawing.x));
      const right = Math.min(drawing.x, Math.ceil((x1+.025)*drawing.x));
      const bottom = Math.max(0, Math.floor((y0-.025)*drawing.y));
      const top = Math.min(drawing.y, Math.ceil((y1+.025)*drawing.y));
      if (right-left < 3 || top-bottom < 3) return;
      const viewWidth = right-left, viewHeight = top-bottom;
      const budget = low ? 416 : 768;
      const scale = Math.min(low ? .55 : .86,budget/Math.max(viewWidth,viewHeight));
      size.width = Math.ceil(viewWidth*scale/32)*32;
      size.height = Math.ceil(viewHeight*scale/32)*32;
      target.setSize(size.width,size.height);
      source.mapTo(destination,transform);
      camera.copy(view,false);
      camera.matrixWorld.multiplyMatrices(transform,view.matrixWorld);
      camera.matrixWorld.decompose(camera.position,camera.quaternion,camera.scale);
      camera.near = .06;
      camera.setViewOffset(drawing.x,drawing.y,left,drawing.y-top,viewWidth,viewHeight);
      camera.updateMatrixWorld(true);
      u.crop.value.set(left/drawing.x,bottom/drawing.y,viewWidth/drawing.x,viewHeight/drawing.y);
      u.texel.value.set(.5/size.width,.5/size.height);
      u.viewTexture.value = target.texture;
      cachedSource = undefined;
      const previous = renderer.getRenderTarget(), clipping = renderer.clippingPlanes;
      const shadow = renderer.shadowMap.needsUpdate;
      const visible = destination.group.visible;
      destination.group.visible = false;
      try {
        renderer.clippingPlanes = [destination.plane];
        renderer.shadowMap.needsUpdate = false;
        renderer.setRenderTarget(target);
        renderer.render(destination.scene,camera);
        u.hasView.value = 1;
        if (destinationFrame!==undefined) {
          cachedSource = source; cachedFrame = destinationFrame; cachedDrawing.copy(drawing);
          cachedWorld.copy(view.matrixWorld); cachedProjection.copy(view.projectionMatrix);
        }
      } finally {
        destination.group.visible = visible;
        renderer.clippingPlanes = clipping;
        renderer.shadowMap.needsUpdate = shadow;
        renderer.setRenderTarget(previous);
      }
    },
  };
}
