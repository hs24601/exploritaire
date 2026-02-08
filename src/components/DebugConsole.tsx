import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Element } from '../engine/types';
import { TILE_DEFINITIONS } from '../engine/tiles';
import { BIOME_DEFINITIONS } from '../engine/biomes';
import { ACTOR_DEFINITIONS } from '../engine/actors';

interface DebugConsoleProps {
  visible: boolean;
  onBarHeightChange: (height: number) => void;
  onAddTileToGarden: (definitionId: string) => void;
  onAddActorToGarden: (definitionId: string) => void;
  onAddTokenToGarden: (element: Element, count?: number) => void;
  onNewGame: () => void;
}

export const DebugConsole = memo(function DebugConsole({
  visible,
  onBarHeightChange,
  onAddTileToGarden,
  onAddActorToGarden,
  onAddTokenToGarden,
  onNewGame,
}: DebugConsoleProps) {
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<Array<{ id: string; type: 'input' | 'output' | 'error'; text: string }>>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{ action: () => void; label: string } | null>(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const commandBarRef = useRef<HTMLDivElement | null>(null);

  const normalizeToken = useCallback((value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, ''), []);

  const spawnTargets = useMemo(() => {
    const tileTargets = TILE_DEFINITIONS.map((tile) => `tile.${tile.id}`);
    const biomeTargets = BIOME_DEFINITIONS.map((biome) => `biome.${biome.id}`);
    const actorTargets = ACTOR_DEFINITIONS.map((actor) => `actor.${actor.id}`);
    const tokenTargets = [
      'token.w', 'token.w1', 'token.w5',
      'token.e', 'token.e1', 'token.e5',
      'token.a', 'token.a1', 'token.a5',
      'token.f', 'token.f1', 'token.f5',
      'token.d', 'token.d1', 'token.d5',
      'token.l', 'token.l1', 'token.l5',
      'token.water', 'token.earth', 'token.air',
      'token.fire', 'token.dark', 'token.light',
    ];
    return [...biomeTargets, ...tileTargets, ...actorTargets, ...tokenTargets];
  }, []);

  const commandList = useMemo(() => [
    { name: '/help', description: 'List commands' },
    { name: '/reset', description: 'Reset the game session', destructive: true },
    { name: '/spawn', description: 'Spawn an entity' },
    { name: '/restart', description: 'Copy restart command' },
  ], []);

  const suggestions = useMemo(() => {
    const raw = commandInput.trim();
    if (!raw) return [];
    const cleaned = raw.replace(/^\//, '');
    const parts = cleaned.split(/\s+/);
    const verb = parts[0]?.toLowerCase();
    if (verb === 'spawn' && parts.length >= 2) {
      const query = normalizeToken(parts[1]);
      return spawnTargets.filter((target) => normalizeToken(target).includes(query));
    }
    const query = normalizeToken(raw);
    return commandList
      .map((cmd) => cmd.name)
      .filter((cmd) => normalizeToken(cmd).includes(query));
  }, [commandInput, commandList, normalizeToken, spawnTargets]);

  useEffect(() => {
    setSuggestionIndex(0);
  }, [commandInput, suggestions.length]);

  const pushHistory = useCallback((type: 'input' | 'output' | 'error', text: string) => {
    setCommandHistory((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, text },
    ]);
  }, []);

  const runSpawnTarget = useCallback((rawTarget: string, sourceLabel = '/spawn') => {
    const target = rawTarget.toLowerCase().trim();
    let type = '';
    let name = '';
    if (target.includes('.')) {
      const [prefix, rest] = target.split('.', 2);
      type = prefix;
      name = rest;
    }

    if (!type || !name) {
      pushHistory('error', `Usage: ${sourceLabel} biome.garden_grove`);
      return;
    }

    if (type === 'biome') {
      const biome = BIOME_DEFINITIONS.find((item) => normalizeToken(item.id) === normalizeToken(name));
      if (!biome) {
        pushHistory('error', `Unknown biome: ${name}`);
      } else {
        onAddTileToGarden(biome.id);
        pushHistory('output', `Spawned biome tile: ${biome.name}`);
      }
      return;
    }

    if (type === 'tile') {
      const tile = TILE_DEFINITIONS.find((item) => normalizeToken(item.id) === normalizeToken(name));
      if (!tile) {
        pushHistory('error', `Unknown tile: ${name}`);
      } else {
        onAddTileToGarden(tile.id);
        pushHistory('output', `Spawned tile: ${tile.name}`);
      }
      return;
    }

    if (type === 'actor') {
      const actor = ACTOR_DEFINITIONS.find((item) => normalizeToken(item.id) === normalizeToken(name));
      if (!actor) {
        pushHistory('error', `Unknown actor: ${name}`);
      } else {
        onAddActorToGarden(actor.id);
        pushHistory('output', `Spawned actor: ${actor.name}`);
      }
      return;
    }

    if (type === 'token') {
      const match = name.match(/^([a-z]+)(\d+)?$/i);
      if (!match) {
        pushHistory('error', 'Usage: /spawn token.w5');
        return;
      }
      const key = match[1].toLowerCase();
      const count = match[2] ? parseInt(match[2], 10) : 1;
      const elementMap: Record<string, Element> = {
        w: 'W', water: 'W', a: 'A', air: 'A', e: 'E', earth: 'E',
        f: 'F', fire: 'F', d: 'D', dark: 'D', l: 'L', light: 'L',
      };
      const element = elementMap[key];
      if (!element || Number.isNaN(count) || count <= 0) {
        pushHistory('error', 'Usage: /spawn token.w5');
        return;
      }
      onAddTokenToGarden(element, count);
      pushHistory('output', `Spawned ${count} ${key} token${count === 1 ? '' : 's'}`);
      return;
    }

    pushHistory('error', `Unknown spawn type: ${type}`);
  }, [onAddTileToGarden, onAddActorToGarden, onAddTokenToGarden, normalizeToken, pushHistory]);

  const restartCommand = 'C:\\dev\\Exploritaire; npm run dev';

  const handleCommandSubmit = useCallback(() => {
    const trimmed = commandInput.trim();
    if (pendingConfirm) {
      if (['y', 'yes'].includes(trimmed.toLowerCase())) {
        pendingConfirm.action();
        pushHistory('output', `${pendingConfirm.label} confirmed.`);
      } else {
        pushHistory('output', `${pendingConfirm.label} cancelled.`);
      }
      setPendingConfirm(null);
      setCommandInput('');
      return;
    }

    if (!trimmed) return;
    pushHistory('input', `> ${trimmed}`);

    const cleaned = trimmed.replace(/^\//, '');
    const parts = cleaned.split(/\s+/);
    const verb = (parts[0] || '').toLowerCase();
    const args = parts.slice(1);

    if (verb === 'help') {
      pushHistory('output', 'Commands: /reset, /spawn <biome.|tile.|actor.>, /restart');
      setCommandInput('');
      return;
    }

    if (verb === 'reset') {
      setPendingConfirm({ action: onNewGame, label: '/reset' });
      pushHistory('output', 'Confirm /reset? type y or n.');
      setCommandInput('');
      return;
    }

    if (verb === 'spawn') {
      if (args.length === 0) {
        pushHistory('error', 'Usage: /spawn biome.garden_grove');
        setCommandInput('');
        return;
      }
      const target = args.join('');
      runSpawnTarget(target);
      setCommandInput('');
      return;
    }

    if (verb === 'restart') {
      pushHistory('output', `Restart command: ${restartCommand}`);
      navigator.clipboard.writeText(restartCommand).catch(() => {});
      setCommandInput('');
      return;
    }

    pushHistory('error', `Unknown command: ${trimmed}`);
    setCommandInput('');
  }, [commandInput, pendingConfirm, onNewGame, pushHistory, runSpawnTarget, restartCommand]);

  // Measure command bar height for layout offset
  useEffect(() => {
    if (!visible || !consoleOpen) {
      onBarHeightChange(0);
      return;
    }
    const node = commandBarRef.current;
    if (!node) return;

    const updateHeight = () => {
      const rect = node.getBoundingClientRect();
      onBarHeightChange(rect.height);
    };

    updateHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateHeight);
      observer.observe(node);
      return () => observer.disconnect();
    }

    const handleResize = () => updateHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [visible, consoleOpen, onBarHeightChange]);

  return (
    <>
      {/* Console toggle button */}
      <button
        type="button"
        onClick={() => setConsoleOpen((prev) => !prev)}
        className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
        title="Toggle console"
      >
        ⌨️
      </button>

      {/* Console history panel */}
      {consoleOpen && (
        <div
          className="fixed left-4 top-20 bottom-4 w-64 z-[9998] bg-game-bg-dark/80 border border-game-teal/30 rounded p-2 text-[10px] font-mono text-game-teal overflow-y-auto menu-text"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] opacity-80">Console</span>
            <button
              onClick={() => setCommandHistory([])}
              className="text-[10px] text-game-pink border border-game-pink/50 px-1 rounded"
            >
              clear
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {commandHistory.length === 0 && (
              <div className="opacity-50">No history</div>
            )}
            {commandHistory.map((entry) => (
              <div
                key={entry.id}
                className={entry.type === 'error' ? 'text-game-red' : entry.type === 'output' ? 'text-game-teal' : 'text-game-white'}
              >
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Command bar */}
      {visible && consoleOpen && (
        <div ref={commandBarRef} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] menu-text">
          <div className="bg-game-bg-dark/80 border border-game-teal/40 rounded px-3 py-2 min-w-[420px] max-w-[640px]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-game-teal">CMD</span>
              <input
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCommandSubmit();
                    return;
                  }
                  if (e.key === 'ArrowDown' && suggestions.length > 0) {
                    e.preventDefault();
                    setSuggestionIndex((prev) => (prev + 1) % suggestions.length);
                  }
                  if (e.key === 'ArrowUp' && suggestions.length > 0) {
                    e.preventDefault();
                    setSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                  }
                  if (e.key === 'Tab' && suggestions.length > 0) {
                    e.preventDefault();
                    const suggestion = suggestions[suggestionIndex] ?? suggestions[0];
                    const trimmed = commandInput.trim();
                    const prefix = trimmed.split(/\s+/)[0] || '';
                    const isSpawn = prefix.replace(/^\//, '').toLowerCase() === 'spawn';
                    setCommandInput(isSpawn ? `${prefix} ${suggestion}` : suggestion);
                  }
                }}
                className="flex-1 bg-transparent text-xs text-game-white outline-none"
                placeholder="/help"
              />
            </div>
            {pendingConfirm && (
              <div className="mt-1 text-[10px] text-game-pink">
                Confirm {pendingConfirm.label}? type y or n
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-col gap-1 max-h-28 overflow-y-auto">
                <div className="text-[10px] text-game-teal/70 uppercase tracking-widest px-2">
                  Suggested
                </div>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion}-${index}`}
                    onClick={() => {
                      const trimmed = commandInput.trim();
                      const prefix = trimmed.split(/\s+/)[0] || '';
                      const isSpawn = prefix.replace(/^\//, '').toLowerCase() === 'spawn';
                      if (isSpawn) {
                        pushHistory('input', `> /spawn ${suggestion}`);
                        runSpawnTarget(suggestion);
                        setCommandInput('');
                        return;
                      }
                      setCommandInput(suggestion);
                    }}
                    className={`text-left text-[10px] px-2 py-1 rounded ${index === suggestionIndex ? 'bg-game-teal/20 text-game-teal' : 'text-game-white/70'}`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});
