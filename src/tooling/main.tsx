import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { ToolingApp } from './ToolingApp';

document.documentElement.classList.add('proto-tooling-page');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToolingApp />
  </React.StrictMode>
);
