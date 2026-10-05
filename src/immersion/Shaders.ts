
export const VERTEX_SHADER = `
precision highp float;
precision highp int;

attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;
attribute vec3 aEntityTranslation;
attribute vec3 aEntityRotation;
attribute vec4 aEntityColor;
attribute vec4 aEntityProperties;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform vec3 uCameraTranslation;
uniform float uTime;
uniform vec3 uPointLighting1Location;
uniform vec3 uPointLighting2Location;
uniform highp vec3 uAmbientLightColorIntensity;
uniform highp vec3 uAmbientLightColor;

varying vec2 vTextureCoord;
varying vec3 vLightWeighting;
varying vec3 vLightWeightingWhiteLight;
varying float vTextureAlpha;
varying float vTextureLayerIndex;
varying float vIsBackFace;
varying float vParallaxFactor;
varying float vSliceIndex;

void main(void) {
    vTextureAlpha = aEntityColor.a;
    vTextureLayerIndex = aEntityProperties[1];
    
    float sliceIndex = aEntityProperties[0];
    vSliceIndex = sliceIndex;
    float combinedProperties = aEntityProperties[3];
    
    // Decoding combined properties:
    // 0-9: Mode
    // 10-19: Shadow/Light
    // 20-29: Flipped X
    // 30-39: Is Billboard
    // 40-49: Is Strut
    float renderMode = mod(combinedProperties, 10.0);
    bool isBillboard = (combinedProperties > 29.9);
    bool isStrut = (combinedProperties > 39.9);
    float parallaxFactor = aEntityProperties[2];
    vParallaxFactor = parallaxFactor;

    vec3 localOffset = aVertexPosition;
    vec3 worldToCam = uCameraTranslation - aEntityTranslation;
    vec3 dirToCam = normalize(worldToCam);
    float distSq = dot(worldToCam, worldToCam);
    
    if (isBillboard) {
        if (renderMode < 0.5) {
            // MODE 0: Standard
        } 
        else {
            // MODE 1: Cylindrical
            float horizontalAngle = atan(dirToCam.x, dirToCam.z);
            float cosA = cos(horizontalAngle); float sinA = sin(horizontalAngle);
            float lx = aVertexPosition.x;
            vec3 worldRotated = vec3(lx * cosA, aVertexPosition.y, -lx * sinA);
            localOffset = (uMVMatrix * vec4(worldRotated, 0.0)).xyz;
            float leanFactor = clamp(uCameraTranslation.y - aEntityTranslation.y, -2.0, 5.0) * 0.15;
            localOffset.z += (aVertexPosition.y / 1.4) * leanFactor;
        }
        vIsBackFace = 0.0;
    } else {
        // WORLD FIXED
        float yaw = aEntityRotation.y;
        float cosA = cos(yaw); float sinA = sin(yaw);
        float rx = aVertexPosition.x * cosA + aVertexPosition.z * sinA;
        float rz = -aVertexPosition.x * sinA + aVertexPosition.z * cosA;
        vec3 worldRotated = vec3(rx, aVertexPosition.y, rz);
        localOffset = (uMVMatrix * vec4(worldRotated, 0.0)).xyz;

        vec3 normal = vec3(sin(yaw), 0.0, cos(yaw));
        vIsBackFace = (dot(normal, dirToCam) < 0.0) ? 1.0 : 0.0;
    }

    // Thickness
    localOffset.z -= sliceIndex * 0.02;

    // HIGH INTENSITY PARALLAX
    float falloff = clamp(15.0 / (distSq + 1.0), 0.3, 1.0);
    float effectiveParallax = parallaxFactor * falloff;

    float interactiveScale = 1.0 + (effectiveParallax * 0.05); 
    localOffset.xy *= interactiveScale;

    vec4 viewPos = uMVMatrix * vec4(aEntityTranslation - uCameraTranslation, 1.0);
    float distToZ = -viewPos.z;

    localOffset.x -= viewPos.x * effectiveParallax * 0.4;
    float yDiff = uCameraTranslation.y - aEntityTranslation.y;
    localOffset.y -= (yDiff + viewPos.y) * effectiveParallax * 0.4;

    if (effectiveParallax > 0.1) {
        float ySign = sign(-yDiff);
        float yMag = pow(abs(yDiff), 1.2); 
        float loomIntensity = clamp(ySign * yMag * 1.5, -0.8, 2.0);
        localOffset.z += (aVertexPosition.y * loomIntensity) * effectiveParallax;
    }

    // Z-Push
    float depthDampening = clamp(distToZ * 0.2, 0.0, 1.0);
    
    float zPushParallax = effectiveParallax;
    if (isStrut) {
        // Strut bridges between its depth and the background (-0.5)
        // High Y stays at foreground, Low Y moves to background
        float t = clamp(aVertexPosition.y * 1.2, 0.0, 1.0);
        zPushParallax = mix(-0.5 * falloff, effectiveParallax, t);
    }
    
    localOffset.z += zPushParallax * 1.2 * depthDampening; 

    gl_Position = uPMatrix * (viewPos + vec4(localOffset, 0.0));
    vTextureCoord = aTextureCoord;

    // Lighting
    vec3 p1Loc = uPointLighting1Location;
    vec3 p2Loc = uPointLighting2Location;
    vec3 vectorNormal = vec3(0.0, 1.0, 0.0);
    vec3 l1Dir = normalize(p1Loc - aEntityTranslation);
    vec3 l2Dir = normalize(p2Loc - aEntityTranslation);
    float d1W = max(dot(vectorNormal, l1Dir), 0.0);
    float d2W = max(dot(vectorNormal, l2Dir), 0.0);
    vLightWeighting = uAmbientLightColorIntensity + (vec3(1.0) * d1W + vec3(0.5, 0.5, 0.6) * d2W) * aEntityColor.xyz;
    vLightWeightingWhiteLight = uAmbientLightColorIntensity + (vec3(1.0) * d1W + vec3(0.5, 0.5, 0.6) * d2W);
}
`;

export const FRAGMENT_SHADER = `
precision highp float;
precision highp int;

uniform sampler2D uTextureSampler0;
uniform sampler2D uTextureSampler1;
uniform sampler2D uTextureSampler2;
uniform sampler2D uTextureSampler3;
uniform sampler2D uTextureSampler4;
uniform sampler2D uTextureSampler5;
uniform sampler2D uTextureSampler6;
uniform sampler2D uTextureSampler7;

uniform float uRainDelta;

varying vec2 vTextureCoord;
varying vec3 vLightWeighting;
varying vec3 vLightWeightingWhiteLight;
varying float vTextureAlpha;
varying float vTextureLayerIndex;
varying float vIsBackFace;
varying float vParallaxFactor;
varying float vSliceIndex;

void main(void) {
    if (vIsBackFace > 0.5 && vParallaxFactor > -0.4) {
        discard;
    }

    vec2 coords = vTextureCoord;
    if (vIsBackFace > 0.5) {
        coords.x = 1.0 - coords.x;
    }

    vec4 color;
    if (vTextureLayerIndex < 0.5) color = texture2D(uTextureSampler0, coords);
    else if (vTextureLayerIndex < 1.5) color = texture2D(uTextureSampler1, coords);
    else if (vTextureLayerIndex < 2.5) color = texture2D(uTextureSampler2, coords);
    else if (vTextureLayerIndex < 3.5) color = texture2D(uTextureSampler3, coords);
    else if (vTextureLayerIndex < 4.5) color = texture2D(uTextureSampler4, coords);
    else if (vTextureLayerIndex < 5.5) color = texture2D(uTextureSampler5, coords);
    else if (vTextureLayerIndex < 6.5) color = texture2D(uTextureSampler6, coords);
    else color = texture2D(uTextureSampler7, coords);

    if (length(color.rgb) < 0.01 && color.a > 0.5) {
        color = vec4(0.9, 0.9, 0.9, 1.0);
    }

    vec3 finalLight = vLightWeighting;
    if (vIsBackFace > 0.5) {
        finalLight *= 0.6;
    }
    
    if (vSliceIndex > 0.5) {
        finalLight *= 0.7;
    }

    gl_FragColor = vec4(color.rgb * finalLight, vTextureAlpha * color.a);
}
`;

export const PARTICLE_VERTEX_SHADER = `
precision highp float;
attribute vec3  aVertexPosition;
attribute vec3  aParticleInitPosition;
attribute float aParticleVelocity;
attribute float aParticleType;
attribute vec3  aParticleDestination;
attribute vec3  aParticleTranslation; 
attribute float aParticleLifetime;
attribute vec4  aParticleColor;
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform vec3 uCameraTranslation;
uniform float uTimeDelta;
varying vec4  vParticleColor;
void main(void){
  vParticleColor = aParticleColor;
  float localTimeDelta = mod(uTimeDelta * aParticleVelocity, aParticleInitPosition.y);
  vec3 particleMovement = vec3(uCameraTranslation.x - 8.0, -localTimeDelta + aParticleInitPosition.y + uCameraTranslation.y - 3.0, uCameraTranslation.z - 25.0);
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition + aParticleTranslation + particleMovement - uCameraTranslation, 1.0);
}
`;

export const PARTICLE_FRAGMENT_SHADER = `
precision highp float;
varying vec4 vParticleColor;
void main(void){
  gl_FragColor = vParticleColor;
}
`;
