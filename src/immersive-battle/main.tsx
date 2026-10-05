import React from 'react';
import ReactDOM from 'react-dom/client';
import { ImmersiveBattle } from './ImmersiveBattle';
import { ImmersiveBattleProvider } from '../contexts/ImmersiveBattleContext';
import { PerspectiveProvider } from '../contexts/PerspectiveContext';
import { CardScaleProvider } from '../contexts/CardScaleContext';
import '../index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PerspectiveProvider>
      <CardScaleProvider value={1}>
        <ImmersiveBattleProvider>
          <ImmersiveBattle />
        </ImmersiveBattleProvider>
      </CardScaleProvider>
    </PerspectiveProvider>
  </React.StrictMode>
);
