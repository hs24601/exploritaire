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
}: {
  open: boolean;
  onClose: () => void;
  tabs: AssetEditorTab[];
  activeTab: AssetEditorTabId;
  onTabChange: (tab: AssetEditorTabId) => void;
  children: ReactNode;
  isGodRaysSliderDragging: boolean;
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
    <div className="fixed inset-0 z-[10030]">
      {!isGodRaysSliderDragging && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      )}
      <div className="relative w-full h-full flex items-start justify-center p-3 sm:p-4">
        <div className={`relative w-[min(1320px,calc(100vw-1rem))] h-[min(920px,calc(100vh-1rem))] menu-text ${isGodRaysSliderDragging ? 'bg-transparent' : ''}`}>
          {/* Conditionally hide the header and tabs */}
          {!isGodRaysSliderDragging && (
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between z-20">
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
              <div />
            </div>
          )}
          {/* Always render children, which contains the GodRaysEditor and the active slider */}
          {/* If isGodRaysSliderDragging is true, the GodRaysEditor will need to ensure only the active slider is visible */}
          <div className={`w-full h-full pt-8 pb-1 px-1 overflow-hidden ${isGodRaysSliderDragging ? 'pointer-events-none' : ''}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
