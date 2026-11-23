import { CirDiveSandbox } from './proto/components/CirDiveSandbox';
import { ProtoEditor } from './proto/components/ProtoEditor';
import { ActorEntityEditor } from './proto/components/ActorEntityEditor';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const suppressContextMenu = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
};
const suppressSelection = (event: Event) => {
  if (['actorEditor','ProtoEditor'].some(key=>new URLSearchParams(window.location.search).has(key))) return;
  event.preventDefault();
};
document.addEventListener('contextmenu', suppressContextMenu, { capture: true });
window.addEventListener('contextmenu', suppressContextMenu, { capture: true });
document.addEventListener('selectstart', suppressSelection, { capture: true });
document.addEventListener('dragstart', suppressSelection, { capture: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {new URLSearchParams(window.location.search).has('cirsbx') ? <CirDiveSandbox /> : <>
    {new URLSearchParams(window.location.search).has('ProtoEditor') ? <ProtoEditor /> : new URLSearchParams(window.location.search).has('actorEditor') ? <ActorEntityEditor /> : <App />}
    </>}
  </StrictMode>
);

