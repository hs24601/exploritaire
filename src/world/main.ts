import { WorldEngine } from './WorldEngine';

const canvas = document.getElementById('world-canvas') as HTMLCanvasElement;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const engine = new WorldEngine(canvas);
engine.start();

// Expose for console debugging
(window as any).__worldEngine = engine;
