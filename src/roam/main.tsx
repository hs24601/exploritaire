import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import './roam.css';
import { ProtoMap, type ProtoWorldActor } from '../proto/components/ProtoMap';
import { GameTooltip } from '../proto/components/GameTooltip';
import { materializeTiles, SAVED_TILE_DOCUMENT } from '../proto/tileEditor/runtime';
import { biomeTileSprite } from '../proto/protoData';
import { discoverTiles } from '../proto/tileDiscovery';
import { isTextEditingTarget } from '../proto/keyboardInput';
import { configureMapLightingEnvironment } from '../proto/mapLightingRenderer';
import { ROAM_LIGHTS } from './lighting';

// Only the authored world and Hero's position belong to this sandbox. No day,
// quest, battle, travel-deal or cinematic controllers are mounted here.
const authoredTiles = materializeTiles(SAVED_TILE_DOCUMENT, [], false);
const start = authoredTiles.find(tile => tile.id === 'hero-den')?.position ?? { x: 0, y: 0 };
const noSelection = () => {};
configureMapLightingEnvironment({ localLightsOnly: true });

function Roam() {
  const [tiles, setTiles] = useState(() => discoverTiles(authoredTiles, start));
  const [actors, setActors] = useState<ProtoWorldActor[]>(() => [{
    id: 'hero', label: 'Hero', location: 'table', position: { ...start },
    awakeAtHome: true, luminosity: 0,
  }]);
  const [tilted, setTilted] = useState(true);
  const mapTiles = useMemo(() => tiles.map(tile => ({
    ...tile, selected: false, sprite: biomeTileSprite(tile), exploration: 1,
  })), [tiles]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || isTextEditingTarget(event.target)) return;
      if (event.code === 'KeyO') { event.preventDefault(); setTilted(value => !value); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  return <main className="roam-stage" aria-label="Free roam world">
    <ProtoMap freeRoam initialCenter={start} biomeTiles={mapTiles}
      actors={actors} actorOrigins={actors} resourceStacks={[]} timeOfDay={0} lightSources={ROAM_LIGHTS}
      tilted={tilted} onTiltedChange={setTilted} onSelectBiome={noSelection}
      onActorExplore={(_id, from, to) => setTiles(current => discoverTiles(current, from, to))}
      onDropActorToTable={(id, position) => {
        setActors(current => current.map(actor => actor.id === id ? { ...actor, position: { ...position } } : actor));
        setTiles(current => discoverTiles(current, position));
      }} />
    <GameTooltip />
  </main>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Roam /></React.StrictMode>);
