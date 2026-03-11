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
    <div className={`fixed inset-0 z-[10030]${hideForOverlay ? ' invisible pointer-events-none' : ''}`}>
      {!isGodRaysSliderDragging && (
        <button
          type="button"
          aria-label="Close editor"
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <div className="relative w-full h-full flex items-start justify-center p-1 sm:p-2">
        <div
          className={`relative w-[min(96vw,1800px)] h-[min(96vh,1200px)] menu-text ${
            isGodRaysSliderDragging
              ? 'bg-transparent'
              : 'rounded-lg border border-game-teal/50 bg-game-bg-dark/95 shadow-[0_18px_60px_rgba(0,0,0,0.85)]'
          }`}
        >
          {/* Conditionally hide the header and tabs */}
          {!isGodRaysSliderDragging && (
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between z-20 border-b border-game-teal/30 bg-black/40 px-3 py-2 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-game-gold/90">
                  Editor
                </div>
                <div className="flex items-center gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={tab.disabled}
                    onClick={() => !tab.disabled && onTabChange(tab.id)}
                    className={`text-[10px] font-mono px-3 py-1 rounded border ${activeTab === tab.id ? 'border-game-gold text-game-gold' : 'border-game-teal/40 text-game-white/70'} ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {tab.label}
                  </button>
                ))}
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded border border-game-teal/45 bg-black/70 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-game-teal hover:border-game-gold hover:text-game-gold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
          {/* Keep editor content mounted so active sliders can remain interactive while dragging. */}
          <div className={`w-full h-full pt-12 pb-2 px-2 overflow-hidden ${isGodRaysSliderDragging ? 'pointer-events-none' : ''}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
