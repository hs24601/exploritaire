import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { GameTooltip } from '../proto/components/GameTooltip';
import { CardJumboProvider } from '../proto/components/CardJumbo';
import { MusicalTableaus } from './MusicalTableaus';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameTooltip />
    <CardJumboProvider><MusicalTableaus /></CardJumboProvider>
  </React.StrictMode>,
);
