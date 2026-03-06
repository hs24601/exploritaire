
export const VERTEX_SHADER = `
precision highp float;
precision highp int;

attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;
attribute vec3 aEntityTranslation;
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

void main(void) {
    vTextureCoord = aTextureCoord;
    vTextureAlpha = aEntityColor.a;
    vTextureLayerIndex = aEntityProperties[1];
    
    float combinedProperties = aEntityProperties[3];
    bool hasShadowMitigation = (combinedProperties > 0.9 && combinedProperties < 1.9);
    bool isLightEmitter = (combinedProperties > 9.9 && combinedProperties < 10.9);
    bool isFlippedX = (combinedProperties > 19.9 && combinedProperties < 20.9);
    bool isBillboard = (combinedProperties > 29.9);

    if (isFlippedX) {
        vTextureCoord.x = aEntityProperties[2] - aTextureCoord.x + aEntityProperties[0];
    }

    vec3 animatedOffset = aVertexPosition;
    if (aVertexPosition.y > 0.01) { 
        float breath = sin(uTime * 2.0 + aEntityTranslation.x * 0.5) * 0.03;
        animatedOffset.y += breath;
        animatedOffset.x += sin(uTime * 1.5 + aEntityTranslation.z) * 0.02;
    }

    if (isBillboard) {
        vec4 viewPos = uMVMatrix * vec4(aEntityTranslation - uCameraTranslation, 1.0);
        viewPos.xyz += animatedOffset;
        gl_Position = uPMatrix * viewPos;
    } else {
        gl_Position = uPMatrix * uMVMatrix * vec4(animatedOffset + aEntityTranslation - uCameraTranslation, 1.0);
    }

    vec3 pointLighting1ColorIntensity = vec3(1.0, 1.0, 1.0);
    vec3 pointLighting2ColorIntensity = vec3(0.5, 0.5, 0.6);

    vec3 p1Loc = uPointLighting1Location;
    vec3 p2Loc = uPointLighting2Location;
    if (hasShadowMitigation) {
        p1Loc.y += 100.0;
        p2Loc.y += 20.0;
    }

    if (!isLightEmitter) {
        vec3 vectorNormal = vec3(0.0, 1.0, 0.0);
        vec3 light1Direction = normalize(p1Loc - aEntityTranslation - aVertexPosition);
        vec3 light2Direction = normalize(p2Loc - aEntityTranslation - aVertexPosition);

        float d1W = max(dot(vectorNormal, light1Direction), 0.0);
        float d2W = max(dot(vectorNormal, light2Direction), 0.0);

        vec3 sunWhiteLight = pointLighting1ColorIntensity * d1W * (uAmbientLightColor + 0.1);
        vec3 moonWhiteLight = pointLighting2ColorIntensity * d2W * uAmbientLightColor;

        vLightWeighting = uAmbientLightColorIntensity + (sunWhiteLight + moonWhiteLight) * aEntityColor.xyz;
        vLightWeightingWhiteLight = uAmbientLightColorIntensity + sunWhiteLight + moonWhiteLight;
    } else {
        vLightWeighting = vec3(1.0, 1.0, 1.0);
        vLightWeightingWhiteLight = vec3(1.0, 1.0, 1.0);
    }
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

void main(void) {
    vec4 color;
    if (vTextureLayerIndex < 0.5) color = texture2D(uTextureSampler0, vTextureCoord);
    else if (vTextureLayerIndex < 1.5) color = texture2D(uTextureSampler1, vTextureCoord);
    else if (vTextureLayerIndex < 2.5) color = texture2D(uTextureSampler2, vTextureCoord);
    else if (vTextureLayerIndex < 3.5) color = texture2D(uTextureSampler3, vTextureCoord);
    else if (vTextureLayerIndex < 4.5) color = texture2D(uTextureSampler4, vTextureCoord);
    else if (vTextureLayerIndex < 5.5) color = texture2D(uTextureSampler5, vTextureCoord);
    else if (vTextureLayerIndex < 6.5) color = texture2D(uTextureSampler6, vTextureCoord);
    else color = texture2D(uTextureSampler7, vTextureCoord);

    if (length(color.rgb) < 0.01) {
        color = vec4(0.9, 0.9, 0.9, 1.0);
    }

    vec3 lightWeighting = vLightWeighting;
    vec3 fragColor = color.rgb;

    if (uRainDelta > 0.0) {
        float grayL = (lightWeighting.r + lightWeighting.g + lightWeighting.b) / 3.0;
        lightWeighting = mix(lightWeighting, vec3(grayL), uRainDelta);
        float grayF = (fragColor.r + fragColor.g + fragColor.b) / 3.0;
        fragColor = mix(fragColor, vec3(grayF), uRainDelta);
    }

    gl_FragColor = vec4(fragColor * lightWeighting, vTextureAlpha * color.a);
}
`;

export const PARTICLE_VERTEX_SHADER = `
precision highp float;
precision highp int;

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
uniform float uDelta;
uniform float uRainDelta;

varying float vParticleType;
varying vec4  vParticleColor;
varying vec3  vLightWeighting;

uniform vec3 uPointLighting1Location;
uniform vec3 uPointLighting2Location;
uniform highp vec3 uAmbientLightColorIntensity;

float hashRand(vec2 co){
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main(void){
  vParticleType = aParticleType;
  vParticleColor = aParticleColor;
  vec3 particleMovement = vec3(0.0);

  if (aParticleType < 0.9){ // raindrops
    vParticleColor.a = 0.6;
    float localTimeDelta = mod(uTimeDelta * aParticleVelocity, aParticleInitPosition.y);
    particleMovement = vec3(uCameraTranslation.x - 8.0, -localTimeDelta + aParticleInitPosition.y + uCameraTranslation.y - 3.0, uCameraTranslation.z - 25.0);
    
    // Simple ground splash detection in shader:
    // If the particle is near y=0 relative to world, we could change its appearance, 
    // but the original engine uses a separate 'Collision' particle type.
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition + aParticleTranslation + particleMovement - uCameraTranslation, 1.0);
  } else if (aParticleType < 1.9){ // terrain collisions (splashes)
    float localTimeDelta = mod(uTimeDelta * aParticleVelocity, aParticleLifetime);
    float norm = localTimeDelta / aParticleLifetime;
    
    // Explosion effect from init to dest
    particleMovement = mix(aParticleInitPosition, aParticleDestination, norm);
    particleMovement.y += sin(norm * 3.14) * 0.2; // Small hop
    
    vParticleColor.a = 1.0 - norm;
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition + aParticleTranslation + particleMovement - uCameraTranslation, 1.0);
  } else if (aParticleType < 2.9) { // entity collisions
    // ... complex logic for attached entities
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition + aParticleTranslation - uCameraTranslation, 1.0);
  }

  // Lighting
  vec3 vectorNormal = vec3(0.0, 1.0, 0.0);
  vec3 light1Dir = normalize(uPointLighting1Location - aVertexPosition);
  vec3 light2Dir = normalize(uPointLighting2Location - aVertexPosition);
  float d1W = max(dot(vectorNormal, light1Dir), 0.0);
  float d2W = max(dot(vectorNormal, light2Dir), 0.0);
  vLightWeighting = uAmbientLightColorIntensity + (vec3(1.0) * d1W + vec3(0.5, 0.5, 0.6) * d2W);
}
`;

export const PARTICLE_FRAGMENT_SHADER = `
precision highp float;
varying vec4 vParticleColor;
varying vec3 vLightWeighting;

void main(void){
  gl_FragColor = vParticleColor * vec4(vLightWeighting * 2.0, 1.0);
}
`;
