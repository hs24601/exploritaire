import * as THREE from 'three';

// Matches Elysium's 4-state TOD palette
export interface TODColorSet {
  down: [number, number, number];   // sky bottom / fog near
  mid:  [number, number, number];   // sky middle / fog mid
  up:   [number, number, number];   // sky top / fog far
}

export interface TODState {
  sky:  TODColorSet;
  fog:  TODColorSet;
  fogDensity: number;
}

export interface LightingState {
  time: number;           // 0-1 across full day
  phase: number;          // 0=dawn 1=noon 2=dusk 3=night (float with blend)
  phaseBlend: number;     // 0-1 blend to next phase
  skyDown: THREE.Color;
  skyMid:  THREE.Color;
  skyUp:   THREE.Color;
  fogNear: THREE.Color;
  fogMid:  THREE.Color;
  fogFar:  THREE.Color;
  fogDensity: number;
  sunDir: THREE.Vector3;
  ambientColor: THREE.Color;
  ambientIntensity: number;
}

// Azarien void-forest palette — deep purple darkness at all times
const DEFAULT_STATES: [TODState, TODState, TODState, TODState] = [
  // All four states converge on the same deep void purple.
  // Subtle variation keeps the TOD system functional without breaking the aesthetic.
  { // "Dawn" — faintest warm tint
    sky: { down: [0.13,0.06,0.20], mid: [0.10,0.04,0.17], up: [0.07,0.03,0.13] },
    fog: { down: [0.14,0.07,0.22], mid: [0.10,0.04,0.18], up: [0.07,0.03,0.14] },
    fogDensity: 0.0022,
  },
  { // "Noon" — pure void, slightly lighter
    sky: { down: [0.11,0.05,0.18], mid: [0.09,0.04,0.15], up: [0.06,0.02,0.11] },
    fog: { down: [0.12,0.05,0.19], mid: [0.09,0.04,0.16], up: [0.06,0.02,0.12] },
    fogDensity: 0.0018,
  },
  { // "Dusk" — slight red-purple warmth
    sky: { down: [0.15,0.05,0.20], mid: [0.11,0.04,0.17], up: [0.08,0.03,0.14] },
    fog: { down: [0.16,0.06,0.21], mid: [0.11,0.04,0.18], up: [0.08,0.03,0.15] },
    fogDensity: 0.0025,
  },
  { // "Night" — deepest void
    sky: { down: [0.09,0.03,0.15], mid: [0.07,0.03,0.12], up: [0.05,0.02,0.09] },
    fog: { down: [0.10,0.04,0.16], mid: [0.07,0.03,0.13], up: [0.05,0.02,0.10] },
    fogDensity: 0.003,
  },
];

function lerpColor(a: [number,number,number], b: [number,number,number], t: number): THREE.Color {
  return new THREE.Color(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  );
}

function lerpSet(a: TODColorSet, b: TODColorSet, t: number): { down: THREE.Color; mid: THREE.Color; up: THREE.Color } {
  return {
    down: lerpColor(a.down, b.down, t),
    mid:  lerpColor(a.mid,  b.mid,  t),
    up:   lerpColor(a.up,   b.up,   t),
  };
}

export class TimeOfDaySystem {
  private time: number = 0.33;  // start at ~noon
  private speed: number = 0.01; // full day cycle per second when 1.0; default slow
  public states: [TODState, TODState, TODState, TODState];

  constructor() {
    this.states = DEFAULT_STATES.map(s => JSON.parse(JSON.stringify(s))) as typeof DEFAULT_STATES;
  }

  update(dtSeconds: number): LightingState {
    this.time = (this.time + dtSeconds * this.speed) % 1.0;
    return this.evaluate(this.time);
  }

  evaluate(t: number): LightingState {
    // Map 0-1 to 4 phases
    const t4 = t * 4.0;
    const phaseIdx = Math.floor(t4) % 4;
    const blend = t4 - Math.floor(t4);
    const nextIdx = (phaseIdx + 1) % 4;

    const a = this.states[phaseIdx];
    const b = this.states[nextIdx];

    const sky = lerpSet(a.sky, b.sky, blend);
    const fog = lerpSet(a.fog, b.fog, blend);
    const fogDensity = a.fogDensity + (b.fogDensity - a.fogDensity) * blend;

    // Sun travels in an arc: 0=midnight below, 0.5=noon above
    const sunAngle = (t - 0.25) * Math.PI * 2;
    const sunDir = new THREE.Vector3(
      Math.cos(sunAngle),
      Math.sin(sunAngle),
      0.3,
    ).normalize();

    // Ambient: dim at night, bright at noon
    const dayFactor = Math.max(0, Math.sin(t * Math.PI * 2 - Math.PI * 0.5) * 0.5 + 0.5);
    const ambientIntensity = 0.15 + dayFactor * 0.65;
    const ambientColor = lerpColor([0.4, 0.45, 0.6], [1.0, 0.95, 0.85], dayFactor);

    return {
      time: t,
      phase: phaseIdx,
      phaseBlend: blend,
      skyDown: sky.down,
      skyMid:  sky.mid,
      skyUp:   sky.up,
      fogNear: fog.down,
      fogMid:  fog.mid,
      fogFar:  fog.up,
      fogDensity,
      sunDir,
      ambientColor,
      ambientIntensity,
    };
  }

  setTime(t: number) { this.time = t % 1.0; }
  getTime() { return this.time; }
  setSpeed(s: number) { this.speed = s; }
  getSpeed() { return this.speed; }
}
