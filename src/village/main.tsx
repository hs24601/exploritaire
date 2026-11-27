import React from 'react';
import ReactDOM from 'react-dom/client';
import './village.css';
import { VillageApp } from './VillageApp';
import { GameTooltip } from '../proto/components/GameTooltip';
import { CardJumboProvider } from '../proto/components/CardJumbo';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CardJumboProvider><VillageApp /></CardJumboProvider>
    <GameTooltip enableTitles />
  </React.StrictMode>,
);
