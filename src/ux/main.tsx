import React from 'react';
import ReactDOM from 'react-dom/client';
import WireframeViewer from './Wireframes';
import '../index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WireframeViewer />
  </React.StrictMode>
);
