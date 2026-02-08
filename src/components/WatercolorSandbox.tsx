import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Card as CardType, ActorDefinition, OrimDefinition, Element } from '../engine/types';
import { CARD_SIZE, ELEMENT_TO_SUIT, SUIT_COLORS, getSuitDisplay } from '../engine/constants';
import type { WatercolorConfig, SplotchShape } from '../watercolor/types';
import { ACTOR_WATERCOLOR_TEMPLATE, buildActorWatercolorConfig, type ActorWatercolorTemplate } from '../watercolor/presets';
import { cloneWatercolorConfig } from '../watercolor/editorDefaults';
import { WATERCOLOR_SANDBOX_TARGETS, type WatercolorSandboxTarget } from '../watercolor/sandboxTargets';
import { ACTOR_WATERCOLOR_OVERRIDES, ORIM_WATERCOLOR_OVERRIDES } from '../watercolor/overrides';
import { Card } from './Card';
import { WatercolorOverlay } from '../watercolor/WatercolorOverlay';
import { ORIM_WATERCOLOR_CANVAS_SCALE, ORIM_WATERCOLOR_OVERALL_SCALE_MULTIPLIER } from '../watercolor/orimWatercolor';
import { WatercolorContext } from '../watercolor/useWatercolorEnabled';
import { useGraphics } from '../contexts/GraphicsContext';
import { GAME_BORDER_WIDTH } from '../utils/styles';
import { getActorDisplayGlyph } from '../engine/actors';

const BLEND_MODES = ['screen', 'multiply', 'overlay', 'normal', 'soft-light', 'hard-light'];
const SHAPES: SplotchShape[] = ['circle', 'rectangle', 'hollow-rect'];
const SPLOTCH_LABELS = ['Accent', 'Top', 'Mid', 'Base', 'Aura'] as const;
const SPLOTCH_DISPLAY_ORDER = [
  { label: 'Aura', index: 4 },
  { label: 'Base', index: 3 },
  { label: 'Mid', index: 2 },
  { label: 'Top', index: 1 },
  { label: 'Accent', index: 0 },
] as const;
const CARD_WATERCOLOR_CANVAS_SCALE = 1.35;
const CARD_WATERCOLOR_OVERALL_SCALE_MULTIPLIER = 1 / CARD_WATERCOLOR_CANVAS_SCALE;
const ORIM_CATEGORY_GLYPHS: Record<string, string> = {
  ability: '⚡️',
  utility: '💫',
  trait: '🧬',
};
const ORIM_ELEMENT_PRIORITY: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];

const getOrimPrimaryElement = (definition: OrimDefinition | null): Element | null => {
  if (!definition?.affinity) return null;
  let best: Element | null = null;
  let bestValue = -Infinity;
  for (const element of ORIM_ELEMENT_PRIORITY) {
    const value = definition.affinity[element];
    if (value === undefined) continue;
    if (value > bestValue) {
      bestValue = value;
      best = element;
    }
  }
  return best;
};

const getOrimDisplay = (definition: OrimDefinition | null, showGraphics: boolean): string => {
  if (!definition) return showGraphics ? '◌' : '-';
  const primaryElement = getOrimPrimaryElement(definition);
  if (primaryElement) {
    const suit = ELEMENT_TO_SUIT[primaryElement];
    return getSuitDisplay(suit, showGraphics);
  }
  if (showGraphics) return ORIM_CATEGORY_GLYPHS[definition.category] ?? '◆';
  return definition.category.slice(0, 1).toUpperCase();
};

const fallbackCard: CardType = {
  id: 'preview-card',
  rank: 7,
  suit: '💨',
  element: 'W',
  sourceActorId: 'preview',
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

const indentBlock = (value: string, spaces: number) => {
  const pad = ' '.repeat(spaces);
  return value
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${pad}${line}`))
    .join('\n');
};

const serializeTargets = (targets: WatercolorSandboxTarget[]) => {
  const lines: string[] = [];
  lines.push('export const WATERCOLOR_SANDBOX_TARGETS: WatercolorSandboxTarget[] = [');
  targets.forEach((target) => {
    const cardJson = indentBlock(JSON.stringify(target.card, null, 2), 6);
    const templateJson = target.template
      ? indentBlock(JSON.stringify(target.template, null, 2), 6)
      : null;
    const configJson = target.watercolorConfig
      ? indentBlock(JSON.stringify(target.watercolorConfig, null, 2), 6)
      : null;
    lines.push('  {');
    lines.push(`    id: ${JSON.stringify(target.id)},`);
    lines.push(`    label: ${JSON.stringify(target.label)},`);
    lines.push(`    card: ${cardJson},`);
    if (target.baseColor) {
      lines.push(`    baseColor: ${JSON.stringify(target.baseColor)},`);
    }
    if (templateJson) {
      lines.push(`    template: ${templateJson},`);
    }
    if (configJson) {
      lines.push(`    watercolorConfig: ${configJson},`);
    }
    lines.push('  },');
  });
  lines.push('];');
  return lines.join('\n');
};

const cloneTemplate = (template: ActorWatercolorTemplate) => (
  JSON.parse(JSON.stringify(template)) as ActorWatercolorTemplate
);

const normalizeFiveSplotches = (template?: ActorWatercolorTemplate | null): ActorWatercolorTemplate => {
  if (!template || !Array.isArray(template.splotches)) {
    return cloneTemplate(ACTOR_WATERCOLOR_TEMPLATE);
  }
  const next = cloneTemplate(template);
  if (!Array.isArray(next.splotches) || next.splotches.length === 0) {
    next.splotches = cloneTemplate(ACTOR_WATERCOLOR_TEMPLATE).splotches;
  }
  const last = next.splotches[next.splotches.length - 1] ?? ACTOR_WATERCOLOR_TEMPLATE.splotches[0];
  while (next.splotches.length < 5) {
    next.splotches.push({
      ...last,
      opacity: 0,
      baseColor: undefined,
    });
  }
  return next;
};

export const WatercolorSandbox = memo(function WatercolorSandbox({
  onClose,
  embedded = false,
  actorDefinitions,
  orimDefinitions,
}: {
  onClose: () => void;
  embedded?: boolean;
  actorDefinitions?: ActorDefinition[];
  orimDefinitions?: OrimDefinition[];
}) {
  const showGraphics = useGraphics();
  const initialTargets = WATERCOLOR_SANDBOX_TARGETS.length
    ? WATERCOLOR_SANDBOX_TARGETS
    : [{
      id: 'sandbox-card',
      label: 'Sandbox Card',
      card: fallbackCard,
      baseColor: '#2196f3',
      template: cloneTemplate(ACTOR_WATERCOLOR_TEMPLATE),
      watercolorConfig: buildActorWatercolorConfig('#2196f3', ACTOR_WATERCOLOR_TEMPLATE),
    }];
  const [sourceType, setSourceType] = useState<'global' | 'actor' | 'orim'>('global');
  const [sourceSearch, setSourceSearch] = useState('');
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [selectedOrimId, setSelectedOrimId] = useState<string | null>(null);
  const [targets, setTargets] = useState<WatercolorSandboxTarget[]>(initialTargets);
  const [selectedTargetId, setSelectedTargetId] = useState<string>(initialTargets[0]?.id ?? '');
  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === selectedTargetId) ?? targets[0] ?? null,
    [selectedTargetId, targets],
  );
  const [baseColor, setBaseColor] = useState('#3a3f41');
  const [template, setTemplate] = useState<ActorWatercolorTemplate>(() => cloneTemplate(ACTOR_WATERCOLOR_TEMPLATE));
  const [selectedSplotch, setSelectedSplotch] = useState(0);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (sourceType !== 'global') return;
    if (!selectedTarget) return;
    const targetBase = selectedTarget.baseColor
      ?? selectedTarget.watercolorConfig?.splotches?.[0]?.gradient?.mid
      ?? '#2196f3';
    const targetTemplate = selectedTarget.template
      ? cloneTemplate(selectedTarget.template)
      : (selectedTarget.watercolorConfig
        ? {
          splotches: selectedTarget.watercolorConfig.splotches.map((splotch) => ({
            gradientScale: 1,
            scale: splotch.scale,
            offset: splotch.offset,
            blendMode: splotch.blendMode,
            opacity: splotch.opacity,
            shape: splotch.shape,
            tendrils: splotch.tendrils,
            satellites: splotch.satellites,
            animation: splotch.animation,
          })),
          grain: selectedTarget.watercolorConfig.grain,
          overallScale: selectedTarget.watercolorConfig.overallScale,
        }
        : cloneTemplate(ACTOR_WATERCOLOR_TEMPLATE));
    setBaseColor(targetBase);
    setTemplate(normalizeFiveSplotches(targetTemplate));
    setSelectedSplotch(0);
    setSaveStatus(null);
  }, [selectedTarget, sourceType]);

  useEffect(() => {
    if (sourceType === 'global') {
      setBaseColor('#3a3f41');
      setTemplate(normalizeFiveSplotches(ACTOR_WATERCOLOR_TEMPLATE));
      setSelectedSplotch(0);
      setSaveStatus(null);
      return;
    }
    if (sourceType === 'actor' && selectedActorId) {
      const override = ACTOR_WATERCOLOR_OVERRIDES.find((entry) => entry.actorId === selectedActorId);
      setBaseColor(override?.baseColor ?? '#3a3f41');
      setTemplate(normalizeFiveSplotches(override?.template ?? ACTOR_WATERCOLOR_TEMPLATE));
      setSelectedSplotch(0);
      setSaveStatus(null);
      return;
    }
    if (sourceType === 'orim' && selectedOrimId) {
      const override = ORIM_WATERCOLOR_OVERRIDES.find((entry) => entry.orimId === selectedOrimId);
      setBaseColor(override?.baseColor ?? '#3a3f41');
      setTemplate(normalizeFiveSplotches(override?.template ?? ACTOR_WATERCOLOR_TEMPLATE));
      setSelectedSplotch(0);
      setSaveStatus(null);
    }
  }, [sourceType, selectedActorId, selectedOrimId]);

  const filteredActors = useMemo(() => {
    if (!actorDefinitions) return [];
    if (!sourceSearch.trim()) return actorDefinitions;
    const query = sourceSearch.trim().toLowerCase();
    return actorDefinitions.filter((actor) => (
      actor.id.toLowerCase().includes(query) || actor.name.toLowerCase().includes(query)
    ));
  }, [actorDefinitions, sourceSearch]);

  const filteredOrims = useMemo(() => {
    if (!orimDefinitions) return [];
    if (!sourceSearch.trim()) return orimDefinitions;
    const query = sourceSearch.trim().toLowerCase();
    return orimDefinitions.filter((orim) => (
      orim.id.toLowerCase().includes(query) || orim.name.toLowerCase().includes(query)
    ));
  }, [orimDefinitions, sourceSearch]);

  const config = useMemo<WatercolorConfig>(
    () => buildActorWatercolorConfig(baseColor, template),
    [baseColor, template]
  );
  const cardConfig = useMemo<WatercolorConfig>(() => ({
    ...config,
    overallScale: config.overallScale * CARD_WATERCOLOR_OVERALL_SCALE_MULTIPLIER,
  }), [config]);
  const orimConfig = useMemo<WatercolorConfig>(() => ({
    ...config,
    overallScale: config.overallScale * ORIM_WATERCOLOR_OVERALL_SCALE_MULTIPLIER,
  }), [config]);

  const handleColorChange = useCallback((color: string) => {
    setBaseColor(color);
  }, []);

  const handleSplotchUpdate = useCallback((
    index: number,
    updates: Partial<ActorWatercolorTemplate['splotches'][number]>
  ) => {
    setTemplate((prev) => ({
      ...prev,
      splotches: prev.splotches.map((s, i) => (i === index ? { ...s, ...updates } : s)),
    }));
  }, []);

  const handleGrainUpdate = useCallback((updates: Partial<ActorWatercolorTemplate['grain']>) => {
    setTemplate((prev) => ({
      ...prev,
      grain: { ...prev.grain, ...updates },
    }));
  }, []);

  const handleResetToDefault = useCallback(() => {
    setTemplate(cloneTemplate(ACTOR_WATERCOLOR_TEMPLATE));
    setSelectedSplotch(0);
  }, []);

  const handleCopyConfig = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    } catch {
      console.error('Failed to copy config');
    }
  }, [config]);

  const handleSaveTarget = useCallback(async () => {
    if (!selectedTarget) return;
    try {
      const sourcePath = 'src/watercolor/sandboxTargets.ts';
      const nextTargets = targets.map((target) => (
        target.id === selectedTarget.id
          ? {
            ...target,
            baseColor,
            template: cloneTemplate(template),
            watercolorConfig: cloneWatercolorConfig(config),
          }
          : target
      ));
      const updated = [
        "import type { Card } from '../engine/types';",
        "import type { WatercolorConfig } from './types';",
        '',
        'export type WatercolorSandboxTarget = {',
        '  id: string;',
        '  label: string;',
        '  card: Card;',
        '  watercolorConfig: WatercolorConfig;',
        '};',
        '',
        '// WATERCOLOR_SANDBOX_TARGETS_START',
        serializeTargets(nextTargets),
        '// WATERCOLOR_SANDBOX_TARGETS_END',
        '',
      ].join('\n');
      await writeFileToDisk(sourcePath, updated);
      setTargets(nextTargets);
      setSaveStatus(`Saved watercolor for ${selectedTarget.label}.`);
    } catch {
      setSaveStatus('Save failed. Ensure the dev server write hook is available.');
    }
  }, [config, selectedTarget, targets]);

  const handleSaveOverride = useCallback(async () => {
    try {
      const sourcePath = 'src/watercolor/overrides.ts';
      if (sourceType === 'actor' && selectedActorId) {
        const nextOverrides = [
          ...ACTOR_WATERCOLOR_OVERRIDES.filter((entry) => entry.actorId !== selectedActorId),
          { actorId: selectedActorId, baseColor, template: cloneTemplate(template) },
        ];
        const updated = [
          "import type { ActorWatercolorTemplate } from './presets';",
          '',
          'export type ActorWatercolorOverride = {',
          '  actorId: string; // Actor definition id',
          '  baseColor: string;',
          '  template: ActorWatercolorTemplate;',
          '};',
          '',
          'export type OrimWatercolorOverride = {',
          '  orimId: string;',
          '  baseColor: string;',
          '  template: ActorWatercolorTemplate;',
          '};',
          '',
          '// ACTOR_WATERCOLOR_OVERRIDES_START',
          `export const ACTOR_WATERCOLOR_OVERRIDES: ActorWatercolorOverride[] = ${JSON.stringify(nextOverrides, null, 2)};`,
          '// ACTOR_WATERCOLOR_OVERRIDES_END',
          '',
          '// ORIM_WATERCOLOR_OVERRIDES_START',
          `export const ORIM_WATERCOLOR_OVERRIDES: OrimWatercolorOverride[] = ${JSON.stringify(ORIM_WATERCOLOR_OVERRIDES, null, 2)};`,
          '// ORIM_WATERCOLOR_OVERRIDES_END',
          '',
        ].join('\n');
        await writeFileToDisk(sourcePath, updated);
        setSaveStatus(`Saved actor override for ${selectedActorId}.`);
      } else if (sourceType === 'orim' && selectedOrimId) {
        const nextOverrides = [
          ...ORIM_WATERCOLOR_OVERRIDES.filter((entry) => entry.orimId !== selectedOrimId),
          { orimId: selectedOrimId, baseColor, template: cloneTemplate(template) },
        ];
        const updated = [
          "import type { ActorWatercolorTemplate } from './presets';",
          '',
          'export type ActorWatercolorOverride = {',
          '  actorId: string; // Actor definition id',
          '  baseColor: string;',
          '  template: ActorWatercolorTemplate;',
          '};',
          '',
          'export type OrimWatercolorOverride = {',
          '  orimId: string;',
          '  baseColor: string;',
          '  template: ActorWatercolorTemplate;',
          '};',
          '',
          '// ACTOR_WATERCOLOR_OVERRIDES_START',
          `export const ACTOR_WATERCOLOR_OVERRIDES: ActorWatercolorOverride[] = ${JSON.stringify(ACTOR_WATERCOLOR_OVERRIDES, null, 2)};`,
          '// ACTOR_WATERCOLOR_OVERRIDES_END',
          '',
          '// ORIM_WATERCOLOR_OVERRIDES_START',
          `export const ORIM_WATERCOLOR_OVERRIDES: OrimWatercolorOverride[] = ${JSON.stringify(nextOverrides, null, 2)};`,
          '// ORIM_WATERCOLOR_OVERRIDES_END',
          '',
        ].join('\n');
        await writeFileToDisk(sourcePath, updated);
        setSaveStatus(`Saved orim override for ${selectedOrimId}.`);
      }
    } catch {
      setSaveStatus('Save failed. Ensure the dev server write hook is available.');
    }
  }, [baseColor, selectedActorId, selectedOrimId, sourceType, template]);

  const currentSplotch = template.splotches[selectedSplotch] || null;
  const previewCard = sourceType === 'global' ? (selectedTarget?.card ?? fallbackCard) : fallbackCard;
  const selectedActor = useMemo(
    () => (sourceType === 'actor' && selectedActorId
      ? (actorDefinitions ?? []).find((actor) => actor.id === selectedActorId) ?? null
      : null),
    [actorDefinitions, selectedActorId, sourceType],
  );
  const actorGlyph = selectedActor ? getActorDisplayGlyph(selectedActor.id, showGraphics) : undefined;
  const selectedOrim = useMemo(
    () => (sourceType === 'orim' && selectedOrimId ? (orimDefinitions ?? []).find((orim) => orim.id === selectedOrimId) ?? null : null),
    [orimDefinitions, selectedOrimId, sourceType],
  );

  const content = (
    <WatercolorContext.Provider value={true}>
      <div className="relative bg-game-bg-dark border border-game-teal/40 rounded-lg p-4 w-full h-[80vh] max-h-[80vh] overflow-hidden text-game-white menu-text">
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {sourceType === 'global' ? (
            <button
              type="button"
              onClick={handleSaveTarget}
              className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-gold/60 px-3 py-1 rounded cursor-pointer text-game-gold"
              title="Save watercolor to global target"
            >
              Save Global
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveOverride}
              className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-gold/60 px-3 py-1 rounded cursor-pointer text-game-gold"
              title="Save watercolor override"
            >
              Save Override
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyConfig}
            className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded cursor-pointer text-game-teal"
            title="Copy config to clipboard"
          >
            Copy Config
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

        <div className="text-xs text-game-teal tracking-[4px] mb-3">WATERCOLOR SANDBOX</div>
        {saveStatus && (
          <div className="mb-3 text-[10px] font-mono text-game-teal/80">
            {saveStatus}
          </div>
        )}

        <div className="flex gap-4 h-[calc(80vh-80px)]">
          {/* Left: Controls */}
          <div className="flex-0 w-80 border border-game-teal/20 rounded p-3 overflow-y-auto bg-game-bg-dark/50">
          <div className="flex flex-col gap-4 text-xs">
            {/* Source Type */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-game-white/60 font-mono">Source</label>
              <div className="flex gap-2">
                {(['global', 'actor', 'orim'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSourceType(type)}
                    className={`flex-1 text-[10px] font-mono py-1 rounded border ${
                      sourceType === type
                        ? 'border-game-gold text-game-gold'
                        : 'border-game-teal/30 text-game-white/70'
                    }`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {sourceType !== 'global' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-game-white/60 font-mono">Search</label>
                <input
                  type="text"
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  placeholder={sourceType === 'actor' ? 'Search actors...' : 'Search orims...'}
                  className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1 text-game-white"
                />
                <div className="max-h-32 overflow-y-auto border border-game-teal/20 rounded bg-game-bg-dark/60">
                  {(sourceType === 'actor' ? filteredActors : filteredOrims).map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        if (sourceType === 'actor') {
                          setSelectedActorId(entry.id);
                        } else {
                          setSelectedOrimId(entry.id);
                        }
                      }}
                      className={`w-full text-left px-2 py-1 text-[10px] font-mono border-b border-game-teal/10 ${
                        (sourceType === 'actor' && selectedActorId === entry.id)
                        || (sourceType === 'orim' && selectedOrimId === entry.id)
                          ? 'text-game-gold'
                          : 'text-game-white/70'
                      }`}
                    >
                      {entry.name} ({entry.id})
                    </button>
                  ))}
                  {(sourceType === 'actor' ? filteredActors : filteredOrims).length === 0 && (
                    <div className="px-2 py-2 text-[10px] text-game-white/50">No matches</div>
                  )}
                </div>
              </div>
            )}

            {sourceType === 'global' && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-game-white/60 font-mono">Target</label>
                <select
                  value={selectedTargetId}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                >
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Color Picker */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-game-white/60 font-mono">Base Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={baseColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-10 h-8 rounded border border-game-teal/30 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={baseColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    placeholder="#2196f3"
                    className="flex-1 text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1 text-game-white"
                  />
                </div>
              </div>

              {/* Splotch Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-game-white/60 font-mono">Select Splotch</label>
                <div className="flex gap-1">
                  {SPLOTCH_DISPLAY_ORDER.map((slot) => {
                    const { label, index } = slot;
                    const isActive = selectedSplotch === index;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setSelectedSplotch(index)}
                        className={`flex-1 text-[10px] font-mono py-1 rounded border ${isActive ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Splotch Controls */}
              {currentSplotch && (
                <>
                  <div className="text-[10px] text-game-teal font-mono">
                    {SPLOTCH_LABELS[selectedSplotch] ?? `Splotch ${selectedSplotch + 1}`}
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Splotch Color</span>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={currentSplotch.baseColor ?? baseColor}
                        onChange={(e) => handleSplotchUpdate(selectedSplotch, { baseColor: e.target.value })}
                        className="w-10 h-8 rounded border border-game-teal/30 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={currentSplotch.baseColor ?? baseColor}
                        onChange={(e) => handleSplotchUpdate(selectedSplotch, { baseColor: e.target.value })}
                        placeholder={baseColor}
                        className="flex-1 text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1 text-game-white"
                      />
                    </div>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Scale: {currentSplotch.scale.toFixed(2)}</span>
                    <input
                      type="range"
                      min="0.2"
                      max={2}
                      step="0.02"
                      value={currentSplotch.scale}
                      onChange={(e) => handleSplotchUpdate(selectedSplotch, { scale: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">
                      Rect Thickness: {(1 - (currentSplotch.innerSize ?? 0.6)).toFixed(2)}
                    </span>
                    <input
                      type="range"
                      min="0.05"
                      max="0.6"
                      step="0.01"
                      value={1 - (currentSplotch.innerSize ?? 0.6)}
                      onChange={(e) => {
                        const thickness = parseFloat(e.target.value);
                        handleSplotchUpdate(selectedSplotch, { innerSize: 1 - thickness });
                      }}
                      className="w-full"
                      disabled={currentSplotch.shape !== 'hollow-rect'}
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Offset X: {currentSplotch.offset[0].toFixed(2)}</span>
                    <input
                      type="range"
                      min="-0.9"
                      max="0.9"
                      step="0.02"
                      value={currentSplotch.offset[0]}
                      onChange={(e) =>
                        handleSplotchUpdate(selectedSplotch, {
                          offset: [parseFloat(e.target.value), currentSplotch.offset[1]],
                        })
                      }
                      className="w-full"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Offset Y: {currentSplotch.offset[1].toFixed(2)}</span>
                    <input
                      type="range"
                      min="-0.9"
                      max="0.9"
                      step="0.02"
                      value={currentSplotch.offset[1]}
                      onChange={(e) =>
                        handleSplotchUpdate(selectedSplotch, {
                          offset: [currentSplotch.offset[0], parseFloat(e.target.value)],
                        })
                      }
                      className="w-full"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Opacity: {currentSplotch.opacity.toFixed(2)}</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={currentSplotch.opacity}
                      onChange={(e) => handleSplotchUpdate(selectedSplotch, { opacity: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Blend Mode</span>
                    <select
                      value={currentSplotch.blendMode}
                      onChange={(e) => handleSplotchUpdate(selectedSplotch, { blendMode: e.target.value })}
                      className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    >
                      {BLEND_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Shape</span>
                    <select
                      value={currentSplotch.shape}
                      onChange={(e) => handleSplotchUpdate(selectedSplotch, { shape: e.target.value as SplotchShape })}
                      className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    >
                      {SHAPES.map((shape) => (
                        <option key={shape} value={shape}>
                          {shape}
                        </option>
                      ))}
                    </select>
                  </label>

                  {currentSplotch.shape === 'hollow-rect' && (
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">
                          Inner Size: {(currentSplotch.innerSize ?? 0.6).toFixed(2)}
                        </span>
                        <input
                          type="range"
                          min="0.2"
                          max="0.9"
                          step="0.02"
                          value={currentSplotch.innerSize ?? 0.6}
                          onChange={(e) => handleSplotchUpdate(selectedSplotch, { innerSize: parseFloat(e.target.value) })}
                          className="w-full"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">
                          Inner Feather: {(currentSplotch.innerFeather ?? 0.12).toFixed(2)}
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="0.3"
                          step="0.01"
                          value={currentSplotch.innerFeather ?? 0.12}
                          onChange={(e) => handleSplotchUpdate(selectedSplotch, { innerFeather: parseFloat(e.target.value) })}
                          className="w-full"
                        />
                      </label>
                    </div>
                  )}
                </>
              )}

              {/* Grain Controls */}
              <div className="border-t border-game-teal/20 pt-3 mt-2" />
              <div className="text-[10px] text-game-teal font-mono">Grain</div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={template.grain.enabled}
                  onChange={(e) => handleGrainUpdate({ enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-[10px] text-game-white/60">Enabled</span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-game-white/60">Intensity: {template.grain.intensity.toFixed(3)}</span>
                <input
                  type="range"
                  min="0"
                  max="0.1"
                  step="0.005"
                  value={template.grain.intensity}
                  onChange={(e) => handleGrainUpdate({ intensity: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-game-white/60">Frequency: {template.grain.frequency.toFixed(3)}</span>
                <input
                  type="range"
                  min="0.01"
                  max="0.2"
                  step="0.005"
                  value={template.grain.frequency}
                  onChange={(e) => handleGrainUpdate({ frequency: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </label>

              {/* Animation Controls */}
              <div className="border-t border-game-teal/20 pt-3 mt-2" />
              <div className="text-[10px] text-game-teal font-mono">Animation</div>

              {currentSplotch && (
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">
                      Breathe Duration: {currentSplotch.animation.breatheDuration.toFixed(1)}s
                    </span>
                    <input
                      type="range"
                      min="5"
                      max="20"
                      step="0.5"
                      value={currentSplotch.animation.breatheDuration}
                      onChange={(e) =>
                        handleSplotchUpdate(selectedSplotch, {
                          animation: { ...currentSplotch.animation, breatheDuration: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">
                      Breathe Scale: {currentSplotch.animation.breatheScale.toFixed(3)}
                    </span>
                    <input
                      type="range"
                      min="1.0"
                      max="1.1"
                      step="0.005"
                      value={currentSplotch.animation.breatheScale}
                      onChange={(e) =>
                        handleSplotchUpdate(selectedSplotch, {
                          animation: { ...currentSplotch.animation, breatheScale: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">
                      Highlight Shift: {currentSplotch.animation.highlightShiftDuration.toFixed(1)}s
                    </span>
                    <input
                      type="range"
                      min="5"
                      max="15"
                      step="0.5"
                      value={currentSplotch.animation.highlightShiftDuration}
                      onChange={(e) =>
                        handleSplotchUpdate(selectedSplotch, {
                          animation: { ...currentSplotch.animation, highlightShiftDuration: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full"
                    />
                  </label>
                </div>
              )}

              {/* Reset Button */}
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded cursor-pointer text-game-teal mt-2"
              >
                Reset to Default
              </button>
            </div>
          </div>

          {/* Middle: Preview */}
          <div className="flex-1 border border-game-teal/20 rounded p-3 bg-game-bg-dark/50 flex flex-col items-center justify-center overflow-auto">
            <div
              style={{
                position: 'relative',
                width: CARD_SIZE.width,
                height: CARD_SIZE.height,
                flexShrink: 0,
              }}
            >
              {sourceType !== 'orim' && (
                <Card
                  card={previewCard}
                  size={CARD_SIZE}
                  isFoundation
                  showGraphics={showGraphics}
                  suitDisplayOverride={sourceType === 'actor' ? actorGlyph : undefined}
                  suitFontSizeOverride={sourceType === 'actor' ? Math.round(CARD_SIZE.height * 0.28) : undefined}
                />
              )}
              {sourceType !== 'orim' && (
                <div
                  className="absolute"
                  style={{
                    zIndex: 1,
                    width: CARD_SIZE.width * CARD_WATERCOLOR_CANVAS_SCALE,
                    height: CARD_SIZE.height * CARD_WATERCOLOR_CANVAS_SCALE,
                    left: (CARD_SIZE.width - CARD_SIZE.width * CARD_WATERCOLOR_CANVAS_SCALE) / 2,
                    top: (CARD_SIZE.height - CARD_SIZE.height * CARD_WATERCOLOR_CANVAS_SCALE) / 2,
                  }}
                >
                  <WatercolorOverlay
                    config={cardConfig}
                    style={{
                      borderRadius: 8,
                      zIndex: 1,
                      mixBlendMode: (currentSplotch?.blendMode as CSSProperties['mixBlendMode']) || 'normal',
                    }}
                  />
                </div>
              )}
              {sourceType === 'orim' && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{ zIndex: 2 }}
                >
                  {(() => {
                    const primaryElement = getOrimPrimaryElement(selectedOrim);
                    const color = primaryElement
                      ? SUIT_COLORS[ELEMENT_TO_SUIT[primaryElement]]
                      : '#7fdbca';
                    const size = Math.round(CARD_SIZE.width * 0.45);
                    const display = getOrimDisplay(selectedOrim, true);
                    return (
                      <div
                        className="relative flex items-center justify-center font-bold"
                        style={{
                          width: size,
                          height: size,
                          color,
                          fontSize: Math.max(12, Math.round(size * 0.6)),
                          lineHeight: 1,
                        }}
                      >
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            backgroundColor: 'rgba(10, 12, 14, 0.6)',
                            boxShadow: `0 0 16px ${color}55`,
                            zIndex: 0,
                          }}
                        />
                        <div
                          className="absolute"
                          style={{
                            zIndex: 1,
                            width: size * ORIM_WATERCOLOR_CANVAS_SCALE,
                            height: size * ORIM_WATERCOLOR_CANVAS_SCALE,
                            left: (size - size * ORIM_WATERCOLOR_CANVAS_SCALE) / 2,
                            top: (size - size * ORIM_WATERCOLOR_CANVAS_SCALE) / 2,
                          }}
                        >
                          <WatercolorOverlay
                            config={orimConfig}
                            style={{
                              zIndex: 1,
                              mixBlendMode: (currentSplotch?.blendMode as CSSProperties['mixBlendMode']) || 'normal',
                            }}
                          />
                        </div>
                        <span style={{ zIndex: 2, transform: 'translateY(-1px)' }}>{display}</span>
                        <div
                          className="absolute inset-0 rounded-full pointer-events-none"
                          style={{
                            borderWidth: GAME_BORDER_WIDTH,
                            borderStyle: 'solid',
                            borderColor: color,
                            zIndex: 3,
                          }}
                        />
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Right: Info/Stats */}
          <div className="flex-0 w-80 border border-game-teal/20 rounded p-3 overflow-y-auto bg-game-bg-dark/50">
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <div className="text-[10px] text-game-teal font-mono mb-2">Config Info</div>
                <div className="space-y-1 text-[10px] text-game-white/70 font-mono">
                  <div>Splotches: {config.splotches.length}</div>
                  <div>Grain: {config.grain.enabled ? 'ON' : 'OFF'}</div>
                  <div>Overall Scale: {config.overallScale.toFixed(2)}</div>
                </div>
              </div>

              {currentSplotch && (
                <div>
                  <div className="text-[10px] text-game-teal font-mono mb-2">Splotch {selectedSplotch + 1} Info</div>
                  <div className="space-y-1 text-[10px] text-game-white/70 font-mono">
                    <div>Scale: {currentSplotch.scale.toFixed(2)}</div>
                    <div>Opacity: {currentSplotch.opacity.toFixed(2)}</div>
                    <div>Offset: [{currentSplotch.offset[0].toFixed(2)}, {currentSplotch.offset[1].toFixed(2)}]</div>
                    <div>Blend: {currentSplotch.blendMode}</div>
                    <div>Shape: {currentSplotch.shape}</div>
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] text-game-teal font-mono mb-2">Tips</div>
                <ul className="space-y-1 text-[10px] text-game-white/60 list-disc list-inside">
                  <li>Use blend modes to control color mixing</li>
                  <li>Offset creates asymmetric effects</li>
                  <li>Lower opacity for subtle backgrounds</li>
                  <li>Click "Copy Config" to export settings</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WatercolorContext.Provider>
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
});
