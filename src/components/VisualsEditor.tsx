import { memo, useState, useRef, useEffect } from 'react';
import type { MouseEvent, TouchEvent, MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ThreeJsElementsDemo } from './ThreeJsElementCards';
import { CardFrame } from './card/CardFrame';
import { useHoloInteraction } from '../hooks/useHoloInteraction';
import { NEON_COLORS } from '../utils/styles';

// Atmosphere Imports (Alphabetized)
import { AuroraForestAtmosphere } from './atmosphere/AuroraForestAtmosphere';
import { BlackHoleAtmosphere } from './atmosphere/BlackHoleAtmosphere';
import { BrownianMotionAtmosphere } from './atmosphere/BrownianMotionAtmosphere';
import { ChaosSplitAtmosphere } from './atmosphere/ChaosSplitAtmosphere';
import { CometRainAtmosphere, DEFAULT_COMET_RAIN_CONFIG, type CometRainConfig } from './atmosphere/CometRainAtmosphere';
import { CosmicLintAtmosphere, DEFAULT_COSMIC_LINT_CONFIG, type CosmicLintConfig } from './atmosphere/CosmicLintAtmosphere';
import { DriftingPurpleAtmosphere } from './atmosphere/DriftingPurpleAtmosphere';
import { EinsteinRosenAtmosphere } from './atmosphere/EinsteinRosenAtmosphere';
import { FallingSnowAtmosphere, DEFAULT_FALLING_SNOW_CONFIG, type FallingSnowConfig } from './atmosphere/FallingSnowAtmosphere';
import { FlorpusForestAtmosphere } from './atmosphere/FlorpusForestAtmosphere';
import { GravitySplitAtmosphere } from './atmosphere/GravitySplitAtmosphere';
import { InfernoMaelstromAtmosphere } from './atmosphere/InfernoMaelstromAtmosphere';
import { LostInStarsAtmosphere } from './atmosphere/LostInStarsAtmosphere';
import { OceanSolarCycleAtmosphere, DEFAULT_OCEAN_SOLAR_CYCLE_CONFIG, type OceanSolarCycleConfig } from './atmosphere/OceanSolarCycleAtmosphere';
import { RagingWavesAtmosphere, DEFAULT_RAGING_WAVES_CONFIG, type RagingWavesConfig } from './atmosphere/RagingWavesAtmosphere';
import { RaritySquaresTunnelAtmosphere } from './atmosphere/RaritySquaresTunnelAtmosphere';
import { SacredRealmAtmosphere } from './atmosphere/SacredRealmAtmosphere';
import { SolarisPrimeAtmosphere } from './atmosphere/SolarisPrimeAtmosphere';
import { SakuraBlossomsAtmosphere } from './atmosphere/SakuraBlossomsAtmosphere';
import { SmokeGreenAtmosphere } from './atmosphere/SmokeGreenAtmosphere';
import { ElectricSkiesAtmosphere, DEFAULT_ELECTRIC_SKIES_CONFIG, type ElectricSkiesConfig } from './atmosphere/ElectricSkiesAtmosphere';
import { StarsTwinklePerformantAtmosphere, DEFAULT_STARS_TWINKLE_CONFIG, type StarsTwinkleConfig } from './atmosphere/StarsTwinklePerformantAtmosphere';

// Other Demos
import { VertexDepthShaderDemo, DEFAULT_VERTEX_DEPTH_CONFIG, type VertexDepthConfig } from './VertexDepthShaderDemo';
import { MidairFlipDemo } from './MidairFlipDemo';
import { DepthPerspectiveShiftDemo } from './DepthPerspectiveShiftDemo';
import { Depth3DShiftDemo, DEFAULT_DEPTH_3D_SHIFT_CONFIG, type Depth3DShiftConfig } from './Depth3DShiftDemo';
import { FlowerGeneratorEffect, DEFAULT_FLOWER_GENERATOR_CONFIG, type FlowerGeneratorConfig } from './active/FlowerGeneratorEffect';
import { ElectronPaintingEffect } from './active/ElectronPaintingEffect';
import { CosmicNeutronBarrageEffect } from './active/CosmicNeutronBarrageEffect';
import { LocalizedBlackHoleEffect } from './active/LocalizedBlackHoleEffect';
import { SparksPericulumEffect } from './active/SparksPericulumEffect';
import { SpawnNaviEffect } from './active/SpawnNaviEffect';
import { ProtegoBlastEffect, DEFAULT_PROTEGO_BLAST_CONFIG, type ProtegoBlastConfig } from './active/ProtegoBlastEffect';
import { GodRaysEffect, DEFAULT_GOD_RAYS_CONFIG, type GodRaysConfig } from './active/GodRaysEffect';

// Text Effect Imports
import { DisassembledTextEffect, DEFAULT_DISASSEMBLED_TEXT_CONFIG, type DisassembledTextConfig } from './text/DisassembledTextEffect';
import { FloatAwayTextEffect, DEFAULT_FLOAT_AWAY_TEXT_CONFIG, type FloatAwayTextConfig } from './text/FloatAwayTextEffect';
import { ShimmerTextEffect, DEFAULT_SHIMMER_TEXT_CONFIG, type ShimmerTextConfig } from './text/ShimmerTextEffect';
import { FogOutTextEffect, DEFAULT_FOG_OUT_TEXT_CONFIG, type FogOutTextConfig } from './text/FogOutTextEffect';
import { BarrageTextEffect, DEFAULT_BARRAGE_TEXT_CONFIG, type BarrageTextConfig } from './text/BarrageTextEffect';
import { DoubleCutTextEffect, DEFAULT_DOUBLE_CUT_TEXT_CONFIG, type DoubleCutTextConfig } from './text/DoubleCutTextEffect';
import { FrostTextEffect, DEFAULT_FROST_TEXT_CONFIG, type FrostTextConfig } from './text/FrostTextEffect';
import { ComboPunchTextEffect, DEFAULT_COMBO_PUNCH_TEXT_CONFIG, type ComboPunchTextConfig } from './text/ComboPunchTextEffect';
import { PetrifiedTextEffect, DEFAULT_PETRIFIED_TEXT_CONFIG, type PetrifiedTextConfig } from './text/PetrifiedTextEffect';
import { ThanosDismantleTextEffect, DEFAULT_THANOS_DISMANTLE_TEXT_CONFIG, type ThanosDismantleTextConfig } from './text/ThanosDismantleTextEffect';

import { LiquidHoloDemo } from './LiquidHoloDemo';
import { SVGFilters } from './SVGFilters';

import { ATMOSPHERE_PRESETS, type AtmosphereEffectId } from './atmosphere/atmosphereLibrary';
import { TEXT_PRESETS, type TextEffectId } from './text/textEffectsLibrary';
import { DynamicPaintCanvas } from './DynamicPaintCanvas';
import { ELEMENT_WATERCOLOR_SWATCH_ORDER, ELEMENT_WATERCOLOR_SWATCHES } from '../watercolor/elementalSwatches';
import { FpsBadge } from './combat/FpsBadge';

const BLUEYCHU_ASSET = '/assets/Bluevee.png';

interface SubEditorProps {
  leftCollapsed: boolean;
  setLeftCollapsed: (v: boolean) => void;
  rightCollapsed: boolean;
  setRightCollapsed: (v: boolean) => void;
}

const CollapsibleSidebar = memo(function CollapsibleSidebar({ 
  children, 
  collapsed, 
  setCollapsed, 
  side, 
  widthClass, 
}: { 
  children: React.ReactNode, 
  collapsed: boolean, 
  setCollapsed: (v: boolean) => void, 
  side: 'left' | 'right',
  widthClass: string,
}) {
  const isLeft = side === 'left';
  return (
    <div className={`relative flex flex-col transition-all duration-300 ${collapsed ? 'w-0' : widthClass} shrink-0`}>
      <div className={`h-full flex flex-col gap-4 overflow-y-auto custom-scrollbar transition-opacity duration-300 ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'} ${isLeft ? 'border-r border-game-teal/10 pr-3' : 'border-l border-game-teal/10 pl-3'} scrollbar-hide`}>
        {children}
      </div>
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className={`absolute top-2 z-30 w-4 h-8 bg-black/80 border border-game-teal/30 flex items-center justify-center text-[10px] text-game-teal hover:bg-game-teal/20 transition-all backdrop-blur-sm shadow-xl ${isLeft ? (collapsed ? '-right-4 rounded-r-md' : 'right-0 rounded-l-md') : (collapsed ? '-left-4 rounded-l-md' : 'left-0 rounded-r-md')}`}
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        {isLeft ? (collapsed ? '»' : '«') : (collapsed ? '«' : '»')}
      </button>
    </div>
  );
});

type HoloEffectPreset = {
  id: string;
  name: string;
  description: string;
  rarity: string;
  descriptorTitle: string;
  effectClass: string;
};

const HOLO_EFFECT_PRESETS: HoloEffectPreset[] = [
  { id: 'legacy-rainbow-foundation', name: 'Rainbow Foundation', description: 'Foundation actor variant of rainbow secret holo for in-combat stacking tests.', rarity: 'mythic', descriptorTitle: 'Rainbow Foundation', effectClass: 'card-holo-legacy-rainbow-foundation' },
  { id: 'legacy-common-uncommon', name: 'Common + Uncommon', description: 'Subtle baseline sheen for common and uncommon treatments.', rarity: 'common', descriptorTitle: 'Common & Uncommon', effectClass: 'card-holo-legacy-common-uncommon' },
  { id: 'legacy-reverse-holo', name: 'Reverse Holo', description: 'Non-rare reverse foil striping with dark bar modulation.', rarity: 'uncommon', descriptorTitle: 'Reverse Holo non-rares', effectClass: 'card-holo-legacy-reverse-holo' },
  { id: 'legacy-holofoil-rare', name: 'Holofoil Rare', description: 'Classic rare holo foil with spectral bar and shine stack.', rarity: 'rare', descriptorTitle: 'Holofoil Rare', effectClass: 'card-holo-legacy-holofoil-rare' },
  { id: 'legacy-galaxy-cosmos', name: 'Galaxy / Cosmos', description: 'Galaxy texture with deep-space blend and color-dodge bloom.', rarity: 'rare', descriptorTitle: 'Galaxy/Cosmos Holofoil', effectClass: 'card-holo-legacy-galaxy-cosmos' },
  { id: 'legacy-v', name: 'V Holo', description: 'High-contrast rainbow V foil with layered directional lighting.', rarity: 'rare', descriptorTitle: 'V', effectClass: 'card-holo-legacy-v' },
  { id: 'legacy-vmax', name: 'VMAX Holo', description: 'Heavy saturation VMAX foil with high-energy aura blends.', rarity: 'epic', descriptorTitle: 'VMAX', effectClass: 'card-holo-legacy-vmax' },
  { id: 'legacy-vstar', name: 'VSTAR Holo', description: 'VSTAR prismatic treatment with exclusion secondary pass.', rarity: 'legendary', descriptorTitle: 'VSTAR', effectClass: 'card-holo-legacy-vstar' },
  { id: 'legacy-full-alt', name: 'Full / Alt Art', description: 'Full-art foil with elevated contrast and art-first sheen.', rarity: 'legendary', descriptorTitle: 'Full / Alternate Art', effectClass: 'card-holo-legacy-full-alt' },
  { id: 'legacy-trainer-full-art', name: 'Trainer Full-Art', description: 'Trainer-specific full-art blend profile.', rarity: 'epic', descriptorTitle: 'Trainer Full-Art', effectClass: 'card-holo-legacy-trainer-full-art' },
  { id: 'legacy-rainbow-secret', name: 'Rainbow Secret', description: 'Dense rainbow secret texture with deep gradient bands.', rarity: 'mythic', descriptorTitle: 'Rainbow Secret', effectClass: 'card-holo-legacy-rainbow-secret' },
  { id: 'legacy-rainbow-secret-alt', name: 'Rainbow Secret Alt', description: 'Higher-contrast variant for rainbow secret full/alt cards.', rarity: 'mythic', descriptorTitle: 'Rainbow Secret Full/Alt', effectClass: 'card-holo-legacy-rainbow-secret-alt' },
  { id: 'legacy-gold-secret', name: 'Gold Secret', description: 'Metal-heavy secret rare with warm gold spectral glint.', rarity: 'legendary', descriptorTitle: 'Gold Secret', effectClass: 'card-holo-legacy-gold-secret' },
  { id: 'legacy-radiant', name: 'Radiant', description: 'Radiant cross-hatch foil with high luminance contrast.', rarity: 'mythic', descriptorTitle: 'Radiant', effectClass: 'card-holo-legacy-radiant' },
  { id: 'legacy-trainer-gallery-holo', name: 'Trainer Gallery Holo', description: 'Gallery holo treatment with angular rainbow sweep.', rarity: 'rare', descriptorTitle: 'Trainer Gallery Holo', effectClass: 'card-holo-legacy-trainer-gallery-holo' },
  { id: 'legacy-trainer-gallery-v', name: 'Trainer Gallery V', description: 'Gallery V holographic profile with layered exclusion pass.', rarity: 'rare', descriptorTitle: 'Trainer Gallery V', effectClass: 'card-holo-legacy-trainer-gallery-v' },
  { id: 'legacy-trainer-gallery-vmax', name: 'Trainer Gallery VMAX', description: 'Gallery VMAX variant tuned for punchier foil depth.', rarity: 'legendary', descriptorTitle: 'Trainer Gallery VMAX', effectClass: 'card-holo-legacy-trainer-gallery-vmax' }
];

const ConfigSlider = ({ label, value = 0, min, max, step, onChange }: { 
  label: string, value?: number, min: number, max: number, step: number, onChange: (v: number) => void 
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <label className="text-[9px] text-game-white/60 uppercase font-mono">{label}</label>
      <span className="text-[9px] text-game-gold font-mono">{(value ?? 0).toFixed(step < 0.01 ? 4 : 3)}</span>
    </div>
    <input
      type="range"
      min={min} max={max} step={step}
      value={value ?? 0}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-game-teal/10 rounded-lg appearance-none cursor-pointer accent-game-gold"
    />
  </div>
);

const ConfigColorPicker = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between gap-4">
    <label className="text-[9px] text-game-white/60 uppercase font-mono">{label}</label>
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-game-white/40 font-mono">{value.toUpperCase()}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 bg-transparent border-none cursor-pointer p-0"
      />
    </div>
  </div>
);

const VisualCard = memo(function VisualCard({ 
  preset, 
  active,
  revealType = 'standard',
  holoActive = false,
}: { 
  preset: HoloEffectPreset,
  active: boolean,
  revealType?: 'standard' | 'spin-zoom',
  holoActive?: boolean,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 180, height: 245 });
  const { styles: holoStyles, handlePointerMove, handlePointerLeave, registerElement } = useHoloInteraction();
  
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width;
        const height = (width / 2.2) * 3;
        setDimensions({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef.current]);

  const holoStylesEnabled = holoActive;
  
  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        registerElement(node);
      }}
      className={`relative w-full aspect-[2.2/3] group ${revealType === 'spin-zoom' ? 'animate-reveal-spin-zoom' : ''}`}
      onPointerMove={holoStylesEnabled ? handlePointerMove : undefined}
      onMouseLeave={holoStylesEnabled ? handlePointerLeave : undefined}
      style={holoStylesEnabled ? holoStyles : undefined}
    >
      <div className={`card-3d-container h-full w-full ${active ? 'active' : ''}`}>
        <CardFrame
          size={dimensions}
          borderColor={active ? NEON_COLORS.gold : 'rgba(127, 219, 202, 0.4)'}
          boxShadow={active ? `0 0 25px ${NEON_COLORS.goldRgba(0.4)}` : 'none'}
          className="card-3d flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#0a0c18] to-[#040712]"
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 0,
              backgroundImage: `url('${BLUEYCHU_ASSET}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: active ? 0.2 : 0.15,
            }}
          />
          <div 
            className={`absolute inset-0 pointer-events-none ${preset.effectClass}`} 
            style={{ 
              opacity: active ? 0.8 : 0.6
            }} 
          />
          {preset.effectClass.includes('gradient') && (
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 3,
                background: `radial-gradient(circle at center, rgba(255,255,255,0.25) 0%, transparent 85%)`,
                opacity: active ? 1 : 0.7
              }}
            />
          )}

          <div className="relative z-20 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-game-teal/60 font-black">{preset.rarity}</div>
            <div className="text-sm font-bold text-game-white tracking-wider">{preset.name}</div>
            <div className="text-[9px] leading-relaxed text-game-white/40 px-2 italic line-clamp-2">{preset.description}</div>
          </div>
        </CardFrame>
      </div>
    </div>
  );
});

const AtmosEditor = memo(function AtmosEditor({ 
  leftCollapsed, setLeftCollapsed, 
  rightCollapsed, setRightCollapsed 
}: SubEditorProps) {
  const [selectedBaseId, setSelectedBaseId] = useState<AtmosphereEffectId>('aurora_forest');
  const [ragingWavesConfig, setRagingWavesConfig] = useState<RagingWavesConfig>(DEFAULT_RAGING_WAVES_CONFIG);
  const [fallingSnowConfig, setFallingSnowConfig] = useState<FallingSnowConfig>(DEFAULT_FALLING_SNOW_CONFIG);
  const [oceanSolarCycleConfig, setOceanSolarCycleConfig] = useState<OceanSolarCycleConfig>(DEFAULT_OCEAN_SOLAR_CYCLE_CONFIG);
  const [cosmicLintConfig, setCosmicLintConfig] = useState<CosmicLintConfig>(DEFAULT_COSMIC_LINT_CONFIG);
  const [cometRainConfig, setCometRainConfig] = useState<CometRainConfig>(DEFAULT_COMET_RAIN_CONFIG);
  const [electricSkiesConfig, setElectricSkiesConfig] = useState<ElectricSkiesConfig>(DEFAULT_ELECTRIC_SKIES_CONFIG);
  const [starsTwinkleConfig, setStarsTwinkleConfig] = useState<StarsTwinkleConfig>(DEFAULT_STARS_TWINKLE_CONFIG);
  
  const [userPresets, setUserPresets] = useState<Record<string, { baseId: AtmosphereEffectId, config: any }>>({});
  const [activePresetName, setActivePresetName] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [hasSelectedBaseScene, setHasSelectedBaseScene] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('exploritaire_atmos_presets');
    if (saved) {
      try { setUserPresets(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  const savePreset = () => {
    if (!saveName) return;
    const currentConfig = selectedBaseId === 'raging_waves' ? ragingWavesConfig : 
                        selectedBaseId === 'falling_snow' ? fallingSnowConfig : 
                        selectedBaseId === 'ocean_solar_cycle' ? oceanSolarCycleConfig : 
                        selectedBaseId === 'cosmic_lint' ? cosmicLintConfig : 
                        selectedBaseId === 'comet_rain' ? cometRainConfig : 
                        selectedBaseId === 'electric_skies' ? electricSkiesConfig : 
                        selectedBaseId === 'stars_twinkle_performant' ? starsTwinkleConfig : null;
    const nextPresets = { ...userPresets, [saveName]: { baseId: selectedBaseId, config: currentConfig } };
    setUserPresets(nextPresets);
    localStorage.setItem('exploritaire_atmos_presets', JSON.stringify(nextPresets));
    setActivePresetName(saveName);
    setSaveName('');
  };

  const loadPreset = (name: string) => {
    const preset = userPresets[name];
    if (preset) {
      setSelectedBaseId(preset.baseId);
      if (preset.baseId === 'raging_waves') setRagingWavesConfig(preset.config);
      if (preset.baseId === 'falling_snow') setFallingSnowConfig(preset.config);
      if (preset.baseId === 'ocean_solar_cycle') setOceanSolarCycleConfig(preset.config);
      if (preset.baseId === 'cosmic_lint') setCosmicLintConfig(preset.config);
      if (preset.baseId === 'comet_rain') setCometRainConfig(preset.config);
      if (preset.baseId === 'electric_skies') setElectricSkiesConfig(preset.config);
      if (preset.baseId === 'stars_twinkle_performant') setStarsTwinkleConfig(preset.config);
      setActivePresetName(name);
    }
  };

  const deletePreset = (name: string) => {
    const nextPresets = { ...userPresets };
    delete nextPresets[name];
    setUserPresets(nextPresets);
    localStorage.setItem('exploritaire_atmos_presets', JSON.stringify(nextPresets));
    if (activePresetName === name) setActivePresetName(null);
  };

  const resetToDefault = () => {
    if (selectedBaseId === 'raging_waves') setRagingWavesConfig(DEFAULT_RAGING_WAVES_CONFIG);
    if (selectedBaseId === 'falling_snow') setFallingSnowConfig(DEFAULT_FALLING_SNOW_CONFIG);
    if (selectedBaseId === 'ocean_solar_cycle') setOceanSolarCycleConfig(DEFAULT_OCEAN_SOLAR_CYCLE_CONFIG);
    if (selectedBaseId === 'cosmic_lint') setCosmicLintConfig(DEFAULT_COSMIC_LINT_CONFIG);
    if (selectedBaseId === 'comet_rain') setCometRainConfig(DEFAULT_COMET_RAIN_CONFIG);
    if (selectedBaseId === 'electric_skies') setElectricSkiesConfig(DEFAULT_ELECTRIC_SKIES_CONFIG);
    if (selectedBaseId === 'stars_twinkle_performant') setStarsTwinkleConfig(DEFAULT_STARS_TWINKLE_CONFIG);
    setActivePresetName(null);
  };

  const renderPreview = () => {
    switch (selectedBaseId) {
      case 'aurora_forest': return <AuroraForestAtmosphere />;
      case 'black_hole': return <BlackHoleAtmosphere />;
      case 'brownian_motion': return <BrownianMotionAtmosphere />;
      case 'chaos_split': return <ChaosSplitAtmosphere />;
      case 'comet_rain': return <CometRainAtmosphere config={cometRainConfig} />;
      case 'cosmic_lint': return <CosmicLintAtmosphere config={cosmicLintConfig} />;
      case 'drifting_purple': return <DriftingPurpleAtmosphere />;
      case 'einstein_rosen': return <EinsteinRosenAtmosphere />;
      case 'falling_snow': return <FallingSnowAtmosphere config={fallingSnowConfig} />;
      case 'florpus_forest': return <FlorpusForestAtmosphere />;
      case 'gravity_split': return <GravitySplitAtmosphere />;
      case 'inferno_maelstrom': return <InfernoMaelstromAtmosphere />;
      case 'lost_in_stars': return <LostInStarsAtmosphere />;
      case 'ocean_solar_cycle': return <OceanSolarCycleAtmosphere config={oceanSolarCycleConfig} />;
      case 'raging_waves': return <RagingWavesAtmosphere config={ragingWavesConfig} enableControls />;
      case 'rarity_squares_tunnel': return <RaritySquaresTunnelAtmosphere />;
      case 'sacred_realm': return <SacredRealmAtmosphere />;
      case 'solaris_prime': return <SolarisPrimeAtmosphere />;
      case 'sakura_blossoms': return <SakuraBlossomsAtmosphere />;
      case 'smoke_green': return <SmokeGreenAtmosphere />;
      case 'electric_skies': return <ElectricSkiesAtmosphere config={electricSkiesConfig} />;
      case 'stars_twinkle_performant': return <StarsTwinklePerformantAtmosphere config={starsTwinkleConfig} />;
      default: return <div className="flex items-center justify-center h-full text-game-white/20">No preview available</div>;
    }
  };

  const hasConfig = ['raging_waves', 'falling_snow', 'ocean_solar_cycle', 'cosmic_lint', 'comet_rain', 'electric_skies', 'stars_twinkle_performant'].includes(selectedBaseId);

  return (
    <div className="flex h-full gap-4 overflow-hidden relative">
      <CollapsibleSidebar side="left" collapsed={leftCollapsed} setCollapsed={setLeftCollapsed} widthClass="w-40">
        <div className={`${hasSelectedBaseScene ? 'h-4/5' : 'h-full'} min-h-0 flex flex-col gap-1`}>
          <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-game-teal/60">Base Scenes</h3>
          <div className="flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto custom-scrollbar pr-2">
            {ATMOSPHERE_PRESETS.map((p) => (
              <button key={p.id} onClick={() => { setSelectedBaseId(p.id); setActivePresetName(null); setHasSelectedBaseScene(true); }} className={`text-[9px] font-mono text-left px-2 py-1 rounded border transition-all ${selectedBaseId === p.id ? 'border-game-gold text-game-gold bg-game-gold/5' : 'border-game-teal/20 text-game-white/40 hover:border-game-teal/40'}`}>{p.label}</button>
            ))}
          </div>
        </div>
        <div className={`${hasSelectedBaseScene ? 'h-1/5' : 'hidden'} min-h-0 flex flex-col gap-2`}>
          <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-game-gold/60">Saved Presets</h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-1">
            {Object.keys(userPresets).length === 0 && <div className="text-[8px] text-game-white/30 italic px-2">No saved presets</div>}
            {Object.keys(userPresets).map((name) => (
              <div key={name} className="flex items-center gap-1 group">
                <button onClick={() => loadPreset(name)} className={`flex-1 text-[9px] font-mono text-left px-2 py-1 rounded border transition-all truncate ${activePresetName === name ? 'border-game-gold text-game-gold bg-game-gold/10' : 'border-game-teal/10 text-game-white/40 hover:border-game-teal/30 hover:text-game-white/60'}`}>{name}</button>
                <button onClick={() => deletePreset(name)} className="p-1 text-game-pink/40 hover:text-game-pink transition-colors">×</button>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-game-teal/10 space-y-2">
            <input type="text" placeholder="Name..." value={saveName} onChange={(e) => setSaveName(e.target.value)} className="w-full bg-black/40 border border-game-teal/20 rounded px-2 py-1 text-[9px] text-game-white font-mono focus:border-game-gold/50 outline-none" />
            <button onClick={savePreset} disabled={!saveName} className="w-full py-1 rounded border border-game-gold/40 text-game-gold text-[8px] font-black uppercase tracking-widest hover:bg-game-gold/10 disabled:opacity-30 transition-all">Save</button>
          </div>
        </div>
      </CollapsibleSidebar>

      <div className="flex-1 relative rounded-xl border border-game-teal/10 bg-black/40 overflow-hidden group">
        {renderPreview()}
        <div className="absolute top-4 left-4 pointer-events-none">
          <div className="px-2 py-1 rounded bg-black/60 border border-game-teal/20 text-[9px] text-game-teal font-mono uppercase tracking-widest">Preview: {activePresetName || selectedBaseId}</div>
        </div>
      </div>

      {hasConfig && (
        <CollapsibleSidebar side="right" collapsed={rightCollapsed} setCollapsed={setRightCollapsed} widthClass="w-56">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-game-teal/60">Config</h3>
            <button onClick={resetToDefault} className="text-[8px] text-game-gold/60 hover:text-game-gold uppercase font-bold tracking-tighter">Reset</button>
          </div>
          <div className="space-y-4 pb-8">
            {selectedBaseId === 'raging_waves' && (
              <>
                <ConfigSlider label="Elevation" value={ragingWavesConfig.bigWavesElevation} min={0} max={1} step={0.001} onChange={(v) => setRagingWavesConfig({ ...ragingWavesConfig, bigWavesElevation: v })} />
                <ConfigSlider label="Speed" value={ragingWavesConfig.bigWaveSpeed} min={0.25} max={5} step={0.001} onChange={(v) => setRagingWavesConfig({ ...ragingWavesConfig, bigWaveSpeed: v })} />
                <ConfigColorPicker label="Depth" value={ragingWavesConfig.depthColor} onChange={(v) => setRagingWavesConfig({ ...ragingWavesConfig, depthColor: v })} />
                <ConfigColorPicker label="Surface" value={ragingWavesConfig.surfaceColor} onChange={(v) => setRagingWavesConfig({ ...ragingWavesConfig, surfaceColor: v })} />
              </>
            )}
            {selectedBaseId === 'falling_snow' && (
              <>
                <ConfigSlider label="Count" value={fallingSnowConfig.particleCount} min={100} max={5000} step={100} onChange={(v) => setFallingSnowConfig({ ...fallingSnowConfig, particleCount: v })} />
                <ConfigSlider label="Size" value={fallingSnowConfig.particleSize} min={1} max={50} step={1} onChange={(v) => setFallingSnowConfig({ ...fallingSnowConfig, particleSize: v })} />
                <ConfigColorPicker label="Color" value={fallingSnowConfig.color} onChange={(v) => setFallingSnowConfig({ ...fallingSnowConfig, color: v })} />
              </>
            )}
            {selectedBaseId === 'comet_rain' && (
              <>
                <ConfigSlider label="Count" value={cometRainConfig.particleCount} min={1} max={200} step={1} onChange={(v) => setCometRainConfig({ ...cometRainConfig, particleCount: v })} />
                <ConfigSlider label="Speed" value={cometRainConfig.speed} min={0} max={1} step={0.001} onChange={(v) => setCometRainConfig({ ...cometRainConfig, speed: v })} />
              </>
            )}
            {selectedBaseId === 'ocean_solar_cycle' && (
              <>
                <ConfigSlider label="Elevation" value={oceanSolarCycleConfig.elevation} min={-90} max={90} step={0.1} onChange={(v) => setOceanSolarCycleConfig({ ...oceanSolarCycleConfig, elevation: v })} />
                <ConfigSlider label="Azimuth" value={oceanSolarCycleConfig.azimuth} min={-180} max={180} step={0.1} onChange={(v) => setOceanSolarCycleConfig({ ...oceanSolarCycleConfig, azimuth: v })} />
                <ConfigSlider label="Exposure" value={oceanSolarCycleConfig.exposure} min={0} max={1} step={0.001} onChange={(v) => setOceanSolarCycleConfig({ ...oceanSolarCycleConfig, exposure: v })} />
                <ConfigSlider label="Sun Intensity" value={oceanSolarCycleConfig.sunIntensity} min={0} max={10} step={0.1} onChange={(v) => setOceanSolarCycleConfig({ ...oceanSolarCycleConfig, sunIntensity: v })} />
                <ConfigSlider label="Distortion" value={oceanSolarCycleConfig.distortionScale} min={0} max={20} step={0.1} onChange={(v) => setOceanSolarCycleConfig({ ...oceanSolarCycleConfig, distortionScale: v })} />
                <ConfigColorPicker label="Water Color" value={oceanSolarCycleConfig.waterColor} onChange={(v) => setOceanSolarCycleConfig({ ...oceanSolarCycleConfig, waterColor: v })} />
              </>
            )}
            {selectedBaseId === 'cosmic_lint' && (
              <>
                <ConfigSlider label="Zoom" value={cosmicLintConfig.zoom} min={0.1} max={5} step={0.01} onChange={(v) => setCosmicLintConfig({ ...cosmicLintConfig, zoom: v })} />
                <ConfigSlider label="Speed" value={cosmicLintConfig.speed} min={0} max={0.1} step={0.0001} onChange={(v) => setCosmicLintConfig({ ...cosmicLintConfig, speed: v })} />
                <ConfigSlider label="Iterations" value={cosmicLintConfig.iterations} min={1} max={20} step={1} onChange={(v) => setCosmicLintConfig({ ...cosmicLintConfig, iterations: Math.round(v) })} />
                <ConfigSlider label="Brightness" value={cosmicLintConfig.brightness} min={0} max={0.05} step={0.0001} onChange={(v) => setCosmicLintConfig({ ...cosmicLintConfig, brightness: v })} />
                <ConfigSlider label="Saturation" value={cosmicLintConfig.saturation} min={0} max={2} step={0.01} onChange={(v) => setCosmicLintConfig({ ...cosmicLintConfig, saturation: v })} />
              </>
            )}
            {selectedBaseId === 'electric_skies' && (
              <>
                <ConfigSlider label="Rain Count" value={electricSkiesConfig.rainCount} min={1000} max={30000} step={500} onChange={(v) => setElectricSkiesConfig({ ...electricSkiesConfig, rainCount: v })} />
                <ConfigSlider label="Cloud Count" value={electricSkiesConfig.cloudCount} min={5} max={150} step={1} onChange={(v) => setElectricSkiesConfig({ ...electricSkiesConfig, cloudCount: v })} />
                <ConfigSlider label="Flash Freq" value={electricSkiesConfig.flashFrequency} min={0.01} max={0.5} step={0.01} onChange={(v) => setElectricSkiesConfig({ ...electricSkiesConfig, flashFrequency: v })} />
                <ConfigSlider label="Flash Int" value={electricSkiesConfig.flashIntensity} min={10} max={500} step={5} onChange={(v) => setElectricSkiesConfig({ ...electricSkiesConfig, flashIntensity: v })} />
                <ConfigSlider label="Rain Speed" value={electricSkiesConfig.rainSpeed} min={0.1} max={10.0} step={0.1} onChange={(v) => setElectricSkiesConfig({ ...electricSkiesConfig, rainSpeed: v })} />
                <ConfigSlider label="Cloud Opacity" value={electricSkiesConfig.cloudOpacity} min={0.05} max={1.0} step={0.01} onChange={(v) => setElectricSkiesConfig({ ...electricSkiesConfig, cloudOpacity: v })} />
              </>
            )}
            {selectedBaseId === 'stars_twinkle_performant' && (
              <>
                <ConfigSlider label="Star Count" value={starsTwinkleConfig.starCount} min={50} max={2000} step={10} onChange={(v) => setStarsTwinkleConfig({ ...starsTwinkleConfig, starCount: Math.round(v) })} />
                <ConfigColorPicker label="Glow Color" value={starsTwinkleConfig.glowColor} onChange={(v) => setStarsTwinkleConfig({ ...starsTwinkleConfig, glowColor: v })} />
              </>
            )}
          </div>
        </CollapsibleSidebar>
      )}
    </div>
  );
});

const TextEffectsEditor = memo(function TextEffectsEditor({ 
  leftCollapsed, setLeftCollapsed, 
  rightCollapsed, setRightCollapsed 
}: SubEditorProps) {
  const [selectedBaseId, setSelectedBaseId] = useState<TextEffectId>('disassembled');
  const [disassembledConfig, setDisassembledConfig] = useState<DisassembledTextConfig>(DEFAULT_DISASSEMBLED_TEXT_CONFIG);
  const [floatAwayConfig, setFloatAwayConfig] = useState<FloatAwayTextConfig>(DEFAULT_FLOAT_AWAY_TEXT_CONFIG);
  const [shimmerConfig, setShimmerConfig] = useState<ShimmerTextConfig>(DEFAULT_SHIMMER_TEXT_CONFIG);
  const [fogOutConfig, setFogOutConfig] = useState<FogOutTextConfig>(DEFAULT_FOG_OUT_TEXT_CONFIG);
  const [barrageTextConfig, setBarrageTextConfig] = useState<BarrageTextConfig>(DEFAULT_BARRAGE_TEXT_CONFIG);
  const [doubleCutConfig, setDoubleCutConfig] = useState<DoubleCutTextConfig>(DEFAULT_DOUBLE_CUT_TEXT_CONFIG);
  const [frostConfig, setFrostConfig] = useState<FrostTextConfig>(DEFAULT_FROST_TEXT_CONFIG);
  const [comboPunchConfig, setComboPunchConfig] = useState<ComboPunchTextConfig>(DEFAULT_COMBO_PUNCH_TEXT_CONFIG);
  const [petrifiedConfig, setPetrifiedConfig] = useState<PetrifiedTextConfig>(DEFAULT_PETRIFIED_TEXT_CONFIG);
  const [thanosDismantleConfig, setThanosDismantleConfig] = useState<ThanosDismantleTextConfig>(DEFAULT_THANOS_DISMANTLE_TEXT_CONFIG);
  
  const [userPresets, setUserPresets] = useState<Record<string, { baseId: TextEffectId, config: any }>>({});
  const [activePresetName, setActivePresetName] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [hasSelectedBaseEffect, setHasSelectedBaseEffect] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('exploritaire_text_presets');
    if (saved) {
      try { setUserPresets(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  const savePreset = () => {
    if (!saveName) return;
    const currentConfig = selectedBaseId === 'disassembled' ? disassembledConfig :
                        selectedBaseId === 'float_away' ? floatAwayConfig :
                        selectedBaseId === 'shimmer' ? shimmerConfig :
                        selectedBaseId === 'fog_out' ? fogOutConfig :
                        selectedBaseId === 'barrage_text' ? barrageTextConfig :
                        selectedBaseId === 'double_cut' ? doubleCutConfig :
                        selectedBaseId === 'frost' ? frostConfig :
                        selectedBaseId === 'combo_punch' ? comboPunchConfig :
                        selectedBaseId === 'petrified' ? petrifiedConfig :
                        selectedBaseId === 'thanos_dismantle' ? thanosDismantleConfig : null;
    const nextPresets = { ...userPresets, [saveName]: { baseId: selectedBaseId, config: currentConfig } };
    setUserPresets(nextPresets);
    localStorage.setItem('exploritaire_text_presets', JSON.stringify(nextPresets));
    setActivePresetName(saveName);
    setSaveName('');
  };

  const loadPreset = (name: string) => {
    const preset = userPresets[name];
    if (preset) {
      setSelectedBaseId(preset.baseId);
      if (preset.baseId === 'disassembled') setDisassembledConfig(preset.config);
      if (preset.baseId === 'float_away') setFloatAwayConfig(preset.config);
      if (preset.baseId === 'shimmer') setShimmerConfig(preset.config);
      if (preset.baseId === 'fog_out') setFogOutConfig(preset.config);
      if (preset.baseId === 'barrage_text') setBarrageTextConfig(preset.config);
      if (preset.baseId === 'double_cut') setDoubleCutConfig(preset.config);
      if (preset.baseId === 'frost') setFrostConfig(preset.config);
      if (preset.baseId === 'combo_punch') setComboPunchConfig(preset.config);
      if (preset.baseId === 'petrified') setPetrifiedConfig(preset.config);
      if (preset.baseId === 'thanos_dismantle') setThanosDismantleConfig(preset.config);
      setActivePresetName(name);
    }
  };

  const deletePreset = (name: string) => {
    const nextPresets = { ...userPresets };
    delete nextPresets[name];
    setUserPresets(nextPresets);
    localStorage.setItem('exploritaire_text_presets', JSON.stringify(nextPresets));
    if (activePresetName === name) setActivePresetName(null);
  };

  const resetToDefault = () => {
    if (selectedBaseId === 'disassembled') setDisassembledConfig(DEFAULT_DISASSEMBLED_TEXT_CONFIG);
    if (selectedBaseId === 'float_away') setFloatAwayConfig(DEFAULT_FLOAT_AWAY_TEXT_CONFIG);
    if (selectedBaseId === 'shimmer') setShimmerConfig(DEFAULT_SHIMMER_TEXT_CONFIG);
    if (selectedBaseId === 'fog_out') setFogOutConfig(DEFAULT_FOG_OUT_TEXT_CONFIG);
    if (selectedBaseId === 'barrage_text') setBarrageTextConfig(DEFAULT_BARRAGE_TEXT_CONFIG);
    if (selectedBaseId === 'double_cut') setDoubleCutConfig(DEFAULT_DOUBLE_CUT_TEXT_CONFIG);
    if (selectedBaseId === 'frost') setFrostConfig(DEFAULT_FROST_TEXT_CONFIG);
    if (selectedBaseId === 'combo_punch') setComboPunchConfig(DEFAULT_COMBO_PUNCH_TEXT_CONFIG);
    if (selectedBaseId === 'petrified') setPetrifiedConfig(DEFAULT_PETRIFIED_TEXT_CONFIG);
    if (selectedBaseId === 'thanos_dismantle') setThanosDismantleConfig(DEFAULT_THANOS_DISMANTLE_TEXT_CONFIG);
    setActivePresetName(null);
  };

  const renderPreview = () => {
    switch (selectedBaseId) {
      case 'disassembled': return <DisassembledTextEffect config={disassembledConfig} />;
      case 'float_away': return <FloatAwayTextEffect config={floatAwayConfig} />;
      case 'shimmer': return <ShimmerTextEffect config={shimmerConfig} />;
      case 'fog_out': return <FogOutTextEffect config={fogOutConfig} />;
      case 'barrage_text': return <BarrageTextEffect config={barrageTextConfig} />;
      case 'double_cut': return <DoubleCutTextEffect config={doubleCutConfig} />;
      case 'frost': return <FrostTextEffect config={frostConfig} />;
      case 'combo_punch': return <ComboPunchTextEffect config={comboPunchConfig} />;
      case 'petrified': return <PetrifiedTextEffect config={petrifiedConfig} />;
      case 'thanos_dismantle': return <ThanosDismantleTextEffect config={thanosDismantleConfig} />;
      default: return <div className="flex items-center justify-center h-full text-game-white/20">No preview available</div>;
    }
  };

  return (
    <div className="flex h-full gap-4 overflow-hidden relative">
      <CollapsibleSidebar side="left" collapsed={leftCollapsed} setCollapsed={setLeftCollapsed} widthClass="w-40">
        <div className={`${hasSelectedBaseEffect ? 'h-4/5' : 'h-full'} min-h-0 flex flex-col gap-1`}>
          <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-game-teal/60">Base Effects</h3>
          <div className="flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto custom-scrollbar pr-2">
            {TEXT_PRESETS.map((p) => (
              <button key={p.id} onClick={() => { setSelectedBaseId(p.id); setActivePresetName(null); setHasSelectedBaseEffect(true); }} className={`text-[9px] font-mono text-left px-2 py-1 rounded border transition-all ${selectedBaseId === p.id ? 'border-game-gold text-game-gold bg-game-gold/5' : 'border-game-teal/20 text-game-white/40 hover:border-game-teal/40'}`}>{p.label}</button>
            ))}
          </div>
        </div>
        <div className={`${hasSelectedBaseEffect ? 'h-1/5' : 'hidden'} min-h-0 flex flex-col gap-2`}>
          <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-game-gold/60">Saved Presets</h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-1">
            {Object.keys(userPresets).length === 0 && <div className="text-[8px] text-game-white/30 italic px-2">No saved presets</div>}
            {Object.keys(userPresets).map((name) => (
              <div key={name} className="flex items-center gap-1 group">
                <button onClick={() => loadPreset(name)} className={`flex-1 text-[9px] font-mono text-left px-2 py-1 rounded border transition-all truncate ${activePresetName === name ? 'border-game-gold text-game-gold bg-game-gold/10' : 'border-game-teal/10 text-game-white/40 hover:border-game-teal/30 hover:text-game-white/60'}`}>{name}</button>
                <button onClick={() => deletePreset(name)} className="p-1 text-game-pink/40 hover:text-game-pink transition-colors">×</button>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-game-teal/10 space-y-2">
            <input type="text" placeholder="Name..." value={saveName} onChange={(e) => setSaveName(e.target.value)} className="w-full bg-black/40 border border-game-teal/20 rounded px-2 py-1 text-[9px] text-game-white font-mono focus:border-game-gold/50 outline-none" />
            <button onClick={savePreset} disabled={!saveName} className="w-full py-1 rounded border border-game-gold/40 text-game-gold text-[8px] font-black uppercase tracking-widest hover:bg-game-gold/10 disabled:opacity-30 transition-all">Save</button>
          </div>
        </div>
      </CollapsibleSidebar>

      <div className="flex-1 relative rounded-xl border border-game-teal/10 bg-black/40 overflow-hidden group">
        {renderPreview()}
        <div className="absolute top-4 left-4 pointer-events-none">
          <div className="px-2 py-1 rounded bg-black/60 border border-game-teal/20 text-[9px] text-game-teal font-mono uppercase tracking-widest">Preview: {activePresetName || selectedBaseId}</div>
        </div>
      </div>

      <CollapsibleSidebar side="right" collapsed={rightCollapsed} setCollapsed={setRightCollapsed} widthClass="w-56">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-game-teal/60">Config</h3>
          <button onClick={resetToDefault} className="text-[8px] text-game-gold/60 hover:text-game-gold uppercase font-bold tracking-tighter">Reset</button>
        </div>
        <div className="space-y-4 pb-8">
          {(selectedBaseId === 'disassembled' || selectedBaseId === 'float_away' || selectedBaseId === 'shimmer' || selectedBaseId === 'fog_out' || selectedBaseId === 'barrage_text' || selectedBaseId === 'double_cut' || selectedBaseId === 'frost' || selectedBaseId === 'combo_punch' || selectedBaseId === 'petrified' || selectedBaseId === 'thanos_dismantle') && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-game-white/60 uppercase font-mono block">Text String</label>
                <input type="text" value={selectedBaseId === 'disassembled' ? disassembledConfig.text : selectedBaseId === 'float_away' ? floatAwayConfig.text : selectedBaseId === 'shimmer' ? shimmerConfig.text : selectedBaseId === 'barrage_text' ? barrageTextConfig.text : selectedBaseId === 'double_cut' ? doubleCutConfig.text : selectedBaseId === 'frost' ? frostConfig.text : selectedBaseId === 'combo_punch' ? comboPunchConfig.text : selectedBaseId === 'petrified' ? petrifiedConfig.text : selectedBaseId === 'thanos_dismantle' ? thanosDismantleConfig.text : fogOutConfig.text} onChange={(e) => {
                  if (selectedBaseId === 'disassembled') setDisassembledConfig({ ...disassembledConfig, text: e.target.value });
                  if (selectedBaseId === 'float_away') setFloatAwayConfig({ ...floatAwayConfig, text: e.target.value });
                  if (selectedBaseId === 'shimmer') setShimmerConfig({ ...shimmerConfig, text: e.target.value });
                  if (selectedBaseId === 'fog_out') setFogOutConfig({ ...fogOutConfig, text: e.target.value });
                  if (selectedBaseId === 'barrage_text') setBarrageTextConfig({ ...barrageTextConfig, text: e.target.value });
                  if (selectedBaseId === 'double_cut') setDoubleCutConfig({ ...doubleCutConfig, text: e.target.value });
                  if (selectedBaseId === 'frost') setFrostConfig({ ...frostConfig, text: e.target.value });
                  if (selectedBaseId === 'combo_punch') setComboPunchConfig({ ...comboPunchConfig, text: e.target.value });
                  if (selectedBaseId === 'petrified') setPetrifiedConfig({ ...petrifiedConfig, text: e.target.value });
                  if (selectedBaseId === 'thanos_dismantle') setThanosDismantleConfig({ ...thanosDismantleConfig, text: e.target.value });
                }} className="w-full bg-black/40 border border-game-teal/20 rounded px-2 py-1 text-[9px] text-game-white outline-none focus:border-game-gold/50 font-mono" />
              </div>
              {selectedBaseId === 'petrified' && (
                <>
                  <ConfigSlider label="Duration" value={petrifiedConfig.duration} min={1} max={30} step={0.1} onChange={(v) => setPetrifiedConfig({ ...petrifiedConfig, duration: v })} />
                  <ConfigColorPicker label="Text" value={petrifiedConfig.textColor} onChange={(v) => setPetrifiedConfig({ ...petrifiedConfig, textColor: v })} />
                  <ConfigColorPicker label="BG" value={petrifiedConfig.backgroundColor} onChange={(v) => setPetrifiedConfig({ ...petrifiedConfig, backgroundColor: v })} />
                </>
              )}
              {selectedBaseId === 'combo_punch' && (
                <ConfigSlider label="Bop Duration" value={comboPunchConfig.duration} min={0.2} max={4} step={0.1} onChange={(v) => setComboPunchConfig({ ...comboPunchConfig, duration: v })} />
              )}
              {selectedBaseId === 'thanos_dismantle' && (
                <>
                  <ConfigSlider label="Duration" value={thanosDismantleConfig.duration} min={1} max={12} step={0.1} onChange={(v) => setThanosDismantleConfig({ ...thanosDismantleConfig, duration: v })} />
                  <ConfigSlider label="Particles" value={thanosDismantleConfig.particleCount} min={300} max={7000} step={100} onChange={(v) => setThanosDismantleConfig({ ...thanosDismantleConfig, particleCount: Math.round(v) })} />
                  <ConfigSlider label="Size (px)" value={parseInt(thanosDismantleConfig.fontSize)} min={24} max={180} step={1} onChange={(v) => setThanosDismantleConfig({ ...thanosDismantleConfig, fontSize: `${Math.round(v)}px` })} />
                  <ConfigColorPicker label="Color" value={thanosDismantleConfig.color} onChange={(v) => setThanosDismantleConfig({ ...thanosDismantleConfig, color: v })} />
                </>
              )}
              {selectedBaseId === 'frost' && (
                <ConfigSlider label="Duration" value={frostConfig.duration} min={1} max={20} step={0.1} onChange={(v) => setFrostConfig({ ...frostConfig, duration: v })} />
              )}
              {selectedBaseId === 'double_cut' && (
                <>
                  <ConfigSlider label="Duration" value={doubleCutConfig.animationDuration} min={0.5} max={10} step={0.1} onChange={(v) => setDoubleCutConfig({ ...doubleCutConfig, animationDuration: v })} />
                  <ConfigColorPicker label="Color" value={doubleCutConfig.color} onChange={(v) => setDoubleCutConfig({ ...doubleCutConfig, color: v })} />
                  <ConfigColorPicker label="Glow" value={doubleCutConfig.glowColor} onChange={(v) => setDoubleCutConfig({ ...doubleCutConfig, glowColor: v })} />
                </>
              )}
              {selectedBaseId === 'shimmer' && (
                <>
                  <ConfigSlider label="Duration" value={shimmerConfig.duration} min={0.5} max={10} step={0.1} onChange={(v) => setShimmerConfig({ ...shimmerConfig, duration: v })} />
                  <ConfigColorPicker label="Base" value={shimmerConfig.baseColor} onChange={(v) => setShimmerConfig({ ...shimmerConfig, baseColor: v })} />
                  <ConfigColorPicker label="Glow" value={shimmerConfig.glowColor} onChange={(v) => setShimmerConfig({ ...shimmerConfig, glowColor: v })} />
                </>
              )}
              {selectedBaseId === 'fog_out' && (
                <>
                  <ConfigSlider label="Duration" value={fogOutConfig.duration} min={0.5} max={10} step={0.1} onChange={(v) => setFogOutConfig({ ...fogOutConfig, duration: v })} />
                  <ConfigSlider label="Font Size" value={parseInt(fogOutConfig.fontSize)} min={8} max={120} step={1} onChange={(v) => setFogOutConfig({ ...fogOutConfig, fontSize: `${v}px` })} />
                  <ConfigSlider label="Blur" value={parseInt(fogOutConfig.blurSize)} min={0} max={100} step={1} onChange={(v) => setFogOutConfig({ ...fogOutConfig, blurSize: `${v}px` })} />
                  <ConfigColorPicker label="Color" value={fogOutConfig.color} onChange={(v) => setFogOutConfig({ ...fogOutConfig, color: v })} />
                </>
              )}
              {selectedBaseId === 'barrage_text' && (
                <>
                  <ConfigSlider label="Size" value={parseFloat(barrageTextConfig.fontSize)} min={1} max={10} step={0.5} onChange={(v) => setBarrageTextConfig({ ...barrageTextConfig, fontSize: `${v}rem` })} />
                  <ConfigSlider label="Delay" value={barrageTextConfig.repeatDelay} min={0} max={10} step={0.5} onChange={(v) => setBarrageTextConfig({ ...barrageTextConfig, repeatDelay: v })} />
                  <ConfigColorPicker label="Color" value={barrageTextConfig.color} onChange={(v) => setBarrageTextConfig({ ...barrageTextConfig, color: v })} />
                </>
              )}
            </div>
          )}
        </div>
      </CollapsibleSidebar>
    </div>
  );
});

type ParallaxZoomConfig = { 
  range: number; 
  bgrScaleOpen: number; 
  logoScaleOpen: number; 
  fgrScaleOpen: number; 
  bgrScaleClosed: number; 
  logoScaleClosed: number; 
  fgrScaleClosed: number; 
};

const DEFAULT_PARALLAX_ZOOM_CONFIG: ParallaxZoomConfig = { 
  range: 60, 
  bgrScaleOpen: 1.0, 
  logoScaleOpen: 1.05, 
  fgrScaleOpen: 1.2, 
  bgrScaleClosed: 1.2, 
  logoScaleClosed: 1.0, 
  fgrScaleClosed: 0.9 
};

const CardDepthEffectsDemo = memo(function CardDepthEffectsDemo({ 
  leftCollapsed, setLeftCollapsed, 
  rightCollapsed, setRightCollapsed 
}: SubEditorProps) {
  const [activeSubsubtab, setActiveSubsubtab] = useState<'riseAndTilt' | 'parallaxZoom' | 'depthPerspectiveShift' | 'depth3DShift'>('riseAndTilt');
  const [parallaxConfig, setParallaxConfig] = useState<ParallaxZoomConfig>(DEFAULT_PARALLAX_ZOOM_CONFIG);
  const [depth3DConfig, setDepth3DConfig] = useState<Depth3DShiftConfig>(DEFAULT_DEPTH_3D_SHIFT_CONFIG);

  const RISE_AND_TILT_CARDS = [
    { id: 'dark-rider', cover: 'https://ggayane.github.io/css-experiments/cards/dark_rider-cover.jpg', title: 'https://ggayane.github.io/css-experiments/cards/dark_rider-title.png', character: 'https://ggayane.github.io/css-experiments/cards/dark_rider-character.webp' },
    { id: 'force-mage', cover: 'https://ggayane.github.io/css-experiments/cards/force_mage-cover.jpg', title: 'https://ggayane.github.io/css-experiments/cards/force_mage-title.png', character: 'https://ggayane.github.io/css-experiments/cards/force_mage-character.webp' }
  ];

  const RiseAndTiltCard = ({ card }: { card: any }) => (
    <div className="rise-and-tilt-card relative w-[200px] h-[300px] perspective-[1000px] group/tilt">
      <style>{`
        .rise-and-tilt-wrapper { transition: all 0.5s ease; transform-style: preserve-3d; border-radius: 12px; overflow: hidden; }
        .group\\/tilt:hover .rise-and-tilt-wrapper { transform: perspective(900px) translateY(-5%) rotateX(25deg) translateZ(0); box-shadow: 2px 35px 32px -8px rgba(0, 0, 0, 0.75); }
        .rise-and-tilt-title { width: 80%; transition: transform 0.5s; transform-style: preserve-3d; position: absolute; bottom: 40px; left: 10%; pointer-events: none; }
        .group\\/tilt:hover .rise-and-tilt-title { transform: translate3d(0, -20px, 40px); }
        .rise-and-tilt-character { width: 100%; opacity: 0; transition: all 0.5s; position: absolute; z-index: 5; left: 0; bottom: 0; pointer-events: none; }
        .group\\/tilt:hover .rise-and-tilt-character { opacity: 1; transform: translate3d(0, -10%, 60px); }
      `}</style>
      <div className="rise-and-tilt-wrapper h-full"><img src={card.cover} className="w-full h-full object-cover" alt="" /></div>
      <img src={card.title} className="rise-and-tilt-title" alt="" />
      <img src={card.character} className="rise-and-tilt-character" alt="" />
    </div>
  );

  const PARALLAX_ZOOM_GAMES = ['spirit', 'mw', 'ddw', 'id'];
  const ParallaxZoomCard = ({ config }: { config: ParallaxZoomConfig }) => {
    const [currentGameIdx, setCurrentGameIdx] = useState(0);
    const [applyParallax, setApplyParallax] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const game = PARALLAX_ZOOM_GAMES[currentGameIdx];
    const assetBgr = `https://assets.codepen.io/264161/${game}-background.jpg`;
    const assetFgr = `https://assets.codepen.io/264161/${game}-foreground.png`;
    const assetLogo = `https://assets.codepen.io/264161/${game}-logo.png`;
    const calcValue = (val: number, dimension: number) => (((val * 100) / dimension) * (config.range / 100) - (config.range / 2)).toFixed(1);
    const xValue = applyParallax ? parseFloat(calcValue(mousePos.x, window.innerWidth)) : 0;
    const yValue = applyParallax ? parseFloat(calcValue(mousePos.y, window.innerHeight)) : 0;
    return (
      <div className="parallax-zoom-card" onMouseEnter={() => setApplyParallax(true)} onMouseLeave={() => setApplyParallax(false)} onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })} onClick={() => setCurrentGameIdx((currentGameIdx + 1) % PARALLAX_ZOOM_GAMES.length)}
        style={{ width: 280, height: 440, position: 'relative', transformStyle: 'preserve-3d', transform: `rotateX(${yValue}deg) rotateY(${xValue}deg)`, transition: 'transform 0.2s ease-out', cursor: 'pointer', perspective: '1800px' }}
      >
        <div style={{ position: 'absolute', inset: '20px', overflow: 'hidden', borderRadius: 12 }}>
          <div style={{ position: 'absolute', inset: '-20px', backgroundImage: `url(${assetBgr})`, backgroundSize: 'cover', backgroundPosition: `${-xValue}px ${yValue}px`, transform: `scale(${applyParallax ? config.bgrScaleOpen : config.bgrScaleClosed})`, transition: 'transform 0.2s ease-out' }} />
        </div>
        <img src={assetLogo} alt="" style={{ position: 'absolute', inset: 0, transform: `translateX(${xValue}px) translateY(${-yValue}px) scale(${applyParallax ? config.logoScaleOpen : config.logoScaleClosed})`, transition: 'transform 0.2s ease-out', pointerEvents: 'none' }} />
        <img src={assetFgr} alt="" style={{ position: 'absolute', inset: 0, transform: `translateX(${xValue * 1.5}px) translateY(${-yValue * 1.5}px) scale(${applyParallax ? config.fgrScaleOpen : config.fgrScaleClosed})`, transition: 'transform 0.2s ease-out', pointerEvents: 'none' }} />
      </div>
    );
  };

  return (
    <div className="flex h-full gap-4 overflow-hidden relative">
      <CollapsibleSidebar side="left" collapsed={leftCollapsed} setCollapsed={setLeftCollapsed} widthClass="w-40">
        <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-game-teal/60">Depth Effects</h3>
        <div className="flex flex-col gap-1">
          {(['riseAndTilt', 'parallaxZoom', 'depthPerspectiveShift', 'depth3DShift'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveSubsubtab(tab)} className={`text-[9px] font-mono text-left px-2 py-1 rounded border transition-all ${activeSubsubtab === tab ? 'border-game-gold text-game-gold bg-game-gold/5' : 'border-game-teal/20 text-game-white/40 hover:border-game-teal/40'}`}>
              {({ riseAndTilt: 'Rise & Tilt', parallaxZoom: 'Parallax Zoom', depthPerspectiveShift: 'Perspective', depth3DShift: '3D Shift' } as const)[tab]}
            </button>
          ))}
        </div>
      </CollapsibleSidebar>

      <div className="flex-1 relative rounded-xl border border-game-teal/10 bg-black/40 overflow-hidden flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
          {activeSubsubtab === 'riseAndTilt' && <div className="flex gap-10">{RISE_AND_TILT_CARDS.map(card => <RiseAndTiltCard key={card.id} card={card} />)}</div>}
          {activeSubsubtab === 'parallaxZoom' && <div style={{ transform: 'scale(0.8)' }}><ParallaxZoomCard config={parallaxConfig} /></div>}
          {activeSubsubtab === 'depthPerspectiveShift' && (
            <div className="w-full h-full flex items-center justify-center origin-center" style={{ transform: 'scale(0.8)' }}>
              <DepthPerspectiveShiftDemo />
            </div>
          )}
          {activeSubsubtab === 'depth3DShift' && <Depth3DShiftDemo config={depth3DConfig} />}
        </div>
      </div>

      {(activeSubsubtab === 'parallaxZoom' || activeSubsubtab === 'depth3DShift') && (
        <CollapsibleSidebar side="right" collapsed={rightCollapsed} setCollapsed={setRightCollapsed} widthClass="w-56">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-game-teal/60">Config</h3>
            <button onClick={() => activeSubsubtab === 'parallaxZoom' ? setParallaxConfig(DEFAULT_PARALLAX_ZOOM_CONFIG) : setDepth3DConfig(DEFAULT_DEPTH_3D_SHIFT_CONFIG)} className="text-[8px] text-game-gold/60 hover:text-game-gold uppercase font-bold tracking-tighter">Reset</button>
          </div>
          {activeSubsubtab === 'parallaxZoom' && (
            <div className="space-y-4 pb-8">
              <ConfigSlider label="Range" value={parallaxConfig.range} min={0} max={200} step={1} onChange={v => setParallaxConfig({ ...parallaxConfig, range: v })} />
              <ConfigSlider label="BG Scale" value={parallaxConfig.bgrScaleOpen} min={0.5} max={2} step={0.01} onChange={v => setParallaxConfig({ ...parallaxConfig, bgrScaleOpen: v })} />
            </div>
          )}
          {activeSubsubtab === 'depth3DShift' && (
            <div className="space-y-4 pb-8">
              <div className="space-y-1">
                <label className="text-[9px] text-game-white/60 uppercase font-mono block">Source</label>
                <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {[{ id: 'stars', label: 'stars' }, ...ATMOSPHERE_PRESETS].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDepth3DConfig({ ...depth3DConfig, backgroundType: option.id as Depth3DShiftConfig['backgroundType'] })}
                      className={`text-[8px] font-mono text-left px-1.5 py-1 rounded border transition-all truncate ${depth3DConfig.backgroundType === option.id ? 'border-game-gold text-game-gold bg-game-gold/10' : 'border-game-teal/20 text-game-white/50 hover:border-game-teal/40'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <ConfigSlider label="Tilt X" value={depth3DConfig.cardTiltXDeg} min={0} max={35} step={0.5} onChange={(v) => setDepth3DConfig({ ...depth3DConfig, cardTiltXDeg: v })} />
              <ConfigSlider label="Tilt Y" value={depth3DConfig.cardTiltYDeg} min={0} max={35} step={0.5} onChange={(v) => setDepth3DConfig({ ...depth3DConfig, cardTiltYDeg: v })} />
              <ConfigSlider label="Orbit R" value={depth3DConfig.orbitRadius} min={0} max={15} step={0.1} onChange={(v) => setDepth3DConfig({ ...depth3DConfig, orbitRadius: v })} />
              <ConfigSlider label="Parallax" value={depth3DConfig.contentParallaxX} min={0} max={0.08} step={0.001} onChange={(v) => setDepth3DConfig({ ...depth3DConfig, contentParallaxX: v, contentParallaxY: v })} />
            </div>
          )}
        </CollapsibleSidebar>
      )}
    </div>
  );
});

const SimpleFlipDemo = memo(function SimpleFlipDemo() {
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());
  const [speed, setSpeed] = useState(700);
  const FLIP_DEMO_CARDS = [
    { id: 'fire',  symbol: 'F', label: 'Fire',  rank: 'K',  colorA: '#7a1c0a', colorB: '#c0392b', glow: '#ff4500' },
    { id: 'water', symbol: 'W', label: 'Water', rank: 'Q',  colorA: '#0d2d4a', colorB: '#1a6fa0', glow: '#00bfff' },
    { id: 'earth', symbol: 'E', label: 'Earth', rank: 'J',  colorA: '#0d3320', colorB: '#1e7a40', glow: '#00c850' },
    { id: 'air',   symbol: 'A', label: 'Air',   rank: '10', colorA: '#1c2b3a', colorB: '#4a7fa0', glow: '#87ceeb' },
    { id: 'light', symbol: 'L', label: 'Light', rank: 'A',  colorA: '#4a3800', colorB: '#a07800', glow: '#ffd700' },
    { id: 'dark',  symbol: 'D', label: 'Dark',  rank: '9',  colorA: '#1a0a2a', colorB: '#4a1e6e', glow: '#9b59b6' },
  ];

  const FlipDemoCard = memo(function FlipDemoCard({ isFlipped, card, speed, onFlip }: { isFlipped: boolean, card: any, speed: number, onFlip: any }) {
    return (
      <button onClick={onFlip} style={{ width: 120, height: 180, perspective: '1000px', background: 'none', border: 'none', padding: 0 }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', transition: `transform ${speed}ms`, transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 12, background: `linear-gradient(145deg, ${card.colorA}, ${card.colorB})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 32, color: card.glow }}>{card.symbol}</span>
          </div>
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 12, transform: 'rotateY(180deg)', background: '#111', border: '1px solid #333' }} />
        </div>
      </button>
    );
  });

  return (
    <div className="h-full overflow-y-auto pr-4 custom-scrollbar pb-10 p-8 space-y-8">
      <div className="flex items-center gap-6">
        <button onClick={() => setFlippedIds(flippedIds.size === FLIP_DEMO_CARDS.length ? new Set() : new Set(FLIP_DEMO_CARDS.map(c => c.id)))} className="px-4 py-1.5 rounded-lg border border-game-gold text-[9px] text-game-gold font-black uppercase tracking-widest hover:bg-game-gold/10 transition-all">{flippedIds.size === FLIP_DEMO_CARDS.length ? '↩ Unflip All' : '↻ Flip All'}</button>
        <ConfigSlider label="Speed" value={speed} min={200} max={1400} step={100} onChange={v => setSpeed(v)} />
      </div>
      <div className="flex flex-wrap gap-8 items-end justify-center">
        {FLIP_DEMO_CARDS.map((card) => (
          <div key={card.id} className="flex flex-col items-center gap-3">
            <FlipDemoCard card={card} isFlipped={flippedIds.has(card.id)} speed={speed} onFlip={() => { const n = new Set(flippedIds); if (n.has(card.id)) n.delete(card.id); else n.add(card.id); setFlippedIds(n); }} />
            <div className="text-[9px] uppercase font-bold text-game-gold/80">{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

const FlipEffectsEditor = memo(function FlipEffectsEditor() {
  const [activeSubsubtab, setActiveSubsubtab] = useState<'simple' | 'midair'>('simple');
  return (
    <div className="flex h-full gap-4 overflow-hidden relative">
      <div className="w-40 shrink-0 border-r border-game-teal/10 flex flex-col gap-4 pr-3">
        <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-game-teal/60">Flip Animations</h3>
        <div className="flex flex-col gap-1">
          <button onClick={() => setActiveSubsubtab('simple')} className={`text-[9px] font-mono text-left px-2 py-1 rounded border transition-all ${activeSubsubtab === 'simple' ? 'border-game-gold text-game-gold bg-game-gold/5' : 'border-game-teal/20 text-game-white/40 hover:border-game-teal/40'}`}>Simple Flip</button>
          <button onClick={() => setActiveSubsubtab('midair')} className={`text-[9px] font-mono text-left px-2 py-1 rounded border transition-all ${activeSubsubtab === 'midair' ? 'border-game-gold text-game-gold bg-game-gold/5' : 'border-game-teal/20 text-game-white/40 hover:border-game-teal/40'}`}>Midair Table</button>
        </div>
      </div>
      <div className="flex-1 relative rounded-xl border border-game-teal/10 bg-black/40 overflow-hidden">{activeSubsubtab === 'simple' ? <SimpleFlipDemo /> : <MidairFlipDemo />}</div>
    </div>
  );
});

const ElectricityNodeEffect = memo(function ElectricityNodeEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);
    const center = { x: width * 0.5, y: height * 0.5 };
    const mouse = { x: center.x, y: center.y };

    type BoltEntry = {
      segments: { x: number; y: number }[];
      life: number;
      ttl: number;
    };

    const bolts: BoltEntry[] = [];

    const createBolt = (x1: number, y1: number, x2: number, y2: number, jitterScale: number) => {
      const segments: { x: number; y: number }[] = [{ x: x1, y: y1 }];
      const distance = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(6, Math.floor(distance / 12));
      for (let i = 1; i < steps; i += 1) {
        const t = i / steps;
        const nx = x1 + (x2 - x1) * t;
        const ny = y1 + (y2 - y1) * t;
        const jitter = (1 - Math.abs(0.5 - t) * 1.7) * jitterScale;
        segments.push({
          x: nx + (Math.random() - 0.5) * jitter,
          y: ny + (Math.random() - 0.5) * jitter,
        });
      }
      segments.push({ x: x2, y: y2 });
      bolts.push({
        segments,
        life: 0,
        ttl: 9 + Math.floor(Math.random() * 4),
      });
    };

    const emitClickBolts = () => {
      const count = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i += 1) {
        createBolt(center.x, center.y, mouse.x, mouse.y, 28 + Math.random() * 14);
      }
    };

    const drawBolt = (segments: { x: number; y: number }[], alpha: number) => {
      ctx.beginPath();
      ctx.moveTo(segments[0].x, segments[0].y);
      for (let i = 1; i < segments.length; i += 1) ctx.lineTo(segments[i].x, segments[i].y);
      ctx.strokeStyle = `rgba(165,215,255,${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = 'rgba(165,215,255,0.9)';
      ctx.shadowBlur = 16;
      ctx.stroke();
    };

    const animate = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, width, height);

      for (let i = bolts.length - 1; i >= 0; i -= 1) {
        const bolt = bolts[i];
        bolt.life += 1;
        const alpha = Math.max(0, (bolt.ttl - bolt.life) / bolt.ttl);
        if (alpha <= 0) {
          bolts.splice(i, 1);
          continue;
        }
        drawBolt(bolt.segments, alpha);
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(center.x, center.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,200,200,0.95)';
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(230,230,230,0.8)';
      ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(animate);
    };

    animate();

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    };
    const handleClick = () => {
      emitClickBolts();
    };
    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      center.x = width * 0.5;
      center.y = height * 0.5;
      mouse.x = center.x;
      mouse.y = center.y;
    };
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="w-full h-full bg-black/80 flex items-center justify-center p-12">
      <div className="relative w-full h-full border border-game-teal/20 rounded-xl overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full cursor-pointer" />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: electricity_node</div>
        </div>
      </div>
    </div>
  );
});

class SimplexNoiseLite {
  noise4D(x: number, y: number, z: number, w: number) {
    const s1 = Math.sin(x * 1.7 + y * 1.1 + z * 0.9 + w * 1.3);
    const s2 = Math.sin(x * 3.1 - y * 2.3 + z * 1.9 - w * 1.7);
    const s3 = Math.sin(-x * 2.4 + y * 1.8 - z * 2.7 + w * 2.1);
    return (s1 + s2 * 0.5 + s3 * 0.25) / 1.75;
  }
}

const SiphonShapeEffect = memo(function SiphonShapeEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const visibleCanvas = canvasRef.current;
    if (!visibleCanvas) return;
    const visibleCtx = visibleCanvas.getContext('2d');
    if (!visibleCtx) return;

    const offscreenA = document.createElement('canvas');
    const offscreenB = document.createElement('canvas');
    const ctxA = offscreenA.getContext('2d');
    const ctxB = offscreenB.getContext('2d');
    if (!ctxA || !ctxB) return;

    const particleCount = 500;
    const particlePropCount = 10;
    const particlePropsLength = particleCount * particlePropCount;
    const rangeZ = 100;
    const baseTTL = 50;
    const rangeTTL = 200;
    const baseHue = Math.random() * 360;
    const rangeHue = 100;
    const xOff = 0.0005;
    const yOff = 0.0015;
    const zOff = 0.0005;
    const tOff = 0.0015;
    const backgroundColor = `hsla(${baseHue},10%,5%,1)`;
    const backdropColor = 'hsla(0,0%,0%,1)';
    const TAU = Math.PI * 2;
    const PI = Math.PI;

    const rand = (n: number) => Math.random() * n;
    const randRange = (n: number) => (Math.random() - 0.5) * 2 * n;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const fadeInOut = (life: number, ttl: number) => {
      const p = life / ttl;
      return p < 0.5 ? p * 2 : (1 - p) * 2;
    };
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const vmin = (v: number) => (Math.min(window.innerWidth, window.innerHeight) * v) / 100;

    const center = [0, 0] as [number, number];
    const simplex = new SimplexNoiseLite();
    const particleProps = new Float32Array(particlePropsLength);

    let tick = 0;
    let raf = 0;
    let backdropSize = vmin(40);

    const syncVisibleFromB = () => {
      visibleCtx.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);
      visibleCtx.drawImage(offscreenB, 0, 0);
    };

    const initParticle = (i: number) => {
      const t = rand(TAU);
      const x = center[0] + randRange(0.5 * backdropSize) * Math.cos(t);
      const y = center[1] + randRange(0.5 * backdropSize) * Math.sin(t);
      const z = rand(rangeZ);
      const vx = 0;
      const vy = 0;
      const vz = 0;
      const life = 0;
      const ttl = baseTTL + rand(rangeTTL);
      const speed = 0;
      const hue = baseHue + rand(rangeHue);
      particleProps.set([x, y, z, vx, vy, vz, life, ttl, speed, hue], i);
    };

    const checkBounds = (x: number, y: number) => x > offscreenA.width || x < 0 || y > offscreenA.height || y < 0;

    const drawParticle = (x: number, y: number, z: number, life: number, ttl: number, size: number, n: number, hue: number) => {
      ctxA.save();
      ctxA.translate(x, y);
      ctxA.rotate(n * TAU);
      ctxA.translate(-x, -y);
      ctxA.strokeStyle = `hsla(${hue + clamp(z, 0, 180)},${clamp(z, 10, 100)}%,${clamp(z, 20, 60)}%,${fadeInOut(life, ttl)})`;
      ctxA.strokeRect(x, y, size, size);
      ctxA.restore();
    };

    const drawParticles = () => {
      for (let i = 0; i < particlePropsLength; i += particlePropCount) {
        const i2 = i + 1;
        const i3 = i + 2;
        const i4 = i + 3;
        const i5 = i + 4;
        const i6 = i + 5;
        const i7 = i + 6;
        const i8 = i + 7;
        const i9 = i + 8;

        const x = particleProps[i];
        const y = particleProps[i2];
        const z = particleProps[i3];
        const n = simplex.noise4D(x * xOff, y * yOff, z * zOff, tick * tOff);

        const theta = n * TAU;
        const phi = (1 - n) * TAU;
        const vx = lerp(particleProps[i4], Math.cos(theta) * Math.cos(phi), 0.05);
        const vy = lerp(particleProps[i5], Math.sin(phi), 0.05);
        const vz = lerp(particleProps[i6], Math.sin(theta) * Math.cos(phi), 0.1);
        const life = particleProps[i7];
        const ttl = particleProps[i8];
        const speed = particleProps[i9];
        const x2 = x + vx * speed;
        const y2 = y + vy * speed;
        const z2 = z + vz * speed;
        const size = z2 * 0.1;
        const speed2 = lerp(particleProps[i9], size * 0.5, 0.9);
        const hue = baseHue + (n * rangeHue);

        drawParticle(x, y, z, life, ttl, size, n, hue);

        const nextLife = life + 1;
        particleProps[i] = x2;
        particleProps[i2] = y2;
        particleProps[i3] = z2;
        particleProps[i4] = vx;
        particleProps[i5] = vy;
        particleProps[i6] = vz;
        particleProps[i7] = nextLife;
        particleProps[i9] = speed2;

        if (checkBounds(x2, y2) || nextLife > ttl) initParticle(i);
      }
    };

    const drawBackground = () => {
      ctxA.clearRect(0, 0, offscreenA.width, offscreenA.height);

      ctxB.save();
      ctxB.globalCompositeOperation = 'source-over';
      ctxB.fillStyle = backgroundColor;
      ctxB.fillRect(0, 0, offscreenB.width, offscreenB.height);
      ctxB.restore();

      ctxB.save();
      ctxB.shadowBlur = 20;
      ctxB.shadowColor = 'rgba(200,200,200,0.25)';
      ctxB.fillStyle = backdropColor;
      ctxB.translate(center[0], center[1]);
      ctxB.rotate(0.25 * PI);
      ctxB.fillRect(-0.5 * backdropSize, -0.5 * backdropSize, backdropSize, backdropSize);
      ctxB.restore();
    };

    const renderGlow = () => {
      ctxB.save();
      ctxB.filter = 'blur(8px) brightness(200%)';
      ctxB.globalCompositeOperation = 'lighter';
      ctxB.drawImage(offscreenA, 0, 0);
      ctxB.restore();

      ctxB.save();
      ctxB.filter = 'blur(4px) brightness(200%)';
      ctxB.globalCompositeOperation = 'lighter';
      ctxB.drawImage(offscreenA, 0, 0);
      ctxB.restore();
    };

    const renderToScreen = () => {
      ctxB.save();
      ctxB.globalCompositeOperation = 'lighter';
      ctxB.drawImage(offscreenA, 0, 0);
      ctxB.restore();
    };

    const resize = () => {
      const width = Math.max(1, visibleCanvas.offsetWidth);
      const height = Math.max(1, visibleCanvas.offsetHeight);
      visibleCanvas.width = width;
      visibleCanvas.height = height;
      offscreenA.width = width;
      offscreenA.height = height;
      offscreenB.width = width;
      offscreenB.height = height;
      center[0] = 0.5 * width;
      center[1] = 0.5 * height;
      backdropSize = vmin(40);
    };

    const draw = () => {
      tick += 1;
      drawBackground();
      drawParticles();
      renderGlow();
      renderToScreen();
      syncVisibleFromB();
      raf = requestAnimationFrame(draw);
    };

    resize();
    for (let i = 0; i < particlePropsLength; i += particlePropCount) {
      initParticle(i);
    }
    draw();

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="w-full h-full bg-black/80 flex items-center justify-center p-10">
      <div className="relative w-full h-full border border-game-teal/20 rounded-xl overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full" />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: siphon_shape</div>
        </div>
      </div>
    </div>
  );
});

const ActiveEffectsEditor = memo(function ActiveEffectsEditor({ 
  leftCollapsed, setLeftCollapsed, 
  rightCollapsed, setRightCollapsed 
}: SubEditorProps) {
  const [activeSubsubtab, setActiveSubsubtab] = useState<'electricity_node' | 'siphon_shape' | 'flower_generator' | 'protego_blast' | 'sparks_periculum' | 'spawn_navi' | 'localized_black_hole' | 'electron_painting' | 'cosmic_neutron_barrage' | 'god_rays'>('electricity_node');
  const [flowerConfig, setFlowerConfig] = useState<FlowerGeneratorConfig>(DEFAULT_FLOWER_GENERATOR_CONFIG);
  const [protegoConfig, setProtegoConfig] = useState<ProtegoBlastConfig>(DEFAULT_PROTEGO_BLAST_CONFIG);
  const [godRaysConfig, setGodRaysConfig] = useState<GodRaysConfig>(DEFAULT_GOD_RAYS_CONFIG);

  return (
    <div className="flex h-full gap-4 overflow-hidden relative">
      <CollapsibleSidebar side="left" collapsed={leftCollapsed} setCollapsed={setLeftCollapsed} widthClass="w-40">
        <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-game-teal/60">Active Effects</h3>
        <div className="flex flex-col gap-1">
          {['electricity_node', 'siphon_shape', 'flower_generator', 'protego_blast', 'sparks_periculum', 'spawn_navi', 'localized_black_hole', 'electron_painting', 'cosmic_neutron_barrage', 'god_rays'].map(id => (
            <button
              key={id}
              onClick={() => setActiveSubsubtab(id as any)}
              className={`text-[9px] font-mono text-left px-2 py-1 rounded border transition-all truncate ${activeSubsubtab === id ? 'border-game-gold text-game-gold bg-game-gold/5' : 'border-game-teal/20 text-game-white/40 hover:border-game-teal/40'}`}
            >
              {id}
            </button>
          ))}
        </div>
      </CollapsibleSidebar>

      <div className="flex-1 relative rounded-xl border border-game-teal/10 bg-black/40 overflow-hidden">
        {activeSubsubtab === 'electricity_node' && <ElectricityNodeEffect />}
        {activeSubsubtab === 'siphon_shape' && <SiphonShapeEffect />}
        {activeSubsubtab === 'flower_generator' && <FlowerGeneratorEffect config={flowerConfig} />}
        {activeSubsubtab === 'protego_blast' && <ProtegoBlastEffect config={protegoConfig} />}
        {activeSubsubtab === 'sparks_periculum' && <SparksPericulumEffect />}
        {activeSubsubtab === 'spawn_navi' && <SpawnNaviEffect />}
        {activeSubsubtab === 'localized_black_hole' && <LocalizedBlackHoleEffect />}
        {activeSubsubtab === 'electron_painting' && <ElectronPaintingEffect />}
        {activeSubsubtab === 'cosmic_neutron_barrage' && <CosmicNeutronBarrageEffect />}
        {activeSubsubtab === 'god_rays' && <GodRaysEffect config={godRaysConfig} />}
      </div>

      <CollapsibleSidebar side="right" collapsed={rightCollapsed} setCollapsed={setRightCollapsed} widthClass="w-56">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-game-teal/60">Config</h3>
          {(activeSubsubtab === 'flower_generator' || activeSubsubtab === 'protego_blast' || activeSubsubtab === 'god_rays') && (
            <button 
              onClick={() => {
                if (activeSubsubtab === 'flower_generator') setFlowerConfig(DEFAULT_FLOWER_GENERATOR_CONFIG);
                else if (activeSubsubtab === 'protego_blast') setProtegoConfig(DEFAULT_PROTEGO_BLAST_CONFIG);
                else if (activeSubsubtab === 'god_rays') setGodRaysConfig(DEFAULT_GOD_RAYS_CONFIG);
              }} 
              className="text-[8px] text-game-gold/60 hover:text-game-gold uppercase font-bold tracking-tighter"
            >
              Reset
            </button>
          )}
        </div>
        {activeSubsubtab === 'god_rays' && (
          <div className="space-y-4 pb-8">
            <ConfigSlider label="Ray Count" value={godRaysConfig.rayCount} min={0} max={500} step={10} onChange={(v) => setGodRaysConfig({ ...godRaysConfig, rayCount: Math.round(v) })} />
            <ConfigSlider label="Particles" value={godRaysConfig.particleCount} min={0} max={500} step={10} onChange={(v) => setGodRaysConfig({ ...godRaysConfig, particleCount: Math.round(v) })} />
          </div>
        )}
        {activeSubsubtab === 'protego_blast' && (
          <div className="space-y-4 pb-8">
            <ConfigSlider label="Density" value={protegoConfig.densityDissipation} min={0.9} max={0.999} step={0.001} onChange={(v) => setProtegoConfig({ ...protegoConfig, densityDissipation: v })} />
            <ConfigSlider label="Velocity" value={protegoConfig.velocityDissipation} min={0.9} max={0.999} step={0.001} onChange={(v) => setProtegoConfig({ ...protegoConfig, velocityDissipation: v })} />
            <ConfigSlider label="Pressure" value={protegoConfig.pressureDissipation} min={0.1} max={0.99} step={0.01} onChange={(v) => setProtegoConfig({ ...protegoConfig, pressureDissipation: v })} />
            <ConfigSlider label="Curl" value={protegoConfig.curl} min={0} max={100} step={1} onChange={(v) => setProtegoConfig({ ...protegoConfig, curl: v })} />
            <ConfigSlider label="Radius" value={protegoConfig.splatRadius} min={0.0001} max={0.02} step={0.0001} onChange={(v) => setProtegoConfig({ ...protegoConfig, splatRadius: v })} />
          </div>
        )}
        {activeSubsubtab === 'flower_generator' && (
          <div className="space-y-4 pb-8">
            <button
              onClick={() => setFlowerConfig((prev) => ({ ...prev, enableHoverTrail: !prev.enableHoverTrail }))}
              className={`w-full rounded border px-2 py-1 text-[9px] font-mono text-left transition-all ${flowerConfig.enableHoverTrail ? 'border-game-gold text-game-gold bg-game-gold/10' : 'border-game-teal/30 text-game-white/70 hover:border-game-teal/50'}`}
            >
              Trail: {flowerConfig.enableHoverTrail ? 'On' : 'Off'}
            </button>
            <ConfigSlider label="Scale" value={flowerConfig.flowerScale} min={0.35} max={2.5} step={0.01} onChange={(v) => setFlowerConfig((prev) => ({ ...prev, flowerScale: v }))} />
            <ConfigColorPicker label="Tint" value={flowerConfig.flowerTint} onChange={(v) => setFlowerConfig((prev) => ({ ...prev, flowerTint: v }))} />
          </div>
        )}
        {activeSubsubtab !== 'flower_generator' && activeSubsubtab !== 'protego_blast' && (
          <div className="text-[8px] text-game-white/35 font-mono italic">No controls yet.</div>
        )}
      </CollapsibleSidebar>
    </div>
  );
});

const TAB_CONFIG = [
  { id: 'holo', label: 'Holo' },
  { id: 'atmos', label: 'Atmos' },
  { id: 'text', label: 'Text' },
  { id: 'active', label: 'Active' },
  { id: 'depth', label: 'Depth' },
  { id: 'flip', label: 'Flip' },
  { id: 'liquid', label: 'Liquid' },
  { id: 'threejs', label: 'ThreeJS' },
  { id: 'paint', label: 'Paint' },
] as const;

type TabId = typeof TAB_CONFIG[number]['id'];

export const VisualsEditor = memo(function VisualsEditor({ 
  onHoloOverlayVisibleChange,
  onClose,
  fps = 0,
  serverAlive = true,
}: { 
  onHoloOverlayVisibleChange?: (visible: boolean) => void,
  onClose?: () => void,
  fps?: number,
  serverAlive?: boolean,
} = {}) {
  const [activeTab, setActiveTab] = useState<TabId>('holo');
  const [selectedHoloId, setSelectedHoloId] = useState('legacy-rainbow-foundation');
  const [overlayHoloInteractive, setOverlayHoloInteractive] = useState(true);
  const [revealType, setRevealType] = useState<'standard' | 'spin-zoom'>('standard');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width;
        // Automatically collapse if window is too small for sidebars
        if (width < 960) {
          setLeftCollapsed(true);
          setRightCollapsed(true);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    onHoloOverlayVisibleChange?.(overlayHoloInteractive);
    return () => {
      onHoloOverlayVisibleChange?.(false);
    };
  }, [overlayHoloInteractive, onHoloOverlayVisibleChange]);

  const presets = HOLO_EFFECT_PRESETS;
  const activePreset = presets.find((p) => p.id === selectedHoloId) || presets[0];

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.dispatchEvent(new CustomEvent('close-visuals-editor'));
    }
  };

  const subEditorProps: SubEditorProps = {
    leftCollapsed, setLeftCollapsed,
    rightCollapsed, setRightCollapsed
  };

  return createPortal(
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/90 backdrop-blur-md" style={{ visibility: 'visible' }}>
      <SVGFilters />
      <div ref={containerRef} className="relative w-[min(1320px,calc(100vw-1rem))] h-[min(920px,calc(100vh-1rem))] bg-[#0a0a0a] border border-game-teal/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-game-teal/20 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-game-white tracking-tighter flex items-center gap-2"><span className="text-game-teal">✦</span>VISUAL EFFECTS BROWSER</h2>
            <div className="h-4 w-[1px] bg-game-teal/20 mx-2" />
            <div className="flex gap-1">
              {TAB_CONFIG.map((tab) => (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)} 
                  className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-game-gold text-black shadow-[0_0_15px_rgba(230,179,30,0.3)]' : 'text-game-white/40 hover:text-game-white hover:bg-game-white/5'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FpsBadge
              fps={fps}
              className="rounded border border-game-teal/50 bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-game-gold"
              title={serverAlive ? 'Editor FPS' : 'Editor FPS (offline)'}
            />
            {!serverAlive && (
              <div className="rounded border border-game-pink/50 bg-black/70 px-2 py-1 text-[10px] tracking-[0.12em] text-game-pink">
                OFFLINE
              </div>
            )}
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full border border-game-pink/30 text-game-pink hover:bg-game-pink hover:text-white transition-all">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-4 min-h-0">
          {activeTab === 'holo' && (
            <div className="flex h-full gap-4 relative">
              <CollapsibleSidebar side="left" collapsed={leftCollapsed} setCollapsed={setLeftCollapsed} widthClass="w-40">
                <div className="space-y-1">
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-game-teal/60 mb-2">Presets</h3>
                  <div className="grid grid-cols-1 gap-1">
                    {presets.map((p) => (
                      <button key={p.id} onClick={() => setSelectedHoloId(p.id)} className={`text-[9px] font-mono text-left px-2 py-1 rounded border transition-all truncate ${selectedHoloId === p.id ? 'border-game-gold text-game-gold bg-game-gold/5' : 'border-game-teal/10 text-game-white/40 hover:border-game-teal/30 hover:text-game-white/60'}`}>{p.name}</button>
                    ))}
                  </div>
                </div>
              </CollapsibleSidebar>
              
              <div className="flex-1 relative rounded-2xl border border-game-teal/10 bg-black/40 overflow-hidden flex items-center justify-center p-8 group">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #7fdbca 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                <div className="w-[280px] relative z-10 transition-transform duration-500 group-hover:scale-105">
                  <VisualCard preset={activePreset} active={true} revealType={revealType} holoActive={overlayHoloInteractive} />
                </div>
              </div>
            </div>
          )}
          {activeTab === 'atmos' && <AtmosEditor {...subEditorProps} />}
          {activeTab === 'text' && <TextEffectsEditor {...subEditorProps} />}
          {activeTab === 'active' && <ActiveEffectsEditor {...subEditorProps} />}
          {activeTab === 'depth' && <CardDepthEffectsDemo {...subEditorProps} />}
          {activeTab === 'flip' && <FlipEffectsEditor />}
          {activeTab === 'liquid' && <LiquidHoloDemo />}
          {activeTab === 'threejs' && <ThreeJsElementsDemo />}
          {activeTab === 'paint' && (
            <div className="h-full flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-game-teal/10 pb-4">
                <h3 className="text-sm font-black text-game-white uppercase tracking-widest">Elemental Watercolor Swatches</h3>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 pb-10">
                <div className="grid grid-cols-3 gap-6">
                  {ELEMENT_WATERCOLOR_SWATCH_ORDER.map((element) => (
                    <div key={element} className="h-48 rounded-xl border border-game-teal/10 bg-black/40 overflow-hidden relative group">
                      <DynamicPaintCanvas />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-game-teal/20 bg-black/20 flex items-center justify-between shrink-0 font-mono text-[9px] text-game-teal/40 uppercase tracking-widest">
          <div className="flex items-center gap-6"><span>● GPU ACCELERATED</span><span>V-REL: 0.9.4</span></div>
          <div>ENGINE: EXPLORITAIRE CORE v4</div>
        </div>
      </div>
    </div>
  , document.body);
});
