import React from 'react'
import ReactDOM from 'react-dom/client'
import { GolfGame } from './GolfGame'
import '../index.css'
import { ImmersiveBattleProvider } from '../contexts/ImmersiveBattleContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ImmersiveBattleProvider>
      <GolfGame />
    </ImmersiveBattleProvider>
  </React.StrictMode>,
)
