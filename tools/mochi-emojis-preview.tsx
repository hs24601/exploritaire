import React from 'react';
import { createRoot } from 'react-dom/client';
import { MochiEmoji } from '../src/proto/components/MochiEmoji';
import { MOCHI_EMOJI_EMOTIONS } from '../src/proto/mochiEmojis';

createRoot(document.getElementById('root')!).render(<main style={{ color: '#fff3dd', background: '#20252e', padding: 24, fontFamily: 'sans-serif', minHeight: '100vh', boxSizing: 'border-box' }}>
  <h1>Mochi watercolor emojis</h1>
  <p>Eight still expressions • 512 px frames • transparent RGBA</p>
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
    {MOCHI_EMOJI_EMOTIONS.map(emotion => <section key={emotion} style={{ background: '#353d48', borderRadius: 12, padding: 16 }}>
      <h2 style={{ fontSize: 16 }}>{emotion}</h2>
      <MochiEmoji emotion={emotion} size={192} label={`Mochi: ${emotion}`} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><MochiEmoji emotion={emotion} size={64} /><MochiEmoji emotion={emotion} size={32} /></div>
    </section>)}
  </div>
</main>);

