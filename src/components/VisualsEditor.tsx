import { memo, useState, useRef, useEffect } from 'react';
import { CardFrame } from './card/CardFrame';
import { useHoloInteraction } from '../hooks/useHoloInteraction';
import { NEON_COLORS } from '../utils/styles';
import { DynamicPaintCanvas } from './DynamicPaintCanvas';

const EFFECT_PRESETS = [
  {
    id: 'classic-sparkle',
    name: 'Classic Sparkle',
    description: 'The standard multi-layered holographic effect with move-based glare.',
    rarity: 'rare'
  },
  {
    id: 'mythic-glimmer',
    name: 'Mythic Glimmer',
    description: 'Intense rainbow shift with high-density sparkle clusters.',
    rarity: 'mythic'
  },
  {
    id: 'legendary-gold',
    name: 'Sacred Gold',
    description: 'Warm amber shift with concentrated golden glints.',
    rarity: 'legendary'
  },
  {
    id: 'void-dark',
    name: 'Void Essence',
    description: 'Subtle violet shift with deep shadow vignettes.',
    rarity: 'epic'
  },
  {
    id: 'cosmic-veil',
    name: 'Cosmic Veil',
    description: 'Deep space blues with nebula-like shifting gradients.',
    rarity: 'mythic'
  },
  {
    id: 'emerald-aurora',
    name: 'Emerald Aurora',
    description: 'Ghostly green shimmers inspired by northern lights.',
    rarity: 'rare'
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    description: 'Violent orange and red bursts with high contrast glare.',
    rarity: 'legendary'
  },
  {
    id: 'icy-frost',
    name: 'Icy Frost',
    description: 'Cold white and cyan glints with a crystallized texture.',
    rarity: 'uncommon'
  },
  {
    id: 'galaxy-holo',
    name: 'Galaxy Holo',
    description: 'Classic deep-space texture with color-dodge dispersion.',
    rarity: 'legendary'
  },
  {
    id: 'radiant-cross',
    name: 'Radiant Cross',
    description: 'Complex cross-hatch foil patterns with exclusion blending.',
    rarity: 'mythic'
  },
  {
    id: 'vertical-bars',
    name: 'Rainbow Bars',
    description: 'Heavy vertical foil strips with shifting spectrum gradients.',
    rarity: 'rare'
  },
  {
    id: 'prism-radiant',
    name: 'Prism Radiant',
    description: 'High-contrast diagonal shards with multi-blend exclusion layers.',
    rarity: 'mythic'
  },
  {
    id: 'ultra-art',
    name: 'Full Art Ultra',
    description: 'Minimalist metallic sheen with high-saturation color depth.',
    rarity: 'legendary'
  }
];

const VisualCard = memo(function VisualCard({ 
  preset, 
  active,
  animating = false,
  revealType = 'standard'
}: { 
  preset: typeof EFFECT_PRESETS[0],
  active: boolean,
  animating?: boolean,
  revealType?: 'standard' | 'spin-zoom'
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 180, height: 245 });
  const { styles: holoStyles, handlePointerMove, handlePointerLeave } = useHoloInteraction();
  
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

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-[2.2/3] group ${animationClass}`}
      onPointerMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      style={animating ? undefined : holoStyles}
    >
      <div className={`card-3d-container h-full w-full ${active ? 'active' : ''}`}>
        <CardFrame
          size={dimensions}
          borderColor={active ? NEON_COLORS.gold : 'rgba(127, 219, 202, 0.4)'}
          boxShadow={active ? `0 0 25px ${NEON_COLORS.goldRgba(0.4)}` : 'none'}
          className="card-3d flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#0a0c18] to-[#040712]"
        >
          {/* Effects Layers */}
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              background: `radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,${active ? 0.45 : 0.3}) 0%, transparent 80%)`,
              mixBlendMode: 'soft-light',
            }}
          />
          
          {/* Preset Specific Filter Overrides */}
          <div 
            className={`absolute inset-0 pointer-events-none ${
              preset.id === 'galaxy-holo' ? 'card-holo-galaxy' : 
              (preset.id === 'radiant-cross' || preset.id === 'prism-radiant') ? 'card-holo-radiant' :
              preset.id === 'vertical-bars' ? 'card-holo-vertical-bars' : 'card-holo-gradient'
            }`}
            style={{
              opacity: active ? 1 : 0.8,
              filter: `
                ${preset.id === 'prism-radiant' ? 'brightness(0.7) contrast(1.1)' : `brightness(${active ? 1.1 : 0.8}) contrast(1.4)`}
                ${
                  preset.id === 'void-dark' ? 'hue-rotate(45deg) saturate(1.8)' : 
                  preset.id === 'cosmic-veil' ? 'hue-rotate(-90deg) brightness(0.8)' :
                  preset.id === 'emerald-aurora' ? 'hue-rotate(90deg)' :
                  preset.id === 'solar-flare' ? 'hue-rotate(-160deg) saturate(2.5)' :
                  preset.id === 'icy-frost' ? 'saturate(0.3) brightness(1.4)' : 
                  preset.id === 'prism-radiant' ? 'hue-rotate(180deg)' :
                  preset.id === 'ultra-art' ? 'saturate(2.2) brightness(0.9)' : ''
                }
              `,
            }}
          />
          <div 
            className="absolute inset-0 pointer-events-none card-holo-sparkle"
            style={{
              opacity: (active || preset.id === 'galaxy-holo' || preset.id === 'radiant-cross' || preset.id === 'prism-radiant') ? 1 : 0.85,
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

export const VisualsEditor = memo(function VisualsEditor() {
  const [activeSubtab, setActiveSubtab] = useState<'holo' | 'watercolor'>('holo');
  const [selectedId, setSelectedId] = useState(EFFECT_PRESETS[0].id);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [revealType, setRevealType] = useState<'standard' | 'spin-zoom'>('standard');

  const triggerAnimation = (id: string, type: 'standard' | 'spin-zoom') => {
    setAnimatingId(null);
    setRevealType(type);
    setTimeout(() => setAnimatingId(id), 10);
  };

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
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeSubtab === 'holo' && (
            <>
              <button
                onClick={() => triggerAnimation(selectedId, 'standard')}
                className="px-4 py-1.5 rounded-lg border border-game-teal/40 text-[9px] text-game-teal/80 font-black uppercase tracking-[0.2em] hover:bg-game-teal/10 transition-colors shadow-lg"
              >
                🎬 Reveal
              </button>
              <button
                onClick={() => triggerAnimation(selectedId, 'spin-zoom')}
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
            {EFFECT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setSelectedId(preset.id)}
                className={`text-left transition-all ${selectedId === preset.id ? 'scale-105' : 'scale-100 opacity-80 hover:opacity-100'}`}
              >
                <VisualCard 
                  preset={preset} 
                  active={selectedId === preset.id} 
                  animating={animatingId === preset.id}
                  revealType={revealType}
                />
              </button>
            ))}
          </div>
                ) : (
                  <div className="h-full overflow-y-auto pr-4 custom-scrollbar space-y-12 pb-10">
                    <section className="space-y-6">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-game-gold font-bold text-xs uppercase tracking-widest">Dynamic Paint</h3>
                        <p className="text-[10px] text-game-white/50 italic">Interactive procedural watercolor simulation on canvas.</p>
                      </div>
                      <DynamicPaintCanvas />
                    </section>

                    <section className="space-y-6">
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
                      <div className="flex flex-col gap-1">
                        <h3 className="text-game-gold font-bold text-xs uppercase tracking-widest">SVG Filter: #watercolor</h3>
                        <p className="text-[10px] text-game-white/50 italic">Complex turbulence & displacement stack for organic paint bleed.</p>
                      </div>
                      
                      <div className="rounded-2xl border border-game-teal/10 bg-[#fff0cb] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.6),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.4),transparent_60%)] p-8 shadow-[0_0_35px_rgba(0,0,0,0.35)]">
                        <div className="flex flex-wrap gap-8 justify-center lg:justify-start items-center">
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
                                className="relative w-32 h-24 rounded-2xl transition-transform hover:scale-105 overflow-visible flex flex-col items-center justify-center"
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
                
                          {/* Vertically Stacked UI Elements - same row as cards */}
                          <div className="flex flex-col gap-4 ml-4 self-stretch justify-center">
                            <button 
                              className="relative px-8 py-3 flex items-center justify-center transition-all hover:scale-105 active:translate-y-1 group rounded-xl"
                              style={{ isolation: 'isolate', mixBlendMode: 'multiply' }}
                            >
                              <div 
                                className="absolute inset-0 rounded-xl transition-opacity opacity-90 group-hover:opacity-100"
                                style={{
                                  background: 'rgb(0 0 0 / 100%)',
                                  filter: 'url(#watercolor) drop-shadow(0 0em 0em rgba(255,255,255,1)) sepia(1) brightness(0.4) contrast(0.75) saturate(100%) hue-rotate(0deg) drop-shadow(0 4px 0.25px rgba(0,0,0,0.25))',
                                  transform: 'translate(-1px, -1px)',
                                  zIndex: -1
                                }}
                              />
                              <span className="text-white font-black uppercase tracking-[0.3em] text-[10px] [text-shadow:0_1px_5px_rgba(0,0,0,0.33)]">Primary</span>
                            </button>
                
                            <button 
                              className="relative px-8 py-3 flex items-center justify-center transition-all hover:scale-105 active:translate-y-1 group rounded-full"
                              style={{ isolation: 'isolate', mixBlendMode: 'multiply' }}
                            >
                              <div 
                                className="absolute inset-0 rounded-full transition-opacity opacity-90 group-hover:opacity-100"
                                style={{
                                  background: 'rgb(0 0 0 / 100%)',
                                  filter: 'url(#watercolor) drop-shadow(0 0em 0em rgba(255,255,255,1)) sepia(1) brightness(1.6) contrast(2) saturate(170%) hue-rotate(0deg) drop-shadow(0 4px 0.25px rgba(0,0,0,0.25))',
                                  transform: 'translate(-1px, -1px)',
                                  zIndex: -1
                                }}
                              />
                              <span className="text-[#392b17] font-black uppercase tracking-[0.3em] text-[10px] [text-shadow:0_1px_5px_rgba(0,0,0,0.33)]">Secondary</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
        
                    <section className="space-y-4 border-t border-game-teal/10 pt-8">
                      <div className="bg-game-bg-dark/40 border border-game-teal/20 rounded-xl p-6 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-game-gold/80">Usage Guide</h4>
                        <div className="grid md:grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <p className="text-[9px] text-game-white/60 leading-relaxed font-mono">
                              Apply to any element using: <br/>
                              <code className="text-game-pink">filter: url(#watercolor) ...</code>
                            </p>
                            <p className="text-[8px] text-game-white/40 italic">
                              Note: The element needs <code className="bg-black/20 px-1 rounded text-game-teal">isolation: isolate</code> 
                              and a non-zero background color (e.g., <code className="bg-black/20 px-1 rounded text-game-teal">rgb(20 20 20)</code>) for the filter to process correctly.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[9px] text-game-white/60 leading-relaxed font-mono">
                              Dynamic Coloring: <br/>
                              Use <code className="text-game-teal">sepia(1)</code> followed by <code className="text-game-teal">hue-rotate()</code> 
                              and <code className="text-game-teal">saturate()</code> to tint the filter's displacement noise.
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                )
              }
      </div>
    </div>
  );
});
