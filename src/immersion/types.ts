
export interface ImmersionEntity {
    id: number;
    textureId: string;
    position: [number, number, number];
    rotation: [number, number, number]; // Pitch, Yaw, Roll
    scale: number;
    opacity: number;
    color: [number, number, number];
    properties: {
        hasShadowMitigation: boolean;
        isLightEmitter: boolean;
        isFlippedX: boolean;
        isBillboard: boolean;
        parallaxDepth?: number;
        renderMode?: number; // 0: Std, 1: Cylindrical
        thickness?: number; // Physical depth of the card
        isSupportStrut?: boolean; // If true, bridges depth between layers
    };

    layers?: ImmersionEntity[]; 
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
    uvs: number[]; 
}
