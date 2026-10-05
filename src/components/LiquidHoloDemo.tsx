import { memo, useState } from 'react';

type FilterType = 'none' | 'warp' | 'prismatic';

export const LiquidHoloDemo = memo(function LiquidHoloDemo() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('warp');
  const [borderColor, setBorderColor] = useState('#00f2ff');
  const [lightColor, setLightColor] = useState('#ffffff');

  const filterUrl = activeFilter === 'warp' ? 'url(#liquid-warp)' : activeFilter === 'prismatic' ? 'url(#liquid-prismatic)' : 'none';

  return (
    <div className="flex h-full gap-6 p-8">
      {/* Sidebar Controls */}
      <div className="w-48 shrink-0 flex flex-col gap-4 border-r border-game-teal/10 pr-6">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-game-teal/60 mb-2">Liquid Config</h3>
        
        <div className="space-y-3">
          <label className="text-[9px] text-game-white/40 uppercase font-mono block">Filter Type</label>
          <div className="flex flex-col gap-1">
            {(['none', 'warp', 'prismatic'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`text-[10px] font-mono text-left px-3 py-2 rounded border transition-all ${activeFilter === f ? 'border-game-gold text-game-gold bg-game-gold/5' : 'border-game-teal/10 text-game-white/40 hover:border-game-teal/30 hover:text-game-white/60'}`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <label className="text-[9px] text-game-white/40 uppercase font-mono block">Border Color</label>
          <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="w-full h-8 bg-transparent border-none cursor-pointer" />
        </div>

        <div className="space-y-3 pt-4">
          <label className="text-[9px] text-game-white/40 uppercase font-mono block">Light Color</label>
          <input type="color" value={lightColor} onChange={(e) => setLightColor(e.target.value)} className="w-full h-8 bg-transparent border-none cursor-pointer" />
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-black/40 rounded-2xl border border-game-teal/10">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #7fdbca 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        
        {/* The Card Component */}
        <div 
          className="relative transition-transform duration-500 hover:scale-105"
          style={{
            '--electric-border-color': borderColor,
            '--electric-light-color': lightColor,
            '--f': filterUrl,
          } as any}
        >
          <style>{`
            .liquid-card-container {
              width: 280px;
              aspect-ratio: 7 / 10;
              position: relative;
            }
            .liquid-inner-container {
              position: absolute;
              inset: 0;
              border-radius: 1.5em;
              overflow: hidden;
            }
            .liquid-main-card {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              background: linear-gradient(135deg, #0a0c18 0%, #040712 100%);
              border-radius: 1.5em;
              border: 2px solid var(--electric-border-color);
              filter: var(--f);
            }
            /* Asset Layer */
            .liquid-main-card::before {
              content: "";
              position: absolute;
              inset: 0;
              background-image: url('/assets/Bluevee.png');
              background-size: cover;
              background-position: center;
              opacity: 0.4;
              mix-blend-mode: overlay;
            }
            .liquid-glow-layer-1 {
              border: 2px solid oklch(from var(--electric-border-color) l c h / 0.6);
              border-radius: 24px;
              position: absolute;
              inset: 0;
              filter: blur(1px);
              pointer-events: none;
            }
            .liquid-glow-layer-2 {
              border: 2px solid var(--electric-light-color);
              border-radius: 24px;
              position: absolute;
              inset: 0;
              filter: blur(4px);
              pointer-events: none;
            }
            .liquid-overlay-1 {
              position: absolute;
              inset: 0;
              border-radius: 24px;
              opacity: 0.6;
              mix-blend-mode: overlay;
              transform: scale(1.1);
              filter: blur(16px);
              background: linear-gradient(-30deg, white, transparent 30%, transparent 70%, white);
              pointer-events: none;
            }
            .liquid-background-glow {
              position: absolute;
              inset: 0;
              border-radius: 24px;
              filter: blur(32px);
              transform: scale(1.15);
              opacity: 0.2;
              z-index: -1;
              background: linear-gradient(-30deg, var(--electric-light-color), transparent, var(--electric-border-color));
              pointer-events: none;
            }
            .liquid-content {
              position: absolute;
              inset: 0;
              padding: 24px;
              display: flex;
              flex-direction: column;
              pointer-events: none;
            }
            .liquid-title {
              margin-top: auto;
              font-size: 1.5rem;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: -0.05em;
              color: white;
              text-shadow: 0 2px 10px rgba(0,0,0,0.5);
            }
            .liquid-glass-tag {
              background: radial-gradient(47.2% 50% at 50.39% 88.37%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.04);
              position: relative;
              border-radius: 10px;
              padding: 4px 10px;
              text-transform: uppercase;
              font-weight: 900;
              font-size: 9px;
              color: rgba(255, 255, 255, 0.8);
              width: fit-content;
              letter-spacing: 0.1em;
            }
            .liquid-glass-tag::before {
              content: "";
              position: absolute;
              inset: 0;
              padding: 1px;
              background: linear-gradient(150deg, rgba(255, 255, 255, 0.48) 16.73%, rgba(255, 255, 255, 0.08) 30.2%, rgba(255, 255, 255, 0.08) 68.2%, rgba(255, 255, 255, 0.6) 81.89%);
              border-radius: inherit;
              mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
              mask-composite: xor;
              -webkit-mask-composite: xor;
            }
          `}</style>
          
          <div className="liquid-card-container">
            <div className="liquid-inner-container">
              <div className="liquid-main-card"></div>
              <div className="liquid-glow-layer-1"></div>
              <div className="liquid-glow-layer-2"></div>
            </div>
            <div className="liquid-overlay-1"></div>
            <div className="liquid-background-glow"></div>
            
            <div className="liquid-content">
              <div className="liquid-glass-tag">Experimental</div>
              <h4 className="liquid-title">Liquid Distortion</h4>
              <div className="h-[1px] w-full bg-white/10 my-2" />
              <p className="text-[9px] text-white/40 uppercase font-mono tracking-widest italic">SVG Filter Pipeline v1.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
