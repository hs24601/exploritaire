import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const suppressContextMenu = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
};
const suppressSelection = (event: Event) => {
  event.preventDefault();
};
document.addEventListener('contextmenu', suppressContextMenu, { capture: true });
window.addEventListener('contextmenu', suppressContextMenu, { capture: true });
document.addEventListener('selectstart', suppressSelection, { capture: true });
document.addEventListener('dragstart', suppressSelection, { capture: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
