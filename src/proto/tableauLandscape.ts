import * as THREE from 'three';
import { createTableauGroundCover } from './tableauGroundCover';
import { createActorPeekThree } from './actorPeekThree';
import { createActorEnvironmentLight } from './actorEnvironmentLight';
import { globalLightsEnabled } from './globalLighting';

type LandscapeProp = { x: number; z: number; height: number; tint?: number };
export type TableauLandscapeOptions = { groundCover?: { pixel: boolean; palette?: 'woodland' | 'dirt' }; groundColor?: number; props?: readonly LandscapeProp[]; berryFruit?: boolean; fruitTexture?: THREE.Texture; manaFruit?: { x: number; y: number; size: number } };

/** Frame a low biome with nearer side clusters and a receding planted edge.
 * These remain world-space props, using the same cutouts as the map. */
export const BERRY_TABLEAU_PROPS: readonly LandscapeProp[] = [
  { x: -9, z: -19, height: 5.4, tint: 0xa2b7ac },
  { x: 0, z: -22, height: 5.8, tint: 0xa2b7ac },
  { x: 9, z: -18, height: 5.2, tint: 0xa2b7ac },
  { x: -5, z: -8, height: 5.6 },
  { x: 5, z: -10, height: 6 },
  { x: -5.8, z: 1, height: 5.2 },
  { x: 5.6, z: 2, height: 5.4 },
];

/** Shared landscape for combat and all ordinary tableau scenes. */
export function createTableauLandscape(scene: THREE.Scene, texture: THREE.Texture, woods = true, combat = false, options: TableauLandscapeOptions = {}) {
  const resources: (THREE.BufferGeometry | THREE.Material)[] = [];
  const geometry = <T extends THREE.BufferGeometry>(g: T) => { resources.push(g); return g; };
  const material = <T extends THREE.Material>(m: T) => { resources.push(m);
    if (combat && (m instanceof THREE.MeshBasicMaterial || m instanceof THREE.MeshLambertMaterial)) {
      const previous = m.onBeforeCompile;
      m.onBeforeCompile = (shader, renderer) => {
        previous.call(m, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat combatValue = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));\ndiffuseColor.rgb = combatValue * vec3(.66, .34, .38) + vec3(.018, .004, .008);');
      };
      m.customProgramCacheKey = () => 'combat-scenery-tint-v1';
    }
    return m; };
  const flat = (color: number) => material(new THREE.MeshBasicMaterial({color}));
  scene.background = new THREE.Color(woods ? 0x050b19 : 0x0b1520);
  scene.fog = woods ? new THREE.Fog(0x101e30, 18, 58) : new THREE.Fog(0x0b1520, 15, 36);
  const root = new THREE.Group(); scene.add(root);
  // A sky dome keeps the horizon wash behind the forest at every freecam angle.
  const sky = new THREE.Mesh(geometry(new THREE.SphereGeometry(80, 32, 16)), material(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 direction;
      void main(){
        float h=normalize(direction).y;
        vec3 c=mix(vec3(.018,.034,.062),vec3(.002,.004,.012),smoothstep(0.,.65,h));
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`,
  })));
  sky.visible = woods; root.add(sky);
  const starPositions: number[] = [];
  let seed = 7391;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  for (let i = 0; i < 650; i++) {
    const azimuth = random() * Math.PI * 2, y = .04 + random() * .96, r = Math.sqrt(1 - y * y);
    starPositions.push(Math.cos(azimuth) * r * 74, y * 74, Math.sin(azimuth) * r * 74);
  }
  const starGeometry = geometry(new THREE.BufferGeometry());
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, material(new THREE.PointsMaterial({color: 0xcbdfff, size: 1.5, sizeAttenuation: false, fog: false, transparent: true, opacity: .82, depthWrite: false})));
  stars.visible = woods; root.add(stars);
  const ground = new THREE.Mesh(geometry(new THREE.PlaneGeometry(70, 70)), material(new THREE.MeshLambertMaterial({color: options.groundColor ?? 0x283a36})));
  ground.rotation.x = -Math.PI / 2; root.add(ground);
  const hemisphere = new THREE.HemisphereLight(0xb8d9e9, 0x293724, woods ? 1.2 : 2); root.add(hemisphere);
  const moon = new THREE.DirectionalLight(0x98bde0, woods ? 1.4 : 2); moon.position.set(-5, 10, 3); root.add(moon);
  const glow = new THREE.PointLight(0x65fff0, 0, 12, 2); glow.position.set(2, 2, 0); root.add(glow);
  const hill = (x: number, z: number) => woods ? Math.max(0, Math.hypot(x, z) - 9) * .07 * (1 + Math.sin(x * .17) * Math.cos(z * .21)) : 0;
  if (woods) {
    const terrain = geometry(new THREE.PlaneGeometry(120, 120, 48, 48)); terrain.rotateX(-Math.PI / 2);
    const positions = terrain.getAttribute('position');
    for (let i = 0; i < positions.count; i++) positions.setY(i, hill(positions.getX(i), positions.getZ(i)) - .02);
    terrain.computeVertexNormals(); root.add(new THREE.Mesh(terrain, material(new THREE.MeshLambertMaterial({color: 0x182b2c}))));
  }
  const square = geometry(new THREE.PlaneGeometry(1, 1));
  const groundCover = options.groundCover ? createTableauGroundCover(root, options.groundCover.pixel, options.groundCover.palette) : undefined;
  // Ground flecks give each sweep a stable depth reference.
  for (let i = 0; i < (groundCover ? 0 : 180); i++) {
    const fleck = new THREE.Mesh(square, flat(i % 3 ? 0x344b40 : 0x53604c));
    const x = Math.sin(i * 23.1) * 18, z = Math.cos(i * 17.3) * 18;
    fleck.rotation.x = -Math.PI / 2; fleck.position.set(x, hill(x, z) + .012, z); fleck.scale.set(.2 + (i % 4) * .12, .16, 1); root.add(fleck);
  }
  // Scan the shared art once, not once per tree, to find its painted ground foot.
  const image = texture.image as {width: number; height: number};
  const scan = document.createElement('canvas'); scan.width = image.width; scan.height = image.height;
  const ctx = scan.getContext('2d')!; ctx.drawImage(texture.image as CanvasImageSource, 0, 0);
  const rgba = ctx.getImageData(0, 0, image.width, image.height).data;
  let bottom = image.height - 1;
  outer: for (; bottom >= 0; bottom--) for (let col = 0; col < image.width; col++) if (rgba[(bottom * image.width + col) * 4 + 3] > 12) break outer;
  const fruitMeshes: THREE.Object3D[] = [];
  const fruitHalos: THREE.Object3D[] = [];
  const treeMaterials = new Map<number, THREE.MeshBasicMaterial>();
  const actorPeek = createActorPeekThree();
  const billboard = (texture: THREE.Texture, x: number, z: number, height: number, tint = 0xffffff) => {
    let mat = treeMaterials.get(tint);
    if (!mat) { mat = material(new THREE.MeshBasicMaterial({map: texture, color: tint, transparent: true, alphaTest: .025, side: THREE.DoubleSide})); treeMaterials.set(tint, mat); }
    if (!mat.userData.actorPeek) { actorPeek.attach(mat); mat.userData.actorPeek = true; }
    const mesh = new THREE.Mesh(square, mat);
    mesh.scale.set(height * image.width / image.height, height, 1);
    mesh.position.y = height / 2 - height * (image.height - bottom - 1) / image.height;
    const anchor = new THREE.Group(); anchor.position.set(x, hill(x, z), z); anchor.add(mesh); root.add(anchor);
    groundCover?.plant(x, z, height * .65, hill(x, z));
    if (options.berryFruit || options.manaFruit) {
      const fruitPoints = options.manaFruit ? [[options.manaFruit.x, options.manaFruit.y, .13]] : [[.13,.4,.035],[.42,.34,.035],[.57,.34,.035],[.86,.4,.035],[.33,.65,.035],[.73,.65,.035]];
      for (const [x,y,size] of fruitPoints) {
        const berry = new THREE.Mesh(square, material(new THREE.MeshBasicMaterial({map:options.fruitTexture, color:0xffffff, transparent:true, alphaTest:.025, side:THREE.DoubleSide})));
        berry.position.set(x-.5,.5-y,.008); berry.scale.set(size,size,1); mesh.add(berry); fruitMeshes.push(berry);
      }
    }
    if (options.manaFruit || options.berryFruit) {
      const points = options.manaFruit ? [options.manaFruit] : [[.13,.4],[.42,.34],[.57,.34],[.86,.4],[.33,.65],[.73,.65]].map(([x,y]) => ({x,y,size:.095}));
      for (const fruit of points) {
      const halo = new THREE.Mesh(square, material(new THREE.ShaderMaterial({
        uniforms: { berryTime: { value: 0 } },
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec2 glowUv; void main(){glowUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        // Transparent merging lobes inspired by Tiffany Rayside's Blob State Matter:
        // https://codepen.io/tmrDevelops/pen/GoWmaM
        fragmentShader: `varying vec2 glowUv; uniform float berryTime;
          void main(){
            vec2 p=(glowUv-.5)*2.; float field=0.;
            for(int i=0;i<5;i++){
              float phase=float(i)*1.2566;
              vec2 center=vec2(sin(berryTime*.7+phase),cos(berryTime*.53+phase))*.24;
              vec2 d=p-center;
              field+=exp(-dot(d,d)*18.)*.38;
            }
            float a=(field*.5+exp(-dot(p,p)*4.)*.22)*(1.-smoothstep(.65,1.,length(p)));
            gl_FragColor=vec4(mix(vec3(.18,.44,1.),vec3(.64,.96,1.),smoothstep(.15,.8,field)),a);
            #include <colorspace_fragment>
          }`,
      })));
      // Behind the painted berries, above foliage; preserve purple fruit detail.
      halo.position.set(fruit.x - .5, .5 - fruit.y, .004);
      halo.scale.set(fruit.size, fruit.size, 1);
      mesh.add(halo); fruitHalos.push(halo);
      }
    }
    return { anchor, mesh };
  };
  const trees = options.props ? options.props.map(({x, z, height, tint}) => billboard(texture, x, z, height, tint)) : Array.from({length: woods ? 90 : 16}, (_, i) => {
    const layer = Math.floor(i / 30), angle = i * 2.399963, radius = woods ? 14 + layer * 10 + Math.sin(i * 7.3) * 2 : 20;
    return billboard(texture, Math.cos(angle) * radius, Math.sin(angle) * radius, woods ? 8 + (i % 5) * 1.1 : 5 + i % 3, woods ? [0xacc6c7, 0x718f9e, 0x486779][layer] : 0x77958a);
  });
  const impulses: { start: number; strengths: number[] }[] = [];
  const projected = new THREE.Vector3();
  return { glow, setFruitVisible(available: boolean, illuminated = true) {
    fruitMeshes.forEach(fruit => { fruit.visible = available; });
    fruitHalos.forEach(halo => { halo.visible = available && illuminated; });
  }, rustle(camera: THREE.Camera, x: number, y: number, seconds: number) {
    if (!options.props) return;
    impulses.push({ start: seconds, strengths: trees.map(({anchor, mesh}) => {
      projected.copy(anchor.position); projected.y += mesh.scale.y * .5; projected.project(camera);
      const distance = Math.hypot(projected.x - x, (projected.y - y) * .7);
      const depth = camera.position.distanceTo(anchor.position);
      return Math.exp(-distance * distance * 2) * Math.min(1, 10 / depth);
    }) });
    if (impulses.length > 8) impulses.shift();
  }, sampleActorLight: createActorEnvironmentLight(hemisphere, moon, glow), update(camera: THREE.Camera, seconds = 0, reduced = false, actors: readonly THREE.Object3D[] = []) {
    fruitHalos.forEach(halo => { ((halo as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.berryTime.value = reduced ? 0 : seconds; });
    hemisphere.intensity = globalLightsEnabled() ? (woods ? 1.2 : 2) : 2;
    moon.intensity = globalLightsEnabled() ? (woods ? 1.4 : 2) : 0;
    actorPeek.update(camera, actors);
    sky.position.copy(camera.position); stars.position.copy(camera.position);
    while (impulses.length && seconds - impulses[0].start > 2) impulses.shift();
    trees.forEach(({anchor}, i) => {
      anchor.rotation.set(0, Math.atan2(camera.position.x - anchor.position.x, camera.position.z - anchor.position.z), reduced || !woods ? 0 : Math.sin(seconds * .42 + i * 1.73) * .009 + Math.sin(seconds * .19 + i) * .004);
      if (options.props && !reduced) {
        const breeze = Math.sin(seconds * (.38 + i * .027) + i * 2.17) * .008 + Math.sin(seconds * .73 + i * 1.31) * .003;
        const reaction = impulses.reduce((sum, impulse) => { const age = seconds - impulse.start; return sum + impulse.strengths[i] * Math.sin(age * 12) * Math.exp(-age * 3) * .055; }, 0);
        anchor.rotation.z = breeze + reaction;
      }
    });
  }, dispose() { groundCover?.dispose(); scene.remove(root); resources.forEach(resource => resource.dispose()); } };
}
