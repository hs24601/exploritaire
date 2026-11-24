import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { BanksThinSlice } from './BanksThinSlice';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BanksThinSlice />
  </React.StrictMode>,
);
