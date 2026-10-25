import { MomentumDesignSandbox } from './components/MomentumDesignSandbox';
import { ActorMotifSandbox } from './components/ActorMotifSandbox';
import { DemDraftSandbox } from './components/DemDraftSandbox';
import { KeruDraftSandbox } from './components/KeruDraftSandbox';
import { KhadCombatSandbox } from './components/KhadCombatSandbox';
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
import { WoodsSandbox } from './components/WoodsSandbox';
import { KhadCompare } from './components/KhadCompare';
import { HeroFurSandbox } from './components/HeroFurSandbox';

const isHearthExploration = new URLSearchParams(window.location.search).get('scenario') === 'ember-explore';
const isCombatSandbox = new URLSearchParams(window.location.search).has('combatsbx');
const isBushSandbox = new URLSearchParams(window.location.search).has('bushsbx');
const isWoodsSandbox = new URLSearchParams(window.location.search).has('woodsbx');
const isKhadCompare = new URLSearchParams(window.location.search).has('khad-compare');
const isHeroFurSandbox = new URLSearchParams(window.location.search).has('herosbx');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>

    <GameTooltip />
    {HOLD_LOG_ENABLED ? <HoldLogOverlay /> : null}
    {GYRO_LOG_ENABLED ? <GyroDiagnostics /> : null}
    {new URLSearchParams(window.location.search).has('motifsbx') ? <ActorMotifSandbox /> : new URLSearchParams(window.location.search).has('kerusbx') ? <KeruDraftSandbox /> : new URLSearchParams(window.location.search).has('demsbx') ? <DemDraftSandbox /> : new URLSearchParams(window.location.search).has('momentumsbx') ? <MomentumDesignSandbox /> : new URLSearchParams(window.location.search).has('khad-combat') ? <KhadCombatSandbox /> : isHeroFurSandbox ? <HeroFurSandbox /> : isKhadCompare ? <MediaReady><CardJumboProvider><KhadCompare /></CardJumboProvider></MediaReady> : isBushSandbox ? <BushSandbox /> : isWoodsSandbox ? <WoodsSandbox /> : isCombatSandbox ? <CardJumboProvider><CombatSandbox /></CardJumboProvider> : isHearthExploration ? <ExploreGolfVariant /> : <MediaReady><CardJumboProvider><ProtoVariant /></CardJumboProvider></MediaReady>}
  </React.StrictMode>,
);

