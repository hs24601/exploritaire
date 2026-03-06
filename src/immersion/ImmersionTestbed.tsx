
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ImmersionEngine } from './ImmersionEngine';

export const ImmersionTestbed: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ImmersionEngine | null>(null);
    const [camera, setCamera] = useState({ x: 0, y: 1.5, z: 8, pitch: -10, yaw: 0 });
    const [todInfo, setTodInfo] = useState({ hour: 12 });
    const isDragging = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!canvasRef.current) return;
        
        const engine = new ImmersionEngine(canvasRef.current);
        engineRef.current = engine;

        // Load assets
        engine.loadAtlas(0, '/assets/Bluevee.png').then(() => {
            engine.registerSprite({
                id: 'bluevee',
                atlasIndex: 0,
                uvs: [0,0, 0,1, 1,1, 0,0, 1,0, 1,1]
            });

            // Clear grid and set up specific test case
            engine.clearWorld();

            // 1. Ground tiles for context
            for (let z = -5; z < 5; z++) {
                for (let x = -2; x < 2; x++) {
                    engine.addTile({
                        id: z * 10 + x,
                        textureId: 'grass',
                        position: [x, 0, z],
                        color: [0.5, 0.5, 0.5],
                        opacity: 1
                    });
                }
            }

            // 2. Three cards spanning away from origin (z=0)
            const cardDistances = [2, 4, 6]; // Spanning away
            cardDistances.forEach((dist, i) => {
                engine.addEntity({
                    id: 2000 + i,
                    textureId: 'bluevee',
                    position: [0, 0, -dist], // Increasing distance along Z
                    scale: 1.5,
                    opacity: 1,
                    color: [1, 1, 1],
                    properties: {
                        hasShadowMitigation: false,
                        isLightEmitter: false,
                        isFlippedX: false,
                        isBillboard: true
                    }
                });
            });

            engine.updateBuffers();
        });

        let frameId: number;
        const loop = () => {
            engine.render();
            setTodInfo({ hour: engine.getTod().getHour() });
            frameId = requestAnimationFrame(loop);
        };
        loop();

        return () => cancelAnimationFrame(frameId);
    }, []);

    useEffect(() => {
        if (engineRef.current) engineRef.current.setCamera(camera);
    }, [camera]);

    const onMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };

        setCamera(c => ({
            ...c,
            yaw: c.yaw - dx * 0.2,
            pitch: Math.max(-80, Math.min(80, c.pitch - dy * 0.2))
        }));
    };

    const onMouseUp = () => isDragging.current = false;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const speed = 0.2;
        const rad = THREE.MathUtils.degToRad(camera.yaw);
        switch (e.key) {
            case 'w': setCamera(c => ({ ...c, x: c.x - Math.sin(rad) * speed, z: c.z - Math.cos(rad) * speed })); break;
            case 's': setCamera(c => ({ ...c, x: c.x + Math.sin(rad) * speed, z: c.z + Math.cos(rad) * speed })); break;
            case 'a': setCamera(c => ({ ...c, x: c.x - Math.cos(rad) * speed, z: c.z + Math.sin(rad) * speed })); break;
            case 'd': setCamera(c => ({ ...c, x: c.x + Math.cos(rad) * speed, z: c.z - Math.sin(rad) * speed })); break;
        }
    };

    const formatHour = (h: number) => {
        const hh = Math.floor(h);
        const mm = Math.floor((h % 1) * 60);
        return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
    };

    return (
        <div 
            style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', cursor: isDragging.current ? 'grabbing' : 'grab' }} 
            onKeyDown={handleKeyDown} 
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            tabIndex={0}
        >
            <canvas 
                ref={canvasRef} 
                width={window.innerWidth} 
                height={window.innerHeight} 
                style={{ display: 'block' }}
            />
            <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', pointerEvents: 'none', fontFamily: 'monospace', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px' }}>
                <h3 style={{ margin: 0 }}>Exploritaire Immersion</h3>
                <p style={{ margin: '5px 0' }}>WASD: Navigate | Drag: Pivot Camera</p>
                <p style={{ margin: '5px 0', fontSize: '1.2em', color: '#ffcc00' }}>Time: {formatHour(todInfo.hour)}</p>
                <div style={{ fontSize: '0.8em', opacity: 0.7 }}>
                    Cam: {camera.x.toFixed(1)}, {camera.z.toFixed(1)} | Yaw: {camera.yaw.toFixed(0)}°
                </div>
            </div>
        </div>
    );
};
