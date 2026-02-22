import { useCallback, useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { mainWorldMap } from '../data/worldMap';
import type { Direction } from '../components/Compass';
import type { ExplorationMapEdge, ExplorationMapNode } from '../components/ExplorationMap';

type ForcedPathStep = {
  x: number;
  y: number;
};

type TraversalContext = {
  currentNode: ExplorationMapNode;
  targetX: number;
  targetY: number;
};

interface UseExplorationTraversalControllerArgs {
  explorationHeading: Direction;
  pathingLocked: boolean;
  isCurrentExplorationTableauCleared: boolean;
  worldBlockedCellKeys: Set<string>;
  worldBlockedEdges: Set<string>;
  worldForcedPath: ForcedPathStep[];
  explorationNodesRef: MutableRefObject<ExplorationMapNode[]>;
  explorationEdgesRef: MutableRefObject<ExplorationMapEdge[]>;
  explorationCurrentNodeIdRef: MutableRefObject<string>;
  explorationTrailNodeIdsRef: MutableRefObject<string[]>;
  explorationHeadingRef: MutableRefObject<Direction>;
  setExplorationNodes: Dispatch<SetStateAction<ExplorationMapNode[]>>;
  setExplorationEdges: Dispatch<SetStateAction<ExplorationMapEdge[]>>;
  setExplorationCurrentNodeId: Dispatch<SetStateAction<string>>;
  setExplorationTrailNodeIds: Dispatch<SetStateAction<string[]>>;
}

const COMPASS_DELTA: Record<Direction, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  NE: { dx: 1, dy: -1 },
  E: { dx: 1, dy: 0 },
  SE: { dx: 1, dy: 1 },
  S: { dx: 0, dy: 1 },
  SW: { dx: -1, dy: 1 },
  W: { dx: -1, dy: 0 },
  NW: { dx: -1, dy: -1 },
};

export function useExplorationTraversalController({
  explorationHeading,
  pathingLocked,
  isCurrentExplorationTableauCleared,
  worldBlockedCellKeys,
  worldBlockedEdges,
  worldForcedPath,
  explorationNodesRef,
  explorationEdgesRef,
  explorationCurrentNodeIdRef,
  explorationTrailNodeIdsRef,
  explorationHeadingRef,
  setExplorationNodes,
  setExplorationEdges,
  setExplorationCurrentNodeId,
  setExplorationTrailNodeIds,
}: UseExplorationTraversalControllerArgs) {
  const resolveTraversalContext = useCallback((direction: Direction): TraversalContext | null => {
    const prevNodes = explorationNodesRef.current;
    const currentNode = prevNodes.find((node) => node.id === explorationCurrentNodeIdRef.current) ?? prevNodes[0];
    if (!currentNode) return null;
    const { dx, dy } = COMPASS_DELTA[direction] ?? COMPASS_DELTA.N;
    return {
      currentNode,
      targetX: currentNode.x + dx,
      targetY: currentNode.y + dy,
    };
  }, [explorationCurrentNodeIdRef, explorationNodesRef]);

  const canTraverseContext = useCallback(({ currentNode, targetX, targetY }: TraversalContext): boolean => {
    if (!pathingLocked) return true;
    const currentKey = `${currentNode.x},${currentNode.y}`;
    const targetKey = `${targetX},${targetY}`;
    if (worldBlockedCellKeys.has(targetKey)) return false;
    if (worldBlockedEdges.has(`${currentKey}->${targetKey}`)) return false;

    const blockedByConditionalEdge = (mainWorldMap.conditionalEdges ?? []).some((edge) => {
      if (edge.requirement !== 'source_tableau_cleared') return false;
      const forward = currentNode.x === edge.from.col
        && currentNode.y === edge.from.row
        && targetX === edge.to.col
        && targetY === edge.to.row;
      const reverse = edge.bidirectional !== false
        && currentNode.x === edge.to.col
        && currentNode.y === edge.to.row
        && targetX === edge.from.col
        && targetY === edge.from.row;
      if (!forward && !reverse) return false;
      return !isCurrentExplorationTableauCleared;
    });
    if (blockedByConditionalEdge) return false;

    if (mainWorldMap.tutorialRail?.lockUntilPathComplete !== false && worldForcedPath.length >= 2) {
      const forcedIndex = worldForcedPath.findIndex((step) => step.x === currentNode.x && step.y === currentNode.y);
      if (forcedIndex >= 0 && forcedIndex < worldForcedPath.length - 1) {
        const required = worldForcedPath[forcedIndex + 1];
        if (targetX !== required.x || targetY !== required.y) return false;
      }
    }

    return true;
  }, [isCurrentExplorationTableauCleared, pathingLocked, worldBlockedCellKeys, worldBlockedEdges, worldForcedPath]);

  const canAdvanceExplorationMap = useCallback((direction: Direction): boolean => {
    const context = resolveTraversalContext(direction);
    if (!context) return false;
    return canTraverseContext(context);
  }, [canTraverseContext, resolveTraversalContext]);

  const canAdvanceExplorationHeading = useMemo(
    () => canAdvanceExplorationMap(explorationHeading),
    [canAdvanceExplorationMap, explorationHeading]
  );

  const advanceExplorationMap = useCallback((direction: Direction): boolean => {
    const context = resolveTraversalContext(direction);
    if (!context) return false;
    if (!canTraverseContext(context)) return false;

    const { currentNode, targetX, targetY } = context;
    const prevNodes = explorationNodesRef.current;
    const existingIndex = prevNodes.findIndex((node) => node.x === targetX && node.y === targetY);
    let nextNodes: ExplorationMapNode[];
    let targetNodeId: string;
    if (existingIndex >= 0) {
      targetNodeId = prevNodes[existingIndex].id;
      nextNodes = prevNodes.map((node, index) => (
        index === existingIndex ? { ...node, visits: node.visits + 1, heading: direction } : node
      ));
    } else {
      targetNodeId = `node-${targetX}-${targetY}`;
      const depth = Math.min(6, Math.floor(prevNodes.length / 3));
      nextNodes = [...prevNodes, { id: targetNodeId, heading: direction, x: targetX, y: targetY, z: depth, visits: 1 }];
    }

    nextNodes = nextNodes.map((node) => (
      node.id === currentNode.id
        ? { ...node, cleared: isCurrentExplorationTableauCleared || node.cleared === true }
        : node
    ));

    const edgeKey = `${currentNode.id}->${targetNodeId}`;
    const prevEdges = explorationEdgesRef.current;
    const foundEdge = prevEdges.find((edge) => edge.id === edgeKey);
    const nextEdges = foundEdge
      ? prevEdges.map((edge) => (edge.id === edgeKey ? { ...edge, traversals: edge.traversals + 1 } : edge))
      : [...prevEdges, { id: edgeKey, fromId: currentNode.id, toId: targetNodeId, traversals: 1 }];
    const nextTrail = [...explorationTrailNodeIdsRef.current, targetNodeId];

    explorationCurrentNodeIdRef.current = targetNodeId;
    explorationNodesRef.current = nextNodes;
    explorationEdgesRef.current = nextEdges;
    explorationTrailNodeIdsRef.current = nextTrail;
    setExplorationNodes(nextNodes);
    setExplorationCurrentNodeId(targetNodeId);
    setExplorationTrailNodeIds(nextTrail);
    setExplorationEdges(nextEdges);
    return true;
  }, [
    canTraverseContext,
    explorationCurrentNodeIdRef,
    explorationEdgesRef,
    explorationNodesRef,
    explorationTrailNodeIdsRef,
    isCurrentExplorationTableauCleared,
    resolveTraversalContext,
    setExplorationCurrentNodeId,
    setExplorationEdges,
    setExplorationNodes,
    setExplorationTrailNodeIds,
  ]);

  const teleportToExplorationNode = useCallback((targetX: number, targetY: number) => {
    const prevNodes = explorationNodesRef.current;
    const existingIndex = prevNodes.findIndex((node) => node.x === targetX && node.y === targetY);
    let nextNodes: ExplorationMapNode[];
    let targetNodeId: string;
    if (existingIndex >= 0) {
      targetNodeId = prevNodes[existingIndex].id;
      nextNodes = prevNodes.map((node, index) => (
        index === existingIndex ? { ...node, visits: node.visits + 1 } : node
      ));
    } else {
      targetNodeId = `node-${targetX}-${targetY}`;
      const depth = Math.min(6, Math.floor(prevNodes.length / 3));
      nextNodes = [...prevNodes, {
        id: targetNodeId,
        heading: explorationHeadingRef.current,
        x: targetX,
        y: targetY,
        z: depth,
        visits: 1,
      }];
    }

    const nextTrail = [...explorationTrailNodeIdsRef.current, targetNodeId];
    explorationCurrentNodeIdRef.current = targetNodeId;
    explorationNodesRef.current = nextNodes;
    explorationTrailNodeIdsRef.current = nextTrail;
    setExplorationNodes(nextNodes);
    setExplorationCurrentNodeId(targetNodeId);
    setExplorationTrailNodeIds(nextTrail);
  }, [
    explorationCurrentNodeIdRef,
    explorationHeadingRef,
    explorationNodesRef,
    explorationTrailNodeIdsRef,
    setExplorationCurrentNodeId,
    setExplorationNodes,
    setExplorationTrailNodeIds,
  ]);

  const stepExplorationBackward = useCallback((): boolean => {
    const trail = explorationTrailNodeIdsRef.current;
    if (trail.length <= 1) return false;
    const nextTrail = trail.slice(0, -1);
    const nextNodeId = nextTrail[nextTrail.length - 1];
    explorationTrailNodeIdsRef.current = nextTrail;
    explorationCurrentNodeIdRef.current = nextNodeId;
    setExplorationTrailNodeIds(nextTrail);
    setExplorationCurrentNodeId(nextNodeId);
    return true;
  }, [
    explorationCurrentNodeIdRef,
    explorationTrailNodeIdsRef,
    setExplorationCurrentNodeId,
    setExplorationTrailNodeIds,
  ]);

  return {
    canAdvanceExplorationMap,
    canAdvanceExplorationHeading,
    advanceExplorationMap,
    teleportToExplorationNode,
    stepExplorationBackward,
  };
}
