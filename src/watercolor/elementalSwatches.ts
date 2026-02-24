import type { Element } from '../engine/types';

export type ElementWatercolorSwatch = {
  label: string;
  filterTail: string;
  baseColor: string;
  glow?: string;
};

export const ELEMENT_WATERCOLOR_SWATCH_ORDER: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];

export const ELEMENT_WATERCOLOR_SWATCHES: Record<Element, ElementWatercolorSwatch> = {
  W: {
    label: 'Water',
    filterTail: 'brightness(0.9) contrast(1.9) saturate(220%)',
    baseColor: '#2a66ff',
  },
  E: {
    label: 'Earth',
    filterTail: 'sepia(1) brightness(0.84) contrast(1.58) saturate(420%) hue-rotate(10deg)',
    baseColor: '#5b3818',
  },
  A: {
    label: 'Air',
    filterTail: 'sepia(1) brightness(1.6) contrast(1.15) saturate(180%) hue-rotate(198deg)',
    baseColor: '#6b8794',
  },
  F: {
    label: 'Fire',
    filterTail: 'sepia(1) brightness(1.1) contrast(1.82) saturate(520%) hue-rotate(-8deg)',
    baseColor: '#5b1200',
  },
  L: {
    label: 'Light',
    filterTail: 'sepia(1) brightness(2.4) contrast(1.05) saturate(120%) hue-rotate(48deg)',
    baseColor: '#f3e9b4',
    glow: 'rgba(255, 248, 208, 0.85)',
  },
  D: {
    label: 'Dark',
    filterTail: 'sepia(1) brightness(0.42) contrast(1.55) saturate(12%) hue-rotate(230deg)',
    baseColor: '#141226',
  },
  N: {
    label: 'Neutral',
    filterTail: 'sepia(1) brightness(1.2) contrast(1.05) saturate(40%) hue-rotate(35deg)',
    baseColor: '#000000',
  },
};
