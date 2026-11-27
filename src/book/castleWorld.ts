import {HeroWorldDirector} from './heroWorldDirector';
import {createFlurryCompanion} from './flurryCompanion';
import {COMBAT_WOODS_START,createCombatWoodsArrival} from './combatWoodsArrival';
import {createWorldGridJump} from './worldGridJump';
import {woodsOverheadPose,woodsCameraFlightPose,woodsFoundationCinematicPose,WOODS_OVERHEAD_HEIGHT} from './combatWoodsCamera';
import {worldGridCoordinate,worldGridIndexAt} from './worldCombatGridLayout';
import {isTextEditingTarget} from '../proto/keyboardInput';
import {createSentientOverlap,type SentientOverlapMode} from './sentientOverlap';
import {createHeroWorldTextures} from './heroWorldTextures';
import {HERO_WORLD_ACTIONS,heroWorldActionFrame,type HeroWorldAction} from './heroWorldActions';
import type {WorldScaffold} from './worldScaffold';
import {createPortalControls,emptyPortalPad} from './portalControls';
import {createWorldPortalGuard} from './worldPortalGuard';
import {controllerPortalEntry} from './controllerPortalEntry';
import {createWorldCombatWoods,COMBAT_WOODS} from './worldCombatWoods';
import {createWoodsSpellTest} from './woodsSpellTest';
import type {PaintSplatVariant} from './splat/paintSplatVariant';

import {createWorldTreeScene,createTreeMovement,treeGround,treeWalkable,riverAt} from './worldTreeScene';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createBookPaper} from './bookPaper';
import {createBookLoading, nextBookPaint} from './bookLoading';
import {presentBookFrame} from './bootPresentation';
import {bookRenderQuality, createBookViewport, setBookRenderQuality, type BookRenderQuality} from './viewportPolicy';
import {groundHeight, CASTLE as C, CASTLE_MAX_PITCH, SHOULDER, SURFACE, TOWER_CIRCLES, WALL_RECTS, resolveMove, sampleFlight, shoulderPose} from './castleLayout';
import {paintBlob, paintFeather, paintFelt, paintFieldPrint, paintGlow, paintKeep, paintPaving, paintScales, paintStone, paintWater, paintWood, seeded} from './castlePaint';
import {WATERCOLOR_UNIFORMS, applyWatercolor, paintWcBank, paintWcField, paintWcGroundsStone, paintWcKeep, paintWcPaving, paintWcScales, paintWcStone, paintWcWater, paintWcWood} from './castleWatercolor';
import {HERO_RIG_SHEETS, HERO_RIG_SIZE, bearing, heroRigFrame} from './castleHeroRig';
import {CASTLE_IDLE_ATLAS, CASTLE_IDLE_VIEWS, CastleHeroIdle, castleIdleRect, castleIdleView} from './castleHeroIdle';
import {addCastleGrounds} from './castleGrounds';
import {addGroundsArchitecture, groundsCornerTower} from './castleGroundsArchitecture';
import {GROUNDS_BRIDGES, GROUNDS_FLIGHT, GROUNDS_SHOULDER, GROUNDS_START, groundsHeight, groundsMeadowHeight, groundsMeadowPitch, groundsWalkable} from './castleGroundsLayout';
import {createCastleBelieveArrival,CASTLE_BELIEVE_SECONDS,CASTLE_PORTAL_WORLD_LEAD_SECONDS} from './castleBelieveArrival';
import {CastlePlatformMotion, platformAirFrame} from './castlePlatformMotion';
import {castleSprintPaint} from './castleSprintPaint';
import {CastleGroundsNavigation} from './castleGroundsNavigation';
import {createGroundsAmbiance} from './castleGroundsAmbiance';
import {createCombatCameraControls} from '../proto/combatCameraControls';
import {createWoodsHandBoard} from './woodsHandBoardOverlay';
import {CastleCameraGestures} from './castleCameraGestures';
import {createCastleLanterns} from './castleLanterns';
import {createGroundsWater} from './castleWaterSurface';
import {createPlayerFog} from './castlePlayerFog';
import {createCastleNightSky} from './castleNightSky';
import {loadCastleMeadow, MEADOW_DOOR, MEADOW_SCALE} from './castleMeadow';
import {createMeadowCameraClearance, createMeadowCameraMotion} from './castleMeadowCamera';
import {createMeadowPortalSound, createMeadowPortalView, KEEP_MEADOW_DOOR, MeadowPortalEnd} from './castleMeadowPortal';
import type {SpriteView} from '../proto/directionalSprites';
import type {MeadowPoint,MeadowTravelIntent} from './castleMeadowNavigation';
import {createJourneyCamera,type JourneyLandmark} from './castleJourneyCamera';
import {CastleBridgePuzzle,BRIDGE_HALF_WIDTH} from './castleBridgePuzzle';
import {createBridgeExperience} from './castleBridgeExperience';
import {directGroundsArrival,groundedOrbitPose,orbitLookTarget,BRIDGE_HERO_START} from './castleArrival';
import {createClearArrivalFlight} from './clearArrivalFlight';
import {createWorldStudioEngine} from './worldStudioEngine';
import {createWorldStudio} from './worldStudio';
import {validWorldStudioDocument,type WorldStudioDocument} from './worldStudioDocument';
import {WORLD_1111_LAYOUT,WORLD_TREE_PORTAL_ARRIVAL} from './world1111Layout';
import {worldStart} from './worldStart';
import {createWorldPropInteraction} from './worldPropInteraction';
import {createWorldFlurry} from './worldFlurry';
import {createCameraTelemetryFlyout} from './cameraTelemetryFlyout';
import studioDefaults from '../data/worldStudio1110.json';
import studio1111Defaults from '../data/worldStudio1111.json';
import {createCastlePickupEffects} from './castlePickupEffects';
import {createCastleStoryIdentity} from './castleStoryIdentity';
import {createBridgeJourneyCamera,bridgeJourneyDestination} from './castleBridgeJourneyCamera';
import {createCastleValley} from './castleValley';
import {pointApproachTarget,visiblePointHit,type ApproachTarget} from './pointApproach';
import './castleWorld.css';

type Tier = {shadows: 0 | 1024 | 2048; trees: number; stars: number; motes: number; antialias: boolean; edgeBlur: boolean};
const TIERS: Record<BookRenderQuality, Tier> = {
  low: {shadows: 0, trees: 26, stars: 450, motes: 0, antialias: false, edgeBlur: false},
  auto: {shadows: 1024, trees: 56, stars: 1400, motes: 260, antialias: true, edgeBlur: true},
  medium: {shadows: 1024, trees: 56, stars: 1400, motes: 260, antialias: true, edgeBlur: true},
  high: {shadows: 2048, trees: 80, stars: 2200, motes: 420, antialias: true, edgeBlur: true},
};

/** Box-projected UVs in metres/tile so merged stonework shares one repeating texture. */
function projectUV(geo: THREE.BufferGeometry, tile: number) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i) / tile, p.getZ(i) / tile);
    else if (ax >= az) uv.setXY(i, p.getZ(i) / tile, p.getY(i) / tile);
    else uv.setXY(i, p.getX(i) / tile, p.getY(i) / tile);
  }
  uv.needsUpdate = true; return geo;
}
const scaleUV = (geo: THREE.BufferGeometry, su: number, sv: number) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; };
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** The castle pop-up as a walkable world. The arrival flight settles behind
 * Hero in the courtyard on page 117 or at the drawbridge on page 118. */
const SPLAT_PREFERENCE = 'exploritaire.world-splats.v1';
export async function startCastleWorld(canvas: HTMLCanvasElement, page: 117 | 118 | 119 | 120 | 1110 | 1111 = 117) {
  const portals=location.pathname.endsWith('/portals.html');
  const startLocation=page===1111?worldStart(location.search,portals):'grounds';
  const treeArrival=page===1111&&portals&&startLocation==='grounds'?WORLD_TREE_PORTAL_ARRIVAL:undefined;
  let treeOpeningHeld=!!treeArrival;
  const directCombat = startLocation==='woods' && new URLSearchParams(location.search).has('combat');
  const directStart=startLocation!=='woods'&&startLocation!=='grounds';
  let portalControls:ReturnType<typeof createPortalControls>|undefined,pad=emptyPortalPad();
  const workbench=page===1110||page===1111,grounds = page !== 117, natural=page===120||workbench, title = workbench?'World Tree · Paint Studio':natural?'The World Tree': page===119?'Building Bridges':grounds ? 'The castle grounds' : 'The castle';
  let studioDocument=structuredClone(page===1111?studio1111Defaults:studioDefaults) as WorldStudioDocument;
  if(workbench)try{const response=await fetch(`/__world-studio${page}`,{cache:'no-store'});if(response.ok){const data=await response.json();if(validWorldStudioDocument(data,workbench?page as 1110|1111:undefined))studioDocument=data;}}catch{/* Production uses the bundled authored document. */}
  let studioEngine:ReturnType<typeof createWorldStudioEngine>|undefined,studioEditor:Awaited<ReturnType<typeof createWorldStudio>>|undefined;
  const startEditing=workbench&&new URLSearchParams(location.search).get('Edit')==='true';
  let placedSolids:THREE.Box3[]=[],knownSolids:THREE.Box3[]=[];
  let groveBodyClear:(x:number,z:number,r:number,y:number)=>boolean=()=>true;
  const portalGuard=createWorldPortalGuard(),groundPortalDoors:MeadowPortalEnd[]=[];
  const avoidGroundPortals=(x:number,z:number,r=.45)=>!portalGuard.blocked(groundPortalDoors,x,z,r,castleSurfaceHeight(x,z));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heroStart = treeArrival?{x:treeArrival.hero.x,z:treeArrival.hero.z}:page===1111?WORLD_1111_LAYOUT.hero:natural?{x:0,z:75}:page>=119?BRIDGE_HERO_START:grounds ? GROUNDS_START : C.heroStart;
  const startHeading=treeArrival?.hero.heading??Math.PI;
  const bridgePuzzle=page===119?new CastleBridgePuzzle():undefined;
  const castleSurfaceHeight = natural?treeGround:bridgePuzzle?.height??(grounds ? groundsHeight : groundHeight);
  const startYaw=treeArrival?.camera.yaw??(page===1111?WORLD_1111_LAYOUT.camera.yaw:page>=119?.45:0);
  const startDistance=treeArrival?.camera.distance??(page===1111?WORLD_1111_LAYOUT.camera.distance:page>=119?7.5:grounds?GROUNDS_SHOULDER.distance:SHOULDER.distance);
  const startPitch=treeArrival?.camera.pitch??(page===1111?WORLD_1111_LAYOUT.camera.pitch:page>=119?.32:grounds?GROUNDS_SHOULDER.pitch:0);
  let waterArrival=shoulderPose(heroStart.x,heroStart.z,startYaw,startPitch,startDistance,castleSurfaceHeight(heroStart.x,heroStart.z));
  if(treeArrival)waterArrival={position:[...treeArrival.camera.position],target:[...treeArrival.camera.target]};
  else if(natural)waterArrival=groundedOrbitPose(waterArrival,startYaw,startPitch,treeGround);
  // The live i-dot portal feeds this direct approach without old bridge stops.
  const arrivalPath = page>=119?directGroundsArrival(waterArrival,{...heroStart,y:castleSurfaceHeight(heroStart.x,heroStart.z)},innerWidth/innerHeight,{constrainAim:!natural}):grounds ? GROUNDS_FLIGHT : undefined;
  let clearArrival:ReturnType<typeof createClearArrivalFlight>|undefined;
  const studioWalkable=(x:number,z:number,r=.45,y=treeGround(x,z))=>{if(!treeWalkable(x,z,r)||!avoidGroundPortals(x,z,r)||!groveBodyClear(x,z,r,y))return false;const blocked=(b:THREE.Box3)=>x>b.min.x-r&&x<b.max.x+r&&z>b.min.z-r&&z<b.max.z+r&&y+1.2>b.min.y&&y<b.max.y;return !placedSolids.some(blocked);};
  const groundsSurface=natural?createTreeMovement(studioWalkable):bridgePuzzle?.surface;
  let platform = grounds ? new CastlePlatformMotion(heroStart.x,heroStart.z,startHeading,groundsSurface) : undefined;
  const navigation = grounds ? new CastleGroundsNavigation((x,z,r=.45)=>(natural?studioWalkable(x,z,r):(bridgePuzzle?.walkable??groundsWalkable)(x,z,r))&&avoidGroundPortals(x,z,r)) : undefined;
  const stickerInteraction=navigation?createWorldPropInteraction(navigation):undefined;
  document.body.classList.add('castle-world'); document.title = `${page} · ${title} · Hero’s Journey`;
  const groundsControls = 'Click or tap to move Hero. Hold Control while clicking or tapping dry ground to teleport. Drag to look around. Pinch or scroll to zoom. Space jumps, C crouches or ground pounds, and X dives in the air. In Free camera, WASD and the arrow keys pan.';
  canvas.setAttribute('aria-label', `Page ${page}, ${title.toLowerCase()}. ${grounds ? groundsControls : 'Use W A S D or the arrow keys to walk Hero, hold Shift to run, drag to look around and scroll to zoom.'}`);
  const loading = createBookLoading(); loading.report(.04, 'Raising the castle'); await nextBookPaint();
  const quality = bookRenderQuality(), tier = {...TIERS[quality]};
  const meadowLoading = grounds&&(!natural||page===1111) ? loadCastleMeadow(quality,reduced).catch(error => {
    console.warn('Sacred Forest Meadow could not load',error);
    return undefined;
  }) : undefined;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: tier.antialias, powerPreference: 'high-performance'});
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = tier.shadows > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  const viewport = createBookViewport(renderer, canvas);
  let naturalGrove:ReturnType<typeof createWorldTreeScene>|undefined;
  let worldFlurry:Awaited<ReturnType<typeof createWorldFlurry>>|undefined,worldRewardOpen=false;
  // Painterly Gaussian splat variant (page 1111 grove and Sacred Forest Meadow).
  let groveSplats:PaintSplatVariant|undefined,meadowSplats:PaintSplatVariant|undefined,splatBuild:Promise<void>|undefined;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(26, 16 / 9, 1, 9000);
  const believeArrival=page>=119&&page!==1111?createCastleBelieveArrival(renderer):undefined;
  const freeControls = grounds ? createCombatCameraControls(camera, 'party', {minDistance: natural?.7:2.6, maxDistance: natural?450:165}) : undefined;
  let freeCamera = false;
  scene.fog = new THREE.FogExp2(grounds ? '#1c2d40' : '#161a24', grounds ? .0025 : .00085);
  const lanterns = grounds ? createCastleLanterns(reduced,page===119?9.6:4.4) : undefined;
  const playerFog = lanterns ? createPlayerFog(quality,reduced,lanterns.lights) : undefined;
  if(playerFog){
    playerFog.update(0,heroStart.x,castleSurfaceHeight(heroStart.x,heroStart.z),heroStart.z);
    lanterns!.setFogDecorator(playerFog.shade);
  }
  if (quality === 'low') lanterns?.setLow();
  const aniso = Math.min(quality === 'low' ? 2 : 8, renderer.capabilities.getMaxAnisotropy());
  // every scene material carries the watercolor chunk; the toggle flips a uniform and swaps maps
  const lambert = (o: THREE.MeshLambertMaterialParameters) => {
    const material = applyWatercolor(new THREE.MeshLambertMaterial(o));
    return lanterns ? lanterns.shade(material) : material;
  };
  const swaps: {material: THREE.MeshLambertMaterial; flat: THREE.Texture; wc: THREE.Texture}[] = [];
  const paintable = (material: THREE.MeshLambertMaterial, wc: THREE.Texture) => { swaps.push({material, flat: material.map!, wc}); return material; };
  let watercolor = true;
  try { const q = new URLSearchParams(location.search).get('watercolor'); watercolor = q ? q !== '0' : localStorage.getItem('exploritaire.book-watercolor.v1') !== 'off'; } catch { /* storage blocked: keep the default */ }
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, cast = true, receive = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); return m; };

  // ---------- painted surfaces ----------
  loading.report(.1, 'Painting stone and felt');
  const stoneTex = paintStone(), pavingTex = paintPaving(), keepTex = paintKeep(undefined,!grounds), scaleTex = paintScales(), waterTex = paintWater(), blobTex = paintBlob(), glowTex = paintGlow();
  const tabletopWood = grounds ? undefined : paintWood();
  loading.report(.16, 'Laying watercolor washes'); await nextBookPaint();
  const wcStone = grounds ? paintWcGroundsStone() : paintWcStone(), wcPaving = paintWcPaving(), wcKeep = paintWcKeep(undefined,!grounds), wcScales = paintWcScales(), wcWater = paintWcWater(), wcWood = paintWcWood();
  if (grounds) stoneTex.repeat.setScalar(.25);
  for (const t of [stoneTex, pavingTex, keepTex.map, scaleTex, waterTex, wcStone, wcPaving, wcKeep, wcScales, wcWater, wcWood]) t.anisotropy = aniso;
  await nextBookPaint();

  // ---------- lighting: the warm lamp from the upper right, a cool night fill ----------
  scene.add(new THREE.HemisphereLight(grounds ? '#7999c1' : '#5d6d96', grounds ? '#303748' : '#3a2c20', grounds ? .55 : 1.7));
  const key = new THREE.DirectionalLight(grounds ? '#abc6ea' : '#ffd6a8', grounds ? .72 : 2.7); key.position.set(95, 125, 80); key.target.position.set(0, 0, 0); scene.add(key, key.target);
  if (tier.shadows) {
    key.castShadow = true; key.shadow.mapSize.set(tier.shadows, tier.shadows);
    Object.assign(key.shadow.camera, {left: -92, right: 92, top: 92, bottom: -92, near: 20, far: 420});
    key.shadow.bias = -.0006; key.shadow.normalBias = .04; key.shadow.radius = 3;
  }

  loading.report(.22, grounds ? 'Shaping the crater' : 'Opening the page');
  const water = paintable(lambert({color: grounds ? '#74b6e2' : '#cfe6f6', map: waterTex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4}), wcWater);
  const waterEffects = grounds ? createGroundsWater(water,quality,reduced,{movingReflections:page>=119,naturalRiver:natural}) : undefined;
  const ambiance = grounds ? createGroundsAmbiance(scene, tier.motes, reduced) : undefined;
  if (quality === 'low') ambiance?.setLow();
  if (tabletopWood) {
    // The open book and its printed field belong to the page 117 arrival.
    const paper = createBookPaper(renderer, undefined, quality === 'low' ? 768 : 1024);
    tabletopWood.anisotropy = aniso; tabletopWood.repeat.set(60, 60);
    const table = paintable(lambert({color: '#3a2519', map: tabletopWood}), wcWood);
    add(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2).translate(0, -14, 0), table, false, true);
    add(box(1580, 6, 1010, -390, -11, 0), lambert({color: '#5b2a2f'})); // leather cover
    const pageMat = lambert({color: '#efe6d2', map: paper.right}), leftPageMat = lambert({color: '#efe6d2', map: paper.left}), edgeMat = lambert({color: '#d9ccb0'});
    // The left page lies a touch lower across the gutter.
    add(box(770, 7.6, 990, 0, -4.1, 0), [edgeMat, edgeMat, pageMat, edgeMat, edgeMat, edgeMat] as unknown as THREE.Material);
    add(box(770, 7.6, 990, -782, -4.7, 0), [edgeMat, edgeMat, leftPageMat, edgeMat, edgeMat, edgeMat] as unknown as THREE.Material);
    const fieldTex = paintFieldPrint(C.field); fieldTex.anisotropy = aniso;
    const field = paintable(lambert({color: '#ffffff', map: fieldTex}), paintWcField(C.field));
    const fieldGeo = new THREE.CircleGeometry(C.field, 128), fuv = fieldGeo.attributes.uv;
    for (let i = 0; i < fuv.count; i++) fuv.setY(i, 1 - fuv.getY(i));           // print north is -z after the lay-flat turn
    add(fieldGeo.rotateX(-Math.PI / 2), field, false, true);
    const feltTex = paintFelt(), wcBank = paintWcBank();
    feltTex.anisotropy = wcBank.anisotropy = aniso;
    const bank = paintable(lambert({color: '#e2dcc4', map: feltTex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2}), wcBank);
    add(new THREE.RingGeometry(C.moat.inner - 3, C.moat.outer + 3, 128, 1).rotateX(-Math.PI / 2).translate(0, .06, 0), bank, false, true);
    waterTex.repeat.set(26, 3);
    const ring = new THREE.RingGeometry(C.moat.inner, C.moat.outer, 160, 1);
    const {position,uv} = ring.attributes;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i);
      uv.setXY(i,Math.atan2(y,x)/(Math.PI*2)+.5,(Math.hypot(x,y)-C.moat.inner)/(C.moat.outer-C.moat.inner));
    }
    add(ring.rotateX(-Math.PI / 2).translate(0, .12, 0), water, false, true);
  }
  const paving = paintable(lambert({color: '#efe4cc', map: pavingTex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2}), wcPaving); pavingTex.repeat.set(1, 1);
  const pavingGeo = mergeGeometries([new THREE.PlaneGeometry(C.court * 2, C.court * 2).rotateX(-Math.PI / 2), new THREE.PlaneGeometry(C.gateHalf * 2, C.wallThick + 1).rotateX(-Math.PI / 2).translate(0, 0, C.court + C.wallThick / 2)])!;
  const pavingSurface = add(projectUV(pavingGeo, 6).translate(0, .08, 0), paving, false, true);

  // ---------- stonework: walls, merlons, towers, gatehouse ----------
  loading.report(.36, 'Laying the walls');
  const H = C.wallHeight, o = C.court + C.wallThick / 2, stoneParts: THREE.BufferGeometry[] = [];
  const wallLen = (C.court + C.wallThick) * 2;
  stoneParts.push(box(wallLen, H, C.wallThick, 0, H / 2, -o), box(C.wallThick, H, wallLen, -o, H / 2, 0), box(C.wallThick, H, wallLen, o, H / 2, 0));
  const sideLen = C.court + C.wallThick - C.gateHalf;
  for (const s of [-1, 1]) stoneParts.push(box(sideLen, H, C.wallThick, s * (C.gateHalf + sideLen / 2), H / 2, o));
  const gateLintel = () => {
    if (!grounds) return box(C.gateHalf * 2, H - C.gateHeight, C.wallThick, 0, (H + C.gateHeight) / 2, o);
    const spring = C.gateHeight - C.gateHalf;
    const arch = new THREE.Shape().moveTo(-C.gateHalf,spring).absarc(0,spring,C.gateHalf,Math.PI,0,true);
    arch.lineTo(C.gateHalf,H).lineTo(-C.gateHalf,H).closePath();
    return new THREE.ExtrudeGeometry(arch,{depth:C.wallThick,bevelEnabled:false}).translate(0,0,C.court);
  };
  stoneParts.push(gateLintel());
  // merlons along the outer and inner lips
  const merlon = (x: number, z: number, alongX: boolean) => stoneParts.push(box(alongX ? 1.5 : .9, 1.9, alongX ? .9 : 1.5, x, H + .95, z));
  for (let t = -C.court; !grounds && t <= C.court; t += 3.2) for (const lip of [o + C.wallThick / 2 - .45, o - C.wallThick / 2 + .45]) {
    merlon(t, -lip, true); merlon(-lip, t, false); merlon(lip, t, false);
    if (Math.abs(t) > C.gateHalf + 1 || lip > o) merlon(t, lip, true);
  }
  const towerGeo = (r: number, h: number, x: number, z: number) => {
    const body = scaleUV(new THREE.CylinderGeometry(r, r * 1.04, h, 28, 1, true), Math.PI * 2 * r / 4, h / 4).translate(x, h / 2, z);
    const parts = [body];
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; parts.push(projectUV(box(1.4, 1.8, 1.4, x + Math.cos(a) * (r - .5), h + .9, z + Math.sin(a) * (r - .5)), 4)); }
    parts.push(projectUV(new THREE.CylinderGeometry(r + .5, r + .5, .9, 28).translate(x, h - .2, z), 4));
    return parts;
  };
  for (const g of stoneParts) projectUV(g, 4);
  const towerParts: THREE.BufferGeometry[] = [];
  for (const t of TOWER_CIRCLES) {
    const corner = t.r === C.cornerTower.radius, h = corner ? C.cornerTower.height : C.gateTower.height;
    towerParts.push(...(grounds && corner ? groundsCornerTower(t.x,t.z).map(g => projectUV(g,4)) : towerGeo(t.r, h, t.x, t.z)));
  }
  const stone = paintable(lambert({color: '#efebe4', map: stoneTex}), wcStone);
  add(mergeGeometries([...stoneParts, ...towerParts].map(g => g.index ? g.toNonIndexed() : g))!, stone);
  const groundsPaint = grounds ? addCastleGrounds(add,water,stone,wcWood,aniso,lanterns!.shade,waterEffects,page===119) : undefined;
  const valley=page===119?createCastleValley(quality):undefined;
  if(valley){
    if(playerFog){
      const shaded=new Set<THREE.MeshBasicMaterial>();
      valley.group.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material instanceof THREE.MeshBasicMaterial&&!shaded.has(material)){shaded.add(material);material.fog=false;playerFog.shadeActor(material);}});
    }
    scene.add(valley.group);
  }
  const lanternGroup=lanterns?.build(glowTex);
  if (lanternGroup) scene.add(lanternGroup);
  // the gate's dark passage and raised portcullis
  const iron = lambert({color: '#2b241f'});
  const portcullis: THREE.BufferGeometry[] = [];
  for (let x = -C.gateHalf + .5; x < C.gateHalf; x += .9) portcullis.push(box(.18, 3.4, .18, x, C.gateHeight - 1.6, o + .4));
  for (let y = C.gateHeight - 3.2; y < C.gateHeight; y += .9) portcullis.push(box(C.gateHalf * 2, .18, .18, 0, y, o + .4));
  add(mergeGeometries(portcullis)!, iron);

  // ---------- the keep, its windows aglow ----------
  const keepMat = paintable(lambert({color: '#f6eedf', map: keepTex.map, emissive: '#ffffff', emissiveMap: keepTex.emissive, emissiveIntensity: 1.1}), wcKeep);
  // turned 45° so the gate looks onto a corner, as the pop-up keep stands
  const keepGeo = new THREE.BoxGeometry(C.keep.half * 2, C.keep.height, C.keep.half * 2).rotateY(Math.PI / 4).translate(C.keep.x, C.keep.height / 2, C.keep.z);
  add(keepGeo, keepMat);
  const keepCrown: THREE.BufferGeometry[] = [projectUV(box(C.keep.half * 2 + 1.6, 1, C.keep.half * 2 + 1.6, 0, C.keep.height + .2, 0), 4)];
  for (let t = -C.keep.half; t <= C.keep.half; t += 2.75) for (const s of [-1, 1]) {
    keepCrown.push(projectUV(box(1.3, 1.7, .8, t, C.keep.height + 1.5, s * (C.keep.half + .4)), 4));
    keepCrown.push(projectUV(box(.8, 1.7, 1.3, s * (C.keep.half + .4), C.keep.height + 1.5, t), 4));
  }
  add(mergeGeometries(keepCrown.map(g => g.toNonIndexed()))!.rotateY(Math.PI / 4).translate(C.keep.x, 0, C.keep.z), stone);

  // ---------- cross arrow slits on towers and walls, one merged draw ----------
  // Grounds intentionally omit both the cross fronts and their square side faces.
  if (!grounds) {
  const slits: THREE.BufferGeometry[] = [];
  const slit = (x: number, y: number, z: number, yaw: number) => {
    for (const g of [new THREE.BoxGeometry(.32, 1.9, .12), new THREE.BoxGeometry(1.05, .3, .12).translate(0, .25, 0)]) slits.push(g.rotateY(yaw).translate(x, y, z));
  };
  for (const t of TOWER_CIRCLES) {
    const h = t.r === C.cornerTower.radius ? C.cornerTower.height : C.gateTower.height;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + .2; for (let y = 7; y < h - 4; y += 7.5) slit(t.x + Math.cos(a) * (t.r + .03), y + (k % 2) * 2.5, t.z + Math.sin(a) * (t.r + .03), Math.PI / 2 - a); }
  }
  for (let u = -C.court + 6; u <= C.court - 6; u += 8) for (const face of [1, -1]) {
    const off = o + face * (C.wallThick / 2 + .03), y = 8 + ((u / 8) & 1) * 3;
    slit(u, y, -off, 0); slit(-off, y, u, Math.PI / 2); slit(off, y, u, Math.PI / 2);
    if (Math.abs(u) > C.gateTower.x + C.gateTower.radius + 1.5) slit(u, y, off, 0);
  }
  add(mergeGeometries(slits)!, lambert({color: '#241d18'}), false, true);
  }

  // ---------- roofs ----------
  const red = paintable(lambert({color: '#b44a33', map: scaleTex, side: THREE.DoubleSide}), wcScales), blue = paintable(lambert({color: '#4a78a8', map: scaleTex, side: THREE.DoubleSide}), wcScales);
  const cone = (r: number, h: number, x: number, y: number, z: number, sides = 32) => scaleUV(new THREE.ConeGeometry(r, h, sides, 1, true), Math.PI * 2 * r / 5, h / 5).translate(x, y + h / 2, z);
  const redRoofs = TOWER_CIRCLES.filter(t => t.r === C.cornerTower.radius).map(t => cone(t.r + 1.5, C.cornerTower.roof, t.x, C.cornerTower.height, t.z, grounds ? 8 : 32));
  const blueRoofs = TOWER_CIRCLES.filter(t => t.r !== C.cornerTower.radius).map(t => cone(t.r + 1.1, C.gateTower.roof, t.x, C.gateTower.height, t.z));
  blueRoofs.push(scaleUV(new THREE.ConeGeometry(C.keep.half * 1.56, C.keep.roof, 4, 1, true), 8, 5).translate(C.keep.x, C.keep.height + .7 + C.keep.roof / 2, C.keep.z));
  add(mergeGeometries(redRoofs)!, red); add(mergeGeometries(blueRoofs)!, grounds ? red : blue);
  if (grounds) {
    const y = C.keep.height + 9;
    const collar = scaleUV(new THREE.CylinderGeometry(3.8,6.6,4,10),6,1).translate(C.keep.x,y+21,C.keep.z);
    add(mergeGeometries([collar,cone(4.5,14,C.keep.x,y+37,C.keep.z,10)])!,red);
    addGroundsArchitecture(add,stone,red,aniso,projectUV);
  }
  // banners on every spire; they sway (cosmetic) but never cast shadows
  const flagMat = lambert({color: '#c23a2c', side: THREE.DoubleSide}), poleMat = lambert({color: '#3a2c22'});
  const flags: THREE.Mesh[] = [];
  const spires: [number, number, number, number][] = [[C.keep.x, C.keep.height + (grounds ? 60 : .7 + C.keep.roof), C.keep.z, 2.2], ...TOWER_CIRCLES.map(t => [t.x, (t.r === C.cornerTower.radius ? C.cornerTower.height + C.cornerTower.roof : C.gateTower.height + C.gateTower.roof), t.z, t.r === C.cornerTower.radius ? 1.5 : 1.1] as [number, number, number, number])];
  const poles: THREE.BufferGeometry[] = [];
  for (const [x, y, z, s] of spires) {
    poles.push(new THREE.CylinderGeometry(.08 * s, .1 * s, 4 * s, 6).translate(x, y + 2 * s - .3, z));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(3 * s, 1.5 * s, 6, 1).translate(1.5 * s, 0, 0), flagMat); flag.position.set(x, y + 3.2 * s, z); flag.userData.phase = x * .13 + z * .07; scene.add(flag); flags.push(flag);
  }
  add(mergeGeometries(poles)!, poleMat, false, false);

  // ---------- drawbridge and its chains ----------
  const bridgeMaterial = () => {
    if (!tabletopWood) return paving;
    const plank = lambert({color: '#8a5f3c', map: tabletopWood.clone()});
    plank.map!.repeat.set(1, 6); plank.map!.needsUpdate = true;
    const wcPlank = wcWood.clone(); wcPlank.needsUpdate = true;
    return paintable(plank, wcPlank);
  };
  const bridgeLen = (grounds ? GROUNDS_BRIDGES[0].to[1] : C.moat.outer + 4) - (C.court + C.wallThick);
  const bridgeMid = C.court + C.wallThick + bridgeLen / 2;
  const bridgeHalf=page===119?BRIDGE_HALF_WIDTH:C.bridgeHalf;
  const bridgeGeo = box(bridgeHalf * 2, .3, bridgeLen, 0, SURFACE.bridge-.15, bridgeMid);
  const bridgeRoot=new THREE.Group();scene.add(bridgeRoot);
  const drawbridge = add(grounds ? projectUV(bridgeGeo,4) : bridgeGeo, page===119?paintable(lambert({color:paving.color,map:paving.map}),wcPaving):bridgeMaterial());
  bridgeRoot.add(drawbridge);
  if (grounds) {
    const sides = [-1,1].map(side => box(.62,1.45,bridgeLen-7,side*(bridgeHalf+.25),.08,bridgeMid));
    sides.push(box(bridgeHalf*2,.64,bridgeLen,0,SURFACE.bridge-.62,bridgeMid));
    bridgeRoot.add(add(projectUV(mergeGeometries(sides)!,4),page===119?paintable(lambert({color:stone.color,map:stone.map}),wcStone):stone));
  } else {
    const chainParts: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Vector3(s * (C.bridgeHalf - .3), C.gateHeight + 2, o + C.wallThick / 2), b = new THREE.Vector3(s * (C.bridgeHalf - .3), .8, C.court + C.wallThick + bridgeLen * .62);
      const len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(.5);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      chainParts.push(new THREE.CylinderGeometry(.09, .09, len, 5).applyQuaternion(q).translate(mid.x, mid.y, mid.z));
    }
    add(mergeGeometries(chainParts)!, iron, false, false);
  }

  // ---------- painted woods: the approved watercolor tree art, as flats that turn to face the eye ----------
  loading.report(.5, 'Planting the woods');
  // aspect = width / height; foot = transparent margin under the trunk, as a fraction of height
  const TREE_ART = [
    {path: 'environment/watercolor/v1/pine-relief-v1.png', aspect: 992 / 1586, foot: .006, h: [30, 52]},
    {path: 'environment/watercolor/v1/woods-cluster-sprite-v1.png', aspect: 1266 / 1242, foot: .035, h: [34, 46]},
    {path: 'environment/watercolor/v1/pine-sprite-v1.png', aspect: 992 / 1586, foot: .006, h: [26, 44]},
  ];
  const treeTextures = await Promise.all(TREE_ART.map(async art => {
    const t = await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}assets/runtime/${art.path}`);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
  }));
  // two deliberate foreground pines frame the tabletop view; the rest ring the castle
  const trees: {x: number; z: number; h: number; v: number}[] = grounds
    ? [{x:-81,z:83,h:15,v:0},{x:-94,z:58,h:17,v:2},{x:-100,z:15,h:12,v:1},
      {x:-65,z:113,h:13,v:2},{x:33,z:113,h:11,v:0},{x:102,z:27,h:16,v:2},
      {x:109,z:-24,h:19,v:1},{x:87,z:-64,h:14,v:0},{x:37,z:-88,h:12,v:2},{x:-24,z:-90,h:14,v:0}]
    : [{x: -30, z: 80, h: 34, v: 0}, {x: 54, z: 80, h: 30, v: 2}];
  const lane: [number, number][] = [];
  for (let s = 0; s <= 10.4; s += .2) { const p = sampleFlight(s).position; lane.push([p[0], p[2]]); }
  const tr = seeded(117);
  for (let i = 0; !grounds && trees.length < tier.trees && i < 4000; i++) {
    const a = tr() * Math.PI * 2, d = C.moat.outer + 16 + Math.sqrt(tr()) * (C.field - C.moat.outer - 28), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (lane.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 34)) continue;                   // the arrival lane stays clear
    if (z > 60 && Math.abs(x - z * .446) < 24 + z * .22 && tr() > .12) continue;               // an open meadow before the gate
    const v = tr() < .22 ? 1 : tr() < .5 ? 2 : 0;
    if (trees.some(t => Math.hypot(t.x - x, t.z - z) < (v === 1 || t.v === 1 ? 26 : 15))) continue;
    const [h0, h1] = TREE_ART[v].h;
    trees.push({x, z, h: h0 + tr() * (h1 - h0), v});
  }
  const treeSets = TREE_ART.map((art, v) => {
    const geo = new THREE.PlaneGeometry(1, 1).translate(0, .5 - art.foot, 0);       // trunk base at y = 0
    const mat = lambert({map: treeTextures[v], alphaTest: .5, side: THREE.DoubleSide});
    const list = trees.filter(t => t.v === v && (!grounds || groundsWalkable(t.x,t.z,2))), mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    mesh.count = list.length;
    mesh.userData.pointApproachInstances=list.map(tree=>({x:tree.x,z:tree.z,radius:.8,label:'tree'}));
    // flats turn to face the eye, so the baked shadow map would cut them in half: cast only
    mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false; scene.add(mesh);
    return {mesh, list, width: art.aspect};
  });
  const tm = new THREE.Matrix4(), tq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), tpos = new THREE.Vector3(), tscale = new THREE.Vector3();
  /** Turn each flat about its trunk toward the camera (cheap: ~80 matrices). */
  function faceTrees(from: THREE.Vector3) {
    for (const set of treeSets) {
      set.list.forEach((t, i) => { tq.setFromAxisAngle(up, Math.atan2(from.x - t.x, from.z - t.z)); tm.compose(tpos.set(t.x, grounds ? groundsMeadowHeight(t.z) : 0, t.z), tq, tscale.set(t.h * set.width, t.h, 1)); set.mesh.setMatrixAt(i, tm); });
      set.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  if (!grounds) {
    // Page 117's tabletop still life sits beyond the open book.
    const glass = lambert({color: '#1d2230', emissive: '#0c0f18', fog: false}), brass = lambert({color: '#c9a35e', emissive: '#3b2a10', fog: false});
    const well = new THREE.LatheGeometry([[0, 0], [70, 0], [86, 18], [88, 52], [74, 82], [40, 96], [36, 118], [0, 118]].map(([x, y]) => new THREE.Vector2(x, y)), 40);
    const inkwell = new THREE.Group(); inkwell.position.set(-640, -14, -700); scene.add(inkwell);
    inkwell.add(new THREE.Mesh(well, glass), new THREE.Mesh(new THREE.TorusGeometry(40, 7, 10, 40).rotateX(Math.PI / 2).translate(0, 118, 0), brass), new THREE.Mesh(new THREE.CylinderGeometry(96, 96, 6, 40).translate(0, 3, 0), brass));
    const quill = new THREE.Mesh(new THREE.PlaneGeometry(130, 520).translate(0, 260, 0), lambert({map: paintFeather(), alphaTest: .4, side: THREE.DoubleSide, fog: false, emissive: '#3a2c1c'}));
    quill.position.set(14, 60, 0); quill.rotation.set(0, .55, -.32); inkwell.add(quill);
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex, color: '#ffe0a8', blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: .55}));
    glint.scale.set(70, 70, 1); glint.position.set(-600, 60, -620); scene.add(glint);
  }

  // ---------- night sky and stars ----------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {top: {value: new THREE.Color(grounds ? '#101e35' : '#05070f')}, horizon: {value: new THREE.Color(grounds ? '#31465d' : '#2a2630')}, warm: {value: new THREE.Color(grounds ? '#171c2b' : '#5a3a22')}, sun: {value: 0}},
    vertexShader: 'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}',
    fragmentShader: 'uniform vec3 top,horizon,warm;uniform float sun;varying vec3 vDir;void main(){vec3 dir=normalize(vDir);float h=clamp(vDir.y,0.,1.);vec3 c=mix(horizon,top,pow(h,.45));float w=pow(max(0.,dot(normalize(vec3(-.45,.05,-.85)),vDir)),6.);c+=warm*w*(1.-h);float s=max(0.,dot(normalize(vec3(95.,125.,80.)),dir));c+=sun*vec3(1.,.78,.42)*(pow(s,32.)*.22+pow(s,512.)*.45);gl_FragColor=vec4(c,1.);}',
  }));
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  const sr = seeded(23), starPos = new Float32Array(tier.stars * 3), starSize = new Float32Array(tier.stars);
  for (let i = 0; i < tier.stars; i++) {
    const a = sr() * Math.PI * 2, y = .08 + Math.pow(sr(), .7) * .92, rr = Math.sqrt(1 - y * y);
    starPos.set([Math.cos(a) * rr * 5000, y * 5000, Math.sin(a) * rr * 5000], i * 3); starSize[i] = .6 + Math.pow(sr(), 6) * 2.6;
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3)); starGeo.setAttribute('size', new THREE.BufferAttribute(starSize, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, uniforms: {time: {value: 0}, ratio: {value: 1}},
    vertexShader: 'attribute float size;uniform float time,ratio;varying float vA;void main(){vA=.55+.45*sin(time*1.3+position.x*.01+position.z*.013);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);p.z=p.w*.9999;gl_Position=p;gl_PointSize=size*2.*ratio;}',
    fragmentShader: 'varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vec3(1.,.95,.85)*vA*smoothstep(.5,.0,d),1.);}',
  });
  const stars = new THREE.Points(starGeo, starMat); stars.frustumCulled = false; scene.add(stars);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({map: paintGlow('245,238,215'), color: '#f6efd8', fog: false, depthWrite: false, transparent: true}));
  moon.position.set(1800, 2600, -3600); moon.scale.set(520, 520, 1); scene.add(moon);
  stars.visible = moon.visible = !grounds;
  const nightSky=grounds ? createCastleNightSky(quality,reduced,playerFog!) : undefined;
  if(nightSky){sky.visible=false;scene.add(nightSky.group);nightSky.update(0,renderer.getPixelRatio(),camera.position);}

  // ---------- drifting motes in the lamplight (cosmetic, medium and up) ----------
  let motes: THREE.Points | undefined;
  if (tier.motes && !grounds) {
    const mr = seeded(31), pos = new Float32Array(tier.motes * 3), seed = new Float32Array(tier.motes);
    for (let i = 0; i < tier.motes; i++) { pos.set([(mr() - .5) * 120, 1 + mr() * 26, (mr() - .5) * 120], i * 3); seed[i] = mr() * 100; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    motes = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {time: {value: 0}, ratio: {value: 1}},
      vertexShader: 'attribute float seed;uniform float time,ratio;varying float vA;void main(){vec3 p=position+vec3(sin(time*.21+seed)*2.,sin(time*.17+seed*1.7)*1.5,cos(time*.19+seed)*2.);vec4 mv=modelViewMatrix*vec4(p,1.);vA=(.5+.5*sin(time*.9+seed*3.))*smoothstep(260.,40.,-mv.z);gl_Position=projectionMatrix*mv;gl_PointSize=ratio*clamp(60./-mv.z,1.,7.);}',
      fragmentShader: 'varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vec3(1.,.78,.45)*vA*smoothstep(.5,0.,d),1.);}',
    }));
    motes.frustumCulled = false; scene.add(motes);
  }

  // ---------- Hero, a painted standee on the combat directional rig ----------
  loading.report(.62, 'Waking Hero');
  const rigKeys = ['walking', 'walkingHigh'] as const;
  const totalSheets = CASTLE_IDLE_VIEWS.length + (grounds ? CASTLE_IDLE_VIEWS.length : rigKeys.length);
  const loader = new THREE.TextureLoader();
  let loaded = 0;
  async function loadHeroSheet(path: string) {
    const t = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/runtime/${path}`);
    t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = aniso;
    loading.report(.62 + ++loaded / totalSheets * .25, 'Waking Hero', loaded, totalSheets);
    return t;
  }
  const [rigEntries, idleEntries, platformEntries] = await Promise.all([
    Promise.all(grounds ? [] : rigKeys.map(async id => [id, await loadHeroSheet(HERO_RIG_SHEETS[id])] as const)),
    Promise.all(CASTLE_IDLE_VIEWS.map(async id => [id, await loadHeroSheet(CASTLE_IDLE_ATLAS.root + id + '.webp')] as const)),
    Promise.all(grounds ? CASTLE_IDLE_VIEWS.map(async id => [id, await loadHeroSheet('kin/hero/sprites/world/castle/platforming-poses/' + id + '.webp')] as const) : []),
  ]);
  const forestMeadow=await meadowLoading;
  const combatWoods=page===1111?await createWorldCombatWoods(reduced):undefined;
  let spellTest:ReturnType<typeof createWoodsSpellTest>|undefined;
  let handBoard:ReturnType<typeof createWoodsHandBoard>|undefined;
  if(page===1111)loading.report(.88,'Painting the valley');
  const paintedValley=page===1111?await (await import('./worldPaintedValley')).createWorldPaintedValley(renderer,quality==='low',reduced):undefined;
  const paintLab=page===1111?(await import('./worldPaintLab')).createWorldPaintLab(quality==='low',reduced):undefined;
  const longs=page===1111?await (await import('./worldLongs')).createWorldLongs(renderer,quality==='low',reduced):undefined;
  let meadow:typeof forestMeadow|typeof combatWoods|typeof paintedValley|typeof paintLab|typeof longs=forestMeadow;
  let meadowCamera = meadow && createMeadowCameraMotion(createMeadowCameraClearance(meadow.cameraOccluders));
  const portalCard=page===1111;
  const groveDoor={...WORLD_1111_LAYOUT.portal,y:treeGround(WORLD_1111_LAYOUT.portal.x,WORLD_1111_LAYOUT.portal.z)};
  const castleDoor = meadow && new MeadowPortalEnd(scene,portalCard?groveDoor:KEEP_MEADOW_DOOR,reduced,quality==='low',!portalCard,portalCard?'Sacred Forest Meadow':undefined);
  const meadowDoor = forestMeadow && new MeadowPortalEnd(forestMeadow.scene,
    {...MEADOW_DOOR,y:forestMeadow.surface.height(MEADOW_DOOR.x,MEADOW_DOOR.z-.2)},reduced,quality==='low',false,portalCard?'World Tree Grove':undefined);
  const woodsDoor=combatWoods&&new MeadowPortalEnd(scene,{...WORLD_1111_LAYOUT.woodsPortal,y:treeGround(WORLD_1111_LAYOUT.woodsPortal.x,WORLD_1111_LAYOUT.woodsPortal.z)},reduced,quality==='low',false,'Woods');
  const woodsReturn=combatWoods&&new MeadowPortalEnd(combatWoods.scene,COMBAT_WOODS.door,reduced,quality==='low',false,'World Tree Grove');
  const valleyPoint=WORLD_1111_LAYOUT.paintedValleyPortal;
  const valleyDoor=paintedValley&&new MeadowPortalEnd(scene,{...valleyPoint,y:treeGround(valleyPoint.x,valleyPoint.z)},reduced,quality==='low',false,'Painted Valley');
  const valleyReturn=paintedValley&&new MeadowPortalEnd(paintedValley.scene,paintedValley.door,reduced,quality==='low',false,'World Tree Grove');
  const labPoint=WORLD_1111_LAYOUT.paintLabPortal;
  const labDoor=paintLab&&new MeadowPortalEnd(scene,{...labPoint,y:treeGround(labPoint.x,labPoint.z)},reduced,quality==='low',false,'Paint Lab');
  const labReturn=paintLab&&new MeadowPortalEnd(paintLab.scene,paintLab.door,reduced,quality==='low',false,'World Tree Grove');
  const longsPoint=WORLD_1111_LAYOUT.longsPortal;
  const longsDoor=longs&&new MeadowPortalEnd(scene,{...longsPoint,y:treeGround(longsPoint.x,longsPoint.z)},reduced,quality==='low',false,'Longs Peak');
  const longsReturn=longs&&new MeadowPortalEnd(longs.scene,longs.door,reduced,quality==='low',false,'World Tree Grove');
  type PortalPair={id:'meadow'|'woods'|'painted-valley'|'paint-lab'|'longs';entry:MeadowPortalEnd;exit:MeadowPortalEnd;world:NonNullable<typeof forestMeadow|typeof combatWoods|typeof paintedValley|typeof paintLab|typeof longs>};
  const portalPairs:PortalPair[]=[];
  if(castleDoor&&meadowDoor&&forestMeadow)portalPairs.push({id:'meadow',entry:castleDoor,exit:meadowDoor,world:forestMeadow});
  if(woodsDoor&&woodsReturn&&combatWoods)portalPairs.push({id:'woods',entry:woodsDoor,exit:woodsReturn,world:combatWoods});
  if(valleyDoor&&valleyReturn&&paintedValley)portalPairs.push({id:'painted-valley',entry:valleyDoor,exit:valleyReturn,world:paintedValley});
  if(labDoor&&labReturn&&paintLab)portalPairs.push({id:'paint-lab',entry:labDoor,exit:labReturn,world:paintLab});
  if(longsDoor&&longsReturn&&longs)portalPairs.push({id:'longs',entry:longsDoor,exit:longsReturn,world:longs});
  groundPortalDoors.push(...portalPairs.map(pair=>pair.entry));
  let activePair=portalPairs[0];
  let woodsArrival:ReturnType<typeof createCombatWoodsArrival>|undefined,woodsArrivalInWoods=false,woodsOpeningHeld=false;
  type WoodsHeldView={position:number[];target:number[];up:number[];fov:number};
  let woodsOverhead=false,woodsOverheadHeight=WOODS_OVERHEAD_HEIGHT,woodsHeldView:WoodsHeldView|undefined;
  let woodsCameraFlight:{from:WoodsHeldView;elapsed:number;duration?:number;jump?:NonNullable<ReturnType<typeof createWorldGridJump>>}|undefined;
  let woodsPreviousView:(WoodsHeldView&{hero:THREE.Vector3;yaw:number;pitch:number;distance:number;free:boolean})|undefined;
  for(const pair of portalPairs)pair.world.terrain.setRouteObstacle((x,z,r,y)=>portalGuard.blocked([pair.exit],x,z,r,y));
  const portalViews=new Map(portalPairs.map(pair=>[pair,createMeadowPortalView(quality)]));
  const portalSound = portalPairs.length?createMeadowPortalSound():undefined;
  if (portalSound) {
    const unlock = (event: Event) => { if (event.isTrusted) portalSound.unlock(); };
    canvas.addEventListener('pointerup',unlock);
    addEventListener('keydown',unlock);
  }
  renderer.localClippingEnabled = !!portalPairs.length||!!bridgePuzzle;
  let inMeadow = false;
  let meadowLift = 0;
  let doorTarget = false;
  let meadowTarget: MeadowPoint | undefined;
  let meadowFooting: MeadowPoint | undefined;
  function clearMeadowRoute(){pendingScaffold=undefined;meadowTarget=undefined;meadow?.navigation.clear();meadow?.navigation.invalidate();portalGuard.arm(undefined,platform);}
  let crossing: {age:number; lateral:number; depth:number} | undefined;
  let portalClock = 0;
  const currentDoor = () => inMeadow ? activePair?.exit : activePair?.entry;
  const otherDoor = () => inMeadow ? activePair?.entry : activePair?.exit;
  const surfaceHeight = (x:number,z:number) => inMeadow ? meadow!.surface.height(x,z,platform?.y) : castleSurfaceHeight(x,z);
  const sheets = new Map(rigEntries), idleSheets = new Map(idleEntries), platformSheets = new Map(platformEntries);
  const idleDirector = new CastleHeroIdle(),worldDirector=new HeroWorldDirector(),worldTextures=createHeroWorldTextures();
  let worldView:SpriteView|undefined,pendingScaffold:WorldScaffold|undefined,combatThreat=false;
  const heroMat = new THREE.MeshBasicMaterial({map: idleSheets.get('low-4'), color: '#efdcc2', alphaTest: .35, transparent: true, side: THREE.DoubleSide, fog: true});
  playerFog?.shadeActor(heroMat);
  const heroMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, .5, 0), heroMat);   // paws on the ground at y = 0
  const flurryCompanion=page===1111?await createFlurryCompanion():undefined;
  const portalEcho = portalPairs.length ? new THREE.Mesh(heroMesh.geometry,heroMat.clone()):undefined;
  const heroOverlap=createSentientOverlap([heroMat]);let sentientOverlapMode:SentientOverlapMode='outline';
  const portalPose = new THREE.Matrix4();
  // drawn after her contact shadow, so the shadow never paints over her paws
  heroMesh.renderOrder = 3; scene.add(heroMesh);
  const sprintLayer = new THREE.Group();
  if (grounds) scene.add(sprintLayer);
  const sprintPaint = grounds ? castleSprintPaint(sprintLayer,heroMesh) : undefined;
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2}));
  blob.renderOrder = 1;
  scene.add(blob);
  // heading: the way she faces in plan (bearing); she starts looking at the keep
  const hero = {x: heroStart.x, z: heroStart.z, heading: startHeading, clock: 0, speed: 0, shade: 0, view: undefined as SpriteView | undefined};
  let gridJump:ReturnType<typeof createWorldGridJump>,gridStanding=false;
  combatWoods?.setGridJumpHandler(target=>{
    if(!platform||!platform.grounded||gridJump||!inMeadow||activePair?.id!=='woods'||crossing||mode!=='play')return false;
    if(!combatWoods.dry(target.x,target.z,C.heroRadius,target.y))return false;
    const jump=createWorldGridJump({x:platform.x,y:platform.y,z:platform.z},target,(a,b)=>{
      const moved=combatWoods.surface.move(a.x,a.z,b.x-a.x,b.z-a.z,a.y,false);
      return Math.hypot(moved.x-b.x,moved.z-b.z)<.015&&combatWoods.surface.height(b.x,b.z,b.y)<=b.y+.08;
    },reduced);
    if(!jump)return false;
    navigation?.clear();clearMeadowRoute();doorTarget=false;pendingScaffold=undefined;platform.cancelSprint(true);
    platform.vx=platform.vz=0;
    const from={position:camera.position.toArray(),target:lookAt.toArray(),up:camera.up.toArray(),fov:camera.fov};
    if(freeCamera)setFreeCamera(false);
    woodsOverhead=false;woodsPreviousView=undefined;
    woodsHeldView=woodsFoundationCinematicPose(target,{x:combatWoods.enemy.position.x,y:combatWoods.enemy.position.y,z:combatWoods.enemy.position.z},camera.aspect);
    woodsCameraFlight=reduced?undefined:{from,elapsed:0,duration:jump.duration,jump};woodsOpeningHeld=true;
    journey?.release();bridgeJourney?.release();canvas.dataset.castleCamera='follow';
    jumpPressed=divePressed=false;gridJump=jump;gridStanding=false;combatWoods.setGridJumping(true);updateCamera(0);return true;
  });

  const litTint = new THREE.Color(workbench?'#ffffff':grounds ? '#b8c5d6' : '#efdcc2'), shadeTint = new THREE.Color(workbench?'#d7d4c9':grounds ? '#708199' : '#6f7186'), candleTint = new THREE.Color('#ffe0aa'), toLight = new THREE.Vector3(), shadowRay = new THREE.Raycaster();

  // ---------- camera colliders: low-poly proxies of the stonework ----------
  const colliders = new THREE.Group();
  const proxyMat = new THREE.MeshBasicMaterial();
  const proxy = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, proxyMat); m.position.set(x, y, z); colliders.add(m); };
  function syncStudioColliders(){
    for(const child of [...colliders.children])if(child.userData.studioCollider){colliders.remove(child);(child as THREE.Mesh).geometry.dispose();}
    for(const box of placedSolids){const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),mesh=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.01,size.x),Math.max(.01,size.y),Math.max(.01,size.z)),proxyMat);mesh.position.copy(center);mesh.userData.studioCollider=true;colliders.add(mesh);}
    colliders.updateMatrixWorld(true);
  }
  for (const b of WALL_RECTS) proxy(new THREE.BoxGeometry(b.x1 - b.x0, C.wallHeight + 1.9, b.z1 - b.z0), (b.x0 + b.x1) / 2, (C.wallHeight + 1.9) / 2, (b.z0 + b.z1) / 2);
  proxy(gateLintel(), 0, 0, 0);
  proxy(new THREE.BoxGeometry(C.keep.half * 2, C.keep.height + C.keep.roof * .5, C.keep.half * 2).rotateY(Math.PI / 4), C.keep.x, (C.keep.height + C.keep.roof * .5) / 2, C.keep.z);
  for (const t of TOWER_CIRCLES) { const h = t.r === C.cornerTower.radius ? C.cornerTower.height + C.cornerTower.roof * .5 : C.gateTower.height + C.gateTower.roof * .5; proxy(new THREE.CylinderGeometry(t.r + .3, t.r + .3, h, 12), t.x, h / 2, t.z); }
  colliders.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const castleCamera=grounds?createMeadowCameraMotion(createMeadowCameraClearance(colliders.children)):undefined;
  const journeyHero=new THREE.Vector3(),journeyVelocity=new THREE.Vector3(),journeyDirection=new THREE.Vector3();
  const journeyRay=new THREE.Raycaster(),journeyHits:THREE.Intersection[]=[];
  const journey=grounds?createJourneyCamera(reduced,(from,to,radius=0)=>{
    journeyDirection.subVectors(to,from);const length=journeyDirection.length();
    if(length<radius+.2)return true;
    journeyRay.set(from,journeyDirection.divideScalar(length));journeyRay.near=.08;journeyRay.far=Math.max(.08,length-radius-.1);
    journeyHits.length=0;
    if(inMeadow)journeyRay.intersectObjects(meadow!.cameraOccluders,false,journeyHits);
    else journeyRay.intersectObject(colliders,true,journeyHits);
    return !journeyHits.length;
  }):undefined;
  const bridgeJourney=page===119?createBridgeJourneyCamera(reduced):undefined;
  function resetJourney(){journey?.reset();bridgeJourney?.reset();}
  const castleLandmarks:JourneyLandmark[]=[
    {id:'castle-keep',point:new THREE.Vector3(C.keep.x,48,C.keep.z),radius:17,halfHeight:46,priority:1.5},
    {id:'drawbridge-gate',point:new THREE.Vector3(0,14,34),radius:10,halfHeight:13,priority:1.1},
    {id:'waterfall',point:new THREE.Vector3(-94,11,-63),radius:15,halfHeight:12,priority:1.2},
    {id:'timber-footbridge',point:new THREE.Vector3(48,1.5,50),radius:12,halfHeight:2,priority:.8},
  ];
  function directJourney(){
    if(treeOpeningHeld||woodsOpeningHeld)takeCameraControl();
    const destination=inMeadow?meadow!.navigation.destination:navigation?.destination;
    if(!journey||!platform||!destination)return;
    journeyHero.set(hero.x,platform.y,hero.z);
    if(!inMeadow&&!reduced&&bridgeJourney&&bridgePuzzle&&bridgeJourneyDestination(destination,bridgePuzzle.builtSections)){
      journey.reset();bridgeView=0;
      bridgeJourney.start(journeyHero,{...destination,y:surfaceHeight(destination.x,destination.z)},camera);
      adoptFollowCamera();return;
    }
    bridgeJourney?.reset();
    journey.start(journeyHero,{x:destination.x,y:inMeadow?meadow!.navigation.destination!.y:surfaceHeight(destination.x,destination.z),z:destination.z},camera,inMeadow?meadow!.landmarks:castleLandmarks);
  }
  const destinationRing = grounds ? new THREE.Mesh(
    new THREE.RingGeometry(.43,.55,32).rotateX(-Math.PI/2),
    new THREE.MeshBasicMaterial({color:'#fff0bd',transparent:true,opacity:.86,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),
  ) : undefined;
  if (destinationRing) { destinationRing.visible = false; scene.add(destinationRing); }
  const destinations = new Set([pavingSurface,drawbridge,...(groundsPaint?.destinations ?? [])]);
  const pickRay = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let lastPointClick:unknown;
  // Opaque scenery participates in the pick so a tap on the keep, cliff or
  // water cannot select dry ground hidden behind it.
  const pickSurfaces = grounds ? [...new Set([
    ...destinations,
    ...treeSets.map(set=>set.mesh),
    ...(lanternGroup?.children.filter(object=>object.userData.pointApproachInstances)??[]),
    ...scene.children.filter(object => object instanceof THREE.Mesh && !object.matrixAutoUpdate
      && (Array.isArray(object.material) || !object.material.transparent)),
  ])] : [];
  let meadowPicks = meadow && [...new Set([...meadow.floors,...meadow.scenery,activePair!.exit.aperture])];
  if (castleDoor) pickSurfaces.push(castleDoor.aperture);
  function navigateToPointer(point: {x:number;y:number}, teleport = false) {
    if(spellTest?.active||handBoard?.active)return;
    if(inMeadow&&activePair?.id==='woods'&&combatWoods?.foundations.grid.busy)return;
    if(bridgeExperience?.active)return;
    if (!navigation || !platform || crossing || mode !== 'play') return;
    const bounds = canvas.getBoundingClientRect();
    pointer.set(2*(point.x-bounds.left)/bounds.width-1,1-2*(point.y-bounds.top)/bounds.height);
    pickRay.setFromCamera(pointer,camera);
    if(!inMeadow&&!teleport&&bridgeExperience?.tryOpen(pickRay))return;
    const hit = pickRay.intersectObjects(inMeadow ? [...meadowPicks!,...(activePair?.id==='woods'?combatWoods?.gridPickTargets??[]:[])] : [...pickSurfaces,...(bridgeExperience?.pickTargets??[])],false).find(visiblePointHit);
    if (!hit) return;
    if(inMeadow&&activePair?.id==='woods'&&(hit.object.userData.worldGridCard||hit.object.userData.worldGridSurface)){const id=combatWoods?.gridCardAt(hit);if(id)combatWoods?.selectGridCard(id);return;}
    pendingScaffold=undefined;stickerInteraction?.cancel();navigation.clear();clearMeadowRoute();doorTarget=false;
    const scaffold=hit.object.userData.worldScaffold as WorldScaffold|undefined;
    if(scaffold&&!teleport){
      const accepted=inMeadow?meadow!.navigation.setDestination(platform,scaffold.from):navigation.setDestination(platform,scaffold.from);
      if(accepted){pendingScaffold=scaffold;platform.cancelSprint();directJourney();}else{hint.textContent='No safe approach to that scaffold.';hint.hidden=false;}return;
    }
    if(!teleport&&worldFlurry?.root.children.includes(hit.object)){approachFlurry();return;}
    const clickedPair=inMeadow?activePair:portalPairs.find(pair=>pair.entry.aperture===hit.object);
    const door = clickedPair?(inMeadow?clickedPair.exit:clickedPair.entry):currentDoor();
    const atDoor = door && hit.object===door.aperture && door.contains(hit.point);
    if(atDoor&&clickedPair&&!teleport){activePair=clickedPair;portalGuard.arm(door);meadow?.navigation.invalidate();}
    const target = atDoor ? door.point(MeadowPortalEnd.approach) : hit.point;
    const surfaceHit = inMeadow ? meadow!.floors.includes(hit.object as THREE.Mesh) : destinations.has(hit.object as THREE.Mesh);
    const anchor=pointApproachTarget(hit);
    const normal=hit.face?.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));
    const top=!!normal&&normal.y>.62;
    const exactLanding=inMeadow?meadow!.terrain.height(hit.point.x,hit.point.z,hit.point.y+.03):surfaceHeight(hit.point.x,hit.point.z);
    const safeTop=top&&exactLanding!==undefined&&Math.abs(exactLanding-hit.point.y)<.3;
    const approach:ApproachTarget|undefined=anchor??(!atDoor&&!safeTop?{x:hit.point.x,z:hit.point.z,...(hit.object.userData.pointApproachFoliage?{radius:.35,label:'tree'}:{})}:undefined);
    lastPointClick={kind:teleport?'teleport':atDoor?'portal':approach?'adjacent':'surface',object:hit.object.name||hit.object.type,label:anchor?.label,point:hit.point.toArray(),normalY:normal?.y,anchor:approach};
    if (teleport) {
      const {x,y,z} = hit.point;
      const dry = inMeadow ? meadow!.dry(x,z,C.heroRadius,y) : (bridgePuzzle?.walkable??groundsWalkable)(x,z);
      const landing=inMeadow?meadow!.surface.height(x,z,y):surfaceHeight(x,z);
      if ((!surfaceHit&&!(inMeadow&&safeTop)) || anchor || !dry || Math.abs(landing-y)>.45) return;
      setFreeCamera(false);
      resetJourney();
      navigation.clear(); clearMeadowRoute(); doorTarget = false;
      jumpPressed = divePressed = false;
      platform = new CastlePlatformMotion(x,z,hero.heading,inMeadow ? meadow!.surface : groundsSurface);
      if(inMeadow)platform.y=landing;
      meadowFooting = inMeadow ? {x,y:landing,z} : undefined;
      hero.x=x; hero.z=z; hero.speed=hero.clock=0; hero.view=undefined;
      idleDirector.reset();
      resetPlayCamera();
      updateHero(0);
      return;
    }
    // Water keeps its existing pick occlusion; it is not an object to approach.
    if(!inMeadow&&hit.object instanceof THREE.Mesh&&hit.object.material===water)return;
    if (inMeadow) {
      const accepted=approach?meadow!.navigation.setAdjacentDestination(platform,approach):meadow!.navigation.setDestination(platform,{x:target.x,y:atDoor?door!.door.y:hit.point.y,z:target.z});
      if (accepted) {
        meadowTarget = meadow!.navigation.destination; doorTarget = !!atDoor; platform.cancelSprint();
        directJourney();
        hint.textContent='Route planned.';hint.hidden=false;
        hint.classList.remove('fade');
      } else {
        clearMeadowRoute();doorTarget=false;platform.cancelSprint(true);
        hint.textContent=approach?'No reachable spot beside that object.':'No safe route to that ledge.';hint.hidden=false;
        hint.classList.remove('fade');
      }
    } else if (approach) {
      if(navigation.setAdjacentDestination(platform,approach)){doorTarget=false;platform.cancelSprint();directJourney();}
      else{navigation.clear();platform.cancelSprint(true);hint.textContent='No reachable spot beside that object.';hint.hidden=false;hint.classList.remove('fade');}
    } else if (atDoor || surfaceHit || safeTop) {
      if(freeCamera&&bridgePuzzle&&bridgeJourneyDestination(target,bridgePuzzle.builtSections)&&bridgePuzzle.walkable(target.x,target.z))setFreeCamera(false);
      if(navigation.setDestination(platform,target)){doorTarget = !!atDoor;platform.cancelSprint();directJourney();}
      else{navigation.clear();portalGuard.arm();doorTarget=false;}
    }
  }

  // ---------- interface ----------
  const ui = document.createElement('div'); ui.id = 'castle-ui';
  ui.innerHTML = `<header><div class="castle-title"><span class="castle-eyebrow">Page 117</span><h1>The castle</h1></div><nav><button type="button" data-castle="skip">Skip</button><div class="castle-settings"><button type="button" class="castle-gear" data-castle="settings" aria-expanded="false" aria-controls="castle-settings-panel" aria-label="Settings"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/></svg></button><div class="castle-panel" id="castle-settings-panel" role="group" aria-label="Settings" hidden><label class="castle-row">Quality <select data-castle="quality"><option value="auto">Auto</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label class="castle-row castle-switch">Watercolor <input type="checkbox" role="switch" data-castle="watercolor"><span aria-hidden="true"></span></label><button type="button" class="castle-row" data-castle="replay">Replay arrival</button></div></div></nav></header><footer><p class="castle-hint" hidden>WASD or arrows to walk · Shift to run · drag to look · scroll to zoom</p></footer>`;
  const vignette = document.createElement('div'); vignette.id = 'castle-vignette'; if (tier.edgeBlur) vignette.classList.add('soft-edges');
  vignette.hidden=workbench;
  document.body.append(vignette, ui);
  const skipBtn = ui.querySelector<HTMLButtonElement>('[data-castle="skip"]')!, replayBtn = ui.querySelector<HTMLButtonElement>('[data-castle="replay"]')!, hint = ui.querySelector<HTMLElement>('.castle-hint')!;
  const locationTitle = ui.querySelector('h1')!;
  const story=page>=119?createCastleStoryIdentity(ui.querySelector<HTMLElement>('.castle-title')!,bridgePuzzle??new CastleBridgePuzzle(),natural,workbench?page:120):undefined;
  const credits = document.createElement('small');
  credits.className = 'castle-meadow-credit';
  credits.hidden = true;
  credits.innerHTML = '<a href="https://sketchfab.com/3d-models/sacred-forest-meadow-4a8b56d5b9324272b5f2d5262650e125" target="_blank" rel="noopener">Meadow model by XanderPriest281</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>';
  if (meadow) locationTitle.after(credits);
  const grovePageTitle=ui.querySelector('[data-story="page"]')?.textContent??title;
  function setMeadowActive(active: boolean) {
    woodsCameraFlight=undefined;
    woodsOverhead=false;woodsPreviousView=undefined;woodsHeldView=undefined;
    gridJump=undefined;gridStanding=false;combatWoods?.setGridJumping(false);
    controllerOwnsCamera=false;
    woodsOpeningHeld=false;
    resetJourney();stickerInteraction?.cancel();
    followFov=SHOULDER.fov;
    if(active&&activePair){meadow=activePair.world;meadowCamera=createMeadowCameraMotion(createMeadowCameraClearance(meadow.cameraOccluders));meadowPicks=[...new Set([...meadow.floors,...meadow.scenery,activePair.exit.aperture])];}
    inMeadow = active;
    meadowLift = 0;
    (active ? meadow!.scene : scene).add(heroMesh,blob,sprintLayer);
    if (destinationRing) (active ? meadow!.scene : scene).add(destinationRing);
    if(!story)locationTitle.textContent = active ? 'Sacred Forest Meadow' : title;
    credits.hidden = !active||activePair?.id!=='meadow';
    vignette.hidden = active || workbench;
    canvas.dataset.castleLocation = active ? activePair?.id??'meadow' : 'grounds';
  const destinationName=activePair?.id==='woods'?'Woods':activePair?.id==='painted-valley'?'Painted Valley':activePair?.id==='paint-lab'?'Paint Lab':activePair?.id==='longs'?'Longs Peak':'Sacred Forest Meadow';
    if(portalCard){const entry=ui.querySelector('[data-story="page"]');if(entry)entry.textContent=active?destinationName:grovePageTitle;else locationTitle.textContent=active?destinationName:title;studioEditor?.close();}
    canvas.setAttribute('aria-label', active ? `${destinationName}. ${groundsControls} Q lowers the camera and E raises it. Click or tap the ${portalCard?'portal card to return to the World Tree grove':'arch to return to the castle grounds'}.` : castleLabel);
    if(active&&activePair?.id==='woods')canvas.setAttribute('aria-label',canvas.getAttribute('aria-label')+' Press O to toggle the Hero-centered overhead camera. Floor tiles use fixed letter-and-number coordinates.');
    hint.textContent = '';hint.hidden=true;
    hint.classList.remove('fade');
  }
  const castleLabel = canvas.getAttribute('aria-label')!;
  const qualitySel = ui.querySelector<HTMLSelectElement>('[data-castle="quality"]')!; qualitySel.value = quality;
  const settingsBtn = ui.querySelector<HTMLButtonElement>('[data-castle="settings"]')!, panel = ui.querySelector<HTMLElement>('.castle-panel')!, wcToggle = ui.querySelector<HTMLInputElement>('[data-castle="watercolor"]')!;
  if(!story){ui.querySelector('.castle-eyebrow')!.textContent = `Page ${page}`;ui.querySelector('h1')!.textContent = title;}
  if (grounds) {
  replayBtn.textContent = portals?(startLocation==='woods'?'Return to Woods':startLocation==='painted-valley'?'Return to Painted Valley':startLocation==='paint-lab'?'Return to Paint Lab':startLocation==='longs'?'Return to Longs Peak':'Return to Yggdrasil'):'Return to drawbridge';
    wcToggle.closest('label')!.style.display = 'none';
    hint.textContent = '';
  }
  const freeToggle = document.createElement('input');
  if (grounds) {
    const label = document.createElement('label'); label.className = 'castle-row castle-switch';
    freeToggle.type = 'checkbox'; freeToggle.setAttribute('role', 'switch'); freeToggle.dataset.castle = 'free-camera';
    label.append('Free camera', freeToggle, document.createElement('span'));
    label.lastElementChild!.setAttribute('aria-hidden', 'true');
    panel.insertBefore(label, replayBtn);
    freeToggle.onchange = () => { setFreeCamera(freeToggle.checked); canvas.focus(); };
  }
  const splatToggle = document.createElement('input');
  if (page === 1111) {
    const label = document.createElement('label'); label.className = 'castle-row castle-switch';
    splatToggle.type = 'checkbox'; splatToggle.setAttribute('role', 'switch'); splatToggle.dataset.castle = 'splats';
    label.append('Painterly splats', splatToggle, document.createElement('span'));
    label.lastElementChild!.setAttribute('aria-hidden', 'true');
    panel.insertBefore(label, replayBtn);
    splatToggle.onchange = () => { void setSplats(splatToggle.checked, true); canvas.focus(); };
  }
  const openSettings = (open: boolean) => { panel.hidden = !open; settingsBtn.setAttribute('aria-expanded', String(open)); };
  settingsBtn.onclick = () => openSettings(panel.hidden);
  addEventListener('pointerdown', e => { if (!panel.hidden && !(e.target as HTMLElement).closest('.castle-settings')) openSettings(false); }, {capture: true});
  addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { openSettings(false); settingsBtn.focus(); } });
  function setWatercolor(on: boolean) {
    watercolor = on; wcToggle.checked = on; WATERCOLOR_UNIFORMS.uWc.value = on ? 1 : 0;
    for (const {material, flat, wc} of swaps) { const t = on ? wc : flat; if (t !== flat) { t.repeat.copy(flat.repeat); t.wrapS = flat.wrapS; t.wrapT = flat.wrapT; } material.map = t; }
    canvas.dataset.castleWatercolor = on ? 'on' : 'off';
    if (!grounds) {
      try { localStorage.setItem('exploritaire.book-watercolor.v1', on ? 'on' : 'off'); } catch { /* per-visit only */ }
    }
  }
  wcToggle.onchange = () => setWatercolor(wcToggle.checked);
  qualitySel.onchange = () => { setBookRenderQuality(qualitySel.value as BookRenderQuality); const u = new URL(location.href); u.searchParams.delete('quality'); location.replace(u); };

  // ---------- state: arrival flight, then play ----------
  // The portal reveals the world route 1.2 seconds in. Page 1111 begins
  // at that exact post-dot pose, including replays; it never builds the book.
  const flightStartSeconds=startLocation==='woods'?0:page===1111?CASTLE_PORTAL_WORLD_LEAD_SECONDS:0;
  let mode: 'flight' | 'play' = reduced||startEditing||directStart||directCombat ? 'play' : 'flight', flightTime = flightStartSeconds, flightSpeed = 1;
  let hintFade: number | undefined;
  let yaw = startYaw, pitch = startPitch, distance: number = startDistance;
  let followFov:number=SHOULDER.fov;
  let controllerView=false,controllerOwnsCamera=false;
  const camTarget = new THREE.Vector3(), camPos = new THREE.Vector3(), lookAt = new THREE.Vector3();
  const aimTarget = new THREE.Vector3(), heroCenter = new THREE.Vector3();
  const toHero = new THREE.Vector3(), aimDirection = new THREE.Vector3();
  const aimTurn = new THREE.Quaternion(), limitedTurn = new THREE.Quaternion();
  const setCamera = (p: ArrayLike<number> | THREE.Vector3, t: ArrayLike<number> | THREE.Vector3, fov: number) => {
    p instanceof THREE.Vector3 ? camera.position.copy(p) : camera.position.set(p[0], p[1], p[2]);
    t instanceof THREE.Vector3 ? lookAt.copy(t) : lookAt.set(t[0], t[1], t[2]);
    camera.lookAt(lookAt);
    // keep depth precision: near plane follows height so distant paper never shimmers
    const near = inMeadow && !freeCamera ? .12 : THREE.MathUtils.clamp(camera.position.y * .035, .08, 2);
    if (Math.abs(camera.fov - fov) > 1e-3 || Math.abs(camera.near - near) > 1e-3) { camera.fov = fov; camera.near = near; camera.updateProjectionMatrix(); }
  };
  function adoptFollowCamera(){
    aimTarget.copy(lookAt);followFov=camera.fov;
    castleCamera?.reset(camera.position);meadowCamera?.reset(camera.position);
  }
  function showFlight() {
    if(woodsArrival){const shot=woodsArrival.sample(flightTime);woodsArrivalInWoods=shot.inWoods;camera.up.set(0,1,0);setCamera(shot.position,shot.target,shot.fov);return shot.done;}
    const seconds=believeArrival?Math.max(0,flightTime-CASTLE_BELIEVE_SECONDS+CASTLE_PORTAL_WORLD_LEAD_SECONDS):flightTime;
    const shot=clearArrival?clearArrival.sample(seconds):sampleFlight(seconds,arrivalPath);
    camera.up.set(0,1,0);
    setCamera(shot.position,shot.target,shot.fov);
    return shot.done;
  }
  function renderWorld(){
    if(mode==='flight'&&woodsArrival){renderer.render(woodsArrivalInWoods?combatWoods!.scene:scene,camera);return;}
    // Once the cosmos is opaque, skip drawing the hidden Woods entirely.
    if(inMeadow&&activePair?.id==='woods'&&spellTest?.opaque){renderer.clear();spellTest.render(renderer,combatWoods!.scene);return;}
    if(!(mode==='flight'&&believeArrival?.render(scene,camera,flightTime)))renderer.render(inMeadow ? meadow!.scene : scene,camera);
    if(inMeadow&&activePair?.id==='woods')spellTest?.render(renderer,combatWoods!.scene);
    handBoard?.render(renderer);
  }
  function arrive() {
    believeArrival?.finish();
    mode = 'play'; skipBtn.hidden = true; hint.hidden = grounds; canvas.dataset.castlePhase = 'shoulder';
    freeToggle.disabled = false;
    // Every arrival/replay transfers camera ownership the same way. Restricting
    // this reset to page 119 caused the World Tree's zoom-out-and-back relapse.
    adoptFollowCamera();

    window.clearTimeout(hintFade);
    hintFade = window.setTimeout(() => hint.classList.add('fade'), 9000);
  }
  function prepareWoodsStart(){
    if(!woodsArrival||!combatWoods)return;
    activePair=portalPairs.find(pair=>pair.id==='woods')!;setMeadowActive(true);crossing=undefined;
    woodsOverhead=false;woodsHeldView=undefined;woodsPreviousView=undefined;
    const {x,z}=COMBAT_WOODS_START,heading=bearing(COMBAT_WOODS.enemy.x-x,COMBAT_WOODS.enemy.z-z);
    platform=new CastlePlatformMotion(x,z,heading,combatWoods.surface);meadowFooting={x,y:platform.y,z};
    hero.x=x;hero.z=z;hero.heading=heading;hero.speed=hero.clock=0;hero.view=undefined;woodsOpeningHeld=true;woodsArrivalInWoods=true;
    const shot=woodsArrival.landed,dx=shot.position[0]-x,dz=shot.position[2]-z,lift=shot.position[1]-platform.y-SHOULDER.height;
    woodsHeldView={position:[...shot.position],target:[...shot.target],up:[0,1,0],fov:shot.fov};
    yaw=Math.atan2(dx,dz);pitch=Math.atan2(lift,Math.hypot(dx,dz));distance=Math.hypot(dx,lift,dz);
    setCamera(shot.position,shot.target,shot.fov);adoptFollowCamera();
  }
  function prepareLabStart(){
    if(!paintLab)return;
    activePair=portalPairs.find(pair=>pair.id==='paint-lab')!;setMeadowActive(true);crossing=undefined;
    const {x,z,heading}=paintLab.start;
    platform=new CastlePlatformMotion(x,z,heading,paintLab.surface);meadowFooting={x,y:platform.y,z};
    hero.x=x;hero.z=z;hero.heading=heading;hero.speed=hero.clock=0;hero.view=undefined;
    yaw=heading+Math.PI;pitch=.24;distance=7;
  }
  function prepareValleyStart(){
    if(!paintedValley)return;
    activePair=portalPairs.find(pair=>pair.id==='painted-valley')!;setMeadowActive(true);crossing=undefined;
    const x=0,z=0,heading=paintedValley.door.yaw;
    platform=new CastlePlatformMotion(x,z,heading,paintedValley.surface);meadowFooting={x,y:platform.y,z};
    hero.x=x;hero.z=z;hero.heading=heading;hero.speed=hero.clock=0;hero.view=undefined;
    yaw=heading+Math.PI;pitch=.20;distance=7;
  }
  function prepareLongsStart(){
    if(!longs)return;
    activePair=portalPairs.find(pair=>pair.id==='longs')!;setMeadowActive(true);crossing=undefined;
    const {x,z,heading}=longs.start;
    platform=new CastlePlatformMotion(x,z,heading,longs.surface);meadowFooting={x,y:platform.y,z};
    hero.x=x;hero.z=z;hero.heading=heading;hero.speed=hero.clock=0;hero.view=undefined;
    yaw=heading+Math.PI;pitch=.20;distance=7;
  }
  function skip() {
    // Fast-forward along the authored path to keep the same camera handoff.
    if (mode !== 'flight' || flightSpeed > 1) return;
    flightSpeed = 5; skipBtn.hidden = true; canvas.dataset.castlePhase = 'arriving';
  }
  function replay(playFlight = !grounds||!!treeArrival) {
    controllerView=controllerOwnsCamera=false;
    resetJourney();
    followFov=SHOULDER.fov;
    if (grounds) { setFreeCamera(false); groundsGestures.clear(); }
    keys.clear();
    window.clearTimeout(hintFade);
    hint.classList.remove('fade');
    idleDirector.reset();pendingScaffold=undefined;worldDirector.setPreview();
    navigation?.clear(); clearMeadowRoute(); doorTarget = false;
    if (meadow) {
      setMeadowActive(false); crossing = undefined;
      heroMat.clippingPlanes = null; blob.visible = true;
      portalEcho?.removeFromParent();
    }
    bridgeExperience?.close();
    treeOpeningHeld=!!treeArrival;
    hero.x = heroStart.x; hero.z = heroStart.z; hero.heading = startHeading; hero.view = undefined; yaw = startYaw; pitch = startPitch; distance = startDistance;
    if (grounds) {
      platform = new CastlePlatformMotion(heroStart.x,heroStart.z,startHeading,groundsSurface);
      jumpPressed = divePressed = false;
      hero.speed = hero.clock = 0;
    }
    if(woodsArrival)prepareWoodsStart();
    if(startLocation==='painted-valley')prepareValleyStart();
    if(startLocation==='paint-lab')prepareLabStart();
    if(startLocation==='longs')prepareLongsStart();
    if (reduced || !playFlight || directStart) { arrive(); resetPlayCamera(); return; }
    mode = 'flight'; flightTime = flightStartSeconds; flightSpeed = 1; skipBtn.hidden = false; hint.hidden = true;
    freeToggle.disabled = true;
    canvas.dataset.castlePhase = 'flight';
    showFlight();
  }
  skipBtn.onclick = () => { skip(); canvas.focus(); };
  replayBtn.onclick = () => { openSettings(false); replay(); canvas.focus(); };
  if (grounds && !reduced) {
    const flyIn = document.createElement('button');
    flyIn.type = 'button'; flyIn.className = 'castle-row'; flyIn.dataset.castle = 'replay-flight';
    flyIn.textContent = 'Replay fly-in';
    flyIn.onclick = () => { openSettings(false); replay(true); canvas.focus(); };
    panel.insertBefore(flyIn,replayBtn);
  }
  freeToggle.disabled = mode === 'flight';
  canvas.dataset.castlePhase = mode === 'play' ? 'shoulder' : 'flight';
  if (mode === 'play') { skipBtn.hidden = true; hint.hidden = grounds; }

  if(grounds){const label=document.createElement('label');label.className='castle-row';label.textContent='Hero action preview ';const select=document.createElement('select');select.setAttribute('aria-label','Hero action preview');select.add(new Option('Automatic','auto'));for(const action of HERO_WORLD_ACTIONS)select.add(new Option(action,action));select.onchange=()=>worldDirector.setPreview(select.value==='auto'?undefined:select.value as HeroWorldAction);label.append(select);panel.append(label);}
  if(grounds){const label=document.createElement('label');label.className='castle-row';label.textContent='Sentient overlap ';const select=document.createElement('select');select.setAttribute('aria-label','Sentient overlap');select.add(new Option('Glowing outline','outline'));select.add(new Option('Silhouette cutout','cutout'));select.onchange=()=>{sentientOverlapMode=select.value as SentientOverlapMode;worldFlurry?.setOverlapMode(sentientOverlapMode);};label.append(select);panel.append(label);}
  const keys = new Set<string>();
  let jumpPressed = false, divePressed = false;
  const pickupHero=new THREE.Vector3();
  const pickupEffects=bridgePuzzle?createCastlePickupEffects(scene,heroMat,reduced,quality==='low'):undefined;
  function bridgeStructureChanged(){
    renderer.shadowMap.needsUpdate=true;
    // Undo can remove the section under Hero while she edits at its edge.
    // Return her to the nearest remaining footing rather than strand her.
    if(platform&&bridgePuzzle&&!inMeadow&&!bridgePuzzle.walkable(platform.x,platform.z)){
      const x=THREE.MathUtils.clamp(platform.x,-BRIDGE_HALF_WIDTH+C.heroRadius,BRIDGE_HALF_WIDTH-C.heroRadius),z=Math.max(platform.z,bridgePuzzle.builtEdge+C.heroRadius+.25);
      platform=new CastlePlatformMotion(x,z,hero.heading,groundsSurface);hero.x=x;hero.z=z;hero.speed=0;navigation?.clear();resetJourney();
    }
  }
  const bridgeExperience=bridgePuzzle?await createBridgeExperience(scene,bridgePuzzle,bridgeRoot,reduced,lanterns!.lights,()=>{
    setFreeCamera(false);keys.clear();jumpPressed=divePressed=false;platform?.cancelSprint(true);navigation?.clear();resetJourney();
  },()=>{renderer.shadowMap.needsUpdate=true;canvas.focus();},()=>{pickupEffects?.collect(pickupHero.set(hero.x,platform?.y??surfaceHeight(hero.x,hero.z),hero.z));},story!.actions,bridgeStructureChanged,quality==='low'):undefined;
  let bridgeView=0;
  if(page>=119){
    const copy=document.createElement('button');copy.type='button';copy.className='castle-row castle-copy-camera';copy.dataset.castle='copy-camera';copy.setAttribute('aria-label','Camera telemetry');copy.setAttribute('aria-haspopup','dialog');copy.setAttribute('aria-expanded','false');
    copy.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 6h5l2-3h4l2 3h5v14H3Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="13" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
    copy.append(' Camera telemetry');
    const telemetryFlyout=createCameraTelemetryFlyout(()=>{
      return {page,location:inMeadow?activePair?.id??'meadow':'grounds',position:camera.position.toArray(),target:lookAt.toArray(),direction:camera.getWorldDirection(new THREE.Vector3()).toArray(),up:camera.up.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far,yaw,pitch,distance,freeCamera,hero:{x:hero.x,y:platform?.y,z:hero.z,heading:hero.heading,velocity:platform?[platform.vx,platform.vy,platform.vz]:undefined,grade:platform?.grade,action:heroMesh.userData.exploration,scaffold:platform?.scaffold&&{id:platform.scaffold.route.id,progress:platform.scaffold.progress}},viewport:{width:innerWidth,height:innerHeight},water:waterEffects?.diagnostics};
    });
    copy.onclick=()=>telemetryFlyout.open(copy);panel.append(copy);
  }
  function setFreeCamera(on: boolean) {
    if (!freeControls || on === freeCamera) return;
    controllerOwnsCamera=false;
    if(on)takeCameraControl();
    keys.clear(); jumpPressed = divePressed = false;
    platform?.cancelSprint(true);
    navigation?.clear(); clearMeadowRoute(); doorTarget = false;
    if (on) {
      camera.up.set(0, 1, 0);
      // Follow framing stores a unit-length look ray, not an orbit pivot.
      // Preserve the view direction while giving freecam the current zoom range.
      const pivot=new THREE.Vector3().subVectors(lookAt,camera.position).normalize()
        .multiplyScalar(Math.max(2.6,distance)).add(camera.position);
      freeControls.frame({id:'grounds-free', name:'Castle grounds', position:camera.position.toArray(), target:pivot.toArray(), durationMs:0}, 0);
      freeControls.update(0, 1, true); freeControls.select('freecam', performance.now());
    }
    freeCamera = on; freeToggle.checked = on;
    canvas.dataset.castleCamera = on ? 'free' : 'follow';
    hint.textContent = '';hint.hidden=true;
    hint.classList.remove('fade');
    if(!on){adoptFollowCamera();if(inMeadow)resetPlayCamera();}
  }
  addEventListener('keydown', e => {
    if(portalControls?.paused||story?.open||worldRewardOpen||spellTest?.active||handBoard?.active)return;
    if(bridgeExperience?.active)return;
    if ((e.target as HTMLElement)?.closest?.('select,button,input,textarea,[contenteditable="true"]')) return;
    if(grounds&&mode==='play'&&e.code==='KeyL'){if(!e.repeat){e.preventDefault();setFreeCamera(!freeCamera);}return;}
    if (freeCamera && e.key==='Escape') { setFreeCamera(false); return; }
    if (mode === 'flight' && (e.key === ' ' || e.key === 'Escape' || e.key === 'Enter')) { e.preventDefault(); skip(); return; }
    if (grounds && mode === 'flight') return;
    if (grounds && !freeCamera && !e.repeat && !keys.has(e.code)) {
      if(inMeadow&&(e.code==='KeyQ'||e.code==='KeyE'))takeCameraControl();
      if (e.code === 'Space') jumpPressed = true;
      if (e.code === 'KeyX') divePressed = true;
    }
    keys.add(e.code); if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); jumpPressed = divePressed = false; platform?.cancelSprint(true); });
  function takeCameraControl(){
    combatWoods?.foundations.grid.resetDoubleTap();
    woodsCameraFlight=undefined;
    treeOpeningHeld=false;
    if(woodsOverhead){woodsOverhead=false;woodsPreviousView=undefined;woodsOpeningHeld=true;canvas.dataset.castleCamera=freeCamera?'free':'follow';}
    if(!woodsOpeningHeld&&!journey?.active&&!bridgeJourney?.active)return;
    woodsOpeningHeld=false;woodsHeldView=undefined;
    const ground=platform?.y??surfaceHeight(hero.x,hero.z),dx=camera.position.x-hero.x,dz=camera.position.z-hero.z;
    const lift=camera.position.y-ground-SHOULDER.height;
    yaw=Math.hypot(dx,dz)<.001?Math.atan2(-camera.up.x,-camera.up.z):Math.atan2(dx,dz);pitch=THREE.MathUtils.clamp(Math.atan2(lift,Math.hypot(dx,dz)),-.35,CASTLE_MAX_PITCH);
    distance=THREE.MathUtils.clamp(Math.hypot(dx,lift,dz),natural?.7:2.6,natural?450:165);followFov=camera.fov;
    journey?.release();bridgeJourney?.release();
  }
  function zoomCamera(amount:number){
    if(woodsOverhead){woodsOverheadHeight=THREE.MathUtils.clamp(woodsOverheadHeight*Math.exp(amount),3,60);return;}
    takeCameraControl();
    if(freeCamera)freeControls!.dolly(amount);
    else distance=THREE.MathUtils.clamp(distance*Math.exp(amount),natural?.7:2.6,natural?450:165);
  }
  function acquireControllerCamera(){
    controllerOwnsCamera=true;
    if(woodsOverhead)return;
    // An explicitly selected free camera keeps its own framing and LB zoom.
    if(freeCamera)return;
    takeCameraControl();adoptFollowCamera();controllerView=true;
    yaw=hero.heading+Math.PI;pitch=.13;distance=4.5;followFov=SHOULDER.fov;
  }
  const groundsGestures = new CastleCameraGestures({
    free: () => freeCamera,
    orbit: (dx, dy) => {
      takeCameraControl();
      if (freeCamera) freeControls!.orbit(dx * .005, dy * .005);
      else { yaw -= dx * .0045; pitch = THREE.MathUtils.clamp(pitch + dy * .003, natural?-1.3:-.35, CASTLE_MAX_PITCH); }
    },
    pan: (dx, dy) => {
      takeCameraControl();
      const units = freeControls!.snapshot().distance * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, canvas.clientHeight);
      freeControls!.pan(-dx * units, -dy * units, 0);
    },
    zoom: zoomCamera,
    tap: navigateToPointer,
    interruptTap:()=>combatWoods?.foundations.grid.resetDoubleTap(),
  });
  addEventListener('blur', () => { groundsGestures.clear(); canvas.classList.remove('dragging'); });
  let drag: {x: number; y: number; id: number; orbit: boolean; tap: boolean} | undefined;
  function cancelGridSelection(){combatWoods?.foundations.grid.cancelMove();}
  addEventListener('blur',cancelGridSelection);
  addEventListener('keydown',e=>{if(e.key==='Escape'&&(combatWoods?.foundations.grid.clearCandidate()||combatWoods?.foundations.grid.selectingMove)){if(combatWoods?.foundations.grid.selectingMove)cancelGridSelection();e.preventDefault();e.stopImmediatePropagation();}},true);
  function hoverGrid(point:{x:number;y:number}){
    if(!combatWoods||!inMeadow||activePair?.id!=='woods'||mode!=='play'||portalControls?.paused)return;
    const bounds=canvas.getBoundingClientRect();pointer.set(2*(point.x-bounds.left)/bounds.width-1,1-2*(point.y-bounds.top)/bounds.height);pickRay.setFromCamera(pointer,camera);
    const hit=pickRay.intersectObjects([...meadowPicks!,...combatWoods.gridPickTargets],false).find(visiblePointHit);
    combatWoods.foundations.grid.hover(hit?combatWoods.gridCardAt(hit)??null:null);
  }
  canvas.addEventListener('pointerleave',()=>combatWoods?.foundations.grid.hover(null));
  function approachFlurry(){
    if(!worldFlurry||!platform||!stickerInteraction||mode!=='play'||worldRewardOpen)return;
    platform.cancelSprint();doorTarget=false;resetJourney();
    const result=stickerInteraction.request(platform,{point:worldFlurry.point,reach:6,interact:actor=>{platform?.cancelSprint(true);resetJourney();return worldFlurry!.collect(actor);}});
    lastPointClick={kind:'sticker',object:'Flurry',result,point:worldFlurry.point.toArray()};
    if(result==='travelling'){directJourney();hint.textContent='Walking to Flurry…';hint.hidden=false;hint.classList.remove('fade');}
    else if(result==='blocked'){hint.textContent='No safe route to Flurry.';hint.hidden=false;hint.classList.remove('fade');}
  }
  canvas.addEventListener('pointerdown', e => {
    if(portalControls?.paused||studioEditor?.ownsPointer)return;
    if(bridgeExperience?.active)return;
    controllerOwnsCamera=false;
    if (grounds) {
      if (![0, 1, 2].includes(e.button)) return;
      if (e.pointerType !== 'touch') e.preventDefault();
      canvas.focus();
      if (mode === 'flight') {
        if (e.button===0) skip();
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      const pan = freeCamera && (e.button===2 || e.shiftKey && e.button===0);
      groundsGestures.down(e.pointerId, {x:e.clientX,y:e.clientY}, e.pointerType==='touch',pan,e.button!==0);
      canvas.classList.add('dragging'); return;
    }
    if (drag) return;
    canvas.focus(); if (mode === 'flight') { skip(); return; }
    const tap = grounds && e.button===0;
    drag = {x:e.clientX,y:e.clientY,id:e.pointerId,orbit:!tap,tap};
    canvas.setPointerCapture(e.pointerId);
    if (!tap) canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', e => {
    if(studioEditor?.ownsPointer)return;
    if(e.pointerType==='mouse'&&e.buttons===0)hoverGrid({x:e.clientX,y:e.clientY});
    if (grounds) { groundsGestures.move(e.pointerId, {x:e.clientX,y:e.clientY}); return; }
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.orbit) {
      if (Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<7) return;
      drag.orbit = true; canvas.classList.add('dragging');
    }
    yaw -= (e.clientX - drag.x) * .0045; pitch = THREE.MathUtils.clamp(pitch + (e.clientY - drag.y) * .003, natural?-1.3:-.35, CASTLE_MAX_PITCH); drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = (e: PointerEvent) => {
    if(studioEditor?.ownsPointer){groundsGestures.clear();canvas.classList.remove('dragging');return;}
    if (grounds) {
      const control = e.ctrlKey || keys.has('ControlLeft') || keys.has('ControlRight');
      groundsGestures.up(e.pointerId,{x:e.clientX,y:e.clientY},e.type!=='pointerup',control);
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      canvas.classList.remove('dragging'); return;
    }
    if (drag?.id !== e.pointerId) return;
    if (e.type==='pointerup' && drag.tap && !drag.orbit && Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<7) {
      navigateToPointer({x:e.clientX,y:e.clientY});
    }
    drag = undefined; canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture',endDrag);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    if(portalControls?.paused)return;
    if(studioEditor?.ownsPointer){e.preventDefault();return;}
    if(bridgeExperience?.active){e.preventDefault();return;}
    e.preventDefault(); if (mode !== 'play') return;
    controllerOwnsCamera=false;
    takeCameraControl();
    if (grounds) {
      const pixels = e.deltaY * (e.deltaMode===1 ? 16 : e.deltaMode===2 ? canvas.clientHeight : 1);
      const amount = THREE.MathUtils.clamp(pixels * .001, -.3, .3);
      if (freeCamera) freeControls!.dolly(amount);
      else distance = THREE.MathUtils.clamp(distance * Math.exp(amount), natural?.7:2.6, natural?450:165);
    } else distance = THREE.MathUtils.clamp(distance * Math.exp(e.deltaY * .0012), 2.6, 14);
  }, {passive: false});

  // ---------- per-frame ----------
  const fps = document.getElementById('fps-readout'), stats = new URLSearchParams(location.search).has('stats');
  if (fps) {fps.hidden=false;fps.textContent='— FPS';fps.setAttribute('aria-label','Frames per second');fps.setAttribute('aria-live','off');}
  let last = performance.now(), slowTime = 0, watched = 0, statFrames = 0, statTime = 0, autoLow = false;
  const camRight = new THREE.Vector3(), camFwd = new THREE.Vector3();

  function updateCrossing(dt: number) {
    if (!crossing || !platform) return false;
    const door = currentDoor()!;
    crossing.age += dt;
    const progress = reduced ? 1 : Math.min(1,crossing.age/.40);
    if (progress < 1) {
      const side=Math.sign(crossing.depth)||1;
      const point = door.point(THREE.MathUtils.lerp(crossing.depth,-side*.4,progress),crossing.lateral);
      platform.x = point.x; platform.z = point.z;
      platform.vx = -door.normal.x*side*2.6; platform.vz = -door.normal.z*side*2.6;
      platform.heading = Math.atan2(-door.normal.x*side,-door.normal.z*side);
      return false;
    }
    const exit = otherDoor()!;
    const spawn = exit.point(inMeadow ? 1.8 : activePair?.id==='meadow'?1.8*MEADOW_SCALE.horizontal:3.1);
    const heading = Math.atan2(exit.normal.x,exit.normal.z);
    setFreeCamera(false);
    setMeadowActive(!inMeadow);
    platform = new CastlePlatformMotion(spawn.x,spawn.z,heading,inMeadow ? meadow!.surface : groundsSurface);
    meadowFooting = inMeadow ? {x:spawn.x,y:platform.y,z:spawn.z} : undefined;
    hero.view = undefined;
    heroMat.clippingPlanes = null;
    blob.visible = true;
    portalEcho?.removeFromParent();
    // Keep the camera facing the same direction relative to the doorway.
    yaw = THREE.MathUtils.euclideanModulo(yaw+exit.door.yaw+Math.PI-door.door.yaw,2*Math.PI);
    distance = inMeadow ? 5.6 : 4.5;
    pitch = .16;
    exit.flash(portalClock,1);
    crossing = undefined;
    return true;
  }

  function updateHero(dt: number) {
    if(!inMeadow||activePair?.id!=='woods'){gridJump=undefined;gridStanding=false;combatWoods?.setGridJumping(false);}
    let mx = 0, mz = 0;
    if (mode === 'play' && !grounds) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    }
    if(portals&&mode==='play'&&!freeCamera){mx=pad.x;mz=pad.y;if(Math.hypot(mx,mz)>.01){pendingScaffold=undefined;navigation?.clear();clearMeadowRoute();doorTarget=false;resetJourney();}}
    const len = Math.hypot(mx, mz), crouch = !freeCamera && (keys.has('KeyC')||pad.crouch);
    if(!gridJump&&(len>.01||crouch||jumpPressed||pad.jump||meadowTarget))gridStanding=false;
    if (divePressed || crouch) {
      pendingScaffold=undefined;
      navigation?.clear(); clearMeadowRoute(); doorTarget = false;
    }
    const wasTravelling=!!meadowTarget;
    const auto:MeadowTravelIntent|undefined = platform && (inMeadow ? meadow!.navigation.steer(platform,dt) : navigation?.steer(platform,dt));
    if(doorTarget&&!crossing&&!auto&&(!inMeadow||meadow!.navigation.diagnostics.result!=='arrived')){
      doorTarget=false;portalGuard.arm(undefined,platform);meadow?.navigation.invalidate();
    }
    if(inMeadow){
      meadowTarget=meadow!.navigation.destination;
      if(wasTravelling&&!meadowTarget){
        hint.textContent=meadow!.navigation.diagnostics.result==='arrived'
          ? 'Reached the landing.'
          : 'The route is blocked.';
        hint.hidden=false;
        hint.classList.remove('fade');
      }
    }
    const running = grounds ? !!auto?.run || len>.55 || pad.sprint&&len>.15 : keys.has('ShiftLeft') || keys.has('ShiftRight');
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const xInput = len ? (fx*mz+rx*mx)/len : 0, zInput = len ? (fz*mz+rz*mx)/len : 0;
    if(portals&&!freeCamera&&!auto&&platform&&len>.15){
      const manualDoor=controllerPortalEntry(inMeadow&&activePair?[activePair.exit]:portalPairs.map(pair=>pair.entry),platform,{x:xInput*len,z:zInput*len});
      if(manualDoor){
        if(!inMeadow)activePair=portalPairs.find(pair=>pair.entry===manualDoor)!;
        portalGuard.arm(manualDoor);doorTarget=true;
      }
    }
    let changedScene = false;
    if (platform) {
      const door = currentDoor();
      if (crossing) changedScene = updateCrossing(dt);
      else if(gridJump){
        const duration=gridJump.duration,p=gridJump.update(dt);
        Object.assign(platform,{x:p.x,y:p.y,z:p.z,heading:p.heading,vx:0,vy:p.done?0:1,vz:0,grounded:p.done,airMove:'jump',jumpNumber:3,airTime:p.age,flightTime:duration,landing:p.done?.14:0});
        if(p.done){platform.heading=bearing(COMBAT_WOODS.enemy.x-p.x,COMBAT_WOODS.enemy.z-p.z);gridJump=undefined;gridStanding=true;combatWoods?.setGridJumping(false);}
      }
      else {
        platform.update(dt,{x:auto?.x ?? xInput*Math.min(1,len),z:auto?.z ?? zInput*Math.min(1,len),run:running,crouch,
          sprint:portals&&!auto&&!freeCamera?pad.sprint:undefined,
          jumpPressed:jumpPressed || pad.jump || !!auto?.jump,jumpHeld:!freeCamera && (keys.has('Space')||pad.jumpHeld) || !!auto,divePressed:divePressed||pad.attack,
          jumpTier:auto?.jumpTier,jumpLanding:auto?.jumpLanding,
          sustainSprint:false});
        if (inMeadow && platform.grounded) {
          if (meadow!.dry(platform.x,platform.z,C.heroRadius,platform.y)) meadowFooting = {x:platform.x,y:platform.y,z:platform.z};
          else if (meadowFooting) {
            platform = new CastlePlatformMotion(meadowFooting.x,meadowFooting.z,platform.heading,meadow!.surface);
            platform.y=meadowFooting.y;
            clearMeadowRoute(); doorTarget = false;
          }
        }
        if (!freeCamera && door?.canCross(platform,doorTarget&&portalGuard.permits(door))) {
          crossing = {age:0,lateral:door.lateral(platform.x,platform.z),depth:door.distance(platform.x,platform.z)};
          door.flash(portalClock,-1);
          portalSound?.play(!inMeadow);
          navigation?.clear(); clearMeadowRoute(); doorTarget = false; platform.cancelSprint();
          heroMat.clippingPlanes = [door.plane]; blob.visible = false;
          const exit = otherDoor()!;
          portalEcho!.material.clippingPlanes = [exit.plane];
          exit.scene.add(portalEcho!);
          changedScene = updateCrossing(0);
        }
      }
      if(pendingScaffold&&!auto&&Math.hypot(platform.x-pendingScaffold.from.x,platform.z-pendingScaffold.from.z)>=.3)pendingScaffold=undefined;
      if(pendingScaffold&&platform.grounded&&Math.hypot(platform.x-pendingScaffold.from.x,platform.z-pendingScaffold.from.z)<.3){
        const accepted=platform.beginScaffold(pendingScaffold);pendingScaffold=undefined;navigation?.clear();clearMeadowRoute();if(!accepted){hint.textContent='That scaffold has no supported landing.';hint.hidden=false;}
      }
      jumpPressed = divePressed = false;
      hero.x = platform.x; hero.z = platform.z; hero.speed = platform.speed; hero.heading = platform.heading;
    } else {
      const want = len ? (running ? 7.2 : 2.6) : 0;
      hero.speed += (want - hero.speed) * Math.min(1, dt * 9);
      if (len && hero.speed > .05) {
        const moved = resolveMove(hero.x,hero.z,xInput*hero.speed*dt,zInput*hero.speed*dt);
        hero.x = moved.x; hero.z = moved.z;
        const want = bearing(xInput,zInput), diff = Math.atan2(Math.sin(want-hero.heading),Math.cos(want-hero.heading));
        hero.heading += diff * Math.min(1,dt*10);
      }
    }
    const gait = (!platform && !len) || hero.speed < .3 ? 'idle' : running || platform?.sprinting ? 'run' : 'walk';
    hero.clock = gait === 'idle' ? 0 : hero.clock + dt;
    const ground = surfaceHeight(hero.x, hero.z);
    const dx = camera.position.x - hero.x, dz = camera.position.z - hero.z;
    const toCamera = bearing(dx, dz);
    const airborne = platform ? !platform.grounded : false;
    const bodyY = platform?.y ?? ground;
    const elevation = Math.atan2(camera.position.y - bodyY - .55, Math.hypot(dx, dz));
    const f = heroRigFrame(hero.heading, toCamera, gait, hero.clock, hero.view, elevation);
    hero.view = f.view;
    const target = inMeadow ? meadowTarget : navigation?.destination;
    const still=mode==='play'&&len===0&&!target&&!airborne&&(!platform||hero.speed<.3&&!platform.crouching);
    combatThreat=!!(inMeadow&&activePair?.id==='woods'&&combatWoods?.combatEnabled&&combatWoods.enemy.visible&&Math.hypot(hero.x-COMBAT_WOODS.enemy.x,hero.z-COMBAT_WOODS.enemy.z)<(combatThreat?18:14));
    const worldAction=gridStanding&&still?{action:'combatReady' as const,seconds:0}:grounds?worldDirector.update(dt,platform,still,reduced,combatThreat):undefined;
    let worldPose=worldAction?heroWorldActionFrame(worldAction.action,worldAction.seconds,worldAction.heading??hero.heading,toCamera,elevation,worldView,reduced):undefined;
    if(worldPose)worldView=worldPose.view;
    let worldTexture=worldPose?worldTextures.get(worldPose.action):undefined;
    if(!worldTexture&&combatThreat&&worldAction?.action.startsWith('combat')){worldTexture=worldTextures.get('combatReady');worldPose=heroWorldActionFrame('combatReady',0,hero.heading,toCamera,elevation,worldView,true);}
    const idle = idleDirector.update(worldAction&&still?0:dt,still&&!combatThreat,reduced);
    if (destinationRing) {
      destinationRing.visible = !!target;
      if (target) {
        destinationRing.position.set(target.x,(inMeadow ? (target as MeadowPoint).y : surfaceHeight(target.x,target.z))+.024,target.z);
        destinationRing.rotation.x = inMeadow ? 0 : groundsMeadowPitch(target.z);
      }
    }
    let platformFrame: number | undefined;
    if (platform) {
      if (airborne) platformFrame = platformAirFrame(platform);
      else if (platform.landing > 0) platformFrame = 3;
      else if (platform.skidding || platform.crouching) platformFrame = 0;
      else if (gait !== 'idle') platformFrame = 12 + Math.floor(hero.clock*(platform.crouching?3:platform.sprinting?14:running?11:6))%4;
    }
    const standing = gait === 'idle' && platformFrame === undefined;
    const newAtlas = standing || platformFrame !== undefined;
    const view = castleIdleView(f.view);
    const tex = worldTexture??(platformFrame !== undefined ? platformSheets.get(view)! : standing ? idleSheets.get(view)!
      : sheets.get(f.view.elevation === 'low' ? 'walking' : 'walkingHigh')!);
    const [W, H] = worldTexture&&worldPose?[worldPose.atlas.width,worldPose.atlas.height]:newAtlas ? [CASTLE_IDLE_ATLAS.size, CASTLE_IDLE_ATLAS.size] : HERO_RIG_SIZE[f.sheet];
    const [x, y, width, height] = worldTexture&&worldPose?worldPose.rect:newAtlas ? castleIdleRect(platformFrame ?? idle.frame) : f.rect;
    if (heroMat.map !== tex) { heroMat.map = tex; heroMat.needsUpdate = true; }
    tex.repeat.set(width / W, height / H); tex.offset.set(x / W, 1 - (y + height) / H);
    const breath = standing && !reduced && idle.action === 'stand' ? 1 + Math.sin(performance.now() / 1000 * 2) * .008 : 1;
    const printWidth = worldTexture&&worldPose?worldPose.planeSize:newAtlas ? CASTLE_IDLE_ATLAS.planeSize : f.width;
    const printHeight = worldTexture&&worldPose?worldPose.planeSize:newAtlas ? CASTLE_IDLE_ATLAS.planeSize : f.height;
    heroMesh.scale.set(printWidth * (worldTexture&&worldPose?worldPose.flip:f.flip), printHeight * breath, 1);
    heroMesh.userData.idleAction = still&&worldTexture&&worldPose?worldPose.action:standing?idle.action:'';
    heroMesh.userData.exploration={action:worldAction?.action??(airborne?platform?.airMove==='back'?'backflip':platform?.airMove==='side'?'sideflip':'jump':platform?.crouching?'crouch':gait==='idle'?idle.action:gait),frame:worldTexture?worldPose?.frame:platformFrame??idle.frame,view:worldTexture?worldPose?.key:view,flip:worldTexture?worldPose?.flip:f.flip,generated:!!worldTexture,phase:worldAction?.seconds??hero.clock,grade:platform?.grade,quickTurn:platform?.quickTurn,enemyNear:combatThreat};
    heroMesh.position.set(hero.x, airborne ? bodyY + .48 : ground + .03, hero.z);
    // the standee is unlit paint: dim it when the stonework stands between her and the lamp
    toLight.copy(key.position).normalize(); shadowRay.set(new THREE.Vector3(hero.x, bodyY+.6, hero.z), toLight); shadowRay.far = 200;
    const shaded = !inMeadow && renderer.shadowMap.enabled && shadowRay.intersectObject(colliders, true).length ? 1 : 0;
    hero.shade += (shaded - hero.shade) * Math.min(1, dt * 6 || 1);
    heroMat.color.copy(litTint).lerp(shadeTint, hero.shade * .72);
    if (inMeadow) heroMat.color.set('#fff0d6');
    else if (lanterns) heroMat.color.lerp(candleTint,lanterns.sample(hero.x,bodyY+.6,hero.z));
    if ((worldTexture&&worldPose?worldPose.view:f.view).elevation === 'top') {
      heroMesh.rotation.set(-Math.PI / 2, 0, (worldTexture?worldAction?.heading??hero.heading:hero.heading) - Math.PI, 'YXZ');
      // The standing geometry pivots at the paws. Center the overhead print on Hero.
      heroMesh.translateY(-printHeight * breath / 2);
      if (!airborne) heroMesh.position.y = ground + .065;
    } else {
      heroMesh.rotation.set(-Math.max(0, elevation), toCamera, 0, 'YXZ');
      if (airborne) heroMesh.translateY(-printHeight/2);
    }
    if (crossing && portalEcho) {
      // As in the reference, the moving figure can straddle two scenes.
      // Both halves share the same animation and meet at the portal plane.
      heroMesh.updateMatrix();
      currentDoor()!.mapTo(otherDoor()!,portalPose).multiply(heroMesh.matrix)
        .decompose(portalEcho.position,portalEcho.quaternion,portalEcho.scale);
      if (portalEcho.material.map !== tex) {
        portalEcho.material.map = tex; portalEcho.material.needsUpdate = true;
      }
      portalEcho.material.color.copy(heroMat.color);
    }
    blob.position.set(hero.x, ground + .05, hero.z);
    blob.rotation.set(grounds && !inMeadow ? groundsMeadowPitch(hero.z) : 0, toCamera, 0);
    if (platform) {
      const lift = Math.max(0,bodyY-ground);
      blob.scale.setScalar(1+lift*.18);
      blob.material.opacity = 1/(1+lift*.7);
      sprintPaint?.(platform.sprinting && hero.speed>6 && !reduced,platform.vx,platform.vz,camera,performance.now()/1000);
    }
    if (changedScene) resetPlayCamera();
  }

  function updateCamera(dt: number) {
    if(spellTest?.camera(dt))return;
    if(handBoard?.camera())return;
    if(woodsCameraFlight&&mode==='play'&&inMeadow&&activePair?.id==='woods'){
      const flight=woodsCameraFlight;flight.elapsed=flight.jump?flight.jump.elapsed:flight.elapsed+dt;const duration=flight.duration??1.35;
      const target=woodsOverhead?woodsOverheadPose({x:hero.x,y:platform?.y??0,z:hero.z},woodsOverheadHeight):woodsHeldView;
      if(target){const pose=woodsCameraFlightPose(flight.from,target,flight.elapsed,duration);camera.up.fromArray(pose.up);setCamera(pose.position,pose.target,pose.fov);aimTarget.copy(lookAt);}
      if(flight.elapsed>=duration){woodsCameraFlight=undefined;adoptFollowCamera();}
      return;
    }
    if(woodsOverhead&&mode==='play'&&inMeadow&&activePair?.id==='woods'){
      const p=woodsOverheadPose({x:hero.x,y:platform?.y??surfaceHeight(hero.x,hero.z),z:hero.z},woodsOverheadHeight);
      yaw=Math.atan2(-p.up[0],-p.up[2]);pitch=Math.PI/2;distance=woodsOverheadHeight;
      camera.up.fromArray(p.up);setCamera(p.position,p.target,p.fov);aimTarget.copy(lookAt);return;
    }
    // A restored snapshot owns its exact pose until fresh movement/camera input.
    // Do not pass it through the ordinary boom/terrain correction on return.
    if(woodsHeldView&&mode==='play'&&inMeadow&&activePair?.id==='woods'&&!freeCamera){
      if((platform?.speed??0)>.05)takeCameraControl();
      else{camera.up.fromArray(woodsHeldView.up);setCamera(woodsHeldView.position,woodsHeldView.target,woodsHeldView.fov);return;}
    }
    bridgeView=THREE.MathUtils.damp(bridgeView,bridgeExperience?.active?1:0,reduced?100:5,dt);
    if(Math.abs(bridgeView-(bridgeExperience?.active?1:0))<.0005)bridgeView=bridgeExperience?.active?1:0;
    if(bridgeExperience?.active||bridgeView>.002){
      const pose=shoulderPose(hero.x,hero.z,yaw,pitch,distance,surfaceHeight(hero.x,hero.z));
      camPos.set(...pose.position).lerp(new THREE.Vector3(0,48,52.6),bridgeView);
      camTarget.set(...pose.target).lerp(new THREE.Vector3(0,0,52.6),bridgeView);
      camera.up.set(0,1,-bridgeView).normalize();
      setCamera(camPos,camTarget,THREE.MathUtils.lerp(SHOULDER.fov,42,bridgeView));aimTarget.copy(lookAt);return;
    }
    if (freeCamera && freeControls) {
      const right = pad.x + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const forward = pad.y + Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const up = Number(keys.has('KeyE')) - Number(keys.has('KeyQ'));
      const length = Math.hypot(right, forward, up);
      if (length) {
        const speed = Math.max(2, freeControls.snapshot().distance * .5) * (keys.has('ShiftLeft')||keys.has('ShiftRight')?4:2) * dt / length;
        freeControls.pan(right * speed, forward * speed, up * speed);
      }
      const snapshot = freeControls.snapshot();
      yaw = THREE.MathUtils.degToRad(snapshot.yaw);
      camera.up.set(0,1,0); setCamera(camera.position, snapshot.target, camera.fov);
      aimTarget.copy(lookAt); return;
    }
    if (mode === 'flight') {
      flightTime += dt * flightSpeed;
      if (showFlight()) arrive();
      return;
    }
    if(treeOpeningHeld&&treeArrival&&!inMeadow){
      if((platform?.speed??0)>.05||platform&&!platform.grounded)takeCameraControl();
      else return;
    }
    if(woodsOpeningHeld&&inMeadow&&activePair?.id==='woods'&&woodsArrival){
      if((platform?.speed??0)>.05||freeCamera)takeCameraControl();
      else{const p=woodsHeldView??woodsArrival.landed;if(woodsHeldView)camera.up.fromArray(woodsHeldView.up);else camera.up.set(0,1,0);setCamera(p.position,p.target,p.fov);return;}
    }
    const ground = platform?.y ?? surfaceHeight(hero.x, hero.z);
    journeyHero.set(hero.x,ground,hero.z);journeyVelocity.set(platform?.vx??0,platform?.vy??0,platform?.vz??0);
    const cinematic=bridgeJourney?.update(dt,{hero:journeyHero,destination:navigation?.destination,aspect:camera.aspect})??journey?.update(dt,{hero:journeyHero,velocity:journeyVelocity,grounded:platform?.grounded??true,
      destination:inMeadow?meadow!.navigation.destination:navigation?.destination,
      route:inMeadow?meadow!.navigation.cameraRoute:navigation?.cameraRoute??[],aspect:camera.aspect});
    followFov=THREE.MathUtils.lerp(followFov,SHOULDER.fov,1-Math.exp(-dt*1.2));
    const viewFov=cinematic?.fov??followFov,effectiveYaw=cinematic?.yaw??yaw,effectivePitch=cinematic?.pitch??pitch;
    if(cinematic){camPos.copy(cinematic.position);camTarget.copy(cinematic.target);}
    else{let pose=shoulderPose(hero.x,hero.z,yaw,pitch,distance,ground,controllerView?0:SHOULDER.side);if(natural&&!inMeadow)pose=groundedOrbitPose(pose,yaw,pitch,treeGround);camPos.set(...pose.position);camTarget.set(...pose.target);}
    const head = new THREE.Vector3(hero.x,ground+1.3,hero.z);
    const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(viewFov / 2)) * Math.min(1,camera.aspect));
    const radius = natural?.35:.8, minRange = radius / Math.sin(halfFov*.94);
    heroCenter.set(hero.x,ground+.55,hero.z);
    function makeFramingRoom(position: THREE.Vector3) {
      toHero.subVectors(heroCenter,position);
      if (toHero.lengthSq()<minRange*minRange) {
        position.y = heroCenter.y+Math.sqrt(minRange*minRange-toHero.x*toHero.x-toHero.z*toHero.z);
      }
    }
    const k = 1-Math.exp(-dt*12);
    if (inMeadow && meadowCamera) {
      const lift = Number(keys.has('KeyE'))-Number(keys.has('KeyQ'));
      meadowLift = THREE.MathUtils.clamp(meadowLift+lift*dt*Math.max(3,distance*.55),-1.5,55);
      camPos.y = Math.max(.45,camPos.y+meadowLift);
      if(!cinematic)camTarget.y = THREE.MathUtils.lerp(ground+.55,camTarget.y,.32);
      if(activePair?.id==='meadow')camPos.z = Math.min(camPos.z,MEADOW_DOOR.z-.16);
      makeFramingRoom(camPos);
      const probe = Math.max(.22,.12*Math.hypot(1,Math.tan(THREE.MathUtils.degToRad(viewFov/2))*Math.hypot(1,camera.aspect))+.06);
      camera.position.copy(meadowCamera.update(head,camPos,heroCenter,probe,dt));
    } else if(castleCamera){
      camPos.y=Math.max(natural?treeGround(camPos.x,camPos.z)+.45:.45,camPos.y);makeFramingRoom(camPos);
      camera.position.copy(castleCamera.update(head,camPos,heroCenter,.26,dt));
      if(natural)camera.position.y=Math.max(camera.position.y,treeGround(camera.position.x,camera.position.z)+.35);
    } else {
      const dir = camPos.clone().sub(head), d = dir.length();
      ray.set(head,dir.normalize()); ray.far = d;
      const hit = ray.intersectObject(colliders,true)[0];
      if (hit) camPos.copy(head).addScaledVector(dir,Math.max(.6,hit.distance-.35));
      camPos.y = Math.max(.45,camPos.y);
      camera.position.lerp(camPos,k);
      makeFramingRoom(camera.position);
    }
    if(natural&&!cinematic){
      aimTarget.set(...orbitLookTarget(camera.position.toArray(),effectiveYaw,effectivePitch));
    }else aimTarget.lerp(camTarget,k);
    toHero.subVectors(heroCenter, camera.position);
    const aimLimit = Math.max(0,halfFov-Math.asin(Math.min(1,radius/Math.max(.001,toHero.length()))));
    toHero.normalize();
    aimDirection.subVectors(aimTarget, camera.position).normalize();
    const angle = toHero.angleTo(aimDirection);
    if (angle > aimLimit && !(natural&&!cinematic)) {
      aimTurn.setFromUnitVectors(toHero, aimDirection);
      limitedTurn.identity().slerp(aimTurn, aimLimit / angle);
      aimDirection.copy(toHero).applyQuaternion(limitedTurn);
    }
    if (inMeadow) {
      // The actual view can become overhead when the boom retracts even at
      // low input pitch. Keep screen up registered to the orbit heading there.
      const overhead = THREE.MathUtils.smoothstep(Math.abs(aimDirection.y),.65,.96);
      camTarget.set(Math.cos(effectiveYaw),0,-Math.sin(effectiveYaw)).cross(aimDirection).normalize();
      camera.up.set(0,1,0).lerp(camTarget,overhead).normalize();
    } else {
      const upBlend = THREE.MathUtils.smoothstep(effectivePitch,1,CASTLE_MAX_PITCH);
      camera.up.set(-Math.sin(effectiveYaw)*upBlend,1-upBlend,-Math.cos(effectiveYaw)*upBlend).normalize();
    }
    camTarget.copy(camera.position).add(aimDirection);
    setCamera(camera.position, camTarget, viewFov);
  }

  function resetPlayCamera() {
    if(treeOpeningHeld&&treeArrival&&!inMeadow){
      camera.up.set(0,1,0);
      setCamera(treeArrival.camera.position,treeArrival.camera.target,treeArrival.camera.fov);
      adoptFollowCamera();
      return;
    }
    if(woodsCameraFlight){updateCamera(0);return;}
    if(woodsOverhead&&inMeadow&&activePair?.id==='woods'){updateCamera(0);return;}
    if(woodsOpeningHeld&&woodsArrival){const p=woodsHeldView??woodsArrival.landed;if(woodsHeldView)camera.up.fromArray(woodsHeldView.up);else camera.up.set(0,1,0);setCamera(p.position,p.target,p.fov);adoptFollowCamera();return;}
    let p = shoulderPose(hero.x,hero.z,yaw,pitch,distance,surfaceHeight(hero.x,hero.z),controllerView?0:SHOULDER.side);
    if(natural&&!inMeadow)p=groundedOrbitPose(p,yaw,pitch,treeGround);
    if (inMeadow) {
      if(activePair?.id==='meadow')p.position[2] = Math.min(p.position[2],MEADOW_DOOR.z-.16);
      p.target[1] = THREE.MathUtils.lerp(surfaceHeight(hero.x,hero.z)+.55,p.target[1],.32);
    }
    setCamera(p.position,p.target,SHOULDER.fov); aimTarget.copy(lookAt); updateCamera(0);
  }

  async function setSplats(on: boolean, persist: boolean, report?: (fraction: number, label: string) => void | Promise<void>) {
    if (persist) { try { localStorage.setItem(SPLAT_PREFERENCE, on ? 'on' : 'off'); } catch { /* per-visit only */ } }
    splatToggle.checked = on;
    if (on && !groveSplats && !meadowSplats) {
      splatToggle.disabled = true; canvas.dataset.splats = 'building';
      try { await (splatBuild ??= buildSplats(report)); }
      catch (error) { console.warn('Painterly splats could not be built', error); splatBuild = undefined; on = false; splatToggle.checked = false; }
      finally { splatToggle.disabled = false; }
    }
    groveSplats?.setEnabled(on); meadowSplats?.setEnabled(on);
    canvas.dataset.splats = on ? 'on' : 'off';
  }
  async function buildSplats(report?: (fraction: number, label: string) => void | Promise<void>) {
    const {createPaintSplatVariant} = await import('./splat/paintSplatVariant');
    const within = (object: THREE.Object3D, root?: THREE.Object3D) => { for (let o: THREE.Object3D | null = object; o; o = o.parent) if (o === root) return true; return false; };
    if (naturalGrove) {
      const fogWasOn = playerFog?.uniforms.uFogEnabled.value === 1;
      groveSplats = await createPaintSplatVariant(renderer, scene, {
        roots: [naturalGrove.root], quality, reduced,
        exclude: mesh => mesh.material === water || within(mesh, worldFlurry?.root),
        focus: {x: 0, y: 0, z: -4, radius: 112},
        hero: {color: '#ffcf8f', strength: .75, radius: 11},
        mist: workbench ? {color: '#c3cec6', density: .0105} : undefined,
        beforeBake: () => { playerFog?.setEnabled(false); naturalGrove?.atmosphere.setDistanceMist(0); },
        afterBake: () => { playerFog?.setEnabled(fogWasOn); naturalGrove?.atmosphere.setDistanceMist(1); },
        progress: fraction => report?.(fraction * .6, 'Painting the grove'),
      });
    }
    if (forestMeadow) {
      const bounds = new THREE.Box3(); for (const floor of forestMeadow.floors) bounds.union(new THREE.Box3().setFromObject(floor));
      const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
      meadowSplats = await createPaintSplatVariant(renderer, forestMeadow.scene, {
        roots: [forestMeadow.model, ...[forestMeadow.scene.getObjectByName('meadow-open-clearing-floor')].filter(o => !!o) as THREE.Object3D[]], quality, reduced, share: .8,
        focus: {x: center.x, y: center.y, z: center.z, radius: Math.max(size.x, size.z) * .55},
        hero: {color: '#fff1c8', strength: .2, radius: 7},
        progress: fraction => report?.(.6 + fraction * .4, 'Painting Sacred Forest Meadow'),
      });
    }
    canvas.dataset.splatDiagnostics = JSON.stringify({grove: groveSplats?.diagnostics, meadow: meadowSplats?.diagnostics});
  }
  function resize() {
    const w = innerWidth, h = innerHeight; viewport.resize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    const ratio = renderer.getPixelRatio(); starMat.uniforms.ratio.value = ratio; if (motes) (motes.material as THREE.ShaderMaterial).uniforms.ratio.value = ratio;
  }
  addEventListener('resize', resize); resize();

  function stepDown() {
    // Auto tier: sustained slow frames drop to the low tier for this visit.
    autoLow = true; dispatchEvent(new CustomEvent('book:render-quality', {detail: 'low'}));
    if (motes) motes.visible = false; vignette.classList.remove('soft-edges');
    ambiance?.setLow();
    lanterns?.setLow();
    waterEffects?.setLow();
    studioEngine?.setLow();worldFlurry?.setLow();naturalGrove?.setLow();groveSplats?.setLow();meadowSplats?.setLow();
    for(const view of portalViews.values())view.setLow();
    meadow?.art.setLow();paintedValley?.art.setLow();paintLab?.art.setLow();longs?.art.setLow();
    playerFog?.setLow();nightSky?.setLow();
    pickupEffects?.setLow();
    valley?.setLow();
    // the static shadow map is already baked; keeping it costs no extra passes
    canvas.dataset.castleAutoTier = 'low'; resize();
  }

  let worldTime=performance.now()/1000;
  function frame(now: number) {
    const frameSeconds=Math.max(0,(now-last)/1000),realDt=Math.min(.05,frameSeconds);
    pad=portalControls?.poll(now)??emptyPortalPad();
    if(portalControls?.paused){last=now;statFrames=statTime=0;if(fps&&fps.textContent!=='Paused')fps.textContent='Paused';requestAnimationFrame(frame);return;}
    if(portals&&!worldRewardOpen&&!spellTest?.active&&mode==='play'){
      if(pad.active&&!controllerOwnsCamera)acquireControllerCamera();
      if(pad.zoom)zoomCamera(pad.zoom*realDt*.35);
      if(pad.center){takeCameraControl();yaw=hero.heading+Math.PI;}
      if(pad.lookX||pad.lookY){takeCameraControl();if(freeCamera)freeControls!.orbit(pad.lookX*realDt*1.9,pad.lookY*realDt*1.3);else yaw-=pad.lookX*realDt*1.9;pitch=THREE.MathUtils.clamp(pitch+pad.lookY*realDt*1.3,natural?-1.3:-.35,CASTLE_MAX_PITCH);}
      if(pad.interact){
        const door=inMeadow?currentDoor():portalPairs.map(p=>p.entry).sort((a,b)=>Math.hypot(hero.x-a.door.x,hero.z-a.door.z)-Math.hypot(hero.x-b.door.x,hero.z-b.door.z))[0];
        if(platform&&door&&Math.hypot(platform.x-door.door.x,platform.z-door.door.z)<7){const projected=new THREE.Vector3(door.door.x,door.door.y+2,door.door.z).project(camera);const bounds=canvas.getBoundingClientRect();navigateToPointer({x:bounds.left+(projected.x+1)*bounds.width/2,y:bounds.top+(1-projected.y)*bounds.height/2});}
        else if(!inMeadow&&worldFlurry&&platform&&worldFlurry.point.distanceTo(new THREE.Vector3(platform.x,platform.y,platform.z))<8)approachFlurry();
      }
    }
    const dt = worldRewardOpen?0:Math.min(.05, (now - last) / 1000); last = now;
    worldTime+=dt;
    const t = portals?worldTime:now/1000;
    portalClock += dt;
    lanterns?.update(t);
    forestMeadow?.art.update(portalClock);
    paintedValley?.art.update(portalClock);
    longs?.art.update(portalClock);
    paintLab?.art.update(portalClock,inMeadow&&activePair?.id==='paint-lab'?hero:undefined);
    spellTest?.update(dt);
    if(!worldRewardOpen){if(!spellTest?.active)updateHero(dt);if(platform&&mode==='play'&&!inMeadow)stickerInteraction?.update(platform);updateCamera(dt);}naturalGrove?.update(reduced?0:t,hero);
    combatWoods?.update(camera,reduced?0:portalClock,heroMesh,mode==='play',dt);
    handBoard?.update(portalClock);
    flurryCompanion?.update(inMeadow?meadow!.scene:scene,camera,{x:hero.x,y:platform?.y??surfaceHeight(hero.x,hero.z),z:hero.z,heading:hero.heading},portalClock,reduced,inMeadow?meadow!.surface.height:surfaceHeight,mode==='play'&&!crossing);
    worldFlurry?.update(camera,reduced?0:t,reduced,hero,mode==='play'&&!inMeadow&&!worldRewardOpen);worldFlurry?.setHero(inMeadow?undefined:heroMesh);
    heroOverlap.update(!inMeadow&&sentientOverlapMode==='outline'&&worldFlurry?.root.visible?worldFlurry.body:undefined);
    studioEngine?.update(reduced?0:t,camera,renderer.domElement.height);studioEditor?.update(now);
    pickupHero.set(hero.x,platform?.y??surfaceHeight(hero.x,hero.z),hero.z);
    bridgeExperience?.update(dt,pickupHero,camera,!inMeadow,mode==='play'&&!freeCamera);
    pickupEffects?.update(dt,pickupHero,!inMeadow);
    story?.update();
    if (!inMeadow) {
      faceTrees(camera.position);
      playerFog?.update(t,hero.x,platform?.y ?? surfaceHeight(hero.x,hero.z),hero.z);
      nightSky?.update(t,renderer.getPixelRatio(),camera.position);
      if (!reduced && !grounds) (water.map as THREE.Texture).offset.x = t * .004;
      if (!reduced) groundsPaint?.update(t);
      ambiance?.update(t, renderer.getPixelRatio());
      waterEffects?.update(t);
      for(const pair of portalPairs)pair.entry.group.visible=false;
      waterEffects?.capture(renderer,scene,camera,t);
      for(const pair of portalPairs)pair.entry.group.visible=true;
    }
    starMat.uniforms.time.value = t; if (motes) (motes.material as THREE.ShaderMaterial).uniforms.time.value = t;
    for (const f of flags) f.rotation.y = Math.sin(t * 1.4 + f.userData.phase) * .35 - .4;
    if(groveSplats?.enabled||meadowSplats?.enabled){
      const heroAt={x:hero.x,y:platform?.y??surfaceHeight(hero.x,hero.z),z:hero.z};
      groveSplats?.update(t,camera,inMeadow?undefined:heroAt);
      meadowSplats?.update(t,camera,inMeadow&&activePair?.id==='meadow'?heroAt:undefined);
    }
    const viewingWoods=inMeadow&&!(woodsArrival&&mode==='flight'&&!woodsArrivalInWoods);
    // The return membrane is useful during crossing, but its tall card covers
    // the tactical floor once the camera has followed Hero into Woods.
    if(woodsReturn)woodsReturn.group.visible=!(viewingWoods&&activePair?.id==='woods'&&!crossing&&(mode==='play'||woodsArrivalInWoods));
    for(const pair of portalPairs){
      if(viewingWoods&&pair!==activePair)continue;
      const door=viewingWoods?pair.exit:pair.entry,other=viewingWoods?pair.entry:pair.exit;
      door.update(portalClock,woodsArrival&&mode==='flight'?door.door.x:hero.x,woodsArrival&&mode==='flight'?door.door.z:hero.z,reduced);
      const previewFrame=!viewingWoods&&!crossing?reduced?0:Math.floor(portalClock*12):undefined;
      portalViews.get(pair)!.render(renderer,camera,door,other,previewFrame);
    }
    renderWorld();
    if(inMeadow&&activePair?.id==='woods')combatWoods?.foundations.grid.paintPanel(renderer.domElement,now);
    if (quality === 'auto' && !autoLow && !document.hidden) {
      watched += dt; if (dt > 1 / 38) slowTime += dt;
      if (watched > 4) { if (slowTime / watched > .6) stepDown(); watched = slowTime = 0; }
    }
    if (fps) { statFrames++; statTime += frameSeconds; if (statTime > .5) { fps.textContent = `${Math.round(statFrames / statTime)} FPS${stats?` · ${renderer.info.render.calls} draws · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris`:''}`; statFrames = 0; statTime = 0; } }
    requestAnimationFrame(frame);
  }

  if(natural){
    for(const object of scene.children)if(!(object instanceof THREE.Light)&&object!==heroMesh&&object!==blob&&object!==nightSky?.group)object.visible=false;
    lanterns!.lights.power.value.fill(0);
    // Fog limits visibility rather than clipping the sky or reflection camera.
    scene.fog=new THREE.FogExp2(workbench?'#c3cec6':'#243b3e',workbench?0:.014);
    scene.background=new THREE.Color(workbench?'#c9d2cc':'#172b30');
    if(workbench){playerFog?.setEnabled(false);if(nightSky)nightSky.group.visible=false;}
    for(const light of scene.children){
      if(light instanceof THREE.HemisphereLight){light.intensity=workbench?1.5:.24;if(workbench){light.color.set('#e6eadb');light.groundColor.set('#b8ad92');}}
      if(light instanceof THREE.DirectionalLight){light.intensity=workbench?1.9:.32;if(workbench)light.color.set('#fff0d2');}
    }
    nightSky?.group.traverse(object=>{object.renderOrder=-30;});
    const grove=naturalGrove=createWorldTreeScene(scene,water,material=>playerFog!.shade(applyWatercolor(material)),quality==='low',TREE_ART.map((art,i)=>({...art,texture:treeTextures[i]})),{localizedAtmosphere:workbench,geometryPaint:page===1111});
    if(workbench){studioEngine=createWorldStudioEngine(grove,key,(x,z)=>treeWalkable(x,z,.1)&&riverAt(x,z).distance>23,TREE_ART.map((art,i)=>({...art,texture:treeTextures[i]})),quality==='low',material=>playerFog!.shade(applyWatercolor(material)));studioEngine.apply(studioDocument);placedSolids=studioEngine.solids;}
    for(const pair of portalPairs)pair.entry.group.visible=true;
    knownSolids=grove.cameraObstacles;
    groveBodyClear=grove.movementClear;
    if(page===1111){const stickerSettings=document.createElement('div');panel.append(stickerSettings);const {x,z}=WORLD_1111_LAYOUT.flurry;worldFlurry=await createWorldFlurry(grove.root,new THREE.Vector3(x,treeGround(x,z),z),(material,lit,worldExpression)=>grove.atmosphere.decorate(material,lit,worldExpression),open=>{worldRewardOpen=open;keys.clear();groundsGestures.clear();navigation?.clear();platform?.cancelSprint(true);},quality==='low',treeGround,stickerSettings);}
    if(!portals||startLocation==='grounds')clearArrival=createClearArrivalFlight(arrivalPath!,treeGround,[...grove.cameraObstacles,...placedSolids],{aspect:innerWidth/innerHeight,approachLift:treeArrival?.approachLift});
    destinations.clear();destinations.add(grove.ground);pickSurfaces.length=0;pickSurfaces.push(grove.ground,grove.tree,...(worldFlurry?.root.children??[]),...portalPairs.map(pair=>pair.entry.aperture));
    colliders.clear();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(28,32,220,12),new THREE.MeshBasicMaterial());trunk.position.set(0,100,-42);colliders.add(trunk);colliders.updateMatrixWorld(true);
    if(workbench)syncStudioColliders();
    canvas.dataset.worldTree=JSON.stringify(grove.diagnostics);
    const heading=ui.querySelector('h1');if(heading&&!story)heading.textContent='The World Tree';
    const eyebrow=ui.querySelector('.castle-eyebrow');if(eyebrow)eyebrow.textContent='Page 120';
  }
  loading.report(.92, 'Settling the camera');
  if(combatWoods)await worldTextures.warm(['combatReady','combatStalk','combatBow','combatLeap']);
  if(startLocation==='woods'&&woodsDoor&&woodsReturn&&combatWoods){
    woodsArrival=createCombatWoodsArrival(woodsDoor.group.matrixWorld,woodsReturn.group.matrixWorld,
      {...COMBAT_WOODS_START,y:combatWoods.surface.height(COMBAT_WOODS_START.x,COMBAT_WOODS_START.z)},
      {...COMBAT_WOODS.enemy,y:0},camera.aspect,treeGround,[...knownSolids,...placedSolids],
      (x,z)=>combatWoods.surface.height(x,z),combatWoods.cameraSolids);
    prepareWoodsStart();
  }
  if(startLocation==='painted-valley')prepareValleyStart();
  if(startLocation==='paint-lab')prepareLabStart();
  if(startLocation==='longs')prepareLongsStart();
  if (mode === 'play') {

    resetPlayCamera();
  } else showFlight();
  nightSky?.update(0,renderer.getPixelRatio(),camera.position);
  setWatercolor(grounds || watercolor);
  if (meadow&&!woodsArrival&&!directStart) setMeadowActive(false);
  updateHero(0); faceTrees(key.position);
  if(portals&&combatWoods)spellTest=createWoodsSpellTest({hero:heroMesh,enemy:combatWoods.enemy,camera,lookAt,reduced,
    enabled:()=>mode==='play'&&inMeadow&&activePair?.id==='woods'&&!crossing,
    paused:()=>!!portalControls?.paused,
    freeze:()=>{keys.clear();groundsGestures.clear();navigation?.clear();clearMeadowRoute();platform?.cancelSprint(true);jumpPressed=divePressed=false;},
    impact:()=>combatWoods.spellImpact(portalClock)});
  // ?combat: Hand + Board against the framed Khadroot foundation (UX layer only).
  if(portals&&combatWoods&&directCombat)handBoard=createWoodsHandBoard({playMeteo:(receipts,impact,done)=>spellTest?.playMeteo(receipts,impact,done)??false,occluders:meadow?.cameraOccluders,canvas,camera,hero:heroMesh,khadroot:combatWoods.khadroot,reduced,
    enabled:()=>mode==='play'&&inMeadow&&activePair?.id==='woods'&&!crossing&&!spellTest?.active&&!portalControls?.paused,
    paused:()=>!!portalControls?.paused});
  renderer.shadowMap.needsUpdate = true;               // the stonework never moves: one shadow pass
  renderer.compile(scene, camera);
  renderWorld();
  await nextBookPaint();
  if (page === 1111) {
    const splatParam = new URLSearchParams(location.search).get('splat');
    let stored: string | null = null; try { stored = localStorage.getItem(SPLAT_PREFERENCE); } catch { /* per-visit only */ }
    const splatOn = splatParam !== null ? !['0', 'off', 'false'].includes(splatParam) : stored === 'on';
    if (splatOn) { await setSplats(true, false, async (fraction, label) => { loading.report(.93 + fraction * .06, label); await nextBookPaint(); }); renderWorld(); await nextBookPaint(); }
    else canvas.dataset.splats = 'off';
  }
  canvas.dataset.assetsReady = 'true'; canvas.dataset.castleQuality = quality;
  presentBookFrame(canvas); loading.finish(); canvas.focus();
  if(studioEngine&&naturalGrove){
    let lastProps=JSON.stringify(studioDocument.props);
    studioEditor=await createWorldStudio({canvas,camera,scene,ground:naturalGrove.ground,engine:studioEngine,initial:studioDocument,free:()=>setFreeCamera(true),ready:()=>mode==='play'&&!inMeadow&&!worldRewardOpen,frame:shot=>{setFreeCamera(true);camera.fov=shot.fov;camera.updateProjectionMatrix();freeControls!.frame({...shot,durationMs:0},0);freeControls!.update(0,1,true);},changed:doc=>{studioDocument=doc;placedSolids=studioEngine!.solids;const key=JSON.stringify(doc.props);if(key!==lastProps){const route=createClearArrivalFlight(arrivalPath!,treeGround,[...naturalGrove!.cameraObstacles,...placedSolids],{aspect:camera.aspect,approachLift:treeArrival?.approachLift});syncStudioColliders();clearArrival=route;lastProps=key;}}});
    if(portals){
      settingsBtn.hidden=true;panel.hidden=true;
      const display=document.createElement('section');while(panel.firstChild)display.append(panel.firstChild);
      portalControls=createPortalControls(canvas,display,()=>{spellTest?.suspend();cancelGridSelection();studioEditor?.close();keys.clear();jumpPressed=divePressed=false;groundsGestures.clear();navigation?.clear();clearMeadowRoute();platform?.cancelSprint(true);});
      const embedded=studioEditor.embed();
      for(const tab of embedded.tabs)portalControls.addTab(tab.textContent??'World',embedded.panel,()=>!inMeadow,()=>tab.click());
    }
    if(startEditing&&!portals){studioEditor.open();studioEditor.overview();}
  }
  if (import.meta.env.DEV) (window as unknown as Record<string,unknown>)[`__castle${page}`] = {
    get mode() { return mode; }, get hero() { const index=worldGridIndexAt(hero.x,hero.z);return {...hero,gridCoordinate:inMeadow&&activePair?.id==='woods'&&index!==undefined?worldGridCoordinate(index):undefined}; },
    get arrival(){return {time:flightTime,portal:believeArrival?.diagnostics,heroStart:woodsArrival?{...COMBAT_WOODS_START}:{...heroStart},portalCard:(woodsArrival?woodsDoor:castleDoor)?.group.position.toArray(),woods:woodsArrival&&{inWoods:woodsArrivalInWoods,held:woodsOpeningHeld,...woodsArrival.diagnostics}};},
    get flurry(){return worldFlurry&&{position:worldFlurry.root.position.toArray(),visible:worldFlurry.root.visible,modal:worldRewardOpen,approaching:stickerInteraction?.pending,storm:worldFlurry.diagnostics};},
    get arrivalRoute(){return clearArrival?.diagnostics;},
    get paintLab(){return paintLab&&{...paintLab.art.diagnostics,inside:inMeadow&&activePair?.id==='paint-lab',paintAll:()=>paintLab.art.paintAll()};},
    get studio(){return studioEngine&&{document:studioEditor?.document,diagnostics:studioEngine.diagnostics};},
    get platform() { return platform && {y:platform.y,grounded:platform.grounded,jump:platform.jumpNumber,
      sprinting:platform.sprinting,crouching:platform.crouching,skidding:platform.skidding,velocity:[platform.vx,platform.vy,platform.vz],move:platform.airMove,frame:!platform.grounded ? platformAirFrame(platform) : undefined}; },
    get destination() { return inMeadow ? meadowTarget : navigation?.destination; },
    get exploration(){return {pose:heroMesh.userData.exploration,scale:heroMesh.scale.toArray(),texture:heroMat.map?.image?.src,textures:worldTextures.diagnostics,preview:worldDirector.preview,flurry:flurryCompanion?.diagnostics};},
    get navigationRoute(){return inMeadow?meadow!.navigation.cameraRoute:navigation?.cameraRoute;},
    get portals(){return portalPairs.map(pair=>({id:pair.id,entry:pair.entry.door,armed:portalGuard.permits(pair.entry),visible:pair.entry.group.visible}));},
    get pointAndClick() { return lastPointClick; },
    get spells(){return spellTest?.diagnostics;},
    get handBoard(){return handBoard?.diagnostics;},
    configureFireball(patch:Parameters<NonNullable<typeof spellTest>['configureFireball']>[0]){return spellTest?.configureFireball(patch);},
    get woods(){return combatWoods&&{phase:combatWoods.phase,combatEnabled:combatWoods.combatEnabled,enemyVisible:combatWoods.enemy.visible,enemy:combatWoods.enemy.position.toArray(),portal:woodsDoor?.door,location:inMeadow&&activePair?.id==='woods',returnPortalVisible:woodsReturn?.group.visible,navi:combatWoods.navi.diagnostics,foundations:combatWoods.foundations.diagnostics};},
    get meadowArt() { return meadow && {...meadow.art.diagnostics,scale:MEADOW_SCALE}; },
    get splats() { return {mode:canvas.dataset.splats,grove:groveSplats?.diagnostics,meadow:meadowSplats?.diagnostics}; },
    /** Dev playtest shortcut: stand just inside Sacred Forest Meadow's return card. */
    enterMeadow() {
      const pair=portalPairs.find(p=>p.id==='meadow');if(!pair||!forestMeadow)return false;
      activePair=pair;setMeadowActive(true);crossing=undefined;
      const x=MEADOW_DOOR.x,z=MEADOW_DOOR.z-3.5,heading=Math.PI;
      platform=new CastlePlatformMotion(x,z,heading,forestMeadow.surface);meadowFooting={x,y:platform.y,z};
      hero.x=x;hero.z=z;hero.heading=heading;hero.speed=hero.clock=0;hero.view=undefined;
      yaw=heading+Math.PI;pitch=.24;distance=7;return true;
    },
    get meadowNavigation() { return meadow?.navigation.diagnostics; },
    get meadowPortal() {
      const door = currentDoor();
      return door && {location:inMeadow ? activePair?.id??'meadow' : 'grounds',door:door.door,
        foil:door.uniforms.foil.value,sealed:door.uniforms.sealed.value,preview:!!door.uniforms.hasView.value,pulse:door.uniforms.pulseAge.value,
        crossing:!!crossing};
    },
    get camera() { return {free:freeCamera, overhead:woodsOverhead, transitioning:!!woodsCameraFlight, yaw, pitch, distance:woodsOverhead?woodsOverheadHeight:freeCamera ? freeControls!.snapshot().distance : distance, position:camera.position.toArray(), target:lookAt.toArray(),fov:camera.fov,aspect:camera.aspect,up:camera.up.toArray()}; },
    get journeyCamera() { return bridgeJourney?.active?bridgeJourney.diagnostics:journey?.diagnostics; },
    get bridgeCamera() { return bridgeJourney?.diagnostics; },
    get valley() { return valley?.diagnostics; },
    get ambiance() { return ambiance && {particles: ambiance.particleCount, draws: renderer.info.render.calls, shadowAutoUpdate: renderer.shadowMap.autoUpdate}; },
    get lanterns() { return lanterns?.diagnostics; },
    get atmosphere() { return {wallSlits:!grounds,fog:scene.fog instanceof THREE.FogExp2 ? scene.fog.density : 0}; },
    get water() { return waterEffects?.diagnostics; },
    get bridge() { return bridgeExperience?.diagnostics; },
    get questGuides(){return bridgeExperience?.guides;},
    get pickups() { return pickupEffects?.diagnostics; },
    get nightSky() { return nightSky?.diagnostics; },
    get playerFog() { return playerFog && {...playerFog.diagnostics,nearDensity:playerFog.densityAt(hero.x,1,hero.z),farDensity:playerFog.densityAt(hero.x+35,1,hero.z)}; },
    skip, replay,
  };
  last = performance.now(); requestAnimationFrame(frame);
}




