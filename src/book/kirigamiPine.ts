import * as THREE from 'three';

/** Kirigami version of a painted pine, after the "One Sheet World" fold-up:
 * the silhouette is cut from the page with a paper margin, hinges up from its
 * trunk foot with a damped-spring overshoot, then its two halves fold back
 * along the vertical centre crease into a V so it has volume from any angle.
 * The cut it leaves stays on the page as a hole outline. */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoother = (x: number) => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };

/** Damped step response 0 → 1 with overshoot (time in seconds). */
export function springStep(t: number, freq = 1.35, damping = .55) {
  if (t <= 0) return 0;
  const w = Math.PI * 2 * freq, wd = w * Math.sqrt(1 - damping * damping);
  return 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + (damping * w / wd) * Math.sin(wd * t));
}

/** Pose for rise progress n (0 flat on the page → 1 standing).
 * Progress drives a slow spring clock so scrubbing spreads evenly: the stand-up
 * fills roughly the first half with a small overshoot, the V opens over the
 * second half, and the last 15% eases the spring exactly onto upright. */
export function kirigamiPinePose(n: number, maxV = 46 * Math.PI / 180) {
  n = clamp01(n);
  const settle = smoother((n - .85) / .15);
  return { stand: springStep(n, .85, .6) * (1 - settle) + settle, v: maxV * smoother((n - .4) / .6) };
}

const PAPER = '#f3ead8';

/** Painting on a paper blank: the silhouette grown by a cutting margin. */
export function paperCutCanvas(image: CanvasImageSource & { width: number; height: number }, borderPct = 1.8) {
  const margin = borderPct <= 0 ? 0 : Math.max(1, Math.round(image.width * borderPct / 100)), pad = margin + 2;
  const c = document.createElement('canvas'); c.width = image.width + pad * 2; c.height = image.height + pad * 2;
  const ctx = c.getContext('2d')!;
  const blank = document.createElement('canvas'); blank.width = c.width; blank.height = c.height;
  const b = blank.getContext('2d')!;
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; b.drawImage(image, pad + Math.cos(a) * margin, pad + Math.sin(a) * margin); }
  b.drawImage(image, pad, pad);
  b.globalCompositeOperation = 'source-in'; b.fillStyle = PAPER; b.fillRect(0, 0, c.width, c.height);
  // Scissors leave a hard edge: threshold the grown alpha.
  const px = b.getImageData(0, 0, c.width, c.height);
  for (let i = 3; i < px.data.length; i += 4) px.data[i] = px.data[i] > 90 ? 255 : 0;
  b.putImageData(px, 0, 0);
  ctx.drawImage(blank, 0, 0); ctx.drawImage(image, pad, pad);
  return c;
}

/** Same texture, colour ignored: blank paper (back of the cut) or the hole it left. */
function silhouetteMaterial(map: THREE.Texture, color: THREE.ColorRepresentation, side: THREE.Side, key: string) {
  const m = new THREE.MeshStandardMaterial({ map, color, side, alphaTest: .5, roughness: 1 });
  m.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
      '#ifdef USE_MAP\n  diffuseColor.a *= texture2D( map, vMapUv ).a;\n#endif');
  };
  m.customProgramCacheKey = () => 'kirigami-silhouette-' + key;
  return m;
}

export type KirigamiPine = { hinge: THREE.Group; hole: THREE.Mesh; pose(n: number): void };

export function createKirigamiPine(painting: THREE.Texture, height: number): KirigamiPine {
  const cut = new THREE.CanvasTexture(paperCutCanvas(painting.image as HTMLCanvasElement));
  cut.colorSpace = THREE.SRGBColorSpace; cut.anisotropy = painting.anisotropy;
  const width = height * cut.image.width / cut.image.height;
  const front = new THREE.MeshStandardMaterial({ map: cut, alphaTest: .5, side: THREE.FrontSide, roughness: .95 });
  const back = silhouetteMaterial(cut, PAPER, THREE.BackSide, 'back');
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: cut, alphaTest: .5, side: THREE.DoubleSide });

  const hinge = new THREE.Group(); hinge.rotation.order = 'YXZ';
  const leaves: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group(); leaf.userData.kirigamiLeaf = side; hinge.add(leaf); leaves.push(leaf);
    const geo = new THREE.PlaneGeometry(width / 2, height); const uv = geo.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) / 2 + (side === 1 ? .5 : 0));
    for (const [material, shadow] of [[front, true], [back, false]] as const) {
      const mesh = new THREE.Mesh(geo, material); mesh.position.set(side * width / 4, height / 2, 0);
      mesh.castShadow = shadow; if (shadow) mesh.customDepthMaterial = depth; leaf.add(mesh);
    }
  }
  // The hole: where the tree lay before it stood up (it lies back, towards -z).
  // Opaque so the page's transparent ground washes can't paint over it.
  const holeMat = silhouetteMaterial(cut, '#4f3e2c', THREE.DoubleSide, 'hole');
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(width, height), holeMat);
  hole.rotation.x = -Math.PI / 2; hole.position.set(0, 0, -height / 2); hole.receiveShadow = true;

  function pose(n: number) {
    const { stand, v } = kirigamiPinePose(n);
    hinge.rotation.x = -(1 - stand) * Math.PI / 2;
    // Mountain fold on the centre crease: both halves swing back.
    leaves[0].rotation.y = -v; leaves[1].rotation.y = v;
  }
  hinge.userData.kirigami = { pose };
  pose(1);
  return { hinge, hole, pose };
}
