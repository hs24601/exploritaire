import { memo, useEffect, useMemo, useState } from 'react';
import type { Actor } from '../../engine/types';
import { getActorDefinition } from '../../engine/actors';
import { CombatOverlayFrame } from './CombatOverlayFrame';
import {
  DEFAULT_ORIM_ENHANCEMENT_EDGES,
  DEFAULT_ORIM_ENHANCEMENT_NODES,
  OrimEnhancementsGrid,
} from './OrimEnhancementsGrid';

interface ActorInspectOverlayProps {
  actor: Actor | null;
  open: boolean;
  onClose: () => void;
  zIndex?: number;
  ownedOrimNames?: string[];
  nodeAssignments?: Record<string, string>;
  onAssignNodeOrim?: (actorId: string, nodeId: string, orimName: string) => void;
  onClearNodeOrim?: (actorId: string, nodeId: string) => void;
}

const ELEMENT_ACCENT: Record<string, string> = {
  W: '#7ccfff',
  E: '#9de3ff',
  A: '#7fdbca',
  F: '#ffb075',
  L: '#f7d24b',
  D: '#c9adff',
  N: '#7fdbca',
};

const ACTOR_NODE_SCENE_BG: Record<string, string> = {
  keru: '/assets/actors/constellations/const_fox.png',
  fox: '/assets/actors/constellations/const_fox.png',
};

export const ActorInspectOverlay = memo(function ActorInspectOverlay({
  actor,
  open,
  onClose,
  zIndex = 10022,
  ownedOrimNames = [],
  nodeAssignments,
  onAssignNodeOrim,
  onClearNodeOrim,
}: ActorInspectOverlayProps) {
  const definition = useMemo(
    () => (actor ? getActorDefinition(actor.definitionId) : null),
    [actor]
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [slotFx, setSlotFx] = useState<{ nodeId: string; token: number } | null>(null);
  const [announceText, setAnnounceText] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);
  useEffect(() => {
    if (!open) {
      setSelectedNodeId(null);
      setHoveredNodeId(null);
      setSlotFx(null);
      setAnnounceText(null);
    }
  }, [open]);

  if (!open || !actor || !definition) return null;

  const accent = ELEMENT_ACCENT[definition.element ?? 'N'] ?? '#7fdbca';
  const enhancements = nodeAssignments ?? definition.orimEnhancements ?? {};
  const nodeSceneBg = definition.constellation?.backgroundSrc ?? ACTOR_NODE_SCENE_BG[definition.id];
  const constellationNodes = definition.constellation?.nodes ?? DEFAULT_ORIM_ENHANCEMENT_NODES;
  const constellationEdges = definition.constellation?.links && definition.constellation.links.length > 0
    ? definition.constellation.links.map((link) => [link.fromNodeId, link.toNodeId] as [string, string])
    : (definition.constellation?.edges ?? DEFAULT_ORIM_ENHANCEMENT_EDGES);
  const selectedNode = selectedNodeId
    ? constellationNodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const hoveredNode = hoveredNodeId
    ? constellationNodes.find((node) => node.id === hoveredNodeId) ?? null
    : null;
  const focusNode = hoveredNode ?? selectedNode;
  const galleryOrims = Array.from(new Set([...ownedOrimNames, 'Zephyr', 'Ferocity'].map((name) => name.trim()).filter(Boolean)));
  const nodeTitleResolver = (node: { id: string }) => {
    const assigned = enhancements[node.id];
    return assigned ? `${assigned} slotted` : 'No hard-wired ability';
  };
  const handleNodeSelect = (nodeId: string | null) => {
    if (!nodeId) {
      setSelectedNodeId(null);
      return;
    }
    if (selectedNodeId === nodeId && enhancements[nodeId]) {
      onClearNodeOrim?.(actor.id, nodeId);
      setSelectedNodeId(nodeId);
      return;
    }
    setSelectedNodeId(nodeId);
  };
  const handleAssignOrim = (nodeId: string, orimName: string) => {
    onAssignNodeOrim?.(actor.id, nodeId, orimName);
    setSlotFx({ nodeId, token: Date.now() });
  };

  return (
    <CombatOverlayFrame visible={open} interactive dimOpacity={0.6} blurPx={2} zIndex={zIndex}>
      <div
        className="absolute inset-0"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      />
      <div
        className="relative mx-3 my-2 rounded-xl border p-3 md:p-4 flex flex-col gap-3 overflow-hidden"
        style={{
          width: 'min(calc((100dvh - 16px) * 5 / 7), calc(100vw - 24px), 520px)',
          height: 'min(780px, calc(100dvh - 176px))',
          aspectRatio: '5 / 7',
          marginTop: 64,
          marginBottom: 88,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          borderColor: 'rgba(127, 219, 202, 0.78)',
          background: 'linear-gradient(180deg, rgba(8,14,24,0.96) 0%, rgba(8,12,18,0.96) 100%)',
          boxShadow: '0 0 28px rgba(127, 219, 202, 0.24)',
        }}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 0,
            mixBlendMode: 'screen',
            opacity: 0.3,
            background: `
              radial-gradient(120% 80% at 18% 14%, ${accent}44 0%, rgba(255,255,255,0) 58%),
              radial-gradient(110% 70% at 82% 40%, ${accent}33 0%, rgba(255,255,255,0) 62%)
            `,
            animation: 'actor-inspect-ethereal 12s ease-in-out infinite alternate',
          }}
        />
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] tracking-[3px] font-bold text-game-teal/80">
              {definition.type.toUpperCase()}
            </div>
            <div className="text-[20px] md:text-[24px] tracking-[3px] font-bold text-game-white uppercase">
              {definition.name}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded border text-[11px] tracking-[2px] font-bold"
            style={{
              borderColor: 'rgba(247, 210, 75, 0.7)',
              color: '#f7d24b',
              backgroundColor: 'rgba(10, 8, 6, 0.85)',
            }}
          >
            CLOSE
          </button>
        </div>

        <div
          className="rounded-lg border px-3 py-2 flex items-center justify-between text-[10px] tracking-[2px] font-bold"
          style={{
            borderColor: 'rgba(127, 219, 202, 0.45)',
            backgroundColor: 'rgba(10, 15, 21, 0.88)',
            color: '#bdeee5',
          }}
        >
          <span style={{ color: accent }}>VAL {actor.currentValue}</span>
          <span>LV {actor.level}</span>
          <span>HP {actor.hp}/{actor.hpMax}</span>
        </div>

        <div
          className="rounded-lg border flex-1 min-h-[220px] md:min-h-[320px] relative overflow-hidden"
          style={{
            borderColor: 'rgba(127, 219, 202, 0.4)',
            background: 'radial-gradient(circle at 50% 42%, rgba(127,219,202,0.16) 0%, rgba(15,21,34,0.9) 56%, rgba(8,12,18,0.95) 100%)',
          }}
        >
          {nodeSceneBg && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(8,12,18,0.72) 0%, rgba(8,12,18,0.82) 100%), url('${nodeSceneBg}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.55,
              }}
            />
          )}
          <OrimEnhancementsGrid
            assignments={enhancements}
            nodes={constellationNodes}
            edges={constellationEdges}
            onAssign={(nodeId, value) => handleAssignOrim(nodeId, value)}
            onClear={(nodeId) => onClearNodeOrim?.(actor.id, nodeId)}
            accent={accent}
            readOnly={false}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
            getNodeTitle={nodeTitleResolver}
            onNodeHoverChange={setHoveredNodeId}
          />
          {slotFx && (
            <div
              key={`${slotFx.nodeId}-${slotFx.token}`}
              className="absolute pointer-events-none"
              style={{
                left: `${(constellationNodes.find((node) => node.id === slotFx.nodeId)?.xPct ?? 50)}%`,
                top: `${(constellationNodes.find((node) => node.id === slotFx.nodeId)?.yPct ?? 50)}%`,
                width: 26,
                height: 26,
                transform: 'translate(-50%, -50%)',
                borderRadius: '999px',
                border: '2px solid rgba(247, 210, 75, 0.95)',
                boxShadow: '0 0 16px rgba(247, 210, 75, 0.75)',
                animation: 'node-slot-burst 520ms ease-out forwards',
              }}
            />
          )}
          {announceText && (
            <div
              className="absolute left-1/2 top-3 -translate-x-1/2 pointer-events-none rounded border px-3 py-1 text-[11px] font-bold tracking-[2px]"
              style={{
                zIndex: 30,
                color: '#f7d24b',
                borderColor: 'rgba(247, 210, 75, 0.8)',
                backgroundColor: 'rgba(10, 8, 6, 0.92)',
                boxShadow: '0 0 14px rgba(247, 210, 75, 0.45)',
                animation: 'node-announce-fade 1200ms ease-out forwards',
              }}
            >
              {announceText}
            </div>
          )}
        </div>
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(127, 219, 202, 0.4)', backgroundColor: 'rgba(7, 11, 18, 0.9)' }}>
          <div className="text-[10px] tracking-[2px] text-game-teal/80 mb-1 font-bold">NODE ABILITY</div>
          <div className="text-[12px] text-game-white/90">
            {focusNode ? (
              <>
                <span className="font-bold">{focusNode.label ?? focusNode.id}</span>
                {': No hard-wired ability'}
              </>
            ) : 'Hover a node to inspect its ability/state.'}
          </div>
          <div className="mt-2 text-[10px] text-game-white/60">
            {'Click a node to open the Orim gallery, slot an owned Orim, or click again to remove.'}
          </div>
        </div>
        {selectedNode && (
          <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(127, 219, 202, 0.4)', backgroundColor: 'rgba(6, 10, 16, 0.9)' }}>
            <div className="text-[10px] tracking-[2px] text-game-teal/80 mb-1 font-bold">
              ORIM GALLERY: {selectedNode.label ?? selectedNode.id}
            </div>
            <div className="flex flex-wrap gap-2">
              {galleryOrims.map((orimName) => {
                const active = (enhancements[selectedNode.id] ?? '').toLowerCase() === orimName.toLowerCase();
                return (
                  <button
                    key={`${selectedNode.id}-${orimName}`}
                    type="button"
                    onClick={() => handleAssignOrim(selectedNode.id, orimName)}
                    className="px-2 py-1 rounded border text-[10px] font-bold tracking-[1.4px]"
                    style={{
                      color: active ? '#0a0a0a' : '#bdeee5',
                      borderColor: active ? 'rgba(247, 210, 75, 0.85)' : 'rgba(127, 219, 202, 0.5)',
                      backgroundColor: active ? 'rgba(247, 210, 75, 0.92)' : 'rgba(10, 15, 21, 0.88)',
                      boxShadow: active ? '0 0 12px rgba(247, 210, 75, 0.45)' : 'none',
                    }}
                  >
                    {orimName}
                  </button>
                );
              })}
              {enhancements[selectedNode.id] && (
                <button
                  type="button"
                  onClick={() => onClearNodeOrim?.(actor.id, selectedNode.id)}
                  className="px-2 py-1 rounded border text-[10px] font-bold tracking-[1.4px]"
                  style={{
                    color: '#ffb6b6',
                    borderColor: 'rgba(255, 140, 140, 0.6)',
                    backgroundColor: 'rgba(30, 10, 10, 0.78)',
                  }}
                >
                  REMOVE
                </button>
              )}
            </div>
          </div>
        )}

        <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(127, 219, 202, 0.4)', backgroundColor: 'rgba(7, 11, 18, 0.9)' }}>
          <div className="text-[10px] tracking-[2px] text-game-teal/80 mb-1 font-bold">TEXT</div>
          <div className="text-[12px] md:text-[13px] text-game-white">
            {definition.description}
          </div>
        </div>
        <div
          className="rounded-lg border px-3 py-2 grid grid-cols-1 md:grid-cols-3 gap-2"
          style={{ borderColor: 'rgba(127, 219, 202, 0.3)', backgroundColor: 'rgba(6, 10, 16, 0.84)' }}
        >
          <div className="rounded border px-2 py-2" style={{ borderColor: 'rgba(127, 219, 202, 0.22)' }}>
            <div className="text-[10px] tracking-[2px] text-game-teal/80 font-bold">TRAITS</div>
            <div className="mt-1 text-[10px] text-game-white/45">Placeholder</div>
          </div>
          <div className="rounded border px-2 py-2" style={{ borderColor: 'rgba(127, 219, 202, 0.22)' }}>
            <div className="text-[10px] tracking-[2px] text-game-teal/80 font-bold">LOADOUT</div>
            <div className="mt-1 text-[10px] text-game-white/45">Placeholder</div>
          </div>
          <div className="rounded border px-2 py-2" style={{ borderColor: 'rgba(127, 219, 202, 0.22)' }}>
            <div className="text-[10px] tracking-[2px] text-game-teal/80 font-bold">AUGMENTS</div>
            <div className="mt-1 text-[10px] text-game-white/45">Placeholder</div>
          </div>
        </div>
        <style>{`
          @keyframes actor-inspect-ethereal {
            0% { transform: translate3d(-2px, -1px, 0) scale(1.01); }
            100% { transform: translate3d(3px, 2px, 0) scale(1.03); }
          }
          @keyframes node-slot-burst {
            0% { opacity: 1; transform: translate(-50%, -50%) scale(0.2); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(2.2); }
          }
          @keyframes node-announce-fade {
            0% { opacity: 0; transform: translate(-50%, -4px) scale(0.92); }
            12% { opacity: 1; transform: translate(-50%, 0) scale(1); }
            74% { opacity: 1; transform: translate(-50%, 0) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -8px) scale(1.04); }
          }
        `}</style>
      </div>
    </CombatOverlayFrame>
  );
});
