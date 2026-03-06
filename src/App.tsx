import { CombatSandbox } from './components/combat/CombatSandbox';
import { GraphicsContext } from './contexts/GraphicsContext';
import { InteractionModeContext } from './contexts/InteractionModeContext';
import { PerspectiveProvider } from './contexts/PerspectiveContext';
import { CardScaleProvider } from './contexts/CardScaleContext';
import { useCombatLabEngine } from './hooks/useCombatLabEngine';

const TIME_SCALE_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 3, 4];

export default function App() {
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

  return (
    <PerspectiveProvider>
      <GraphicsContext.Provider value={false}>
        <InteractionModeContext.Provider value="dnd">
          <CardScaleProvider
            value={{
              zoom: 1.1,
              table: 1.25,
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
                onOpenEditor={() => {}}
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
            </div>
          </CardScaleProvider>
        </InteractionModeContext.Provider>
      </GraphicsContext.Provider>
    </PerspectiveProvider>
  );
}
