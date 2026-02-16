import { memo, useCallback, useMemo, useRef } from 'react';
import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react';

export type EnhancementNodeDef = {
  id: string;
  label?: string;
  xPct: number;
  yPct: number;
  requires: string[];
  locked?: boolean;
  maxPower?: number;
  size?: 'major' | 'minor';
};

export type EnhancementEdgeDef = [string, string];

export const DEFAULT_ORIM_ENHANCEMENT_NODES: EnhancementNodeDef[] = [
  { id: 'core', label: 'Core', xPct: 50, yPct: 52, requires: [], maxPower: 1, size: 'major' },
  { id: 'echo', label: 'Echo', xPct: 38, yPct: 36, requires: ['core'], maxPower: 1, size: 'minor' },
  { id: 'flare', label: 'Flare', xPct: 62, yPct: 36, requires: ['core'], maxPower: 1, size: 'minor' },
  { id: 'ward', label: 'Ward', xPct: 30, yPct: 56, requires: ['echo'], maxPower: 1, size: 'minor' },
  { id: 'fang', label: 'Fang', xPct: 70, yPct: 56, requires: ['flare'], maxPower: 1, size: 'minor' },
  { id: 'aegis', label: 'Aegis', xPct: 40, yPct: 72, requires: ['ward'], maxPower: 1, size: 'minor' },
  { id: 'surge', label: 'Surge', xPct: 60, yPct: 72, requires: ['fang'], maxPower: 1, size: 'minor' },
  { id: 'apex', label: 'Apex', xPct: 50, yPct: 22, requires: ['echo', 'flare'], maxPower: 1, size: 'major' },
];

export const DEFAULT_ORIM_ENHANCEMENT_EDGES: EnhancementEdgeDef[] = [
  ['core', 'echo'],
  ['core', 'flare'],
  ['echo', 'ward'],
  ['flare', 'fang'],
  ['ward', 'aegis'],
  ['fang', 'surge'],
  ['echo', 'apex'],
  ['flare', 'apex'],
];

function parseDroppedOrimLabel(event: DragEvent): string | null {
  const jsonPayload = event.dataTransfer.getData('application/json');
  if (jsonPayload) {
    try {
      const parsed = JSON.parse(jsonPayload) as Record<string, unknown>;
      const id = typeof parsed.orimId === 'string'
        ? parsed.orimId
        : (typeof parsed.id === 'string' ? parsed.id : null);
      const name = typeof parsed.orimName === 'string'
        ? parsed.orimName
        : (typeof parsed.name === 'string' ? parsed.name : null);
      if (name && name.trim()) return name.trim();
      if (id && id.trim()) return id.trim();
    } catch {
      // Ignore malformed payloads and fall through to other payload types.
    }
  }
  const explicitOrim = event.dataTransfer.getData('text/orim-id');
  if (explicitOrim && explicitOrim.trim()) return explicitOrim.trim();
  const plain = event.dataTransfer.getData('text/plain');
  if (!plain || !plain.trim()) return null;
  return plain.trim();
}

export const OrimEnhancementsGrid = memo(function OrimEnhancementsGrid({
  assignments,
  onAssign,
  onClear,
  accent,
  readOnly = false,
  title = 'ORIM ENHANCEMENTS',
  nodes = DEFAULT_ORIM_ENHANCEMENT_NODES,
  edges = DEFAULT_ORIM_ENHANCEMENT_EDGES,
  selectedNodeId,
  onNodeSelect,
  selectedEdgeId,
  onEdgeSelect,
  movableNodeId,
  onNodeMove,
  getNodeTitle,
  onNodeHoverChange,
}: {
  assignments: Record<string, string | undefined>;
  onAssign: (nodeId: string, value: string) => void;
  onClear: (nodeId: string) => void;
  accent: string;
  readOnly?: boolean;
  title?: string;
  nodes?: EnhancementNodeDef[];
  edges?: EnhancementEdgeDef[];
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  selectedEdgeId?: string | null;
  onEdgeSelect?: (edgeId: string | null) => void;
  movableNodeId?: string | null;
  onNodeMove?: (nodeId: string, xPct: number, yPct: number) => void;
  getNodeTitle?: (node: EnhancementNodeDef) => string | undefined;
  onNodeHoverChange?: (nodeId: string | null) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const nodeById = useMemo(
    () => Object.fromEntries(nodes.map((node) => [node.id, node])),
    [nodes]
  );
  const isUnlocked = useCallback((node: EnhancementNodeDef) => {
    if (node.locked) return false;
    return node.requires.length === 0 || node.requires.every((reqId) => !!assignments[reqId]);
  }, [assignments]);

  const beginNodeMove = useCallback((event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => {
    if (!onNodeMove || (movableNodeId !== '*' && movableNodeId !== nodeId)) return;
    if (!rootRef.current) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const updateFromPointer = (clientX: number, clientY: number) => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const xPct = Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100));
      const yPct = Math.max(6, Math.min(94, ((clientY - rect.top) / rect.height) * 100));
      onNodeMove(nodeId, xPct, yPct);
    };

    const handleMove = (moveEvent: PointerEvent) => {
      updateFromPointer(moveEvent.clientX, moveEvent.clientY);
    };
    const handleEnd = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    updateFromPointer(event.clientX, event.clientY);
  }, [movableNodeId, onNodeMove]);

  return (
    <div ref={rootRef} className="absolute inset-0 p-3">
      <div className="absolute top-2 left-2 text-[10px] tracking-[2px] font-bold text-game-teal/80">
        {title}
      </div>
      <div
        className="absolute inset-0 pointer-events-none opacity-45"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 52%, rgba(127, 219, 202, 0.17) 0%, rgba(127, 219, 202, 0) 42%),
            repeating-radial-gradient(circle at 50% 52%, rgba(127, 219, 202, 0.16) 0 2px, rgba(127, 219, 202, 0) 2px 26px)
          `,
        }}
      />
      <svg className="absolute inset-0 w-full h-full">
        {edges.map(([fromId, toId]) => {
          const fromNode = nodeById[fromId];
          const toNode = nodeById[toId];
          if (!fromNode || !toNode) return null;
          const fromActive = !!assignments[fromId];
          const toOpen = isUnlocked(toNode);
          const toAssigned = !!assignments[toId];
          const readyLink = fromActive && toOpen && !toAssigned;
          const edgeId = `${fromId}->${toId}`;
          const selectedEdge = selectedEdgeId === edgeId || selectedEdgeId === `${toId}->${fromId}`;
          return (
            <g key={`${fromId}-${toId}`}>
              <line
                x1={`${fromNode.xPct}%`}
                y1={`${fromNode.yPct}%`}
                x2={`${toNode.xPct}%`}
                y2={`${toNode.yPct}%`}
                stroke={selectedEdge
                  ? 'rgba(247, 210, 75, 0.95)'
                  : (readyLink
                    ? 'rgba(127, 219, 202, 0.9)'
                    : (fromActive || toOpen ? 'rgba(127, 219, 202, 0.72)' : 'rgba(127, 219, 202, 0.22)'))}
                strokeWidth={selectedEdge ? 3 : (readyLink ? 2.4 : (fromActive || toOpen ? 2 : 1))}
                strokeDasharray={selectedEdge ? '0' : (readyLink ? '5 4' : (toOpen ? '0' : '4 4'))}
                style={{
                  pointerEvents: 'none',
                  animation: readyLink && !selectedEdge ? 'orim-ready-link-breathe 2.2s ease-in-out infinite' : undefined,
                }}
              />
              {onEdgeSelect && (
                <line
                  x1={`${fromNode.xPct}%`}
                  y1={`${fromNode.yPct}%`}
                  x2={`${toNode.xPct}%`}
                  y2={`${toNode.yPct}%`}
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onEdgeSelect(edgeId);
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>
      {nodes.map((node) => {
        const unlocked = isUnlocked(node);
        const assigned = assignments[node.id];
        const selected = selectedNodeId === node.id;
        const moving = movableNodeId === node.id;
        const nodeDiameter = node.size === 'major' ? 18 : (node.size === 'minor' ? 12 : 14);
        return (
          <div
            key={node.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
            style={{ left: `${node.xPct}%`, top: `${node.yPct}%` }}
          >
            <div
              className="relative rounded-full border flex items-center justify-center"
              style={{
                width: nodeDiameter,
                height: nodeDiameter,
                borderColor: selected
                  ? 'rgba(247, 210, 75, 0.92)'
                  : (unlocked ? 'rgba(127, 219, 202, 0.75)' : 'rgba(127, 219, 202, 0.35)'),
                backgroundColor: 'rgba(6, 10, 15, 0.24)',
                color: assigned ? accent : (unlocked ? '#bdeee5' : 'rgba(189, 238, 229, 0.5)'),
                boxShadow: selected
                  ? '0 0 12px rgba(247, 210, 75, 0.55)'
                  : (assigned
                    ? '0 0 14px rgba(127, 219, 202, 0.45)'
                    : (unlocked ? '0 0 8px rgba(127, 219, 202, 0.28)' : 'none')),
                cursor: moving ? 'grabbing' : (onNodeSelect ? 'pointer' : 'default'),
              }}
              onPointerDown={(event) => {
                onNodeSelect?.(node.id);
                if (!readOnly) {
                  beginNodeMove(event, node.id);
                }
              }}
              onMouseEnter={() => onNodeHoverChange?.(node.id)}
              onMouseLeave={() => onNodeHoverChange?.(null)}
              onDragOver={(event) => {
                if (readOnly) return;
                if (!unlocked) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(event) => {
                if (readOnly) return;
                if (!unlocked) return;
                event.preventDefault();
                const dropped = parseDroppedOrimLabel(event);
                if (!dropped) return;
                onAssign(node.id, dropped);
              }}
              onDoubleClick={() => {
                if (readOnly) return;
                if (!assigned) return;
                onClear(node.id);
              }}
              title={getNodeTitle?.(node) ?? (assigned
                ? `${assigned} (double-click to clear)`
                : (unlocked ? (readOnly ? 'Unlocked node' : 'Drop an Orim here') : 'Locked pathway'))}
            />
          </div>
        );
      })}
      <style>{`
        @keyframes orim-ready-link-breathe {
          0% { stroke-opacity: 0.45; }
          50% { stroke-opacity: 1; }
          100% { stroke-opacity: 0.45; }
        }
      `}</style>
    </div>
  );
});
