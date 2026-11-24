import * as THREE from 'three';

export interface FoxPart {
  name: string;
  type: 'box' | 'sphere' | 'cone';
  pos: THREE.Vector3;
  rot: THREE.Euler;
  scale: THREE.Vector3;
}

/**
 * A "kit" of primitive volumes that define a stylized fox scaffold.
 * Units are roughly in meters; y=0 is the floor plane.
 */
export const FOX_KIT: FoxPart[] = [
  // Body (large box)
  {
    name: 'body',
    type: 'box',
    pos: new THREE.Vector3(0, 0.7, 0),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1.2, 0.6, 0.65),
  },
  // Head (small box)
  {
    name: 'head',
    type: 'box',
    pos: new THREE.Vector3(0.8, 1.05, 0),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(0.5, 0.45, 0.45),
  },
  // Snout (tapered extension)
  {
    name: 'snout',
    type: 'box',
    pos: new THREE.Vector3(1.15, 0.95, 0),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(0.4, 0.25, 0.25),
  },
  // Tail (fluffy cylinder/box hybrid)
  {
    name: 'tail',
    type: 'box',
    pos: new THREE.Vector3(-0.95, 0.85, 0),
    rot: new THREE.Euler(0, 0, -0.5),
    scale: new THREE.Vector3(0.9, 0.45, 0.45),
  },
  // Front legs
  {
    name: 'leg_fr',
    type: 'box',
    pos: new THREE.Vector3(0.4, 0.35, 0.22),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(0.15, 0.7, 0.15),
  },
  {
    name: 'leg_fl',
    type: 'box',
    pos: new THREE.Vector3(0.4, 0.35, -0.22),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(0.15, 0.7, 0.15),
  },
  // Back legs
  {
    name: 'leg_br',
    type: 'box',
    pos: new THREE.Vector3(-0.4, 0.35, 0.22),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(0.15, 0.7, 0.15),
  },
  {
    name: 'leg_bl',
    type: 'box',
    pos: new THREE.Vector3(-0.4, 0.35, -0.22),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(0.15, 0.7, 0.15),
  },
  // Ears (triangularish boxes)
  {
    name: 'ear_r',
    type: 'box',
    pos: new THREE.Vector3(0.85, 1.4, 0.15),
    rot: new THREE.Euler(0, 0, 0.3),
    scale: new THREE.Vector3(0.1, 0.35, 0.18),
  },
  {
    name: 'ear_l',
    type: 'box',
    pos: new THREE.Vector3(0.85, 1.4, -0.15),
    rot: new THREE.Euler(0, 0, 0.3),
    scale: new THREE.Vector3(0.1, 0.35, 0.18),
  },
];
