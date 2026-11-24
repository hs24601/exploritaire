import { useMemo, useState } from 'react';
import { CombatSandbox } from './components/combat/CombatSandbox';
import { ActorEditor } from './components/ActorEditor';
import { RelicEditor } from './components/RelicEditor';
import { VisualsEditor } from './components/VisualsEditor';
import { GraphicsContext } from './contexts/GraphicsContext';
import { InteractionModeContext } from './contexts/InteractionModeContext';
import { PerspectiveProvider } from './contexts/PerspectiveContext';
import { CardScaleProvider } from './contexts/CardScaleContext';
import { useCombatLabEngine } from './hooks/useCombatLabEngine';
import { AssetEditorEngine } from './components/editor/AssetEditorEngine';
import type { AssetEditorPaneDefinition, AssetEditorTabId } from './components/editor/types';
import type { ActorDefinition, RelicDefinition, RelicInstance } from './engine/types';
import { ACTOR_DEFINITIONS } from './engine/actors';
import { ACTOR_DECK_TEMPLATES } from './engine/actorDecks';
import { ORIM_DEFINITIONS } from './engine/orims';
import { RELIC_DEFINITIONS } from './engine/relics';

const TIME_SCALE_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 3, 4];

export default function App() {
  const [assetEditorOpen, setAssetEditorOpen] = useState(false);
  const [assetEditorTab, setAssetEditorTab] = useState<AssetEditorTabId>('visuals');
  const [actorDefinitions, setActorDefinitions] = useState<ActorDefinition[]>(ACTOR_DEFINITIONS);
  const [actorDeckTemplates, setActorDeckTemplates] = useState<Record<string, typeof ACTOR_DECK_TEMPLATES[string]>>(ACTOR_DECK_TEMPLATES);
  const [relicDefinitions, setRelicDefinitions] = useState<RelicDefinition[]>(RELIC_DEFINITIONS);
  const [equippedRelics, setEquippedRelics] = useState<RelicInstance[]>([]);
  const {
    gameState,
    actions,
    selectedCard,
    validFoundationsForSelected,
    noValidMoves,
    noValidMovesPlayer,
    noValidMovesEnemy,
    tableauCanPlay,
    timeScale,
    cycleTimeScale,
    setFixedTimeScale,
    isGamePaused,
    togglePause,
    highPerformanceTimer,
  } = useCombatLabEngine();
  const editorPanes = useMemo<AssetEditorPaneDefinition[]>(() => ([
    {
      id: 'actor',
      label: 'Actors',
      render: () => (
        <div className="h-full min-h-0 overflow-hidden">
          <ActorEditor
            embedded
            onClose={() => setAssetEditorOpen(false)}
            definitions={actorDefinitions}
            deckTemplates={actorDeckTemplates}
            orimDefinitions={ORIM_DEFINITIONS}
            onChange={setActorDefinitions}
            onDeckChange={setActorDeckTemplates}
          />
        </div>
      ),
    },
    {
      id: 'relic',
      label: 'Relics',
      render: () => (
        <div className="h-full min-h-0 overflow-hidden">
          <RelicEditor
            embedded
            onClose={() => setAssetEditorOpen(false)}
            definitions={relicDefinitions}
            equippedRelics={equippedRelics}
            onDefinitionsChange={setRelicDefinitions}
            onEquippedRelicsChange={setEquippedRelics}
          />
        </div>
      ),
    },
    {
      id: 'visuals',
      label: 'Visuals',
      render: () => <VisualsEditor />,
    },
  ]), [actorDefinitions, actorDeckTemplates, relicDefinitions, equippedRelics]);

  return (
    <PerspectiveProvider>
      <GraphicsContext.Provider value={false}>
        <InteractionModeContext.Provider value="dnd">
          <CardScaleProvider
            value={{
              zoom: 1.1,
              board: 1.25,
              hand: 1.15,
              drag: 1.2,
              jumbo: 1,
            }}
          >
            <div className="h-screen w-screen overflow-hidden bg-black">
              <CombatSandbox
                open
                isLabMode
                onClose={() => {}}
                onOpenEditor={() => {
                  setAssetEditorTab('actor');
                  setAssetEditorOpen(true);
                }}
                gameState={gameState}
                actions={actions}
                timeScale={timeScale}
                timeScaleOptions={TIME_SCALE_OPTIONS}
                onCycleTimeScale={cycleTimeScale}
                onSetTimeScale={setFixedTimeScale}
                isGamePaused={isGamePaused}
                onTogglePause={togglePause}
                highPerformanceTimer={highPerformanceTimer}
                selectedCard={selectedCard}
                validFoundationsForSelected={validFoundationsForSelected}
                noValidMoves={noValidMoves}
                noValidMovesPlayer={noValidMovesPlayer}
                noValidMovesEnemy={noValidMovesEnemy}
                tableauCanPlay={tableauCanPlay}
              />
              <AssetEditorEngine
                open={assetEditorOpen}
                onClose={() => setAssetEditorOpen(false)}
                activeTab={assetEditorTab}
                onTabChange={setAssetEditorTab}
                panes={editorPanes}
                isGodRaysSliderDragging={false}
              />
            </div>
          </CardScaleProvider>
        </InteractionModeContext.Provider>
      </GraphicsContext.Provider>
    </PerspectiveProvider>
  );
}
