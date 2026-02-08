import type { WatercolorConfig, SplotchConfig } from '../watercolor/types';
import { createDefaultSplotch, createDefaultWatercolorConfig } from '../watercolor/editorDefaults';

type MapEditorWatercolorPanelProps = {
  draft: WatercolorConfig | null;
  onDraftChange: (next: WatercolorConfig | null) => void;
  onSave: () => void;
  onClear: () => void;
};

export function MapEditorWatercolorPanel({
  draft,
  onDraftChange,
  onSave,
  onClear,
}: MapEditorWatercolorPanelProps) {
  const coerceNumber = (value: string, fallback: number) => {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  };

  const coerceInt = (value: string, fallback: number) => {
    const next = Number(value);
    return Number.isFinite(next) ? Math.max(0, Math.round(next)) : fallback;
  };

  const updateDraft = (updater: (prev: WatercolorConfig) => WatercolorConfig) => {
    if (!draft) return;
    onDraftChange(updater(draft));
  };

  const updateSplotch = (index: number, updater: (prev: SplotchConfig) => SplotchConfig) => {
    updateDraft((prev) => ({
      ...prev,
      splotches: prev.splotches.map((splotch, idx) => (idx === index ? updater(splotch) : splotch)),
    }));
  };

  return (
    <div className="border-t border-game-teal/20 pt-2 flex flex-col gap-2">
      <div className="text-[9px] tracking-[2px] opacity-70">WATERCOLOR</div>
      {!draft && (
        <button
          type="button"
          className="px-2 py-1 rounded border border-game-teal/50 text-game-teal bg-game-bg-dark/80 text-[10px]"
          onClick={() => onDraftChange(createDefaultWatercolorConfig())}
        >
          + add watercolor
        </button>
      )}
      {draft && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 rounded border border-game-teal/50 text-game-teal bg-game-bg-dark/80 text-[10px]"
              onClick={onSave}
            >
              save to disk
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded border border-game-pink/50 text-game-pink bg-game-bg-dark/80 text-[10px]"
              onClick={onClear}
            >
              clear
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded border border-game-teal/40 text-game-teal bg-game-bg-dark/80 text-[10px]"
              onClick={() => onDraftChange(createDefaultWatercolorConfig())}
            >
              reset
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <label className="text-[9px] opacity-70">
              Overall scale
              <input
                type="number"
                step="0.05"
                value={draft.overallScale}
                onChange={(e) => updateDraft((prev) => ({
                  ...prev,
                  overallScale: coerceNumber(e.target.value, prev.overallScale),
                }))}
                className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
              />
            </label>
          </div>
          <details className="rounded border border-game-teal/20 p-2">
            <summary className="cursor-pointer text-[9px] tracking-[2px] opacity-70">GRAIN</summary>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-[9px] opacity-70">
                <input
                  type="checkbox"
                  checked={draft.grain.enabled}
                  onChange={(e) => updateDraft((prev) => ({
                    ...prev,
                    grain: { ...prev.grain, enabled: e.target.checked },
                  }))}
                />
                enabled
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[9px] opacity-70">
                  Intensity
                  <input
                    type="number"
                    step="0.01"
                    value={draft.grain.intensity}
                    onChange={(e) => updateDraft((prev) => ({
                      ...prev,
                      grain: { ...prev.grain, intensity: coerceNumber(e.target.value, prev.grain.intensity) },
                    }))}
                    className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                  />
                </label>
                <label className="text-[9px] opacity-70">
                  Frequency
                  <input
                    type="number"
                    step="0.01"
                    value={draft.grain.frequency}
                    onChange={(e) => updateDraft((prev) => ({
                      ...prev,
                      grain: { ...prev.grain, frequency: coerceNumber(e.target.value, prev.grain.frequency) },
                    }))}
                    className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                  />
                </label>
              </div>
              <label className="text-[9px] opacity-70">
                Blend mode
                <input
                  type="text"
                  value={draft.grain.blendMode}
                  onChange={(e) => updateDraft((prev) => ({
                    ...prev,
                    grain: { ...prev.grain, blendMode: e.target.value },
                  }))}
                  className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                />
              </label>
            </div>
          </details>
          <details className="rounded border border-game-teal/20 p-2">
            <summary className="cursor-pointer text-[9px] tracking-[2px] opacity-70">
              SPLOTCHES ({draft.splotches.length})
            </summary>
            <div className="mt-2 flex flex-col gap-3">
              {draft.splotches.map((splotch, index) => (
                <div key={`wc-splotch-${index}`} className="flex flex-col gap-2 rounded border border-game-teal/20 p-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[9px] opacity-70">Splotch {index + 1}</div>
                    <button
                      type="button"
                      className="text-[9px] text-game-pink"
                      onClick={() => {
                        if (draft.splotches.length <= 1) return;
                        updateDraft((prev) => ({
                          ...prev,
                          splotches: prev.splotches.filter((_, idx) => idx !== index),
                        }));
                      }}
                    >
                      remove
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[9px] opacity-70">
                      Light
                      <input
                        type="color"
                        value={splotch.gradient.light}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          gradient: { ...prev.gradient, light: e.target.value },
                        }))}
                        className="mt-1 w-full h-6 bg-game-bg-dark/80 border border-game-teal/30 rounded"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Mid
                      <input
                        type="color"
                        value={splotch.gradient.mid}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          gradient: { ...prev.gradient, mid: e.target.value },
                        }))}
                        className="mt-1 w-full h-6 bg-game-bg-dark/80 border border-game-teal/30 rounded"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Dark
                      <input
                        type="color"
                        value={splotch.gradient.dark}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          gradient: { ...prev.gradient, dark: e.target.value },
                        }))}
                        className="mt-1 w-full h-6 bg-game-bg-dark/80 border border-game-teal/30 rounded"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[9px] opacity-70">
                      Light a
                      <input
                        type="number"
                        step="0.05"
                        value={splotch.gradient.lightOpacity}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          gradient: { ...prev.gradient, lightOpacity: coerceNumber(e.target.value, prev.gradient.lightOpacity) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Mid a
                      <input
                        type="number"
                        step="0.05"
                        value={splotch.gradient.midOpacity}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          gradient: { ...prev.gradient, midOpacity: coerceNumber(e.target.value, prev.gradient.midOpacity) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Dark a
                      <input
                        type="number"
                        step="0.05"
                        value={splotch.gradient.darkOpacity}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          gradient: { ...prev.gradient, darkOpacity: coerceNumber(e.target.value, prev.gradient.darkOpacity) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[9px] opacity-70">
                      Scale
                      <input
                        type="number"
                        step="0.05"
                        value={splotch.scale}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          scale: coerceNumber(e.target.value, prev.scale),
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Offset X
                      <input
                        type="number"
                        step="0.01"
                        value={splotch.offset[0]}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          offset: [coerceNumber(e.target.value, prev.offset[0]), prev.offset[1]],
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Offset Y
                      <input
                        type="number"
                        step="0.01"
                        value={splotch.offset[1]}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          offset: [prev.offset[0], coerceNumber(e.target.value, prev.offset[1])],
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[9px] opacity-70">
                      Opacity
                      <input
                        type="number"
                        step="0.05"
                        value={splotch.opacity}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          opacity: coerceNumber(e.target.value, prev.opacity),
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Blend mode
                      <input
                        type="text"
                        value={splotch.blendMode}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          blendMode: e.target.value,
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                  </div>
                  <div className="text-[9px] tracking-[2px] opacity-60">TENDRILS</div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[9px] opacity-70">
                      Count
                      <input
                        type="number"
                        step="1"
                        value={splotch.tendrils.count}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          tendrils: { ...prev.tendrils, count: coerceInt(e.target.value, prev.tendrils.count) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Length min
                      <input
                        type="number"
                        step="1"
                        value={splotch.tendrils.lengthMin}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          tendrils: { ...prev.tendrils, lengthMin: coerceNumber(e.target.value, prev.tendrils.lengthMin) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Length max
                      <input
                        type="number"
                        step="1"
                        value={splotch.tendrils.lengthMax}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          tendrils: { ...prev.tendrils, lengthMax: coerceNumber(e.target.value, prev.tendrils.lengthMax) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[9px] opacity-70">
                      Stroke width
                      <input
                        type="number"
                        step="1"
                        value={splotch.tendrils.strokeWidth}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          tendrils: { ...prev.tendrils, strokeWidth: coerceNumber(e.target.value, prev.tendrils.strokeWidth) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Sway dur
                      <input
                        type="number"
                        step="0.1"
                        value={splotch.tendrils.swayDuration}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          tendrils: { ...prev.tendrils, swayDuration: coerceNumber(e.target.value, prev.tendrils.swayDuration) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Sway angle
                      <input
                        type="number"
                        step="0.1"
                        value={splotch.tendrils.swayAngle}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          tendrils: { ...prev.tendrils, swayAngle: coerceNumber(e.target.value, prev.tendrils.swayAngle) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                  </div>
                  <div className="text-[9px] tracking-[2px] opacity-60">SATELLITES</div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[9px] opacity-70">
                      Count
                      <input
                        type="number"
                        step="1"
                        value={splotch.satellites.count}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          satellites: { ...prev.satellites, count: coerceInt(e.target.value, prev.satellites.count) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Radius min
                      <input
                        type="number"
                        step="1"
                        value={splotch.satellites.radiusMin}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          satellites: { ...prev.satellites, radiusMin: coerceNumber(e.target.value, prev.satellites.radiusMin) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Radius max
                      <input
                        type="number"
                        step="1"
                        value={splotch.satellites.radiusMax}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          satellites: { ...prev.satellites, radiusMax: coerceNumber(e.target.value, prev.satellites.radiusMax) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[9px] opacity-70">
                      Orbit radius
                      <input
                        type="number"
                        step="1"
                        value={splotch.satellites.orbitRadius}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          satellites: { ...prev.satellites, orbitRadius: coerceNumber(e.target.value, prev.satellites.orbitRadius) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Drift dur
                      <input
                        type="number"
                        step="0.1"
                        value={splotch.satellites.driftDuration}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          satellites: { ...prev.satellites, driftDuration: coerceNumber(e.target.value, prev.satellites.driftDuration) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                  </div>
                  <div className="text-[9px] tracking-[2px] opacity-60">ANIMATION</div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[9px] opacity-70">
                      Breathe dur
                      <input
                        type="number"
                        step="0.1"
                        value={splotch.animation.breatheDuration}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          animation: { ...prev.animation, breatheDuration: coerceNumber(e.target.value, prev.animation.breatheDuration) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Breathe scale
                      <input
                        type="number"
                        step="0.01"
                        value={splotch.animation.breatheScale}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          animation: { ...prev.animation, breatheScale: coerceNumber(e.target.value, prev.animation.breatheScale) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                    <label className="text-[9px] opacity-70">
                      Highlight dur
                      <input
                        type="number"
                        step="0.1"
                        value={splotch.animation.highlightShiftDuration}
                        onChange={(e) => updateSplotch(index, (prev) => ({
                          ...prev,
                          animation: { ...prev.animation, highlightShiftDuration: coerceNumber(e.target.value, prev.animation.highlightShiftDuration) },
                        }))}
                        className="mt-1 w-full bg-game-bg-dark/80 border border-game-teal/30 rounded px-1 py-0.5 text-[10px] text-game-teal"
                      />
                    </label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="px-2 py-1 rounded border border-game-teal/50 text-game-teal bg-game-bg-dark/80 text-[10px]"
                onClick={() => updateDraft((prev) => ({
                  ...prev,
                  splotches: [...prev.splotches, createDefaultSplotch()],
                }))}
              >
                + add splotch
              </button>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
