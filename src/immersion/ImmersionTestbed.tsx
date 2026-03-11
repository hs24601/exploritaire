
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ImmersionEngine } from './ImmersionEngine';

export const ImmersionTestbed: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ImmersionEngine | null>(null);
    const [camera, setCamera] = useState({ x: -2.1, y: 1.5, z: -0.5, pitch: -15, yaw: 6 });
    const [renderMode, setRenderMode] = useState(0); // 0: Std, 1: Cyl, 2: V-Fold, 3: Stack
    const [todInfo, setTodInfo] = useState({ hour: 12 });
    const isDragging = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    // Initialize Engine and Loop ONCE
    useEffect(() => {
        if (!canvasRef.current) return;
        const engine = new ImmersionEngine(canvasRef.current);
        engineRef.current = engine;

        let frameId: number;
        const loop = () => {
            engine.render();
            setTodInfo({ hour: engine.getTod().getHour() });
            frameId = requestAnimationFrame(loop);
        };
        loop();

        return () => cancelAnimationFrame(frameId);
    }, []);

    // Repopulate World on mode change
    useEffect(() => {
        const engine = engineRef.current;
        if (!engine) return;

        const game = 'spirit';
        const baseUrl = 'https://assets.codepen.io/264161/';
        
        Promise.all([
            engine.loadAtlas(0, `${baseUrl}${game}-background.jpg`),
            engine.loadAtlas(1, `${baseUrl}${game}-logo.png`),
            engine.loadAtlas(2, `${baseUrl}${game}-foreground.png`)
        ]).then(() => {
            const standardUVs = [0,0, 0,1, 1,1, 0,0, 1,0, 1,1];
            engine.registerSprite({ id: 'spirit-bg', atlasIndex: 0, uvs: standardUVs });
            engine.registerSprite({ id: 'spirit-logo', atlasIndex: 1, uvs: standardUVs });
            engine.registerSprite({ id: 'spirit-fgr', atlasIndex: 2, uvs: standardUVs });

            engine.clearWorld();

            for (let z = -10; z < 10; z++) {
                for (let x = -10; x < 10; x++) {
                    engine.addTile({
                        id: z * 20 + x,
                        textureId: 'grass',
                        position: [x, 0, z],
                        color: [0.3, 0.4, 0.3],
                        opacity: 1
                    });
                }
            }

            const cardPositions = [-4, 0, 4]; 
            cardPositions.forEach((xPos, i) => {
                const baseZ = -2 - (i * 4); 
                const isFirst = i === 0;
                
                engine.addEntity({
                    id: 5000 + i,
                    textureId: 'spirit-bg',
                    position: [xPos, 0, baseZ],
                    rotation: isFirst ? [0, Math.PI, 0] : [0, 0, 0],
                    scale: 2,
                    opacity: 1,
                    color: [1, 1, 1],
                    properties: {
                        hasShadowMitigation: false,
                        isLightEmitter: false,
                        isFlippedX: false,
                        isBillboard: !isFirst,
                        parallaxDepth: -0.5,
                        renderMode: renderMode,
                        thickness: 0.25 // Thick base
                    },
                    layers: [
                        // Strut for Logo
                        {
                            id: 8000 + i,
                            textureId: 'grass', // Placeholder for cardboard color
                            position: [xPos, 0, baseZ],
                            rotation: isFirst ? [0, Math.PI, 0] : [0, 0, 0],
                            scale: 0.1, // Very narrow
                            opacity: 1,
                            color: [0.4, 0.35, 0.3], // Cardboard brown
                            properties: {
                                hasShadowMitigation: true,
                                isLightEmitter: false,
                                isFlippedX: false,
                                isBillboard: !isFirst,
                                parallaxDepth: 0.2, // Match logo depth
                                isSupportStrut: true
                            }
                        },
                        // Strut for Foreground
                        {
                            id: 9000 + i,
                            textureId: 'grass',
                            position: [xPos + 0.5, 0, baseZ],
                            rotation: isFirst ? [0, Math.PI, 0] : [0, 0, 0],
                            scale: 0.1,
                            opacity: 1,
                            color: [0.4, 0.35, 0.3],
                            properties: {
                                hasShadowMitigation: true,
                                isLightEmitter: false,
                                isFlippedX: false,
                                isBillboard: !isFirst,
                                parallaxDepth: 0.8, // Match fgr depth
                                isSupportStrut: true
                            }
                        },
                        {
                            id: 6000 + i,
                            textureId: 'spirit-logo',
                            position: [xPos, 0.8, baseZ],
                            rotation: isFirst ? [0, Math.PI, 0] : [0, 0, 0],
                            scale: 2,
                            opacity: 1,
                            color: [1, 1, 1],
                            properties: {
                                hasShadowMitigation: true,
                                isLightEmitter: false,
                                isFlippedX: false,
                                isBillboard: !isFirst,
                                parallaxDepth: 0.2,
                                renderMode: renderMode
                            }
                        },
                        {
                            id: 7000 + i,
                            textureId: 'spirit-fgr',
                            position: [xPos, 0.4, baseZ],
                            rotation: isFirst ? [0, Math.PI, 0] : [0, 0, 0],
                            scale: 2,
                            opacity: 1,
                            color: [1, 1, 1],
                            properties: {
                                hasShadowMitigation: true,
                                isLightEmitter: false,
                                isFlippedX: false,
                                isBillboard: !isFirst,
                                parallaxDepth: 0.8,
                                renderMode: renderMode
                            }
                        }
                    ]
                });
            });

            engine.updateBuffers();
        });
    }, [renderMode]);

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

    const modes = [
        { id: 0, label: 'Standard (Spherical)' },
        { id: 1, label: 'Cylindrical (Lean)' }
    ];

    return (
        <div 
            style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', cursor: isDragging.current ? 'grabbing' : 'grab' }} 
            onKeyDown={handleKeyDown} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={() => isDragging.current = false} onMouseLeave={() => isDragging.current = false}
            tabIndex={0}
        >
            <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} style={{ display: 'block' }} />
            
            {/* Info Panel */}
            <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', pointerEvents: 'none', fontFamily: 'monospace', background: 'rgba(0,0,0,0.5)', padding: '15px', borderRadius: '5px' }}>
                <h3 style={{ margin: 0, fontSize: '1.5em' }}>Exploritaire Immersion - Style Lab</h3>
                <p style={{ margin: '5px 0', fontSize: '1.1em' }}>WASD: Navigate | Drag: Pivot Camera</p>
                <p style={{ margin: '5px 0', fontSize: '1.4em', color: '#ffcc00' }}>Time: {formatHour(todInfo.hour)}</p>
                <div style={{ fontSize: '1.2em', opacity: 0.9 }}>
                    Cam: {camera.x.toFixed(1)}, {camera.y.toFixed(1)}, {camera.z.toFixed(1)} | Yaw: {camera.yaw.toFixed(0)}°
                </div>
            </div>

            {/* Mode Toggles */}
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', background: 'rgba(0,0,0,0.7)', padding: '15px', borderRadius: '10px', border: '1px solid #444' }}>
                {modes.map(m => (
                    <button
                        key={m.id}
                        onClick={() => setRenderMode(m.id)}
                        style={{
                            padding: '8px 15px',
                            background: renderMode === m.id ? '#ffcc00' : '#333',
                            color: renderMode === m.id ? '#000' : '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            transition: 'all 0.2s'
                        }}
                    >
                        {m.label}
                    </button>
                ))}
            </div>
        </div>
    );
};
