import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { ProtoVariant } from './ProtoVariant';
import { ExploreGolfVariant } from '../golf/ExploreGolfVariant';
import { HOLD_LOG_ENABLED } from './holdLog';
import { HoldLogOverlay } from './components/HoldLogOverlay';
import { GameTooltip } from './components/GameTooltip';
import { GYRO_LOG_ENABLED, GyroDiagnostics } from './components/GyroDiagnostics';
import { CardJumboProvider } from './components/CardJumbo';
import { MediaReady } from './components/MediaReady';
import { CombatSandbox } from './components/CombatSandbox';
import { BushSandbox } from './components/BushSandbox';
import { KhadCompare } from './components/KhadCompare';

const isHearthExploration = new URLSearchParams(window.location.search).get('scenario') === 'ember-explore';
const isCombatSandbox = new URLSearchParams(window.location.search).has('combatsbx');
const isBushSandbox = new URLSearchParams(window.location.search).has('bushsbx');
const isKhadCompare = new URLSearchParams(window.location.search).has('khad-compare');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>

    <GameTooltip />
    {HOLD_LOG_ENABLED ? <HoldLogOverlay /> : null}
    {GYRO_LOG_ENABLED ? <GyroDiagnostics /> : null}
    {isKhadCompare ? <MediaReady><CardJumboProvider><KhadCompare /></CardJumboProvider></MediaReady> : isBushSandbox ? <BushSandbox /> : isCombatSandbox ? <CardJumboProvider><CombatSandbox /></CardJumboProvider> : isHearthExploration ? <ExploreGolfVariant /> : <MediaReady><CardJumboProvider><ProtoVariant /></CardJumboProvider></MediaReady>}
  </React.StrictMode>,
);
