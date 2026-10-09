import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { ProtoVariant } from './ProtoVariant';
import { ExploreGolfVariant } from '../golf/ExploreGolfVariant';
import { DevContextMenu } from './DevContextMenu';
import { HOLD_LOG_ENABLED } from './holdLog';
import { HoldLogOverlay } from './components/HoldLogOverlay';
import { GameTooltip } from './components/GameTooltip';
import { GYRO_LOG_ENABLED, GyroDiagnostics } from './components/GyroDiagnostics';

const isHearthExploration = new URLSearchParams(window.location.search).get('scenario') === 'ember-explore';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DevContextMenu />
    <GameTooltip />
    {HOLD_LOG_ENABLED ? <HoldLogOverlay /> : null}
    {GYRO_LOG_ENABLED ? <GyroDiagnostics /> : null}
    {isHearthExploration ? <ExploreGolfVariant /> : <ProtoVariant />}
  </React.StrictMode>,
);
