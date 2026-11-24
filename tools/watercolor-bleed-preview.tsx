import React from 'react';
import { createRoot } from 'react-dom/client';
import { TileDiscoveryArt, TileDiscoveryProvider } from '../src/proto/components/TileDiscoveryArt';
import { ArtSettings } from '../src/proto/components/ArtSettings';

// Isolated visual fixture: controlled progress never depends on travel timing.
createRoot(document.getElementById('root')!).render(<>
  <ArtSettings />
  <TileDiscoveryProvider tiles={[{ id: 'wash', traversalProgress: .65 }, { id: 'ink', traversalProgress: 0 }]} reliefSketch={{ ink: 1 }}>
    <div style={{ display: 'flex', gap: 40, padding: 80, background: '#e8dfc9' }}>
      {['wash', 'ink'].map(id => <div key={id} style={{ position: 'relative', width: 300, height: 300 }}>
        <TileDiscoveryArt tileId={id} relief><svg viewBox="0 0 300 300" width="300" height="300"><path d="M50 90 Q130 20 240 80 L230 230 Q130 280 60 210Z" fill="#639b79" stroke="#252c3a" strokeWidth="4" /></svg></TileDiscoveryArt>
      </div>)}
    </div>
  </TileDiscoveryProvider>
</>);
