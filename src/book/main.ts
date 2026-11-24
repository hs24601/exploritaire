import {createStarSky} from './starSky';
import {stowPopup} from './popupStow';
import {createBookLoading,nextBookPaint} from './bookLoading';
import {popupLightAt,type ForestRevealSite} from './perimeterWave';
import {ProximityPaint} from './proximityPaint';
import {extensionWaveTrees} from './pageExtension';
import {createForegroundFlap} from './foregroundFlap';
import {createRadialPopup} from './radialPopup';
import {TurnPopups} from './turnPopups';
import {createForestLights} from './forestFilm';
import {createBookMagic,magicPopupOpen,magicPhase} from './bookMagic';
import {forestPaintProgress,forestPaintBehind} from './forestPaint';
import {isWoodland,woodlandPaintEnd,woodlandVisualTime,woodlandClose,heroMoment} from './heroWoodland';
import {createForestPaintSparkles} from './forestPaintSparkles';
import {createForestAtmosphere,forestFog} from './forestAtmosphere';
import {createStandGroundPaint} from './standGroundPaint';
import {isWoodlandCharacter} from './mochiWoodland';
import {createTreePerchPopup} from './treePerchPopup';
import {createPageExtension} from './pageExtension';
import {presentBookFrame} from './bootPresentation';
import {sampleCoverPresentation,BOOK_PAGE_FRAME} from './coverPresentation';
import {createBookPaper} from './bookPaper';
import {createBookViewport} from './viewportPolicy';
import {createBookPaint} from './pagePaint';
import {validPaintCue} from './paintTimeline';
import {setSceneIcon} from './sceneIcons';
import {createBookFramingTools} from './framingTools';
import { createBookPageRuntime } from './pageRuntime';
import { createBookPageEditor } from './pageEditor';
import { createBookAtmosphere } from './bookAtmosphere';
import { DEFAULT_BOOK_ATMOSPHERE, DEFAULT_POPUP } from './pageDocument';
import { createBookCameraNotebook } from './cameraNotebook';
import { applyBookShot,interpolateBookShot,captureBookCamera,type BookCameraShot,type BookCameraStep } from './bookCamera';
import { createGroundReliefBatches } from './groundReliefBatch';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paintedPopupGeometry } from './paintedPopupGeometry';
import { createKirigamiPine, paperCutCanvas } from './kirigamiPine';
import { createPopupVFold } from './popupVFold';
import {createDenPopup} from './woodlandPopup';
import { createBookCraft } from './bookCraft';
import { createBookStoryPresentation } from './storyPresentation';
import { PageFoldPacking } from './foldPacking';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BOOK_SCENES, DEN_INTERIOR_INDEX, HERO_ART, HERO_BOOK_FRAME, type PaperProp } from './scenes';
import './book.css';
import { createTableauGroundCover } from '../proto/tableauGroundCover';
import { bookmarkTexture, pagePlane, storyTexture, MAP_STOPS } from './pageArt';
import { MAP_INDEX, planJourney, type Journey } from './journey';
import { pageEdgeAt } from './pageEdges';
import { FlatPageBaker, turningFaces } from './pageBake';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = document.querySelector('canvas')!;
const bookLoading=createBookLoading();
const fold = el<HTMLButtonElement>('fold'), action = el<HTMLButtonElement>('scene-action');
const mapButton = el<HTMLButtonElement>('map-bookmark'), returnButton = el<HTMLButtonElement>('return-bookmark');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const ease = (t: number) => t*t*(3-2*t);
const COVER_OPEN_DURATION_MS=4200;
// Broad, uneven stone facets: shared anchors keep adjacent panels coherent,
// while independent inner/outer profiles prevent concentric ribbon silhouettes.
function rockContour(t:number,inner=false){
  const profile=inner ? [0,.25,-.6,-.2,.75,.45,-.35,-.7,.2,.65,-.15,-.5,.35,.1,0] : [0,.6,.15,-.4,.35,.9,.1,-.55,-.2,.8,.3,-.4,.55,.15,0];
  const p=t*(profile.length-1),a=Math.min(profile.length-2,Math.floor(p));return THREE.MathUtils.lerp(profile[a],profile[a+1],p-a);
}
const requestedPage=location.pathname.endsWith('/portals.html')?1111:Number(new URLSearchParams(location.search).get('page') ?? 1);
const initialIndex=Number.isInteger(requestedPage)&&requestedPage>=0&&requestedPage<=MAP_INDEX+1 ? requestedPage-1 : 0;

async function start() {
  let assetsReady=false,preparing=false,hasPlayedFilm=false,builtPopups=0;let preparationTask:Promise<void>|undefined;const warmedPages=new Set<number>();
  canvas.addEventListener('keydown',event=>{if(!assetsReady){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const viewport=createBookViewport(renderer,canvas);
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor('#171d21'); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const bookPaper=createBookPaper(renderer,undefined,matchMedia('(max-width:700px)').matches?768:1024);canvas.dataset.paperProfile=bookPaper.profile;
  const world = new THREE.Scene();
  const turnPopups=new TurnPopups(world),perimeterPaint=new ProximityPaint();
  let forestTreelineSites:ForestRevealSite[]=[],forestRevealSites:ForestRevealSite[]=[],perimeterReleaseAt:number|undefined,perimeterReleaseAge=0;
  const forestActivation=(x:number,_y:number,z:number)=>perimeterPaint.lightAt(x,z)*(perimeterReleaseAt===undefined?popupLightAt(forestTreelineSites,x,z):1);
  const forestLights=createForestLights(world);
  const mochiPortraitLight=new THREE.PointLight('#ffe7c6',0,5,2);mochiPortraitLight.name='mochi-painted-portrait-fill';world.add(mochiPortraitLight);
  const forestWeather=createForestAtmosphere(world),starSky=createStarSky(world);
  const paintSparkles=createForestPaintSparkles(world);
  const groundPaint=createStandGroundPaint(renderer);
  const bookBody=new THREE.Group();world.add(bookBody);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true; orbit.minDistance = 11/4; orbit.maxDistance = 26;
  orbit.minPolarAngle = 0; orbit.maxPolarAngle = Math.PI/2+.6;
  // Multi-sided paper pop-ups support unrestricted manual yaw for shot authoring.
  orbit.minAzimuthAngle = -Infinity; orbit.maxAzimuthAngle = Infinity;
  orbit.mouseButtons.LEFT = null; orbit.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE; orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  const views = [new THREE.Vector3(-.7,10.4,12.3),new THREE.Vector3(.8,10.9,12.2),new THREE.Vector3(-.7,11.2,12.4),new THREE.Vector3(0,3.4,12.2),new THREE.Vector3(0,13.9,10.7)];
  views[-1]=new THREE.Vector3(2.95,11.8,13);
  function reset() { camera.up.set(0,1,0);camera.position.copy(views[Number(canvas.dataset.sceneIndex ?? initialIndex)]); orbit.target.set(Number(canvas.dataset.sceneIndex ?? initialIndex)===-1?2.95:0,Number(canvas.dataset.sceneIndex ?? initialIndex)===DEN_INTERIOR_INDEX?.8:.2,0); orbit.update(); }
  reset(); el('reset').onclick = () => {cameraNotebook.stop();releaseShotBook();denCameraActive=false;if(coverTurn)coverTurn.cinematic=false;if(transition){transition.cinematic=false;orbit.enabled=true;}reset();};
  const fill = new THREE.HemisphereLight(0xfff5e6, 0x536c77, 1.4);world.add(fill);
  const key = new THREE.DirectionalLight(0xfff1db, 1.6); key.position.set(-4,10,5);
  key.castShadow = true; key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera, { left:-9,right:9,top:7,bottom:-7,near:.1,far:30 });
  key.shadow.normalBias = .035; world.add(key);
  const local = new THREE.PointLight(0xffbc63, 20, 9, 2); local.position.set(2,1.5,1.3); world.add(local);
  // Leather and gold boards, a page block that shows its leaves, and card cut-outs.
  const craft=createBookCraft(renderer);craft.lightCards(key,local);
  function box(w:number,h:number,d:number,color:string,x=0,y=0,z=0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:1}));
    mesh.position.set(x,y,z); mesh.receiveShadow=true; mesh.castShadow=true; (w>100?world:bookBody).add(mesh); return mesh;
  }
  const surround=box(200,.3,200,'#202b2d',0,-.8);surround.userData.bookSurround=true;(surround.material as THREE.Material).transparent=true;
  box(12.1,.2,7.9,'#354c43',0,-.37).material=craft.leather(2);
  box(12,.055,7.8,'#b69c65',0,-.24);
  for (const side of [-1,1]) {
    const block=craft.pageBlock(5.8,.28,7.5);block.position.set(side*2.95,-.07,0);block.castShadow=block.receiveShadow=true;bookBody.add(block);
    const sheet=box(5.8,.04,7.5,'#ffffff',side*2.95,.09);sheet.material.map=side===-1?bookPaper.left:bookPaper.right;sheet.userData.bookPaper=true;
  }
  box(.09,.045,7.5,'#a58b62',0,.12);
  const edgeGlow = new THREE.Mesh(new THREE.PlaneGeometry(.7, 7.4), new THREE.MeshBasicMaterial({color:'#c5a468',transparent:true,opacity:.17,depthWrite:false}));
  edgeGlow.rotation.x=-Math.PI/2;edgeGlow.position.y=.16;edgeGlow.visible=false;world.add(edgeGlow);
  // Physical side ribbons; projected transparent buttons provide touch/keyboard hit areas.
  const mapRibbon = pagePlane(bookmarkTexture('map','#416b63'),2.4,.64,6.15,-1.6);mapRibbon.position.y=-.14;world.add(mapRibbon);
  const returnRibbon = pagePlane(bookmarkTexture('⌂','#a4503b'),2.4,.64,7.9,.1);returnRibbon.visible=false;world.add(returnRibbon);
  // The front cover is a physical hinged board over a closed right-hand stack.
  const coverGroup=new THREE.Group();world.add(coverGroup);
  for(const [height,y] of [[.12,-.3],[.28,-.08]] as const){const mesh=height===.28?craft.pageBlock(6.05,height,7.85):new THREE.Mesh(new THREE.BoxGeometry(6.05,height,7.85),craft.leather(2));mesh.position.set(2.95,y,0);mesh.castShadow=true;mesh.receiveShadow=true;coverGroup.add(mesh);}
  {const r=.29,spine=craft.spine(r,7.85);spine.position.set(-.07,-.078,0);spine.scale.x=.35;coverGroup.add(spine);}
  const coverHinge=new THREE.Group();coverHinge.position.y=.16;coverGroup.add(coverHinge);
  const lid=new THREE.Mesh(new THREE.BoxGeometry(6.05,.09,7.85),craft.leather(2));lid.userData.bookPaper=true;lid.position.x=2.95;lid.castShadow=true;coverHinge.add(lid);
  const coverPrint=craft.cover(6.05,7.85);coverPrint.position.set(2.95,.0455,0);coverPrint.userData.bookPaper=true;coverHinge.add(coverPrint);
  for(const [id,text,z,height,font] of [['title',"Hero's Journey",-2.3,.7,34],['subtitle','The adventure of a very good girl.',-1.7,.45,17],['footer','A story waiting to unfold',2.6,.5,18]] as const){const prose=pagePlane(storyTexture(text,0),5.15,height,2.95,z);prose.position.y=.055;Object.assign(prose.userData,{bookStory:true,storyId:'cover:'+id,storyName:id,storyAnchor:prose.position.toArray(),storyHeight:height,storyText:text,storyFont:font,storyColor:'#eddbac',storyPaperOpacity:0,storyAlign:'center'});coverHinge.add(prose);}
  const coverMagic=createBookMagic(world,coverHinge,[coverPrint,lid]);
  const coverTextVisibility=new Map<THREE.Object3D,boolean>();
  coverGroup.visible=initialIndex===-1;bookBody.visible=initialIndex!==-1;
  const manager=new THREE.LoadingManager();manager.onProgress=(_url,done,total)=>bookLoading.report(.6*done/Math.max(1,total),'Loading artwork',done,total);
  const loader = new THREE.TextureLoader(manager);
  const paths = [...new Set([HERO_ART,'environment/watercolor/v1/dirt-ground-v1.png',...BOOK_SCENES.flatMap(s=>s.props.map(p=>p.art))])];
  const textures = new Map<string,THREE.CanvasTexture>(),paintLoads=new Map<string,Promise<THREE.CanvasTexture>>();
  function loadPaint(path:string):Promise<THREE.CanvasTexture>{const cached=textures.get(path);if(cached)return Promise.resolve(cached);const existing=paintLoads.get(path);if(existing)return existing;const pending=preparePaint(path);paintLoads.set(path,pending);pending.then(()=>paintLoads.delete(path),()=>paintLoads.delete(path));return pending;}
  async function preparePaint(path:string){
    const cached=textures.get(path);if(cached)return cached;
    const source = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/runtime/${path}`);
    // Trim transparent margins only, preserving the authored color and alpha.
    const image = source.image as HTMLImageElement;await image.decode();
    const c = document.createElement('canvas'); c.width=image.width; c.height=image.height;
    const ctx=c.getContext('2d')!; ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,c.width,c.height).data;
    const frame=path===HERO_ART?HERO_BOOK_FRAME:{x:0,y:0,width:c.width,height:c.height};
    let x0=frame.x+frame.width,y0=frame.y+frame.height,x1=frame.x,y1=frame.y;
    for(let y=frame.y;y<frame.y+frame.height;y++) for(let x=frame.x;x<frame.x+frame.width;x++) if(pixels[(y*c.width+x)*4+3]>12){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    const crop=document.createElement('canvas'); crop.width=Math.max(1,x1-x0+1);crop.height=Math.max(1,y1-y0+1);
    crop.getContext('2d')!.drawImage(c,x0,y0,crop.width,crop.height,0,0,crop.width,crop.height);
    const tex=new THREE.CanvasTexture(crop);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();tex.userData.sourceCrop={x:x0/image.width,y:y0/image.height,width:crop.width/image.width,height:crop.height/image.height};textures.set(path,tex);source.dispose();return tex;
  }
  await Promise.all(paths.map(loadPaint));
  const depthMaps=new Map<string,HTMLCanvasElement>();
  await Promise.all([['environment/watercolor/v1/pine-relief-v1.png','pine']].map(async([art,key])=>{
    const depth=await loader.loadAsync(import.meta.env.BASE_URL+'assets/runtime/labs/depth-relief/'+key+'-depth.png');
    const image=depth.image as HTMLImageElement,c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d')!.drawImage(image,0,0);depthMaps.set(art,c);depth.dispose();
  }));
  type Spread = { group:THREE.Group; hinges:THREE.Group[]; wings?:THREE.Group[]; packing?:PageFoldPacking; groundBatches?:ReturnType<typeof createGroundReliefBatches>; lastPose?:number; target?:THREE.Mesh; cave?:THREE.Group; hero?:THREE.Group; lightMark?:THREE.Mesh };
  const spreads:Spread[]=[];
  function prop(p:PaperProp,parent:THREE.Object3D) {
    const tex=textures.get(p.art)!;
    const hinge=new THREE.Group(); hinge.position.set(p.x,.15,p.z);hinge.rotation.y=p.yaw??0;parent.add(hinge);
    hinge.userData.paperHinge=true;hinge.userData.bookProp={art:p.art,id:p.id};hinge.rotation.order='YXZ';
    const material=new THREE.MeshStandardMaterial({map:tex,transparent:true,alphaTest:.06,side:THREE.DoubleSide,roughness:1});
    const mesh=new THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>(new THREE.PlaneGeometry(p.height*tex.image.width/tex.image.height,p.height),material);
    const estimate=depthMaps.get(p.art);if(estimate){mesh.geometry.dispose();mesh.geometry=paintedPopupGeometry(p.height*tex.image.width/tex.image.height,p.height,tex,estimate);mesh.userData.depthRelief=true;}
    mesh.position.y=p.height/2;mesh.castShadow=true;mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:tex,alphaTest:.06});hinge.add(mesh);
    craft.cardify(mesh,tex,p.height*tex.image.width/tex.image.height,p.height);
    return {hinge,mesh};
  }
  for(const [i,s] of BOOK_SCENES.entries()) {
    const group=new THREE.Group();world.add(group);group.visible=i===initialIndex;
    // Empty authoring bases omit all built-in scenery, prose, ground and markers.
    if(s.emptyBase){
      // Pop-ups on an empty spread come from the page document (kind 'popup').
      const baseHinges:THREE.Group[]=[];
      spreads.push({group,hinges:baseHinges,wings:[]});continue;}
    const hinges:THREE.Group[]=[], wings:THREE.Group[]=[]; let target!:THREE.Mesh; let cave:THREE.Group | undefined;
    for(const p of s.props){
      if(i===0 && p.art.includes('hero-den-front') && p.x===0) {
        // Two independently hinged halves meet at the gutter. Each samples its
        // original half of the painting, including in flattened page bakes.
        const tex=textures.get(p.art)!; const width=p.height*tex.image.width/tex.image.height;
        cave=new THREE.Group(); cave.position.set(0,.15,p.z); group.add(cave);
        for(const side of [-1,1]) {
          const hinge=new THREE.Group();hinge.userData.paperHinge=true;hinge.userData.bookProp={art:p.art};cave.add(hinge);hinges.push(hinge);
          const geo=new THREE.PlaneGeometry(width/2,p.height);const uv=geo.getAttribute('uv');
          for(let k=0;k<uv.count;k++) uv.setX(k,uv.getX(k)/2+(side===1?.5:0));
          const material=new THREE.MeshStandardMaterial({map:tex,transparent:true,alphaTest:.06,side:THREE.DoubleSide,roughness:1,emissive:0x8dd8e6,emissiveIntensity:0});
          const half=new THREE.Mesh(geo,material);half.position.set(side*width/4,p.height/2,0);half.castShadow=true;
          half.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:tex,alphaTest:.06});hinge.add(half);
        }
       } else if(p.kirigami) {
        // Kirigami pine: cut from the page, springs up, then folds into a V. Its cut stays on the page.
        const k=createKirigamiPine(textures.get(p.art)!,p.height),root=new THREE.Group();root.position.set(p.x,.15,p.z);root.rotation.y=p.yaw??0;group.add(root);
        k.hole.userData.controlOwner=p.id;k.hole.position.y=-.002;root.add(k.hole,k.hinge);k.hinge.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial&&o.material.side===THREE.FrontSide)craft.cardShader(o.material);});k.hinge.userData.paperHinge=true;k.hinge.userData.bookProp={art:p.art};hinges.push(k.hinge);
       } else {const made=prop(p,group);hinges.push(made.hinge);if(p.action)target=made.mesh;
        if(i===0&&p.art.includes('hero-den-front')){cave=new THREE.Group();cave.position.copy(made.hinge.position);group.add(cave);made.hinge.position.set(0,0,0);cave.add(made.hinge);}
      }
    }
    const hero=prop({id:'page-'+(i+1)+'-hero',art:HERO_ART,x:-.9,z:1.5,height:1.35},group);hinges.push(hero.hinge);
    hero.hinge.userData.hero=true;
    // Regions surround the authored story rectangles, so ground can occupy the
    // whole sheet without painting over prose, wherever the prose is placed.
    for(const side of [-1,1]) {
      const story=s.storyPlacement?.[side===-1?0:1] ?? {x:side*2.95,z:2.85,width:5.25,depth:1.38};
      const left=side===-1?-5.65:.25, right=side===-1?-.25:5.65;
      const x0=THREE.MathUtils.clamp(story.x-story.width/2-.08,left,right),x1=THREE.MathUtils.clamp(story.x+story.width/2+.08,left,right);
      const z0=THREE.MathUtils.clamp(story.z-story.depth/2-.08,-3.55,3.55),z1=THREE.MathUtils.clamp(story.z+story.depth/2+.08,-3.55,3.55);
      const regions=isWoodland(i)?[[left,right,-3.55,3.55]]:[[left,right,-3.55,z0],[left,right,z1,3.55],[left,x0,z0,z1],[x1,right,z0,z1]];
      for(const [minX,maxX,minZ,maxZ] of regions) {
        if(maxX-minX<.25||maxZ-minZ<.25)continue;
        const ground=new THREE.Group();ground.position.y=.125;group.add(ground);
        if(i===DEN_INTERIOR_INDEX&&!isWoodland(i)){const floor=pagePlane(textures.get('environment/watercolor/v1/dirt-ground-v1.png')!,maxX-minX,maxZ-minZ,(minX+maxX)/2,(minZ+maxZ)/2);floor.position.y=.002;floor.material.opacity=.65;ground.add(floor);}
        const cover=createTableauGroundCover(ground,false,i===DEN_INTERIOR_INDEX&&!isWoodland(i)?'dirt':'woodland',undefined,false,{minX,maxX,minZ,maxZ,islands:Math.max(3,Math.round((maxX-minX)*(maxZ-minZ)*3)),grassScale:.32,grass:i!==DEN_INTERIOR_INDEX||isWoodland(i)});
        for(const p of s.props) if(p.x>minX+.45&&p.x<maxX-.45&&p.z>minZ+.45&&p.z<maxZ-.45)cover.plant(p.x,p.z,.7,0);
        const coverGroup=ground.getObjectByName('tableau-ground-cover')!;
        for(const tuft of [...coverGroup.children]) if(tuft instanceof THREE.Mesh && tuft.rotation.x===0) {
          const hinge=new THREE.Group();hinge.position.set(tuft.position.x,tuft.position.y-tuft.scale.y*.47,tuft.position.z);hinge.rotation.y=tuft.rotation.y;
          coverGroup.add(hinge);tuft.position.set(0,tuft.scale.y*.47,0);tuft.rotation.y=0;hinge.add(tuft);hinge.userData.paperHinge=true;hinges.push(hinge);
        }
      }
      if(!isWoodland(i)){const prose=pagePlane(storyTexture(s.story[side===-1?0:1],i*2+(side===-1?1:2)),story.width,story.depth,story.x,story.z);
      prose.userData.bookStory=true;prose.userData.storyId=s.id+(side===-1?':left':':right');prose.userData.storyAnchor=prose.position.toArray();prose.userData.storyHeight=story.depth;prose.userData.storyText=s.story[side===-1?0:1];group.add(prose);}
    }
    if(i===DEN_INTERIOR_INDEX&&!isWoodland(i)) {
      // Fold-out leaves hinge at the page edge. Each carries separate, staggered
      // painted rock reliefs, including a second outer layer beyond the book.
      for(const side of [-1,1]) {
        const wing=new THREE.Group();wing.position.set(side*5.55,.145,-.35);wing.userData.paperWing=true;wing.userData.side=side;group.add(wing);wings.push(wing);
        const sheet=new THREE.Mesh(new THREE.PlaneGeometry(2.15,5.4),new THREE.MeshStandardMaterial({color:'#d2b991',roughness:1,side:THREE.DoubleSide}));
        sheet.rotation.x=-Math.PI/2;sheet.position.set(side*1.075,0,0);sheet.receiveShadow=true;wing.add(sheet);
        const floor=pagePlane(textures.get('environment/watercolor/v1/dirt-ground-v1.png')!,2.15,5.4,side*1.075,0);floor.position.y=.012;wing.add(floor);
        createTableauGroundCover(wing,false,'dirt',undefined,false,{minX:side===-1?-2.15:0,maxX:side===-1?0:2.15,minZ:-2.7,maxZ:2.7,islands:40,grass:false});
        // A second leaf is attached to the front crease of each side foldout.
        const forward=new THREE.Group();forward.position.set(side*1.075,.025,2.35);forward.userData.forwardLeaf=true;wing.add(forward);
        const frontFloor=pagePlane(textures.get('environment/watercolor/v1/dirt-ground-v1.png')!,2.15,2.2,0,1.1);frontFloor.position.y=0;forward.add(frontFloor);
        createTableauGroundCover(forward,false,'dirt',undefined,false,{minX:-1.07,maxX:1.07,minZ:0,maxZ:2.2,islands:22,grass:false});
        const frontRock=prop({id:'den-front-'+side,art:'environment/watercolor/v1/hero-den-front-quarter-v1.png',x:0,z:1.25,height:2.4,yaw:side*.3},forward);
        frontRock.mesh.scale.x=.55;frontRock.hinge.userData.popupDelay=.28;hinges.push(frontRock.hinge);
        // A continuous wall runs along each outer leaf. Its irregular crest and
        // overlapping arch ends avoid exposed rectangular texture boundaries.
        const rock=prop({id:'den-side-'+side,art:'environment/watercolor/v1/hero-den-front-quarter-v1.png',x:side*1.05,z:0,height:3.5,yaw:side*Math.PI/2},wing);
        const shape=new THREE.Shape();shape.moveTo(-2.75,0);shape.lineTo(-2.95,.7);shape.lineTo(-2.72,1.5);shape.lineTo(-2.85,2.35);
        for(let k=0;k<=20;k++){const x=-2.9+k*5.8/20;shape.lineTo(x,3.1+.22*Math.sin(k*1.7)+.12*Math.cos(k*2.4));}
        shape.lineTo(2.72,2.3);shape.lineTo(2.98,1.6);shape.lineTo(2.8,.65);shape.lineTo(2.6,0);shape.closePath();
        const geo=new THREE.ShapeGeometry(shape);const pos=geo.getAttribute('position'),uv=geo.getAttribute('uv');
        for(let k=0;k<pos.count;k++)uv.setXY(k,(pos.getX(k)+2.9)/5.8*.24+(side===1?.74:.02),pos.getY(k)/3.6);
        rock.mesh.geometry.dispose();rock.mesh.geometry=geo;rock.mesh.position.y=0;
        // The second leaf carries another wall section, rather than a small
        // duplicate cave entrance. It unfolds towards the foreground.
        frontRock.mesh.geometry.dispose();frontRock.mesh.geometry=geo.clone();frontRock.mesh.position.y=0;frontRock.mesh.scale.set(.48,.8,1);
        for(const relief of [rock.hinge,frontRock.hinge]){const parent=relief.parent!;const mount=new THREE.Group();mount.userData.paperMount=true;mount.position.copy(relief.position);parent.add(mount);relief.position.set(0,0,0);mount.add(relief);}
        rock.hinge.userData.popupDelay=.05;hinges.push(rock.hinge);
      }
      // A solid irregular rear relief closes the chamber behind the arches.
      const back=prop({id:'den-rear-wall',art:'environment/watercolor/v1/hero-den-front-quarter-v1.png',x:0,z:-3.18,height:4.5},group);
      const rear=new THREE.Shape();rear.moveTo(-7.3,0);for(let k=0;k<=40;k++){const t=k/40*Math.PI;rear.lineTo(-Math.cos(t)*7.3,Math.sin(t)*4.5*(1+.085*rockContour(k/40)));}rear.lineTo(7.3,0);rear.closePath();
      const rearGeo=new THREE.ShapeGeometry(rear),rp=rearGeo.getAttribute('position'),ru=rearGeo.getAttribute('uv');for(let k=0;k<rp.count;k++)ru.setXY(k,rp.getX(k)/14.6+.5,.68+rp.getY(k)/4.5*.3);
      back.mesh.geometry.dispose();back.mesh.geometry=rearGeo;back.mesh.position.y=0;back.hinge.userData.popupDelay=.34;hinges.push(back.hinge);
      for(const side of [-1,1])for(const [jointId,x,z,h] of [['rear',5.75,-2.65,2.1],['middle',6.25,-1.7,1.8],['front',5.3,.7,1.0]] as const){const joint=prop({id:'den-joint-'+side+'-'+jointId,art:'environment/watercolor/v1/stone-spill-v1.png',x:side*x,z,height:h},group);joint.hinge.userData.popupDelay=.18;hinges.push(joint.hinge);}
      // Nested, continuous arch cutouts surround a real opening. Every arch
      // overlaps the side walls; the interior is geometry rather than a rectangle.
      for(const [archId,depth,width,height,delay] of [['rear',-2.95,13.9,4.4,.3],['middle',-2.5,12.6,4.0,.22],['inner',-1.9,11.4,3.55,.14],['front',.7,14.4,4.15,.06]] as const){
        const rock=prop({id:'den-arch-'+archId,art:'environment/watercolor/v1/hero-den-front-quarter-v1.png',x:0,z:depth,height},group);
        const verts:number[]=[],uvs:number[]=[],indices:number[]=[];
        for(let k=0;k<=40;k++){
          const t=k/40*Math.PI;
          const jitter=1+.085*rockContour(k/40);
          const outerX=-Math.cos(t)*width/2*jitter,outerY=Math.sin(t)*height*jitter;
          const inside=1+.12*rockContour(k/40,true);
          const innerX=-Math.cos(t)*width*.36*inside,innerY=Math.sin(t)*height*.73*inside;
          verts.push(outerX,outerY,0,innerX,innerY,0);
          uvs.push(outerX/width+.5,outerY/height,innerX/width+.5,innerY/height);
          if(k<40){const n=k*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
        }
        const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
        rock.mesh.geometry.dispose();rock.mesh.geometry=geo;rock.mesh.position.y=0;rock.hinge.userData.popupDelay=delay;hinges.push(rock.hinge);
      }
    }
    // Page 01 scale study: preserve anchors, paper, ground washes and prose.
    if(i===0)for(const hinge of hinges)hinge.scale.multiplyScalar(.5);
    hinges.forEach((hinge,layer)=>{hinge.userData.flatLayer=layer*.003;hinge.userData.restY=hinge.position.y;});
    const ring=new THREE.Mesh(new THREE.RingGeometry(.36,.42,48),new THREE.MeshBasicMaterial({color:s.glow,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2; ring.position.copy(target.parent!.position);ring.position.y=.17;group.add(ring);
    ring.userData.interactionMarker=true;
    spreads.push({group,hinges,wings,target,cave,hero:hero.hinge,lightMark:ring});
  }
  const mapStory:[string,string]=['',''];
  // Flat ground pigment can share one draw per material and cover group.
  for(const spread of spreads)spread.group.traverse(object=>{if(object.name!=='tableau-ground-cover')return;
    const batches=new Map<THREE.Material,THREE.Mesh[]>();
    for(const child of object.children)if(child instanceof THREE.Mesh && child.rotation.x===-Math.PI/2 && !Array.isArray(child.material)){const batch=batches.get(child.material)??[];batch.push(child);batches.set(child.material,batch);}
    for(const [material,meshes] of batches){if(meshes.length<2)continue;const pieces=meshes.map(mesh=>{mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);});const geometry=mergeGeometries(pieces);pieces.forEach(piece=>piece.dispose());if(!geometry)continue;const merged=new THREE.Mesh(geometry,material);merged.renderOrder=meshes[0].renderOrder;object.add(merged);for(const mesh of meshes)object.remove(mesh);}
  });
  for(const spread of spreads){spread.packing=new PageFoldPacking(spread.group);spread.groundBatches=createGroundReliefBatches(spread.group);}
  const storyPresentation=createBookStoryPresentation(spreads.map(s=>s.group));
  // Future scene beats can switch a named story panel without a UI mode toggle.
  addEventListener('book:text-state',event=>{const detail=(event as CustomEvent).detail;
    if(typeof detail?.id==='string' && (detail.state==='locked-to-page'||detail.state==='camera-popup'))storyPresentation.setState(detail.id,detail.state);
  });
  spreads[-1]={group:coverHinge,hinges:[]};
  const atmosphere=createBookAtmosphere();
  const baker = new FlatPageBaker(renderer,spreads.map(s=>s.group),[fill,key],matchMedia('(max-width: 700px)').matches,bookPaper);
  const inkSprite=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/runtime/book/paint/ink-transition-sprite.png`);await (inkSprite.image as HTMLImageElement).decode();inkSprite.generateMipmaps=false;inkSprite.minFilter=THREE.LinearFilter;inkSprite.magFilter=THREE.LinearFilter;
  const pagePaint=createBookPaint(inkSprite,page=>{if(page>0)baker.invalidate(page-1);});let paintSkipElapsed=false;document.addEventListener('visibilitychange',()=>{paintSkipElapsed=true;});
  const flatPages = [-1,1].map(side=>{
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(5.8,7.5),new THREE.MeshBasicMaterial({color:0xffffff}));
    mesh.userData.bookCachedSurface=true;mesh.rotation.x=-Math.PI/2;mesh.position.set(side*BOOK_PAGE_FRAME.center,BOOK_PAGE_FRAME.flatY,0);mesh.visible=false;world.add(mesh);return mesh;
  });
  // The left cached face is physically mounted on the inside of the cover.
  const coverInsideGeometry=new THREE.PlaneGeometry(BOOK_PAGE_FRAME.width,BOOK_PAGE_FRAME.depth);const coverInsideUV=coverInsideGeometry.getAttribute('uv');for(let i=0;i<coverInsideUV.count;i++)coverInsideUV.setX(i,1-coverInsideUV.getX(i));coverInsideGeometry.rotateX(-Math.PI/2);
  const coverInside=new THREE.Mesh(coverInsideGeometry,new THREE.MeshBasicMaterial({side:THREE.BackSide}));coverInside.position.set(BOOK_PAGE_FRAME.center,BOOK_PAGE_FRAME.insideOffset,0);coverInside.userData.bookPaper=true;coverInside.userData.bookCachedSurface=true;coverInside.visible=false;coverHinge.add(coverInside);
  let pageLeases:{release:()=>void}[]=[];
  const releaseTurnPages=()=>{for(const lease of pageLeases)lease.release();pageLeases=[];canvas.dataset.pinnedPages='0';};
  const capturePage=(spread:number,side:'left'|'right')=>{const lease=baker.acquire(spread,side);pageLeases.push(lease);canvas.dataset.pinnedPages=String(pageLeases.length);return lease.texture;};
  // An actual subdivided leaf travels across the gutter; cutouts fold first.
  const leafGeo=new THREE.PlaneGeometry(5.8,7.5,40,1);leafGeo.translate(BOOK_PAGE_FRAME.center,0,0);leafGeo.rotateX(-Math.PI/2);
  const rest=Float32Array.from(leafGeo.attributes.position.array);
  const frontMaterial=new THREE.MeshBasicMaterial({side:THREE.FrontSide});
  const backMaterial=new THREE.MeshBasicMaterial({side:THREE.BackSide});
  const backGeo=leafGeo.clone();
  // A left page reads outer edge → gutter, the reverse of our right-page mesh.
  const backUV=backGeo.getAttribute('uv');for(let i=0;i<backUV.count;i++)backUV.setX(i,1-backUV.getX(i));
  backGeo.setAttribute('position',leafGeo.getAttribute('position'));backGeo.setAttribute('normal',leafGeo.getAttribute('normal'));
  const leaf=new THREE.Group(),leafFront=new THREE.Mesh(leafGeo,frontMaterial),leafBack=new THREE.Mesh(backGeo,backMaterial);
  leafFront.userData.bookCachedSurface=true;leafBack.userData.bookCachedSurface=true;leafFront.castShadow=true;leafFront.frustumCulled=false;leafBack.frustumCulled=false;
  leaf.add(leafFront,leafBack);leaf.position.y=BOOK_PAGE_FRAME.leafY;leaf.visible=false;world.add(leaf);
  let index=initialIndex, returnIndex=0, hasBookmark=false, folded=false;
  let transition:null|(Journey & {start:number;cameraFrom:THREE.Vector3;targetFrom:THREE.Vector3;fovFrom:number;cinematic:boolean;fromFold:number;caveEntry?:boolean;arrival?:BookCameraStep;destination?:BookCameraShot})=null;
  let denCameraActive=false;
  const denFlatView=new THREE.Vector3(0,13.8,10.5),denOpenView=new THREE.Vector3(0,3.4,12.2);
  let coverTurn:null|{from:number;to:number;start:number;duration:number;fromFold:number;initial:BookCameraShot;cinematic:boolean;arrival?:BookCameraStep;destination:BookCameraShot}=null;
  let responsiveFraming:ReturnType<typeof createBookFramingTools>|undefined;
  let tourCameraUnlocked=false,tourPainterFollowsPath=true,tourPathSampled=false;const tourPainterPosition=new THREE.Vector3();
  let shotBookOpen:number|undefined,shotBookTime=0,forestPaintState:number|undefined,filmPageColored=false,sparklePage=-1;
  const forestPaintMemory=new Map<number,number>();
  function releaseShotBook(){
    perimeterPaint.reset();pagePaint.setProximityPaint(5,null);pagePaint.setProximityPaint(-1,null);for(const b of pageRuntime.bindings.get(5)?.values()??[]){delete b.root.userData.waveOpen;for(const t of extensionWaveTrees(b.root))delete t.root.userData.waveOpen;}
    if(shotBookOpen===undefined)return;
    for(const [text,visible]of coverTextVisibility)text.visible=visible;coverTextVisibility.clear();document.body.classList.remove('book-film-active');shotBookOpen=undefined;camera.up.set(0,1,0);turnPopups.restore();releaseTurnPages();
    coverInside.visible=false;flatPages.forEach(p=>p.visible=false);coverGroup.visible=index===-1;bookBody.visible=index!==-1;
    coverHinge.rotation.z=index===-1?0:Math.PI;
    for(let i=0;i<spreads.length;i++)spreads[i].group.visible=i===index;
    if(spreads[index])spreads[index].lastPose=undefined;
    canvas.dataset.filmState='idle';el('fps-readout').hidden=false;sync();
  }
  function setShotBookOpen(value:number|undefined,elapsed=0){
    if(value===undefined){releaseShotBook();return;}
    if(isWoodland(index)){forestPaintState=index===4?1:forestPaintProgress(elapsed/1000,woodlandPaintEnd(index));forestPaintMemory.set(index+1,forestPaintState);pagePaint.setForestPaint(index+1,forestPaintState);}
    if(shotBookOpen===undefined){
      perimeterPaint.reset();if(index===4){pagePaint.setProximityPaint(5,perimeterPaint.texture);pagePaint.setProximityPaint(-1,perimeterPaint.texture);}perimeterReleaseAt=undefined;perimeterReleaseAge=0;filmPageColored=false;for(const b of pageRuntime.bindings.get(index+1)!.values())if(b.popup)b.root.visible=pageEditor.layout(index+1)?.controls.find(c=>c.id===b.id)?.visible??true;releaseTurnPages();storyPresentation.update(camera,null,0,true);
      try{coverInside.material.map=capturePage(index,'left');flatPages[1].material.map=capturePage(index,'right');coverInside.material.needsUpdate=true;flatPages[1].material.needsUpdate=true;}catch(error){releaseTurnPages();throw error;}
      turnPopups.begin([...pageRuntime.bindings.get(index+1)!.values()].filter(b=>b.popup).map(b=>b.root));
    }
    if(elapsed/1000<shotBookTime){perimeterReleaseAt=undefined;perimeterReleaseAge=0;}shotBookOpen=value;shotBookTime=elapsed/1000;
  }
  const cameraNotebook=createBookCameraNotebook(camera,orbit.target,()=>{if(!assetsReady||transition||coverTurn)return false;hasPlayedFilm=true;tourPathSampled=false;responsiveFraming?.manual();denCameraActive=false;orbit.update();orbit.enabled=tourCameraUnlocked;return true;},()=>{orbit.enabled=true;orbit.update();},()=>index+1,(page,arrival)=>{
    if(transition||coverTurn)return Promise.resolve(false);if(page===index+1)return Promise.resolve(true);
    return new Promise<boolean>(resolve=>{let timer:ReturnType<typeof setTimeout>;const done=(event:Event)=>{if((event as CustomEvent).detail.page!==page)return;clearTimeout(timer);removeEventListener('book:page-ready',done);void warmCurrentScene().then(()=>resolve(true),()=>resolve(false));};addEventListener('book:page-ready',done);timer=setTimeout(()=>{removeEventListener('book:page-ready',done);resolve(false);},Math.max(30000,(arrival?.durationMs??0)+10000));travel(page-1,false,true,arrival);});
  },{sampleShot:shot=>{tourPainterPosition.fromArray(shot.position);tourPathSampled=true;},trajectoryInitial:()=>{if(index!==4||!tourCameraUnlocked)return undefined;const first=cameraNotebook.openingForPage(5)?.shot;return first?(responsiveFraming?.resolve(first,5)??first):undefined;},manualCamera:()=>tourCameraUnlocked,turnRate:()=>index===4?26:undefined,ready:()=>assetsReady,bookOpen:()=>shotBookOpen,applyBookOpen:setShotBookOpen,authorShot:()=>responsiveFraming?.authorShot()??captureBookCamera(camera,orbit.target),capture:()=>responsiveFraming?.capture(),resolve:shot=>responsiveFraming?.resolve(shot)??shot,selection:()=>responsiveFraming?.selection(),settle:shot=>responsiveFraming?.adopt(shot.framing),paint:(page,cue)=>pagePaint.cue(page,cue),paintTargets:page=>pageEditor.layout(page)?.controls.filter(c=>c.kind!=='text').map(c=>({id:c.id,name:c.name,kind:c.kind}))??[],stageTargets:page=>pageEditor.layout(page)?.controls.filter(c=>c.kind==='popup').map(c=>({id:c.id,name:c.name,x:c.x,z:c.z,height:c.height}))??[],stage:()=>{const page=index+1,out:Record<string,number>={};for(const c of pageEditor.layout(page)?.controls??[])if(c.kind==='popup'){const popup=pageRuntime.binding(page,c.id)?.popup;if(popup)out[c.id]=popup.driver.userData.previewOpen??1;}return out;},applyStage:stage=>{const page=index+1;for(const [id,v] of Object.entries(stage)){const popup=pageRuntime.binding(page,id)?.popup;if(!popup)continue;popup.driver.userData.previewOpen=v;if(shotBookOpen===undefined)popup.pose(v,undefined,1);}renderer.shadowMap.needsUpdate=true;}});
  let foldAmount=1, targetFold=1, last=performance.now(), eventUntil=0;
  const visited=new Set<number>();
  const pageRoots=[coverHinge,...spreads.map(s=>s.group)];
  const pageRuntime=createBookPageRuntime(pageRoots,async(page,control)=>{await loadPaint(control.art!);const made=prop({id:control.id,art:control.art!,x:control.x,z:control.z,height:control.height},pageRoots[page]);made.mesh.scale.x=control.width/(control.height*textures.get(control.art!)!.image.width/textures.get(control.art!)!.image.height);made.hinge.userData.restY=made.hinge.position.y;spreads[page-1].hinges.push(made.hinge);return made;},(page,structure)=>{
    responsiveFraming?.invalidateBounds();const spread=spreads[page-1];if(structure){spread.packing?.restore();spread.packing?.dispose();spread.packing=new PageFoldPacking(spread.group);}spread.lastPose=undefined;groundPaint.invalidate(page);if(page>0)baker.invalidate(page-1);renderer.shadowMap.needsUpdate=true;
  },root=>{groundPaint.attach(root,pageRoots.indexOf(root));storyPresentation.register(root);atmosphere.attach(root);pagePaint.attach(root,pageRoots.indexOf(root));if(isWoodland(pageRoots.indexOf(root)-1)&&pageRoots.indexOf(root)===index+1){paintSparkles.configure(root);sparklePage=index+1;}},async(page,control,previous)=>{
    if(!assetsReady&&++builtPopups%8===0){bookLoading.report(.66,'Building paper mechanisms',builtPopups,undefined);await nextBookPaint();}
    const spread=page>0?spreads[page-1]:undefined;if(previous){const i=spread?spread.hinges.indexOf(previous.driver):-1;if(i>=0)spread!.hinges.splice(i,1);previous.dispose();}
    await loadPaint(control.art!);const p={...DEFAULT_POPUP,...control.popup},deg=THREE.MathUtils.degToRad;
    if(p.companionArt)await loadPaint(p.companionArt);
    const made=p.mechanism==='foreground'?createForegroundFlap(paperCutCanvas(textures.get(control.art!)!.image as HTMLCanvasElement,p.border),{height:control.height,cardWidth:p.cardWidth,cardDepth:p.cardDepth,thickness:p.thickness,backColor:p.backColor}):p.mechanism==='radial'?createRadialPopup(paperCutCanvas(textures.get(control.art!)!.image as HTMLCanvasElement,p.border),{height:control.height,cardWidth:p.cardWidth,cardDepth:p.cardDepth,alpha:deg(p.glueAngle),beta:deg(p.creaseLean),split:p.split,faces:p.faces,mount:'card',thickness:p.thickness,backColor:p.backColor}):p.mechanism==='tree-perch'?createTreePerchPopup(paperCutCanvas(textures.get(control.art!)!.image as HTMLCanvasElement,p.border),paperCutCanvas(textures.get(p.companionArt!)!.image as HTMLCanvasElement,p.border),{height:control.height,cardWidth:p.cardWidth,cardDepth:p.cardDepth,alpha:deg(p.glueAngle),beta:deg(p.creaseLean),split:p.split,faces:p.faces,mount:'card',thickness:p.thickness,backColor:p.backColor}):p.mechanism==='extension'?createPageExtension(paperCutCanvas(textures.get(control.art!)!.image as HTMLCanvasElement,p.border),{side:p.extensionSide==='left'?-1:1,width:p.cardWidth,depth:p.cardDepth,height:control.height,thickness:p.thickness,forestRing:p.forestRing}):p.mechanism==='woodland'?createDenPopup(paperCutCanvas(textures.get(control.art!)!.image as HTMLCanvasElement,p.border),{height:control.height,cardWidth:5.4,cardDepth:4.4,thickness:p.thickness,backColor:p.backColor}):createPopupVFold(paperCutCanvas(textures.get(control.art!)!.image as HTMLCanvasElement,p.border),{height:control.height,cardWidth:p.cardWidth,cardDepth:p.cardDepth,alpha:deg(p.glueAngle),beta:deg(p.creaseLean),split:p.split,faces:p.faces,mount:p.mount,thickness:p.thickness,backColor:p.backColor,paintedBack:p.paintedBack});
    made.root.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshStandardMaterial)craft.cardShader(o.material);});if(isWoodlandCharacter(control.id))made.root.userData.woodlandMoment=true;pageRoots[page].add(made.root);spread?.hinges.push(made.driver);return stowPopup(made);
  });
  const pageEditor=await createBookPageEditor({runtime:pageRuntime,onLayout:layout=>pagePaint.configure(layout),paintCue:(page,cue)=>pagePaint.cue(page,cue),replayPaint:page=>pagePaint.replay(page),camera,cameraTarget:()=>orbit.target,canvas,getPage:()=>index+1,isBusy:()=>!!transition||!!coverTurn,navigate:page=>travel(page-1),assets:[...new Set([...paths,...Object.keys(import.meta.glob('/public/assets/runtime/characters/{hero,mochi}/book/**/*.png',{query:'?url',import:'default'})).map(path=>path.replace('/public/assets/runtime/','')),...Object.keys(import.meta.glob('/public/assets/runtime/environment/watercolor/v1/*.png',{query:'?url',import:'default'})).map(path=>path.replace('/public/assets/runtime/',''))])],onEdit:()=>{cameraNotebook.stop();releaseShotBook();denCameraActive=false;folded=false;foldAmount=targetFold=1;pose(spreads[index],1);sync();},overview:()=>responsiveFraming?.topView()});
  bookBody.traverse(o=>{if(o.userData.bookPaper)pagePaint.attach(o,-1,true);});
  baker.sourceRevision=spread=>JSON.stringify([pagePaint.snapshotKey(spread+1),forestPaintMemory.get(spread+1)??null]);
  baker.withCaptureState=spread=>{const sourcePage=spread+1,restorePaint=sourcePage===index+1?forestPaintState:undefined;if(isWoodland(spread))pagePaint.setForestPaint(sourcePage,forestPaintMemory.get(sourcePage));groundPaint.update();pagePaint.update(0,reduced.matches,true);const before={mood:atmosphere.current,fill:fill.intensity,key:key.intensity};atmosphere.set(pageEditor.atmosphere(spread+1));fill.intensity=1.4*atmosphere.lightFactor;key.intensity=1.6*atmosphere.lightFactor;return()=>{if(isWoodland(spread))pagePaint.setForestPaint(sourcePage,restorePaint);atmosphere.set(before.mood);fill.intensity=before.fill;key.intensity=before.key;};};
  responsiveFraming=createBookFramingTools({canvas,camera,orbit,getPage:()=>index+1,selection:()=>pageEditor.selectionId,cancel:()=>cancelCameraMotion(),busy:()=>!!transition||!!coverTurn||cameraNotebook.playing,bounds:(framing,page=index+1)=>{
    if(framing.subject==='control'){const binding=framing.controlId?pageRuntime.binding(page,framing.controlId):undefined;if(!binding||!binding.root.visible)return;binding.mesh.updateWorldMatrix(true,false);return new THREE.Box3().setFromObject(binding.mesh);}
    const bounds=new THREE.Box3(new THREE.Vector3(page===0?-.1:-6.15,-.4,-3.95),new THREE.Vector3(page===0?6.05:6.15,.22,3.95));const root=spreads[page-1].group;root.updateWorldMatrix(true,true);for(const child of root.children)child.traverseVisible(object=>{if(object instanceof THREE.Mesh&&!object.userData.interactionMarker&&!object.userData.editorHelper)bounds.union(new THREE.Box3().setFromObject(object));});const centerX=page===0?2.95:0,halfX=Math.max(Math.abs(bounds.min.x-centerX),Math.abs(bounds.max.x-centerX)),halfZ=Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z));bounds.min.x=centerX-halfX;bounds.max.x=centerX+halfX;bounds.min.z=-halfZ;bounds.max.z=halfZ;return bounds;
  }});
  atmosphere.attach(world);
  const forestPlay=el<HTMLButtonElement>('forest-play');forestPlay.disabled=true;hostPlay().disabled=true;setSceneIcon(forestPlay,'Play forest film','play');forestPlay.title='Replay the forest · 20 seconds';el('book-right-tools').append(forestPlay);
  function playForestFilm(){
    if(!assetsReady||transition||coverTurn)return;
    const navigator=el('book-navigator');if(!navigator.classList.contains('is-collapsed'))navigator.querySelector<HTMLButtonElement>('[data-scene="collapse"]')!.click();
    cameraNotebook.playScene('scene-page-'+(index+1));
  }
  forestPlay.onclick=playForestFilm;
  const tourCamera=document.createElement('button');tourCamera.id='tour-camera';tourCamera.type='button';el('book-right-tools').append(tourCamera);
  const painterSource=document.createElement('button');painterSource.id='tour-painter-source';painterSource.type='button';el('book-right-tools').append(painterSource);
  function syncTourCamera(){const state=[tourCameraUnlocked,tourPainterFollowsPath,assetsReady,!!transition,!!coverTurn,index].join(':');if(tourCamera.dataset.state===state)return;tourCamera.dataset.state=state;tourCamera.hidden=!isWoodland(index);tourCamera.disabled=!assetsReady||!!transition||!!coverTurn;setSceneIcon(tourCamera,tourCameraUnlocked?'Follow tour camera':'Unlock tour camera',tourCameraUnlocked?'unlock':'lock');tourCamera.setAttribute('aria-pressed',String(tourCameraUnlocked));tourCamera.title=tourCameraUnlocked?'Free camera · tour continues · click to follow again':'Unlock camera · keep tour playing';canvas.dataset.tourCamera=tourCameraUnlocked?'free':'following';painterSource.hidden=index!==4||!tourCameraUnlocked;painterSource.disabled=tourCamera.disabled;setSceneIcon(painterSource,'Use original tour path for painting',tourPainterFollowsPath?'paint':'camera');painterSource.setAttribute('aria-pressed',String(tourPainterFollowsPath));painterSource.title=tourPainterFollowsPath?'Painter: original tour path · click to use your camera':'Painter: your camera · click to use original tour path';}
  tourCamera.onclick=()=>{tourCameraUnlocked=!tourCameraUnlocked;responsiveFraming?.manual();camera.up.set(0,1,0);orbit.minDistance=tourCameraUnlocked?.1:11/4;if(tourCameraUnlocked){const position=camera.position.clone(),target=orbit.target.clone(),damping=orbit.enableDamping;orbit.enableDamping=false;orbit.update();camera.position.copy(position);orbit.target.copy(target);orbit.update();orbit.enableDamping=damping;}orbit.enabled=tourCameraUnlocked||!cameraNotebook.playing;syncTourCamera();};
  painterSource.onclick=()=>{tourPainterFollowsPath=!tourPainterFollowsPath;syncTourCamera();};
  syncTourCamera();
  addEventListener('book:page-ready',()=>{if(!isWoodland(index))tourCameraUnlocked=false;syncTourCamera();});
  addEventListener('book:page-ready',event=>{const page=(event as CustomEvent).detail.page;forestPlay.hidden=!isWoodland(page-1);forestPlay.disabled=!assetsReady;forestPlay.title=page===5?'Play the living perimeter · 36 seconds':page===4?'Play Mochi’s moments · 50 seconds':page===3?'Play Hero’s moments · 40 seconds':'Play the forest · 20 seconds';if(assetsReady&&!warmedPages.has(page))void warmCurrentScene().catch(error=>{bookLoading.fail();el('book-error').hidden=false;el('book-error').textContent='Asset preparation failed: '+error.message;});});
  addEventListener('book:page-ready',event=>pagePaint.enter((event as CustomEvent).detail.page));
  addEventListener('book:paint',event=>{const detail=(event as CustomEvent).detail,page=Number.isInteger(detail?.page)?detail.page:index+1;if(page>=0&&page<=5&&validPaintCue(detail))pagePaint.cue(page,detail);});
  addEventListener('book:paint-flag',event=>{const d=(event as CustomEvent).detail;if(typeof d?.flag==='string'&&/^[\w:-]{1,140}$/.test(d.flag)&&typeof d.value==='boolean')pagePaint.flag(d.flag,d.value,Number.isFinite(d.durationMs)?Math.max(0,Math.min(30000,d.durationMs)):2600);});

  function sync() {
    if(shotBookOpen===undefined)forestPaintState=forestPaintMemory.get(index+1);
    if(isWoodland(index)&&sparklePage!==index+1){paintSparkles.configure(pageRoots[index+1]);sparklePage=index+1;}
    renderer.shadowMap.needsUpdate=true;
    const busy=!!transition||!!coverTurn;
    fold.disabled=busy||index===-1;
    mapButton.hidden=returnButton.hidden=true;mapRibbon.visible=returnRibbon.visible=false;
    mapButton.disabled=busy||index===MAP_INDEX;returnButton.disabled=busy||index===returnIndex;
    setSceneIcon(fold,folded?'Unfold':'Fold','fold');fold.setAttribute('aria-pressed',String(folded));
    canvas.dataset.pageTitle=`${String(index+1).padStart(2,'0')} / ${BOOK_SCENES[index]?.name??(index===-1?'The front cover':'The known country')}`;
    action.hidden=busy||folded||isWoodland(index)||index===0||index===MAP_INDEX||index===-1;action.disabled=visited.has(index);action.textContent=visited.has(index)?'Awakened':BOOK_SCENES[index]?.action??'';
    canvas.dataset.scene=BOOK_SCENES[index]?.id??(index===-1?'cover':'map');canvas.dataset.sceneIndex=String(index);canvas.dataset.turning=String(busy);canvas.dataset.folded=String(folded);canvas.dataset.collected=String(visited.size);
    canvas.dataset.returnScene=BOOK_SCENES[returnIndex].id;
    el('page-narrative').textContent=index===-1?"Hero's Journey. The adventure of a very good girl. A story waiting to unfold.":BOOK_SCENES[index]?.emptyBase?'':(BOOK_SCENES[index]?.story??mapStory).join(' ');
    returnButton.setAttribute('aria-label',`Return to ${BOOK_SCENES[returnIndex].name}`);
    document.querySelectorAll<HTMLButtonElement>('[data-map-stop]').forEach(b=>{b.hidden=true;b.disabled=true;});
    if(!busy){canvas.dataset.coverStage=index===-1?'closed':'open';canvas.dataset.liveSpread=String(index);}
    if(!busy)dispatchEvent(new CustomEvent('book:page-ready',{detail:{page:index+1}}));
  }
  function travel(to:number, caveEntry=false,preserveNotebook=false,arrival?:BookCameraStep) {
    releaseShotBook();for(const b of pageRuntime.bindings.get(to+1)?.values()??[])if(b.root.userData.woodlandMoment)b.root.visible=false;
    // a page turn hands pop-ups back to the page opening; shots re-stage them
    for(const items of pageRuntime.bindings.values())for(const b of items.values())if(b.popup&&!b.popup.driver.userData.foregroundFlap)delete b.popup.driver.userData.previewOpen;
    if(transition||coverTurn)return;
    if(!preserveNotebook)cameraNotebook.stop();
    // Aim at the authored opening view during the turn, before playback resumes.
    if(!arrival&&index===-1&&to===0)arrival=cameraNotebook.openingForPage(1);
    let destination:BookCameraShot|undefined;if(arrival){const coverRotation=coverHinge.rotation.z;if(to===-1)coverHinge.rotation.z=0;pose(spreads[to],1);responsiveFraming?.invalidateBounds();destination=responsiveFraming?.resolve(arrival.shot,to+1)??arrival.shot;if(to===-1){coverHinge.rotation.z=coverRotation;coverHinge.updateWorldMatrix(true,true);}}
    if(index===-1||to===-1){if(to< -1||to>MAP_INDEX||to===index)return;if(!preserveNotebook)cancelCameraMotion();else denCameraActive=false;orbit.update();orbit.enabled=false;
      releaseTurnPages();const coverScene=index===-1?to:index;storyPresentation.update(camera,null,0,true);
      try{coverInside.material.map=capturePage(coverScene,'left');flatPages[1].material.map=capturePage(coverScene,'right');coverInside.material.needsUpdate=true;flatPages[1].material.needsUpdate=true;}catch(error){releaseTurnPages();throw error;}
      turnPopups.begin([...pageRuntime.bindings.get(coverScene+1)!.values()].filter(b=>b.popup).map(b=>b.root));
      canvas.dataset.pageCaptures=String(baker.captures);canvas.dataset.pageCacheSize=String(baker.size);el('event').textContent='';
      coverTurn={from:index,to,fromFold:foldAmount,start:performance.now(),duration:reduced.matches?100:Math.max(index===-1?COVER_OPEN_DURATION_MS:2600,arrival?.durationMs??0),cinematic:!reduced.matches,initial:captureBookCamera(camera,orbit.target),arrival,destination:destination??{position:views[to].toArray(),target:to===-1?[2.95,.2,0]:[0,.2,0],fov:38}};coverGroup.visible=true;sync();return;
    }
    const plan=planJourney(index,to,reduced.matches);if(!plan)return; if(caveEntry && !reduced.matches){plan.duration=6000;plan.rapid=false;plan.leaves=1;}
    storyPresentation.update(camera,null,0,true);atmosphere.set({...DEFAULT_BOOK_ATMOSPHERE,enabled:false});
    if(!reduced.matches){
      const before=baker.captures;
      // Touch all four pages before assigning the leaf. The LRU keeps these
      // active textures alive for the whole turn, even after other-page visits.
      releaseTurnPages();
      const fromLeft=capturePage(index,'left'),fromRight=capturePage(index,'right');
      const toLeft=capturePage(to,'left'),toRight=capturePage(to,'right');
      const faces=turningFaces(index,to);
      frontMaterial.map=faces.front.spread===index?fromRight:toRight;
      backMaterial.map=faces.back.spread===index?fromLeft:toLeft;
      frontMaterial.needsUpdate=true;backMaterial.needsUpdate=true;
      flatPages[0].material.map=to>index?fromLeft:toLeft;
      flatPages[1].material.map=to>index?toRight:fromRight;
      for(const flat of flatPages)flat.material.needsUpdate=true;
      canvas.dataset.pageCaptures=String(baker.captures);canvas.dataset.pageCacheSize=String(baker.size);
      canvas.dataset.newPageCaptures=String(baker.captures-before);canvas.dataset.pageTextureSize=`${baker.width}x${baker.height}`;
      canvas.dataset.lastPageCaptureMs=baker.lastCaptureMs.toFixed(2);
    }
    if(arrival)plan.duration=Math.max(plan.duration,arrival.durationMs);
    if(plan.insert){returnIndex=index;hasBookmark=true;returnRibbon.material.map?.dispose();returnRibbon.material.map=bookmarkTexture(BOOK_SCENES[index].symbol,'#a4503b');returnRibbon.material.needsUpdate=true;}
    // Drain OrbitControls damping before taking ownership, avoiding a camera jump
    // when controls resume. Pointer input can interrupt only the camera move.
    orbit.update();orbit.enabled=false;
    turnPopups.begin([...pageRuntime.bindings.get(to+1)!.values()].filter(b=>b.popup).map(b=>b.root));
    transition={...plan,start:performance.now(),cameraFrom:camera.position.clone(),targetFrom:orbit.target.clone(),fovFrom:camera.fov,cinematic:!reduced.matches,fromFold:foldAmount,caveEntry,arrival,destination};folded=false;el('event').textContent='';sync();
  }
  const caveFlight=prop({art:BOOK_SCENES[0].props[0].art,x:0,z:-2.9,height:1.1},world);
  caveFlight.hinge.visible=false; caveFlight.mesh.material=(caveFlight.mesh.material as THREE.MeshStandardMaterial).clone();
  let caveHover=false;
  function turn(delta:number){travel(index+delta);}
  mapButton.onclick=()=>travel(MAP_INDEX);returnButton.onclick=()=>travel(returnIndex);
  document.querySelectorAll<HTMLButtonElement>('[data-map-stop]').forEach(b=>b.onclick=()=>travel(Number(b.dataset.mapStop)));
  fold.onclick=()=>{cameraNotebook.stop();releaseShotBook();folded=!folded;targetFold=folded?0:1;if(index===DEN_INTERIOR_INDEX&&!isWoodland(index)){orbit.update();denCameraActive=true;}sync();};
  function activate(){if(!spreads[index]?.target)return;if(transition||coverTurn||folded||index===MAP_INDEX||visited.has(index))return;visited.add(index);spreads[index].group.userData.heroX=.6;baker.invalidate(index);el('event').textContent=BOOK_SCENES[index].result;eventUntil=performance.now()+2800;sync();}
  action.onclick=activate;
  const panKeys=new Set<string>();
  const panForward=new THREE.Vector3(),panRight=new THREE.Vector3(),panStep=new THREE.Vector3();
  const cancelCameraMotion=()=>{responsiveFraming?.manual();if(tourCameraUnlocked&&cameraNotebook.playing&&!transition&&!coverTurn)return;camera.up.set(0,1,0);cameraNotebook.stop();releaseShotBook();denCameraActive=false;if(coverTurn){coverTurn.cinematic=false;orbit.enabled=true;}if(transition){transition.cinematic=false;orbit.enabled=true;}};
  addEventListener('keydown',event=>{
    if(event.defaultPrevented)return;
    if(event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)))return;
    if(!['KeyW','KeyA','KeyS','KeyD'].includes(event.code))return;
    event.preventDefault();panKeys.add(event.code);cancelCameraMotion();
  });
  addEventListener('keyup',event=>panKeys.delete(event.code));
  addEventListener('blur',()=>panKeys.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)panKeys.clear();});
  canvas.addEventListener('wheel',cancelCameraMotion,{passive:true,capture:true});
  document.addEventListener('keydown',e=>{if(e.defaultPrevented)return;if(e.target instanceof HTMLElement&&(e.target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)))return;if(e.key==='ArrowRight'){e.preventDefault();turn(1);}if(e.key==='ArrowLeft'){e.preventDefault();turn(-1);}});
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const paperPlane = new THREE.Plane(new THREE.Vector3(0,1,0),-.14), paperPoint = new THREE.Vector3();
  const pointers = new Set<number>();let down={x:0,y:0}, moved=false;
  function pointRay(e:PointerEvent){
    const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
  }
  canvas.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);if(pointers.size===1){down={x:e.clientX,y:e.clientY};moved=false;}else moved=true;edgeGlow.visible=false;if(e.button===1)e.preventDefault();if(e.pointerType==='touch'||e.button!==0)cancelCameraMotion();},{capture:true});
  canvas.addEventListener('pointermove',e=>{
    if(pointers.size){moved ||= Math.hypot(e.clientX-down.x,e.clientY-down.y)>6;return;}
    pointRay(e);const hit=ray.ray.intersectPlane(paperPlane,paperPoint);
    const cave=index===0 && !transition && !folded && spreads[0].cave && spreads[0].cave!.visible && ray.intersectObject(spreads[0].cave!,true).length>0; caveHover=Boolean(cave); canvas.dataset.caveHover=String(caveHover);
    const direction=hit&&!transition?pageEdgeAt(hit.x,hit.z,index+1,MAP_INDEX+1):0;
    edgeGlow.visible=direction!==0;edgeGlow.position.x=direction*5.5;canvas.style.cursor=direction||caveHover?'pointer':'';
  });
  canvas.addEventListener('pointerleave',()=>{edgeGlow.visible=false;caveHover=false;canvas.style.cursor='';});
  canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);moved=true;});
  canvas.addEventListener('pointerup',e=>{
    const wasDown=pointers.delete(e.pointerId);
    if(!wasDown||e.button!==0||moved||pointers.size||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||transition||coverTurn)return;
    pointRay(e);const hit=ray.ray.intersectPlane(paperPlane,paperPoint);
    const direction=hit?pageEdgeAt(hit.x,hit.z,index,MAP_INDEX):0;
    if(direction){edgeGlow.visible=false;canvas.style.cursor='';turn(direction);return;}
    if(index===-1){if(ray.intersectObject(lid).length)travel(0);return;}
    if(folded)return;
    if(index===0 && spreads[0].cave && spreads[0].cave!.visible && ray.intersectObject(spreads[0].cave!).length){caveHover=false;travel(DEN_INTERIOR_INDEX,!isWoodland(DEN_INTERIOR_INDEX));return;}
    const target=spreads[index].target;if(target&&target.visible&&target.parent?.visible&&ray.intersectObject(target).length)activate();
  });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
  let viewportWidth=1,viewportHeight=1;
  function resize(){const bounds=canvas.getBoundingClientRect();viewportWidth=Math.max(1,bounds.width);viewportHeight=Math.max(1,bounds.height);viewport.resize(viewportWidth,viewportHeight);camera.aspect=viewportWidth/viewportHeight;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(canvas);
  addEventListener('resize',resize);resize();sync();const editParams=new URLSearchParams(location.search);if((editParams.get('Edit')??editParams.get('edit'))?.toLowerCase()==='true')pageEditor.open();canvas.dataset.reliefCount=String(spreads[0].hinges.filter(h=>h.children.some(c=>c.userData.depthRelief)).length);
  // Edge flaps turn about their longitudinal crease, rising over the book
  // before settling outside it. Counter-hinges keep attached reliefs upright.
  function foldWings(s:Spread,open:number){
    for(const wing of s.wings??[]){
      wing.rotation.set(0,0,wing.userData.side*Math.PI*(1-open));
      for(const child of wing.children)if(child.userData.forwardLeaf)child.rotation.x=-Math.PI*(1-THREE.MathUtils.clamp((open-.25)/.75,0,1));
    }
    s.group.updateMatrixWorld(true);
    s.group.traverse(object=>{if(object.userData.paperMount){object.position.y=THREE.MathUtils.lerp(-.015,.15,open);object.quaternion.copy(object.parent!.getWorldQuaternion(new THREE.Quaternion())).invert();}});
  }
  function rise(h:THREE.Object3D,n:number,bookOpen=n){h.userData.popupOpen=h.userData.previewOpen??n;if(h.userData.kirigami)h.userData.kirigami.pose(h.userData.previewOpen??n,undefined,bookOpen);else h.rotation.x=-(1-ease(n))*Math.PI/2;}
  function pose(s:Spread,amount:number, mode:'together'|'wave'='wave',front=4){if(s.lastPose===amount)return;s.lastPose=amount;renderer.shadowMap.needsUpdate=true;s.packing?.restore();for(const h of s.hinges){const z=h.getWorldPosition(new THREE.Vector3()).z;const delay=mode==='wave' ? Math.min(.45,THREE.MathUtils.clamp((z+3.5)/7,0,1)*.22+(h.userData.popupDelay ?? 0)) : 0; const n=mode==='wave'?THREE.MathUtils.clamp((amount-delay)/(1-delay),0,1):amount;rise(h,h.userData.pageFlat?0:h.userData.kirigami?THREE.MathUtils.clamp((amount-(h.userData.popupDelay??0))/(1-(h.userData.popupDelay??0)),0,1):n,amount);h.position.y=(h.userData.restY??h.position.y)+(h.userData.flatLayer??0)*(1-n);}foldWings(s,ease(THREE.MathUtils.clamp(amount/.7,0,1)));s.packing?.apply(amount);s.groundBatches?.forEach(batch=>batch.refresh());}
  function revealBehind(s:Spread,front:number){s.lastPose=undefined;renderer.shadowMap.needsUpdate=true;s.packing?.restore();for(const h of s.hinges){const z=h.getWorldPosition(new THREE.Vector3()).z;const n=h.userData.pageFlat?0:THREE.MathUtils.clamp((front-z+.5)/1.5,0,1);rise(h,THREE.MathUtils.clamp((n-(h.userData.popupDelay??0))/(1-(h.userData.popupDelay??0)),0,1));}foldWings(s,ease(THREE.MathUtils.clamp((front+4.8)/3,0,1)));s.packing?.apply(THREE.MathUtils.clamp((front+4.8)/10.3,0,1));s.groundBatches?.forEach(batch=>batch.refresh());}
  function projectButton(button:HTMLButtonElement,x:number,y:number,z:number){
    const p=new THREE.Vector3(x,y,z).project(camera);
    const bounds=canvas.getBoundingClientRect();button.style.left=`${bounds.left+(p.x*.5+.5)*viewportWidth}px`;button.style.top=`${bounds.top+(-p.y*.5+.5)*viewportHeight}px`;
    button.style.visibility=p.z>1||p.x < -1||p.x>1||p.y < -1||p.y>1?'hidden':'visible';
  }
  function presentShotBook(){
    if(shotBookOpen===undefined)return;
    const open=shotBookOpen,live=open>.9999;el('fps-readout').hidden=true;document.body.classList.add('book-film-active');
    if(isWoodland(index))for(const text of coverHinge.children)if(text.userData.bookStory){if(!coverTextVisibility.has(text))coverTextVisibility.set(text,text.visible);text.visible=false;}
    coverHinge.rotation.z=Math.PI*open;coverHinge.position.y=THREE.MathUtils.lerp(.16,BOOK_PAGE_FRAME.flatY+BOOK_PAGE_FRAME.insideOffset,open);
    coverGroup.visible=!live;bookBody.visible=live;coverInside.visible=!live&&open>.0001;flatPages[0].visible=false;flatPages[1].visible=!live&&open>.0001;leaf.visible=false;edgeGlow.visible=false;
    for(let i=0;i<spreads.length;i++)spreads[i].group.visible=live&&i===index;
    turnPopups.update(open,true);
    if(index===4&&assetsReady){
      const followPath=tourCameraUnlocked&&tourPainterFollowsPath&&tourPathSampled,painterPosition=followPath?tourPainterPosition:camera.position;canvas.dataset.painterSource=followPath?'tour':'camera';canvas.dataset.painterPosition=painterPosition.toArray().map(v=>v.toFixed(5)).join(',');const field=perimeterPaint.update(shotBookTime,painterPosition,open),pending:string[]=[];forestRevealSites=[];
      const target=(id:string,point:THREE.Vector3,root:THREE.Object3D)=>{delete root.userData.waveOpen;const paint=perimeterPaint.amountAt(point.x,point.z);forestRevealSites.push({x:point.x,z:point.z,open:paint});if(paint===0)pending.push(id);};
      for(const c of pageEditor.layout(5)?.controls??[]){const b=pageRuntime.binding(5,c.id);if(!b?.popup||!c.visible)continue;delete b.root.userData.waveOpen;const children=extensionWaveTrees(b.root);if(children.length)children.forEach((t,i)=>target(c.id+':tree-'+i,b.root.localToWorld(t.anchor.clone()),t.root));else target(c.id,b.root.getWorldPosition(new THREE.Vector3()),b.root);}
      const total=forestRevealSites.length,complete=forestRevealSites.filter(s=>s.open>=.999).length;canvas.dataset.perimeterWave=JSON.stringify({total,started:total-pending.length,complete,rising:total-pending.length-complete,pending});canvas.dataset.perimeterPaint=JSON.stringify(field);forestTreelineSites=forestRevealSites.filter(s=>Math.abs(s.x)>4||s.z>2.6||s.z< -3.5);
    }
    for(const b of pageRuntime.bindings.get(index+1)!.values())if(b.popup){const delay=b.popup.driver.userData.popupDelay??0,n=THREE.MathUtils.clamp((open-delay)/(1-delay),0,1),stage=b.popup.driver.userData.previewOpen??1;const c=pageEditor.layout(index+1)?.controls.find(c=>c.id===b.id),gate=isWoodland(index)&&c?magicPopupOpen(forestPaintState??0,c.x,c.z,c.height):1;const moment=heroMoment(b.id,shotBookTime);if(c)b.root.visible=c.visible&&moment.visible;const value=index===4?open:Math.min(n,stage,gate,moment.open,b.root.userData.waveOpen??1);b.popup.pose(value,isWoodland(index)&&index!==4?forestPaintState:undefined,open);b.popup.driver.userData.popupOpen=value;}
    if(isWoodland(index)&&index!==4){for(const h of spreads[index].hinges)if(!h.userData.kirigami){const at=h.getWorldPosition(new THREE.Vector3());rise(h,Math.min(open,magicPopupOpen(forestPaintState??0,at.x,at.z,.1)));}spreads[index].groundBatches?.forEach(batch=>batch.refresh());}
    mapRibbon.visible=returnRibbon.visible=false;mapButton.hidden=returnButton.hidden=true;action.hidden=true;fold.disabled=true;
    canvas.dataset.filmState=cameraNotebook.playing?(open===0?'closed':open===1?'exploring':shotBookTime<8?'opening':'closing'):hasPlayedFilm?'complete':'ready';
    canvas.dataset.foregroundFlaps=JSON.stringify(Object.fromEntries([...pageRuntime.bindings.get(index+1)!.values()].filter(b=>b.popup?.driver.userData.foregroundFlap).map(b=>[b.id,b.root.userData.foregroundAngle])));canvas.dataset.filmTime=shotBookTime.toFixed(3);canvas.dataset.coverOpenness=open.toFixed(4);canvas.dataset.coverStage=open===0?'closed':open===1?'open':'moving-cover';canvas.dataset.turnPopupCount=String(turnPopups.count);
    canvas.dataset.turnPopupPoses=JSON.stringify(Object.fromEntries([...pageRuntime.bindings.get(index+1)!.values()].filter(b=>b.popup&&b.root.visible).map(b=>[b.id,b.popup!.driver.userData.popupOpen])));
    renderer.shadowMap.needsUpdate=true;
  }
  const cameraReadout=el('camera-readout'),fpsReadout=el('fps-readout');
  let ambienceTime=0;
  let statsTime=performance.now(),statsFrames=0,statsPeak=0,lastHud=0,sceneCpu=0,lastShadowRefresh=-Infinity;
  function frame(now:number){
    statsFrames++;statsPeak=Math.max(statsPeak,now-last);
    if(now-statsTime>=500){const fps=statsFrames*1000/(now-statsTime);fpsReadout.textContent=fps.toFixed(0)+' FPS · '+((now-statsTime)/statsFrames).toFixed(1)+' ms · peak '+statsPeak.toFixed(0)+' ms · '+renderer.info.render.calls+' draws · '+Math.round(renderer.info.render.triangles/1000)+'k tris · CPU '+sceneCpu.toFixed(1)+' ms';canvas.dataset.fps=fps.toFixed(1);statsTime=now;statsFrames=0;statsPeak=0;}

    syncTourCamera();const frameStart=performance.now();
    const realDt=Math.max(0,(now-last)/1000),dt=Math.min(.05,realDt);last=now;if(!document.hidden&&!cameraNotebook.paused)ambienceTime+=Math.min(realDt,.25);
    if(assetsReady&&panKeys.size&&!pageEditor.typing){
      panForward.copy(orbit.target).sub(camera.position);panForward.y=0;panForward.normalize();
      panRight.crossVectors(panForward,camera.up).normalize();
      panStep.set(0,0,0).addScaledVector(panForward,Number(panKeys.has('KeyW'))-Number(panKeys.has('KeyS'))).addScaledVector(panRight,Number(panKeys.has('KeyD'))-Number(panKeys.has('KeyA')));
      if(panStep.lengthSq()){panStep.normalize().multiplyScalar(dt*4);camera.position.add(panStep);orbit.target.add(panStep);}
    }
    if(coverTurn){
      const u=Math.min(1,(now-coverTurn.start)/coverTurn.duration),p=ease(u),opening=coverTurn.from===-1,presentation=sampleCoverPresentation(u,opening,coverTurn.fromFold),open=presentation.openness;
      const active=opening?coverTurn.to:coverTurn.from;
      coverHinge.rotation.z=Math.PI*open;coverHinge.position.y=THREE.MathUtils.lerp(.16,BOOK_PAGE_FRAME.flatY+BOOK_PAGE_FRAME.insideOffset,open);
      coverGroup.visible=!presentation.live;bookBody.visible=presentation.live;coverInside.visible=!presentation.live;flatPages[0].visible=false;flatPages[1].visible=!presentation.live;leaf.visible=false;edgeGlow.visible=false;
      for(let i=0;i<spreads.length;i++)spreads[i].group.visible=presentation.live&&i===active;
      const scene=spreads[active];pose(scene,presentation.popup);turnPopups.update(open,true);canvas.dataset.turnPopupCount=String(turnPopups.count);canvas.dataset.turnPopupOpen=presentation.popup.toFixed(4);canvas.dataset.turnPopupPoses=JSON.stringify(Object.fromEntries([...pageRuntime.bindings.get(active+1)!.values()].filter(b=>b.popup).map(b=>[b.id,b.popup!.driver.userData.popupOpen])));
      canvas.dataset.pageCacheSize=String(baker.size);canvas.dataset.coverStage=presentation.stage;canvas.dataset.coverOpenness=open.toFixed(4);canvas.dataset.liveSpread=String(presentation.live?active:-1);canvas.dataset.cachedCover=String(!presentation.live);
      const destination=coverTurn.arrival?(responsiveFraming?.resolve(coverTurn.arrival.shot,coverTurn.to+1)??coverTurn.destination):coverTurn.destination;canvas.dataset.coverProgress=u.toFixed(4);
      if(coverTurn.cinematic||reduced.matches)applyBookShot(camera,orbit.target,interpolateBookShot(coverTurn.initial,destination,coverTurn.arrival?.easing==='linear'?u:p));renderer.shadowMap.needsUpdate=true;
      if(u===1){const interrupted=!coverTurn.cinematic&&!reduced.matches,arrived=coverTurn.cinematic||reduced.matches?coverTurn.arrival:undefined;turnPopups.restore();index=coverTurn.to;coverTurn=null;coverInside.visible=false;flatPages.forEach(flat=>flat.visible=false);releaseTurnPages();canvas.dataset.cachedCover='false';canvas.dataset.coverStage=index===-1?'closed':'open';coverGroup.visible=index===-1;bookBody.visible=index!==-1;for(let i=0;i<spreads.length;i++)spreads[i].group.visible=i===index;foldAmount=targetFold=1;orbit.enabled=true;sync();if(arrived)responsiveFraming?.adopt(arrived.shot.framing,arrived.shot);else if(interrupted)responsiveFraming?.manual();}
    }else if(transition){
      edgeGlow.visible=false;
      const rawT=Math.min(1,(now-transition.start)/transition.duration);
      const t=transition.caveEntry && !reduced.matches ? Math.min(1,rawT/.7) : rawT;
      const outgoing=spreads[transition.from],incoming=spreads[transition.to];
      // Seat the place marker before the first travelling leaf.
      const insertEnd=transition.insert?.22:0;
      if(transition.insert){returnRibbon.visible=true;returnRibbon.position.x=THREE.MathUtils.lerp(7.9,6.15,ease(Math.min(1,t/insertEnd)));returnRibbon.position.y=.17;}
      const phase=THREE.MathUtils.clamp((t-insertEnd)/(1-insertEnd),0,1);
      pose(outgoing,transition.fromFold*(1-ease(Math.min(1,phase/.19))));
      if(transition.caveEntry && !reduced.matches){
        const flight=caveFlight.hinge, mat=caveFlight.mesh.material as THREE.MeshStandardMaterial;
        const lift=ease(Math.min(1,rawT/.13)); const travelIn=THREE.MathUtils.clamp((rawT-.7)/.3,0,1);
        flight.visible=true;outgoing.cave!.visible=false;
        if(rawT<.7){flight.position.set(THREE.MathUtils.lerp(BOOK_SCENES[0].props[0].x,0,lift),THREE.MathUtils.lerp(THREE.MathUtils.lerp(.15,5.5,lift),.2,ease(THREE.MathUtils.clamp((rawT-.6)/.1,0,1))),THREE.MathUtils.lerp(BOOK_SCENES[0].props[0].z,-2.9,lift));flight.scale.setScalar(1);mat.opacity=1;}
        else {flight.position.set(0,.2,THREE.MathUtils.lerp(-3.1,4.4,ease(travelIn)));flight.scale.setScalar(1+travelIn*.65);mat.opacity=1-ease(THREE.MathUtils.clamp((travelIn-.45)/.55,0,1));}
        canvas.dataset.cavePhase=rawT<.13?'lift':rawT<.7?'turn':'reveal';
      }
      leaf.visible=!reduced.matches&&phase>.19&&phase<.79;
      const showingFlat=!reduced.matches&&phase>=.19&&phase<.79;
      for(const flat of flatPages)flat.visible=showingFlat;
      canvas.dataset.leafTextured=String(leaf.visible&&!!frontMaterial.map&&!!backMaterial.map);
      if(showingFlat){outgoing.group.visible=false;incoming.group.visible=false;}
      const progress=THREE.MathUtils.clamp((phase-.19)/.6,0,1);
      turnPopups.update(progress);for(const b of pageRuntime.bindings.get(transition.to+1)!.values())if(b.popup){const delay=b.popup.driver.userData.popupDelay??0;rise(b.popup.driver,THREE.MathUtils.clamp((progress-delay)/(1-delay),0,1));}canvas.dataset.turnPopupCount=String(turnPopups.count);canvas.dataset.turnPopupOpen=progress.toFixed(4);
      const count=transition.leaves,cycle=Math.min(count-1,Math.floor(progress*count));
      const u=progress===1?1:progress*count-cycle,forward=transition.to>transition.from;
      canvas.dataset.leafProgress=u.toFixed(3);
      canvas.dataset.leaf=String(cycle+1);canvas.dataset.phase=transition.insert&&t<insertEnd?'bookmark':leaf.visible?'pages':'settle';
      const a=ease(u)*Math.PI;
      const pos=leafGeo.attributes.position;
      for(let j=0;j<pos.count;j++){
        const x=rest[j*3];const theta=(forward?a:Math.PI-a)+Math.sin((x-(BOOK_PAGE_FRAME.center-BOOK_PAGE_FRAME.width/2))/BOOK_PAGE_FRAME.width*Math.PI)*Math.sin(a)*.16;
        pos.setXYZ(j,x*Math.cos(theta),x*Math.sin(theta),rest[j*3+2]);
      }
      pos.needsUpdate=true;leafGeo.computeVertexNormals();leafGeo.computeBoundingSphere();
      if(phase>=.79){outgoing.group.visible=false;incoming.group.visible=true;if(transition.caveEntry && !reduced.matches){const p=THREE.MathUtils.clamp((rawT-.7)/.3,0,1);revealBehind(incoming,THREE.MathUtils.lerp(-4.8,5.5,ease(p)));}else pose(incoming,1);}
      if(transition.cinematic){
        if(transition.destination){const p=transition.arrival?.easing==='linear'?rawT:ease(rawT);applyBookShot(camera,orbit.target,interpolateBookShot({position:transition.cameraFrom.toArray(),target:transition.targetFrom.toArray(),fov:transition.fovFrom},transition.arrival?(responsiveFraming?.resolve(transition.arrival.shot,transition.to+1)??transition.destination):transition.destination,p));}else{const p=ease(transition.caveEntry?rawT:t),destination=views[transition.to];camera.position.lerpVectors(transition.cameraFrom,destination,p);
        const arch=Math.sin(Math.PI*p);camera.position.y+=arch*2.1;camera.position.z+=arch*1.8;camera.position.x+=(forward?1:-1)*arch*1.7;
        orbit.target.lerpVectors(transition.targetFrom,new THREE.Vector3(0,transition.to===DEN_INTERIOR_INDEX?.8:.2,0),p);orbit.target.x+=(forward?.45:-.45)*arch;camera.lookAt(orbit.target);}
      }
      if(rawT===1){const interrupted=!transition.cinematic&&!reduced.matches,arrived=transition.cinematic?transition.arrival:undefined;if(transition.caveEntry){caveFlight.hinge.visible=false;spreads[0].cave!.visible=true;canvas.dataset.cavePhase='idle';}turnPopups.restore();index=transition.to;transition=null;orbit.enabled=true;foldAmount=1;targetFold=1;pose(incoming,1);leaf.visible=false;flatPages.forEach(flat=>flat.visible=false);releaseTurnPages();canvas.dataset.leafTextured='false';canvas.dataset.phase='idle';sync();if(arrived)responsiveFraming?.adopt(arrived.shot.framing,arrived.shot);}
    }else{foldAmount=reduced.matches?targetFold:THREE.MathUtils.damp(foldAmount,targetFold,7,dt);if(Math.abs(foldAmount-targetFold)<.001)foldAmount=targetFold;pose(spreads[index],foldAmount);}
    const cave=spreads[0].cave; if(cave && !transition){const v=THREE.MathUtils.damp(cave.scale.x,caveHover?1.08:1,7,dt);if(Math.abs(cave.scale.x-v)>.0001)renderer.shadowMap.needsUpdate=true;cave.scale.setScalar(v);cave.traverse(child=>{if(child instanceof THREE.Mesh){const mat=child.material as THREE.MeshStandardMaterial;mat.emissiveIntensity=THREE.MathUtils.damp(mat.emissiveIntensity,caveHover?.18:0,5,dt);}});}
    const s=BOOK_SCENES[index],spread=spreads[index],done=visited.has(index);
    if(s&&spread.target){local.color.setHex(s.glow);local.position.x=spread.target.parent!.position.x;local.position.z=spread.target.parent!.position.z;}
    const moodPage=coverTurn?(Number(canvas.dataset.liveSpread)>=0?Number(canvas.dataset.liveSpread)+1:0):index+1;const savedMood=pageEditor.atmosphere(moodPage),mood=isWoodland(index)?forestFog(savedMood,shotBookOpen===undefined?9:woodlandVisualTime(index,shotBookTime),index===4?1:shotBookOpen??foldAmount):savedMood;atmosphere.set(mood);fill.intensity=1.4*atmosphere.lightFactor;key.intensity=1.6*atmosphere.lightFactor;renderer.setClearColor(mood.enabled?mood.color:'#171d21');
    local.intensity=index===-1||index===MAP_INDEX||BOOK_SCENES[index]?.emptyBase||transition||coverTurn?0:(done?35:12)*foldAmount*atmosphere.lightFactor;craft.lightCards(key,local);
    if(spread.lightMark){spread.lightMark.visible=!isWoodland(index)&&!folded&&!transition;spread.lightMark.scale.setScalar(reduced.matches?1:1+Math.sin(now*.002)*.07);}
    if(spread.hero && !folded && !spread.hero.userData.pageAuthored){const x=THREE.MathUtils.damp(spread.hero.position.x,done?.6:-.9,2,dt);if(Math.abs(x-spread.hero.position.x)>.0001)renderer.shadowMap.needsUpdate=true;spread.hero.position.x=x;}
    if(eventUntil&&now>eventUntil){el('event').textContent='';eventUntil=0;}
    if(denCameraActive && !transition && index===DEN_INTERIOR_INDEX&&!isWoodland(index)){
      const p=ease(foldAmount);applyBookShot(camera,orbit.target,interpolateBookShot({position:denFlatView.toArray(),target:[0,.2,0],fov:38},{position:denOpenView.toArray(),target:[0,1,0],fov:38},p));
      if(Math.abs(foldAmount-targetFold)<.002){foldAmount=targetFold;denCameraActive=false;}
    }else if((tourCameraUnlocked&&cameraNotebook.playing||shotBookOpen===undefined&&!cameraNotebook.playing)&&!coverTurn&&(!transition||!transition.cinematic))orbit.update();
    groundPaint.update();canvas.dataset.groundPaintCaptures=String(groundPaint.captures);canvas.dataset.paintedStands=String(groundPaint.standCount);responsiveFraming?.frame();cameraNotebook.update(realDt,reduced.matches);pagePaint.update(paintSkipElapsed?0:realDt,reduced.matches,document.hidden||cameraNotebook.paused||!!transition||!!coverTurn);paintSkipElapsed=false;canvas.dataset.paintProgress=pagePaint.progress(index+1).toFixed(3);canvas.dataset.paintRegions=JSON.stringify(Object.fromEntries((pageEditor.layout(index+1)?.controls??[]).filter(c=>c.kind==='paint-region').map(c=>[c.id,pagePaint.timeline.value(index+1,c.id)])));camera.updateMatrixWorld();canvas.dataset.cameraTarget=orbit.target.toArray().map(v=>v.toFixed(5)).join(',');
    if(now-lastHud>=250){lastHud=now;
    const offset=camera.position.clone().sub(orbit.target),radius=offset.length();
    cameraReadout.textContent='pos '+camera.position.toArray().map(v=>v.toFixed(2)).join(', ')+' · target '+orbit.target.toArray().map(v=>v.toFixed(2)).join(', ')+'\nyaw '+THREE.MathUtils.radToDeg(Math.atan2(offset.x,offset.z)).toFixed(1)+'° · pitch '+THREE.MathUtils.radToDeg(Math.asin(offset.y/radius)).toFixed(1)+'° · height '+camera.position.y.toFixed(2)+' · distance '+radius.toFixed(2)+' · FOV '+camera.fov.toFixed(1);
    projectButton(mapButton,6.9,-.12,-1.6);
    mapButton.hidden=returnButton.hidden=true;returnRibbon.visible=mapRibbon.visible=false;
    if(!transition?.insert)returnRibbon.position.set(6.15,index===returnIndex?.17:-.09,.1);
    projectButton(returnButton,returnRibbon.position.x+.75,returnRibbon.position.y,.1);
    document.querySelectorAll<HTMLButtonElement>('[data-map-stop]').forEach(b=>{const p=MAP_STOPS[Number(b.dataset.mapStop)];projectButton(b,p.x,.18,p.z);});
    canvas.dataset.reliefNormals=(spreads[index].hinges.filter(h=>h.parent?.userData.paperMount)).map(h=>{h.updateWorldMatrix(true,true);const m=h.children[0] as THREE.Mesh;return new THREE.Vector3(0,0,1).transformDirection(m.matrixWorld).y.toFixed(3)+':'+h.rotation.x.toFixed(2);}).join(',');
    canvas.dataset.wingAngles=(spreads[index].wings??[]).map(w=>w.rotation.z.toFixed(3)).join(',');
    canvas.dataset.camera=camera.position.toArray().map(v=>v.toFixed(3)).join(',');
    for(const [name,x] of [['leftEdge',-5.5],['rightEdge',5.5]] as const){
      const p=new THREE.Vector3(x,.14,1).project(camera);canvas.dataset[name]=`${canvas.getBoundingClientRect().left+(p.x*.5+.5)*viewportWidth},${canvas.getBoundingClientRect().top+(-p.y*.5+.5)*viewportHeight}`;
    }
    }
    for(const page of [2,3,4,5])pagePaint.setForestPaint(page,page===index+1?forestPaintState:undefined);pagePaint.setForestPaint(-1,isWoodland(index)?forestPaintState:undefined);pagePaint.setProximityPaint(5,index===4&&shotBookOpen!==undefined?perimeterPaint.texture:null);pagePaint.setProximityPaint(-1,index===4&&shotBookOpen!==undefined?perimeterPaint.texture:null);
    const paint=forestPaintState??pagePaint.progress(index+1),visualTime=woodlandVisualTime(index,shotBookTime);
    if(isWoodland(index)&&index!==4&&shotBookOpen!==undefined&&paint===1&&!filmPageColored){filmPageColored=true;releaseTurnPages();coverInside.material.map=capturePage(index,'left');flatPages[1].material.map=capturePage(index,'right');coverInside.material.needsUpdate=true;flatPages[1].material.needsUpdate=true;}
    presentShotBook();
    const forestEnabled=isWoodland(index)&&!transition&&!coverTurn;
    if(index===4&&shotBookOpen!==undefined){if(shotBookTime<28)perimeterReleaseAt=undefined;else if(perimeterReleaseAt===undefined)perimeterReleaseAt=ambienceTime;perimeterReleaseAge=perimeterReleaseAt===undefined?0:Math.max(0,ambienceTime-perimeterReleaseAt);}else{perimeterReleaseAt=undefined;perimeterReleaseAge=0;}
    canvas.dataset.clearingLightAge=perimeterReleaseAge.toFixed(3);
    const lightState=forestLights.update(shotBookOpen===undefined?9:visualTime,shotBookOpen??foldAmount,forestEnabled,canvas.height,paint,ambienceTime,index===4&&shotBookOpen!==undefined?forestActivation:undefined,index===4?perimeterReleaseAge:undefined);
    const finalMood=isWoodland(index)?forestFog(savedMood,shotBookOpen===undefined?9:woodlandVisualTime(index,shotBookTime),index===4?1:shotBookOpen??foldAmount):savedMood;atmosphere.set(finalMood,isWoodland(index)?[-9.1,-5.9,9.1,3.7]:undefined,index===4);atmosphere.maskPaint(isWoodland(index)?paint:undefined);renderer.setClearColor(index===4?'#050c13':isWoodland(index)?'#171d21':finalMood.enabled?finalMood.color:'#171d21');
    mochiPortraitLight.intensity=0;
    if(index===3&&shotBookOpen===1){const character=[...pageRuntime.bindings.get(4)!.values()].find(b=>b.id.startsWith('mochi4-')&&b.root.visible);if(character){const center=character.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,character.root.userData.treePerch?1.9:.6,0));mochiPortraitLight.position.copy(center).addScaledVector(camera.position.clone().sub(center).normalize(),1.4);const p=mochiPortraitLight.position;mochiPortraitLight.intensity=2.2*heroMoment(character.id,shotBookTime).open*forestPaintBehind(paint,p.x,p.y,p.z);}}
    const night=forestEnabled?lightState.night:0;fill.intensity=1.4*atmosphere.lightFactor*(1-night*(index===4?.38:.82));key.intensity=1.6*atmosphere.lightFactor*(1-night*(index===4?.35:.67));key.color.set('#fff1db').lerp(new THREE.Color('#99c8f0'),night);key.position.set(-4+night*7,10-night*3,5-night*8);
    if(forestEnabled)local.intensity=0;craft.lightCards(key,forestEnabled?forestLights.root.children.find(o=>o instanceof THREE.PointLight) as THREE.PointLight:local);
    canvas.dataset.ambienceTime=ambienceTime.toFixed(3);canvas.dataset.forestLampPositions=JSON.stringify(forestLights.root.children.filter(o=>o instanceof THREE.PointLight).map(o=>o.position.toArray()));canvas.dataset.forestLight=lightState.lamps.toFixed(3);
    starSky.update(camera,index===4,index===4?1:shotBookOpen??foldAmount,renderer.getPixelRatio());canvas.dataset.skyStars=index===4?'640':'0';
    const magic=coverMagic.update(shotBookTime,isWoodland(index)&&shotBookOpen!==undefined,camera,canvas.height);canvas.dataset.magicPhase=magicPhase(shotBookTime,woodlandPaintEnd(index),woodlandClose(index));canvas.dataset.coverSparkles=String(magic.active);canvas.dataset.coverShimmer=magic.shimmer.toFixed(3);
    const weather=forestWeather.update(shotBookOpen===undefined?9:visualTime,index===4?1:shotBookOpen??foldAmount,forestEnabled,camera,canvas.height,paint,ambienceTime,index===4&&shotBookOpen!==undefined?forestActivation:undefined,index===4?perimeterReleaseAge:undefined,index===4);canvas.dataset.forestAtmosphere=weather.toFixed(3);
    const sparkle=paintSparkles.update(shotBookOpen===undefined?0:shotBookTime,paint,shotBookOpen??foldAmount,forestEnabled&&shotBookOpen!==undefined,canvas.height,index===4?perimeterPaint:undefined);canvas.dataset.forestPaint=paint.toFixed(4);canvas.dataset.paintSparkles=String(sparkle.active);canvas.dataset.sparkleSourceReads=String(paintSparkles.sourceReads);canvas.dataset.atmosphericMotes=String(lightState.visible);canvas.dataset.heroMoments=JSON.stringify(Object.fromEntries([...pageRuntime.bindings.get(index+1)!.values()].filter(b=>b.id.startsWith('hero3-')).map(b=>[b.id,{visible:b.root.visible,open:b.popup?.driver.userData.popupOpen??0}])));
    canvas.dataset.mochiMoments=JSON.stringify(Object.fromEntries([...pageRuntime.bindings.get(index+1)!.values()].filter(b=>b.id.startsWith('mochi4-')).map(b=>[b.id,{visible:b.root.visible,open:b.popup?.driver.userData.popupOpen??0,combined:!!b.root.userData.treePerch}])));
    canvas.dataset.pageExtensions=JSON.stringify(Object.fromEntries([...pageRuntime.bindings.get(index+1)!.values()].filter(b=>b.root.userData.pageExtension).map(b=>[b.id,b.root.userData.extensionOpen])));
    storyPresentation.update(camera,transition||coverTurn||shotBookOpen!==undefined&&shotBookOpen<1?null:spreads[index].group,dt,reduced.matches,foldAmount);
    pageEditor.frame();
    sceneCpu=performance.now()-frameStart;
    if(index===4&&assetsReady){if(now-lastShadowRefresh<1000/30)renderer.shadowMap.needsUpdate=false;else lastShadowRefresh=now;}
    renderer.render(world,camera);presentBookFrame(canvas);requestAnimationFrame(frame);
  }
  function hostPlay(){return document.querySelector<HTMLButtonElement>('#book-navigator [data-scene="play"]')!;}
  function warmCurrentScene():Promise<void>{
    if(preparationTask)return preparationTask;if(warmedPages.has(index+1))return Promise.resolve();
    preparationTask=prepareCurrentScene().finally(()=>{preparationTask=undefined;});return preparationTask;
  }
  async function prepareCurrentScene(){
    if(preparing)return;preparing=true;assetsReady=false;canvas.dataset.assetsReady='false';forestPlay.disabled=hostPlay().disabled=true;bookLoading.show(warmedPages.size>0);bookLoading.report(.7,'Preparing the scene');await nextBookPaint();
    const shadowSize=index===4?1024:2048;if(key.shadow.mapSize.x!==shadowSize){key.shadow.map?.dispose();key.shadow.map=null;key.shadow.mapSize.set(shadowSize,shadowSize);renderer.shadowMap.needsUpdate=true;}
    const startPage=index+1,editing=(new URLSearchParams(location.search).get('Edit')??new URLSearchParams(location.search).get('edit'))?.toLowerCase()==='true',initial=captureBookCamera(camera,orbit.target);
    try{
      if(index===4){forestPaintMemory.set(5,1);forestPaintState=1;pagePaint.setForestPaint(5,1);if(!editing){perimeterPaint.reset();pagePaint.setProximityPaint(5,perimeterPaint.texture);pagePaint.setProximityPaint(-1,perimeterPaint.texture);}}
      groundPaint.update();pagePaint.update(0,reduced.matches,true);
      if(index>=0){coverInside.material.map=baker.page(index,'left');flatPages[1].material.map=baker.page(index,'right');coverInside.material.needsUpdate=flatPages[1].material.needsUpdate=true;}
      const images=new Set<THREE.Texture>([inkSprite]);for(const uploadRoot of [coverGroup,bookBody,spreads[index]?.group??coverGroup,forestLights.root,forestWeather.root])uploadRoot.traverse(object=>{const material=(object as THREE.Mesh).material;for(const mat of Array.isArray(material)?material:material?[material]:[]){for(const value of Object.values(mat))if(value instanceof THREE.Texture)images.add(value);for(const uniform of Object.values((mat as THREE.ShaderMaterial).uniforms??{}))if(uniform.value instanceof THREE.Texture)images.add(uniform.value);}});
      let uploaded=0;for(const texture of images){renderer.initTexture(texture);if(++uploaded%24===0){bookLoading.report(.72+.12*uploaded/images.size,'Uploading textures',uploaded,images.size);await nextBookPaint();}}
      bookLoading.report(.86,'Preparing shaders');forestLights.update(9,1,true,canvas.height,1,0);forestWeather.update(9,1,true,camera,canvas.height,1,0);await renderer.compileAsync(world,camera);await nextBookPaint();
      if(index>=0){coverGroup.visible=false;bookBody.visible=true;spreads[index].group.visible=true;pose(spreads[index],1);}renderer.shadowMap.needsUpdate=true;renderer.render(world,camera);await nextBookPaint();
      if(index>=0){spreads[index].group.visible=false;bookBody.visible=false;coverGroup.visible=true;coverInside.visible=true;flatPages[1].visible=true;coverHinge.rotation.z=Math.PI/2;renderer.shadowMap.needsUpdate=true;renderer.render(world,camera);await nextBookPaint();}
      coverInside.visible=false;flatPages.forEach(p=>p.visible=false);coverGroup.visible=index===-1;bookBody.visible=index!==-1;for(let i=0;i<spreads.length;i++)spreads[i].group.visible=i===index;coverHinge.rotation.z=index===-1?0:Math.PI;
      if(isWoodland(index)&&!editing){setShotBookOpen(0,0);const first=cameraNotebook.openingForPage(startPage);if(first)applyBookShot(camera,orbit.target,responsiveFraming?.resolve(first.shot,startPage)??first.shot);presentShotBook();}else{applyBookShot(camera,orbit.target,initial);if(index>=0)pose(spreads[index],foldAmount);}
      forestLights.update(9,isWoodland(index)&&!editing?0:foldAmount,isWoodland(index),canvas.height,1,0);await renderer.compileAsync(world,camera);
      bookLoading.report(.96,'Settling the first frames');for(let i=0;i<3;i++){renderer.shadowMap.needsUpdate=true;renderer.render(world,camera);await nextBookPaint();}
      warmedPages.add(startPage);assetsReady=true;canvas.dataset.assetsReady='true';canvas.dataset.preparedTextures=String(images.size);forestPlay.disabled=false;hostPlay().disabled=false;last=statsTime=performance.now();statsFrames=0;statsPeak=0;bookLoading.report(.99,'Ready');if(document.documentElement.dataset.bookBoot==='ready')bookLoading.finish();
    }finally{preparing=false;}
  }
  await warmCurrentScene();
  requestAnimationFrame(frame);
}
if(['stellarcombat','fullgrid'].some(key=>new URLSearchParams(location.search).has(key)))import('../stellar/stellarCombat').then(m=>m.startStellarCombat()).catch(error=>{bookLoading.fail();el('book-error').hidden=false;el('book-error').textContent='Stellar combat could not open: '+error.message;console.error(error);});
else if(new URLSearchParams(location.search).has('city'))import('../city/cityGame').then(m=>m.startCityGame()).catch(error=>{bookLoading.fail();el('book-error').hidden=false;el('book-error').textContent='The city could not open: '+error.message;console.error(error);});
else if(requestedPage===117){const root=document.createElement('div');root.id='root';document.body.replaceChildren(root);void import('../musical/main');}
else if(requestedPage>=118&&requestedPage<=120||requestedPage===1110||requestedPage===1111)import('./castleWorld').then(m=>m.startCastleWorld(canvas,requestedPage as 118|119|120|1110|1111)).catch(error=>{bookLoading.fail();el('book-error').hidden=false;el('book-error').textContent='The world could not open: '+error.message;console.error(error);});
else if(requestedPage===23)import('./believeFilm').then(m=>m.startBelieveFilm(canvas)).catch(error=>{bookLoading.fail();el('book-error').hidden=false;el('book-error').textContent='Believe could not open: '+error.message;console.error(error);});
else if(requestedPage===22)import('./platformer').then(m=>m.startBookPlatformer(canvas)).catch(error=>{bookLoading.fail();el('book-error').hidden=false;el('book-error').textContent='The living margins could not open: '+error.message;console.error(error);});
else if(new URLSearchParams(location.search).has('combatsbx'))import('./combatSandbox').then(m=>m.startBookCombatSandbox(canvas)).catch(error=>{bookLoading.fail();el('book-error').hidden=false;el('book-error').textContent='The combat arena could not open: '+error.message;console.error(error);});
else if(new URLSearchParams(location.search).has('kirigami'))import('./kirigamiViewer').then(m=>m.startKirigamiViewer(canvas)).catch(error=>{bookLoading.fail();el('book-error').hidden=false;el('book-error').textContent=`The kirigami viewer could not open: ${error.message}`;console.error(error);});
else start().catch(error=>{bookLoading.fail();el('book-error').hidden=false;el('book-error').textContent=`The atlas could not open: ${error.message}`;console.error(error);});
