
import * as THREE from 'three';
import { VERTEX_SHADER, FRAGMENT_SHADER, PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER } from './Shaders';
import { ImmersionEntity, ImmersionTile, ImmersionCamera, TextureInfo } from './types';
import { TimeOfDaySystem, LightingState } from './TimeOfDaySystem';
import { TerrainSystem } from './TerrainSystem';

export class ImmersionEngine {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;
    private particleProgram: WebGLProgram;
    private attribs: any = {};
    private uniforms: any = {};
    private pAttribs: any = {};
    private pUniforms: any = {};
    
    private textureAtlases: (WebGLTexture | null)[] = [null, null, null, null, null, null, null, null];
    private textureInfo: Map<string, TextureInfo> = new Map();
    
    private entities: ImmersionEntity[] = [];
    private tiles: ImmersionTile[] = [];
    
    private camera: ImmersionCamera = { x: 0, y: 1, z: 5, pitch: 0, yaw: 0 };
    private tod: TimeOfDaySystem = new TimeOfDaySystem();
    private terrain: TerrainSystem = new TerrainSystem(20, 20);
    private lastLighting: LightingState | null = null;

    private lastTime: number = performance.now();
    private timeDelta: number = 0;

    private buffers: any = {
        tiles: { pos: null, uv: null, color: null, props: null, count: 0 },
        entities: { pos: null, uv: null, trans: null, color: null, props: null, count: 0 },
        particles: { interleaved: null, count: 0 }
    };

    constructor(canvas: HTMLCanvasElement) {
        const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
        if (!gl) throw new Error("WebGL not supported");
        this.gl = gl;
        
        this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
        this.particleProgram = this.createProgram(PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER);
        
        this.initLocations();
        this.initParticleLocations();
        
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clearColor(0.1, 0.1, 0.1, 1.0);
        
        this.initBuffers();
    }

    private createProgram(vsSource: string, fsSource: string): WebGLProgram {
        const gl = this.gl;
        const vs = this.compileShader(vsSource, gl.VERTEX_SHADER);
        const fs = this.compileShader(fsSource, gl.FRAGMENT_SHADER);
        const program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Link error");
        return program;
    }

    private compileShader(source: string, type: number): WebGLShader {
        const gl = this.gl;
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Compile error");
        return shader;
    }

    private initLocations() {
        const gl = this.gl;
        const p = this.program;
        this.attribs = {
            pos: gl.getAttribLocation(p, 'aVertexPosition'),
            uv: gl.getAttribLocation(p, 'aTextureCoord'),
            trans: gl.getAttribLocation(p, 'aEntityTranslation'),
            color: gl.getAttribLocation(p, 'aEntityColor'),
            props: gl.getAttribLocation(p, 'aEntityProperties')
        };
        this.uniforms = {
            pMatrix: gl.getUniformLocation(p, 'uPMatrix'),
            mvMatrix: gl.getUniformLocation(p, 'uMVMatrix'),
            camTrans: gl.getUniformLocation(p, 'uCameraTranslation'),
            ambientLightIntensity: gl.getUniformLocation(p, 'uAmbientLightColorIntensity'),
            ambientLightColor: gl.getUniformLocation(p, 'uAmbientLightColor'),
            sunLoc: gl.getUniformLocation(p, 'uPointLighting1Location'),
            moonLoc: gl.getUniformLocation(p, 'uPointLighting2Location'),
            rainDelta: gl.getUniformLocation(p, 'uRainDelta'),
            uTime: gl.getUniformLocation(p, 'uTime')
        };
        gl.useProgram(p);
        for (let i = 0; i < 8; i++) {
            const loc = gl.getUniformLocation(p, `uTextureSampler${i}`);
            this.uniforms[`sampler${i}`] = loc;
            gl.uniform1i(loc, i);
        }
    }

    private initParticleLocations() {
        const gl = this.gl;
        const p = this.particleProgram;
        this.pAttribs = {
            pos: gl.getAttribLocation(p, 'aVertexPosition'),
            initPos: gl.getAttribLocation(p, 'aParticleInitPosition'),
            vel: gl.getAttribLocation(p, 'aParticleVelocity'),
            type: gl.getAttribLocation(p, 'aParticleType'),
            dest: gl.getAttribLocation(p, 'aParticleDestination'),
            trans: gl.getAttribLocation(p, 'aParticleTranslation'),
            life: gl.getAttribLocation(p, 'aParticleLifetime'),
            color: gl.getAttribLocation(p, 'aParticleColor')
        };
        this.pUniforms = {
            mvMatrix: gl.getUniformLocation(p, 'uMVMatrix'),
            pMatrix: gl.getUniformLocation(p, 'uPMatrix'),
            camTrans: gl.getUniformLocation(p, 'uCameraTranslation'),
            timeDelta: gl.getUniformLocation(p, 'uTimeDelta'),
            delta: gl.getUniformLocation(p, 'uDelta'),
            rainDelta: gl.getUniformLocation(p, 'uRainDelta'),
            sunLoc: gl.getUniformLocation(p, 'uPointLighting1Location'),
            moonLoc: gl.getUniformLocation(p, 'uPointLighting2Location'),
            ambientLightIntensity: gl.getUniformLocation(p, 'uAmbientLightColorIntensity')
        };
    }

    private initBuffers() {
        const gl = this.gl;
        this.buffers.tiles.pos = gl.createBuffer();
        this.buffers.tiles.uv = gl.createBuffer();
        this.buffers.tiles.color = gl.createBuffer();
        this.buffers.tiles.props = gl.createBuffer();
        
        this.buffers.entities.pos = gl.createBuffer();
        this.buffers.entities.uv = gl.createBuffer();
        this.buffers.entities.trans = gl.createBuffer();
        this.buffers.entities.color = gl.createBuffer();
        this.buffers.entities.props = gl.createBuffer();

        this.buffers.particles.interleaved = gl.createBuffer();
    }

    public setCamera(cam: Partial<ImmersionCamera>) {
        // Automatically adjust Y to match terrain + offset
        if (cam.x !== undefined && cam.z !== undefined) {
            const h = this.terrain.getHeight(cam.x, cam.z);
            cam.y = h + 1.5; // eye height
        }
        this.camera = { ...this.camera, ...cam };
    }

    public addEntity(entity: ImmersionEntity) {
        // Snap entity to terrain Y
        const h = this.terrain.getHeight(entity.position[0], entity.position[2]);
        entity.position[1] = h;
        this.entities.push(entity);
    }

    public addTile(tile: ImmersionTile) {
        this.tiles.push(tile);
    }

    public loadAtlas(index: number, url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const gl = this.gl;
                const tex = gl.createTexture()!;
                gl.activeTexture(gl.TEXTURE0 + index);
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                const isPot = (n: number) => (n & (n - 1)) === 0;
                if (isPot(img.width) && isPot(img.height)) {
                    gl.generateMipmap(gl.TEXTURE_2D);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                } else {
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                }
                this.textureAtlases[index] = tex;
                resolve();
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    public registerSprite(info: TextureInfo) {
        this.textureInfo.set(info.id, info);
    }

    public clearWorld() {
        this.entities = [];
        this.tiles = [];
    }

    public updateBuffers() {
        const gl = this.gl;
        
        // Tiles (Meshed based on Terrain)
        if (this.tiles.length > 0) {
            const count = this.tiles.length * 6;
            const pos = new Float32Array(count * 3);
            const uv = new Float32Array(count * 2);
            const color = new Float32Array(count * 4);
            const props = new Float32Array(count * 4);
            
            this.tiles.forEach((tile, i) => {
                const b = i * 18; const u = i * 12; const c = i * 24; const p = i * 24;
                const tex = this.textureInfo.get(tile.textureId);
                
                const x = tile.position[0];
                const z = tile.position[2];
                // corner heights
                const h00 = this.terrain.getHeight(x, z);
                const h10 = this.terrain.getHeight(x + 1, z);
                const h01 = this.terrain.getHeight(x, z + 1);
                const h11 = this.terrain.getHeight(x + 1, z + 1);

                const verts = [
                    0, h00, 0,  0, h01, 1,  1, h11, 1,
                    0, h00, 0,  1, h10, 0,  1, h11, 1
                ];

                for (let j = 0; j < 6; j++) {
                    pos[b + j*3 + 0] = verts[j*3 + 0] + x;
                    pos[b + j*3 + 1] = verts[j*3 + 1];
                    pos[b + j*3 + 2] = verts[j*3 + 2] + z;
                    if (tex) { uv[u+j*2+0]=tex.uvs[j*2+0]; uv[u+j*2+1]=tex.uvs[j*2+1]; props[p+j*4+1]=tex.atlasIndex; }
                    color[c+j*4+0]=tile.color[0]; color[c+j*4+1]=tile.color[1]; color[c+j*4+2]=tile.color[2]; color[c+j*4+3]=tile.opacity;
                }
            });
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.tiles.pos); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.tiles.uv); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.tiles.color); gl.bufferData(gl.ARRAY_BUFFER, color, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.tiles.props); gl.bufferData(gl.ARRAY_BUFFER, props, gl.STATIC_DRAW);
            this.buffers.tiles.count = count;
        }

        // Entities
        this.sortEntities();
        if (this.entities.length > 0) {
            const count = this.entities.length * 6;
            const pos = new Float32Array(count * 3);
            const uv = new Float32Array(count * 2);
            const trans = new Float32Array(count * 3);
            const color = new Float32Array(count * 4);
            const props = new Float32Array(count * 4);

            this.entities.forEach((ent, i) => {
                const b = i * 18; const u = i * 12;
                const sx = ent.scale; 
                const sy = ent.scale * (7/5); // Standard 5:7 aspect ratio
                const tex = this.textureInfo.get(ent.textureId);
                const verts = [-sx/2, sy, 0,  -sx/2, 0, 0,  sx/2, 0, 0, -sx/2, sy, 0,   sx/2, sy, 0,  sx/2, 0, 0];
                let combined = 0;
                if (ent.properties.hasShadowMitigation) combined += 1;
                if (ent.properties.isLightEmitter) combined += 10;
                if (ent.properties.isFlippedX) combined += 20;
                if (ent.properties.isBillboard) combined += 30;

                for (let j = 0; j < 6; j++) {
                    pos[b+j*3+0]=verts[j*3+0]; pos[b+j*3+1]=verts[j*3+1]; pos[b+j*3+2]=verts[j*3+2];
                    if (tex) { uv[u+j*2+0]=tex.uvs[j*2+0]; uv[u+j*2+1]=tex.uvs[j*2+1]; props[i*24+j*4+1]=tex.atlasIndex; }
                    trans[b+j*3+0]=ent.position[0]; trans[b+j*3+1]=ent.position[1]; trans[b+j*3+2]=ent.position[2];
                    color[i*24+j*4+0]=ent.color[0]; color[i*24+j*4+1]=ent.color[1]; color[i*24+j*4+2]=ent.color[2]; color[i*24+j*4+3]=ent.opacity;
                    props[i*24+j*4+3]=combined;
                }
            });
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.entities.pos); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.entities.uv); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.entities.trans); gl.bufferData(gl.ARRAY_BUFFER, trans, gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.entities.color); gl.bufferData(gl.ARRAY_BUFFER, color, gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.entities.props); gl.bufferData(gl.ARRAY_BUFFER, props, gl.DYNAMIC_DRAW);
            this.buffers.entities.count = count;
        }
        
        // Setup Particles
        const rainCount = 1500;
        const splashCount = 500;
        const totalP = rainCount + splashCount;
        const pData = new Float32Array(totalP * 6 * 19); 
        const qw = 0.01; const qh = 0.15;
        const rverts = [-qw, qh, 0,  -qw, 0, 0,  qw, 0, 0, -qw, qh, 0,   qw, qh, 0,  qw, 0, 0];

        for (let i = 0; i < rainCount; i++) {
            const base = i * 6 * 19;
            const rx = Math.random() * 40 - 20; const ry = Math.random() * 15 + 5; const rz = Math.random() * 40 - 20;
            const rv = Math.random() * 0.5 + 0.5;
            for (let v = 0; v < 6; v++) {
                const idx = base + v * 19;
                pData[idx+0]=rverts[v*3+0]; pData[idx+1]=rverts[v*3+1]; pData[idx+2]=rverts[v*3+2];
                pData[idx+3]=rx; pData[idx+4]=ry; pData[idx+5]=rz; pData[idx+6]=rv; pData[idx+7]=0.0;
                pData[idx+15]=1; pData[idx+16]=1; pData[idx+17]=1; pData[idx+18]=0.6;
            }
        }

        const sw = 0.05;
        const sverts = [-sw, sw, 0, -sw, 0, 0, sw, 0, 0, -sw, sw, 0, sw, sw, 0, sw, 0, 0];
        for (let i = 0; i < splashCount; i++) {
            const base = (rainCount + i) * 6 * 19;
            const rx = Math.random() * 40 - 20; const rz = Math.random() * 40 - 20;
            const rv = Math.random() * 0.2 + 0.1;
            const h = this.terrain.getHeight(rx, rz);
            const dx = rx + (Math.random() - 0.5) * 0.5;
            const dz = rz + (Math.random() - 0.5) * 0.5;
            const dh = this.terrain.getHeight(dx, dz);
            for (let v = 0; v < 6; v++) {
                const idx = base + v * 19;
                pData[idx+0]=sverts[v*3+0]; pData[idx+1]=sverts[v*3+1]; pData[idx+2]=sverts[v*3+2];
                pData[idx+3]=rx; pData[idx+4]=h + 0.01; pData[idx+5]=rz;
                pData[idx+6]=rv; pData[idx+7]=1.0; 
                pData[idx+8]=dx; pData[idx+9]=dh + 0.01; pData[idx+10]=dz;
                pData[idx+14]=1.0; 
                pData[idx+15]=1; pData[idx+16]=1; pData[idx+17]=1; pData[idx+18]=0.8;
            }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.particles.interleaved);
        gl.bufferData(gl.ARRAY_BUFFER, pData, gl.STATIC_DRAW);
        this.buffers.particles.count = totalP * 6;
    }

    public render() {
        const gl = this.gl;
        const now = performance.now();
        const delta = now - this.lastTime;
        this.lastTime = now;
        this.timeDelta += 0.001 * delta;
        this.lastLighting = this.tod.update(delta);

        const canvas = gl.canvas as HTMLCanvasElement;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const aspect = canvas.width / canvas.height;
        const pMatrix = new THREE.Matrix4().makePerspective(-aspect*0.1, aspect*0.1, 0.1, -0.1, 0.1, 1000.0);
        const mvMatrix = new THREE.Matrix4()
            .multiply(new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(-this.camera.pitch)))
            .multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(-this.camera.yaw)));

        this.renderWorld(pMatrix, mvMatrix);
        if (this.lastLighting.rainDelta > 0 || true) { this.renderParticles(pMatrix, mvMatrix, delta); }
    }

    private renderWorld(pMatrix: THREE.Matrix4, mvMatrix: THREE.Matrix4) {
        const gl = this.gl;
        if (!this.lastLighting) return;
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.uniforms.pMatrix, false, pMatrix.elements);
        gl.uniformMatrix4fv(this.uniforms.mvMatrix, false, mvMatrix.elements);
        gl.uniform3f(this.uniforms.camTrans, this.camera.x, this.camera.y, this.camera.z);
        gl.uniform1f(this.uniforms.uTime, this.timeDelta);
        gl.uniform1f(this.uniforms.rainDelta, 0.2);
        gl.uniform3fv(this.uniforms.ambientLightIntensity, this.lastLighting.ambientIntensity);
        gl.uniform3fv(this.uniforms.ambientLightColor, this.lastLighting.ambientColor);
        gl.uniform3fv(this.uniforms.sunLoc, this.lastLighting.sunPosition);
        gl.uniform3fv(this.uniforms.moonLoc, this.lastLighting.moonPosition);

        for (let i = 0; i < 8; i++) {
            if (this.textureAtlases[i]) {
                gl.activeTexture(gl.TEXTURE0 + i);
                gl.bindTexture(gl.TEXTURE_2D, this.textureAtlases[i]);
            }
        }

        if (this.buffers.tiles.count > 0) {
            this.bindAttrib(this.attribs.pos, this.buffers.tiles.pos, 3);
            this.bindAttrib(this.attribs.uv, this.buffers.tiles.uv, 2);
            this.bindAttrib(this.attribs.color, this.buffers.tiles.color, 4);
            this.bindAttrib(this.attribs.props, this.buffers.tiles.props, 4);
            gl.disableVertexAttribArray(this.attribs.trans);
            gl.vertexAttrib3f(this.attribs.trans, 0, 0, 0);
            gl.drawArrays(gl.TRIANGLES, 0, this.buffers.tiles.count);
        }

        if (this.buffers.entities.count > 0) {
            gl.depthMask(false);
            this.bindAttrib(this.attribs.pos, this.buffers.entities.pos, 3);
            this.bindAttrib(this.attribs.uv, this.buffers.entities.uv, 2);
            this.bindAttrib(this.attribs.trans, this.buffers.entities.trans, 3);
            this.bindAttrib(this.attribs.color, this.buffers.entities.color, 4);
            this.bindAttrib(this.attribs.props, this.buffers.entities.props, 4);
            gl.drawArrays(gl.TRIANGLES, 0, this.buffers.entities.count);
            gl.depthMask(true);
        }
    }

    private renderParticles(pMatrix: THREE.Matrix4, mvMatrix: THREE.Matrix4, delta: number) {
        const gl = this.gl;
        if (!this.lastLighting) return;
        gl.useProgram(this.particleProgram);
        gl.depthMask(false);
        gl.uniformMatrix4fv(this.pUniforms.pMatrix, false, pMatrix.elements);
        gl.uniformMatrix4fv(this.pUniforms.mvMatrix, false, mvMatrix.elements);
        gl.uniform3f(this.pUniforms.camTrans, this.camera.x, this.camera.y, this.camera.z);
        gl.uniform1f(this.pUniforms.timeDelta, this.timeDelta);
        gl.uniform1f(this.pUniforms.delta, delta);
        gl.uniform1f(this.pUniforms.rainDelta, 0.2);
        gl.uniform3fv(this.pUniforms.sunLoc, this.lastLighting.sunPosition);
        gl.uniform3fv(this.pUniforms.moonLoc, this.lastLighting.moonPosition);
        gl.uniform3fv(this.pUniforms.ambientLightIntensity, this.lastLighting.ambientIntensity);

        const stride = 19 * 4;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.particles.interleaved);
        this.setupPAttrib(this.pAttribs.pos, 3, stride, 0);
        this.setupPAttrib(this.pAttribs.initPos, 3, stride, 12);
        this.setupPAttrib(this.pAttribs.vel, 1, stride, 24);
        this.setupPAttrib(this.pAttribs.type, 1, stride, 28);
        this.setupPAttrib(this.pAttribs.dest, 3, stride, 32);
        this.setupPAttrib(this.pAttribs.trans, 3, stride, 44);
        this.setupPAttrib(this.pAttribs.life, 1, stride, 56);
        this.setupPAttrib(this.pAttribs.color, 4, stride, 60);
        gl.drawArrays(gl.TRIANGLES, 0, this.buffers.particles.count);
        gl.depthMask(true);
    }

    private setupPAttrib(loc: number, size: number, stride: number, offset: number) {
        if (loc === -1) return;
        this.gl.enableVertexAttribArray(loc);
        this.gl.vertexAttribPointer(loc, size, this.gl.FLOAT, false, stride, offset);
    }

    private bindAttrib(loc: number, buffer: WebGLBuffer, size: number) {
        if (loc === -1) return;
        this.gl.enableVertexAttribArray(loc);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.vertexAttribPointer(loc, size, this.gl.FLOAT, false, 0, 0);
    }

    private sortEntities() {
        this.entities.sort((a, b) => {
            const distA = Math.pow(a.position[0] - this.camera.x, 2) + 
                          Math.pow(a.position[1] - this.camera.y, 2) + 
                          Math.pow(a.position[2] - this.camera.z, 2);
            const distB = Math.pow(b.position[0] - this.camera.x, 2) + 
                          Math.pow(b.position[1] - this.camera.y, 2) + 
                          Math.pow(b.position[2] - this.camera.z, 2);
            return distB - distA; // Back to front
        });
    }

    public getTod() { return this.tod; }
}
