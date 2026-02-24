import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Element,
  OrimCategory,
  OrimDefinition,
  OrimDomain,
  OrimRarity,
  TriggerCondition,
  TriggerGroup,
  TriggerNode,
  TriggerOperator,
  TriggerTiming,
  TriggerField,
} from '../engine/types';
import { ELEMENT_TO_SUIT, SUIT_COLORS, getSuitDisplay } from '../engine/constants';
import { useGraphics } from '../contexts/GraphicsContext';

const ELEMENTS: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];
const CATEGORIES: OrimCategory[] = ['ability', 'utility', 'trait'];
const DOMAINS: OrimDomain[] = ['puzzle', 'combat'];
const CATEGORY_GLYPHS: Record<OrimCategory, string> = {
  ability: '⚡️',
  utility: '💫',
  trait: '🧬',
};
const RARITIES: OrimRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const TIMINGS: TriggerTiming[] = ['equip', 'play', 'turn-start', 'turn-end'];
const OPERATORS: TriggerOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];
const FIELDS: TriggerField[] = [
  'actor.combo',
  'actor.hp',
  'actor.hpMax',
  'actor.energy',
  'actor.energyMax',
  'actor.stamina',
  'actor.staminaMax',
  'actor.damageTaken',
  'bout.turn',
  'actor.affinity.W',
  'actor.affinity.E',
  'actor.affinity.A',
  'actor.affinity.F',
  'actor.affinity.L',
  'actor.affinity.D',
  'actor.affinity.N',
];

const normalizeOrimId = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const createBlankOrim = (name = 'New Orim'): OrimDefinition => ({
  id: normalizeOrimId(name),
  name,
  description: '',
  category: 'ability',
  domain: 'puzzle',
  rarity: 'common',
  powerCost: 0,
  damage: 0,
});

const dedupeOrimDefinitions = (definitions: OrimDefinition[]): OrimDefinition[] => {
  const seen = new Set<string>();
  const next: OrimDefinition[] = [];
  definitions.forEach((definition) => {
    const normalizedId = normalizeOrimId(definition.id || definition.name || '');
    if (!normalizedId || seen.has(normalizedId)) return;
    seen.add(normalizedId);
    if (definition.id === normalizedId) {
      next.push(definition);
      return;
    }
    next.push({ ...definition, id: normalizedId });
  });
  return next;
};

const serializeOrimDefinitions = (definitions: OrimDefinition[]) => {
  const lines: string[] = [];
  lines.push('export const ORIM_DEFINITIONS: OrimDefinition[] = [');
  definitions.forEach((orim) => {
    lines.push('  {');
    lines.push(`    id: '${orim.id}',`);
    lines.push(`    name: '${orim.name.replace(/'/g, "\\'")}',`);
    if (orim.description) {
      lines.push(`    description: '${orim.description.replace(/'/g, "\\'")}',`);
    }
    if (orim.artSrc) {
      lines.push(`    artSrc: '${orim.artSrc.replace(/'/g, "\\'")}',`);
    }
    lines.push(`    category: '${orim.category}',`);
    lines.push(`    domain: '${orim.domain}',`);
    lines.push(`    rarity: '${orim.rarity}',`);
    lines.push(`    powerCost: ${orim.powerCost ?? 0},`);
    if (orim.damage !== undefined) {
      lines.push(`    damage: ${orim.damage},`);
    }
    if (orim.affinity && Object.keys(orim.affinity).length > 0) {
      lines.push(`    affinity: ${JSON.stringify(orim.affinity)},`);
    }
    if (orim.activationTiming && orim.activationTiming.length > 0) {
      lines.push(`    activationTiming: ${JSON.stringify(orim.activationTiming)},`);
    }
    if (orim.activationCondition) {
      lines.push(`    activationCondition: ${JSON.stringify(orim.activationCondition)},`);
    }
    lines.push('  },');
  });
  lines.push('];');
  return lines.join('\n');
};

const replaceSection = (source: string, start: string, end: string, replacement: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return null;
  const before = source.slice(0, startIndex + start.length);
  const after = source.slice(endIndex);
  return `${before}\n${replacement}\n${after}`;
};

const writeFileToDisk = async (path: string, content: string) => {
  const writer = (window as unknown as { __writeFile?: (path: string, content: string) => Promise<void> }).__writeFile;
  if (typeof writer === 'function') {
    await writer(path, content);
    return;
  }
  const response = await fetch('/__write-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  if (!response.ok) {
    throw new Error('Failed to write file.');
  }
};

export function OrimEditor({
  onClose,
  definitions: definitionsProp,
  onChange,
  embedded = false,
}: {
  onClose: () => void;
  definitions: OrimDefinition[];
  onChange: (next: OrimDefinition[]) => void;
  embedded?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showGraphics = useGraphics();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'ability' | 'affinity' | 'activation'>('details');
  const [definitions, setDefinitions] = useState<OrimDefinition[]>(() => dedupeOrimDefinitions(definitionsProp));
  const [selectedId, setSelectedId] = useState<string | null>(() => (dedupeOrimDefinitions(definitionsProp)[0]?.id ?? null));
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    setDefinitions(dedupeOrimDefinitions(definitionsProp));
  }, [definitionsProp]);

  useEffect(() => {
    if (selectedId && definitionsProp.some((item) => item.id === selectedId)) return;
    setSelectedId(definitionsProp[0]?.id ?? null);
  }, [definitionsProp, selectedId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const query = search.trim().toLowerCase();
    return definitions.filter((item) => (
      item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
    ));
  }, [definitions, search]);

  const selected = useMemo(() => {
    return definitions.find((item) => item.id === selectedId) ?? null;
  }, [definitions, selectedId]);

  const commitDefinitions = useCallback((next: OrimDefinition[]) => {
    const cleaned = dedupeOrimDefinitions(next);
    setDefinitions(cleaned);
    onChange(cleaned);
  }, [onChange]);

  const updateSelected = useCallback((updater: (prev: OrimDefinition) => OrimDefinition) => {
    if (!selectedId) return;
    commitDefinitions(definitions.map((item) => {
      if (item.id !== selectedId) return item;
      return updater(item);
    }));
  }, [commitDefinitions, definitions, selectedId]);

  const handleNameChange = useCallback((name: string) => {
    updateSelected((prev) => {
      const nextId = normalizeOrimId(name);
      return {
        ...prev,
        name,
        id: nextId,
      };
    });
    setSelectedId(normalizeOrimId(name));
  }, [updateSelected]);

  const handleAffinityChange = useCallback((element: Element, value: number) => {
    updateSelected((prev) => {
      const nextAffinity = { ...(prev.affinity ?? {}) };
      if (!value) {
        delete nextAffinity[element];
      } else {
        nextAffinity[element] = value;
      }
      return { ...prev, affinity: Object.keys(nextAffinity).length ? nextAffinity : undefined };
    });
  }, [updateSelected]);

  const handleCopyJson = useCallback(() => {
    const payload = JSON.stringify(definitions, null, 2);
    navigator.clipboard?.writeText(payload).catch(() => {
      // ignore clipboard errors
    });
  }, [definitions]);

  const writeToDisk = useCallback(async () => {
    try {
      const sourcePath = 'src/engine/orims.ts';
      const response = await fetch(sourcePath);
      if (!response.ok) {
        setSaveStatus('Unable to load orims.ts for save.');
        return;
      }
      const source = await response.text();
      const updated = replaceSection(
        source,
        '// ORIM_DEFINITIONS_START',
        '// ORIM_DEFINITIONS_END',
        serializeOrimDefinitions(definitions)
      );
      if (!updated) {
        setSaveStatus('Could not find ORIM_DEFINITIONS markers in orims.ts.');
        return;
      }
      await writeFileToDisk(sourcePath, updated);
      setSaveStatus(`Saved ${definitions.length} orim definitions.`);
    } catch (error) {
      setSaveStatus('Save failed. Ensure the dev server write hook is available.');
    }
  }, [definitions]);

  const handleAddOrim = useCallback(() => {
    const fresh = createBlankOrim(`New Orim ${definitions.length + 1}`);
    commitDefinitions([...definitions, fresh]);
    setSelectedId(fresh.id);
    setActiveTab('details');
  }, [commitDefinitions, definitions]);

  const showAbilityTab = selected?.category === 'ability';

  const defaultCondition = (): TriggerCondition => ({
    type: 'condition',
    left: { type: 'field', field: 'actor.affinity.F' },
    operator: 'gte',
    right: { type: 'number', value: 1 },
  });

  const defaultGroup = (): TriggerGroup => ({
    type: 'group',
    op: 'and',
    clauses: [defaultCondition()],
  });

  const updateActivation = (updater: (group: TriggerGroup | undefined) => TriggerGroup | undefined) => {
    updateSelected((prev) => ({
      ...prev,
      activationCondition: updater(prev.activationCondition),
    }));
  };

  const updateActivationTiming = (timing: TriggerTiming) => {
    updateSelected((prev) => {
      const current = prev.activationTiming ?? [];
      const exists = current.includes(timing);
      const next = exists ? current.filter((entry) => entry !== timing) : [...current, timing];
      return { ...prev, activationTiming: next.length ? next : undefined };
    });
  };

  const updateNodeAtPath = (group: TriggerGroup, path: number[], updater: (node: TriggerNode) => TriggerNode): TriggerGroup => {
    if (path.length === 0) return group;
    const [index, ...rest] = path;
    const nextClauses = group.clauses.map((clause, clauseIndex) => {
      if (clauseIndex !== index) return clause;
      if (rest.length === 0) return updater(clause);
      if (clause.type !== 'group') return clause;
      return updateNodeAtPath(clause, rest, updater);
    });
    return { ...group, clauses: nextClauses };
  };

  const removeNodeAtPath = (group: TriggerGroup, path: number[]): TriggerGroup => {
    if (path.length === 0) return group;
    const [index, ...rest] = path;
    if (rest.length === 0) {
      return { ...group, clauses: group.clauses.filter((_, clauseIndex) => clauseIndex !== index) };
    }
    const nextClauses = group.clauses.map((clause, clauseIndex) => {
      if (clauseIndex !== index) return clause;
      if (clause.type !== 'group') return clause;
      return removeNodeAtPath(clause, rest);
    });
    return { ...group, clauses: nextClauses };
  };

  const content = (
    <div className="relative bg-game-bg-dark border border-game-teal/40 rounded-lg p-4 w-[1200px] max-w-[95vw] max-h-[90vh] overflow-hidden text-game-white menu-text">
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <button
          type="button"
          onClick={writeToDisk}
          className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded cursor-pointer text-game-teal"
        >
          Save
        </button>
        {!embedded && (
          <button
            onClick={onClose}
            className="text-xs text-game-pink border border-game-pink rounded w-6 h-6 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
            title="Close"
          >
            x
          </button>
        )}
      </div>
      <div className="text-xs text-game-teal tracking-[4px] mb-3">ORIM EDITOR</div>
      <div className="grid grid-cols-[1fr_1fr] gap-4 h-[74vh]">
        <div className="flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orim..."
              className="flex-1 text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1 text-game-white"
            />
            <button
              type="button"
              onClick={handleAddOrim}
              className="text-xs font-mono bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded cursor-pointer text-game-teal"
            >
              + Add Orim
            </button>
            <button
              type="button"
              onClick={handleCopyJson}
              className="text-xs font-mono bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded cursor-pointer text-game-teal"
              title="Copy definitions JSON"
            >
              Copy JSON
            </button>
          </div>

          {search.trim() && (
            <div className="border border-game-teal/20 rounded p-2 max-h-[140px] overflow-y-auto">
              <div className="text-[10px] text-game-white/60 mb-1">Load Orim</div>
              <div className="flex flex-col gap-1">
                {filtered.map((item, index) => (
                  <button
                    key={`orim-search-${item.id}-${index}`}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setActiveTab('details');
                    }}
                    className={`text-[10px] font-mono text-left px-2 py-1 rounded border ${item.id === selectedId ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                  >
                    {item.name} <span className="text-game-white/40">({item.id})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selected ? (
            <div className="border border-game-teal/20 rounded p-3 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className={`text-[10px] font-mono px-2 py-1 rounded border ${activeTab === 'details' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                >
                  Details
                </button>
                {showAbilityTab && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('ability')}
                    className={`text-[10px] font-mono px-2 py-1 rounded border ${activeTab === 'ability' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                  >
                    Ability
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('affinity')}
                  className={`text-[10px] font-mono px-2 py-1 rounded border ${activeTab === 'affinity' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                >
                  Affinity
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('activation')}
                  className={`text-[10px] font-mono px-2 py-1 rounded border ${activeTab === 'activation' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                >
                  Activation
                </button>
              </div>

              {activeTab === 'details' && (
                <div className="grid gap-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Type</span>
                        <div className="flex items-center gap-2">
                        {CATEGORIES.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => {
                              updateSelected((prev) => ({ ...prev, category }));
                              if (category !== 'ability' && activeTab === 'ability') {
                                setActiveTab('details');
                              }
                            }}
                            className={`w-8 h-8 flex items-center justify-center rounded border text-sm ${selected.category === category ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                            title={category}
                          >
                            {CATEGORY_GLYPHS[category]}
                          </button>
                        ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Domain</span>
                        <div className="flex items-center gap-2">
                          {DOMAINS.map((domain) => (
                            <button
                              key={domain}
                              type="button"
                              onClick={() => updateSelected((prev) => ({ ...prev, domain }))}
                              className={`w-8 h-8 flex items-center justify-center rounded border text-sm ${selected.domain === domain ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                              title={domain}
                            >
                              {domain === 'puzzle' ? '🧩' : '⚔'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Power</span>
                        <input
                          type="number"
                          value={selected.powerCost ?? 0}
                          onChange={(e) => updateSelected((prev) => ({ ...prev, powerCost: Number(e.target.value) }))}
                          className="w-16 text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Rarity</span>
                        <div className="flex items-center gap-1">
                          {([
                            { value: 'common', label: '○' },
                            { value: 'rare', label: '◇' },
                            { value: 'epic', label: '✧' },
                            { value: 'legendary', label: '✪' },
                            { value: 'mythic', label: '✴' },
                          ] as { value: OrimRarity; label: string }[]).map((rarity) => (
                            <button
                              key={rarity.value}
                              type="button"
                              onClick={() => updateSelected((prev) => ({ ...prev, rarity: rarity.value }))}
                              className={`w-8 h-8 flex items-center justify-center rounded border text-sm ${selected.rarity === rarity.value ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                              title={rarity.value}
                            >
                              {rarity.label}
                            </button>
                          ))}
                          <span className="ml-2 text-[10px] text-game-white/70">
                            {selected.rarity}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Title</span>
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
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Art</span>
                    <div className="flex items-center gap-2">
                      <input
                        value={selected.artSrc ?? ''}
                        onChange={(e) => updateSelected((prev) => ({ ...prev, artSrc: e.target.value }))}
                        placeholder="/assets/orims/filename.png"
                        className="flex-1 text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
                      >
                        Browse
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          updateSelected((prev) => ({ ...prev, artSrc: `/assets/orims/${file.name}` }));
                          e.currentTarget.value = '';
                        }}
                      />
                    </div>
                  </div>



                </div>
              )}

              {activeTab === 'ability' && selected.category === 'ability' && (
                <div className="grid gap-3 text-xs">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Damage</span>
                    <input
                      type="number"
                      value={selected.damage ?? 0}
                      onChange={(e) => updateSelected((prev) => ({ ...prev, damage: Number(e.target.value) }))}
                      className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 text-[10px] text-game-white/70">
                    <span>Grants Wild</span>
                    <input
                      type="checkbox"
                      checked={!!selected.grantsWild}
                      onChange={(e) => updateSelected((prev) => ({ ...prev, grantsWild: e.target.checked }))}
                    />
                  </label>
                </div>
              )}

              {activeTab === 'affinity' && (
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  {ELEMENTS.map((element) => {
                    const suit = ELEMENT_TO_SUIT[element];
                    const color = SUIT_COLORS[suit];
                    const label = getSuitDisplay(suit, showGraphics);
                    const value = selected.affinity?.[element] ?? 0;
                    return (
                      <label key={element} className="flex items-center justify-between gap-2 border border-game-teal/20 rounded px-2 py-1">
                        <span style={{ color }}>{label}</span>
                        <input
                          type="number"
                          min={0}
                          value={value}
                          onChange={(e) => handleAffinityChange(element, Number(e.target.value))}
                          className="w-12 text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-1 py-[2px]"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              {activeTab === 'activation' && (
                <div className="flex flex-col gap-3 text-[10px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-game-white/60">Timing</span>
                    {TIMINGS.map((timing) => {
                      const enabled = selected.activationTiming?.includes(timing) ?? false;
                      return (
                        <button
                          key={timing}
                          type="button"
                          onClick={() => updateActivationTiming(timing)}
                          className={`px-2 py-1 rounded border font-mono ${enabled ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                        >
                          {timing}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateActivation((prev) => prev ?? defaultGroup())}
                      className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
                    >
                      {selected.activationCondition ? 'Reset' : 'Add Condition'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelected((prev) => ({ ...prev, activationCondition: undefined }))}
                      className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-pink/40 px-2 py-1 rounded cursor-pointer text-game-pink"
                    >
                      Clear
                    </button>
                  </div>

                  {selected.activationCondition && (
                    <div className="border border-game-teal/20 rounded p-2">
                      <TriggerGroupEditor
                        group={selected.activationCondition}
                        path={[]}
                        onChange={(next) => updateActivation(() => next)}
                        onUpdateNode={(path, updater) => updateActivation((prev) => (
                          prev ? updateNodeAtPath(prev, path, updater) : prev
                        ))}
                        onRemoveNode={(path) => updateActivation((prev) => (
                          prev ? removeNodeAtPath(prev, path) : prev
                        ))}
                        defaultCondition={defaultCondition}
                        defaultGroup={defaultGroup}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 border border-game-teal/20 rounded p-4 text-xs text-game-white/50">
              Select an orim to edit.
            </div>
          )}
        </div>

        <div className="border border-game-teal/20 rounded p-3 flex flex-col gap-3">
          {saveStatus && (
            <div className="text-[10px] text-game-white/50">{saveStatus}</div>
          )}
          {!selected && (
            <div className="text-xs text-game-white/50">No orim selected.</div>
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-[10030]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full h-full flex items-start justify-center p-6">
        {content}
      </div>
    </div>
  );
}
function TriggerGroupEditor({
  group,
  path,
  onChange,
  onUpdateNode,
  onRemoveNode,
  defaultCondition,
  defaultGroup,
}: {
  group: TriggerGroup;
  path: number[];
  onChange: (next: TriggerGroup) => void;
  onUpdateNode: (path: number[], updater: (node: TriggerNode) => TriggerNode) => void;
  onRemoveNode: (path: number[]) => void;
  defaultCondition: () => TriggerCondition;
  defaultGroup: () => TriggerGroup;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          value={group.op}
          onChange={(e) => onChange({ ...group, op: e.target.value as 'and' | 'or' })}
          className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
        >
          <option value="and">AND</option>
          <option value="or">OR</option>
        </select>
        <label className="flex items-center gap-1 text-[10px] text-game-white/70">
          <input
            type="checkbox"
            checked={!!group.not}
            onChange={(e) => onChange({ ...group, not: e.target.checked })}
          />
          NOT
        </label>
        <button
          type="button"
          onClick={() => onChange({ ...group, clauses: [...group.clauses, defaultCondition()] })}
          className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
        >
          + Condition
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...group, clauses: [...group.clauses, defaultGroup()] })}
          className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
        >
          + Group
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {group.clauses.map((clause, index) => {
          const clausePath = [...path, index];
          if (clause.type === 'group') {
            return (
              <div key={clausePath.join('-')} className="border border-game-teal/20 rounded p-2">
                <div className="flex justify-end mb-1">
                  <button
                    type="button"
                    onClick={() => onRemoveNode(clausePath)}
                    className="text-[10px] font-mono text-game-pink"
                  >
                    Remove Group
                  </button>
                </div>
                <TriggerGroupEditor
                  group={clause}
                  path={clausePath}
                  onChange={(next) => onUpdateNode(clausePath, () => next)}
                  onUpdateNode={onUpdateNode}
                  onRemoveNode={onRemoveNode}
                  defaultCondition={defaultCondition}
                  defaultGroup={defaultGroup}
                />
              </div>
            );
          }

          return (
            <div key={clausePath.join('-')} className="flex items-center gap-2">
              <select
                value={clause.left.type === 'field' ? clause.left.field : 'actor.combo'}
                onChange={(e) => {
                  const field = e.target.value as TriggerField;
                  onUpdateNode(clausePath, (node) => ({
                    ...node,
                    left: { type: 'field', field },
                  }));
                }}
                className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
              >
                {FIELDS.map((field) => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
              <select
                value={clause.operator}
                onChange={(e) => {
                  const operator = e.target.value as TriggerOperator;
                  onUpdateNode(clausePath, (node) => ({
                    ...node,
                    operator,
                  }));
                }}
                className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
              >
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
              <input
                type="number"
                value={clause.right.type === 'number' ? clause.right.value : 0}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  onUpdateNode(clausePath, (node) => ({
                    ...node,
                    right: { type: 'number', value },
                  }));
                }}
                className="w-16 text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
              />
              <button
                type="button"
                onClick={() => onRemoveNode(clausePath)}
                className="text-[10px] font-mono text-game-pink"
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
