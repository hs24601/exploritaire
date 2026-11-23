import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { CardJumboProvider } from '../proto/components/CardJumbo';
import { GameTooltip } from '../proto/components/GameTooltip';
import { RoamRescueVariant } from './RoamRescueVariant';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><CardJumboProvider><GameTooltip/><RoamRescueVariant/></CardJumboProvider></React.StrictMode>);
