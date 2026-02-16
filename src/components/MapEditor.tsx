// src/components/MapEditor.tsx
import { memo, useState, useMemo } from 'react';
import { mainWorldMap } from '../data/worldMap';
import type { WorldMapCell, PointOfInterest } from '../engine/worldMapTypes';
import { ExplorationMap, type ExplorationMapNode } from './ExplorationMap';
import type { Direction } from './Compass';

interface MapEditorProps {
  embedded: boolean;
  onClose: () => void;
}

const TOOLBAR_HEIGHT = 40;

export const MapEditor = memo(function MapEditor({
  embedded,
  onClose,
}: MapEditorProps) {
  const [worldMap, setWorldMap] = useState(mainWorldMap);
  const [scale, setScale] = useState(1);
  const [activeTool, setActiveTool] = useState<'select' | 'poi' | 'paintbrush'>('select');
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  const pointsOfInterestMap = useMemo(() => 
    new Map(worldMap.pointsOfInterest.map(poi => [poi.id, poi])), 
    [worldMap.pointsOfInterest]
  );
  
  const mapNodes = useMemo<ExplorationMapNode[]>(() => {
    return worldMap.cells.map(cell => {
      return {
        id: `${cell.gridPosition.col},${cell.gridPosition.row}`,
        x: cell.gridPosition.col,
        y: cell.gridPosition.row,
        z: 0,
        heading: 'N' as Direction, // Default heading
        visits: 1, // Treat all as visited for editor visibility
      };
    });
  }, [worldMap.cells]);
  
  const selectedCell = useMemo(() => {
    if (!selectedCellId) return null;
    const [col, row] = selectedCellId.split(',').map(Number);
    return worldMap.cells.find(c => c.gridPosition.col === col && c.gridPosition.row === row) ?? null;
  }, [selectedCellId, worldMap.cells]);

  const selectedPoi = selectedCell ? pointsOfInterestMap.get(selectedCell.poiId) : null;

  return (
    <div className="w-full h-full flex flex-col bg-game-bg-dark/80 text-game-white">
      {/* Toolbar */}
      <div
        className="w-full bg-black/30 flex-shrink-0 flex items-center justify-between px-3"
        style={{ height: TOOLBAR_HEIGHT }}
      >
        <div className="flex items-center gap-4">
          <div className="text-xs font-bold tracking-[2px]">MAP EDITOR</div>
          <div className="h-4 w-px bg-white/20" />
          {/* Tool selection */}
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTool('select')} className={`text-xs px-2 py-0.5 rounded ${activeTool === 'select' ? 'bg-game-gold text-black' : 'bg-white/10'}`}>Select</button>
            <button onClick={() => setActiveTool('poi')} className={`text-xs px-2 py-0.5 rounded ${activeTool === 'poi' ? 'bg-game-gold text-black' : 'bg-white/10'}`}>POI</button>
            <button onClick={() => setActiveTool('paintbrush')} className={`text-xs px-2 py-0.5 rounded ${activeTool === 'paintbrush' ? 'bg-game-gold text-black' : 'bg-white/10'}`}>Paintbrush</button>
          </div>
        </div>

        <div className="flex items-center gap-3">
           {/* Scale slider */}
          <label className="text-xs">Scale:</label>
          <input
            type="range"
            min="0.2"
            max="2"
            step="0.1"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-32"
          />
          <span className="text-xs w-8">{scale.toFixed(1)}x</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full h-full flex">
        {/* Grid Viewport */}
        <div className="w-3/4 h-full bg-game-bg-dark overflow-auto p-4 flex items-center justify-center">
          <div
            style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
            className="relative"
          >
            <ExplorationMap
              nodes={mapNodes}
              edges={[]} // No edges for now, just the grid of nodes
              currentNodeId={selectedCellId}
              alignmentMode="north" // Keep the map aligned north for editor
              onNodeClick={setSelectedCellId}
              isEditorMode={true}
            />
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-1/4 h-full bg-black/20 p-3 border-l border-white/10 overflow-y-auto">
          {activeTool === 'select' && (
            <div>
              <h3 className="text-sm font-bold mb-2">Selection Details</h3>
              {selectedCell && selectedPoi ? (
                <div className="flex flex-col gap-2 text-xs">
                  <div><span className="font-bold text-white/60">Position:</span> {`(${selectedCell.gridPosition.col}, ${selectedCell.gridPosition.row})`}</div>
                  <div><span className="font-bold text-white/60">POI Name:</span> {selectedPoi.name}</div>
                  <div><span className="font-bold text-white/60">POI ID:</span> {selectedPoi.id}</div>
                  <div><span className="font-bold text-white/60">POI Type:</span> {selectedPoi.type}</div>
                  {selectedPoi.biomeId && (
                    <div><span className="font-bold text-white/60">Biome ID:</span> {selectedPoi.biomeId}</div>
                  )}
                  <div><span className="font-bold text-white/60">Traversal Difficulty:</span> {selectedCell.traversalDifficulty}</div>
                  <p className="text-white/60 mt-2">{selectedPoi.description}</p>
                </div>
              ) : (
                <p className="text-xs text-white/60">Select a cell to see its properties.</p>
              )}
            </div>
          )}
          {activeTool === 'poi' && (
            <div>
              <h3 className="text-sm font-bold mb-2">POI Authoring</h3>
              <p className="text-xs text-white/60">Click a cell to add or edit a Point of Interest.</p>
              <div className="mt-4 p-2 border border-dashed border-white/20 rounded">
                <p className="text-center text-xs text-white/40">POI Form</p>
              </div>
            </div>
          )}
          {activeTool === 'paintbrush' && (
            <div>
              <h3 className="text-sm font-bold mb-2">Traversal Difficulty Paintbrush</h3>
              <p className="text-xs text-white/60">Click and drag on the grid to "paint" traversal difficulty values.</p>
              <div className="mt-4 p-2 border border-dashed border-white/20 rounded">
                 <label className="text-xs">Difficulty Value:</label>
                 <input type="number" defaultValue="1" className="w-full bg-black/50 p-1 rounded mt-1 text-xs" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});