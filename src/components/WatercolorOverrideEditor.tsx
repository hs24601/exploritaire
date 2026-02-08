import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ActorDefinition, OrimDefinition } from '../engine/types';
import { WatercolorOverlay } from '../watercolor/WatercolorOverlay';
import { ACTOR_WATERCOLOR_OVERRIDES, ORIM_WATERCOLOR_OVERRIDES } from '../watercolor/overrides';
import { ORIM_WATERCOLOR_CANVAS_SCALE, ORIM_WATERCOLOR_OVERALL_SCALE_MULTIPLIER } from '../watercolor/orimWatercolor';
import { ACTOR_WATERCOLOR_TEMPLATES, ORIM_WATERCOLOR_TEMPLATES } from '../watercolor/templates';
import {
  ACTOR_WATERCOLOR_TEMPLATE,
  buildActorWatercolorConfig,
  type ActorWatercolorTemplate,
} from '../watercolor/presets';
import type { SplotchShape } from '../watercolor/types';

const SPLOTCH_LABELS = ['Accent', 'Top', 'Mid', 'Base', 'Aura'] as const;
const SPLOTCH_DISPLAY_ORDER = [
  { label: 'Aura', index: 4 },
  { label: 'Base', index: 3 },
  { label: 'Mid', index: 2 },
  { label: 'Top', index: 1 },
  { label: 'Accent', index: 0 },
] as const;
const BLEND_MODES = ['screen', 'multiply', 'overlay', 'normal', 'soft-light', 'hard-light'] as const;
const CARD_WATERCOLOR_CANVAS_SCALE = 1.35;
const CARD_WATERCOLOR_OVERALL_SCALE_MULTIPLIER = 1 / CARD_WATERCOLOR_CANVAS_SCALE;
const SHAPES: SplotchShape[] = ['circle', 'rectangle', 'hollow-rect'];

const cloneTemplate = (template: ActorWatercolorTemplate) => (
  JSON.parse(JSON.stringify(template)) as ActorWatercolorTemplate
);

const forceCircleTemplate = (template: ActorWatercolorTemplate): ActorWatercolorTemplate => ({
  ...template,
  splotches: template.splotches.map((splotch) => ({ ...splotch, shape: 'circle' })),
});

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

export function WatercolorOverrideEditor({
  mode,
  actorDefinition,
  orimDefinition,
  showGraphics,
  forceCircle = false,
}: {
  mode: 'actor' | 'orim';
  actorDefinition?: ActorDefinition | null;
  orimDefinition?: OrimDefinition | null;
  showGraphics: boolean;
  forceCircle?: boolean;
}) {
  const [baseColor, setBaseColor] = useState('#3a3f41');
  const [template, setTemplate] = useState<ActorWatercolorTemplate>(() => cloneTemplate(ACTOR_WATERCOLOR_TEMPLATE));
  const [selectedSplotch, setSelectedSplotch] = useState(0);
  const [editorTab, setEditorTab] = useState<'basic' | 'advanced'>('basic');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showAuraLayer, setShowAuraLayer] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [hueShift, setHueShift] = useState(0);

  const targetId = mode === 'actor' ? actorDefinition?.id ?? null : orimDefinition?.id ?? null;
  const targetLabel = mode === 'actor'
    ? (actorDefinition?.name ?? 'Actor')
    : (orimDefinition?.name ?? 'Orim');

  const availableTemplates = mode === 'actor' ? ACTOR_WATERCOLOR_TEMPLATES : ORIM_WATERCOLOR_TEMPLATES;

  const hexToHsl = (hex: string) => {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return { h: 0, s: 0, l: 0 };
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (delta !== 0) {
      s = delta / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case r:
          h = ((g - b) / delta) % 6;
          break;
        case g:
          h = (b - r) / delta + 2;
          break;
        default:
          h = (r - g) / delta + 4;
          break;
      }
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s, l };
  };

  const hslToHex = (h: number, s: number, l: number) => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;
    if (h < 60) {
      r1 = c; g1 = x; b1 = 0;
    } else if (h < 120) {
      r1 = x; g1 = c; b1 = 0;
    } else if (h < 180) {
      r1 = 0; g1 = c; b1 = x;
    } else if (h < 240) {
      r1 = 0; g1 = x; b1 = c;
    } else if (h < 300) {
      r1 = x; g1 = 0; b1 = c;
    } else {
      r1 = c; g1 = 0; b1 = x;
    }
    const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
  };

  const shiftHue = (hex: string, shift: number) => {
    const { h, s, l } = hexToHsl(hex);
    const nextHue = (h + shift + 360) % 360;
    return hslToHex(nextHue, s, l);
  };
  const normalizeFiveSplotches = useCallback((nextTemplate?: ActorWatercolorTemplate | null) => {
    if (!nextTemplate || !Array.isArray(nextTemplate.splotches)) {
      return cloneTemplate(ACTOR_WATERCOLOR_TEMPLATE);
    }
    const next = cloneTemplate(nextTemplate);
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
  }, []);

  useEffect(() => {
    if (!targetId) return;
    const override = mode === 'actor'
      ? ACTOR_WATERCOLOR_OVERRIDES.find((entry) => entry.actorId === targetId)
      : ORIM_WATERCOLOR_OVERRIDES.find((entry) => entry.orimId === targetId);
    const base = override?.baseColor ?? '#3a3f41';
    const nextTemplate = override?.template
      ? cloneTemplate(override.template)
      : cloneTemplate(ACTOR_WATERCOLOR_TEMPLATE);
    let normalizedTemplate = forceCircle ? forceCircleTemplate(nextTemplate) : nextTemplate;
    if (!override) {
      normalizedTemplate = {
        ...normalizedTemplate,
        splotches: normalizedTemplate.splotches.map((splotch) => ({
          ...splotch,
          opacity: 0,
          baseColor: undefined,
        })),
      };
    }
    normalizedTemplate = normalizeFiveSplotches(normalizedTemplate);
    setBaseColor(base);
    setTemplate(normalizedTemplate);
    setSelectedSplotch(0);
    setSaveStatus(null);
  }, [forceCircle, mode, normalizeFiveSplotches, targetId]);

  const config = useMemo(
    () => buildActorWatercolorConfig(baseColor, template),
    [baseColor, template],
  );
  const previewConfig = useMemo(() => {
    if (showAuraLayer) return config;
    return {
      ...config,
      splotches: config.splotches.filter((_, index) => index !== 4),
    };
  }, [config, showAuraLayer]);

  const currentSplotch = template.splotches[selectedSplotch] ?? null;

  const ensureSplotchCount = useCallback((count: number) => {
    setTemplate((prev) => {
      if (prev.splotches.length >= count) return prev;
      const next = { ...prev };
      const last = prev.splotches[prev.splotches.length - 1]
        ?? ACTOR_WATERCOLOR_TEMPLATE.splotches[0];
      const newSplotches = [...prev.splotches];
      while (newSplotches.length < count) {
        newSplotches.push({
          ...last,
          opacity: 0,
          baseColor: undefined,
        });
      }
      next.splotches = newSplotches;
      return next;
    });
  }, []);

  const handleSplotchUpdate = useCallback((
    index: number,
    updates: Partial<ActorWatercolorTemplate['splotches'][number]>,
  ) => {
    setTemplate((prev) => ({
      ...prev,
      splotches: prev.splotches.map((s, i) => {
        if (i !== index) return s;
        const next = { ...s, ...updates };
        if (forceCircle) {
          next.shape = 'circle';
        }
        return next;
      }),
    }));
  }, [forceCircle]);

  const handleGrainUpdate = useCallback((updates: Partial<ActorWatercolorTemplate['grain']>) => {
    setTemplate((prev) => ({ ...prev, grain: { ...prev.grain, ...updates } }));
  }, []);

  const handleSaveOverride = useCallback(async () => {
    if (!targetId) return;
    try {
      const sourcePath = 'src/watercolor/overrides.ts';
      if (mode === 'actor') {
        const nextOverrides = [
          ...ACTOR_WATERCOLOR_OVERRIDES.filter((entry) => entry.actorId !== targetId),
          { actorId: targetId, baseColor, template: cloneTemplate(template) },
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
        setSaveStatus(`Saved watercolor for ${targetLabel}.`);
      } else {
        const nextOverrides = [
          ...ORIM_WATERCOLOR_OVERRIDES.filter((entry) => entry.orimId !== targetId),
          { orimId: targetId, baseColor, template: cloneTemplate(template) },
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
        setSaveStatus(`Saved watercolor for ${targetLabel}.`);
      }
    } catch {
      setSaveStatus('Save failed. Ensure the dev server write hook is available.');
    }
  }, [baseColor, mode, targetId, targetLabel, template]);

  const handleSaveTemplate = useCallback(async () => {
    if (!targetId) return;
    try {
      const sourcePath = 'src/watercolor/templates.ts';
      if (mode === 'actor') {
        const nextTemplates = [
          ...ACTOR_WATERCOLOR_TEMPLATES.filter((entry) => entry.id !== targetId),
          { id: targetId, label: targetLabel, baseColor, template: cloneTemplate(template) },
        ];
        const updated = [
          "import type { ActorWatercolorTemplate } from './presets';",
          '',
          'export type WatercolorTemplateEntry = {',
          '  id: string;',
          '  label: string;',
          '  baseColor: string;',
          '  template: ActorWatercolorTemplate;',
          '};',
          '',
          '// ACTOR_WATERCOLOR_TEMPLATES_START',
          `export const ACTOR_WATERCOLOR_TEMPLATES: WatercolorTemplateEntry[] = ${JSON.stringify(nextTemplates, null, 2)};`,
          '// ACTOR_WATERCOLOR_TEMPLATES_END',
          '',
          '// ORIM_WATERCOLOR_TEMPLATES_START',
          `export const ORIM_WATERCOLOR_TEMPLATES: WatercolorTemplateEntry[] = ${JSON.stringify(ORIM_WATERCOLOR_TEMPLATES, null, 2)};`,
          '// ORIM_WATERCOLOR_TEMPLATES_END',
          '',
        ].join('\n');
        await writeFileToDisk(sourcePath, updated);
        setSaveStatus(`Saved template for ${targetLabel}.`);
      } else {
        const nextTemplates = [
          ...ORIM_WATERCOLOR_TEMPLATES.filter((entry) => entry.id !== targetId),
          { id: targetId, label: targetLabel, baseColor, template: cloneTemplate(template) },
        ];
        const updated = [
          "import type { ActorWatercolorTemplate } from './presets';",
          '',
          'export type WatercolorTemplateEntry = {',
          '  id: string;',
          '  label: string;',
          '  baseColor: string;',
          '  template: ActorWatercolorTemplate;',
          '};',
          '',
          '// ACTOR_WATERCOLOR_TEMPLATES_START',
          `export const ACTOR_WATERCOLOR_TEMPLATES: WatercolorTemplateEntry[] = ${JSON.stringify(ACTOR_WATERCOLOR_TEMPLATES, null, 2)};`,
          '// ACTOR_WATERCOLOR_TEMPLATES_END',
          '',
          '// ORIM_WATERCOLOR_TEMPLATES_START',
          `export const ORIM_WATERCOLOR_TEMPLATES: WatercolorTemplateEntry[] = ${JSON.stringify(nextTemplates, null, 2)};`,
          '// ORIM_WATERCOLOR_TEMPLATES_END',
          '',
        ].join('\n');
        await writeFileToDisk(sourcePath, updated);
        setSaveStatus(`Saved template for ${targetLabel}.`);
      }
    } catch {
      setSaveStatus('Template save failed. Ensure the dev server write hook is available.');
    }
  }, [baseColor, mode, targetId, targetLabel, template]);

  const handleLoadTemplate = useCallback(() => {
    const selected = availableTemplates.find((entry) => entry.id === selectedTemplateId);
    const next = normalizeFiveSplotches(selected?.template ?? ACTOR_WATERCOLOR_TEMPLATE);
    setTemplate(forceCircle ? forceCircleTemplate(next) : next);
    if (selected?.baseColor) {
      setBaseColor(selected.baseColor);
    }
    setSelectedSplotch(0);
  }, [availableTemplates, forceCircle, normalizeFiveSplotches, selectedTemplateId]);

  const handleThemeColorChange = useCallback((nextColor: string) => {
    const theme = hexToHsl(nextColor);
    setBaseColor(nextColor);
    setTemplate((prev) => ({
      ...prev,
      splotches: prev.splotches.map((splotch) => ({
        ...splotch,
        baseColor: splotch.baseColor
          ? hslToHex(theme.h, theme.s, hexToHsl(splotch.baseColor).l)
          : splotch.baseColor,
      })),
    }));
  }, []);

  const handleHueShiftChange = useCallback((nextShift: number) => {
    setHueShift(nextShift);
    setBaseColor((prev) => shiftHue(prev, nextShift));
    setTemplate((prev) => ({
      ...prev,
      splotches: prev.splotches.map((splotch) => ({
        ...splotch,
        baseColor: splotch.baseColor ? shiftHue(splotch.baseColor, nextShift) : splotch.baseColor,
      })),
    }));
  }, []);

  const renderPreview = () => {
    if (mode === 'actor') {
      const glyph = showGraphics ? actorDefinition?.sprite ?? '✨' : actorDefinition?.name?.[0] ?? '?';
      const actorPreviewConfig: typeof config = {
        ...previewConfig,
        overallScale: previewConfig.overallScale * CARD_WATERCOLOR_OVERALL_SCALE_MULTIPLIER,
      };
      return (
        <div className="relative w-[200px] h-[260px] flex items-center justify-center">
          <div className="relative w-[150px] h-[210px] rounded-xl border border-game-teal/50 bg-game-bg-dark/80 overflow-visible">
            <div
              className="absolute inset-0"
              style={{
                transform: `scale(${CARD_WATERCOLOR_CANVAS_SCALE})`,
                transformOrigin: 'center',
                pointerEvents: 'none',
              }}
            >
              <WatercolorOverlay
                config={actorPreviewConfig}
                style={{ borderRadius: 12 }}
              />
            </div>
            <div className="absolute inset-0 z-[2] flex items-center justify-center text-4xl text-game-teal">
              {glyph}
            </div>
          </div>
        </div>
      );
    }
    const glyph = showGraphics
      ? (orimDefinition?.category === 'ability' ? '⚡️' : orimDefinition?.category === 'utility' ? '💫' : '🧬')
      : (orimDefinition?.name?.[0] ?? '?');
    const orimPreviewConfig: typeof config = {
      ...previewConfig,
      overallScale: previewConfig.overallScale * ORIM_WATERCOLOR_OVERALL_SCALE_MULTIPLIER,
    };
    return (
      <div className="relative w-[140px] h-[140px] flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-[88px] h-[88px] rounded-full border border-game-teal/60 bg-black/60 overflow-visible">
            <div
              className="absolute inset-0"
              style={{
                transform: `scale(${ORIM_WATERCOLOR_CANVAS_SCALE})`,
                transformOrigin: 'center',
              }}
            >
              <WatercolorOverlay
                config={orimPreviewConfig}
                style={{ borderRadius: 999 }}
              />
            </div>
            <div className="relative z-[2] w-full h-full flex items-center justify-center text-2xl text-game-teal">
              {glyph}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 text-xs font-mono">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-game-white/60">Watercolor</div>
        <div className="flex items-center gap-2">
          {availableTemplates.length > 0 && (
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1 text-game-white"
            >
              <option value="">Select template...</option>
              {availableTemplates.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleLoadTemplate}
            className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
          >
            Load Template
          </button>
          <button
            type="button"
            onClick={handleSaveTemplate}
            className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
          >
            Save Template
          </button>
          <button
            type="button"
            onClick={handleSaveOverride}
            className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-gold/60 px-2 py-1 rounded cursor-pointer text-game-gold"
          >
            Save
          </button>
        </div>
      </div>

      {saveStatus && <div className="text-[10px] text-game-white/50">{saveStatus}</div>}

      <div className="flex gap-4">
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-game-white/60">Base Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={baseColor}
                onChange={(e) => setBaseColor(e.target.value)}
                className="w-10 h-8 rounded border border-game-teal/30 cursor-pointer"
              />
              <input
                type="text"
                value={baseColor}
                onChange={(e) => setBaseColor(e.target.value)}
                className="flex-1 text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1 text-game-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditorTab('basic')}
              className={`text-[10px] font-mono px-2 py-1 rounded border ${editorTab === 'basic' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
            >
              Basic
            </button>
            <button
              type="button"
              onClick={() => setEditorTab('advanced')}
              className={`text-[10px] font-mono px-2 py-1 rounded border ${editorTab === 'advanced' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
            >
              Advanced
            </button>
          </div>

          {editorTab === 'basic' && (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-game-white/60">Theme Color (hue shift)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={baseColor}
                    onChange={(e) => handleThemeColorChange(e.target.value)}
                    className="w-10 h-8 rounded border border-game-teal/30 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={baseColor}
                    onChange={(e) => handleThemeColorChange(e.target.value)}
                    className="flex-1 text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1 text-game-white"
                  />
                </div>
                <div className="text-[10px] text-game-white/40">
                  Applies hue + saturation while preserving per-splotch lightness.
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-game-white/60">Hue Shift (degrees)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={hueShift}
                    onChange={(e) => handleHueShiftChange(parseInt(e.target.value, 10))}
                    className="flex-1"
                  />
                  <span className="text-[10px] text-game-white/70 w-8 text-right">
                    {hueShift}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-game-white/60">Select Splotch</label>
                <div className="flex flex-wrap gap-1">
                  {SPLOTCH_DISPLAY_ORDER.map((slot) => {
                    const { label, index } = slot;
                    const isActive = selectedSplotch === index;
                    const exists = index < template.splotches.length;
                    return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        if (!exists) {
                          ensureSplotchCount(index + 1);
                        }
                        setSelectedSplotch(index);
                      }}
                      className={`text-[10px] font-mono px-2 py-1 rounded border ${isActive ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}${!exists ? ' opacity-60' : ''}`}
                    >
                      {label}
                    </button>
                  );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-[10px] text-game-white/70">
                <input
                  type="checkbox"
                  checked={showAuraLayer}
                  onChange={(e) => setShowAuraLayer(e.target.checked)}
                />
                Show Aura Layer (preview only)
              </label>

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
                        className="flex-1 text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1 text-game-white"
                      />
                    </div>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">
                      Scale: {currentSplotch.scale.toFixed(2)}
                    </span>
                    <input
                      type="range"
                      min="0.2"
                      max="2"
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
                    <span className="text-[10px] text-game-white/60">
                      Offset X: {currentSplotch.offset[0].toFixed(2)}
                    </span>
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
                    <span className="text-[10px] text-game-white/60">
                      Offset Y: {currentSplotch.offset[1].toFixed(2)}
                    </span>
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
                    <span className="text-[10px] text-game-white/60">
                      Opacity: {currentSplotch.opacity.toFixed(2)}
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.02"
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

                  {!forceCircle && (
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
                  )}

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
            </>
          )}

          {editorTab === 'advanced' && (
            <>
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
            </>
          )}
        </div>

        <div className="w-[180px] flex items-start justify-center">
          {renderPreview()}
        </div>
      </div>
    </div>
  );
}
