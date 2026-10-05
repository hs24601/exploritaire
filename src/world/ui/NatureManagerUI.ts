import * as THREE from 'three';
import type { WorldEngine } from '../WorldEngine';

// ── Helpers ─────────────────────────────────────────────────────────────────

function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}
function colorToHex(c: THREE.Color): string {
  return '#' + c.getHexString();
}
function $ <T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
function makeColorRow(containerId: string, defaults: string[]): Array<HTMLInputElement> {
  const el = $(containerId);
  if (!el) return [];
  return defaults.map(hex => {
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.value = hex;
    el.appendChild(inp);
    return inp;
  });
}

// ── NatureManagerUI ──────────────────────────────────────────────────────────

export class NatureManagerUI {
  private engine: WorldEngine;

  constructor(engine: WorldEngine) {
    this.engine = engine;
    this.init();
  }

  private init() {
    // Toggle button
    const toggle = $('nmToggle');
    const panel  = $('natureManager');
    if (toggle && panel) {
      toggle.addEventListener('click', () => panel.classList.toggle('open'));
    }

    this.wireTime();
    this.wireSky();
    this.wireFog();
    this.wireTerrain();
    this.wireWater();
    this.wireGrass();
    this.wireSaveReset();
  }

  // ── Time ───────────────────────────────────────────────────────────────

  private wireTime() {
    const tod = this.engine.getTOD();

    const timeSlider  = $<HTMLInputElement>('nm-time');
    const speedSlider = $<HTMLInputElement>('nm-timeSpeed');
    if (!timeSlider || !speedSlider) return;

    timeSlider.value  = String(tod.getTime());
    speedSlider.value = String(tod.getSpeed());

    timeSlider.addEventListener('input', () => {
      tod.setTime(parseFloat(timeSlider.value));
    });
    speedSlider.addEventListener('input', () => {
      tod.setSpeed(parseFloat(speedSlider.value));
    });
  }

  // ── Sky ────────────────────────────────────────────────────────────────

  private wireSky() {
    const sky = this.engine.getSky();
    const tod = this.engine.getTOD();

    const containerIds = ['sky-dawn', 'sky-noon', 'sky-dusk', 'sky-night'];
    const defaults: Record<string, string[]> = {
      'sky-dawn':  ['#f28c4d', '#cc7a99', '#323380'],
      'sky-noon':  ['#99ccff', '#6699f2', '#2657cc'],
      'sky-dusk':  ['#ff7f26', '#cc4d66', '#261a59'],
      'sky-night': ['#0d0d1f', '#080819', '#030310'],
    };

    containerIds.forEach((cid, idx) => {
      const pickers = makeColorRow(cid, defaults[cid] ?? ['#000','#000','#000']);
      const update = () => {
        // Update TOD state — the sky shader picks up changes automatically via LightingState interpolation
        const s = tod.states[idx].sky;
        const cd = hexToColor(pickers[0].value);
        const cm = hexToColor(pickers[1].value);
        const cu = hexToColor(pickers[2].value);
        s.down = [cd.r, cd.g, cd.b];
        s.mid  = [cm.r, cm.g, cm.b];
        s.up   = [cu.r, cu.g, cu.b];
      };
      pickers.forEach(p => p.addEventListener('input', update));
    });

    // Gradient edges
    const wireSkySlider = (id: string) => {
      const el = $<HTMLInputElement>(id);
      if (el) el.addEventListener('input', () => this.syncSkyEdges(sky));
    };
    wireSkySlider('nm-skyStep1');
    wireSkySlider('nm-skyStep2');
    wireSkySlider('nm-skySharp1');
    wireSkySlider('nm-skySharp2');
  }

  private syncSkyEdges(sky: ReturnType<typeof this.engine.getSky>) {
    const step1  = parseFloat(($<HTMLInputElement>('nm-skyStep1'))?.value  ?? '0.1');
    const step2  = parseFloat(($<HTMLInputElement>('nm-skyStep2'))?.value  ?? '0.6');
    const sharp1 = parseFloat(($<HTMLInputElement>('nm-skySharp1'))?.value ?? '0.05');
    const sharp2 = parseFloat(($<HTMLInputElement>('nm-skySharp2'))?.value ?? '0.05');
    sky.setGradientEdges(step1, step2, sharp1, sharp2);
  }

  // ── Fog ────────────────────────────────────────────────────────────────

  private wireFog() {
    const fog = this.engine.getFog();

    const densitySlider = $<HTMLInputElement>('nm-fogDensity');
    const heightSlider  = $<HTMLInputElement>('nm-fogHeight');

    if (densitySlider) {
      densitySlider.addEventListener('input', () => fog.setDensity(parseFloat(densitySlider.value)));
    }
    if (heightSlider) {
      heightSlider.addEventListener('input', () => fog.setHeight(parseFloat(heightSlider.value)));
    }
  }

  // ── Terrain ────────────────────────────────────────────────────────────

  private wireTerrain() {
    const mat = this.engine.getTerrain().material;

    const grassPickers = makeColorRow('terrain-grass', ['#4a7c35']);
    const beachPickers = makeColorRow('terrain-beach', ['#d4b87a']);
    const rockPickers  = makeColorRow('terrain-rock',  ['#7a6e5a']);

    if (grassPickers[0]) grassPickers[0].addEventListener('input', () => { mat.uniforms.uGrassColor.value.set(grassPickers[0].value); });
    if (beachPickers[0]) beachPickers[0].addEventListener('input', () => { mat.uniforms.uBeachColor.value.set(beachPickers[0].value); });
    if (rockPickers[0])  rockPickers[0].addEventListener('input',  () => { mat.uniforms.uRockColor.value.set(rockPickers[0].value); });

    const noiseSlider = $<HTMLInputElement>('nm-noiseScale');
    if (noiseSlider) {
      noiseSlider.addEventListener('input', () => {
        mat.uniforms.uNoiseScale.value = parseFloat(noiseSlider.value);
      });
    }
  }

  // ── Water ──────────────────────────────────────────────────────────────

  private wireWater() {
    const water = this.engine.getWater();

    // Colors
    const waterPickers = makeColorRow('water-colors', ['#f2fcff', '#5dc8a8', '#1a5c7a']);
    const syncWaterColors = () => {
      if (waterPickers.length >= 3) {
        water.setColors(
          hexToColor(waterPickers[0].value),
          hexToColor(waterPickers[1].value),
          hexToColor(waterPickers[2].value),
        );
      }
    };
    waterPickers.forEach(p => p.addEventListener('input', syncWaterColors));

    // Sliders
    const wire = (id: string, cb: (v: number) => void) => {
      const el = $<HTMLInputElement>(id);
      if (el) el.addEventListener('input', () => cb(parseFloat(el.value)));
    };
    wire('nm-depthSoftness', v => water.setDepthSoftness(v));
    wire('nm-foamSoftness',  v => water.setFoamParams(v, parseFloat(($<HTMLInputElement>('nm-foamScale'))?.value ?? '3'), parseFloat(($<HTMLInputElement>('nm-foamSpeed'))?.value ?? '0.02')));
    wire('nm-waveFreq',  v => water.setWaveParams(v, parseFloat(($<HTMLInputElement>('nm-waveAmp'))?.value ?? '0.15'), parseFloat(($<HTMLInputElement>('nm-waveSpeed'))?.value ?? '0.8')));
    wire('nm-waveAmp',   _v => this.syncWaveParams());
    wire('nm-waveSpeed', _v => this.syncWaveParams());
  }

  private syncWaveParams() {
    const freq  = parseFloat(($<HTMLInputElement>('nm-waveFreq'))?.value  ?? '0.5');
    const amp   = parseFloat(($<HTMLInputElement>('nm-waveAmp'))?.value   ?? '0.15');
    const speed = parseFloat(($<HTMLInputElement>('nm-waveSpeed'))?.value ?? '0.8');
    this.engine.getWater().setWaveParams(freq, amp, speed);
  }

  // ── Grass ──────────────────────────────────────────────────────────────

  private wireGrass() {
    const grass = this.engine.getGrass();

    const colorPickers = makeColorRow('grass-colors', ['#2d5a1b', '#6aaa3a', '#88c856']);
    const syncColors = () => {
      if (colorPickers.length >= 3) {
        grass.setColors(
          hexToColor(colorPickers[0].value),
          hexToColor(colorPickers[1].value),
          hexToColor(colorPickers[2].value),
        );
      }
    };
    colorPickers.forEach(p => p.addEventListener('input', syncColors));

    const wire = (id: string) => {
      const el = $<HTMLInputElement>(id);
      if (el) el.addEventListener('input', () => this.syncWindParams());
    };
    wire('nm-windFreq');
    wire('nm-windAmp');
    wire('nm-windSpeed');
  }

  private syncWindParams() {
    const freq  = parseFloat(($<HTMLInputElement>('nm-windFreq'))?.value  ?? '1.5');
    const amp   = parseFloat(($<HTMLInputElement>('nm-windAmp'))?.value   ?? '0.2');
    const speed = parseFloat(($<HTMLInputElement>('nm-windSpeed'))?.value ?? '0.8');
    this.engine.getGrass().setWindParams(freq, amp, speed);
  }

  // ── Save / Reset ───────────────────────────────────────────────────────

  private wireSaveReset() {
    const saveBtn  = $('nm-save');
    const resetBtn = $('nm-reset');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const state = this.serialize();
        localStorage.setItem('worldEngineState', JSON.stringify(state));
        console.log('[NatureManager] State saved to localStorage');
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        localStorage.removeItem('worldEngineState');
        window.location.reload();
      });
    }

    // Auto-restore on load
    const saved = localStorage.getItem('worldEngineState');
    if (saved) {
      try {
        this.deserialize(JSON.parse(saved));
      } catch (e) {
        console.warn('[NatureManager] Failed to restore saved state', e);
      }
    }
  }

  private serialize(): Record<string, unknown> {
    const getVal = (id: string) => ($<HTMLInputElement>(id))?.value;
    return {
      time:         getVal('nm-time'),
      timeSpeed:    getVal('nm-timeSpeed'),
      fogDensity:   getVal('nm-fogDensity'),
      fogHeight:    getVal('nm-fogHeight'),
      windFreq:     getVal('nm-windFreq'),
      windAmp:      getVal('nm-windAmp'),
      windSpeed:    getVal('nm-windSpeed'),
      waveFreq:     getVal('nm-waveFreq'),
      waveAmp:      getVal('nm-waveAmp'),
      waveSpeed:    getVal('nm-waveSpeed'),
      depthSoftness:getVal('nm-depthSoftness'),
      foamSoftness: getVal('nm-foamSoftness'),
    };
  }

  private deserialize(state: Record<string, unknown>) {
    const setVal = (id: string, val: unknown) => {
      if (val == null) return;
      const el = $<HTMLInputElement>(id);
      if (el) { el.value = String(val); el.dispatchEvent(new Event('input')); }
    };
    Object.entries(state).forEach(([k, v]) => setVal(`nm-${k}`, v));
  }
}
