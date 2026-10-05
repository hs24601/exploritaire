import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { ProtoVariant } from './ProtoVariant';
import { ExploreGolfVariant } from '../golf/ExploreGolfVariant';
import { DevContextMenu } from './DevContextMenu';

const isHearthExploration = new URLSearchParams(window.location.search).get('scenario') === 'ember-explore';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DevContextMenu />
    {isHearthExploration ? <ExploreGolfVariant /> : <ProtoVariant />}
  </React.StrictMode>,
);
