import * as THREE from 'three';
import { forestCamera } from './forestCamera';
import { forestLayout } from './forestLayout';
import { initialBillboardPose, updateBillboardPose } from './forestBillboardPose';
import { forestHeightFogGLSL } from './forestHeightFog';
import { hideNearCamera, reliefCameraDistance } from './forestCameraVisibility';
import { createForestActors } from './forestActors';
import './forestLab.css';

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = document.querySelector('canvas')!;
const depth = get<HTMLInputElement>('depth'), density = get<HTMLInputElement>('density');
const speed = get<HTMLInputElement>('speed'), guideToggle = get<HTMLInputElement>('grid');
const blend = get<HTMLInputElement>('blend'), upright = get<HTMLInputElement>('upright');
get<HTMLFormElement>('forest-controls').onsubmit = event => event.preventDefault();
if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  blend.value = '0'; get<HTMLOutputElement>('blend-value').value = '0 ms';
}

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1); renderer.setClearColor('#101c21');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, .12, 125);
  const controls = forestCamera(canvas, camera);
  const loader = new THREE.TextureLoader(), base = `${import.meta.env.BASE_URL}assets/runtime/`;
  const [paint, estimate] = await Promise.all([
    loader.loadAsync(base + 'environment/watercolor/v1/pine-relief-v1.png'),
    loader.loadAsync(base + 'labs/depth-relief/pine-depth.png'),
  ]);
  paint.colorSpace = THREE.SRGBColorSpace; estimate.colorSpace = THREE.NoColorSpace;
  const fogUniforms = {
    fogColor: { value: new THREE.Color('#101c21') }, fogHeight: { value: 4 },
    fogSoftness: { value: 3 }, fogDensity: { value: .08 },
  };
  const uniforms = { paint: { value: paint }, depthMap: { value: estimate }, strength: { value: Number(depth.value) }, ...fogUniforms };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform sampler2D depthMap;
      uniform float strength;
      varying vec2 vUv;
      varying float vDistance;
      varying vec3 vWorldPosition;
      attribute vec3 poseBlend;
      varying vec3 vPoseBlend;
      void main() {
        vUv = uv;
        vPoseBlend = poseBlend;
        vec3 p = position;
        p.x *= 992.0 / 1586.0;
        p.y += 0.5 - 0.0593;
        float root = texture2D(depthMap, vec2(0.498, 0.067)).r;
        p.z += (texture2D(depthMap, uv).r - root) * strength * 0.22;
        vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vWorldPosition = world.xyz;
        vec4 view = viewMatrix * world;
        vDistance = length(view.xyz);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D paint;
      ${forestHeightFogGLSL}
      varying vec2 vUv;
      varying float vDistance;
      varying vec3 vWorldPosition;
      varying vec3 vPoseBlend;
      void main() {
        // Both painted poses remain visible during the phase. Smooth equal-power
        // weights keep pigment stronger where the two translucent poses overlap.
        float phase = smoothstep(0.0, 1.0, vPoseBlend.y);
        float opacity = sqrt(vPoseBlend.x < 0.5 ? 1.0-phase : phase);
        if (opacity < 0.001) discard;
        vec4 color = texture2D(paint, vUv);
        if (color.a < 0.012) discard;
        color.rgb = applyForestFog(color.rgb, vWorldPosition);
        // Soft close clipping is a visibility aid, not replacement painted art.
        color.a *= opacity * smoothstep(0.18, 0.65, vDistance);
        gl_FragColor = color;
        #include <colorspace_fragment>
      }
    `,
  });
  const geometry = new THREE.PlaneGeometry(1, 1, 48, 72);
  const actors = await createForestActors(scene, material, base);
  const trees = forestLayout(160), sorted = [...trees];
  const poses = new Map(trees.map(tree => [tree, initialBillboardPose(tree.yaw, 0)]));
  const cameraHidden = new Set<(typeof trees)[number]>();
  let initializePoses = true;
  const blendData = new THREE.InstancedBufferAttribute(new Float32Array(trees.length * 2 * 3), 3);
  blendData.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('poseBlend', blendData);
  const forest = new THREE.InstancedMesh(geometry, material, trees.length * 2);
  forest.instanceMatrix.setUsage(THREE.DynamicDrawUsage); forest.frustumCulled = false; scene.add(forest);
  const groundMaterial = new THREE.ShaderMaterial({
    uniforms: fogUniforms,
    vertexShader: /* glsl */`
      varying vec3 vWorld; varying float vDistance;
      void main() { vec4 w = modelMatrix * vec4(position,1.0); vWorld=w.xyz; vec4 v=viewMatrix*w; vDistance=length(v.xyz); gl_Position=projectionMatrix*v; }
    `,
    fragmentShader: /* glsl */`
      ${forestHeightFogGLSL}
      varying vec3 vWorld; varying float vDistance;
      void main() {
        float path = 1.0-smoothstep(1.0,2.3,abs(vWorld.x-sin(vWorld.z*.12)*2.0));
        float variation=sin(vWorld.x*.48+sin(vWorld.z*.3))*cos(vWorld.z*.38)*.018;
        vec3 color=mix(vec3(.19,.215,.13),vec3(.29,.265,.18),path)+variation;
        color=applyForestFog(color,vWorld);
        gl_FragColor=vec4(color,1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMaterial); ground.rotation.x = -Math.PI / 2; ground.position.y = -.025; scene.add(ground);
  const grid = new THREE.GridHelper(90, 45, '#b0b19b', '#969d83'); grid.position.y = -.015; grid.visible = false;
  (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = .23; scene.add(grid);
  guideToggle.onchange = () => { grid.visible = guideToggle.checked; };
  const fogEnabled = get<HTMLInputElement>('fog-enabled'), fogHeight = get<HTMLInputElement>('fog-height');
  const fogDensity = get<HTMLInputElement>('fog-density'), fogSoftness = get<HTMLInputElement>('fog-softness');
  get<HTMLFormElement>('fog-settings').onsubmit = event => event.preventDefault();
  const updateFog = () => {
    fogUniforms.fogHeight.value = Number(fogHeight.value);
    fogUniforms.fogDensity.value = fogEnabled.checked ? Number(fogDensity.value) : 0;
    fogUniforms.fogSoftness.value = Number(fogSoftness.value);
    get<HTMLOutputElement>('fog-height-value').value = `${fogHeight.value} m`;
    get<HTMLOutputElement>('fog-density-value').value = Number(fogDensity.value).toFixed(2);
    get<HTMLOutputElement>('fog-softness-value').value = `${fogSoftness.value} m`;
    renderer.setClearColor(fogEnabled.checked ? fogUniforms.fogColor.value : new THREE.Color('#a5b7aa'));
    canvas.dataset.fog = String(fogEnabled.checked); canvas.dataset.fogHeight = fogHeight.value;
  };
  fogEnabled.onchange = updateFog; fogHeight.oninput = updateFog; fogDensity.oninput = updateFog; fogSoftness.oninput = updateFog; updateFog();
  depth.oninput = () => { uniforms.strength.value = Number(depth.value); get<HTMLOutputElement>('depth-value').value = Number(depth.value).toFixed(2); };
  density.oninput = () => { get<HTMLOutputElement>('density-value').value = density.value; };
  blend.oninput = () => { get<HTMLOutputElement>('blend-value').value = `${blend.value} ms`; };
  upright.onchange = () => { initializePoses = true; };
  get<HTMLButtonElement>('ground').onclick = () => { controls.preset(false); initializePoses = true; };
  get<HTMLButtonElement>('flight').onclick = () => { controls.preset(true); initializePoses = true; };
  get<HTMLButtonElement>('home').onclick = () => { controls.preset(false, true); initializePoses = true; };
  get<HTMLButtonElement>('turn-back').onclick = () => controls.turnBack();
  for (const button of document.querySelectorAll<HTMLButtonElement>('#forest-pad button')) {
    const key = button.dataset.key!;
    button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); controls.keys.add(key); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => controls.keys.delete(key));
  }
  const observer = new ResizeObserver(() => {
    const scale = Math.min(1, 1280 / canvas.clientWidth, 720 / canvas.clientHeight);
    const width = Math.round(canvas.clientWidth * scale), height = Math.round(canvas.clientHeight * scale);
    renderer.setSize(width, height, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix();
    get('forest-pad').style.bottom = `${get('forest-controls').offsetHeight + 28}px`;
  }); observer.observe(canvas); observer.observe(get('forest-controls'));
  const dummy = new THREE.Object3D();
  let previous = performance.now(), report = previous, frames = 0, fps = 0;
  renderer.setAnimationLoop(now => {
    const elapsed = Math.max(0, (now - previous) / 1000), dt = Math.min(.05, elapsed); previous = now;
    if (document.hidden) return;
    controls.update(dt, Number(speed.value));
    const actorTransitions = actors.update(camera, now, Number(blend.value), uniforms.strength.value);
    for (const tree of trees) {
      tree.distance = (camera.position.x - tree.x) ** 2 + (camera.position.y - tree.height * .4) ** 2 + (camera.position.z - tree.z) ** 2;
    }
    // Far-to-near ordering preserves soft painted alpha between tree instances.
    const active = sorted; active.length = Number(density.value);
    for (let i = 0; i < active.length; i++) active[i] = trees[i];
    active.sort((a, b) => b.distance - a.distance);
    let instances = 0, transitioning = 0, maxAngle = 0, hiddenCount = 0;
    for (const tree of active) {
      const dx = camera.position.x - tree.x, dz = camera.position.z - tree.z;
      const yaw = Math.atan2(dx, dz);
      const pitch = upright.checked ? 0 : Math.atan2(camera.position.y - tree.height * .4, Math.hypot(dx, dz));
      const pose = poses.get(tree)!;
      if (initializePoses) Object.assign(pose, initialBillboardPose(yaw, pitch));
      const progress = updateBillboardPose(pose, yaw, pitch, now, Number(blend.value));
      let clearance = reliefCameraDistance(camera.position, tree, pose.yaw, pose.pitch, uniforms.strength.value);
      if (progress < 1) clearance = Math.min(clearance,
        reliefCameraDistance(camera.position, tree, pose.oldYaw, pose.oldPitch, uniforms.strength.value));
      if (hideNearCamera(clearance, cameraHidden.has(tree))) {
        cameraHidden.add(tree); hiddenCount++;
        // Omit both poses entirely; no lingering translucent branches or depth.
        continue;
      }
      cameraHidden.delete(tree);
      maxAngle = Math.max(maxAngle, Math.abs(Math.atan2(Math.sin(yaw - pose.yaw), Math.cos(yaw - pose.yaw))));
      const seed = tree.x * 37 + tree.z * 11;
      const draw = (heading: number, elevation: number, old: boolean) => {
        dummy.position.set(tree.x, 0, tree.z); dummy.rotation.set(0, 0, 0);
        dummy.rotation.order = 'YXZ'; dummy.rotation.y = heading; dummy.rotation.x = -elevation;
        dummy.scale.setScalar(tree.height); dummy.updateMatrix(); forest.setMatrixAt(instances, dummy.matrix);
        blendData.setXYZ(instances, old ? 0 : 1, progress, seed); instances++;
      };
      if (progress < 1) { draw(pose.oldYaw, pose.oldPitch, true); transitioning++; }
      draw(pose.yaw, pose.pitch, false);
    }
    initializePoses = false;
    forest.count = instances; forest.instanceMatrix.needsUpdate = true; blendData.needsUpdate = true;
    renderer.render(scene, camera); frames++;
    if (now - report > 600) {
      fps = Math.round(frames * 1000 / (now - report));
      report = now; frames = 0;
    }
    get<HTMLOutputElement>('forest-readout').value = `${camera.position.y.toFixed(1)} m · ${fps} fps`;
    canvas.dataset.ready = 'true'; canvas.dataset.camera = camera.position.toArray().join(',');
    canvas.dataset.reliefProps = 'hero,slime';
    canvas.dataset.actorTransitions = String(actorTransitions);
    canvas.dataset.cameraHidden = String(hiddenCount);
    canvas.dataset.yaw = String(controls.snapshot().yaw); canvas.dataset.maxReliefAngle = String(maxAngle * 180 / Math.PI); canvas.dataset.trees = String(active.length);
    canvas.dataset.transitioning = String(transitioning); canvas.dataset.renderMode = 'object-only';
    canvas.dataset.blend = blend.value; canvas.dataset.billboard = upright.checked ? 'upright' : 'camera-facing';
  });
  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null); observer.disconnect(); controls.dispose();
    paint.dispose(); estimate.dispose(); geometry.dispose(); material.dispose(); forest.dispose();
    actors.dispose();
    ground.geometry.dispose(); groundMaterial.dispose(); grid.geometry.dispose(); (grid.material as THREE.Material).dispose(); renderer.dispose();
  }, { once: true });
}
start().catch(reason => { get('forest-error').hidden = false; get('forest-error').textContent = `Forest test could not start: ${String(reason)}`; });
