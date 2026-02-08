import type { Element } from '../engine/types';
import type { WatercolorConfig } from './types';
import { ACTOR_WATERCOLOR_TEMPLATE, buildActorWatercolorConfig } from './presets';

export function getElementCardWatercolor(element: Element | undefined): WatercolorConfig | null {
  if (!element || element === 'N') return null;

  if (element === 'A') {
    const baseColor = '#9cc6ef';
    const config = buildActorWatercolorConfig(baseColor, ACTOR_WATERCOLOR_TEMPLATE);
    const cloudCore = config.splotches.map((splotch, index) => ({
      ...splotch,
      blendMode: 'normal',
      opacity: 0.95 - index * 0.06,
      gradient: {
        ...splotch.gradient,
        light: '#ffffff',
        mid: '#edf2f7',
        dark: '#c9d6e6',
        lightOpacity: 1,
        midOpacity: 0.95,
        darkOpacity: 0.85,
      },
    }));
    const cloudPuffs = [
      { scale: 0.45, offset: [-0.28, -0.08] },
      { scale: 0.38, offset: [0.12, -0.2] },
      { scale: 0.42, offset: [0.32, 0.02] },
      { scale: 0.36, offset: [-0.1, 0.22] },
      { scale: 0.3, offset: [-0.36, 0.18] },
    ].map((entry, index) => ({
      ...config.splotches[0],
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'normal',
      opacity: 0.85 - index * 0.05,
      gradient: {
        ...config.splotches[0].gradient,
        light: '#ffffff',
        mid: '#f1f4f9',
        dark: '#c7d3e2',
        lightOpacity: 1,
        midOpacity: 0.9,
        darkOpacity: 0.8,
      },
    }));
    const skyWash = [
      { scale: 1.2, offset: [0.05, -0.1], opacity: 0.7 },
      { scale: 1.05, offset: [-0.08, 0.12], opacity: 0.55 },
    ].map((entry) => ({
      ...config.splotches[1],
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'multiply',
      opacity: entry.opacity,
      gradient: {
        ...config.splotches[1].gradient,
        light: '#a7d1f5',
        mid: '#6ea7dd',
        dark: '#3a73b4',
        lightOpacity: 0.6,
        midOpacity: 0.7,
        darkOpacity: 0.8,
      },
    }));
    return {
      ...config,
      splotches: [...skyWash, ...cloudCore, ...cloudPuffs],
      grain: {
        ...config.grain,
        enabled: true,
        intensity: 0.18,
        frequency: 0.035,
        blendMode: 'overlay',
      },
      overallScale: 1.1,
    };
  }

  if (element === 'W') {
    const baseColor = '#2aa8e0';
    const config = buildActorWatercolorConfig(baseColor, ACTOR_WATERCOLOR_TEMPLATE);
    const baseSplotch = config.splotches[0];
    const secondarySplotch = config.splotches[1] ?? config.splotches[0];
    const oceanWash = [
      { scale: 1.7, offset: [0.0, -0.34], opacity: 1, colors: ['#e8fbff', '#a6e1f8', '#51b7e6'] },
      { scale: 1.4, offset: [-0.12, -0.05], opacity: 0.98, colors: ['#a6e1f8', '#36b1e6', '#0a5aa8'] },
      { scale: 1.1, offset: [0.12, 0.3], opacity: 0.98, colors: ['#66c7ee', '#1689c7', '#063d7a'] },
      { scale: 1.0, offset: [0.0, 0.58], opacity: 0.98, colors: ['#3a9fd5', '#0f6aa8', '#04284f'] },
    ].map((entry) => ({
      ...secondarySplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'normal',
      opacity: entry.opacity,
      gradient: {
        ...secondarySplotch.gradient,
        light: entry.colors[0],
        mid: entry.colors[1],
        dark: entry.colors[2],
        lightOpacity: 0.95,
        midOpacity: 0.95,
        darkOpacity: 1,
      },
    }));
    const lightRays = [
      { scale: 1.9, offset: [-0.24, -0.42], opacity: 0.75 },
      { scale: 1.7, offset: [0.0, -0.4], opacity: 0.85 },
      { scale: 1.5, offset: [0.25, -0.38], opacity: 0.7 },
      { scale: 1.3, offset: [0.12, -0.32], opacity: 0.6 },
    ].map((entry) => ({
      ...baseSplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      shape: 'rectangle',
      blendMode: 'screen',
      opacity: entry.opacity,
      gradient: {
        ...baseSplotch.gradient,
        light: '#f5fdff',
        mid: '#c7f0ff',
        dark: '#7fc8e8',
        lightOpacity: 0.95,
        midOpacity: 0.75,
        darkOpacity: 0.35,
      },
    }));
    const crestGlare = [
      { scale: 1.2, offset: [0.0, -0.56], opacity: 0.95 },
      { scale: 0.85, offset: [-0.22, -0.52], opacity: 0.85 },
      { scale: 0.85, offset: [0.24, -0.5], opacity: 0.8 },
      { scale: 0.55, offset: [0.06, -0.46], opacity: 0.7 },
    ].map((entry) => ({
      ...secondarySplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      shape: 'rectangle',
      blendMode: 'screen',
      opacity: entry.opacity,
      gradient: {
        ...secondarySplotch.gradient,
        light: '#ffffff',
        mid: '#f7fbff',
        dark: '#cfe8ff',
        lightOpacity: 0.9,
        midOpacity: 0.7,
        darkOpacity: 0.3,
      },
    }));
    const reef = [
      { scale: 1.6, offset: [0.0, 0.86], opacity: 0.98 },
      { scale: 1.35, offset: [-0.22, 0.78], opacity: 0.96 },
      { scale: 1.2, offset: [0.24, 0.8], opacity: 0.95 },
    ].map((entry) => ({
      ...baseSplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'multiply',
      opacity: entry.opacity,
      gradient: {
        ...baseSplotch.gradient,
        light: '#20345f',
        mid: '#0f1f3f',
        dark: '#081427',
        lightOpacity: 0.8,
        midOpacity: 0.95,
        darkOpacity: 1,
      },
    }));
    const reefGlow = [
      { scale: 0.6, offset: [-0.24, 0.72], opacity: 0.28, color: ['#f2d38a', '#c7b064', '#7b6a2e'] },
      { scale: 0.5, offset: [0.24, 0.74], opacity: 0.26, color: ['#d8a6c7', '#9c6aa1', '#5a2f5d'] },
      { scale: 0.45, offset: [0.0, 0.76], opacity: 0.22, color: ['#a7f0c4', '#6fb090', '#2f6b52'] },
    ].map((entry) => ({
      ...secondarySplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'screen',
      opacity: entry.opacity,
      gradient: {
        ...secondarySplotch.gradient,
        light: entry.color[0],
        mid: entry.color[1],
        dark: entry.color[2],
        lightOpacity: 0.7,
        midOpacity: 0.6,
        darkOpacity: 0.5,
      },
    }));
    const surfaceChop = [
      { scale: 0.7, offset: [-0.12, -0.6], opacity: 0.7 },
      { scale: 0.6, offset: [0.2, -0.62], opacity: 0.6 },
      { scale: 0.55, offset: [0.02, -0.56], opacity: 0.55 },
    ].map((entry) => ({
      ...secondarySplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      shape: 'rectangle',
      blendMode: 'screen',
      opacity: entry.opacity,
      gradient: {
        ...secondarySplotch.gradient,
        light: '#ffffff',
        mid: '#e9f6ff',
        dark: '#bfe4ff',
        lightOpacity: 0.8,
        midOpacity: 0.6,
        darkOpacity: 0.3,
      },
    }));
    return {
      ...config,
      splotches: [
        ...oceanWash,
        ...lightRays,
        ...crestGlare,
        ...surfaceChop,
        ...reef,
        ...reefGlow,
        {
          ...baseSplotch,
          scale: 1.6,
          offset: [0, 0.4],
          blendMode: 'multiply',
          opacity: 0.9,
          gradient: {
            ...baseSplotch.gradient,
            light: '#14315f',
            mid: '#0b1f42',
            dark: '#050d1f',
            lightOpacity: 1,
            midOpacity: 1,
            darkOpacity: 1,
          },
        },
        {
          ...baseSplotch,
          scale: 2.0,
          offset: [0, 0.6],
          blendMode: 'multiply',
          opacity: 1,
          gradient: {
            ...baseSplotch.gradient,
            light: '#0b1d3f',
            mid: '#050e22',
            dark: '#02060f',
            lightOpacity: 1,
            midOpacity: 1,
            darkOpacity: 1,
          },
        },
      ],
      grain: {
        ...config.grain,
        enabled: true,
        intensity: 0.18,
        frequency: 0.03,
        blendMode: 'overlay',
      },
      overallScale: 1.1,
    };
  }

  if (element === 'E') {
    const baseColor = '#9a8b5c';
    const config = buildActorWatercolorConfig(baseColor, ACTOR_WATERCOLOR_TEMPLATE);
    const baseSplotch = config.splotches[0];
    const secondarySplotch = config.splotches[1] ?? config.splotches[0];
    const meadowWash = [
      { scale: 1.6, offset: [0.0, 0.45], opacity: 0.95, colors: ['#f2c88a', '#d19a55', '#8a5a2b'] },
      { scale: 1.2, offset: [-0.25, 0.55], opacity: 0.82, colors: ['#e6b373', '#b87a3a', '#6a3f1b'] },
      { scale: 1.1, offset: [0.22, 0.52], opacity: 0.82, colors: ['#e9c089', '#c38644', '#7a4b22'] },
    ].map((entry) => ({
      ...secondarySplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'multiply',
      opacity: entry.opacity,
      gradient: {
        ...secondarySplotch.gradient,
        light: entry.colors[0],
        mid: entry.colors[1],
        dark: entry.colors[2],
        lightOpacity: 0.95,
        midOpacity: 0.9,
        darkOpacity: 0.9,
      },
    }));
    const rockMasses = [
      { scale: 1.55, offset: [-0.3, -0.18], opacity: 0.95, colors: ['#e5d2b0', '#9f7e57', '#553620'] },
      { scale: 1.4, offset: [0.1, -0.22], opacity: 0.95, colors: ['#ead8ba', '#a8845a', '#5a3a22'] },
      { scale: 1.15, offset: [0.34, -0.04], opacity: 0.9, colors: ['#f0e0c6', '#b08d63', '#654327'] },
      { scale: 0.95, offset: [-0.2, 0.04], opacity: 0.88, colors: ['#d9c5a3', '#8f6d46', '#4f321c'] },
    ].map((entry) => ({
      ...baseSplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'normal',
      opacity: entry.opacity,
      gradient: {
        ...baseSplotch.gradient,
        light: entry.colors[0],
        mid: entry.colors[1],
        dark: entry.colors[2],
        lightOpacity: 0.9,
        midOpacity: 0.85,
        darkOpacity: 0.9,
      },
    }));
    const ridgeShadows = [
      { scale: 1.35, offset: [-0.2, -0.26], opacity: 0.75 },
      { scale: 1.15, offset: [0.2, -0.3], opacity: 0.7 },
      { scale: 0.95, offset: [-0.05, -0.12], opacity: 0.6 },
      { scale: 0.7, offset: [0.08, -0.02], opacity: 0.55 },
    ].map((entry) => ({
      ...secondarySplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'multiply',
      opacity: entry.opacity,
      gradient: {
        ...secondarySplotch.gradient,
        light: '#7b4f2c',
        mid: '#4a2e1a',
        dark: '#24140a',
        lightOpacity: 0.8,
        midOpacity: 0.95,
        darkOpacity: 1,
      },
    }));
    const pineAccents = [
      { scale: 0.35, offset: [-0.22, 0.22], opacity: 0.55 },
      { scale: 0.3, offset: [-0.05, 0.28], opacity: 0.5 },
      { scale: 0.28, offset: [0.2, 0.24], opacity: 0.45 },
    ].map((entry) => ({
      ...baseSplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'multiply',
      opacity: entry.opacity,
      gradient: {
        ...baseSplotch.gradient,
        light: '#6a7a49',
        mid: '#3f4f2e',
        dark: '#26321c',
        lightOpacity: 0.7,
        midOpacity: 0.8,
        darkOpacity: 0.9,
      },
    }));
    const skyHaze = [
      { scale: 1.6, offset: [0.0, -0.7], opacity: 0.3 },
      { scale: 1.3, offset: [0.15, -0.6], opacity: 0.25 },
    ].map((entry) => ({
      ...secondarySplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'screen',
      opacity: entry.opacity,
      gradient: {
        ...secondarySplotch.gradient,
        light: '#f3dcc0',
        mid: '#d7b790',
        dark: '#b08a64',
        lightOpacity: 0.6,
        midOpacity: 0.4,
        darkOpacity: 0.2,
      },
    }));
    const cragLines = [
      { scale: 1.55, offset: [-0.22, -0.32], opacity: 0.9, angle: -12 },
      { scale: 1.35, offset: [0.18, -0.34], opacity: 0.85, angle: 10 },
      { scale: 1.15, offset: [0.02, -0.22], opacity: 0.8, angle: -6 },
      { scale: 0.95, offset: [-0.32, -0.08], opacity: 0.75, angle: 14 },
      { scale: 0.8, offset: [0.32, -0.1], opacity: 0.7, angle: -16 },
    ].map((entry) => ({
      ...baseSplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      shape: 'rectangle',
      rotation: entry.angle,
      blendMode: 'normal',
      opacity: entry.opacity,
      gradient: {
        ...baseSplotch.gradient,
        light: '#1c130c',
        mid: '#100a06',
        dark: '#050302',
        lightOpacity: 0.9,
        midOpacity: 0.95,
        darkOpacity: 1,
      },
    }));
    return {
      ...config,
      splotches: [
        ...skyHaze,
        ...rockMasses,
        ...ridgeShadows,
        ...cragLines,
        ...pineAccents,
        ...meadowWash,
      ],
      grain: {
        ...config.grain,
        enabled: true,
        intensity: 0.22,
        frequency: 0.03,
        blendMode: 'overlay',
      },
      overallScale: 1.1,
    };
  }

  if (element === 'F') {
    const baseColor = '#ff9b2f';
    const config = buildActorWatercolorConfig(baseColor, ACTOR_WATERCOLOR_TEMPLATE);
    const baseSplotch = config.splotches[0];
    const secondarySplotch = config.splotches[1] ?? config.splotches[0];
    const coreFlare = [
      { scale: 1.6, offset: [0.0, -0.15], opacity: 1, colors: ['#ffe2a0', '#ff9a2a', '#ff4f0a'] },
      { scale: 1.25, offset: [0.1, 0.0], opacity: 0.97, colors: ['#ffc873', '#ff6f1a', '#d12b05'] },
      { scale: 1.05, offset: [-0.12, 0.2], opacity: 0.92, colors: ['#ffb45a', '#ff4b12', '#a01605'] },
    ].map((entry) => ({
      ...secondarySplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'normal',
      opacity: entry.opacity,
      gradient: {
        ...secondarySplotch.gradient,
        light: entry.colors[0],
        mid: entry.colors[1],
        dark: entry.colors[2],
        lightOpacity: 1,
        midOpacity: 0.95,
        darkOpacity: 0.9,
      },
    }));
    const flameBursts = [
      { scale: 1.45, offset: [-0.28, -0.05], opacity: 0.92 },
      { scale: 1.35, offset: [0.28, -0.08], opacity: 0.9 },
      { scale: 1.25, offset: [-0.12, 0.15], opacity: 0.88 },
      { scale: 1.15, offset: [0.12, 0.28], opacity: 0.86 },
    ].map((entry) => ({
      ...baseSplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'screen',
      opacity: entry.opacity,
      gradient: {
        ...baseSplotch.gradient,
        light: '#ffe28f',
        mid: '#ff8f2a',
        dark: '#ff3a0a',
        lightOpacity: 0.95,
        midOpacity: 0.88,
        darkOpacity: 0.78,
      },
    }));
    const emberWaves = [
      { scale: 1.6, offset: [-0.2, 0.4], opacity: 0.94, colors: ['#ff5a1e', '#c41407', '#560908'] },
      { scale: 1.4, offset: [0.22, 0.42], opacity: 0.92, colors: ['#ff3d14', '#9e0f06', '#400706'] },
      { scale: 1.2, offset: [0.0, 0.6], opacity: 0.9, colors: ['#e6230f', '#7a0b06', '#2b0405'] },
    ].map((entry) => ({
      ...secondarySplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'multiply',
      opacity: entry.opacity,
      gradient: {
        ...secondarySplotch.gradient,
        light: entry.colors[0],
        mid: entry.colors[1],
        dark: entry.colors[2],
        lightOpacity: 0.95,
        midOpacity: 0.95,
        darkOpacity: 1,
      },
    }));
    const smokeVeil = [
      { scale: 1.5, offset: [-0.25, -0.5], opacity: 0.26 },
      { scale: 1.3, offset: [0.2, -0.45], opacity: 0.24 },
    ].map((entry) => ({
      ...secondarySplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'multiply',
      opacity: entry.opacity,
      gradient: {
        ...secondarySplotch.gradient,
        light: '#7a2516',
        mid: '#3b0e0c',
        dark: '#160707',
        lightOpacity: 0.45,
        midOpacity: 0.55,
        darkOpacity: 0.65,
      },
    }));
    return {
      ...config,
      splotches: [...coreFlare, ...flameBursts, ...emberWaves, ...smokeVeil],
      grain: {
        ...config.grain,
        enabled: true,
        intensity: 0.2,
        frequency: 0.03,
        blendMode: 'overlay',
      },
      overallScale: 1.1,
    };
  }

  if (element === 'L') {
    const baseColor = '#f7e7b0';
    const config = buildActorWatercolorConfig(baseColor, ACTOR_WATERCOLOR_TEMPLATE);
    const baseSplotch = config.splotches[0];
    const secondarySplotch = config.splotches[1] ?? config.splotches[0];
    const skyGlow = [
      { scale: 1.8, offset: [0.0, -0.25], opacity: 1, colors: ['#fff6cf', '#f7d774', '#e6b34a'] },
      { scale: 1.4, offset: [0.0, -0.05], opacity: 0.95, colors: ['#fff0b2', '#f4c95d', '#d79a36'] },
    ].map((entry) => ({
      ...secondarySplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'normal',
      opacity: entry.opacity,
      gradient: {
        ...secondarySplotch.gradient,
        light: entry.colors[0],
        mid: entry.colors[1],
        dark: entry.colors[2],
        lightOpacity: 1,
        midOpacity: 0.9,
        darkOpacity: 0.85,
      },
    }));
    const crepuscularRays = [
      { scale: 2.1, offset: [-0.18, -0.42], opacity: 0.6 },
      { scale: 1.9, offset: [0.0, -0.45], opacity: 0.7 },
      { scale: 1.7, offset: [0.2, -0.4], opacity: 0.55 },
      { scale: 1.5, offset: [0.1, -0.32], opacity: 0.5 },
    ].map((entry) => ({
      ...baseSplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      shape: 'rectangle',
      blendMode: 'screen',
      opacity: entry.opacity,
      gradient: {
        ...baseSplotch.gradient,
        light: '#fff7da',
        mid: '#f8e9b4',
        dark: '#e0c07a',
        lightOpacity: 0.95,
        midOpacity: 0.7,
        darkOpacity: 0.4,
      },
    }));
    const upperClouds = [
      { scale: 1.6, offset: [-0.1, -0.6], opacity: 0.55 },
      { scale: 1.4, offset: [0.2, -0.55], opacity: 0.5 },
    ].map((entry) => ({
      ...secondarySplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'multiply',
      opacity: entry.opacity,
      gradient: {
        ...secondarySplotch.gradient,
        light: '#8a6f49',
        mid: '#4e3f2b',
        dark: '#20170f',
        lightOpacity: 0.4,
        midOpacity: 0.6,
        darkOpacity: 0.75,
      },
    }));
    const horizonMount = [
      { scale: 1.3, offset: [0.28, 0.2], opacity: 0.75 },
      { scale: 1.1, offset: [-0.2, 0.22], opacity: 0.7 },
    ].map((entry) => ({
      ...baseSplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'multiply',
      opacity: entry.opacity,
      gradient: {
        ...baseSplotch.gradient,
        light: '#3b2e1f',
        mid: '#241b12',
        dark: '#120c08',
        lightOpacity: 0.7,
        midOpacity: 0.85,
        darkOpacity: 0.95,
      },
    }));
    const waterBand = [
      { scale: 1.8, offset: [0.0, 0.62], opacity: 0.9, colors: ['#2c3542', '#1d242f', '#0e141b'] },
      { scale: 1.4, offset: [0.0, 0.68], opacity: 0.85, colors: ['#394251', '#1f2731', '#0a0f14'] },
    ].map((entry) => ({
      ...secondarySplotch,
      scale: entry.scale,
      offset: entry.offset as [number, number],
      blendMode: 'multiply',
      opacity: entry.opacity,
      gradient: {
        ...secondarySplotch.gradient,
        light: entry.colors[0],
        mid: entry.colors[1],
        dark: entry.colors[2],
        lightOpacity: 0.9,
        midOpacity: 0.95,
        darkOpacity: 1,
      },
    }));
    return {
      ...config,
      splotches: [
        ...skyGlow,
        ...crepuscularRays,
        ...upperClouds,
        ...horizonMount,
        ...waterBand,
      ],
      grain: {
        ...config.grain,
        enabled: true,
        intensity: 0.2,
        frequency: 0.03,
        blendMode: 'overlay',
      },
      overallScale: 1.1,
    };
  }

  return null;
}
