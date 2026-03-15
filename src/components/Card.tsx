import { memo, useRef, useCallback, useMemo, useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType, OrimDefinition, OrimRarity, Element } from '../engine/types';
import { getRankDisplay } from '../engine/rules';
import { SUIT_COLORS, CARD_SIZE, getSuitDisplay, ELEMENT_TO_SUIT, SUIT_TO_ELEMENT, WILD_SENTINEL_RANK } from '../engine/constants';
import { useCardScale } from '../contexts/CardScaleContext';
import { CardFrame } from './card/CardFrame';
import { Tooltip } from './Tooltip';
import { CARD_WATERCOLOR_FILTER_ID } from '../watercolor/WatercolorSvgFilterDefs';
import { ELEMENT_WATERCOLOR_SWATCHES } from '../watercolor/elementalSwatches';
import abilitiesJson from '../data/abilities.json';
import { ORIM_DEFINITIONS } from '../engine/orims';
import { useHoloInteraction } from '../hooks/useHoloInteraction';
import { RarityAura } from './RarityAura';
import { HorizontalRipThreeEffect } from './card/HorizontalRipThreeEffect';
import { NEON_COLORS, getNeonElementColor } from '../utils/styles';
import { FORCE_NEON_CARD_STYLE, SHOW_WATERCOLOR_FILTERS } from '../config/ui';
import { useImmersiveBattle } from '../contexts/ImmersiveBattleContext';

const BLUEVEE_ASSET = '/assets/Bluevee.png';

function getFoundationOverlayTitleFontPx(title: string): number {
  const length = title.trim().length;
  if (length <= 7) return 16;
  if (length <= 10) return 14;
  if (length <= 14) return 12;
  if (length <= 18) return 10;
  if (length <= 24) return 9;
  if (length <= 30) return 8;
  return 7;
}

function hashStringToUnit(input: string, salt = 0): number {
  let hash = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function withAlphaColor(color: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const normalized = color.trim();
  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hexMatch) return normalized;
  const hex = hexMatch[1];
  const expanded = hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamped.toFixed(3)})`;
}

function normalizeLookupKey(value: string | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function toDisplayName(raw: string | undefined): string {
  const seed = String(raw ?? '').trim();
  if (!seed) return '';
  return seed
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function getElementLabel(element: Element | undefined): string {
  const key = String(element ?? 'N').toUpperCase();
  if (key === 'A') return 'Air';
  if (key === 'W') return 'Water';
  if (key === 'E') return 'Earth';
  if (key === 'F') return 'Fire';
  if (key === 'L') return 'Light';
  if (key === 'D') return 'Dark';
  return 'Neutral';
}

function renderElementIndicator(element: Element | undefined, fallback: string): ReactNode {
  if (element === 'E') {
    return (
      <svg viewBox="0 0 128 128" aria-hidden="true" style={{ width: '1.05em', height: '1.05em', display: 'block' }}>
        <path d="M65.03 92.69S4.8 111.08 4.67 112.41c-.13 1.33 24.11 12.02 64.62 11.46c38.64-.53 53.57-10.39 53.83-11.46S66.36 92.42 65.03 92.69z" fill="#b9ce46" />
        <path d="M62.26 42.15l-4.31-5.42s-6.96 7.3-8.84 9.29c-1.88 1.99-3.33 3.14-4.23 5.01c-1.29 2.67-5.38 25.72-5.38 25.72L27.67 88.9s-2.23-1.39-2.78-.94s-18.67 22.05-18.67 22.05l-1.56 2.39s3.6.8 4.71.69c.54-.05 3.2-.66 6.21-.97c3.17-.33 7.22-.06 7.67-.11c.51-.05 2.27-.57 2.27-.57l15.74-9.39l12.93-3.21l11.83 5.31l23.21 1.11l12.71-19.01l-27.63-36.59l-12.05-7.51z" fill="#9a7b63" />
        <path d="M28.55 97.77s-.43-1.23-.75-2.14c-.32-.91-.13-6.73-.13-6.73s7.21 4.26 8.01 4.96s7.94 5.15 7.94 5.15s5.09-.64 6.86-.75c1.77-.11 4.83.05 4.83.05l-1.18 1.72s-11.53 3.75-13.57 4.4c-2.04.64-15.11 7.29-15.09 7.04c.04-.52 3.4-5.33 3.4-5.33l-.32-8.37z" fill="#603a1a" />
        <path d="M80.73 103.46l-49.26 7.78s-2.38 2.11-2.14 2.67c.24.56 9.33 2.25 12.47 2.65c3.14.4 24.61 1.61 26.94 1.45c2.33-.16 26.14-1.37 29.44-1.77c3.3-.4 14.39-1.17 15.12-1.5c1.41-.64 7.88-4.13 7.88-4.13s-7.24-11.42-8.69-14.16c-1.45-2.73-3.86-7.64-5.55-9.33s-2.9-2.41-2.9-2.41s-2.28-5.3-4.94-8.68c-2.65-3.38-5.8-9.3-6.64-10.14c-3.19-3.18-3.77-3.03-3.77-3.03l2 24.1s-3.7 7.4-4.99 9.41c-1.27 2.03-4.97 7.09-4.97 7.09z" fill="#603a1a" />
        <path d="M63.03 27.62l-.97 19.62l11.41 7.08s3.43 8.79 3.59 9.6c.16.8-.15 2.97.17 3.53c.32.56 6.23 4.63 6.46 4.64c1.31.07 4.02-.4 3.86-.64s1.08-5.46 1.08-5.46s-7.84-12.71-9.53-16.25c-1.69-3.54-8.04-12.71-8.77-14.24s-4.18-6.6-4.91-7.4s-1.9-1.04-2.39-.48z" fill="#603a1a" />
        <path d="M68.02 65.05s5.39-8.88 5.55-10.24s-4.34-9.65-5.47-12.63c-1.13-2.98-4.1-9.09-4.42-9.89c-.32-.8-.64-4.66-.64-4.66s-2.25 2.41-3.06 4.34c-.8 1.93-3.83 6.68-3.83 6.68s1.9 11.02 2.63 15.76c.72 4.75 1.26 10.98 1.15 11.21c-.69 1.4-5.33 12.68-5.33 12.68s-.6 5.47-.04 6.03c.56.56 3.81 1.3 4.06.92c.49-.73.48-3.5.48-3.5s9.02-12.18 9.31-12.78c.11-.23-.39-3.92-.39-3.92z" fill="silver" />
        <path d="M49.64 65.92c-.03-1.21-1.8-6.95-2.12-8.24c-.32-1.29-1-7.66-1.89-7.66c-.88 0-4.96 11.22-5.37 12.27c-.4 1.05-6.11 13.35-6.84 14.8c-.72 1.45-4.02 7.72-4.66 8.77s-1.49 2.83-1.49 2.83l16.34 10.33l5.9-.67s-3.45-9.27-4.26-11.36s-1.77-5.47-1.77-5.47s1.87-4.48 3.09-7.7c1.23-3.24 3.11-6.7 3.07-7.9z" fill="silver" />
        <path d="M25.32 87.97c.04.15.25 3.92.14 6.17c-.11 2.26-.55 4.52-.55 4.52l-6.61 8.6s-11.96 4.63-12.68 4.85c-.72.22-.95.3-.95.3s-1.5-.91 2.99-5.81c5.8-6.33 13.22-15 14.16-16.09c1.67-1.94 3.39-2.99 3.5-2.54z" fill="silver" />
        <path d="M39.8 90.59c-.68-.07-1.54 2.2-2 3.89c-.33 1.19-2.46 7.22-2.71 8.39c-.26 1.18-1.58 4.66-1.22 4.82c.36.15 3.15.35 4.64.04c1.48-.31 4.72-2.91 4.72-3.52s-1.4-6.93-1.53-7.68c-.36-2.15-.84-5.83-1.9-5.94z" fill="#367c2d" />
        <path d="M106.71 99.82c-.6-.25-2.13 6.52-2.45 8.91c-.32 2.39-1.17 6.93-.95 7.38c.64 1.27 7.46.43 8.12-.66c.19-.31-.77-5.4-1.46-7.55c-.94-2.94-1.71-7.43-3.26-8.08z" fill="#367c2d" />
        <path d="M118.66 91.29c-.94.04-1.94 8.25-2.56 10.04c-.7 2.03-3.04 11.64-2.07 12.74c.97 1.1 4.68.23 6.06-.17c1.33-.38 2.48-1.02 2.8-1.73s-.44-6.44-1.36-10.44c-.94-4.05-1.39-10.51-2.87-10.44z" fill="#367c2d" />
        <path d="M31.47 111.25s2.59.98 11.46 1.53c8.87.55 13.23.5 13.23.5l20.26-2.96l4.6-7.28s-6.12-.23-9.37-.34c-3.25-.11-8.1-.13-8.32-.73c-.22-.61 5.47-4.74 7.07-5.56c1.6-.83 5.46-1.27 6.34-2.2c.88-.94 12-7.21 13.37-7.26c1.38-.06 5.68 2.59 6.5 2.31c.83-.28-2.86-10.04-3.35-11.87c-.04-.16-1.99-9.67-2.05-9.85c-.46-1.41-1.87-5.07-2.76-4.63c-.88.44-2.37 3.8-3.47 7.16s-1.76 5.13-2.31 5.95s-6.94 4.91-7.83 5.84c-.88.94-3.53 2.92-5.13 3.58c-1.6.66-3.14.66-4.3 1.71c-1.16 1.05-2.59 2.87-4.19 4.57c-1.6 1.71-4.85 5.63-5.92 6.59s-2.03 1.89-2.03 1.89s-7.73 2.19-10.33 3.45c-2.58 1.27-12.14 7.43-11.47 7.6z" fill="silver" />
        <path d="M76.52 106.03c-.72.06-1.73 5.46-2.09 6.66c-.2.68-1.87 5.33-1.42 6.11c.9 1.6 8.3 1.17 8.63.33c.32-.84-2.11-6.46-2.56-7.5c-.46-1.02-1.5-5.69-2.56-5.6z" fill="#367c2d" />
        <path d="M111.79 52.02c-.85.85-.88 2.2.06 2.97c.83.69 2.2.24 2.71-.38c.51-.62.45-1.97-.23-2.65s-2.03-.45-2.54.06z" fill="#603a1a" />
        <path d="M112.07 64.67c-.91 1-.61 2.49.23 3.04c.84.55 2.1.5 2.72-.26c.55-.68.61-2.04-.23-2.88c-.73-.73-2.13-.55-2.72.1z" opacity=".5" fill="#603a1a" />
        <path d="M86 32.06c-.26.83.26 1.77 1.05 1.91c.83.15 1.68-.09 1.91-.88c.23-.8-.06-1.8-1.2-2c-1.14-.2-1.63.52-1.76.97z" opacity=".6" fill="#603a1a" />
        <path d="M94.54 46.11s.74-2.72 1.28-2.81c.54-.09 1.62 2.92 1.62 2.92s2.69.09 2.78.51c.09.43-1.9 2.04-1.9 2.04s.74 2.52.43 2.84c-.31.31-2.78-1.28-2.78-1.28s-2.21 1.87-2.72 1.53c-.51-.34.43-3.15.43-3.15s-2.1-1.5-2.13-2.01c-.04-.51 2.99-.59 2.99-.59z" fill="#603a1a" />
        <path d="M33.54 38.62s.97-2.79 1.56-2.82c.58-.03 1.43 2.79 1.43 2.79s2.88.03 3.08.45c.25.54-1.85 2.37-1.85 2.37s.68 2.72.36 3.05c-.36.36-2.85-1.07-2.85-1.07s-2.56 1.78-3.11 1.3c-.48-.42.52-3.31.52-3.31s-2.4-1.75-2.27-2.24c.17-.68 3.13-.52 3.13-.52z" fill="#603a1a" />
        <path d="M11.86 46.11c-.6-.03-1.42.57-1.42 1.6c0 .76.73 1.39 1.36 1.39c.91 0 1.54-.69 1.51-1.48c-.04-1.03-.82-1.48-1.45-1.51z" opacity=".5" fill="#603a1a" />
        <path d="M18.47 61.03c.06 1.14.63 2.11 2.11 2.07s2.7-2.31 1.29-3.64c-1.41-1.33-3.48.04-3.4 1.57z" fill="#603a1a" />
        <path d="M8.65 74.98c.7.78 2.38.47 2.42-.9c.04-1.25-.59-1.84-1.76-1.68c-1.16.16-1.51 1.63-.66 2.58z" fill="#603a1a" />
        <path d="M45.91 92.85c-.59.2-1.32 2.48-2.01 4.84c-.44 1.49-1.72 5.96-1.41 6.18c.31.22 3.4.37 4.62-.38s2.11-1.4 2.27-1.84c.16-.44-1.24-4.32-1.78-5.74c-.42-1.07-1.07-3.28-1.69-3.06z" fill="#367c2d" />
        <path d="M35.53 20.08c-.91 1-.61 2.49.23 3.04c.84.55 2.1.5 2.72-.26c.55-.68.61-2.04-.23-2.88c-.73-.72-2.14-.54-2.72.1z" opacity=".5" fill="#603a1a" />
      </svg>
    );
  }

  if (element === 'W') {
    return (
      <svg viewBox="0 0 1024 1024" aria-hidden="true" style={{ width: '1.05em', height: '1.05em', display: 'block' }}>
        <path d="M512 512m-480 0a480 480 0 1 0 960 0a480 480 0 1 0-960 0Z" fill="#bedcfe" />
        <path d="M512 179.2c-96 102.4-262.4 236.8-262.4 384s115.2 262.4 262.4 262.4s262.4-115.2 262.4-262.4s-160-281.6-262.4-384z" fill="#78aff7" />
        <path d="M512 684.8c-57.6 0-102.4-44.8-102.4-108.8c0-57.6 64-102.4 102.4-147.2c38.4 44.8 102.4 89.6 102.4 147.2c0 57.6-44.8 108.8-102.4 108.8z" fill="#3d8af0" />
      </svg>
    );
  }

  if (element === 'A') {
    return (
      <svg viewBox="0 0 496.162 496.162" aria-hidden="true" style={{ width: '1.05em', height: '1.05em', display: 'block' }}>
        <path fill="#70e5f0" d="M248.077 0C111.072 0 .002 111.062.002 248.083c0 137.002 111.07 248.079 248.075 248.079c137.013 0 248.083-111.077 248.083-248.079C496.16 111.062 385.09 0 248.077 0z" />
        <g opacity=".5">
          <path fill="#f9f9f9" d="M404.775 55.776c-5.99-4.885-12.195-9.502-18.629-13.82c-26.372-17.696-56.315-30.473-88.532-36.998c-.987-.203-1.997-.345-2.991-.535C279.544 1.558 263.99 0 248.077 0c-19.884 0-39.193 2.402-57.723 6.824c-6.694 1.592-13.281 3.451-19.746 5.578c-28.032 9.211-53.844 23.276-76.475 41.213c-10.917 8.652-21.115 18.17-30.426 28.506c-19.379 21.521-35.009 46.469-45.949 73.801c10.458 18.847 29.378 32.675 52.406 35.602c20.603 2.616 40.203-4.055 54.739-16.679c10.718 11.216 25.193 18.981 41.787 21.093c14.498 1.844 28.513-.896 40.616-7.069c10.979 14.49 27.534 24.75 46.997 27.221c27.511 3.496 53.248-9.51 67.462-31.252c9.548 7.375 21.084 12.439 33.915 14.069c22.867 2.906 44.495-5.608 59.33-21.031c24.237-1.951 45.528-16.472 56.506-37.698C455.635 107.36 432.737 78.586 404.775 55.776z" />
        </g>
        <g opacity=".5">
          <path fill="#ffffff" d="M372.949 33.747c-5.661-3.306-11.43-6.449-17.359-9.304c-14.023-6.755-28.781-12.194-44.113-16.237c-.788-.211-1.576-.421-2.372-.62c-15.423-3.905-31.413-6.369-47.839-7.233C256.898.124 252.498 0 248.077 0c-11.805 0-23.395.88-34.756 2.472c-21.834 3.063-42.774 8.928-62.397 17.29c-.956.405-1.882.856-2.831 1.277c-8.683 3.825-17.091 8.141-25.224 12.899C95.48 49.989 71.465 71.126 52.087 96.079c-.704.906-1.438 1.794-2.135 2.712c.911.367 1.859.658 2.785.987c5.906 31.172 31.987 55.818 65.137 58.396c14.979 1.163 29.232-2.353 41.351-9.304c12.004 14.338 29.523 24.038 49.629 25.599c28.422 2.204 54.204-12.439 67.707-35.482c10.175 7.1 22.278 11.721 35.537 12.749c23.625 1.836 45.406-7.99 59.865-24.577c26.861-3.488 49.43-21.941 58.45-47.249C413.71 61.816 394.347 46.24 372.949 33.747z" />
        </g>
        <path fill="#f9f9f9" d="M248.077 0c-74.676 0-141.588 33.035-187.07 85.242c4.108-.383 8.117-1.078 12.011-2.081c12.554 23.021 36.967 38.643 65.037 38.643c18.736 0 35.789-7.016 48.833-18.487c13.036 11.472 30.097 18.487 48.833 18.487c32.117 0 59.375-20.491 69.627-49.085c12.271 9.031 27.373 14.433 43.784 14.433c23.877 0 45.054-11.354 58.595-28.904C364.579 21.919 308.899 0 248.077 0z" />
        <g fill="#f5f5f5">
          <path d="M336.204 290.501c-1.385-14.811-7.383-25.942-17.352-32.178c-8.76-5.478-19.991-6.763-33.111-3.768c-15.852 3.614-26.012 15.175-25.882 29.436c.107 13.663 9.739 24.749 23.969 27.587c3.779.75 7.375-1.438 8.24-4.758c.42-1.6.168-3.26-.719-4.683c-.964-1.538-2.609-2.646-4.499-3.015c-8.989-1.79-13.075-8.974-13.128-15.309c-.054-6.472 3.933-14.306 15.301-16.899c9.134-2.081 16.586-1.415 21.979 1.958c6.35 3.963 10.39 12.058 11.376 22.791c.704 7.528-2.027 13.45-8.576 18.621c-15.661 12.356-50.019 18.622-102.111 18.622c-80.3 0-179.19-15.21-203.978-19.241c1.17 4.59 2.494 9.119 3.917 13.603c32.515 5.194 122.14 18.308 198.094 18.308c7.123 0 14.039-.115 20.572-.345c45.49-1.591 76.612-8.76 92.51-21.299c14.809-11.691 19.315-21.591 18.237-33.258z" />
          <path d="M300.774 390.814c-15.623-14.421-57.218-21.728-123.609-21.728c-50.623 0-105.286 4.285-141.174 7.75c2.494 4.094 5.133 8.079 7.849 12.012c40.823-3.771 90.284-6.924 134.259-6.924c61.112 0 100.122 6.189 112.822 17.91c3.458 3.19 4.659 6.641 3.779 10.841c-1.652 7.888-5.263 13.625-10.175 16.15c-4.116 2.119-9.571 2.172-16.043.16c-9.693-3.007-9.571-10.313-9.311-12.478c.551-4.399 3.948-9.181 10.321-9.961c1.92-.229 3.665-1.201 4.781-2.663c1.018-1.323 1.446-2.93 1.216-4.536c-.505-3.458-3.848-5.914-7.742-5.433c-11.973 1.462-20.955 9.992-22.347 21.23c-1.454 11.782 5.83 21.957 18.553 25.912c4.628 1.438 9.066 2.165 13.205 2.165c.413 0 .826-.007 1.232-.022c4.644-.161 8.966-1.263 12.86-3.267c8.691-4.468 14.589-13.083 17.061-24.91c2.472-11.828-.068-19.302-6.846-25.546z" />
          <path d="M436.93 308.082c-1.561-16.869-8.354-29.523-19.646-36.584c-9.899-6.189-22.638-7.636-37.533-4.231c-17.864 4.078-29.324 17.092-29.187 33.157c.13 15.378 10.963 27.841 26.953 31.016c3.779.742 7.36-1.438 8.24-4.751c.42-1.599.168-3.252-.712-4.667c-.964-1.553-2.616-2.654-4.514-3.037c-11.032-2.188-16.035-10.986-16.104-18.736c-.062-7.903 4.781-17.466 18.598-20.618c10.895-2.486 19.868-1.675 26.402 2.41c7.643 4.789 12.509 14.444 13.687 27.205c.62 6.625-1.484 12.118-6.419 16.801c-21.261 20.151-90.697 22.867-155.818 22.867c-9.196 0-18.483-.054-27.764-.138c-82.526-.727-170.736-2.043-212.975-2.708c1.875 4.353 3.894 8.622 5.998 12.837c42.935.674 127.083 1.905 206.762 2.609c9.609.084 19.134.138 28.514.138c18.759 0 34.657-.237 48.604-.728c64.012-2.233 99.977-10.267 116.617-26.034c7.153-6.778 10.619-15.797 9.655-26.187z" />
        </g>
      </svg>
    );
  }

  if (element === 'F') {
    return (
      <svg viewBox="0 0 128 128" aria-hidden="true" style={{ width: '1.05em', height: '1.05em', display: 'block' }}>
        <defs>
          <radialGradient id="card-fire-grad-outer" cx="68.884" cy="124.296" r="70.587" gradientTransform="matrix(-1 -.00434 -.00713 1.6408 131.986 -79.345)" gradientUnits="userSpaceOnUse">
            <stop offset=".314" stopColor="#ff9800" />
            <stop offset=".662" stopColor="#ff6d00" />
            <stop offset=".972" stopColor="#f44336" />
          </radialGradient>
          <radialGradient id="card-fire-grad-inner" cx="64.921" cy="54.062" r="73.86" gradientTransform="matrix(-.0101 .9999 .7525 .0076 26.154 -11.267)" gradientUnits="userSpaceOnUse">
            <stop offset=".214" stopColor="#fff176" />
            <stop offset=".328" stopColor="#fff27d" />
            <stop offset=".487" stopColor="#fff48f" />
            <stop offset=".672" stopColor="#fff7ad" />
            <stop offset=".793" stopColor="#fff9c4" />
            <stop offset=".822" stopColor="#fff8bd" stopOpacity=".804" />
            <stop offset=".863" stopColor="#fff6ab" stopOpacity=".529" />
            <stop offset=".91" stopColor="#fff38d" stopOpacity=".209" />
            <stop offset=".941" stopColor="#fff176" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M35.56 40.73c-.57 6.08-.97 16.84 2.62 21.42c0 0-1.69-11.82 13.46-26.65c6.1-5.97 7.51-14.09 5.38-20.18c-1.21-3.45-3.42-6.3-5.34-8.29c-1.12-1.17-.26-3.1 1.37-3.03c9.86.44 25.84 3.18 32.63 20.22c2.98 7.48 3.2 15.21 1.78 23.07c-.9 5.02-4.1 16.18 3.2 17.55c5.21.98 7.73-3.16 8.86-6.14c.47-1.24 2.1-1.55 2.98-.56c8.8 10.01 9.55 21.8 7.73 31.95c-3.52 19.62-23.39 33.9-43.13 33.9c-24.66 0-44.29-14.11-49.38-39.65c-2.05-10.31-1.01-30.71 14.89-45.11c1.18-1.08 3.11-.12 2.95 1.5z" fill="url(#card-fire-grad-outer)" />
        <path d="M76.11 77.42c-9.09-11.7-5.02-25.05-2.79-30.37c.3-.7-.5-1.36-1.13-.93c-3.91 2.66-11.92 8.92-15.65 17.73c-5.05 11.91-4.69 17.74-1.7 24.86c1.8 4.29-.29 5.2-1.34 5.36c-1.02.16-1.96-.52-2.71-1.23a16.09 16.09 0 0 1-4.44-7.6c-.16-.62-.97-.79-1.34-.28c-2.8 3.87-4.25 10.08-4.32 14.47C40.47 113 51.68 124 65.24 124c17.09 0 29.54-18.9 19.72-34.7c-2.85-4.6-5.53-7.61-8.85-11.88z" fill="url(#card-fire-grad-inner)" />
      </svg>
    );
  }

  return fallback;
}

function isLightVisualColor(color: string): boolean {
  const normalized = color.trim();
  const hex = normalized.match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (hex) {
    const raw = hex[1];
    const expanded = raw.length === 3
      ? raw.split('').map((ch) => `${ch}${ch}`).join('')
      : raw;
    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);
    const luminance = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
    return luminance >= 170;
  }
  const rgb = normalized.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(',').map((part) => Number(part.trim())).filter((value) => Number.isFinite(value));
    if (parts.length >= 3) {
      const luminance = (0.2126 * parts[0]) + (0.7152 * parts[1]) + (0.0722 * parts[2]);
      return luminance >= 170;
    }
  }
  return false;
}

interface CardProps {
  card: CardType | null;
  faceDown?: boolean;
  isFoundation?: boolean;
  handMinimalOverlay?: {
    title: string;
    cost: string | number;
  };
  foundationOverlay?: {
    name: string;
    hp?: number;
    hpMax?: number;
    armor?: number;
    superArmor?: number;
    minimalVitalsOnly?: boolean;
    accentColor?: string;
    rankDisplay?: string;
    comboCount?: number;
    apSegments?: Element[];
    apCount?: number;
    shimmerElement?: Element;
    autoSizeTitle?: boolean;
  };
  size?: { width: number; height: number };
  canPlay?: boolean;
  hasExpansion?: boolean;
  isExpansionOpen?: boolean;
  onToggleExpansion?: () => void;
  onClick?: () => void;
  isSelected?: boolean;
  isGuidanceTarget?: boolean;
  isDimmed?: boolean;
  borderColorOverride?: string;
  boxShadowOverride?: string;
  frameClassName?: string;
  isDragging?: boolean;
  isAnyCardDragging?: boolean;
  onDragStart?: (card: CardType, clientX: number, clientY: number, rect: DOMRect) => void;
  showGraphics: boolean;
  suitDisplayOverride?: string;
  suitFontSizeOverride?: number;
  orimDefinitions?: OrimDefinition[];
  maskValue?: boolean;
  disableTilt?: boolean;
  disableHoverLift?: boolean;
  disableHoverGlow?: boolean;
  hideElements?: boolean;
  rpgSubtitleRarityOnly?: boolean;
  ripTrigger?: number;
  disableLegacyShine?: boolean;
  watercolorOnly?: boolean;
  disableTemplateArt?: boolean;
  showFoundationActorSecretHolo?: boolean;
  canTap?: boolean;
  disableAnimation?: boolean;
}

export const Card = memo(function Card({
  card,
  faceDown = false,
  isFoundation = false,
  handMinimalOverlay,
  foundationOverlay,
  size,
  canPlay = false,
  hasExpansion = false,
  isExpansionOpen = false,
  onToggleExpansion,
  onClick,
  isSelected = false,
  isGuidanceTarget = false,
  isDimmed = false,
  borderColorOverride,
  boxShadowOverride,
  frameClassName,
  isDragging = false,
  isAnyCardDragging = false,
  onDragStart,
  showGraphics,
  suitDisplayOverride,
  suitFontSizeOverride,
  orimDefinitions,
  maskValue = false,
  disableTilt = false,
  disableHoverLift = false,
  disableHoverGlow = false,
  ripTrigger = 0,
  disableLegacyShine = false,
  watercolorOnly = false,
  disableTemplateArt = false,
  showFoundationActorSecretHolo = false,
  canTap = false,
  disableAnimation = false,
}: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [shimmer, setShimmer] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showRipOverlay, setShowRipOverlay] = useState(false);
  const [hideDomCard, setHideDomCard] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const handledRipTriggerRef = useRef(0);
  const foundationAutoRafRef = useRef<number | null>(null);
  const foundationAutoWasActiveRef = useRef(false);
  const foundationAutoLastUpdateRef = useRef(0);
  const foundationShimmerTimerRef = useRef<number | null>(null);
  const foundationComboInitializedRef = useRef(false);
  const foundationPrevComboRef = useRef<number>(0);
  const [foundationShimmerBurst, setFoundationShimmerBurst] = useState(0);
  const [foundationShimmerActive, setFoundationShimmerActive] = useState(false);
  const { isImmersive } = useImmersiveBattle();

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!onDragStart || !card || faceDown) return;
    if (!cardRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as unknown as HTMLElement | null;
    target?.setPointerCapture?.(e.pointerId);
    const rect = cardRef.current.getBoundingClientRect();
    onDragStart(card, e.clientX, e.clientY, rect);
  }, [onDragStart, card, faceDown]);
  const suitColor = card ? SUIT_COLORS[card.suit] : '#f0f0f0';
  const elementKey = card
    ? (card.element ?? (card.suit ? SUIT_TO_ELEMENT[card.suit] : undefined))
    : undefined;
  const isWaterElement = elementKey === 'W' || card?.suit === '💧';
  const elementChipStyles: Record<Element, {
    border: string;
    background: string;
    color: string;
    textShadow: string;
    boxShadow: string;
  }> = {
    W: {
      border: isImmersive ? '1px solid white' : '1px solid rgba(171, 215, 255, 0.7)',
      background: isImmersive ? 'black' : 'linear-gradient(180deg, rgba(222, 241, 255, 0.9) 0%, rgba(147, 191, 255, 0.78) 100%)',
      color: isImmersive ? 'white' : '#1a4ca8',
      textShadow: isImmersive ? 'none' : '0 1px 0 rgba(255,255,255,0.78), 0 0 7px rgba(175, 217, 255, 0.95)',
      boxShadow: isImmersive ? 'none' : '0 0 9px rgba(122, 185, 255, 0.4), inset 0 0 4px rgba(255,255,255,0.42)',
    },
    E: {
      border: '1px solid rgba(224, 188, 126, 0.68)',
      background: 'linear-gradient(180deg, rgba(247, 226, 191, 0.9) 0%, rgba(201, 151, 89, 0.8) 100%)',
      color: '#6d3d15',
      textShadow: '0 1px 0 rgba(255,249,238,0.72), 0 0 7px rgba(228, 186, 130, 0.78)',
      boxShadow: '0 0 8px rgba(190, 132, 69, 0.36), inset 0 0 4px rgba(255,243,225,0.4)',
    },
    A: {
      border: '1px solid rgba(206, 242, 255, 0.7)',
      background: 'linear-gradient(180deg, rgba(239, 252, 255, 0.92) 0%, rgba(176, 226, 244, 0.8) 100%)',
      color: '#2e6f88',
      textShadow: '0 1px 0 rgba(255,255,255,0.82), 0 0 7px rgba(194, 241, 255, 0.95)',
      boxShadow: '0 0 8px rgba(158, 225, 247, 0.38), inset 0 0 4px rgba(255,255,255,0.45)',
    },
    F: {
      border: '1px solid rgba(255, 178, 135, 0.72)',
      background: 'linear-gradient(180deg, rgba(255, 223, 197, 0.92) 0%, rgba(255, 133, 75, 0.82) 100%)',
      color: '#8d2408',
      textShadow: '0 1px 0 rgba(255,244,236,0.78), 0 0 8px rgba(255, 151, 97, 0.95)',
      boxShadow: '0 0 9px rgba(255, 108, 57, 0.4), inset 0 0 4px rgba(255,225,208,0.42)',
    },
    L: {
      border: '1px solid rgba(255, 245, 190, 0.72)',
      background: 'linear-gradient(180deg, rgba(255, 252, 236, 0.92) 0%, rgba(247, 231, 170, 0.8) 100%)',
      color: '#c9a63a',
      textShadow: '0 1px 0 rgba(255,255,255,0.75), 0 0 8px rgba(255, 245, 196, 0.95)',
      boxShadow: '0 0 9px rgba(255, 243, 181, 0.44), inset 0 0 4px rgba(255,255,255,0.45)',
    },
    D: {
      border: '1px solid rgba(172, 161, 217, 0.68)',
      background: 'linear-gradient(180deg, rgba(87, 73, 129, 0.9) 0%, rgba(34, 26, 56, 0.82) 100%)',
      color: '#e7dfff',
      textShadow: '0 1px 0 rgba(33, 24, 56, 0.88), 0 0 8px rgba(177, 162, 232, 0.9)',
      boxShadow: '0 0 9px rgba(94, 72, 163, 0.38), inset 0 0 4px rgba(181,169,233,0.24)',
    },
    N: {
      border: '1px solid rgba(210, 210, 210, 0.66)',
      background: 'linear-gradient(180deg, rgba(246, 246, 246, 0.9) 0%, rgba(186, 186, 186, 0.8) 100%)',
      color: '#4f4f4f',
      textShadow: '0 1px 0 rgba(255,255,255,0.72), 0 0 6px rgba(214,214,214,0.78)',
      boxShadow: '0 0 8px rgba(146,146,146,0.34), inset 0 0 4px rgba(255,255,255,0.36)',
    },
  };
  const elementChipStyle = elementChipStyles[(elementKey ?? 'N') as Element] ?? elementChipStyles.N;
  const suitDisplay = card
    ? (suitDisplayOverride
      ?? (isWaterElement ? 'W' : getSuitDisplay(card.suit, showGraphics)))
    : '';
  const suitDisplayContent = renderElementIndicator(elementKey, suitDisplay);
  const globalScale = useCardScale();
  const frameSize = size ?? {
    width: CARD_SIZE.width * globalScale,
    height: CARD_SIZE.height * globalScale,
  };
  const orimDisplay = card?.orimDisplay ?? [];
  const hasOrimSlots = orimDisplay.length > 0 || !!card?.orimSlots?.length;
  const orimSlots = card?.orimSlots ?? [];
  const orimSlotSize = Math.max(6, Math.round(frameSize.width * 0.32));
  const isWildFoundation = isFoundation && card && card.rank === WILD_SENTINEL_RANK;
  const cooldownValue = card?.cooldown ?? 0;
  const cooldownMax = card?.maxCooldown ?? 0;
  const cooldownProgress = cooldownMax > 0 ? Math.max(0, Math.min(1, (cooldownMax - cooldownValue) / cooldownMax)) : 0;
  const rpgLevel = useMemo(() => {
    if (!card) return 0;
    const match = card.id.match(/-lvl-(\d+)-/);
    const parsed = match ? Number(match[1]) : NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  }, [card]);
  const rpgCardMeta = useMemo(() => {
    if (!card) return null;
    const hasRpgData = !!card.rpgAbilityId || !!card.sourceDeckCardId || card.rpgApCost !== undefined;
    if (!card.id.startsWith('rpg-') && !hasRpgData) return null;
    if (hasRpgData && !card.id.startsWith('rpg-')) {
      const normalizedAbilityId = String(card.rpgAbilityId ?? '')
        .replace(/[_-]+/g, ' ')
        .trim();
      const displayName = card.name && card.name.trim().toLowerCase() !== 'ability'
        ? card.name
        : (normalizedAbilityId || 'Ability');
      const title = displayName.toUpperCase();
      const ap = Math.max(0, Number(card.rpgApCost ?? 0));
      const cooldown = Math.max(0, Number(card.maxCooldown ?? 0));
      return {
        title,
        subtitle: `AP ${ap}${cooldown > 0 ? `  CD ${cooldown}s` : ''}`,
        titleColor: '#9de3ff',
        subtitleColor: '#d4f3ff',
      };
    }
    if (card.id.startsWith('rpg-scratch-')) {
      return {
        title: 'SCRATCH',
        subtitle: `PWR ${card.rank ?? 0}${rpgLevel > 0 ? `  LV ${rpgLevel}` : ''}`,
        titleColor: '#f7d24b',
        subtitleColor: '#ffb3b3',
      };
    }
    if (card.id.startsWith('rpg-bite-')) {
      const hasViceGrip = rpgLevel >= 3 || card.id.startsWith('rpg-vice-bite-');
      const hasBleed = rpgLevel >= 5;
      return {
        title: 'BITE',
        subtitle: hasBleed
          ? `PWR ${card.rank ?? 0}  BLEED 20%`
          : (hasViceGrip ? `PWR ${card.rank ?? 0}  VICE GRIP` : `PWR ${card.rank ?? 0}`),
        titleColor: '#f0f0f0',
        subtitleColor: '#ff9d9d',
      };
    }
    if (card.id.startsWith('rpg-vice-bite-')) {
      return { title: 'BITE', subtitle: `PWR ${card.rank ?? 0}  VICE GRIP`, titleColor: '#ffd7d7', subtitleColor: '#ff6b6b' };
    }
    if (card.id.startsWith('rpg-cloud-sight-')) {
      return { title: 'CLOUD SIGHT', subtitle: 'SELF 10S', titleColor: '#9de3ff', subtitleColor: '#d4f3ff' };
    }
    if (card.id.startsWith('rpg-peck-')) {
      return {
        title: 'PECK',
        subtitle: `PWR ${card.rank ?? 1}${rpgLevel > 0 ? `  LV ${rpgLevel}` : ''}`,
        titleColor: '#d4f3ff',
        subtitleColor: '#ffb3b3',
      };
    }
    if (card.id.startsWith('rpg-blinding-peck-')) {
      return { title: 'BLINDING PECK', subtitle: `PWR ${card.rank ?? 4}`, titleColor: '#eaf8ff', subtitleColor: '#ff9d9d' };
    }
    return null;
  }, [card, rpgLevel]);
  const keruArchetypeMeta = useMemo(() => {
    if (!card || !card.id.startsWith('keru-archetype-')) return null;
    const title = card.id
      .replace('keru-archetype-', '')
      .replace(/[-_]+/g, ' ')
      .trim()
      .toUpperCase();
    return {
      title: title || 'ASPECT',
      subtitle: 'ASPECT',
      titleColor: '#d7f9ff',
      subtitleColor: '#7fdbca',
    };
  }, [card]);
  const cardTitleMeta = keruArchetypeMeta ?? rpgCardMeta;
  const keruAspectProfile = useMemo(() => {
    if (!card || !card.id.startsWith('keru-archetype-')) return null;
    const key = card.id.replace('keru-archetype-', '').toLowerCase();
    const aspectOrims = (orimDefinitions && orimDefinitions.length > 0)
      ? orimDefinitions
      : ORIM_DEFINITIONS;
    const match = aspectOrims.find((entry) => {
      if (!entry.isAspect) return false;
      const entryKey = String(entry.aspectProfile?.key ?? '').toLowerCase();
      const id = String(entry.id ?? '').toLowerCase();
      const name = String(entry.name ?? '').toLowerCase();
      return id === key || entryKey === key || name === key;
    }) ?? null;
    if (!match || !match.aspectProfile) return null;
    const attributes = (match.aspectProfile.attributes ?? []).map((attr) => {
      if (typeof attr === 'string') return attr;
      const stat = String(attr.stat ?? '').trim();
      const op = String(attr.op ?? '').trim();
      const value = String(attr.value ?? '').trim();
      if (!stat && !value) return '';
      const safeOp = op || '+';
      return `${stat}${safeOp}${value}`.trim();
    }).filter(Boolean);
    return {
      archetype: match.aspectProfile.archetype ?? '',
      rarity: match.aspectProfile.rarity ?? 'common',
      name: match.name ?? '',
      description: match.description ?? '',
      attributes,
    };
  }, [card, orimDefinitions]);
  const foundationActorProfile = useMemo(() => {
    if (!card || !isFoundation) return null;
    if (!showFoundationActorSecretHolo) return null;
    const isActorFoundationCard = card.id.startsWith('actor-')
      || card.id.startsWith('combatlab-foundation-')
      || card.id.startsWith('lab-foundation-');
    if (!isActorFoundationCard) return null;
    const normalizedName = (card.name ?? '').trim();
    const fallbackNameSeed = card.id
      .replace(/^actor-/, '')
      .replace(/^combatlab-foundation-/, '')
      .replace(/^lab-foundation-/, '')
      .split('-')[0];
    const fallbackName = fallbackNameSeed
      ? `${fallbackNameSeed[0]?.toUpperCase() ?? ''}${fallbackNameSeed.slice(1)}`
      : 'Actor';
    const tags = (card.tags ?? []).filter(Boolean);
    const rawRole = (tags[0] ?? '').trim();
    const normalizedRole = rawRole.replace(/\s+/g, ' ').trim().toLowerCase();
    const isLabFoundationCard = card.id.startsWith('combatlab-foundation-') || card.id.startsWith('lab-foundation-');
    const role = isLabFoundationCard || normalizedRole === 'party member' ? '' : rawRole;
    return {
      name: normalizedName || fallbackName,
      role,
      description: card.description ?? '',
      attributes: (role ? tags.slice(1, 4) : tags.slice(0, 3)),
    };
  }, [card, isFoundation, showFoundationActorSecretHolo]);
  const keruAbilityProfile = useMemo(() => {
    if (!card || !card.id.startsWith('ability-')) return null;
    const key = card.id.replace('ability-', '').toLowerCase();
    const abilities = (abilitiesJson as { abilities?: Array<{
      id?: string;
      aspectId?: string;
      label?: string;
      description?: string;
      damage?: string;
      cardId?: string;
      abilityType?: string;
      tags?: string[];
      effects?: Array<{
        type: string;
        value: number;
        target: string;
        charges?: number;
        duration?: number;
      }>;
    }> }).abilities ?? [];
    const match = abilities.find((entry) => {
      const cardIdKey = String(entry.cardId ?? '').replace('ability-', '').toLowerCase();
      const id = String(entry.id ?? '').toLowerCase();
      return id === key || cardIdKey === key;
    }) ?? null;
    if (!match) return null;
    return {
      label: match.label ?? '',
      description: match.description ?? '',
      damage: match.damage ?? '0',
      tags: match.tags ?? [],
      effects: match.effects ?? [],
    };
  }, [card]);
  const resolvedRpgAbility = useMemo(() => {
    if (!card) return null;
    const abilityRows = (abilitiesJson as { abilities?: Array<{
      id?: string;
      cardId?: string;
      label?: string;
      description?: string;
      rarity?: OrimRarity;
      effects?: Array<{
        type: string;
        value: number;
        target: string;
        duration?: number;
        charges?: number;
        element?: Element;
        elementalValue?: number;
      }>;
    }> }).abilities ?? [];
    if (abilityRows.length === 0) return null;
    const candidates = [
      normalizeLookupKey(card.rpgAbilityId),
      normalizeLookupKey(card.sourceDeckCardId),
      normalizeLookupKey(card.name),
      normalizeLookupKey(card.id.replace(/^deckhand-[^-]+-/, '')),
      normalizeLookupKey(card.id.replace(/^ability-/, '')),
    ].filter(Boolean);
    if (candidates.length === 0) return null;
    return abilityRows.find((entry) => {
      const keys = [
        normalizeLookupKey(entry.id),
        normalizeLookupKey(entry.cardId),
        normalizeLookupKey(entry.label),
      ];
      return keys.some((key) => key.length > 0 && candidates.includes(key));
    }) ?? null;
  }, [card]);
  const renderedRpgDescription = useMemo(() => {
    if (!card) return '';
    const hasRpgCardData = !!card.rpgAbilityId || !!card.sourceDeckCardId || card.rpgApCost !== undefined;
    if (!hasRpgCardData) return '';
    const template = String(card.description ?? resolvedRpgAbility?.description ?? '').trim();
    if (!template) return '';
    const primaryEffect = resolvedRpgAbility?.effects?.[0];
    const actorSeed = card.sourceActorId?.split('-')[0] ?? card.name;
    const selfName = toDisplayName(actorSeed) || 'Self';
    return template.replace(/\{([^}]+)\}/g, (match, token) => {
      const key = String(token).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      if (key === 'value') return String(primaryEffect?.value ?? card.rank ?? 0);
      if (key === 'duration') return String(primaryEffect?.duration ?? 0);
      if (key === 'charges') return String(primaryEffect?.charges ?? 0);
      if (key === 'target') return String(primaryEffect?.target ?? 'target').replace(/_/g, ' ');
      if (key === 'elem_value' || key === 'elemental_value') {
        const elementalValue = Math.max(0, Number(primaryEffect?.elementalValue ?? 0));
        const elementalLabel = getElementLabel(primaryEffect?.element ?? card.element);
        return `${elementalValue} ${elementalLabel}`;
      }
      if (key === 'self' || key === 'actor' || key === 'owner') return selfName;
      // Keep unknown tokens visible so malformed templates are obvious in-game.
      return match;
    });
  }, [card, resolvedRpgAbility]);
  const isUpgradedRpgCard = !!card && (
    card.id.startsWith('rpg-vice-bite-')
    || card.id.startsWith('rpg-blinding-peck-')
    || (rpgLevel >= 3 && (
      card.id.startsWith('rpg-bite-')
      || card.id.startsWith('rpg-peck-')
      || card.id.startsWith('rpg-scratch-')
    ))
  );
  const upgradedSheenOffsetSec = useMemo(() => {
    if (!card) return 0;
    let hash = 0;
    for (let i = 0; i < card.id.length; i += 1) {
      hash = ((hash << 5) - hash + card.id.charCodeAt(i)) | 0;
    }
    return (Math.abs(hash) % 260) / 100;
  }, [card]);

  const getBorderColor = () => {
    if (borderColorOverride !== undefined) return borderColorOverride;
    if (isImmersive) return '#ffffff';
    if (isSelected) return '#e6b31e'; // gold
    if (faceDown) return 'rgba(156, 181, 198, 0.34)';
    if (isDimmed) return 'rgba(134, 146, 156, 0.65)';
    const baseColor = neonMode ? neonColor : suitColor;
    return baseColor;
  };

  const getBoxShadow = () => {
    if (boxShadowOverride !== undefined) return boxShadowOverride;
    if (isImmersive) return '0 0 15px rgba(255, 255, 255, 0.25)';
    if (isDimmed) return 'none';
    if (isSelected) return `0 0 20px #e6b31e, inset 0 0 20px rgba(230, 179, 30, 0.13)`;
    if (isFoundation) {
      const foundationGlow = neonMode ? neonColor : suitColor;
      return `0 0 18px ${foundationGlow}66, inset 0 0 18px ${foundationGlow}11`;
    }
    if (faceDown) return '0 8px 20px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(193, 208, 218, 0.18)';
    if (neonMode) {
      const outerSize = elementKey === 'A' ? 28 : 18;
      const insetSize = elementKey === 'A' ? 20 : 14;
      const glowOpacity = elementKey === 'A' ? 'ee' : 'cc';
      return `0 0 ${outerSize}px ${neonColor}${glowOpacity}, inset 0 0 ${insetSize}px ${neonColor}55`;
    }
    return disableHoverGlow ? undefined : `0 0 10px ${suitColor}33`;
  };
const getWatercolorColorFilter = () => {
  if (!SHOW_WATERCOLOR_FILTERS) return 'none';
  const ds = 'drop-shadow(0 0 0 rgba(255,255,255,1))';
  const swatch = ELEMENT_WATERCOLOR_SWATCHES[(elementKey ?? 'N') as Element] ?? ELEMENT_WATERCOLOR_SWATCHES.N;
  return `url(#${CARD_WATERCOLOR_FILTER_ID}) ${ds} ${swatch.filterTail}`;
};
  const getWatercolorBaseColor = () => {
    const swatch = ELEMENT_WATERCOLOR_SWATCHES[(elementKey ?? 'N') as Element] ?? ELEMENT_WATERCOLOR_SWATCHES.N;
    return swatch.baseColor;
  };
  const expansionGlyph = showGraphics ? '+' : 'EXP';

  const neonMode = FORCE_NEON_CARD_STYLE;
  const neonColor = getNeonElementColor(elementKey as Element);
  const showElementArtOverlays = !watercolorOnly && !neonMode && !handMinimalOverlay && !disableTemplateArt;
  const showWaterDepthOverlay = showElementArtOverlays && isWaterElement && !faceDown && !isAnyCardDragging;
  const showWaterArtOverlay = showElementArtOverlays && showGraphics && isWaterElement && !faceDown && !isAnyCardDragging;
  const showLightArtOverlay = showElementArtOverlays && showGraphics && elementKey === 'L' && !faceDown && !isAnyCardDragging;
  const showFireArtOverlay = showElementArtOverlays && showGraphics && elementKey === 'F' && !faceDown && !isAnyCardDragging;
  const showAirArtOverlay = showElementArtOverlays && showGraphics && elementKey === 'A' && !faceDown && !isAnyCardDragging;
  const showDarkArtOverlay = showElementArtOverlays && showGraphics && elementKey === 'D' && !faceDown && !isAnyCardDragging;
  const textColorBase = neonMode ? neonColor : (watercolorOnly ? 'rgba(226, 233, 238, 0.95)' : suitColor);
  const dimmedTextColor = (neonMode || !watercolorOnly) ? `${textColorBase}44` : textColorBase;
  const topOverlayZ = showFoundationActorSecretHolo ? 3 : 1;
  useEffect(() => {
    if (!showLightArtOverlay || !isHovered) return;
    const interval = setInterval(() => {
      setShimmer((prev) => (prev + 0.05) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, [showLightArtOverlay, isHovered]);

  const foundationComboCount = Math.max(0, Number(foundationOverlay?.comboCount ?? 0));
  useEffect(() => {
    if (!isFoundation || handMinimalOverlay || !foundationOverlay) {
      foundationComboInitializedRef.current = false;
      foundationPrevComboRef.current = 0;
      setFoundationShimmerActive(false);
      if (foundationShimmerTimerRef.current !== null) {
        window.clearTimeout(foundationShimmerTimerRef.current);
        foundationShimmerTimerRef.current = null;
      }
      return;
    }
    const triggerFoundationShimmer = () => {
      setFoundationShimmerBurst((prev) => prev + 1);
      setFoundationShimmerActive(true);
      if (foundationShimmerTimerRef.current !== null) {
        window.clearTimeout(foundationShimmerTimerRef.current);
      }
      foundationShimmerTimerRef.current = window.setTimeout(() => {
        setFoundationShimmerActive(false);
        foundationShimmerTimerRef.current = null;
      }, 700);
    };
    if (!foundationComboInitializedRef.current) {
      foundationComboInitializedRef.current = true;
      foundationPrevComboRef.current = foundationComboCount;
      // Foundation top card remounts on each play; trigger shimmer once on mount when combo exists.
      if (foundationComboCount > 0) {
        triggerFoundationShimmer();
      }
      return;
    }
    if (foundationComboCount > foundationPrevComboRef.current) {
      triggerFoundationShimmer();
    }
    foundationPrevComboRef.current = foundationComboCount;
  }, [isFoundation, handMinimalOverlay, foundationOverlay, foundationComboCount]);

  useEffect(() => {
    return () => {
      if (foundationShimmerTimerRef.current !== null) {
        window.clearTimeout(foundationShimmerTimerRef.current);
        foundationShimmerTimerRef.current = null;
      }
    };
  }, []);

  const waterFish = useMemo(() => {
    if (!showWaterArtOverlay || !card) return [];
    const seedBase = card.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    let seed = seedBase || 1;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: 25 }).map((_, index) => ({
      id: `${card.id}-fish-${index}`,
      top: 25 + rand() * 45,
      left: 15 + rand() * 70,
      width: 2 + rand() * 8,
      height: 1 + rand() * 3,
      rotate: rand() * 30 - 15,
      opacity: 0.6 + rand() * 0.2,
    }));
  }, [showWaterArtOverlay, card]);

  const darkJaggedPath = useMemo(() => {
    if (!showDarkArtOverlay || !card) return '';
    let seed = card.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 1;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const points: string[] = [];
    const steps = 32;
    const variance = 1.3;
    for (let i = 0; i <= steps; i++) points.push(`${(i / steps) * 100}% ${rand() * variance}%`);
    for (let i = 1; i <= steps; i++) points.push(`${100 - (rand() * variance)}% ${(i / steps) * 100}%`);
    for (let i = 1; i <= steps; i++) points.push(`${100 - (i / steps) * 100}% ${100 - (rand() * variance)}%`);
    for (let i = 1; i < steps; i++) points.push(`${rand() * variance}% ${100 - (i / steps) * 100}%`);
    return `polygon(${points.join(', ')})`;
  }, [showDarkArtOverlay, card]);
  const shaderOverlayStyle = useMemo<CSSProperties>(() => ({
    clipPath: darkJaggedPath || 'inset(0)',
    background: `
      radial-gradient(circle at 25% 20%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 45%),
      radial-gradient(circle at 78% 46%, rgba(173, 154, 255, 0.42) 0%, rgba(173, 154, 255, 0) 55%),
      linear-gradient(180deg, rgba(4,6,12,0.95), rgba(4,6,12,0.65))
    `,
    mixBlendMode: 'screen',
    opacity: 0.85,
    filter: 'saturate(1.2)',
  }), [darkJaggedPath]);

  const darkStars = useMemo(() => {
    if (!showDarkArtOverlay || !card) return [];
    let seed = card.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 1;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    return Array.from({ length: 140 }).map((_, index) => ({
      id: `${card.id}-star-${index}`,
      left: `${rand() * 100}%`,
      top: `${rand() * 100}%`,
      size: rand() * 1.5 + 0.5,
      opacity: rand() * 0.7 + 0.3,
      delay: `${rand() * 5}s`,
      type: rand() > 0.95 ? 'sparkle' : rand() > 0.82 ? 'glow' : 'dot',
      rotate: rand() * 30 - 15,
      duration: 2 + rand() * 4,
    }));
  }, [showDarkArtOverlay, card]);

  const isKeruAspectCard = !!keruAspectProfile;
  const { styles: holoStyles, handlePointerMove, handlePointerLeave, registerElement } = useHoloInteraction();
  const resolvedRpgRarity = resolvedRpgAbility?.rarity;
  const rarity = (keruAspectProfile?.rarity || card?.rarity || resolvedRpgRarity || 'common').toLowerCase() as OrimRarity;
  const isShiny = rarity !== 'common' || isUpgradedRpgCard;
  const effectiveRarity = rarity === 'common' && isUpgradedRpgCard ? 'rare' : rarity;
  const showSecretActorHolo = showFoundationActorSecretHolo && !!foundationActorProfile && !faceDown && !hideDomCard;
  const showLegacyShine = isShiny && !faceDown && !hideDomCard && !disableLegacyShine && !showSecretActorHolo;
  const shouldAutoFoundationOrbit = showSecretActorHolo && !isHovered && !disableTilt && !isDragging && !isAnyCardDragging;
  const registerRootElement = useCallback((element: HTMLDivElement | null) => {
    rootRef.current = element;
    registerElement(element);
  }, [registerElement]);
  const foundationAutoProfile = useMemo(() => {
    const source = card?.id ?? 'foundation-auto';
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
    }
    const next = () => {
      hash = (hash * 1664525 + 1013904223) | 0;
      return ((hash >>> 0) % 10000) / 10000;
    };
    return {
      phase: next() * Math.PI * 2,
      orbitX: 17 + next() * 12,
      orbitY: 16 + next() * 11,
      wobble: 2 + next() * 5,
      noise: 1.3 + next() * 2.4,
      speed: 0.00042 + next() * 0.00034,
      breathe: 0.00055 + next() * 0.0005,
    };
  }, [card?.id]);

  useEffect(() => {
    if (!shouldAutoFoundationOrbit) {
      if (foundationAutoRafRef.current !== null) {
        cancelAnimationFrame(foundationAutoRafRef.current);
        foundationAutoRafRef.current = null;
      }
      if (foundationAutoWasActiveRef.current) {
        foundationAutoWasActiveRef.current = false;
        handlePointerLeave();
      }
      return;
    }

    foundationAutoWasActiveRef.current = true;
    foundationAutoLastUpdateRef.current = 0;
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const start = performance.now();
    let mounted = true;
    const animate = (now: number) => {
      if (!mounted) return;
      const node = rootRef.current;
      if (!node) {
        foundationAutoRafRef.current = requestAnimationFrame(animate);
        return;
      }
      if (now - foundationAutoLastUpdateRef.current < 42) {
        foundationAutoRafRef.current = requestAnimationFrame(animate);
        return;
      }
      foundationAutoLastUpdateRef.current = now;
      const elapsed = now - start;
      const theta = (elapsed * foundationAutoProfile.speed) + foundationAutoProfile.phase;
      const orbitX = foundationAutoProfile.orbitX
        + Math.sin((elapsed * foundationAutoProfile.breathe) + foundationAutoProfile.phase) * foundationAutoProfile.wobble;
      const orbitY = foundationAutoProfile.orbitY
        + Math.cos((elapsed * foundationAutoProfile.breathe * 0.92) + foundationAutoProfile.phase * 0.8) * foundationAutoProfile.wobble;
      const px = clamp(
        50
          + Math.cos(theta) * orbitX
          + Math.sin(theta * 1.7 + foundationAutoProfile.phase * 0.6) * foundationAutoProfile.noise,
        8,
        92,
      );
      const py = clamp(
        50
          + Math.sin(theta) * orbitY
          + Math.cos(theta * 1.45 + foundationAutoProfile.phase * 0.33) * foundationAutoProfile.noise,
        8,
        92,
      );
      const rx = (py - 50) / 2;
      const ry = (50 - px) / 2;
      const hyp = Math.sqrt(((py - 50) ** 2) + ((px - 50) ** 2)) / 50;
      const x = (px / 100) * frameSize.width;
      const y = (py / 100) * frameSize.height;
      const tiltX = -(x - frameSize.width / 2) / 20;
      const tiltY = -(y - frameSize.height / 2) / 20;
      node.style.setProperty('--mx', `${px}%`);
      node.style.setProperty('--my', `${py}%`);
      node.style.setProperty('--rx', `${rx}deg`);
      node.style.setProperty('--ry', `${ry}deg`);
      node.style.setProperty('--posx', `${px}%`);
      node.style.setProperty('--posy', `${py}%`);
      node.style.setProperty('--hyp', `${Math.min(1.35, hyp)}`);
      node.style.setProperty('--bg-y', `${tiltX / 2}`);
      node.style.setProperty('--bg-x', `${tiltY / 2}`);
      node.style.setProperty('--bg-y-flipped', `${tiltX}`);
      node.style.setProperty('--bg-x-flipped', `${tiltY}`);
      node.style.setProperty('transform', `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`);
      node.style.setProperty('transition', 'none');
      foundationAutoRafRef.current = requestAnimationFrame(animate);
    };
    foundationAutoRafRef.current = requestAnimationFrame(animate);

    return () => {
      mounted = false;
      if (foundationAutoRafRef.current !== null) {
        cancelAnimationFrame(foundationAutoRafRef.current);
        foundationAutoRafRef.current = null;
      }
    };
  }, [
    shouldAutoFoundationOrbit,
    foundationAutoProfile,
    frameSize.width,
    frameSize.height,
    handlePointerLeave,
  ]);

  useEffect(() => {
    if (ripTrigger <= 0) return;
    if (ripTrigger === handledRipTriggerRef.current) return;
    handledRipTriggerRef.current = ripTrigger;
    setHideDomCard(false);
    setShowRipOverlay(true);
  }, [ripTrigger]);

  return (
    <div
      ref={registerRootElement}
      className="relative"
      style={{
        ...(disableTilt ? {} : holoStyles),
        transform: disableTilt ? 'none' : (holoStyles.transform),
        width: frameSize.width,
        height: frameSize.height,
        zIndex: (!disableHoverLift && isHovered) ? 50 : 1,
      }}
      onPointerMove={disableTilt ? undefined : handlePointerMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!disableTilt) handlePointerLeave();
      }}
    >
      <div className={`card-3d-container h-full w-full ${faceDown ? 'flipped' : ''}`}>
      {showLegacyShine && !disableAnimation && (
        <RarityAura
          rarity={effectiveRarity}
          cardWidth={frameSize.width}
          cardHeight={frameSize.height}
          layer="behind"
          hyp={holoStyles['--hyp']}
        />
      )}
      <CardFrame
        ref={cardRef}
        size={frameSize}
        borderColor={getBorderColor()}
        boxShadow={getBoxShadow()}
        onClick={onClick}
        onPointerDown={onDragStart ? handlePointerDown : undefined}
        whileHover={!disableAnimation && !disableHoverLift && !faceDown && !isAnyCardDragging && (canPlay || onClick || onDragStart) ? { scale: 1.05, y: -5 } : {}}
        whileTap={!disableAnimation && !faceDown && !isAnyCardDragging && !onDragStart && onClick ? { scale: 0.98 } : {}}
        initial={false}
        animate={false}
        className={`
          card-3d
          flex flex-col items-center ${isKeruAspectCard ? 'justify-start' : 'justify-center'} gap-0
          text-2xl font-bold ${isKeruAspectCard ? 'px-0 py-0' : 'px-2 py-1'}
          ${onClick && !faceDown ? 'cursor-pointer' : ''}
          ${onDragStart && !faceDown ? 'cursor-grab' : ''}
          ${!onClick && !onDragStart ? 'cursor-default' : ''}
          ${isDimmed ? 'opacity-50' : 'opacity-100'}
          ${isFoundation && !foundationActorProfile ? '!bg-white' : ''}
          ${foundationActorProfile && !foundationOverlay ? 'overflow-hidden' : ''}
          ${frameClassName ?? ''}
        `}
        backgroundColor={
          isFoundation && !faceDown
            ? (foundationActorProfile ? '#04060d' : '#ffffff')
            : undefined
        }
        style={{
          color: faceDown
            ? 'transparent'
            : (isDimmed ? dimmedTextColor : textColorBase),
          visibility: isDragging ? 'hidden' : 'visible',
          opacity: hideDomCard ? 0 : 1,
          // Prevent the browser from claiming touch gestures as scroll when the card
          // is draggable. Without this, a downward drag on mobile lets the browser
          // decide at touchstart time that it owns the gesture (before JS runs),
          // resulting in pointercancel and the card snapping back to its origin.
          touchAction: onDragStart && !faceDown ? 'none' : undefined,
          imageRendering: 'crisp-edges',
        }}
      >
        {/* Back face */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-lg border-2"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg) translateZ(1px)',
            zIndex: faceDown ? 20 : 0,
            borderColor: 'rgba(151, 178, 193, 0.45)',
            background:
              'radial-gradient(circle at 20% 18%, rgba(196, 224, 229, 0.24) 0%, rgba(61, 95, 120, 0.24) 52%, rgba(7, 15, 24, 0.9) 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(202, 223, 235, 0.12)',
          }}
        >
          <div
            className="w-10 h-10 rounded-full border"
            style={{
              borderColor: 'rgba(183, 207, 220, 0.42)',
              background: 'radial-gradient(circle, rgba(182, 213, 227, 0.14) 0%, rgba(10, 20, 30, 0) 72%)',
            }}
          />
        </div>

        {watercolorOnly && !faceDown && !foundationActorProfile && !neonMode && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 0,
              borderRadius: 10,
              background: getWatercolorBaseColor(),
              filter: getWatercolorColorFilter(),
            }}
          />
        )}
        {watercolorOnly && !faceDown && !foundationActorProfile && elementKey === 'W' && !neonMode && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 1,
              borderRadius: 10,
              background: isImmersive ? '#000000' : 'radial-gradient(circle at 42% 38%, #3f87ff 0%, #1d4fd3 48%, #0b2d8f 100%)',
              mixBlendMode: isImmersive ? 'normal' : 'multiply',
              opacity: isImmersive ? 1 : 0.88,
            }}
          />
        )}
        {watercolorOnly && !faceDown && !foundationActorProfile && elementKey === 'L' && !neonMode && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 1,
              borderRadius: 10,
            }}
          >
            <div
              className="absolute inset-0 rounded-[10px]"
              style={{
                background: 'radial-gradient(circle at 52% 42%, rgba(255, 252, 228, 0.92) 0%, rgba(255, 245, 196, 0.78) 36%, rgba(255, 230, 150, 0.36) 66%, rgba(255, 230, 150, 0) 100%)',
                mixBlendMode: 'screen',
                opacity: 0.9,
              }}
            />
            <div
              className="absolute inset-0 rounded-[10px]"
              style={{
                background: 'radial-gradient(circle at 22% 16%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 40%)',
                mixBlendMode: 'screen',
                opacity: 0.78,
              }}
            />
            <div
              className="absolute inset-0 rounded-[10px]"
              style={{
                boxShadow: '0 0 18px rgba(255, 245, 190, 0.72), inset 0 0 14px rgba(255, 238, 176, 0.58)',
                opacity: 0.72,
              }}
            />
          </div>
        )}
        {showLegacyShine && (
          <>
            {!disableTemplateArt && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  zIndex: 9,
                  backgroundImage: `url('${BLUEVEE_ASSET}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  opacity: isHovered ? 0.45 : 0.35,
                }}
              />
            )}
            {/* Glare Layer */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 10,
                background: `radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,${isHovered ? 0.35 : 0}) 0%, transparent 80%)`,
                mixBlendMode: 'soft-light',
              }}
            />
            {/* Multi-layer Holo/Sparkle System */}
            <div 
              className="absolute inset-0 pointer-events-none card-holo-gradient"
              style={{
                opacity: isHovered ? 0.94 : 0.58,
                filter: `brightness(${isHovered ? 0.72 : 0.58}) contrast(${isHovered ? 1.5 : 1.2}) saturate(${isHovered ? 1.5 : 1.25})`,
                mixBlendMode: 'screen',
              }}
            />
            <div 
              className="absolute inset-0 pointer-events-none card-holo-sparkle"
              style={{
                opacity: isHovered ? 1 : 0.7,
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 8,
                background:
                  'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 60%), radial-gradient(circle at 70% 40%, rgba(255, 230, 179, 0.45) 0%, rgba(255, 230, 179, 0) 55%)',
                mixBlendMode: 'screen',
                opacity: isHovered ? 0.42 : 0.25,
                transform: 'scale(1.02)',
                animation: 'holoPulse 3.6s ease-in-out infinite',
              }}
            />
          </>
      )}
      {showSecretActorHolo && (
        <>
          <div
            className="absolute inset-0 pointer-events-none rounded-[10px] card-holo-legacy-rainbow-foundation"
            style={{
              zIndex: 11,
              opacity: isHovered ? 0.72 : 0.62,
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none rounded-[10px] card-holo-sparkle"
            style={{
              zIndex: 12,
              opacity: isHovered ? 0.32 : 0.24,
              mixBlendMode: 'screen',
            }}
          />
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-[10px]"
            style={{
              zIndex: 13,
              background:
                'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.07) 40%, rgba(255,255,255,0) 75%)',
              mixBlendMode: 'screen',
            }}
            animate={{
              opacity: [0.14, 0.3, 0.14],
              scale: [0.997, 1.01, 0.997],
            }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-[10px]"
            style={{
              zIndex: 10,
              boxShadow: '0 0 14px rgba(255, 128, 240, 0.3), inset 0 0 11px rgba(128, 214, 255, 0.24)',
            }}
            animate={{
              opacity: [0.28, 0.52, 0.28],
            }}
            transition={{
              duration: 3.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </>
      )}
      {foundationOverlay && !faceDown && (() => {
        const accent = foundationOverlay.accentColor ?? suitColor;
        const hpValue = typeof foundationOverlay.hp === 'number' ? Math.max(0, foundationOverlay.hp) : null;
        const hpMaxValue = typeof foundationOverlay.hpMax === 'number'
          ? Math.max(1, foundationOverlay.hpMax)
          : (hpValue !== null ? Math.max(1, hpValue) : null);
        const armorValue = typeof foundationOverlay.armor === 'number'
          ? Math.max(0, Math.round(foundationOverlay.armor))
          : 0;
        const superArmorValue = typeof foundationOverlay.superArmor === 'number'
          ? Math.max(0, Math.round(foundationOverlay.superArmor))
          : 0;
        const hpPercent = hpValue !== null && hpMaxValue !== null
          ? Math.max(0, Math.min(100, (hpValue / hpMaxValue) * 100))
          : 0;
        const minimalVitalsOnly = !!foundationOverlay.minimalVitalsOnly;
        const hpTextIsDark = isLightVisualColor(accent);
        const foundationRankDisplay = foundationOverlay.rankDisplay
          ?? (card ? getRankDisplay(card.rank) : '');
        const foundationRankFontPx = Math.max(30, Math.round(frameSize.width * 0.42));
        const apSegments = Array.isArray(foundationOverlay.apSegments)
          ? foundationOverlay.apSegments
              .map((entry) => (typeof entry === 'string' ? entry : 'N'))
              .filter((entry): entry is Element => ['W', 'E', 'A', 'F', 'L', 'D', 'N'].includes(entry))
          : [];
        const apCount = Math.max(
          0,
          Math.round(
            Number.isFinite(Number(foundationOverlay.apCount))
              ? Number(foundationOverlay.apCount)
              : apSegments.length
          )
        );
        const overlayTitle = foundationOverlay.name ?? '';
        const autoSizeTitle = !!foundationOverlay.autoSizeTitle;
        const titleFontPx = autoSizeTitle ? getFoundationOverlayTitleFontPx(overlayTitle) : 16;
        const titleLetterSpacing = autoSizeTitle ? (titleFontPx <= 8 ? '-0.2px' : '0px') : undefined;
        const shimmerElement = foundationOverlay.shimmerElement
          ?? apSegments[apSegments.length - 1]
          ?? undefined;
        const shimmerColor = shimmerElement ? getNeonElementColor(shimmerElement) : '#8ee3a5';
        const shimmerKey = `${card?.id ?? 'foundation'}-${overlayTitle}-burst-${foundationShimmerBurst}`;
        const shimmerAngle = 26 + hashStringToUnit(shimmerKey, 11) * 30;
        const shimmerDuration = 0.45 + hashStringToUnit(shimmerKey, 23) * 0.2;
        const shimmerStartX = -66 - hashStringToUnit(shimmerKey, 41) * 26;
        const shimmerEndX = 148 + hashStringToUnit(shimmerKey, 43) * 74;
        const shimmerStartY = -52 - hashStringToUnit(shimmerKey, 67) * 20;
        const shimmerEndY = 42 + hashStringToUnit(shimmerKey, 71) * 24;
        const shimmerPeakOpacity = 0.48 + hashStringToUnit(shimmerKey, 47) * 0.18;
        const shimmerBandWidthPct = 26 + hashStringToUnit(shimmerKey, 73) * 18;
        const shimmerBandHeightPct = 180 + hashStringToUnit(shimmerKey, 79) * 60;
        const shimmerBlurPx = 0;
        const superArmorSparkleColor = 'rgba(255, 220, 110, 0.98)';
        const hpBarSparkles = [
          { left: '30%', top: '12%', size: 8, delay: 0.0, dur: 1.6 },
          { left: '52%', top: '8%', size: 7, delay: 0.45, dur: 1.8 },
          { left: '74%', top: '14%', size: 6, delay: 0.85, dur: 1.55 },
        ];
        const armorTokenSparkles = [
          { left: '100%', top: '10px', size: 8, delay: 0.15, dur: 1.5 },
          { left: '100%', top: '35px', size: 7, delay: 0.7, dur: 1.75 },
          { left: '100%', top: '58px', size: 6, delay: 1.05, dur: 1.65 },
        ];
        return (
          <div
            className="absolute inset-0 rounded-[10px] pointer-events-none z-[30] overflow-visible"
          >
            {superArmorValue > 0 && (
              <style>{`
                @keyframes foundation-superarmor-sparkle-float {
                  0%   { transform: translate(-50%, -50%) translateY(0px) scale(1); opacity: 0.72; }
                  50%  { transform: translate(-50%, -50%) translateY(-5px) scale(1.22); opacity: 1; }
                  100% { transform: translate(-50%, -50%) translateY(0px) scale(1); opacity: 0.72; }
                }
              `}</style>
            )}
            <div
              className="absolute inset-0 rounded-[10px] overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, rgba(6, 8, 12, 0.9) 0%, rgba(6, 8, 12, 0.68) 100%)',
                boxShadow: `0 0 18px ${accent}aa, inset 0 0 0 1px ${accent}b5`,
                backdropFilter: 'blur(2px)',
                mixBlendMode: 'normal',
              }}
            >
              <div
                className="absolute inset-0 opacity-70"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${accent}55 0 36%, transparent 70%)`,
                }}
              />
              <div className="absolute inset-[4px] flex flex-col">
                <div className="relative min-h-[24px]">
                  {hpValue !== null && hpMaxValue !== null && (
                    <div
                      className={`absolute inset-y-0 right-[1px] flex items-center ${foundationOverlay.rankDisplay ? 'left-[20px]' : 'left-0'}`}
                    >
                      <div
                        className="relative h-[14px] w-full rounded-full overflow-hidden border"
                        style={{
                          borderColor: 'rgba(255,255,255,0.16)',
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          boxShadow: `0 0 8px ${accent}55`,
                        }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${hpPercent}%`,
                            background: `linear-gradient(90deg, ${accent}dd, ${accent}aa)`,
                            boxShadow: `0 0 6px ${accent}66`,
                            transition: 'width 180ms ease-out',
                          }}
                        />
                        <div
                          className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tracking-[0.2px]"
                          style={{
                            color: hpTextIsDark ? '#10161d' : '#e9f7ff',
                            textShadow: hpTextIsDark ? '0 1px 1px rgba(255,255,255,0.24)' : `0 0 6px ${accent}55`,
                          }}
                        >
                          {Math.round(hpValue)}/{Math.round(hpMaxValue)}
                        </div>
                        {superArmorValue > 0 && hpBarSparkles.map((sparkle, index) => (
                          <svg
                            key={`hp-superarmor-sparkle-${index}`}
                            viewBox="0 0 10 10"
                            className="absolute pointer-events-none"
                            style={{
                              left: sparkle.left,
                              top: sparkle.top,
                              width: sparkle.size,
                              height: sparkle.size,
                              transform: 'translate(-50%, -50%)',
                              filter: `drop-shadow(0 0 2px ${superArmorSparkleColor}) drop-shadow(0 0 7px rgba(255, 202, 88, 0.68))`,
                              animation: `foundation-superarmor-sparkle-float ${sparkle.dur}s ease-in-out infinite`,
                              animationDelay: `${sparkle.delay}s`,
                              opacity: 0.9,
                            }}
                          >
                            <path d="M5,0 L5.8,4.2 L10,5 L5.8,5.8 L5,10 L4.2,5.8 L0,5 L4.2,4.2 Z" fill={superArmorSparkleColor} />
                            <circle cx="5" cy="5" r="1.4" fill="rgba(255,255,255,0.92)" />
                          </svg>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {!minimalVitalsOnly && (
                  <>
                    <div
                      className={`mt-[4px] rounded-md border px-2 py-[2px] text-left font-black leading-tight ${autoSizeTitle ? 'whitespace-nowrap' : 'text-[16px] truncate'}`}
                      style={{
                        borderColor: `${accent}8a`,
                        color: '#f5f8ff',
                        backgroundColor: 'rgba(4, 8, 12, 0.78)',
                        textShadow: `0 0 12px ${accent}aa`,
                        fontSize: `${titleFontPx}px`,
                        letterSpacing: titleLetterSpacing,
                      }}
                    >
                      {overlayTitle}
                    </div>
                    <div
                      className="relative mt-[4px] rounded-md border px-2 py-[3px] text-left text-[10px] leading-tight flex-1 min-h-0 overflow-hidden"
                      style={{
                        borderColor: `${accent}66`,
                        color: '#d8e9ff',
                        backgroundColor: 'rgba(8, 12, 18, 0.7)',
                      }}
                    >
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            `radial-gradient(circle at 30% 22%, ${withAlphaColor(shimmerColor, 0.22)} 0%, ${withAlphaColor(shimmerColor, 0)} 58%), linear-gradient(180deg, rgba(12,18,26,0.15) 0%, rgba(3,6,10,0.4) 100%)`,
                        }}
                      />
                      {foundationRankDisplay && (
                        <div className="absolute inset-0 z-[1] flex items-center justify-center">
                          <span
                            style={{
                              fontSize: `${foundationRankFontPx}px`,
                              fontWeight: 900,
                              letterSpacing: '-0.02em',
                              lineHeight: 1,
                              color: '#f5f8ff',
                              textShadow: `0 0 10px ${accent}cc, 0 0 22px ${withAlphaColor(accent, 0.75)}`,
                            }}
                          >
                            {foundationRankDisplay}
                          </span>
                        </div>
                      )}
                      {foundationShimmerActive && (
                        <>
                          <motion.div
                            key={`foundation-shimmer-band-${foundationShimmerBurst}`}
                            className="absolute pointer-events-none"
                            style={{
                              background:
                                `linear-gradient(110deg, rgba(255,255,255,0) 0%, ${withAlphaColor(shimmerColor, 0.08)} 22%, ${withAlphaColor(shimmerColor, 0.22)} 38%, rgba(255,255,255,0.34) 50%, ${withAlphaColor(shimmerColor, 0.25)} 63%, ${withAlphaColor(shimmerColor, 0.08)} 78%, rgba(255,255,255,0) 100%)`,
                              mixBlendMode: 'screen',
                              transform: `rotate(${shimmerAngle.toFixed(2)}deg)`,
                              transformOrigin: 'center',
                              width: `${shimmerBandWidthPct.toFixed(2)}%`,
                              height: `${shimmerBandHeightPct.toFixed(2)}%`,
                              left: '-36%',
                              top: '-54%',
                              filter: `blur(${shimmerBlurPx.toFixed(2)}px)`,
                            }}
                            initial={{
                              x: `${shimmerStartX.toFixed(1)}%`,
                              y: `${shimmerStartY.toFixed(1)}%`,
                              opacity: 0,
                            }}
                            animate={{
                              x: `${shimmerEndX.toFixed(1)}%`,
                              y: `${shimmerEndY.toFixed(1)}%`,
                              opacity: [0, shimmerPeakOpacity, 0],
                            }}
                            transition={{ duration: shimmerDuration, ease: 'easeInOut' }}
                          />
                        </>
                      )}
                    </div>
                    <div
                      className="relative mt-[4px] rounded-md border h-[14px] flex items-center px-[2px] overflow-hidden"
                      style={{
                        borderColor: `${accent}55`,
                        backgroundColor: 'rgba(6, 10, 14, 0.6)',
                      }}
                    >
                      <div className="relative h-full min-w-0 flex-1 overflow-hidden rounded-[2px]">
                        {apSegments.length > 0 ? (
                          <div className="flex h-full w-full gap-0">
                            {apSegments.map((element, segmentIndex) => {
                              const segmentColor = element === 'N' ? '#8a8f98' : getNeonElementColor(element);
                              const isFirst = segmentIndex === 0;
                              return (
                                <div
                                  key={`ap-segment-${segmentIndex}-${element}`}
                                  className="h-full flex-1 rounded-[2px]"
                                  style={{
                                    background: `linear-gradient(180deg, ${segmentColor}dd 0%, ${segmentColor}99 100%)`,
                                    boxShadow: `0 0 6px ${segmentColor}99`,
                                    borderLeft: isFirst ? 'none' : '1px solid rgba(6, 10, 14, 0.82)',
                                  }}
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <div className="h-full w-full rounded-[2px] bg-game-bg-dark/50" />
                        )}
                        {apSegments.length > 0 && (
                          <div className="pointer-events-none absolute inset-0 z-[2]">
                            {apSegments.map((element, segmentIndex) => {
                              const sparkleColor = element === 'N' ? 'rgba(220, 228, 238, 0.95)' : withAlphaColor(getNeonElementColor(element), 0.95);
                              return (
                                <svg
                                  key={`ap-combo-sparkle-${segmentIndex}-${element}`}
                                  viewBox="0 0 10 10"
                                  className="absolute"
                                  style={{
                                    left: `${((segmentIndex + 0.5) / apSegments.length) * 100}%`,
                                    top: '52%',
                                    width: 6,
                                    height: 6,
                                    transform: 'translate(-50%, -50%)',
                                    filter: `drop-shadow(0 0 2px ${sparkleColor}) drop-shadow(0 0 5px ${sparkleColor})`,
                                    animation: `foundation-superarmor-sparkle-float ${1.4 + (segmentIndex % 3) * 0.2}s ease-in-out infinite`,
                                    animationDelay: `${segmentIndex * 0.12}s`,
                                    opacity: 0.88,
                                  }}
                                >
                                  <path d="M5,0 L5.8,4.2 L10,5 L5.8,5.8 L5,10 L4.2,5.8 L0,5 L4.2,4.2 Z" fill={sparkleColor} />
                                  <circle cx="5" cy="5" r="1.15" fill="rgba(255,255,255,0.9)" />
                                </svg>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div
                        className="ml-[4px] min-w-[14px] pr-[1px] text-right text-[9px] font-black leading-none"
                        style={{
                          color: '#f5f8ff',
                          textShadow: `0 0 8px ${accent}aa`,
                        }}
                      >
                        {apCount}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            {!minimalVitalsOnly && foundationOverlay.rankDisplay && (
              <div
                className="absolute -top-[4px] -left-[4px] w-[27px] h-[27px] rounded-full flex items-center justify-center text-[13px] font-black"
                style={{
                  color: '#0b0d10',
                  backgroundColor: accent,
                  border: '2px solid rgba(10,12,16,0.95)',
                  boxShadow: `0 0 12px ${accent}99`,
                  textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                }}
              >
                {foundationOverlay.rankDisplay}
              </div>
            )}
            {(armorValue > 0 || superArmorValue > 0) && (
              <div className="absolute right-0 top-[16px] -translate-y-1/2 translate-x-1/2 flex flex-col gap-[2px]">
                {superArmorValue > 0 && armorTokenSparkles.map((sparkle, index) => (
                  <svg
                    key={`armor-superarmor-sparkle-${index}`}
                    viewBox="0 0 10 10"
                    className="absolute pointer-events-none"
                    style={{
                      left: sparkle.left,
                      top: sparkle.top,
                      width: sparkle.size,
                      height: sparkle.size,
                      transform: 'translate(-50%, -50%)',
                      filter: `drop-shadow(0 0 2px ${superArmorSparkleColor}) drop-shadow(0 0 8px rgba(255, 202, 88, 0.72))`,
                      animation: `foundation-superarmor-sparkle-float ${sparkle.dur}s ease-in-out infinite`,
                      animationDelay: `${sparkle.delay}s`,
                      opacity: 0.92,
                      zIndex: 2,
                    }}
                  >
                    <path d="M5,0 L5.8,4.2 L10,5 L5.8,5.8 L5,10 L4.2,5.8 L0,5 L4.2,4.2 Z" fill={superArmorSparkleColor} />
                    <circle cx="5" cy="5" r="1.4" fill="rgba(255,255,255,0.92)" />
                  </svg>
                ))}
                {superArmorValue > 0 && (
                  <div
                    className="w-[24px] h-[24px] rounded-full border flex items-center justify-center gap-[1px] font-bold leading-none"
                    style={{
                      color: '#ffd23c',
                      borderColor: 'rgba(255, 210, 60, 0.55)',
                      backgroundColor: 'rgba(32, 20, 0, 0.72)',
                      textShadow: '0 0 8px rgba(255, 210, 60, 0.85)',
                      fontSize: 8,
                    }}
                    title={`Super Armor ${superArmorValue}`}
                  >
                    <span className="leading-none">✦</span>
                    <span className="leading-none">{superArmorValue}</span>
                  </div>
                )}
                {armorValue > 0 && (
                  <div
                    className="w-[28px] h-[28px] rounded-full border flex items-center justify-center gap-[1px] font-bold leading-none"
                    style={{
                      color: '#00c8ff',
                      borderColor: '#00c8ff',
                      backgroundColor: '#001c30',
                      textShadow: '0 0 8px rgba(0, 196, 255, 0.85)',
                      fontSize: 9,
                    }}
                    title={`Armor ${armorValue}`}
                  >
                    <span className="leading-none">🛡</span>
                    <span className="leading-none">{armorValue}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
      {showWaterArtOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, borderRadius: 10, filter: isImmersive ? 'none' : 'url(#watercard-filter)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#0ea5e9] via-[#075985] to-[#020617]" style={{ background: isImmersive ? '#000000' : undefined }} />
          {!isImmersive && (
            <>
              <div
                className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[90%] h-[40%] opacity-95"
                style={{
                  background: 'radial-gradient(circle at center, white 0%, rgba(255,255,255,0.8) 30%, transparent 70%)',
                  filter: 'blur(30px)',
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none opacity-60 mix-blend-screen"
                style={{
                  background: `
                    conic-gradient(
                      from 150deg at 50% 0%,
                      transparent 0deg,
                      rgba(255, 255, 255, 0.4) 15deg,
                      transparent 25deg,
                      rgba(255, 255, 255, 0.6) 30deg,
                      transparent 35deg,
                      rgba(255, 255, 255, 0.5) 45deg,
                      transparent 55deg,
                      rgba(255, 255, 255, 0.4) 60deg,
                      transparent 75deg
                    )
                  `,
                  maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.8) 20%, transparent 90%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.8) 20%, transparent 90%)',
                  filter: 'blur(8px)',
                }}
              />
              <div
                className="absolute bottom-[-5%] left-[-10%] w-[70%] h-[50%] bg-[#020617] blur-[35px] opacity-70"
                style={{ clipPath: 'circle(50% at 30% 80%)' }}
              />
              <div
                className="absolute bottom-0 left-[-5%] w-[60%] h-[40%] opacity-80"
                style={{
                  clipPath: 'polygon(0% 100%, 80% 100%, 70% 60%, 40% 40%, 10% 30%)',
                  background: 'linear-gradient(45deg, #1e1b4b, #4c1d95, #7c3aed)',
                  filter: 'blur(15px)',
                }}
              />
              <div
                className="absolute bottom-0 left-[-2%] w-[55%] h-[35%] opacity-90"
                style={{
                  clipPath: 'polygon(0% 100%, 100% 100%, 90% 70%, 75% 50%, 40% 80%, 15% 40%)',
                  background: 'linear-gradient(to top, #0f172a, #2e1065, #5b21b6)',
                  filter: 'blur(5px)',
                }}
              />
              <div
                className="absolute bottom-[-5%] right-[-10%] w-[60%] h-[55%] bg-[#020617] blur-[40px] opacity-80"
                style={{ clipPath: 'circle(50% at 70% 80%)' }}
              />
              <div
                className="absolute bottom-0 right-[-5%] w-[50%] h-[50%] opacity-80"
                style={{
                  clipPath: 'polygon(100% 100%, 0% 100%, 20% 60%, 50% 30%, 85% 50%)',
                  background: 'linear-gradient(135deg, #1e1b4b, #312e81, #701a75)',
                  filter: 'blur(18px)',
                }}
              />
              <div
                className="absolute bottom-0 right-0 w-[45%] h-[45%] opacity-90"
                style={{
                  clipPath: 'polygon(100% 100%, 0% 100%, 30% 65%, 60% 35%, 90% 55%)',
                  background: 'linear-gradient(to top, #020617, #1e1b4b, #3730a3)',
                  filter: 'blur(4px)',
                }}
              />
              <div
                className="absolute bottom-[-5%] left-1/4 w-[50%] h-[30%] opacity-70 blur-[20px]"
                style={{ background: 'radial-gradient(circle, #facc15 0%, #ca8a04 50%, transparent 80%)' }}
              />
              <div
                className="absolute bottom-0 left-1/4 w-[55%] h-[28%] opacity-85"
                style={{
                  clipPath: 'polygon(0% 100%, 100% 100%, 85% 40%, 50% 75%, 15% 35%)',
                  background: 'linear-gradient(to top, #082f49, #155e75, #a16207)',
                  filter: 'blur(8px)',
                }}
              />
              {waterFish.map((fish) => (
                <div
                  key={fish.id}
                  className="absolute bg-[#020617]"
                  style={{
                    top: `${fish.top}%`,
                    left: `${fish.left}%`,
                    width: `${fish.width}px`,
                    height: `${fish.height}px`,
                    borderRadius: '50%',
                    filter: 'blur(1px)',
                    opacity: fish.opacity,
                    transform: `rotate(${fish.rotate}deg)`,
                  }}
                />
              ))}
            </>
          )}
          <div className="absolute inset-0 opacity-[0.25] pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
          <div className="absolute inset-0 opacity-[0.12] pointer-events-none mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/rough-canvas.png')]" />
          <svg width="0" height="0" className="absolute">
            <defs>
              <filter id="watercard-filter" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.025"
                  numOctaves="6"
                  seed="12"
                  result="noise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="45"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </defs>
          </svg>
        </div>
      )}
      {showLightArtOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, borderRadius: 10, filter: 'url(#lightcard-filter)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a202c] via-[#2d3748] to-[#2d3748]" />
          <div
            className="absolute inset-0 opacity-90 mix-blend-screen"
            style={{
              background: 'radial-gradient(circle at 70% 40%, #fbd38d 0%, #feb2b2 30%, #b794f4 60%, transparent 90%)',
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-full h-1/2 opacity-60 mix-blend-screen"
            style={{ background: 'linear-gradient(to top, #feb2b2 0%, transparent 100%)' }}
          />
          <div
            className="absolute -top-32 -right-32 w-[140%] h-[100%] rounded-full blur-[120px]"
            style={{
              background: 'radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 254, 235, 0.9) 25%, rgba(255, 245, 180, 0.5) 55%, transparent 85%)',
              opacity: 1,
            }}
          />
          <div className="absolute top-[-15%] right-[-15%] w-[70%] h-[50%] rounded-full blur-[50px] bg-white opacity-95 mix-blend-overlay" />
          <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[30%] rounded-full blur-[20px] bg-white opacity-100 mix-blend-screen" />
          <div className="absolute top-[2%] right-[2%] w-[15%] h-[15%] rounded-full blur-[5px] bg-white opacity-100" />
          <div
            className="absolute inset-[-150%] pointer-events-none mix-blend-screen opacity-90"
            style={{
              background: `repeating-linear-gradient(
                ${150 + Math.sin(shimmer) * 1.5}deg,
                transparent 0%,
                transparent 1%,
                rgba(255, 255, 255, 0.8) 2%,
                rgba(255, 255, 255, 0.1) 4%,
                transparent 7%
              )`,
              maskImage: 'radial-gradient(circle at 95% 5%, black 0%, transparent 95%)',
              WebkitMaskImage: 'radial-gradient(circle at 95% 5%, black 0%, transparent 95%)',
            }}
          />
          <div
            className="absolute inset-[-150%] pointer-events-none mix-blend-overlay opacity-50"
            style={{
              background: `repeating-linear-gradient(
                ${145 + Math.sin(shimmer * 0.8) * 1}deg,
                transparent 0%,
                rgba(255, 255, 255, 0.4) 10%,
                transparent 20%
              )`,
              maskImage: 'radial-gradient(circle at 95% 5%, black 0%, transparent 90%)',
              WebkitMaskImage: 'radial-gradient(circle at 95% 5%, black 0%, transparent 90%)',
            }}
          />
          <div
            className="absolute top-[-10%] left-[-10%] w-[60%] h-[40%] rounded-full blur-[80px] mix-blend-multiply opacity-80"
            style={{ background: 'radial-gradient(circle, #0a101f, transparent)' }}
          />
          <div
            className="absolute bottom-[10%] right-[-20%] w-[70%] h-[30%] rounded-full blur-[70px] mix-blend-multiply opacity-40"
            style={{ background: 'radial-gradient(circle, #162238, transparent)' }}
          />
          <div className="absolute inset-0 opacity-[0.32] pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
          <div className="absolute inset-0 border border-white/20 rounded-[2rem] pointer-events-none shadow-inner" />
          <svg width="0" height="0" className="absolute">
            <defs>
              <filter id="lightcard-filter" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.016"
                  numOctaves="5"
                  seed="55"
                  result="noise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="45"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="soft" />
                <feComposite in="soft" in2="SourceGraphic" operator="over" />
              </filter>
            </defs>
          </svg>
        </div>
      )}
      {showFireArtOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, borderRadius: 10, filter: 'url(#firecard-filter)' }}
        >
          <div className="absolute inset-0 bg-[#4d0000]" />
          <div
            className="absolute top-[-10%] left-[-20%] w-[140%] h-[100%] opacity-80 mix-blend-screen blur-[60px]"
            style={{ background: 'radial-gradient(circle at 30% 40%, #ff4500 0%, #ff8c00 40%, transparent 80%)' }}
          />
          <div
            className="absolute bottom-[-10%] right-[-10%] w-[120%] h-[80%] opacity-70 mix-blend-overlay blur-[50px]"
            style={{ background: 'radial-gradient(circle at 70% 60%, #ff0000 0%, #8b0000 50%, transparent 90%)' }}
          />
          <div
            className="absolute top-[20%] right-[10%] w-[50%] h-[40%] opacity-90 mix-blend-screen blur-[45px]"
            style={{ background: 'radial-gradient(circle at center, #fff700 0%, #ffea00 30%, transparent 75%)' }}
          />
          <div
            className="absolute bottom-[20%] left-[15%] w-[40%] h-[30%] opacity-80 mix-blend-hard-light blur-[35px]"
            style={{ background: 'radial-gradient(circle at center, #ffffff 0%, #ffd700 40%, transparent 85%)' }}
          />
          <div className="absolute top-[40%] left-[10%] w-[80%] h-[20%] rotate-[-15deg] bg-gradient-to-r from-transparent via-[#ff8c00] to-transparent opacity-40 mix-blend-screen blur-[20px]" />
          <div className="absolute bottom-[30%] right-[5%] w-[70%] h-[15%] rotate-[25deg] bg-gradient-to-r from-transparent via-[#ff0000] to-transparent opacity-30 mix-blend-color-dodge blur-[15px]" />
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 mix-blend-overlay">
            <path d="M 50 100 Q 150 250 100 400 T 250 600" stroke="#ffd700" fill="transparent" strokeWidth="4" filter="blur(8px)" />
            <path d="M 300 50 Q 200 200 350 350 T 150 650" stroke="#ff4500" fill="transparent" strokeWidth="6" filter="blur(12px)" />
          </svg>
          <div className="absolute inset-0 opacity-[0.45] pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
          <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(255,69,0,0.2)] pointer-events-none rounded-[2.5rem]" />
          <svg width="0" height="0" className="absolute">
            <defs>
              <filter id="firecard-filter" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.03"
                  numOctaves="6"
                  seed="999"
                  result="noise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="60"
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="distorted"
                />
                <feGaussianBlur in="distorted" stdDeviation="1.2" result="soft" />
                <feComposite in="soft" in2="SourceGraphic" operator="over" />
              </filter>
            </defs>
          </svg>
        </div>
      )}
      {showAirArtOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, borderRadius: 10, filter: 'url(#aircard-filter)' }}
        >
          <div className="absolute inset-0 bg-[#ffffff]" />
          <div
            className="absolute top-[-10%] right-[-10%] w-[80%] h-[50%] bg-[#1e3a8a] mix-blend-multiply opacity-90"
            style={{
              clipPath: 'polygon(100% 0%, 100% 100%, 70% 80%, 40% 90%, 20% 60%, 40% 20%, 60% 0%)',
              filter: 'blur(5px)',
            }}
          />
          <div
            className="absolute top-[10%] left-[-15%] w-[70%] h-[80%] bg-[#2563eb] mix-blend-multiply opacity-70"
            style={{
              clipPath: 'polygon(0% 0%, 60% 10%, 80% 40%, 50% 70%, 70% 90%, 0% 100%)',
              filter: 'blur(8px)',
            }}
          />
          <div
            className="absolute bottom-[-10%] right-[-5%] w-[60%] h-[50%] bg-[#60a5fa] mix-blend-multiply opacity-50"
            style={{
              clipPath: 'polygon(100% 100%, 20% 100%, 40% 70%, 70% 50%, 100% 60%)',
              filter: 'blur(15px)',
            }}
          />
          <div
            className="absolute inset-0 mix-blend-multiply opacity-40 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 40% 40%, transparent 30%, #1d4ed8 70%)',
              filter: 'blur(20px)',
            }}
          />
          <div className="absolute top-[35%] left-[30%] w-[40%] h-[30%] bg-[#93c5fd] mix-blend-multiply opacity-20 blur-[30px] rounded-full" />
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 mix-blend-multiply">
            <path
              d="M 250 50 Q 200 150 280 250 T 350 400"
              stroke="#1e40af"
              fill="transparent"
              strokeWidth="15"
              filter="blur(15px)"
            />
            <path
              d="M 50 300 Q 120 400 80 550"
              stroke="#1e3a8a"
              fill="transparent"
              strokeWidth="10"
              filter="blur(12px)"
            />
          </svg>
          <div className="absolute inset-0 opacity-[0.45] pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
          <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(30,58,138,0.05)] pointer-events-none rounded-[2.5rem]" />
          <svg width="0" height="0" className="absolute">
            <defs>
              <filter id="aircard-filter" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.035"
                  numOctaves="6"
                  seed="444"
                  result="noise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="55"
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="distorted"
                />
                <feGaussianBlur in="distorted" stdDeviation="0.6" result="soft" />
                <feComposite in="soft" in2="SourceGraphic" operator="over" />
              </filter>
            </defs>
          </svg>
        </div>
      )}
      {showDarkArtOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, borderRadius: 10 }}
        >
          {/* Heavy edge vignette */}
          <div
            className="absolute inset-0"
            style={{
              zIndex: 4,
              background: 'linear-gradient(90deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.8) 18%, rgba(0,0,0,0.0) 50%, rgba(0,0,0,0.8) 82%, rgba(0,0,0,0.98) 100%)',
              mixBlendMode: 'multiply',
            }}
          />
          <div className="absolute inset-0 bg-neutral-200" style={{ clipPath: darkJaggedPath }} />
          <div
            className="absolute inset-[2.5px] bg-[#030108] overflow-hidden"
            style={{ clipPath: darkJaggedPath }}
          >
          <div className="absolute inset-0 bg-[#05030b]" />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, rgba(5,3,11,0.98) 0%, rgba(5,3,11,0.7) 18%, rgba(5,3,11,0.15) 50%, rgba(5,3,11,0.7) 82%, rgba(5,3,11,0.98) 100%)',
            }}
          />
          <div className="absolute inset-0 bg-radial-at-c from-[#3f1d6b]/55 via-transparent to-transparent opacity-55" />
            <div className="absolute inset-0 flex flex-col items-center justify-around pointer-events-none">
                {[
                  { top: '6%', scaleX: 0.55, scaleY: 1.2, color: '#2a0f54', opacity: 0.22 },
                  { top: '24%', scaleX: 0.75, scaleY: 1.4, color: '#4b136f', opacity: 0.32 },
                  { top: '48%', scaleX: 0.85, scaleY: 1.7, color: '#6d1fb0', opacity: 0.45 },
                  { top: '72%', scaleX: 0.75, scaleY: 1.4, color: '#4b136f', opacity: 0.32 },
                  { top: '92%', scaleX: 0.55, scaleY: 1.15, color: '#2a0f54', opacity: 0.22 },
                ].map((puff, index) => (
                <div
                  key={`nebula-${index}`}
                  className="absolute left-1/2 -translate-x-1/2 w-[160px] h-[280px] rounded-full mix-blend-screen"
                  style={{
                    top: puff.top,
                    background: `radial-gradient(circle, ${puff.color} 0%, transparent 80%)`,
                    opacity: puff.opacity,
                    transform: `translateX(-50%) scale(${puff.scaleX}, ${puff.scaleY})`,
                    filter: 'blur(28px)',
                  }}
                />
              ))}
              <div
                className="absolute w-12 h-[95%] bg-[#f5d0fe] mix-blend-screen opacity-30"
                style={{
                  filter: 'blur(22px)',
                  boxShadow: '0 0 70px 12px rgba(160, 60, 200, 0.25)',
                }}
              />
              <div className="absolute w-6 h-[85%] bg-white/50 mix-blend-screen" style={{ filter: 'blur(32px)' }} />
              <div className="absolute w-2 h-[70%] bg-white opacity-35 blur-[14px]" />
            </div>
            {darkStars.map((star) => {
              if (star.type === 'sparkle') {
                return (
                  <svg
                    key={star.id}
                    viewBox="0 0 24 24"
                    className="absolute pointer-events-none"
                    style={{
                      width: '16px',
                      height: '16px',
                      left: star.left,
                      top: star.top,
                      filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.8))',
                      transform: `scale(${star.size * 0.4})`,
                      animation: 'none',
                    }}
                  >
                    <path
                      fill="white"
                      d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5L12 0Z"
                    />
                  </svg>
                );
              }
              return (
                <div
                  key={star.id}
                  className="absolute rounded-full bg-white pointer-events-none"
                  style={{
                    left: star.left,
                    top: star.top,
                    width: `${star.size}px`,
                    height: `${star.size}px`,
                    opacity: star.opacity,
                    boxShadow: star.type === 'glow' ? '0 0 8px 1px rgba(255, 255, 255, 0.6)' : 'none',
                    transform: `rotate(${star.rotate}deg)`,
                    animation: 'none',
                  }}
                />
              );
            })}
            <div className="absolute inset-0 opacity-[0.1] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
          </div>
          <div
            className="absolute inset-0 opacity-[0.14] pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/felt.png')]"
            style={{ clipPath: darkJaggedPath }}
          />
          <style>{`
            @keyframes twinkle {
              0%, 100% { opacity: 0.4; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.1); }
            }
            @keyframes holoPulse {
              0% { opacity: 0.2; transform: scale(0.98); }
              50% { opacity: 0.6; transform: scale(1.03); }
              100% { opacity: 0.2; transform: scale(0.98); }
            }
          `}</style>
        </div>
      )}
      {showWaterDepthOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 1,
            borderRadius: 10,
            background: 'linear-gradient(180deg, rgba(6, 48, 110, 0) 0%, rgba(6, 48, 110, 0.45) 20%, rgba(2, 24, 64, 0.85) 45%, rgba(1, 16, 44, 0.98) 75%, rgba(0, 8, 28, 1) 100%)',
            mixBlendMode: 'multiply',
          }}
        />
      )}
      {!faceDown && isUpgradedRpgCard && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 2,
              borderRadius: 10,
              background: 'linear-gradient(120deg, rgba(255,255,255,0) 8%, rgba(255,255,255,0.35) 20%, rgba(160,255,255,0.28) 33%, rgba(255,170,255,0.24) 47%, rgba(255,255,255,0) 60%)',
              transform: 'translateX(-120%)',
              animation: 'rpg-holo-sheen 2.8s ease-in-out infinite',
              animationDelay: `${-upgradedSheenOffsetSec}s`,
              mixBlendMode: 'screen',
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 2,
              borderRadius: 10,
              boxShadow: 'inset 0 0 16px rgba(180, 255, 255, 0.25), inset 0 0 26px rgba(255, 190, 255, 0.2)',
            }}
          />
          <style>{`
            @keyframes rpg-holo-sheen {
              0% { transform: translateX(-120%); opacity: 0.2; }
              40% { opacity: 0.95; }
              55% { transform: translateX(120%); opacity: 0.25; }
              100% { transform: translateX(120%); opacity: 0.2; }
            }
          `}</style>
        </>
      )}
      {/* TEMP: earth card SVG lines hidden */}
      {!faceDown && card && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ zIndex: 3 }}
        >
          {card.actorGlyph && (
            <div
              className="absolute top-1 left-1 rounded-full border border-game-teal/50 bg-game-bg-dark/70 flex items-center justify-center"
              style={{
                width: Math.max(12, Math.round(frameSize.width * 0.18)),
                height: Math.max(12, Math.round(frameSize.width * 0.18)),
                fontSize: Math.max(8, Math.round(frameSize.width * 0.14)),
                color: suitColor,
              }}
            >
              {card.actorGlyph}
            </div>
          )}
          {cooldownValue > 0 && cooldownMax > 0 && (
            <div className="absolute inset-0 flex flex-col pointer-events-none">
              {Array.from({ length: cooldownMax }).map((_, index) => {
                const readySegments = cooldownMax - cooldownValue;
                const isReady = index < readySegments;
                return (
                  <div
                    key={`cooldown-segment-${index}`}
                    className="flex-1"
                    style={{
                      backgroundColor: isReady ? 'transparent' : 'rgba(40, 44, 47, 0.65)',
                      borderBottom: index === cooldownMax - 1 ? 'none' : '1px solid rgba(90, 98, 103, 0.35)',
                    }}
                  />
                );
              })}
            </div>
          )}
          {!maskValue && !foundationOverlay && (
            <div
              className="force-sharp absolute"
              style={{
                top: handMinimalOverlay ? 0 : Math.max(6, Math.round(frameSize.height * 0.07)),
                bottom: handMinimalOverlay ? 0 : undefined,
                left: 0,
                right: 0,
                textAlign: 'center',
                textShadow: (isDimmed || watercolorOnly) ? 'none' : `0 0 10px ${suitColor}`,
                WebkitFontSmoothing: 'subpixel-antialiased',
                textRendering: 'geometricPrecision',
                fontSmooth: 'always',
                pointerEvents: 'none',
              }}
            >
              {handMinimalOverlay ? (
                <div className="relative z-[2] flex h-full w-full flex-col px-2 py-[6px]">
                  {(() => {
                    const title = toDisplayName(handMinimalOverlay.title) || 'Ability';
                    const safeLength = Math.max(1, title.length);
                    const maxWidth = frameSize.width - 16;
                    const baseSize = Math.round(frameSize.width * 0.13);
                    const fitSize = Math.floor(maxWidth / (safeLength * 0.46));
                    const fontSize = Math.max(7, Math.min(baseSize, fitSize));
                    return (
                      <div
                        className="w-full rounded-md border px-2 py-[2px] text-center font-black leading-tight"
                        style={{
                          borderColor: 'rgba(127, 219, 202, 0.45)',
                          backgroundColor: 'rgba(4, 8, 12, 0.8)',
                          color: '#f3f8ff',
                          fontSize: `${fontSize}px`,
                          letterSpacing: fontSize <= 8 ? '-0.2px' : '0px',
                          textShadow: '0 0 8px rgba(127, 219, 202, 0.55)',
                          whiteSpace: 'normal',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          minHeight: `${Math.round(fontSize * 2.35)}px`,
                          textTransform: 'none',
                        }}
                      >
                        {title}
                      </div>
                    );
                  })()}
                  <div className="mt-auto w-full flex justify-center">
                    <div
                      className="rounded-full border px-3 py-[2px] text-center font-black leading-none"
                      style={{
                        minWidth: Math.max(24, Math.round(frameSize.width * 0.35)),
                        borderColor: 'rgba(232, 243, 255, 0.62)',
                        backgroundColor: 'rgba(7, 13, 20, 0.9)',
                        color: '#f2f6ff',
                        fontSize: `${Math.max(10, Math.round(frameSize.width * 0.15))}px`,
                        textShadow: '0 0 8px rgba(170, 220, 255, 0.8)',
                      }}
                    >
                      {handMinimalOverlay.cost}
                    </div>
                  </div>
                </div>
              ) : keruAbilityProfile ? (
                <div className="relative z-[2] flex h-full w-full flex-col items-center text-center px-3 pt-0 pb-0 overflow-hidden">
                  {/* 40% Header Section: Badge + Damage + Name */}
                  <div style={{ height: `${frameSize.height * 0.4}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', width: '100%', paddingTop: Math.max(6, Math.round(frameSize.height * 0.02)), gap: Math.max(3, Math.round(frameSize.height * 0.015)) }}>
                    <div
                      style={{
                        color: '#f7d24b',
                        fontWeight: 700,
                        fontSize: Math.max(6, Math.round(frameSize.width * 0.065)),
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        lineHeight: 1,
                      }}
                    >
                      ABILITY
                    </div>
                    {(() => {
                      const damageLabel = `PWR ${keruAbilityProfile.damage}`;
                      const fontSize = Math.max(8, Math.round(frameSize.width * 0.095));
                      return (
                        <div
                          style={{
                            color: '#9de3ff',
                            fontWeight: 700,
                            fontSize,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            lineHeight: 1,
                          }}
                        >
                          {damageLabel}
                        </div>
                      );
                    })()}
                    {(() => {
                      const nameLabel = (keruAbilityProfile.label || 'Ability').toUpperCase();
                      const baseNameSize = Math.round(frameSize.width * 0.105);
                      const nameFontSize = Math.max(10, baseNameSize);
                      return (
                        <div
                          style={{
                            color: '#f8f8f8',
                            fontWeight: 900,
                            fontSize: nameFontSize,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            lineHeight: 1.2,
                            maxWidth: '94%',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {nameLabel}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 35% Description Section */}
                  <div style={{ height: `${frameSize.height * 0.35}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', overflow: 'hidden', paddingLeft: Math.max(5, Math.round(frameSize.width * 0.035)), paddingRight: Math.max(5, Math.round(frameSize.width * 0.035)), paddingTop: Math.max(3, Math.round(frameSize.height * 0.01)), paddingBottom: Math.max(3, Math.round(frameSize.height * 0.01)) }}>
                    {(() => {
                      const desc = keruAbilityProfile.description ?? '';
                      const baseDescSize = Math.max(7, Math.round(frameSize.width * 0.06));
                      const descFontSize = baseDescSize;
                      return (
                        <div
                          style={{
                            color: '#d9f9f3',
                            fontSize: descFontSize,
                            lineHeight: 1.38,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {desc}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 25% Chips / Effects Section — anchored to bottom */}
                  <div style={{ height: `${frameSize.height * 0.25}px`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', paddingBottom: Math.max(4, Math.round(frameSize.height * 0.02)), paddingTop: Math.max(2, Math.round(frameSize.height * 0.005)), overflow: 'hidden' }}>
                    {keruAbilityProfile.effects.length > 0 ? (
                      <div className="flex flex-col items-center justify-center gap-1 w-full overflow-hidden">
                        {keruAbilityProfile.effects.map((fx, i) => {
                          const chipFontSize = Math.max(6, Math.round(frameSize.width * 0.052));
                          const chipPaddingX = Math.max(4, Math.round(frameSize.width * 0.03));
                          const chipPaddingY = Math.max(2, Math.round(frameSize.height * 0.012));
                          const effectColor: Record<string, string> = {
                            damage: '#ff8a8a', burn: '#ff8a8a', bleed: '#ff8a8a',
                            healing: '#7dffb3', defense: '#7dffb3',
                            armor: '#00c8ff', super_armor: '#ffd23c',
                            speed: '#9de3ff', evasion: '#9de3ff',
                            stun: '#b8d8ff', freeze: '#b8d8ff',
                            draw: '#f7d24b',
                            upgrade_card_rarity_uncommon: '#f7d24b',
                          };
                          const color = effectColor[fx.type] ?? '#9de3ff';
                          const targetLabel = fx.target.replace('_', ' ');
                          const suffix = [
                            fx.duration !== undefined ? `·${fx.duration}t` : '',
                            fx.charges !== undefined ? `·${fx.charges}c` : '',
                          ].filter(Boolean).join(' ');
                          const label = `${fx.type.toUpperCase()} ${fx.value} → ${targetLabel.toUpperCase()}${suffix ? ` ${suffix}` : ''}`;
                          return (
                            <span
                              key={`${card.id}-fx-${i}`}
                              className="rounded border bg-game-bg-dark/80 uppercase tracking-[0.06em] whitespace-nowrap"
                              style={{
                                color,
                                borderColor: `${color}60`,
                                fontSize: chipFontSize,
                                fontWeight: 600,
                                paddingLeft: chipPaddingX,
                                paddingRight: chipPaddingX,
                                paddingTop: chipPaddingY,
                                paddingBottom: chipPaddingY,
                                lineHeight: 1,
                              }}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    ) : keruAbilityProfile.tags.length > 0 ? (
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {keruAbilityProfile.tags.map((tag) => {
                          const chipFontSize = Math.max(6, Math.round(frameSize.width * 0.055));
                          const chipPaddingX = Math.max(5, Math.round(frameSize.width * 0.035));
                          const chipPaddingY = Math.max(2, Math.round(frameSize.height * 0.015));
                          return (
                            <span
                              key={`${card.id}-${tag}`}
                              className="rounded border border-cyan-400/60 bg-game-bg-dark/80 uppercase tracking-[0.08em] whitespace-nowrap"
                              style={{
                                color: '#9de3ff',
                                fontSize: chipFontSize,
                                fontWeight: 600,
                                paddingLeft: chipPaddingX,
                                paddingRight: chipPaddingX,
                                paddingTop: chipPaddingY,
                                paddingBottom: chipPaddingY,
                                lineHeight: 1,
                              }}
                            >
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : foundationActorProfile ? (
                <div className="relative z-[2] flex h-full w-full flex-col items-center text-center px-3 pt-1 pb-1 overflow-hidden">
                  {(() => {
                    const roleLabel = foundationActorProfile.role.trim().toUpperCase();
                    if (!roleLabel) return null;
                    const labelLength = Math.max(roleLabel.length, 1);
                    const maxWidth = frameSize.width - 24;
                    const baseSize = frameSize.width * 0.082;
                    const letterSpacing = Math.max(0.06, Math.min(0.14, 9 / labelLength));
                    const fitSize = Math.floor(maxWidth / (labelLength * (0.62 + letterSpacing)));
                    const fontSize = Math.max(7, Math.min(Math.round(baseSize), fitSize)) + 4;
                    return (
                      <div
                        className="relative overflow-hidden rounded-full border border-game-teal/40 bg-game-bg-dark/80 px-3 py-[3px]"
                        style={{
                          marginTop: Math.max(2, Math.round(frameSize.height * 0.01)),
                        }}
                      >
                        <div className="absolute inset-0 pointer-events-none" style={shaderOverlayStyle} />
                        <span
                          className="relative flex justify-center"
                          style={{
                            color: '#e6b31e',
                            fontWeight: 700,
                            fontSize,
                            letterSpacing: `${letterSpacing}em`,
                            textTransform: 'uppercase',
                            textShadow: '0 0 6px rgba(230, 179, 30, 0.32)',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'clip',
                          }}
                        >
                          {roleLabel}
                        </span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const nameLabel = foundationActorProfile.name.toUpperCase();
                    const nameLength = Math.max(nameLabel.length, 1);
                    const nameMaxWidth = frameSize.width * 0.9;
                    const baseNameSize = Math.round(frameSize.width * 0.13);
                    const fitNameSize = Math.floor(nameMaxWidth / (nameLength * 0.64));
                    const nameFontSize = Math.max(12, Math.min(baseNameSize, fitNameSize)) + 4;
                    return (
                      <div
                        className="relative overflow-hidden rounded-full border border-game-gold/30 bg-game-bg-dark/70 px-4 py-[4px]"
                        style={{
                          marginTop: foundationActorProfile.role
                            ? Math.max(0, Math.round(frameSize.height * 0.002))
                            : Math.max(2, Math.round(frameSize.height * 0.02)),
                        }}
                      >
                        <div className="absolute inset-0 pointer-events-none" style={shaderOverlayStyle} />
                        <span
                          className="relative flex justify-center"
                          style={{
                            color: '#f2fbff',
                            fontWeight: 900,
                            fontSize: nameFontSize,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            lineHeight: 0.95,
                            textShadow: '0 0 7px rgba(197, 236, 255, 0.38), 0 1px 0 rgba(7, 14, 21, 0.7)',
                            maxWidth: '92%',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'clip',
                          }}
                        >
                          {nameLabel}
                        </span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const compactMode = frameSize.height <= 230 || frameSize.width <= 160;
                    const desc = foundationActorProfile.description;
                    const descFontSize = compactMode
                      ? Math.max(6, Math.round(frameSize.width * 0.05))
                      : Math.max(7, Math.round(frameSize.width * 0.055));
                    const boostedDescFontSize = descFontSize + 4;
                    const chipFontSize = compactMode ? 10 : 11;
                    const targetLines = compactMode ? 2 : 3;
                    const visibleAttributes = compactMode
                      ? foundationActorProfile.attributes.slice(0, 2)
                      : foundationActorProfile.attributes.slice(0, 4);
                    const chipsBandHeight = Math.max(24, Math.round(frameSize.height * 0.22));
                    return (
                      <div style={{ width: '100%', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div
                          className="relative overflow-hidden rounded-2xl border border-game-white/15 bg-game-bg-dark/70 px-3 py-1"
                          style={{
                            marginTop: Math.max(3, Math.round(frameSize.height * 0.008)),
                            display: '-webkit-box',
                            WebkitLineClamp: targetLines,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={shaderOverlayStyle}
                          />
                          <span
                            className="relative block"
                            style={{
                              color: '#d3edf5',
                              fontSize: boostedDescFontSize,
                              lineHeight: compactMode ? 1.05 : 1.12,
                              overflow: 'hidden',
                              WebkitLineClamp: targetLines,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {desc}
                          </span>
                        </div>
                        <div
                          style={{
                            height: chipsBandHeight,
                            minHeight: chipsBandHeight,
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                            paddingBottom: compactMode ? 2 : 3,
                            marginTop: Math.max(2, Math.round(frameSize.height * 0.01)),
                            overflow: 'hidden',
                          }}
                        >
                          {visibleAttributes.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-[2px] px-1">
                              {visibleAttributes.map((attr) => (
                                <span
                                  key={`${card.id}-${attr}`}
                                  className="rounded border border-game-gold/45 bg-game-bg-dark/75 px-1 py-[1px] uppercase tracking-[0.1em] leading-[1]"
                                  style={{ color: '#e6b31e', fontSize: chipFontSize }}
                                >
                                  {attr}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : keruAspectProfile ? (
                <div className="relative z-[2] flex h-full w-full flex-col items-center text-center px-3 pt-0 pb-2 overflow-hidden">
                  <div
                    style={{
                      color: '#7fdbca',
                      fontWeight: 700,
                      fontSize: Math.max(7, Math.round(frameSize.width * 0.075)),
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      position: 'absolute',
                      left: 10,
                      top: 2,
                      lineHeight: 1,
                    }}
                  >
                    {(keruAspectProfile.rarity || 'Common').toUpperCase()}
                  </div>
                  {(() => {
                    const archetypeLabel = keruAspectProfile.archetype
                      ? `${keruAspectProfile.archetype} Archetype`
                      : 'Archetype';
                    const labelLength = Math.max(archetypeLabel.length, 1);
                    const maxWidth = frameSize.width - 24;
                    const baseSize = frameSize.width * 0.085;
                    const letterSpacing = Math.max(0.06, Math.min(0.16, 10 / labelLength));
                    const fitSize = Math.floor(maxWidth / (labelLength * (0.62 + letterSpacing)));
                    const fontSize = Math.max(7, Math.min(Math.round(baseSize), fitSize));
                    return (
                      <div
                        style={{
                          color: '#e6b31e',
                          fontWeight: 700,
                          fontSize,
                          letterSpacing: `${letterSpacing}em`,
                          textTransform: 'none',
                          marginTop: Math.max(8, Math.round(frameSize.height * 0.06)),
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'clip',
                        }}
                      >
                        {archetypeLabel}
                      </div>
                    );
                  })()}
                  {(() => {
                    const nameLabel = (keruAspectProfile.name || 'Aspect').toUpperCase();
                    const nameLength = Math.max(nameLabel.length, 1);
                    const nameMaxWidth = frameSize.width * 0.9;
                    const baseNameSize = Math.round(frameSize.width * 0.13);
                    const fitNameSize = Math.floor(nameMaxWidth / (nameLength * 0.65));
                    const nameFontSize = Math.max(12, Math.min(baseNameSize, fitNameSize));
                    return (
                      <div
                        style={{
                          color: '#f8f8f8',
                          fontWeight: 900,
                          fontSize: nameFontSize,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          lineHeight: 0.92,
                          marginTop: Math.max(2, Math.round(frameSize.height * 0.008)),
                          maxWidth: '92%',
                          textAlign: 'center',
                        }}
                      >
                        <div>ASPECT OF</div>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip' }}>
                          {nameLabel}
                        </div>
                      </div>
                    );
                  })()}
                  {(() => {
                    const compactMode = frameSize.height <= 230 || frameSize.width <= 160;
                    const desc = keruAspectProfile.description ?? '';
                    const descFontSize = compactMode
                      ? Math.max(6, Math.round(frameSize.width * 0.05))
                      : Math.max(7, Math.round(frameSize.width * 0.06));
                    const targetLines = compactMode ? 2 : (keruAspectProfile.attributes.length > 0 ? 3 : 4);
                    const visibleAttributes = compactMode
                      ? keruAspectProfile.attributes.slice(0, 2)
                      : keruAspectProfile.attributes;
                    return (
                      <div
                        style={{
                          width: '100%',
                          minHeight: 0,
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                          marginTop: Math.max(6, Math.round(frameSize.height * 0.02)),
                        }}
                      >
                        <div
                          style={{
                            color: '#d9f9f3',
                            fontSize: descFontSize,
                            lineHeight: compactMode ? 1.05 : 1.15,
                            overflow: 'hidden',
                            paddingLeft: Math.max(4, Math.round(frameSize.width * 0.03)),
                            paddingRight: Math.max(4, Math.round(frameSize.width * 0.03)),
                            display: '-webkit-box',
                            WebkitLineClamp: targetLines,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {desc}
                        </div>
                        {visibleAttributes.length > 0 && (
                          <div
                            style={{
                              marginTop: compactMode ? 3 : 6,
                              minHeight: 0,
                              overflow: 'hidden',
                            }}
                          >
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              {visibleAttributes.map((attr) => (
                                <span
                                  key={`${card.id}-${attr}`}
                                  className="rounded border border-game-gold/60 bg-game-bg-dark/80 px-1.5 py-[2px] text-[8px] uppercase tracking-[0.12em]"
                                  style={{ color: '#e6b31e' }}
                                >
                                  {attr}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : cardTitleMeta ? (
                <div className="relative z-[2] flex flex-col items-center gap-0">
                  <span
                    style={{
                      color: cardTitleMeta.titleColor,
                      fontWeight: 800,
                      fontSize: Math.max(9, Math.round(frameSize.width * 0.11)),
                      letterSpacing: '0.16em',
                      lineHeight: 0.92,
                      textShadow: `0 0 8px ${cardTitleMeta.titleColor}88`,
                    }}
                  >
                    {cardTitleMeta.title}
                  </span>
                  <span
                    style={{
                      color: cardTitleMeta.subtitleColor,
                      fontWeight: 800,
                      fontSize: Math.max(9, Math.round(frameSize.width * 0.1)),
                      letterSpacing: '0.12em',
                      lineHeight: 0.9,
                      textShadow: `0 0 8px ${cardTitleMeta.subtitleColor}88`,
                    }}
                  >
                    {cardTitleMeta.subtitle}
                  </span>
                  {renderedRpgDescription ? (
                    <div
                      style={{
                        color: '#d9f9f3',
                        fontSize: Math.max(7, Math.round(frameSize.width * 0.07)),
                        lineHeight: 1.05,
                        maxWidth: '92%',
                        textAlign: 'center',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        textShadow: '0 0 8px rgba(120, 230, 210, 0.35)',
                      }}
                    >
                      {renderedRpgDescription}
                    </div>
                  ) : (
                    <span
                      style={{
                        color: '#f4f6ff',
                        fontWeight: 900,
                        fontSize: Math.max(10, Math.round(frameSize.width * 0.14)),
                        letterSpacing: '0.06em',
                        lineHeight: 0.9,
                        textShadow: '0 0 8px rgba(170, 220, 255, 0.85)',
                      }}
                    >
                      {getRankDisplay(card.rank)}
                    </span>
                  )}
                </div>
              ) : (
                <span
                  className="relative z-[2]"
                  style={{
                    color: '#050505',
                    fontWeight: 800,
                    WebkitTextStroke: '0px transparent',
                    textShadow: `
                      0 0 1px rgba(255, 255, 255, 0.85),
                      0 0 2px rgba(255, 255, 255, 0.6),
                      1px 0 0 rgba(255, 255, 255, 0.95),
                      -1px 0 0 rgba(255, 255, 255, 0.95),
                      0 1px 0 rgba(255, 255, 255, 0.95),
                      0 -1px 0 rgba(255, 255, 255, 0.95)
                    `,
                  }}
                >
                  {getRankDisplay(card.rank)}
                </span>
              )}
            </div>
          )}
          {false && hasOrimSlots ? ( // TEMP: hide orim presentation while iterating on new card/orim UI
            <div className="flex items-center justify-center gap-1">
              {orimDisplay.length > 0
                ? orimDisplay.map((slot) => {
                  const hasTooltip = !!(slot.title || slot.description || (slot.meta && slot.meta.length > 0));
                  const content = (
                    <div className="text-xs text-game-white">
                      {slot.title && <div className="text-game-teal font-bold mb-1">{slot.title}</div>}
                      {slot.meta && slot.meta.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-[10px] text-game-white/70 mb-1">
                          {slot.meta.map((entry, index) => (
                            <span key={`${slot.id}-meta-${index}`}>{entry}</span>
                          ))}
                        </div>
                      )}
                      {slot.description && (
                        <div className="text-[10px] text-game-white/60">
                          {slot.description}
                        </div>
                      )}
                    </div>
                  );
                  const glyphNode = (
                    <div
                      className="relative flex items-center justify-center rounded-full"
                      style={{
                        width: orimSlotSize,
                        height: orimSlotSize,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: slot.color ?? '#7fdbca',
                        color: slot.color ?? '#7fdbca',
                        fontSize: Math.max(6, Math.round(orimSlotSize * 0.7)),
                        opacity: slot.dim ? 0.4 : 1,
                      }}
                    >
                      <span style={{ zIndex: 1 }}>{slot.glyph}</span>
                    </div>
                  );
                  if (!hasTooltip) return <div key={slot.id}>{glyphNode}</div>;
                  return (
                    <Tooltip key={slot.id} content={content} pinnable>
                      {glyphNode}
                    </Tooltip>
                  );
                })
                : orimSlots.map((slot, index) => {
                  const element = index === 0
                    ? (card?.tokenReward ?? (card?.element && card.element !== 'N' ? card.element : undefined))
                    : undefined;
                  const suit = element ? ELEMENT_TO_SUIT[element] : null;
                  const slotColor = suit
                    ? (suit === '💧'
                      ? (showGraphics ? '#050505' : '#f8f8ff')
                      : SUIT_COLORS[suit])
                    : '#7fdbca';
                  const slotDisplay = suit
                    ? (suit === '💧' ? 'W' : getSuitDisplay(suit, showGraphics))
                    : (showGraphics ? '◌' : '-');
                  return (
                    <div
                      key={slot.id}
                      className="flex items-center justify-center rounded-full"
                      style={{
                        width: orimSlotSize,
                        height: orimSlotSize,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: slotColor,
                        color: slotColor,
                        fontSize: Math.max(6, Math.round(orimSlotSize * 0.7)),
                        opacity: suit ? 1 : 0.5,
                      }}
                    >
                      {slotDisplay}
                    </div>
                  );
                })}
            </div>
          ) : (!maskValue && !foundationOverlay && !handMinimalOverlay && !cardTitleMeta && !keruAspectProfile && !foundationActorProfile) ? (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
              <div
                className="text-xs force-sharp"
                style={{
                  transform: 'translateZ(0)',
                  WebkitFontSmoothing: 'subpixel-antialiased',
                  fontSize: suitFontSizeOverride ? `${suitFontSizeOverride}px` : undefined,
                  color: isWaterElement ? (showGraphics ? '#050505' : '#f8f8ff') : undefined,
                  textShadow: isWaterElement ? 'none' : undefined,
                  mixBlendMode: isWaterElement ? 'normal' : undefined,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 16,
                    padding: '1px 6px',
                    borderRadius: 999,
                    border: elementChipStyle.border,
                    background: elementChipStyle.background,
                    color: elementChipStyle.color,
                    textShadow: elementChipStyle.textShadow,
                    boxShadow: elementChipStyle.boxShadow,
                    lineHeight: 1,
                  }}
                >
                  {suitDisplayContent}
                </span>
              </div>
            </div>
          ) : null}
          {cooldownValue > 0 && cooldownMax > 0 && !handMinimalOverlay && (
            <div className="absolute bottom-1 left-1 right-1 text-[9px] text-game-white/70 pointer-events-none">
              <span>Cooling down</span>
            </div>
          )}
        </div>
      )}
      </CardFrame>
      {canTap && !faceDown && (
        <div
          className="absolute top-2 right-2 z-50 flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.35em] text-white/80"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Tap
        </div>
      )}
      </div>
      {showRipOverlay && !faceDown && (
        <HorizontalRipThreeEffect
          sourceRef={cardRef}
          trigger={ripTrigger}
          width={frameSize.width}
          height={frameSize.height}
          onSnapshotReady={() => setHideDomCard(true)}
        />
      )}
      {showLegacyShine && (
        <RarityAura
          rarity={effectiveRarity}
          cardWidth={frameSize.width}
          cardHeight={frameSize.height}
          layer="front"
          hyp={holoStyles['--hyp']}
        />
      )}
    </div>
  );
});
