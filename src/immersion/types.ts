
export interface ImmersionEntity {
    id: number;
    textureId: string;
    position: [number, number, number];
    scale: number;
    opacity: number;
    color: [number, number, number];
    properties: {
        hasShadowMitigation: boolean;
        isLightEmitter: boolean;
        isFlippedX: boolean;
        isBillboard: boolean;
    };
    // Internal WebGL buffer indices/data could go here
}

export interface ImmersionTile {
    id: number;
    textureId: string;
    position: [number, number, number];
    color: [number, number, number];
    opacity: number;
}

export interface ImmersionCamera {
    x: number;
    y: number;
    z: number;
    pitch: number;
    yaw: number;
}

export interface TextureInfo {
    id: string;
    atlasIndex: number;
    uvs: number[]; // 12 numbers for 6 vertices (x,y per vertex)
}
