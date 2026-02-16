import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RelicDefinition, RelicInstance, RelicRarity } from '../engine/types';

const RARITIES: RelicRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

const normalizeRelicId = (value: string) => value
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const createBlankRelic = (name = 'New Relic'): RelicDefinition => ({
  id: normalizeRelicId(name),
  name,
  description: '',
  rarity: 'common',
  passive: true,
  scope: 'party',
  behaviorId: 'custom_passive_v1',
  params: {},
});

const replaceSection = (source: string, start: string, end: string, replacement: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return null;
  const before = source.slice(0, startIndex + start.length);
  const after = source.slice(endIndex);
  return `${before}\n${replacement}\n${after}`;
};

const serializeRelicDefinitions = (definitions: RelicDefinition[]) => {
  const lines: string[] = [];
  lines.push('export const RELIC_DEFINITIONS: RelicDefinition[] = [');
  definitions.forEach((relic) => {
    lines.push('  {');
    lines.push(`    id: '${relic.id}',`);
    lines.push(`    name: '${relic.name.replace(/'/g, "\\'")}',`);
    lines.push(`    description: '${(relic.description ?? '').replace(/'/g, "\\'")}',`);
    lines.push(`    rarity: '${relic.rarity}',`);
    lines.push('    passive: true,');
    lines.push("    scope: 'party',");
    lines.push(`    behaviorId: '${relic.behaviorId.replace(/'/g, "\\'")}',`);
    lines.push(`    params: ${JSON.stringify(relic.params ?? {})},`);
    lines.push('  },');
  });
  lines.push('];');
  return lines.join('\n');
};

const writeFileToDisk = async (path: string, content: string) => {
  const writer = (window as unknown as { __writeFile?: (nextPath: string, nextContent: string) => Promise<void> }).__writeFile;
  if (typeof writer === 'function') {
    await writer(path, content);
    return;
  }
  const response = await fetch('/__write-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  if (!response.ok) throw new Error('Failed to write file.');
};

export function RelicEditor({
  onClose,
  definitions: definitionsProp,
  equippedRelics: equippedRelicsProp,
  onDefinitionsChange,
  onEquippedRelicsChange,
  embedded = false,
}: {
  onClose: () => void;
  definitions: RelicDefinition[];
  equippedRelics: RelicInstance[];
  onDefinitionsChange: (next: RelicDefinition[]) => void;
  onEquippedRelicsChange: (next: RelicInstance[]) => void;
  embedded?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [definitions, setDefinitions] = useState<RelicDefinition[]>(definitionsProp);
  const [equippedRelics, setEquippedRelics] = useState<RelicInstance[]>(equippedRelicsProp);
  const [selectedId, setSelectedId] = useState<string | null>(definitionsProp[0]?.id ?? null);

  useEffect(() => setDefinitions(definitionsProp), [definitionsProp]);
  useEffect(() => setEquippedRelics(equippedRelicsProp), [equippedRelicsProp]);
  useEffect(() => {
    if (selectedId && definitions.some((item) => item.id === selectedId)) return;
    setSelectedId(definitions[0]?.id ?? null);
  }, [definitions, selectedId]);

  const selected = useMemo(() => definitions.find((item) => item.id === selectedId) ?? null, [definitions, selectedId]);
  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const query = search.trim().toLowerCase();
    return definitions.filter((item) =>
      item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
    );
  }, [definitions, search]);

  const commitDefinitions = useCallback((next: RelicDefinition[]) => {
    setDefinitions(next);
    onDefinitionsChange(next);
  }, [onDefinitionsChange]);

  const commitEquipped = useCallback((next: RelicInstance[]) => {
    setEquippedRelics(next);
    onEquippedRelicsChange(next);
  }, [onEquippedRelicsChange]);

  const selectedInstance = useMemo(() => (
    selected ? equippedRelics.find((item) => item.relicId === selected.id) ?? null : null
  ), [equippedRelics, selected]);

  const updateSelected = useCallback((updater: (prev: RelicDefinition) => RelicDefinition) => {
    if (!selectedId) return;
    commitDefinitions(definitions.map((item) => (item.id === selectedId ? updater(item) : item)));
  }, [commitDefinitions, definitions, selectedId]);

  const handleNameChange = useCallback((name: string) => {
    updateSelected((prev) => ({ ...prev, name, id: normalizeRelicId(name) }));
    setSelectedId(normalizeRelicId(name));
  }, [updateSelected]);

  const handleAddRelic = useCallback(() => {
    const fresh = createBlankRelic(`New Relic ${definitions.length + 1}`);
    commitDefinitions([...definitions, fresh]);
    if (!equippedRelics.some((item) => item.relicId === fresh.id)) {
      commitEquipped([...equippedRelics, {
        instanceId: `relic-${fresh.id}-${Date.now()}`,
        relicId: fresh.id,
        level: 1,
        enabled: false,
      }]);
    }
    setSelectedId(fresh.id);
  }, [commitDefinitions, commitEquipped, definitions, equippedRelics]);

  const writeToDisk = useCallback(async () => {
    try {
      setSaveStatus('Saving...');
      const response = await fetch('/src/engine/relics.ts');
      if (!response.ok) {
        setSaveStatus('Failed to load relics.ts from dev server.');
        return;
      }
      const raw = await response.text();
      const text = raw.replace(/^export\s+default\s+['"](.+)['"];?$/s, '$1');
      const replacement = serializeRelicDefinitions(definitions);
      const updated = replaceSection(text, '// RELIC_DEFINITIONS_START', '// RELIC_DEFINITIONS_END', replacement);
      if (!updated) {
        setSaveStatus('Could not find RELIC_DEFINITIONS markers in relics.ts.');
        return;
      }
      await writeFileToDisk('src/engine/relics.ts', updated);
      setSaveStatus(`Saved ${definitions.length} relic definitions.`);
    } catch {
      setSaveStatus('Save failed. Ensure the dev server write hook is available.');
    }
  }, [definitions]);

  const content = (
    <div className={`relative bg-game-bg-dark border border-game-teal/40 rounded-lg p-4 overflow-hidden text-game-white menu-text ${embedded ? 'w-full h-full' : 'w-[1200px] max-w-[95vw] max-h-[90vh]'}`}>
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <button
          type="button"
          onClick={writeToDisk}
          className="text-xs font-mono bg-game-bg-dark/80 border border-game-teal/40 rounded w-7 h-7 flex items-center justify-center cursor-pointer text-game-teal"
          title="Save"
        >
          💾
        </button>
        <button
          onClick={onClose}
          className="text-xs text-game-pink border border-game-pink rounded w-7 h-7 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
          title="Close"
        >
          x
        </button>
      </div>
      <div className="text-xs text-game-teal tracking-[4px] mb-3">RELIC EDITOR</div>
      <div className={`grid grid-cols-[1fr_1fr] gap-4 ${embedded ? 'h-[calc(100%-1.75rem)]' : 'h-[74vh]'}`}>
        <div className="flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search relics..."
              className="flex-1 text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1 text-game-white"
            />
            <button
              type="button"
              onClick={handleAddRelic}
              className="text-xs font-mono bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded cursor-pointer text-game-teal"
            >
              + Add Relic
            </button>
          </div>

          {search.trim() && (
            <div className="border border-game-teal/20 rounded p-2 max-h-[140px] overflow-y-auto">
              <div className="text-[10px] text-game-white/60 mb-1">Load Relic</div>
              <div className="flex flex-col gap-1">
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`text-[10px] font-mono text-left px-2 py-1 rounded border ${item.id === selectedId ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                  >
                    {item.name} <span className="text-game-white/40">({item.id})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border border-game-teal/20 rounded p-3 flex-1 overflow-y-auto">
            {selected ? (
              <div className="grid gap-3 text-xs">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-game-white/60">Name</span>
                  <input
                    value={selected.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-game-white/60">Description</span>
                  <textarea
                    rows={3}
                    value={selected.description ?? ''}
                    onChange={(e) => updateSelected((prev) => ({ ...prev, description: e.target.value }))}
                    className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-game-white/60">Rarity</span>
                  <select
                    value={selected.rarity}
                    onChange={(e) => updateSelected((prev) => ({ ...prev, rarity: e.target.value as RelicRarity }))}
                    className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                  >
                    {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-game-white/60">Behavior Id</span>
                  <input
                    value={selected.behaviorId}
                    onChange={(e) => updateSelected((prev) => ({ ...prev, behaviorId: e.target.value }))}
                    className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">msPerArmor</span>
                    <input
                      type="number"
                      value={Number(selected.params?.msPerArmor ?? 5000)}
                      onChange={(e) => updateSelected((prev) => ({ ...prev, params: { ...(prev.params ?? {}), msPerArmor: Number(e.target.value) } }))}
                      className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">armorPerProc</span>
                    <input
                      type="number"
                      value={Number(selected.params?.armorPerProc ?? 1)}
                      onChange={(e) => updateSelected((prev) => ({ ...prev, params: { ...(prev.params ?? {}), armorPerProc: Number(e.target.value) } }))}
                      className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="text-xs text-game-white/50">Select a relic to edit.</div>
            )}
          </div>
        </div>

        <div className="border border-game-teal/20 rounded p-3 flex flex-col gap-3 overflow-y-auto">
          {saveStatus && (
            <div className="text-[10px] text-game-white/50">{saveStatus}</div>
          )}
          <div className="text-[10px] text-game-white/60 tracking-[2px]">EQUIPPED RELICS</div>
          <div className="flex flex-col gap-2">
            {definitions.map((definition, index) => {
              const instance = equippedRelics.find((item) => item.relicId === definition.id) ?? {
                instanceId: `relic-${definition.id}-${index + 1}`,
                relicId: definition.id,
                level: 1,
                enabled: false,
              };
              return (
                <div key={definition.id} className="border border-game-teal/20 rounded p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] text-game-white/80">{definition.name}</div>
                    <label className="text-[10px] text-game-teal flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={instance.enabled}
                        onChange={(e) => {
                          const next = equippedRelics.filter((item) => item.relicId !== definition.id);
                          next.push({ ...instance, enabled: e.target.checked });
                          commitEquipped(next);
                        }}
                      />
                      enabled
                    </label>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px]">
                    <span className="text-game-white/60">Level</span>
                    <input
                      type="number"
                      min={1}
                      value={instance.level}
                      onChange={(e) => {
                        const next = equippedRelics.filter((item) => item.relicId !== definition.id);
                        next.push({ ...instance, level: Math.max(1, Number(e.target.value) || 1) });
                        commitEquipped(next);
                      }}
                      className="w-14 text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {selected && selectedInstance && (
            <div className="text-[10px] text-game-white/50">
              Selected instance: <span className="text-game-teal">{selectedInstance.instanceId}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) return content;
  return (
    <div className="fixed inset-0 z-[10030]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full h-full flex items-start justify-center p-6">
        {content}
      </div>
    </div>
  );
}
