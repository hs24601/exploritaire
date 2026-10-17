import React from 'react';
import {createRoot} from 'react-dom/client';
import {TableauLandscape} from '../src/proto/components/TableauLandscape';
import '../src/index.css';
createRoot(document.getElementById('root')!).render(<div style={{display:'flex',gap:16,padding:16,background:'#29251f'}}>{['berry-patch-sparse','berry-patch'].map(kind=><section key={kind} style={{position:'relative',isolation:'isolate',width:'calc(50vw - 24px)',height:'calc(100vh - 32px)'}}><TableauLandscape tileType={kind}/></section>)}</div>);
