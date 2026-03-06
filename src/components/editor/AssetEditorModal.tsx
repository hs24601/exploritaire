import { useEffect, type ReactNode } from 'react';
import type { AssetEditorTab, AssetEditorTabId } from './types';

export function AssetEditorModal({
  open,
  onClose,
  tabs,
  activeTab,
  onTabChange,
  children,
  isGodRaysSliderDragging,
  hideForOverlay,
}: {
  open: boolean;
  onClose: () => void;
  tabs: AssetEditorTab[];
  activeTab: AssetEditorTabId;
  onTabChange: (tab: AssetEditorTabId) => void;
  children: ReactNode;
  isGodRaysSliderDragging: boolean;
  hideForOverlay?: boolean;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <>
      {children}
      <div className={`fixed inset-0 z-[10030]${hideForOverlay ? ' invisible pointer-events-none' : ''}`}>
        {!isGodRaysSliderDragging && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
        )}
        <div className="relative w-full h-full flex items-center justify-center p-3 sm:p-4">
          <div className={`relative w-[min(1320px,calc(100vw-1rem))] h-[min(920px,calc(100vh-1rem))] bg-[#0a0a0a] border border-game-teal/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden menu-text ${isGodRaysSliderDragging ? 'bg-transparent border-none shadow-none' : ''}`}>
            {/* Header */}
            {!isGodRaysSliderDragging && (
              <div className="px-6 py-4 border-b border-game-teal/20 flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-black text-game-white tracking-tighter flex items-center gap-2"><span className="text-game-teal">✦</span>ASSET EDITOR</h2>
                  <div className="h-4 w-[1px] bg-game-teal/20 mx-2" />
                  <div className="flex gap-1">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        disabled={tab.disabled}
                        onClick={() => !tab.disabled && onTabChange(tab.id)}
                        className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-game-gold text-black shadow-[0_0_15px_rgba(230,179,30,0.3)]' : 'text-game-white/40 hover:text-game-white hover:bg-game-white/5'} ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={onClose} 
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-game-pink/30 text-game-pink hover:bg-game-pink hover:text-white transition-all"
                >
                  ×
                </button>
              </div>
            )}

            {/* Content area */}
            <div className={`flex-1 overflow-hidden p-6 min-h-0 ${isGodRaysSliderDragging ? 'pointer-events-none' : ''}`}>
              {/* Actual content is rendered top-level, but we maintain this layout space */}
            </div>

            {/* Footer */}
            {!isGodRaysSliderDragging && (
              <div className="px-6 py-3 border-t border-game-teal/20 bg-black/20 flex items-center justify-between shrink-0 font-mono text-[9px] text-game-teal/40 uppercase tracking-widest">
                <div className="flex items-center gap-6"><span>● CORE ENGINE ACCESS</span><span>V-REL: 0.9.4</span></div>
                <div>SECURE DATA LINK ACTIVE</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
