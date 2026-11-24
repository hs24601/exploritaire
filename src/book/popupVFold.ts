import * as THREE from 'three';
import {paintedPaperPanel} from './paperCutout';
import {rememberGroundRest} from './standGroundPaint';

/** Real pop-up mechanics, first piece: the V-fold.
 * A hinge runs along local z through the origin. Plane A leaves it along +x and
 * stays put; plane B leaves it along (cos θ, sin θ, 0), so θ = π is flat open
 * and θ = 0 is shut. A V-fold is a card folded down its middle (the crease) and
 * glued to both planes along lines from one apex on the hinge, each leaning
 * away from the reader (−z) at angle α from the hinge. In the flat card the
 * crease makes angle β with each glue line. Its pose for any θ is a spherical
 * linkage, solved exactly here: the crease c satisfies c·gA = c·gB = cos β. */

export type VFoldPose = { gA: THREE.Vector3; gB: THREE.Vector3; c: THREE.Vector3; eA: THREE.Vector3; eB: THREE.Vector3 };

/** zSign −1: glue lines lean away from the reader, so the point faces them; +1: the V opens toward them. */
export function solveVFold(theta: number, alpha: number, beta: number, zSign = -1): VFoldPose {
  const sd = new THREE.Vector3(0, 0, zSign), uA = new THREE.Vector3(1, 0, 0), uB = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0);
  const gA = sd.clone().multiplyScalar(Math.cos(alpha)).addScaledVector(uA, Math.sin(alpha));
  const gB = sd.clone().multiplyScalar(Math.cos(alpha)).addScaledVector(uB, Math.sin(alpha));
  const G = gA.dot(gB), den = Math.max(1 - G * G, 1e-9), cb = Math.cos(beta);
  const a = (cb - G * cb) / den, b = a;
  const w = new THREE.Vector3().crossVectors(gA, gB);
  if (w.lengthSq() < 1e-12) w.set(0, 0, 1).cross(gA); w.normalize();
  const d = Math.sqrt(Math.max(1 - (a * a + b * b + 2 * a * b * G), 0));
  const base = gA.clone().multiplyScalar(a).addScaledVector(gB, b);
  const c1 = base.clone().addScaledVector(w, d), c2 = base.clone().addScaledVector(w, -d);
  // the crease rises into the open wedge between the planes
  const mid = new THREE.Vector3(Math.cos(theta / 2), Math.sin(theta / 2), 0);
  const c = (c1.dot(mid) >= c2.dot(mid) ? c1 : c2).normalize();
  const eA = gA.clone().addScaledVector(c, -gA.dot(c)).normalize(), eB = gB.clone().addScaledVector(c, -gB.dot(c)).normalize();
  return { gA, gB, c, eA, eB };
}

export type PopupVFold = { root: THREE.Group; driver: THREE.Group; hit: THREE.Mesh; width: number; /** Rigid frames on either side of the solved crease, for connected paper pieces. */ leaves?:readonly THREE.Group[]; pose(n: number,paint?:number,bookOpen?:number): void; dispose(): void };
export type PopupVFoldOptions = {
  height: number; cardWidth: number; cardDepth: number; apexZ?: number;
  /** glue angle from the hinge, radians (π/4 = square V) */ alpha?: number;
  /** crease lean against the glue lines, radians (π/2 = upright) */ beta?: number;
  /** where the crease cuts the art, 0–1 from its left edge */ split?: number;
  faces?: 'reader' | 'away'; mount?: 'card' | 'spine'; thickness?: number; backColor?: THREE.ColorRepresentation;
  /** Authored open doorway for the woodland den, not an alpha-painted mouth. */
  doorway?: boolean;
  /** Opt-in printing on the reverse, used by multi-angle scenery. */
  paintedBack?: boolean;
};

/** A pop-up lying on the page: a base card folded along the hinge (or the
 * book's own gutter for a spine mount), and a painting cut out and V-folded
 * across it. Progress n (0 shut, 1 open) opens the hinge like a greeting card;
 * the V-fold follows from the linkage. */
export function createPopupVFold(art: HTMLCanvasElement, o: PopupVFoldOptions): PopupVFold {
  const alpha = o.alpha ?? Math.PI / 4, beta = o.beta ?? Math.PI / 2, t = o.thickness ?? .012, split = Math.min(.9, Math.max(.1, o.split ?? .5));
  const zSign = o.faces === 'away' ? 1 : -1, apexZ = o.apexZ ?? 0;
  const width = o.height * art.width / art.height;
  const root = new THREE.Group(), card = new THREE.Group(); root.add(card); card.position.y = o.mount === 'spine' ? 0 : t;
  // the base card: half A on the page, half B on its own hinge
  const paper = new THREE.MeshStandardMaterial({ color: '#f1e7d0', roughness: .92 });
  const halfA = new THREE.Mesh(new THREE.BoxGeometry(o.cardWidth / 2, t, o.cardDepth), paper);
  halfA.position.set(o.cardWidth / 4 + .004, -t / 2, zSign * (o.cardDepth / 2 - .25) + apexZ);
  const pivotB = new THREE.Group(); card.add(halfA, pivotB);
  const halfB = halfA.clone();halfB.geometry=halfA.geometry.clone(); halfB.position.x = -halfA.position.x; pivotB.add(halfB);
  for (const m of [halfA, halfB]) { m.castShadow = true; m.receiveShadow = true; m.visible = o.mount !== 'spine';m.userData.paperStand=true; }
  // the cut-out, split at the crease; each half drawn in its own frame
  const halves = [1, -1].map(side => {
    const panel=paintedPaperPanel(art,o.height,t,o.backColor??'#efe4cc',side===1?split:0,side===1?1:split,o.doorway,o.paintedBack);
    panel.group.position.x=(.5-split)*width;
    const frame=new THREE.Group();frame.matrixAutoUpdate=false;frame.add(panel.group);card.add(frame);
    return {side,meshes:[frame],panel};
  });
  // invisible stand-in the editor clicks, drags and frames: the art standing at the apex
  // a solid box over the whole pop-up and its card, so it can be picked from any view, top-down included
  const card0 = o.mount === 'spine' ? 0 : o.cardWidth / 2, minX = -Math.max(card0, split * width * Math.sin(alpha)), maxX = Math.max(card0, (1 - split) * width * Math.sin(alpha));
  const reach = Math.max(o.mount === 'spine' ? 0 : o.cardDepth - .25, width * Math.cos(alpha) * Math.max(split, 1 - split), .1);
  const hitGeo = new THREE.BoxGeometry(maxX - minX, o.height, reach); hitGeo.translate((minX + maxX) / 2, o.height / 2, zSign * reach / 2);
  const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
  hit.position.z = apexZ; hit.userData.editorHelper = true; root.add(hit);
  const apex = new THREE.Vector3(0, 0, apexZ), basis = new THREE.Matrix4(), n = new THREE.Vector3();
  const ease = (x: number) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  function pose(p: number) {
    const theta = Math.max(.015, Math.PI * ease(p));
    pivotB.rotation.z = theta - Math.PI;
    const s = solveVFold(theta, alpha, beta, zSign);
    for (const h of halves) {
      // half A runs along eA; half B is laid out at x < 0, so its x runs along −eB
      const ex = h.side === 1 ? s.eA : s.eB.clone().negate();
      n.crossVectors(ex, s.c);
      basis.makeBasis(ex, s.c, n).setPosition(apex);
      for (const m of h.meshes) { m.matrix.copy(basis); m.matrixWorldNeedsUpdate = true; }
    }
  }
  const driver = new THREE.Group(); driver.position.set(0, 0, apexZ); root.add(driver);
  driver.userData.kirigami = { pose };
  root.userData.popupRoot = true;
  pose(1);
  rememberGroundRest(root);
  function dispose() {
    root.removeFromParent();
    for (const m of [paper, hit.material as THREE.Material]) m.dispose();
    for(const h of halves)h.panel.dispose();
    for (const g of new Set([halfA.geometry,halfB.geometry, hitGeo])) g.dispose();
  }
  return { root, driver, hit, width, leaves:halves.map(h=>h.meshes[0]), pose, dispose };
}
