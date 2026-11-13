import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {seeded} from './castlePaint';

export type CastleWindow = {
  x: number; z: number; sill: number; yaw: number; width: number; height: number; centerpiece?: boolean;
};

function arch(path: THREE.Path, width: number, height: number, margin = 0) {
  const radius = width / 2 + margin, spring = height - width / 2;
  path.moveTo(-radius, -margin);
  path.lineTo(radius, -margin);
  path.lineTo(radius, spring);
  path.absarc(0, spring, radius, 0, Math.PI, false);
  path.closePath();
}

function glassTexture(centerpiece: boolean, anisotropy: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 192; canvas.height = 256;
  const g = canvas.getContext('2d')!;
  const colors = ['#297ac1', '#1c9f9b', '#be4860', '#e69d35', '#614ab4', '#f1c563'];
  const lead = '#291f34', random = seeded(centerpiece ? 118 : 44);
  g.scale(canvas.width, canvas.height);
  g.fillStyle = colors[0]; g.fillRect(0, 0, 1, 1);
  g.strokeStyle = lead; g.lineWidth = .014; g.lineJoin = 'round';
  for (let row = -1; row < 7; row++) for (let col = -1; col < 4; col++) {
    const x = (col + (row % 2 ? .5 : 0)) / 3, y = row / 6;
    const fill = g.createLinearGradient(x - .16, y + .16, x + .11, y - .1);
    fill.addColorStop(0, colors[(row * 3 + col + 12) % colors.length]);
    fill.addColorStop(1, colors[(row + col + 7) % colors.length]);
    g.beginPath(); g.moveTo(x, y - 1/6); g.lineTo(x + 1/6, y);
    g.lineTo(x, y + 1/6); g.lineTo(x - 1/6, y); g.closePath();
    g.fillStyle = fill; g.fill(); g.stroke();
  }

  if (centerpiece) {
    // The gate's larger panel has a gold sun in a cobalt and ruby rosette.
    g.save(); g.translate(.5, .48); g.scale(1, .73);
    const disc = (radius: number, color: string) => {
      g.beginPath(); g.arc(0, 0, radius, 0, Math.PI * 2);
      g.fillStyle = color; g.fill(); g.stroke();
    };
    disc(.388, '#ca7536'); disc(.346, '#22478e');
    for (let i = 0; i < 12; i++) {
      g.rotate(Math.PI / 6);
      g.beginPath(); g.moveTo(0, -.105);
      g.quadraticCurveTo(-.128, -.195, 0, -.329);
      g.quadraticCurveTo(.128, -.195, 0, -.105);
      g.fillStyle = colors[i % 2 ? 2 : 3]; g.fill(); g.stroke();
    }
    disc(.124, '#eba64d'); disc(.088, '#ffe29a');
    g.restore();
  }

  // Pale streaks and fine specks suggest uneven, hand-worked glass at close range.
  for (let i = 0; i < 1450; i++) {
    const alpha = random() * .18;
    g.fillStyle = i % 2 ? `rgba(255,228,184,${alpha})` : `rgba(43,34,67,${alpha})`;
    g.fillRect(random(), random(), .003 + random() * .012, .002 + random() * .005);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = anisotropy;
  return texture;
}

export function castleStainedGlass(windows: readonly CastleWindow[], anisotropy: number) {
  const frames: THREE.BufferGeometry[] = [], small: THREE.BufferGeometry[] = [], large: THREE.BufferGeometry[] = [];
  for (const {x,z,sill,yaw,width,height,centerpiece} of windows) {
    const opening = new THREE.Shape(), ring = new THREE.Shape(), hole = new THREE.Path();
    arch(opening, width, height); arch(hole, width, height); arch(ring, width, height, centerpiece ? .48 : .24);
    ring.holes.push(hole);
    const place = (g: THREE.BufferGeometry) => g.rotateY(yaw).translate(x, sill, z);
    frames.push(place(new THREE.ExtrudeGeometry(ring, {
      depth: centerpiece ? .55 : .36, bevelThickness: .055, bevelSize: .055, bevelSegments: 1, curveSegments: 12, steps: 1,
    }).translate(0, 0, -.09)));

    const pane = new THREE.ShapeGeometry(opening, 12);
    const {position, uv} = pane.attributes;
    for (let i = 0; i < position.count; i++) uv.setXY(i, position.getX(i)/width+.5, position.getY(i)/height);
    // Tuck the glass behind the front of the stone reveal and into the bevel.
    (centerpiece ? large : small).push(place(pane.scale(1.04, 1.02, 1).translate(0, -.015, .045)).toNonIndexed());
  }
  const glass = (panes: THREE.BufferGeometry[], centerpiece: boolean) => {
    const map = glassTexture(centerpiece, anisotropy);
    return {
      geometry: mergeGeometries(panes)!,
      material: new THREE.MeshLambertMaterial({map, color:'#948182', emissive:'#fff1dc', emissiveMap:map, emissiveIntensity:1.65}),
    };
  };
  return {frames: mergeGeometries(frames)!, panes: [glass(small, false), glass(large, true)]};
}
