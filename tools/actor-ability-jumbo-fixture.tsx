// Isolated browser fixture; never imported by the game or production build.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CardJumboProvider } from '../src/proto/components/CardJumbo';
import { TradingCard } from '../src/proto/components/TradingCard';
import '../src/index.css';

createRoot(document.getElementById('root')!).render(
  <CardJumboProvider><TradingCard id="hero" title="Hero" state="foundation" art={null} /></CardJumboProvider>,
);
