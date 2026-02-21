import type { ReactNode } from 'react';

export type AssetEditorTabId = 'actor' | 'orim' | 'card' | 'relic' | 'map' | 'godRays' | 'visuals';

export type AssetEditorTab = {
  id: AssetEditorTabId;
  label: string;
  disabled?: boolean;
};

export type AssetEditorPaneDefinition = {
  id: AssetEditorTabId;
  label: string;
  disabled?: boolean;
  render: () => ReactNode;
};
