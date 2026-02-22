import { useCallback, useEffect, type MutableRefObject } from 'react';
import type { Card as CardType } from '../engine/types';
import { ELEMENT_TO_SUIT } from '../engine/constants';
import { createPoiTableauPreset, type PoiTableauPresetId } from '../data/poiTableaus';
import type { Direction } from '../components/Compass';

type MajorDirection = 'N' | 'E' | 'S' | 'W';
type MinorDirection = 'NE' | 'SE' | 'SW' | 'NW';
type TableauColumnSource =
  | { kind: 'major'; direction: MajorDirection; columnIndex: number }
  | { kind: 'minor-center'; direction: MinorDirection };

const DEFAULT_TABLEAU_COLUMNS = 7;
const DEFAULT_TABLEAU_DEPTH = 4;
const ELEMENT_POOL: Array<CardType['element']> = ['N', 'A', 'E', 'W', 'F', 'D', 'L'];

interface UseExplorationTableauDisplaySyncArgs {
  isRpgMode: boolean;
  hasSpawnedEnemies: boolean;
  poiMapsReady: boolean;
  explorationCurrentNodeId: string;
  explorationHeading: Direction;
  currentTableaus: CardType[][];
  setBiomeTableaus?: (tableaus: CardType[][]) => void;
  getExplorationNodeCoordinates: (nodeId: string) => { x: number; y: number } | null;
  getColumnSourcesForDirection: (direction: Direction) => TableauColumnSource[];
  poiByCoordinateKey: Map<string, PoiTableauPresetId>;
  poiPresenceByCoordinateKey: Map<string, { id: string; name: string }>;
  cloneCard: (card: CardType) => CardType;
  cloneTableaus: (tableaus: CardType[][]) => CardType[][];
  skipPoiCommitRef: MutableRefObject<boolean>;
  explorationDisplayedContextRef: MutableRefObject<{ nodeId: string; heading: Direction } | null>;
  explorationMajorTableauCacheRef: MutableRefObject<Record<string, CardType[][]>>;
  explorationMinorCenterCacheRef: MutableRefObject<Record<string, CardType[]>>;
  explorationPoiTableauCacheRef: MutableRefObject<Record<string, CardType[][]>>;
}

export function useExplorationTableauDisplaySync({
  isRpgMode,
  hasSpawnedEnemies,
  poiMapsReady,
  explorationCurrentNodeId,
  explorationHeading,
  currentTableaus,
  setBiomeTableaus,
  getExplorationNodeCoordinates,
  getColumnSourcesForDirection,
  poiByCoordinateKey,
  poiPresenceByCoordinateKey,
  cloneCard,
  cloneTableaus,
  skipPoiCommitRef,
  explorationDisplayedContextRef,
  explorationMajorTableauCacheRef,
  explorationMinorCenterCacheRef,
  explorationPoiTableauCacheRef,
}: UseExplorationTableauDisplaySyncArgs) {
  const getPoiTableauPresetForNode = useCallback((nodeId: string): PoiTableauPresetId | null => {
    const coords = getExplorationNodeCoordinates(nodeId);
    if (!coords) return null;
    return poiByCoordinateKey.get(`${coords.x},${coords.y}`) ?? null;
  }, [getExplorationNodeCoordinates, poiByCoordinateKey]);

  const hasPoiForNode = useCallback((nodeId: string): boolean => {
    const coords = getExplorationNodeCoordinates(nodeId);
    if (!coords) return false;
    return poiPresenceByCoordinateKey.has(`${coords.x},${coords.y}`);
  }, [getExplorationNodeCoordinates, poiPresenceByCoordinateKey]);

  const ensurePoiPresetTableaus = useCallback((nodeId: string): CardType[][] | null => {
    const presetId = getPoiTableauPresetForNode(nodeId);
    if (!presetId) return null;
    const cacheKey = `${nodeId}|poi|${presetId}`;
    const cached = explorationPoiTableauCacheRef.current[cacheKey];
    const generated = cached ?? createPoiTableauPreset(presetId);
    explorationPoiTableauCacheRef.current[cacheKey] = generated;
    return generated;
  }, [explorationPoiTableauCacheRef, getPoiTableauPresetForNode]);

  const hashString = useCallback((value: string) => {
    let hash = 2166136261 >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }, []);

  const createPrng = useCallback((seed: number) => {
    let state = seed >>> 0;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }, []);

  const createDeterministicCard = useCallback((
    nodeId: string,
    directionLabel: string,
    columnIndex: number,
    depthIndex: number
  ): CardType => {
    const seed = hashString(`${nodeId}:${directionLabel}:${columnIndex}:${depthIndex}`);
    const rand = createPrng(seed);
    const rank = Math.floor(rand() * 13) + 1;
    const element = ELEMENT_POOL[Math.floor(rand() * ELEMENT_POOL.length)] ?? 'N';
    return {
      id: `exp-${nodeId}-${directionLabel}-${columnIndex}-${depthIndex}-${seed.toString(36)}`,
      rank,
      element,
      suit: ELEMENT_TO_SUIT[element],
      tableauStepIndex: Math.max(1, DEFAULT_TABLEAU_DEPTH - depthIndex),
      tokenReward: element !== 'N' ? element : undefined,
      orimSlots: [],
    };
  }, [createPrng, hashString]);

  const createDeterministicTableaus = useCallback((nodeId: string, directionLabel: string) => (
    Array.from({ length: DEFAULT_TABLEAU_COLUMNS }, (_, columnIndex) => (
      Array.from({ length: DEFAULT_TABLEAU_DEPTH }, (_, depthIndex) => (
        createDeterministicCard(nodeId, directionLabel, columnIndex, depthIndex)
      ))
    ))
  ), [createDeterministicCard]);

  const getMajorCacheKey = useCallback((nodeId: string, direction: MajorDirection) => `${nodeId}|major|${direction}`, []);
  const getMinorCenterCacheKey = useCallback((nodeId: string, direction: MinorDirection) => `${nodeId}|minor-center|${direction}`, []);

  const ensureMajorDirectionTableaus = useCallback((nodeId: string, direction: MajorDirection) => {
    const key = getMajorCacheKey(nodeId, direction);
    const cached = explorationMajorTableauCacheRef.current[key];
    if (cached) return cached;
    const generated = createDeterministicTableaus(nodeId, direction);
    explorationMajorTableauCacheRef.current[key] = generated;
    return generated;
  }, [createDeterministicTableaus, explorationMajorTableauCacheRef, getMajorCacheKey]);

  const ensureMinorCenterTableau = useCallback((nodeId: string, direction: MinorDirection) => {
    const key = getMinorCenterCacheKey(nodeId, direction);
    const cached = explorationMinorCenterCacheRef.current[key];
    if (cached) return cached;
    const generated = createDeterministicTableaus(nodeId, direction)[3] ?? [];
    explorationMinorCenterCacheRef.current[key] = generated;
    return generated;
  }, [createDeterministicTableaus, explorationMinorCenterCacheRef, getMinorCenterCacheKey]);

  const getDisplayTableausForHeading = useCallback((nodeId: string, direction: Direction): CardType[][] => {
    if (!hasPoiForNode(nodeId)) return [];
    const poiPresetTableaus = ensurePoiPresetTableaus(nodeId);
    if (poiPresetTableaus) return cloneTableaus(poiPresetTableaus);
    if (direction.length === 1) {
      return cloneTableaus(ensureMajorDirectionTableaus(nodeId, direction as MajorDirection));
    }
    const sources = getColumnSourcesForDirection(direction);
    const columns = sources.map((source) => {
      if (source.kind === 'major') {
        const major = ensureMajorDirectionTableaus(nodeId, source.direction);
        return major[source.columnIndex] ?? [];
      }
      return ensureMinorCenterTableau(nodeId, source.direction);
    });
    return cloneTableaus(columns);
  }, [
    cloneTableaus,
    ensureMajorDirectionTableaus,
    ensureMinorCenterTableau,
    ensurePoiPresetTableaus,
    getColumnSourcesForDirection,
    hasPoiForNode,
  ]);

  const commitDisplayedTableausToCaches = useCallback((nodeId: string, direction: Direction, displayed: CardType[][]) => {
    const presetId = getPoiTableauPresetForNode(nodeId);
    if (presetId) {
      const cacheKey = `${nodeId}|poi|${presetId}`;
      if (presetId === 'initial_actions_00' || presetId === 'initial_actions_01' || presetId === 'initial_actions_02') {
        const previous = explorationPoiTableauCacheRef.current[cacheKey] ?? createPoiTableauPreset(presetId);
        const next = Array.from({ length: 7 }, (_, index) => {
          const prevTop = previous[index]?.[0];
          const currentTop = displayed[index]?.[displayed[index].length - 1];
          if (!prevTop) return [];
          if (!currentTop) return [];
          if (currentTop.id !== prevTop.id) return [];
          return [cloneCard(currentTop)];
        });
        explorationPoiTableauCacheRef.current[cacheKey] = next;
        return;
      }
      explorationPoiTableauCacheRef.current[cacheKey] = displayed.map((stack) => stack.map((card) => cloneCard(card)));
      return;
    }
    const sources = getColumnSourcesForDirection(direction);
    sources.forEach((source, index) => {
      const stack = displayed[index] ?? [];
      if (source.kind === 'major') {
        const majorKey = getMajorCacheKey(nodeId, source.direction);
        const major = explorationMajorTableauCacheRef.current[majorKey]
          ?? ensureMajorDirectionTableaus(nodeId, source.direction);
        major[source.columnIndex] = stack.map((card) => cloneCard(card));
        explorationMajorTableauCacheRef.current[majorKey] = major;
        return;
      }
      const minorKey = getMinorCenterCacheKey(nodeId, source.direction);
      explorationMinorCenterCacheRef.current[minorKey] = stack.map((card) => cloneCard(card));
    });
  }, [
    cloneCard,
    ensureMajorDirectionTableaus,
    explorationMajorTableauCacheRef,
    explorationMinorCenterCacheRef,
    explorationPoiTableauCacheRef,
    getColumnSourcesForDirection,
    getMajorCacheKey,
    getMinorCenterCacheKey,
    getPoiTableauPresetForNode,
  ]);

  const areTableausEquivalent = useCallback((left: CardType[][], right: CardType[][]) => {
    if (left.length !== right.length) return false;
    for (let col = 0; col < left.length; col += 1) {
      const l = left[col] ?? [];
      const r = right[col] ?? [];
      if (l.length !== r.length) return false;
      for (let row = 0; row < l.length; row += 1) {
        if (l[row]?.id !== r[row]?.id) return false;
      }
    }
    return true;
  }, []);

  useEffect(() => {
    if (!(isRpgMode && !hasSpawnedEnemies)) return;
    if (!setBiomeTableaus) return;
    if (!poiMapsReady) return;
    const nodeId = explorationCurrentNodeId;
    const heading = explorationHeading;
    const displayedContext = explorationDisplayedContextRef.current;
    if (displayedContext && !skipPoiCommitRef.current) {
      commitDisplayedTableausToCaches(displayedContext.nodeId, displayedContext.heading, currentTableaus);
    }
    if (skipPoiCommitRef.current) {
      skipPoiCommitRef.current = false;
    }
    const desiredDisplay = getDisplayTableausForHeading(nodeId, heading);
    if (!areTableausEquivalent(currentTableaus, desiredDisplay)) {
      setBiomeTableaus(desiredDisplay);
      explorationDisplayedContextRef.current = { nodeId, heading };
      return;
    }
    explorationDisplayedContextRef.current = { nodeId, heading };
  }, [
    areTableausEquivalent,
    commitDisplayedTableausToCaches,
    currentTableaus,
    explorationCurrentNodeId,
    explorationDisplayedContextRef,
    explorationHeading,
    getDisplayTableausForHeading,
    hasSpawnedEnemies,
    isRpgMode,
    poiMapsReady,
    setBiomeTableaus,
    skipPoiCommitRef,
  ]);
}
