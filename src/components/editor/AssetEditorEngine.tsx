import { AssetEditorModal } from './AssetEditorModal';
import type { AssetEditorPaneDefinition, AssetEditorTabId } from './types';

export function AssetEditorEngine({
  open,
  onClose,
  activeTab,
  onTabChange,
  panes,
  isGodRaysSliderDragging,
  hideForOverlay,
}: {
  open: boolean;
  onClose: () => void;
  activeTab: AssetEditorTabId;
  onTabChange: (tab: AssetEditorTabId) => void;
  panes: AssetEditorPaneDefinition[];
  isGodRaysSliderDragging: boolean;
  hideForOverlay?: boolean;
}) {
  const activePane = panes.find((pane) => pane.id === activeTab) ?? panes[0] ?? null;

  return (
    <AssetEditorModal
      open={open}
      onClose={onClose}
      tabs={panes.map((pane) => ({ id: pane.id, label: pane.label, disabled: pane.disabled }))}
      activeTab={activePane?.id ?? activeTab}
      onTabChange={onTabChange}
      isGodRaysSliderDragging={isGodRaysSliderDragging}
      hideForOverlay={hideForOverlay}
    >
      {activePane?.render() ?? null}
    </AssetEditorModal>
  );
}
