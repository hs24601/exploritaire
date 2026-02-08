import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActorDefinition, ActorType, Element, Suit, OrimDefinition, OrimCategory } from '../engine/types';
import { SUITS, getSuitDisplay } from '../engine/constants';
import { useGraphics } from '../contexts/GraphicsContext';
import { WatercolorOverrideEditor } from './WatercolorOverrideEditor';

const ELEMENTS: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];
const ACTOR_TYPES: ActorType[] = ['adventurer', 'npc'];
const CATEGORY_GLYPHS: Record<OrimCategory, string> = {
  ability: '⚡️',
  utility: '💫',
  trait: '🧬',
  elemental: '◇',
};

const normalizeActorId = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const createBlankActor = (name = 'New Actor'): ActorDefinition => ({
  id: normalizeActorId(name),
  name,
  titles: [name],
  description: '',
  type: 'adventurer',
  value: 1,
  element: 'N',
  sprite: '✨',
  orimSlots: [{ locked: false }],
});

const serializeActorDefinitions = (definitions: ActorDefinition[]) => {
  const lines: string[] = [];
  lines.push('export const ACTOR_DEFINITIONS: ActorDefinition[] = [');
  definitions.forEach((actor) => {
    lines.push('  {');
    lines.push(`    id: '${actor.id}',`);
    lines.push(`    name: '${actor.name}',`);
    lines.push(`    titles: ${JSON.stringify(actor.titles)},`);
    lines.push(`    description: '${actor.description.replace(/'/g, "\\'")}',`);
    lines.push(`    type: '${actor.type}',`);
    lines.push(`    value: ${actor.value},`);
    if (actor.suit) {
      lines.push(`    suit: '${actor.suit}',`);
    } else {
      lines.push('    suit: undefined,');
    }
    if (actor.element) {
      lines.push(`    element: '${actor.element}',`);
    } else {
      lines.push('    element: undefined,');
    }
    lines.push(`    sprite: '${actor.sprite}',`);
    if (actor.artSrc) {
      lines.push(`    artSrc: '${actor.artSrc.replace(/'/g, "\\'")}',`);
    }
    if (actor.orimSlots && actor.orimSlots.length > 0) {
      lines.push('    orimSlots: [');
      actor.orimSlots.forEach((slot) => {
        const parts: string[] = [];
        if (slot.orimId) {
          parts.push(`orimId: '${slot.orimId}'`);
        }
        if (slot.locked) {
          parts.push('locked: true');
        }
        lines.push(`      { ${parts.join(', ')} },`);
      });
      lines.push('    ],');
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

const serializeDeckTemplates = (
  templates: Record<string, { values: number[]; slotsPerCard?: number[]; starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[]; slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[] }>
) => {
  const entries = Object.entries(templates);
  const lines: string[] = [];
  lines.push('export const ACTOR_DECK_TEMPLATES: Record<string, { values: number[]; slotsPerCard?: number[]; starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[]; slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[] }> = {');
  entries.forEach(([key, value]) => {
    lines.push(`  ${key}: {`);
    lines.push(`    values: [${value.values.join(', ')}],`);
    if (value.slotsPerCard && value.slotsPerCard.length > 0) {
      lines.push(`    slotsPerCard: [${value.slotsPerCard.join(', ')}],`);
    }
    if (value.starterOrim && value.starterOrim.length > 0) {
      lines.push('    starterOrim: [');
      value.starterOrim.forEach((starter) => {
        const slotIndex = starter.slotIndex !== undefined ? `, slotIndex: ${starter.slotIndex}` : '';
        lines.push(`      { cardIndex: ${starter.cardIndex}${slotIndex}, orimId: '${starter.orimId}' },`);
      });
      lines.push('    ],');
    } else {
      lines.push('    starterOrim: [],');
    }
    if (value.slotLocks && value.slotLocks.length > 0) {
      lines.push('    slotLocks: [');
      value.slotLocks.forEach((lock) => {
        const slotIndex = lock.slotIndex !== undefined ? `, slotIndex: ${lock.slotIndex}` : '';
        lines.push(`      { cardIndex: ${lock.cardIndex}${slotIndex}, locked: ${lock.locked ? 'true' : 'false'} },`);
      });
      lines.push('    ],');
    }
    lines.push('  },');
  });
  lines.push('};');
  return lines.join('\n');
};

const normalizeDeckTemplate = (template: { values: number[]; slotsPerCard?: number[]; starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[]; slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[] }) => {
  const values = template.values.slice(0, 2);
  const slotsPerCard = template.slotsPerCard ? template.slotsPerCard.slice(0, 2) : undefined;
  const starterOrim = (template.starterOrim ?? []).filter((entry) => entry.cardIndex < 2);
  const slotLocks = (template.slotLocks ?? []).filter((entry) => entry.cardIndex < 2);
  return { ...template, values, slotsPerCard, starterOrim, slotLocks };
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

export function ActorEditor({
  onClose,
  definitions: definitionsProp,
  deckTemplates: deckTemplatesProp,
  orimDefinitions,
  onChange,
  onDeckChange,
  embedded = false,
}: {
  onClose: () => void;
  definitions: ActorDefinition[];
  deckTemplates: Record<string, { values: number[]; slotsPerCard?: number[]; starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[]; slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[] }>;
  orimDefinitions: OrimDefinition[];
  onChange: (next: ActorDefinition[]) => void;
  onDeckChange: (next: Record<string, { values: number[]; slotsPerCard?: number[]; starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[]; slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[] }>) => void;
  embedded?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showGraphics = useGraphics();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'titles'>('details');
  const [rightTab, setRightTab] = useState<'deck' | 'watercolor'>('deck');
  const [definitions, setDefinitions] = useState<ActorDefinition[]>(definitionsProp);
  const [deckTemplates, setDeckTemplates] = useState(deckTemplatesProp);
  const [selectedId, setSelectedId] = useState<string | null>(() => (definitionsProp[0]?.id ?? null));
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    setDefinitions(definitionsProp);
  }, [definitionsProp]);

  useEffect(() => {
    setDeckTemplates(deckTemplatesProp);
  }, [deckTemplatesProp]);

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

  const commitDefinitions = useCallback((next: ActorDefinition[]) => {
    setDefinitions(next);
    onChange(next);
  }, [onChange]);

  const commitDeckTemplates = useCallback((
    next: Record<string, { values: number[]; slotsPerCard?: number[]; starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[]; slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[] }>
  ) => {
    const normalized = Object.fromEntries(
      Object.entries(next).map(([key, value]) => [key, normalizeDeckTemplate(value)])
    );
    setDeckTemplates(normalized);
    onDeckChange(normalized);
  }, [onDeckChange]);

  const renderOrimPreview = useCallback((orim: OrimDefinition) => (
    <div className="ml-6 rounded border border-game-teal/20 bg-game-bg-dark/60 px-2 py-1 text-[10px] text-game-white/70">
      <div className="text-game-teal font-bold">{orim.name}</div>
      <div className="flex flex-wrap gap-2">
        <span>{CATEGORY_GLYPHS[orim.category]}</span>
        <span>{orim.rarity}</span>
        <span>Power {orim.powerCost}</span>
        {orim.damage !== undefined && <span>DMG {orim.damage}</span>}
        {orim.affinity && (
          <span>
            Affinity {Object.entries(orim.affinity)
              .map(([key, value]) => `${key}:${value}`)
              .join(' ')}
          </span>
        )}
      </div>
      {orim.description && (
        <div className="mt-1 text-game-white/60">
          {orim.description}
        </div>
      )}
    </div>
  ), []);

  const updateSelected = useCallback((updater: (prev: ActorDefinition) => ActorDefinition) => {
    if (!selectedId) return;
    commitDefinitions(definitions.map((item) => {
      if (item.id !== selectedId) return item;
      return updater(item);
    }));
  }, [commitDefinitions, definitions, selectedId]);

  const handleNameChange = useCallback((name: string) => {
    updateSelected((prev) => {
      const nextId = normalizeActorId(name);
      return {
        ...prev,
        name,
        id: nextId,
      };
    });
    setSelectedId(normalizeActorId(name));
  }, [updateSelected]);

  const handleTitlesChange = useCallback((value: string) => {
    const titles = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    updateSelected((prev) => ({ ...prev, titles: titles.length ? titles : [prev.name] }));
  }, [updateSelected]);

  const handleAddActor = useCallback(() => {
    const fresh = createBlankActor(`New Actor ${definitions.length + 1}`);
    commitDefinitions([...definitions, fresh]);
    setSelectedId(fresh.id);
    setActiveTab('details');
  }, [commitDefinitions, definitions]);

  const unwrapRawModule = useCallback((text: string) => {
    const match = text.match(/^export default "([\s\S]*?)";/);
    if (!match) return text;
    try {
      return JSON.parse(`"${match[1]}"`);
    } catch {
      return text;
    }
  }, []);

  const writeToDisk = useCallback(async () => {
    try {
      const actorsPath = '/src/engine/actors.ts?raw';
      const decksPath = '/src/engine/actorDecks.ts?raw';
      const actorsResponse = await fetch(actorsPath);
      const decksResponse = await fetch(decksPath);
      if (!actorsResponse.ok) {
        setSaveStatus('Failed to load actors.ts from dev server.');
        return;
      }
      if (!decksResponse.ok) {
        setSaveStatus('Failed to load actorDecks.ts from dev server.');
        return;
      }
      const actorsText = unwrapRawModule(await actorsResponse.text());
      const decksText = unwrapRawModule(await decksResponse.text());
      const actorReplacement = serializeActorDefinitions(definitions);
      const deckReplacement = serializeDeckTemplates(deckTemplates);
      const updatedActors = replaceSection(actorsText, '// ACTOR_DEFINITIONS_START', '// ACTOR_DEFINITIONS_END', actorReplacement);
      const updatedDecks = replaceSection(decksText, '// ACTOR_DECK_TEMPLATES_START', '// ACTOR_DECK_TEMPLATES_END', deckReplacement);
      if (!updatedActors) {
        setSaveStatus('Could not find ACTOR_DEFINITIONS markers in actors.ts.');
        return;
      }
      if (!updatedDecks) {
        setSaveStatus('Could not find ACTOR_DECK_TEMPLATES markers in actorDecks.ts.');
        return;
      }
      await writeFileToDisk('src/engine/actors.ts', updatedActors);
      await writeFileToDisk('src/engine/actorDecks.ts', updatedDecks);
      setSaveStatus(`Saved ${definitions.length} actors and ${Object.keys(deckTemplates).length} decks.`);
    } catch (error) {
      setSaveStatus('Save failed. Ensure the dev server write hook is available.');
    }
  }, [definitions, deckTemplates, unwrapRawModule]);

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
      <div className="text-xs text-game-teal tracking-[4px] mb-3">ACTOR EDITOR</div>
      <div className="grid grid-cols-[1fr_1fr] gap-4 h-[74vh]">
            <div className="flex flex-col gap-3 overflow-hidden">
              <div className="flex items-center gap-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search actors..."
                  className="flex-1 text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1 text-game-white"
                />
                <button
                  type="button"
                  onClick={handleAddActor}
                  className="text-xs font-mono bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded cursor-pointer text-game-teal"
                >
                  + Add Actor
                </button>
              </div>

              {search.trim() && (
                <div className="border border-game-teal/20 rounded p-2 max-h-[140px] overflow-y-auto">
                  <div className="text-[10px] text-game-white/60 mb-1">Load Actor</div>
                  <div className="flex flex-col gap-1">
                    {filtered.map((item) => (
                      <button
                        key={item.id}
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
                    <button
                      type="button"
                      onClick={() => setActiveTab('titles')}
                      className={`text-[10px] font-mono px-2 py-1 rounded border ${activeTab === 'titles' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                    >
                      Titles
                    </button>
                  </div>

                  {activeTab === 'details' && (
                    <div className="grid gap-3 text-xs">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Type</span>
                        <select
                          value={selected.type}
                          onChange={(e) => updateSelected((prev) => ({ ...prev, type: e.target.value as ActorType }))}
                          className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                        >
                          {ACTOR_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </label>

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
                          value={selected.description}
                          onChange={(e) => updateSelected((prev) => ({ ...prev, description: e.target.value }))}
                          className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Value</span>
                        <input
                          type="number"
                          value={selected.value}
                          onChange={(e) => updateSelected((prev) => ({ ...prev, value: Number(e.target.value) }))}
                          className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Element</span>
                        <select
                          value={selected.element ?? ''}
                          onChange={(e) => {
                            const value = e.target.value as Element;
                            updateSelected((prev) => ({ ...prev, element: value || undefined }));
                          }}
                          className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                        >
                          <option value="">None</option>
                          {ELEMENTS.map((element) => (
                            <option key={element} value={element}>
                              {element}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Suit</span>
                        <select
                          value={selected.suit ?? ''}
                          onChange={(e) => {
                            const value = e.target.value as Suit;
                            updateSelected((prev) => ({ ...prev, suit: value || undefined }));
                          }}
                          className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                        >
                          <option value="">None</option>
                          {SUITS.map((suit) => (
                            <option key={suit} value={suit}>
                              {getSuitDisplay(suit, showGraphics)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Sprite</span>
                        <input
                          value={selected.sprite}
                          onChange={(e) => updateSelected((prev) => ({ ...prev, sprite: e.target.value }))}
                          className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                        />
                      </label>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Art</span>
                        <div className="flex items-center gap-2">
                          <input
                            value={selected.artSrc ?? ''}
                            onChange={(e) => updateSelected((prev) => ({ ...prev, artSrc: e.target.value }))}
                            placeholder="/assets/actors/filename.png"
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
                          updateSelected((prev) => ({ ...prev, artSrc: `/assets/actors/${file.name}` }));
                          e.currentTarget.value = '';
                        }}
                      />
                    </div>
                  </div>
                      <div className="border border-game-teal/20 rounded p-2 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-game-white/60">Actor ORIM Slots</span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextSlots = [...(selected.orimSlots ?? [])];
                              nextSlots.push({ locked: false });
                              updateSelected((prev) => ({ ...prev, orimSlots: nextSlots }));
                            }}
                            className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
                          >
                            + Slot
                          </button>
                        </div>
                        <div className="flex flex-col gap-2">
                          {(selected.orimSlots ?? []).map((slot, slotIndex) => {
                            const selectedOrim = slot.orimId
                              ? orimDefinitions.find((orim) => orim.id === slot.orimId) ?? null
                              : null;
                            return (
                              <div key={`actor-orim-${selected.id}-${slotIndex}`} className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-2 text-[10px] text-game-white/60">
                                    <input
                                      type="checkbox"
                                      checked={slot.locked ?? false}
                                      onChange={(e) => {
                                        const nextSlots = [...(selected.orimSlots ?? [])];
                                        nextSlots[slotIndex] = {
                                          ...nextSlots[slotIndex],
                                          locked: e.target.checked,
                                        };
                                        updateSelected((prev) => ({ ...prev, orimSlots: nextSlots }));
                                      }}
                                    />
                                    <span>Slot {slotIndex + 1}</span>
                                  </label>
                                  <select
                                    value={slot.orimId ?? ''}
                                    onChange={(e) => {
                                      const nextSlots = [...(selected.orimSlots ?? [])];
                                      nextSlots[slotIndex] = {
                                        ...nextSlots[slotIndex],
                                        orimId: e.target.value || undefined,
                                      };
                                      updateSelected((prev) => ({ ...prev, orimSlots: nextSlots }));
                                    }}
                                    className="flex-1 text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                                  >
                                    <option value="">None</option>
                                    {orimDefinitions.map((orim) => (
                                      <option key={orim.id} value={orim.id}>
                                        {orim.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={(selected.orimSlots ?? []).length <= 1}
                                    onClick={() => {
                                      const nextSlots = (selected.orimSlots ?? []).filter((_, i) => i !== slotIndex);
                                      updateSelected((prev) => ({ ...prev, orimSlots: nextSlots.length ? nextSlots : [{ locked: false }] }));
                                    }}
                                    className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    - Slot
                                  </button>
                                </div>
                                {selectedOrim && renderOrimPreview(selectedOrim)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'titles' && (
                    <div className="grid gap-2 text-xs">
                      <div className="text-[10px] text-game-white/60">Titles (one per line)</div>
                      <textarea
                        rows={6}
                        value={selected.titles.join('\n')}
                        onChange={(e) => handleTitlesChange(e.target.value)}
                        className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 border border-game-teal/20 rounded p-4 text-xs text-game-white/50">
                  Select an actor to edit.
                </div>
              )}
            </div>

            <div className="border border-game-teal/20 rounded p-3 flex flex-col gap-3 overflow-y-auto">
              {saveStatus && (
                <div className="text-[10px] text-game-white/50">{saveStatus}</div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRightTab('deck')}
                  className={`text-[10px] font-mono px-2 py-1 rounded border ${rightTab === 'deck' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                >
                  Deck Cards
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab('watercolor')}
                  className={`text-[10px] font-mono px-2 py-1 rounded border ${rightTab === 'watercolor' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                >
                  Watercolor
                </button>
              </div>

              {rightTab === 'deck' && (
                selected ? (
                  (() => {
                    const deck = normalizeDeckTemplate(
                      deckTemplates[selected.id] ?? { values: [], slotsPerCard: [], starterOrim: [] }
                    );
                return (
                  <div className="flex flex-col gap-3 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-game-white/50">
                        {deck.values.length === 0 ? 'No deck defined.' : `Cards: ${deck.values.length}`}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextValues = [...deck.values, 1];
                          const nextSlots = [...(deck.slotsPerCard ?? deck.values.map(() => 1)), 1];
                          const next = { ...deck, values: nextValues, slotsPerCard: nextSlots };
                          commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                        }}
                        className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
                      >
                        + Add Card
                      </button>
                    </div>
                        {deck.values.map((value, index) => {
                          const starterSlots = deck.starterOrim?.filter((entry) => entry.cardIndex === index) ?? [];
                          const slotLocks = deck.slotLocks?.filter((entry) => entry.cardIndex === index) ?? [];
                          const baseSlotCount = deck.slotsPerCard?.[index] ?? 1;
                          const maxSlotIndex = starterSlots.reduce((max, entry) => {
                            const slotIndex = entry.slotIndex ?? 0;
                            return Math.max(max, slotIndex);
                          }, 0);
                          const slotCount = Math.max(baseSlotCount, maxSlotIndex + 1);
                          return (
                            <div key={`${selected.id}-card-${index}`} className="border border-game-teal/20 rounded p-2">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-game-white/60">Card {index + 1}</span>
                                <input
                                  type="number"
                                  value={value}
                                  onChange={(e) => {
                                    const nextValues = [...deck.values];
                                    nextValues[index] = Number(e.target.value);
                                    const next = { ...deck, values: nextValues };
                                    commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                  }}
                                  className="w-12 text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-1 py-[2px]"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                {Array.from({ length: slotCount }).map((_, slotIndex) => {
                                  const starter = starterSlots.find((entry) => (entry.slotIndex ?? 0) === slotIndex);
                                  const isSlotLocked = slotLocks.some((entry) => (entry.slotIndex ?? 0) === slotIndex && entry.locked);
                                  const selectedOrim = starter?.orimId
                                    ? orimDefinitions.find((orim) => orim.id === starter.orimId) ?? null
                                    : null;
                                  return (
                                    <div key={`${selected.id}-card-${index}-slot-${slotIndex}`} className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <label className="flex items-center gap-2 text-[10px] text-game-white/60">
                                          <input
                                            type="checkbox"
                                            checked={isSlotLocked}
                                            onChange={(e) => {
                                              const nextLocks = (deck.slotLocks ?? []).filter((entry) => !(
                                                entry.cardIndex === index && (entry.slotIndex ?? 0) === slotIndex
                                              ));
                                              if (e.target.checked) {
                                                nextLocks.push({ cardIndex: index, slotIndex, locked: true });
                                              }
                                              const next = { ...deck, slotLocks: nextLocks };
                                              commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                            }}
                                          />
                                          <span>Slot {slotIndex + 1}</span>
                                        </label>
                                        <select
                                          value={starter?.orimId ?? ''}
                                          onChange={(e) => {
                                            const orimId = e.target.value;
                                            const nextStarters = (deck.starterOrim ?? []).filter((entry) => (
                                              !(entry.cardIndex === index && (entry.slotIndex ?? 0) === slotIndex)
                                            ));
                                            if (orimId) {
                                              nextStarters.push({ cardIndex: index, slotIndex, orimId });
                                            }
                                            const next = { ...deck, starterOrim: nextStarters };
                                            commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                          }}
                                          className="flex-1 text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                                        >
                                          <option value="">None</option>
                                  {orimDefinitions.map((orim) => (
                                    <option key={orim.id} value={orim.id}>
                                      {orim.name}
                                    </option>
                                  ))}
                                        </select>
                                      </div>
                                      {selectedOrim && renderOrimPreview(selectedOrim)}
                                    </div>
                                  );
                                })}
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextSlots = [...(deck.slotsPerCard ?? deck.values.map(() => 1))];
                                      nextSlots[index] = (nextSlots[index] ?? 1) + 1;
                                      const next = { ...deck, slotsPerCard: nextSlots };
                                      commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                    }}
                                    className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
                                  >
                                    + Slot
                                  </button>
                                  <button
                                    type="button"
                                    disabled={slotCount <= 1}
                                    onClick={() => {
                                      if (slotCount <= 1) return;
                                      const nextSlots = [...(deck.slotsPerCard ?? deck.values.map(() => 1))];
                                      nextSlots[index] = Math.max(1, (nextSlots[index] ?? 1) - 1);
                                      const nextStarters = (deck.starterOrim ?? []).filter((entry) => (
                                        entry.cardIndex !== index || (entry.slotIndex ?? 0) < nextSlots[index]
                                      ));
                                      const nextLocks = (deck.slotLocks ?? []).filter((entry) => (
                                        entry.cardIndex !== index || (entry.slotIndex ?? 0) < nextSlots[index]
                                      ));
                                      const next = { ...deck, slotsPerCard: nextSlots, starterOrim: nextStarters, slotLocks: nextLocks };
                                      commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                    }}
                                    className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    - Slot
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-xs text-game-white/50">No actor selected.</div>
                )
              )}

              {rightTab === 'watercolor' && (
                selected ? (
                  <WatercolorOverrideEditor
                    mode="actor"
                    actorDefinition={selected}
                    showGraphics={showGraphics}
                  />
                ) : (
                  <div className="text-xs text-game-white/50">No actor selected.</div>
                )
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
