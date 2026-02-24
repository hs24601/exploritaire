import { memo, useState, useRef, useEffect, type MouseEvent, type TouchEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { CardFrame } from './card/CardFrame';
import { useHoloInteraction } from '../hooks/useHoloInteraction';
import { NEON_COLORS } from '../utils/styles';
import { DepthCardScene } from './DepthCardScene';
import { DynamicPaintCanvas } from './DynamicPaintCanvas';
import { ELEMENT_WATERCOLOR_SWATCH_ORDER, ELEMENT_WATERCOLOR_SWATCHES } from '../watercolor/elementalSwatches';

const BLUEYCHU_ASSET = '/assets/Bluevee.png';

type HoloEffectPreset = {
  id: string;
  name: string;
  description: string;
  rarity: string;
  descriptorTitle: string;
  effectClass: string;
};

const LEGACY_EFFECT_PRESETS: HoloEffectPreset[] = [
  {
    id: 'classic-sparkle',
    name: 'Classic Sparkle',
    description: 'The standard multi-layered holographic effect with move-based glare.',
    rarity: 'rare',
    descriptorTitle: 'Legacy',
    effectClass: 'card-holo-gradient',
  },
  {
    id: 'mythic-glimmer',
    name: 'Mythic Glimmer',
    description: 'Intense rainbow shift with high-density sparkle clusters.',
    rarity: 'mythic',
    descriptorTitle: 'Legacy',
    effectClass: 'card-holo-gradient',
  },
  {
    id: 'legendary-gold',
    name: 'Sacred Gold',
    description: 'Warm amber shift with concentrated golden glints.',
    rarity: 'legendary',
    descriptorTitle: 'Legacy',
    effectClass: 'card-holo-gradient',
  },
  {
    id: 'void-dark',
    name: 'Void Essence',
    description: 'Subtle violet shift with deep shadow vignettes.',
    rarity: 'epic',
    descriptorTitle: 'Legacy',
    effectClass: 'card-holo-gradient',
  },
  {
    id: 'cosmic-veil',
    name: 'Cosmic Veil',
    description: 'Deep space blues with nebula-like shifting gradients.',
    rarity: 'mythic',
    descriptorTitle: 'Legacy',
    effectClass: 'card-holo-gradient',
  },
  {
    id: 'emerald-aurora',
    name: 'Emerald Aurora',
    description: 'Ghostly green shimmers inspired by northern lights.',
    rarity: 'rare',
    descriptorTitle: 'Legacy',
    effectClass: 'card-holo-gradient',
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    description: 'Violent orange and red bursts with high contrast glare.',
    rarity: 'legendary',
    descriptorTitle: 'Legacy',
    effectClass: 'card-holo-gradient',
  },
  {
    id: 'icy-frost',
    name: 'Icy Frost',
    description: 'Cold white and cyan glints with a crystallized texture.',
    rarity: 'uncommon',
    descriptorTitle: 'Legacy',
    effectClass: 'card-holo-gradient',
  },
  {
    id: 'galaxy-holo',
    name: 'Galaxy Holo',
    description: 'Classic deep-space texture with color-dodge dispersion.',
    rarity: 'legendary',
    descriptorTitle: 'Legacy',
    effectClass: 'card-holo-galaxy',
  },
  {
    id: 'radiant-cross',
    name: 'Radiant Cross',
    description: 'Complex cross-hatch foil patterns with exclusion blending.',
    rarity: 'mythic',
    descriptorTitle: 'Legacy',
    effectClass: 'card-holo-radiant',
  },
  {
    id: 'vertical-bars',
    name: 'Rainbow Bars',
    description: 'Heavy vertical foil strips with shifting spectrum gradients.',
    rarity: 'rare',
    descriptorTitle: 'Legacy',
    effectClass: 'card-holo-vertical-bars',
  },
  {
    id: 'prism-radiant',
    name: 'Prism Radiant',
    description: 'High-contrast diagonal shards with multi-blend exclusion layers.',
    rarity: 'mythic',
    descriptorTitle: 'Legacy',
    effectClass: 'card-holo-radiant',
  },
  {
    id: 'ultra-art',
    name: 'Full Art Ultra',
    description: 'Minimalist metallic sheen with high-saturation color depth.',
    rarity: 'legendary',
    descriptorTitle: 'Legacy',
    effectClass: 'card-holo-gradient',
  }
];

const NEXT_EFFECT_PRESETS: HoloEffectPreset[] = [
  {
    id: 'legacy-rainbow-foundation',
    name: 'Rainbow Foundation',
    description: 'Foundation actor variant of rainbow secret holo for in-combat stacking tests.',
    rarity: 'mythic',
    descriptorTitle: 'Rainbow Foundation',
    effectClass: 'card-holo-legacy-rainbow-foundation',
  },
  {
    id: 'legacy-common-uncommon',
    name: 'Common + Uncommon',
    description: 'Subtle baseline sheen for common and uncommon treatments.',
    rarity: 'common',
    descriptorTitle: 'Common & Uncommon',
    effectClass: 'card-holo-legacy-common-uncommon',
  },
  {
    id: 'legacy-reverse-holo',
    name: 'Reverse Holo',
    description: 'Non-rare reverse foil striping with dark bar modulation.',
    rarity: 'uncommon',
    descriptorTitle: 'Reverse Holo non-rares',
    effectClass: 'card-holo-legacy-reverse-holo',
  },
  {
    id: 'legacy-holofoil-rare',
    name: 'Holofoil Rare',
    description: 'Classic rare holo foil with spectral bar and shine stack.',
    rarity: 'rare',
    descriptorTitle: 'Holofoil Rare',
    effectClass: 'card-holo-legacy-holofoil-rare',
  },
  {
    id: 'legacy-galaxy-cosmos',
    name: 'Galaxy / Cosmos',
    description: 'Galaxy texture with deep-space blend and color-dodge bloom.',
    rarity: 'rare',
    descriptorTitle: 'Galaxy/Cosmos Holofoil',
    effectClass: 'card-holo-legacy-galaxy-cosmos',
  },
  {
    id: 'legacy-v',
    name: 'V Holo',
    description: 'High-contrast rainbow V foil with layered directional lighting.',
    rarity: 'rare',
    descriptorTitle: 'V',
    effectClass: 'card-holo-legacy-v',
  },
  {
    id: 'legacy-vmax',
    name: 'VMAX Holo',
    description: 'Heavy saturation VMAX foil with high-energy aura blends.',
    rarity: 'epic',
    descriptorTitle: 'VMAX',
    effectClass: 'card-holo-legacy-vmax',
  },
  {
    id: 'legacy-vstar',
    name: 'VSTAR Holo',
    description: 'VSTAR prismatic treatment with exclusion secondary pass.',
    rarity: 'legendary',
    descriptorTitle: 'VSTAR',
    effectClass: 'card-holo-legacy-vstar',
  },
  {
    id: 'legacy-full-alt',
    name: 'Full / Alt Art',
    description: 'Full-art foil with elevated contrast and art-first sheen.',
    rarity: 'legendary',
    descriptorTitle: 'Full / Alternate Art',
    effectClass: 'card-holo-legacy-full-alt',
  },
  {
    id: 'legacy-trainer-full-art',
    name: 'Trainer Full-Art',
    description: 'Trainer-specific full-art blend profile.',
    rarity: 'epic',
    descriptorTitle: 'Trainer Full-Art',
    effectClass: 'card-holo-legacy-trainer-full-art',
  },
  {
    id: 'legacy-rainbow-secret',
    name: 'Rainbow Secret',
    description: 'Dense rainbow secret texture with deep gradient bands.',
    rarity: 'mythic',
    descriptorTitle: 'Rainbow Secret',
    effectClass: 'card-holo-legacy-rainbow-secret',
  },
  {
    id: 'legacy-rainbow-secret-alt',
    name: 'Rainbow Secret Alt',
    description: 'Higher-contrast variant for rainbow secret full/alt cards.',
    rarity: 'mythic',
    descriptorTitle: 'Rainbow Secret Full/Alt',
    effectClass: 'card-holo-legacy-rainbow-secret-alt',
  },
  {
    id: 'legacy-gold-secret',
    name: 'Gold Secret',
    description: 'Metal-heavy secret rare with warm gold spectral glint.',
    rarity: 'legendary',
    descriptorTitle: 'Gold Secret',
    effectClass: 'card-holo-legacy-gold-secret',
  },
  {
    id: 'legacy-radiant',
    name: 'Radiant',
    description: 'Radiant cross-hatch foil with high luminance contrast.',
    rarity: 'mythic',
    descriptorTitle: 'Radiant',
    effectClass: 'card-holo-legacy-radiant',
  },
  {
    id: 'legacy-trainer-gallery-holo',
    name: 'Trainer Gallery Holo',
    description: 'Gallery holo treatment with angular rainbow sweep.',
    rarity: 'rare',
    descriptorTitle: 'Trainer Gallery Holo',
    effectClass: 'card-holo-legacy-trainer-gallery-holo',
  },
  {
    id: 'legacy-trainer-gallery-v',
    name: 'Trainer Gallery V',
    description: 'Gallery V holographic profile with layered exclusion pass.',
    rarity: 'rare',
    descriptorTitle: 'Trainer Gallery V',
    effectClass: 'card-holo-legacy-trainer-gallery-v',
  },
  {
    id: 'legacy-trainer-gallery-vmax',
    name: 'Trainer Gallery VMAX',
    description: 'Gallery VMAX variant tuned for punchier foil depth.',
    rarity: 'legendary',
    descriptorTitle: 'Trainer Gallery VMAX',
    effectClass: 'card-holo-legacy-trainer-gallery-vmax',
  }
];

const VisualCard = memo(function VisualCard({ 
  preset, 
  active,
  animating = false,
  revealType = 'standard',
  dimmed = false,
  focused = false,
  holoActive = false,
}: { 
  preset: HoloEffectPreset,
  active: boolean,
  animating?: boolean,
  revealType?: 'standard' | 'spin-zoom',
  dimmed?: boolean,
  focused?: boolean,
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
        // Maintain 2.2 / 3 aspect ratio
        const height = (width / 2.2) * 3;
        setDimensions({ width, height });
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const animationClass = animating 
    ? (revealType === 'spin-zoom' ? 'animate-spin-zoom-center' : 'animate-reveal-spin-zoom') 
    : '';

  const holoStylesEnabled = holoActive && !dimmed;
  const isLegacyLibraryEffect = preset.effectClass.startsWith('card-holo-legacy');
  const baseArtOpacity = isLegacyLibraryEffect ? (active ? 0.17 : 0.14) : (active ? 0.21 : 0.17);
  const glareOpacity = isLegacyLibraryEffect ? (active ? 0.11 : 0.07) : (active ? 0.16 : 0.1);
  const foilOpacity = isLegacyLibraryEffect ? (active ? 0.35 : 0.275) : (active ? 0.44 : 0.36);
  const sparkleOpacity = isLegacyLibraryEffect ? (active ? 0.225 : 0.15) : (active ? 0.36 : 0.25);

  return (
      <div
        ref={(node) => {
          containerRef.current = node;
          registerElement(node);
        }}
        className={`relative w-full aspect-[2.2/3] group ${animationClass} ${focused ? 'z-40' : ''}`}
        onPointerMove={holoStylesEnabled ? handlePointerMove : undefined}
        onMouseLeave={holoStylesEnabled ? handlePointerLeave : undefined}
        style={holoStylesEnabled ? (animating ? undefined : holoStyles) : undefined}
      >
      {dimmed && (
        <div className="absolute inset-0 z-30 bg-black/70 pointer-events-none transition-opacity" />
      )}
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
              opacity: baseArtOpacity,
            }}
          />
          {/* Effects Layers */}
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: `radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,${glareOpacity}) 0%, transparent 78%)`,
              mixBlendMode: 'soft-light',
            }}
          />
          
          {/* Preset Specific Filter Overrides */}
          <div 
            className={`absolute inset-0 pointer-events-none ${preset.effectClass || 'card-holo-gradient'}`}
            style={{
              opacity: foilOpacity,
              filter: `brightness(${active ? 0.92 : 0.82}) contrast(${isLegacyLibraryEffect ? 1.1 : 1.2}) saturate(${isLegacyLibraryEffect ? 0.9 : 1})`,
            }}
          />
          <div 
            className="absolute inset-0 pointer-events-none card-holo-sparkle"
            style={{
              opacity: (active || preset.id === 'galaxy-holo' || preset.id === 'radiant-cross' || preset.id === 'prism-radiant') ? sparkleOpacity : Math.max(0.25, sparkleOpacity - 0.15),
              filter: preset.id === 'void-dark' ? 'invert(0.2) sepia(1) saturate(5) hue-rotate(240deg)' : ''
            }}
          />

          <div className="relative z-20 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-game-teal/60 font-black">
              {preset.rarity}
            </div>
            <div className="text-sm font-bold text-game-white tracking-wider">
              {preset.name}
            </div>
            <div className="text-[9px] leading-relaxed text-game-white/40 px-2 italic line-clamp-2">
              {preset.description}
            </div>
          </div>
        </CardFrame>
      </div>
    </div>
  );
});

type DepthInteraction = {
  cardTransform: string;
  backgroundPosition: string;
  shineBackground: string;
  shadowTransform: string;
  titleTransform: string;
  subtitleTransform: string;
};

const DEFAULT_DEPTH_INTERACTION: DepthInteraction = {
  cardTransform: 'translate3d(0, 0, 0) scale(1) rotateX(0deg) rotateY(0deg)',
  backgroundPosition: '50% 50%',
  shineBackground: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 60%)',
  shadowTransform: 'scale(.9,.9) translateX(12px) translateY(12px) scale(1.0) rotateY(0deg) rotateX(0deg)',
  titleTransform: 'translateX(0px) translateY(0px)',
  subtitleTransform: 'translateX(0px) translateY(0px) translateZ(60px)',
};

const DepthCardDemo = () => {
  const [interaction, setInteraction] = useState<DepthInteraction>(DEFAULT_DEPTH_INTERACTION);
  const [depthMode, setDepthMode] = useState<'scene' | 'image'>('scene');
  const depthRef = useRef<HTMLDivElement>(null);

  const updateInteraction = (mouseX: number, mouseY: number, bounds: DOMRect) => {
    const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
    const percentX = clamp(mouseX / bounds.width);
    const percentY = clamp(mouseY / bounds.height);
    const aroundX = -(percentY * 20 - 10);
    const aroundY = percentX * 20 - 10;
    const transX = (percentX - 0.5) * 70;
    const transY = (percentY - 0.5) * 70;
    const dx = mouseX - bounds.width / 2;
    const dy = mouseY - bounds.height / 2;
    const theta = Math.atan2(dy, dx);
    const angle = theta * (180 / Math.PI) - 90;
    const mousePositionX = percentX * 100;
    const mousePositionY = 50 + percentY * 30;

    const BASE_SCALE = 1.04;
    setInteraction({
      cardTransform: `translate3d(${transX}px, ${transY}px, 0) scale(${BASE_SCALE}) rotateX(${aroundX}deg) rotateY(${aroundY}deg)`,
      backgroundPosition: `${mousePositionX}% ${mousePositionY}%`,
      shineBackground: `linear-gradient(${angle}deg, rgba(255,255,255,${Math.min(percentY * 0.7 + 0.05, 0.9)}) 0%, rgba(255,255,255,0) 80%)`,
      shadowTransform: `scale(.9,.9) translateX(${(-dx * 0.02 + 12).toFixed(2)}px) translateY(${(-dy * 0.02 + 12).toFixed(2)}px) scale(1.0) rotateY(${((dx / 25) * 0.5).toFixed(2)}deg) rotateX(${(-dy / 25).toFixed(2)}deg)`,
      titleTransform: `translateX(${((dx / 25) * 0.7).toFixed(2)}px) translateY(${((dy / 25) * 1.65).toFixed(2)}px)`,
      subtitleTransform: `translateX(${((dx / 25) * 0.5).toFixed(2)}px) translateY(${((dy / 25) * 1.15).toFixed(2)}px) translateZ(60px)`,
    });
  };

  const handlePointerMove = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    updateInteraction(event.clientX - bounds.left, event.clientY - bounds.top, bounds);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const touch = event.touches[0];
    if (!touch) return;
    updateInteraction(touch.clientX - bounds.left, touch.clientY - bounds.top, bounds);
  };

  const handlePointerLeave = () => setInteraction(DEFAULT_DEPTH_INTERACTION);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      return;
    }

    const depthNode = depthRef.current;

    const clampPercent = (value: number) => Math.min(Math.max(value, 0), 1);

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!depthNode) return;
      const bounds = depthNode.getBoundingClientRect();
      const gamma = event.gamma ?? 0;
      const beta = event.beta ?? 0;
      const xPercent = clampPercent(0.5 + (gamma / 90) * 0.5);
      const yPercent = clampPercent(0.5 + (beta / 90) * 0.5);
      updateInteraction(xPercent * bounds.width, yPercent * bounds.height, bounds);
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setDepthMode('scene')}
          className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider font-bold transition-all border ${
            depthMode === 'scene'
              ? 'border-game-gold text-game-gold bg-game-gold/10'
              : 'border-game-teal/20 text-game-white/40 hover:border-game-teal/40'
          }`}
        >
          JS Scene
        </button>
        <button
          type="button"
          onClick={() => setDepthMode('image')}
          className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider font-bold transition-all border ${
            depthMode === 'image'
              ? 'border-game-gold text-game-gold bg-game-gold/10'
              : 'border-game-teal/20 text-game-white/40 hover:border-game-teal/40'
          }`}
        >
          Flat Image
        </button>
      </div>
      <div
        className="depth-wrap"
        ref={depthRef}
        onMouseMove={handlePointerMove}
        onTouchMove={handleTouchMove}
        onMouseLeave={handlePointerLeave}
      >
        <div className="depth-card-shadow" style={{ transform: interaction.shadowTransform }} />
        <div
          className={`depth-card ${depthMode === 'scene' ? 'depth-card--scene' : 'depth-card--image'}`}
          style={{
            transform: interaction.cardTransform,
            backgroundImage: depthMode === 'image' ? `url('${BLUEYCHU_ASSET}')` : undefined,
            backgroundSize: depthMode === 'image' ? 'cover' : undefined,
            backgroundRepeat: depthMode === 'image' ? 'no-repeat' : undefined,
            backgroundPosition: depthMode === 'image' ? interaction.backgroundPosition : 'center',
          }}
        >
          {depthMode === 'scene' && <DepthCardScene />}
          <div className="depth-card-shine" style={{ background: interaction.shineBackground }} />
          <div className="depth-card-front">
            <div className="depth-card-title text-center">BIOME</div>
            <div className="depth-card-subtitle">Biome description</div>
          </div>
        </div>
      </div>
    </div>
  );
};

type OverlayTransform = {
  translateX: number;
  translateY: number;
  scale: number;
  width: number;
  height: number;
};

const SPIN_ZOOM_DURATION_MS = 1500;

export const VisualsEditor = memo(function VisualsEditor() {
  const [activeSubtab, setActiveSubtab] = useState<'holo' | 'watercolor' | 'depth'>('holo');
  const [showLegacyEffects, setShowLegacyEffects] = useState(false);
  const activeHoloLibrary = showLegacyEffects ? LEGACY_EFFECT_PRESETS : NEXT_EFFECT_PRESETS;
  const [selectedId, setSelectedId] = useState(NEXT_EFFECT_PRESETS[0].id);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [selectedAnimation, setSelectedAnimation] = useState<'standard' | 'spin-zoom'>('spin-zoom');
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [overlayPreset, setOverlayPreset] = useState<HoloEffectPreset | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayKey, setOverlayKey] = useState(0);
  const [overlayTransform, setOverlayTransform] = useState<OverlayTransform | null>(null);
  const [overlayAnimating, setOverlayAnimating] = useState(false);
  const [overlayHoloInteractive, setOverlayHoloInteractive] = useState(false);

  const triggerAnimation = (id: string, type: 'standard' | 'spin-zoom', focus?: boolean) => {
    setAnimatingId(null);
    setSelectedAnimation(type);
    if (focus) setFocusedCardId(id);
    setTimeout(() => setAnimatingId(id), 10);
  };

  const handleAnimationButton = (type: 'standard' | 'spin-zoom') => {
    setSelectedAnimation(type);
    setFocusedCardId(null);
    setOverlayVisible(false);
  };

  const handleCardSelect = (preset: HoloEffectPreset, event: ReactMouseEvent<HTMLButtonElement>) => {
    setSelectedId(preset.id);
    setFocusedCardId(preset.id);
    setOverlayPreset(preset);
    setOverlayVisible(true);
    setOverlayKey((prev) => prev + 1);
    setOverlayHoloInteractive(false);
    setSelectedAnimation('spin-zoom');
    triggerAnimation(preset.id, 'spin-zoom', true);

    if (typeof window === 'undefined') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const targetWidth = Math.min(520, viewportWidth - 48);
    const targetHeight = (targetWidth / 2.2) * 3;
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    const translateX = (rect.left + rect.width / 2) - centerX;
    const translateY = (rect.top + rect.height / 2) - centerY;
    const scale = targetWidth / rect.width;

    setOverlayTransform({
      translateX,
      translateY,
      scale,
      width: targetWidth,
      height: targetHeight,
    });
    setOverlayAnimating(true);
    setTimeout(() => setOverlayAnimating(false), 20);
  };

  const closeOverlay = () => {
    setOverlayVisible(false);
    setOverlayPreset(null);
    setFocusedCardId(null);
    setOverlayTransform(null);
    setOverlayHoloInteractive(false);
  };

  useEffect(() => {
    if (!activeHoloLibrary.some((preset) => preset.id === selectedId)) {
      setSelectedId(activeHoloLibrary[0]?.id ?? '');
    }
  }, [activeHoloLibrary, selectedId]);

  useEffect(() => {
    if (!overlayVisible || !overlayPreset) return;
    const timer = window.setTimeout(() => {
      setOverlayHoloInteractive(true);
    }, SPIN_ZOOM_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [overlayVisible, overlayPreset, overlayKey]);

  useEffect(() => {
    if (activeSubtab !== 'holo') {
      closeOverlay();
    }
  }, [activeSubtab]);

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between shrink-0 border-b border-game-teal/20 pb-4">
        <div className="flex flex-col gap-3">
          <div className="space-y-1">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80">Visual Effects Browser</h2>
            <p className="text-[9px] text-game-white/40 uppercase tracking-widest italic font-mono">Shader & Blend-Mode Catalog</p>
          </div>
          
          {/* Subtabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubtab('holo')}
              className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider font-bold transition-all border ${
                activeSubtab === 'holo' 
                  ? 'border-game-gold text-game-gold bg-game-gold/10' 
                  : 'border-game-teal/20 text-game-white/40 hover:border-game-teal/40'
              }`}
            >
              Holo Effects
            </button>
            <button
              onClick={() => setActiveSubtab('watercolor')}
              className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider font-bold transition-all border ${
                activeSubtab === 'watercolor' 
                  ? 'border-game-gold text-game-gold bg-game-gold/10' 
                  : 'border-game-teal/20 text-game-white/40 hover:border-game-teal/40'
              }`}
            >
              Watercolor Effects
            </button>
            <button
              onClick={() => setActiveSubtab('depth')}
              className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider font-bold transition-all border ${
                activeSubtab === 'depth'
                  ? 'border-game-gold text-game-gold bg-game-gold/10'
                  : 'border-game-teal/20 text-game-white/40 hover:border-game-teal/40'
              }`}
            >
              Depth Cards
            </button>
          </div>
          {activeSubtab === 'holo' && (
            <label className="flex items-center gap-2 text-[10px] text-game-white/70 uppercase tracking-[0.2em] font-bold">
              <input
                type="checkbox"
                checked={showLegacyEffects}
                onChange={(event) => setShowLegacyEffects(event.target.checked)}
                className="h-3.5 w-3.5 accent-game-gold"
              />
              Legacy effects
            </label>
          )}
        </div>

        <div className="flex items-center gap-3">
          {activeSubtab === 'holo' && (
            <>
              <button
                onClick={() => handleAnimationButton('standard')}
                className="px-4 py-1.5 rounded-lg border border-game-teal/40 text-[9px] text-game-teal/80 font-black uppercase tracking-[0.2em] hover:bg-game-teal/10 transition-colors shadow-lg"
              >
                🎬 Reveal
              </button>
              <button
                onClick={() => handleAnimationButton('spin-zoom')}
                className="px-4 py-1.5 rounded-lg border border-game-gold text-[9px] text-game-gold font-black uppercase tracking-[0.2em] hover:bg-game-gold/10 transition-colors shadow-lg"
              >
                💫 Spin Zoom
              </button>
            </>
          )}
          <div className="px-4 py-1.5 rounded-full border border-game-teal/30 bg-game-teal/5 text-[9px] text-game-teal font-black uppercase tracking-[0.2em]">
            Interactive Previews
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeSubtab === 'holo' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-10 h-full overflow-y-auto pr-4 custom-scrollbar content-start pb-10">
                {activeHoloLibrary.map((preset) => {
                  const isFocused = focusedCardId === preset.id;
                  const isDimmed = focusedCardId !== null && focusedCardId !== preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={(event) => handleCardSelect(preset, event)}
                      className={`relative text-left transition-all ${selectedId === preset.id ? 'scale-105' : 'scale-100 opacity-80 hover:opacity-100'} ${isDimmed ? 'opacity-40' : ''}`}
                    >
                      <VisualCard 
                        preset={preset} 
                        active={selectedId === preset.id} 
                        animating={animatingId === preset.id}
                        revealType={selectedAnimation}
                        dimmed={isDimmed}
                        focused={isFocused}
                        holoActive={isFocused}
                      />
                      <div className="mt-2 text-[9px] uppercase tracking-[0.18em] text-game-gold/80 text-center font-bold">
                        {preset.descriptorTitle}
                      </div>
                    </button>
                  );
                })}
              </div>
        ) : activeSubtab === 'watercolor' ? (
                  <div className="h-full overflow-y-auto pr-4 custom-scrollbar space-y-12 pb-10">
                    <div className="grid lg:grid-cols-2 gap-6 items-start">
                      <section className="grid grid-rows-[auto_1fr] gap-4">
                        <div className="flex flex-col gap-1 min-h-[36px]">
                          <h3 className="text-game-gold font-bold text-xs uppercase tracking-widest">Dynamic Paint</h3>
                          <p className="text-[10px] text-game-white/50 italic">Interactive procedural watercolor simulation on canvas.</p>
                        </div>
                        <div className="self-stretch">
                          <DynamicPaintCanvas />
                        </div>
                      </section>

                      <section className="grid grid-rows-[auto_1fr] gap-4">
                        <svg width="0" height="0" className="absolute" aria-hidden="true">
                          <defs>
                            <filter id="watercolor">
                              <feTurbulence result="noise-lg" type="fractalNoise" baseFrequency=".0125" numOctaves="2" seed="1222" />
                              <feTurbulence result="noise-md" type="fractalNoise" baseFrequency=".12" numOctaves="3" seed="11413" />
                              <feComposite result="BaseGraphic" in="SourceGraphic" in2="noise-lg" operator="arithmetic" k1="0.3" k2="0.45" k4="-.07" />
                              <feMorphology result="layer-1" in="BaseGraphic" operator="dilate" radius="0.5" />
                              <feDisplacementMap result="layer-1" in="layer-1" in2="noise-lg" xChannelSelector="R" yChannelSelector="B" scale="2" />
                              <feDisplacementMap result="layer-1" in="layer-1" in2="noise-md" xChannelSelector="R" yChannelSelector="B" scale="3" />
                              <feDisplacementMap result="mask" in="layer-1" in2="noise-lg" xChannelSelector="A" yChannelSelector="A" scale="4" />
                              <feGaussianBlur result="mask" in="mask" stdDeviation="6" />
                              <feComposite result="layer-1" in="layer-1" in2="mask" operator="arithmetic" k1="1" k2=".25" k3="-.25" k4="0" />
                              <feDisplacementMap result="layer-2" in="BaseGraphic" in2="noise-lg" xChannelSelector="G" yChannelSelector="R" scale="2" />
                              <feDisplacementMap result="layer-2" in="layer-2" in2="noise-md" xChannelSelector="A" yChannelSelector="G" scale="3" />
                              <feDisplacementMap result="glow" in="BaseGraphic" in2="noise-lg" xChannelSelector="R" yChannelSelector="A" scale="5" />
                              <feMorphology result="glow-diff" in="glow" operator="erode" radius="2" />
                              <feComposite result="glow" in="glow" in2="glow-diff" operator="out" />
                              <feGaussianBlur result="glow" in="glow" stdDeviation=".5" />
                              <feComposite result="layer-2" in="layer-2" in2="glow" operator="arithmetic" k1="1.2" k2="0.55" k3=".3" k4="-0.2" />
                              <feComposite result="watercolor" in="layer-1" in2="layer-2" operator="over" />
                            </filter>
                            <filter id="watercolor2">
                              <feTurbulence result="noise-lg" type="fractalNoise" baseFrequency=".0125" numOctaves="2" seed="1222" />
                              <feTurbulence result="noise-md" type="fractalNoise" baseFrequency=".12" numOctaves="3" seed="11413" />
                              <feComposite result="BaseGraphic" in="SourceGraphic" in2="noise-lg" operator="arithmetic" k1="0.3" k2="0.35" k4="-.05" />
                              <feDisplacementMap result="layer-2" in="BaseGraphic" in2="noise-lg" xChannelSelector="G" yChannelSelector="R" scale="2" />
                              <feDisplacementMap result="layer-2" in="layer-2" in2="noise-md" xChannelSelector="A" yChannelSelector="G" scale="3" />
                              <feDisplacementMap result="glow" in="BaseGraphic" in2="noise-lg" xChannelSelector="R" yChannelSelector="A" scale="4" />
                              <feMorphology result="glow-diff" in="glow" operator="erode" radius="2" />
                              <feComposite result="glow" in="glow" in2="glow-diff" operator="out" />
                              <feGaussianBlur result="glow" in="glow" stdDeviation="4" />
                              <feComposite result="layer-2" in="layer-2" in2="glow" operator="arithmetic" k1="0.65" k2="1.0" k3="0.4" k4="-0.15" />
                            </filter>
                          </defs>
                        </svg>
                        <div className="flex flex-col gap-1 min-h-[36px]">
                          <h3 className="text-game-gold font-bold text-xs uppercase tracking-widest">SVG Filter: #watercolor</h3>
                          <p className="text-[10px] text-game-white/50 italic">Complex turbulence & displacement stack for organic paint bleed.</p>
                        </div>
                        
                        <div className="rounded-2xl border border-game-teal/10 bg-[#fff0cb] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.6),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.4),transparent_60%)] p-6 shadow-[0_0_35px_rgba(0,0,0,0.35)] min-h-[260px] flex flex-col justify-center">
                          <div className="flex flex-wrap gap-3 justify-center lg:justify-start items-center">
                            {/* Demo Cards */}
                            {[
                              { rarity: 'common', hue: '35deg', sat: '55%', con: 1.05, bri: 1.15 },
                              { rarity: 'uncommon', hue: '120deg', sat: '120%', con: 1.25, bri: 1.25 },
                              { rarity: 'rare', hue: '210deg', sat: '170%', con: 1.45, bri: 1.35 },
                              { rarity: 'epic', hue: '275deg', sat: '210%', con: 1.65, bri: 1.4 },
                              { rarity: 'legendary', hue: '35deg', sat: '240%', con: 1.75, bri: 1.45 },
                              { rarity: 'mythic', hue: '320deg', sat: '260%', con: 1.9, bri: 1.5 },
                            ].map((item, i) => (
                              <div key={i} className="flex flex-col items-center gap-3 group">
                                <div 
                                  className="relative w-32 h-12 rounded-2xl transition-transform hover:scale-105 overflow-visible flex flex-col items-center justify-center"
                                  style={{ isolation: 'isolate', mixBlendMode: 'multiply' }}
                                >
                                  <div 
                                    className="absolute inset-0 rounded-2xl"
                                    style={{
                                      background: 'rgb(0 0 0 / 100%)',
                                      filter: `url(#watercolor) drop-shadow(0 0em 0em rgba(255,255,255,1)) sepia(1) brightness(${item.bri}) contrast(${item.con}) saturate(${item.sat}) hue-rotate(${item.hue})`,
                                      opacity: 0.9,
                                      transform: 'translate(-1px, -1px)',
                                      zIndex: -1
                                    }}
                                  />
                                  <div className="text-[10px] uppercase tracking-[0.28em] text-[#392b17]/80 font-black text-center">
                                    {item.rarity}
                                  </div>
                                </div>
                              </div>
                            ))}
                  
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3 justify-center lg:justify-start items-center">
                            {ELEMENT_WATERCOLOR_SWATCH_ORDER.map((element) => {
                              const item = ELEMENT_WATERCOLOR_SWATCHES[element];
                              return (
                              <div key={`element-${element}`} className="flex flex-col items-center gap-2">
                                <div
                                  className="relative w-28 h-12 rounded-2xl flex items-center justify-center"
                                  style={{ isolation: 'isolate', mixBlendMode: 'multiply' }}
                                >
                                  <div
                                    className="absolute inset-0 rounded-2xl"
                                    style={{
                                      background: item.baseColor,
                                      filter: `url(#watercolor) drop-shadow(0 0em 0em rgba(255,255,255,1)) ${item.filterTail}`,
                                      opacity: 0.9,
                                      transform: 'translate(-1px, -1px)',
                                      zIndex: -1,
                                    }}
                                  />
                                  {element === 'W' && (
                                    <div
                                      className="absolute inset-0 rounded-2xl"
                                      aria-hidden="true"
                                      style={{
                                        background: 'radial-gradient(circle at 30% 25%, rgba(80, 170, 255, 0.45), rgba(80, 170, 255, 0) 55%)',
                                        mixBlendMode: 'screen',
                                        opacity: 0.6,
                                      }}
                                    />
                                  )}
                                  {element === 'E' && (
                                    <div
                                      className="absolute inset-0 rounded-2xl"
                                      aria-hidden="true"
                                      style={{
                                        background: `radial-gradient(circle at 65% 30%, ${item.baseColor}66, ${item.baseColor}00 60%)`,
                                        mixBlendMode: 'multiply',
                                        opacity: 0.65,
                                      }}
                                    />
                                  )}
                                  {item.glow && (
                                    <div
                                      className="absolute inset-0 rounded-2xl"
                                      aria-hidden="true"
                                      style={{
                                        boxShadow: `0 0 18px ${item.glow}, inset 0 0 8px ${item.glow}`,
                                        opacity: 0.6,
                                      }}
                                    />
                                  )}
                                  <div className="text-[9px] uppercase tracking-[0.2em] text-[#392b17]/80 font-black text-center">
                                    {item.label}
                                  </div>
                                </div>
                              </div>
                            );
                            })}
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto pr-4 custom-scrollbar pb-10">
                    <div className="max-w-3xl mx-auto">
                      <DepthCardDemo />
                    </div>
                  </div>
        )}
      </div>
      {activeSubtab === 'holo' && overlayVisible && overlayPreset && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Close focused card preview"
            className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
            onClick={closeOverlay}
          />
          <div
            className="relative w-[min(520px,calc(100vw-48px))] max-w-full"
            style={{
              transform: overlayTransform
                ? (overlayAnimating
                  ? `translate3d(${overlayTransform.translateX}px, ${overlayTransform.translateY}px, 0) scale(${1 / overlayTransform.scale})`
                  : 'translate3d(0, 0, 0) scale(1)')
                : 'translate3d(0, 0, 0) scale(1)',
              transition: 'transform 450ms cubic-bezier(0.18, 0.9, 0.28, 1.06)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <VisualCard
              key={`${overlayPreset.id}-${overlayKey}`}
              preset={overlayPreset}
              active
              animating={!overlayHoloInteractive}
              revealType="spin-zoom"
              dimmed={false}
              focused
              holoActive={overlayHoloInteractive}
            />
          </div>
        </div>
      )}
    </div>
  );
});
