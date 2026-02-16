/**
 * God Rays Editor - Visual parameter tuning for screen-space crepuscular rays
 * Allows adjusting all ray parameters and saving/loading presets
 */

import { memo, useState, useMemo, useCallback } from 'react';
import { useSetGodRayState } from '../watercolor-engine';

interface GodRayPreset {
  id: string;
  name: string;
  lightPos: [number, number];
  exposure: number;
  decay: number;
  weight: number;
  density: number;
  rayColor: [number, number, number];
  noiseAmount: number;
}

interface GodRaysEditorProps {
  embedded: boolean;
  onClose: () => void;
  onSliderDragChange?: (isDragging: boolean) => void;
  activeSliderId?: string | null;
  onActiveSliderChange?: (id: string | null) => void;
}

// Default presets based on biome definitions
const DEFAULT_PRESETS: GodRayPreset[] = [
  {
    id: 'forest',
    name: 'Forest',
    lightPos: [0.5, 0.15],
    exposure: 0.10,
    decay: 0.97,
    weight: 0.04,
    density: 0.95,
    rayColor: [0.78, 0.95, 0.55],
    noiseAmount: 0.03,
  },
  {
    id: 'mountain',
    name: 'Mountain',
    lightPos: [0.5, 0.15],
    exposure: 0.08,
    decay: 0.97,
    weight: 0.04,
    density: 0.95,
    rayColor: [0.75, 0.88, 1.0],
    noiseAmount: 0.03,
  },
  {
    id: 'desert',
    name: 'Desert',
    lightPos: [0.5, 0.15],
    exposure: 0.18,
    decay: 0.97,
    weight: 0.04,
    density: 0.95,
    rayColor: [1.0, 0.88, 0.45],
    noiseAmount: 0.03,
  },
  {
    id: 'plains',
    name: 'Plains',
    lightPos: [0.5, 0.15],
    exposure: 0.09,
    decay: 0.97,
    weight: 0.04,
    density: 0.95,
    rayColor: [0.88, 0.98, 0.65],
    noiseAmount: 0.03,
  },
];

const STORAGE_KEY = 'exploritaire_godray_presets';

function loadPresetsFromStorage(): GodRayPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_PRESETS;
  } catch {
    return DEFAULT_PRESETS;
  }
}

function savePresetsToStorage(presets: GodRayPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.warn('Failed to save god ray presets:', e);
  }
}

export const GodRaysEditor = memo(function GodRaysEditor({
  embedded,
  onClose,
  onSliderDragChange,
  activeSliderId,
  onActiveSliderChange,
}: GodRaysEditorProps) {
  const setGodRayState = useSetGodRayState();
  const [presets, setPresets] = useState<GodRayPreset[]>(() => loadPresetsFromStorage());
  const [selectedPresetId, setSelectedPresetId] = useState<string>('forest');
  const [newPresetName, setNewPresetName] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');

  const selectedPreset = useMemo(
    () => presets.find(p => p.id === selectedPresetId) || presets[0],
    [presets, selectedPresetId]
  );

  // Helper to call both drag state changes
  const notifyDragChange = useCallback((isDragging: boolean, sliderId: string | null) => {
    onSliderDragChange?.(isDragging);
    onActiveSliderChange?.(sliderId);
  }, [onSliderDragChange, onActiveSliderChange]);

  const handlePresetChange = useCallback((updates: Partial<GodRayPreset>) => {
    setPresets(prev => prev.map(p =>
      p.id === selectedPresetId ? { ...p, ...updates } : p
    ));
    savePresetsToStorage(presets);

    // Also apply immediately to shader for real-time feedback
    const updatedPreset = { ...selectedPreset, ...updates };
    setGodRayState({
      lightPos: updatedPreset.lightPos,
      exposure: updatedPreset.exposure,
      decay: updatedPreset.decay,
      weight: updatedPreset.weight,
      density: updatedPreset.density,
      rayColor: updatedPreset.rayColor,
      noiseAmount: updatedPreset.noiseAmount,
    });
  }, [selectedPresetId, presets, selectedPreset, setGodRayState]);

  const handleSaveNewPreset = useCallback(() => {
    if (!newPresetName.trim()) return;

    const id = `custom_${Date.now()}`;
    const newPreset: GodRayPreset = {
      ...selectedPreset,
      id,
      name: newPresetName,
    };

    const updated = [...presets, newPreset];
    setPresets(updated);
    savePresetsToStorage(updated);
    setNewPresetName('');
    setSelectedPresetId(id);
  }, [newPresetName, selectedPreset, presets]);

  const handleRenamePreset = useCallback((presetId: string) => {
    if (!editingNameValue.trim()) {
      setEditingName(null);
      return;
    }

    setPresets(prev => prev.map(p =>
      p.id === presetId ? { ...p, name: editingNameValue } : p
    ));
    savePresetsToStorage(presets);
    setEditingName(null);
    setEditingNameValue('');
  }, [editingNameValue, presets]);

  const handleDeletePreset = useCallback((presetId: string) => {
    const updated = presets.filter(p => p.id !== presetId);
    setPresets(updated);
    savePresetsToStorage(updated);

    if (selectedPresetId === presetId) {
      setSelectedPresetId(updated[0]?.id || 'forest');
    }
  }, [presets, selectedPresetId]);

  const handleResetToDefaults = useCallback(() => {
    setPresets(DEFAULT_PRESETS);
    savePresetsToStorage(DEFAULT_PRESETS);
    setSelectedPresetId('forest');
  }, []);

  const handleLoadPreset = useCallback(() => {
    // Apply the selected preset to the actual god ray filter
    setGodRayState({
      lightPos: selectedPreset.lightPos,
      exposure: selectedPreset.exposure,
      decay: selectedPreset.decay,
      weight: selectedPreset.weight,
      density: selectedPreset.density,
      rayColor: selectedPreset.rayColor,
      noiseAmount: selectedPreset.noiseAmount,
    });
  }, [selectedPreset, setGodRayState]);

  // Render color preview
  const colorPreview = selectedPreset.rayColor;
  const colorHex = `rgb(${Math.round(colorPreview[0] * 255)}, ${Math.round(colorPreview[1] * 255)}, ${Math.round(colorPreview[2] * 255)})`;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 p-4 gap-4 overflow-y-auto">
      <h1 className="text-xl font-bold">God Rays Editor</h1>

      {/* Preset Selection */}
      <div className="border border-gray-700 rounded p-3 bg-gray-800">
        <h2 className="text-sm font-bold mb-2 text-yellow-400">PRESETS</h2>

        <div className="flex gap-2 flex-wrap mb-3">
          {presets.map(preset => (
            <button
              key={preset.id}
              onClick={() => setSelectedPresetId(preset.id)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                selectedPresetId === preset.id
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {editingName === preset.id ? (
                <input
                  autoFocus
                  type="text"
                  value={editingNameValue}
                  onChange={e => setEditingNameValue(e.target.value)}
                  onBlur={() => handleRenamePreset(preset.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenamePreset(preset.id);
                    if (e.key === 'Escape') setEditingName(null);
                  }}
                  className="bg-gray-600 text-white px-1 py-0 w-24 text-xs"
                />
              ) : (
                preset.name
              )}
            </button>
          ))}
        </div>

        {/* Preset Actions */}
        <div className="flex gap-2 text-xs mb-2">
          <button
            onClick={handleLoadPreset}
            className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded font-bold"
          >
            Load
          </button>
          <button
            onClick={() => {
              setEditingName(selectedPreset.id);
              setEditingNameValue(selectedPreset.name);
            }}
            className="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded"
          >
            Rename
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${selectedPreset.name}"?`)) {
                handleDeletePreset(selectedPreset.id);
              }
            }}
            disabled={presets.length <= 1}
            className="px-2 py-1 bg-red-700 hover:bg-red-600 disabled:bg-gray-600 rounded"
          >
            Delete
          </button>
        </div>

        {/* Save as New Preset */}
        <div className="flex gap-2 text-xs">
          <input
            type="text"
            placeholder="New preset name..."
            value={newPresetName}
            onChange={e => setNewPresetName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSaveNewPreset();
            }}
            className="flex-1 bg-gray-700 text-white px-2 py-1 rounded text-xs"
          />
          <button
            onClick={handleSaveNewPreset}
            disabled={!newPresetName.trim()}
            className="px-2 py-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 rounded"
          >
            Save
          </button>
          <button
            onClick={handleResetToDefaults}
            className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded"
            title="Reset all presets to defaults"
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Parameters */}
      <div className="border border-gray-700 rounded p-3 bg-gray-800 space-y-3">
        <h2 className="text-sm font-bold text-yellow-400">PARAMETERS</h2>

        {/* Light Position */}
        {(activeSliderId === 'light-pos-x' || !activeSliderId) && (
          <div>
            <label className="text-xs font-bold text-gray-300">
              Light Position X: {selectedPreset.lightPos[0].toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={selectedPreset.lightPos[0]}
              onChange={e => handlePresetChange({
                lightPos: [parseFloat(e.target.value), selectedPreset.lightPos[1]],
              })}
              onMouseDown={() => notifyDragChange(true, 'light-pos-x')}
              onMouseUp={() => notifyDragChange(false, null)}
              onTouchStart={() => notifyDragChange(true, 'light-pos-x')}
              onTouchEnd={() => notifyDragChange(false, null)}
              className="w-full"
            />
          </div>
        )}

        {(activeSliderId === 'light-pos-y' || !activeSliderId) && (
          <div>
            <label className="text-xs font-bold text-gray-300">
              Light Position Y: {selectedPreset.lightPos[1].toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={selectedPreset.lightPos[1]}
              onChange={e => handlePresetChange({
                lightPos: [selectedPreset.lightPos[0], parseFloat(e.target.value)],
              })}
              onMouseDown={() => notifyDragChange(true, 'light-pos-y')}
              onMouseUp={() => notifyDragChange(false, null)}
              onTouchStart={() => notifyDragChange(true, 'light-pos-y')}
              onTouchEnd={() => notifyDragChange(false, null)}
              className="w-full"
            />
          </div>
        )}

        {/* Exposure */}
        {(activeSliderId === 'exposure' || !activeSliderId) && (
          <div>
            <label className="text-xs font-bold text-gray-300">
              Exposure (Intensity): {selectedPreset.exposure.toFixed(3)}
            </label>
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.01"
              value={selectedPreset.exposure}
              onChange={e => handlePresetChange({ exposure: parseFloat(e.target.value) })}
              onMouseDown={() => notifyDragChange(true, 'exposure')}
              onMouseUp={() => notifyDragChange(false, null)}
              onTouchStart={() => notifyDragChange(true, 'exposure')}
              onTouchEnd={() => notifyDragChange(false, null)}
              className="w-full"
            />
            <div className="text-xs text-gray-400 mt-1">
              Lower = fainter, Higher = brighter
            </div>
          </div>
        )}

        {/* Decay */}
        {(activeSliderId === 'decay' || !activeSliderId) && (
          <div>
            <label className="text-xs font-bold text-gray-300">
              Decay (Shaft Length): {selectedPreset.decay.toFixed(3)}
            </label>
            <input
              type="range"
              min="0.9"
              max="0.99"
              step="0.005"
              value={selectedPreset.decay}
              onChange={e => handlePresetChange({ decay: parseFloat(e.target.value) })}
              onMouseDown={() => notifyDragChange(true, 'decay')}
              onMouseUp={() => notifyDragChange(false, null)}
              onTouchStart={() => notifyDragChange(true, 'decay')}
              onTouchEnd={() => notifyDragChange(false, null)}
              className="w-full"
            />
            <div className="text-xs text-gray-400 mt-1">
              Lower = short shafts, Higher = long shafts
            </div>
          </div>
        )}

        {/* Weight */}
        {(activeSliderId === 'weight' || !activeSliderId) && (
          <div>
            <label className="text-xs font-bold text-gray-300">
              Weight (Ray Thickness): {selectedPreset.weight.toFixed(3)}
            </label>
            <input
              type="range"
              min="0.01"
              max="0.1"
              step="0.005"
              value={selectedPreset.weight}
              onChange={e => handlePresetChange({ weight: parseFloat(e.target.value) })}
              onMouseDown={() => notifyDragChange(true, 'weight')}
              onMouseUp={() => notifyDragChange(false, null)}
              onTouchStart={() => notifyDragChange(true, 'weight')}
              onTouchEnd={() => notifyDragChange(false, null)}
              className="w-full"
            />
            <div className="text-xs text-gray-400 mt-1">
              Lower = thin rays, Higher = thick rays
            </div>
          </div>
        )}

        {/* Density */}
        {(activeSliderId === 'density' || !activeSliderId) && (
          <div>
            <label className="text-xs font-bold text-gray-300">
              Density (Spread): {selectedPreset.density.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={selectedPreset.density}
              onChange={e => handlePresetChange({ density: parseFloat(e.target.value) })}
              onMouseDown={() => notifyDragChange(true, 'density')}
              onMouseUp={() => notifyDragChange(false, null)}
              onTouchStart={() => notifyDragChange(true, 'density')}
              onTouchEnd={() => notifyDragChange(false, null)}
              className="w-full"
            />
            <div className="text-xs text-gray-400 mt-1">
              Lower = tight rays, Higher = wide spread
            </div>
          </div>
        )}

        {/* Noise Amount */}
        {(activeSliderId === 'noise-amount' || !activeSliderId) && (
          <div>
            <label className="text-xs font-bold text-gray-300">
              Noise (Anti-Banding): {selectedPreset.noiseAmount.toFixed(3)}
            </label>
            <input
              type="range"
              min="0"
              max="0.1"
              step="0.005"
              value={selectedPreset.noiseAmount}
              onChange={e => handlePresetChange({ noiseAmount: parseFloat(e.target.value) })}
              onMouseDown={() => notifyDragChange(true, 'noise-amount')}
              onMouseUp={() => notifyDragChange(false, null)}
              onTouchStart={() => notifyDragChange(true, 'noise-amount')}
              onTouchEnd={() => notifyDragChange(false, null)}
              className="w-full"
            />
            <div className="text-xs text-gray-400 mt-1">
              Breaks up banding artifacts
            </div>
          </div>
        )}

        {/* Ray Color */}
        <div>
          <label className="text-xs font-bold text-gray-300 block mb-2">
            Ray Color (RGB)
          </label>
          <div className="flex gap-2 items-center mb-2">
            <div
              className="w-8 h-8 rounded border border-gray-500"
              style={{ backgroundColor: colorHex }}
            />
            <div className="text-xs text-gray-400">
              {colorHex}
            </div>
          </div>

          <div className="space-y-2">
            {(['Red', 'Green', 'Blue'] as const).map((channel, i) => (
              (activeSliderId === `ray-color-${channel.toLowerCase()}` || !activeSliderId) && (
                <div key={channel}>
                  <label className="text-xs text-gray-400">
                    {channel}: {selectedPreset.rayColor[i].toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedPreset.rayColor[i]}
                    onChange={e => {
                      const newColor = [...selectedPreset.rayColor] as [number, number, number];
                      newColor[i] = parseFloat(e.target.value);
                      handlePresetChange({ rayColor: newColor });
                    }}
                    onMouseDown={() => notifyDragChange(true, `ray-color-${channel.toLowerCase()}`)}
                    onMouseUp={() => notifyDragChange(false, null)}
                    onTouchStart={() => notifyDragChange(true, `ray-color-${channel.toLowerCase()}`)}
                    onTouchEnd={() => notifyDragChange(false, null)}
                    className="w-full"
                  />
                </div>
              )
            ))}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-gray-400 border border-gray-700 rounded p-2 bg-gray-800">
        <p>
          Adjust parameters to customize the god ray effect. Save your settings as a preset
          and load them later. Changes are saved to browser storage.
        </p>
      </div>

      {embedded && (
        <button
          onClick={onClose}
          className="mt-auto px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-bold"
        >
          Close
        </button>
      )}
    </div>
  );
});

export default GodRaysEditor;
