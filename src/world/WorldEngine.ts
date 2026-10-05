import * as THREE from 'three';
import { TimeOfDaySystem, LightingState } from './systems/TimeOfDaySystem';
import { TerrainSystem } from './systems/TerrainSystem';
import { SkySystem } from './systems/SkySystem';
import { FogSystem } from './systems/FogSystem';
import { CharacterController, CameraController } from './systems/CharacterController';
import { TreeSystem } from './systems/TreeSystem';
import { GeometryPoints } from './systems/GeometryPoints';
import { FoxSystem } from './systems/FoxSystem';
import { WaterSystem } from './systems/WaterSystem';
import { NatureManagerUI } from './ui/NatureManagerUI';

export class WorldEngine {
  private scene: THREE.Scene;
  public  camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private depthRT!: THREE.WebGLRenderTarget;

  private tod: TimeOfDaySystem;
  private terrain: TerrainSystem;
  private trees: TreeSystem;
  private geoPoints: GeometryPoints;
  private fox: FoxSystem;
  private water: WaterSystem;
  private sky: SkySystem;
  private fog: FogSystem;
  private character: CharacterController;
  private camCtrl: CameraController;
  private ui: NatureManagerUI;

  private hudTime: HTMLElement | null;
  private hudPos:  HTMLElement | null;
  private hudFps:  HTMLElement | null;
  private fpsBuffer: number[] = [];
  private running = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setClearColor(0x0e0318);

    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 1000);
    this.camera.position.set(0, 10, 30);

    this.buildDepthRT(canvas.width, canvas.height);

    this.tod     = new TimeOfDaySystem();
    this.terrain = new TerrainSystem();
    this.trees   = new TreeSystem(this.terrain);
    
    // Geometry Points only for the single tree (no grass)
    this.geoPoints = new GeometryPoints([], this.trees.getTreePositions());

    // Spawn Fox near the single tree
    const foxX = 2, foxZ = 12;
    this.fox = new FoxSystem(foxX, foxZ, this.terrain);
    this.fox.points.position.y += 0.05;
    
    // Orient fox tail to camera
    const foxPos = new THREE.Vector3(foxX, 0, foxZ);
    const camPos = new THREE.Vector3(0, 20, 30); 
    const dir = new THREE.Vector3().subVectors(foxPos, camPos).setY(0).normalize();
    this.fox.points.rotation.y = -Math.atan2(dir.z, dir.x);

    // Hide polygon meshes
    this.trees.mesh.visible = false;
    this.terrain.mesh.visible = false;
    this.trees.wireMesh.visible = true;

    this.water = new WaterSystem();
    this.sky   = new SkySystem();
    this.fog   = new FogSystem(this.scene);

    this.scene.add(this.trees.wireMesh);
    this.scene.add(this.geoPoints.points);
    this.scene.add(this.fox.points);
    this.scene.add(this.water.mesh);
    this.scene.add(this.sky.mesh);

    const sun = new THREE.DirectionalLight(0xfff4e0, 0.8);
    sun.position.set(100, 200, 50);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0x304050, 0.4));

    this.character = new CharacterController();
    this.camCtrl   = new CameraController(canvas);
    this.character.position.set(0, this.terrain.getHeight(0, 30) + 2, 30);

    this.ui = new NatureManagerUI(this);
    this.hudTime = document.getElementById('hud-time');
    this.hudPos  = document.getElementById('hud-pos');
    this.hudFps  = document.getElementById('hud-fps');

    window.addEventListener('resize', () => this.onResize());
  }

  private buildDepthRT(w: number, h: number) {
    if (this.depthRT) this.depthRT.dispose();
    this.depthRT = new THREE.WebGLRenderTarget(w, h);
    const dt = new THREE.DepthTexture(w, h);
    dt.format = THREE.DepthFormat;
    dt.type   = THREE.UnsignedShortType;
    this.depthRT.depthTexture = dt;
    this.depthRT.depthBuffer  = true;
  }

  start() { this.running = true; this.clock.start(); this.loop(); }
  stop() { this.running = false; }

  private frameCount = 0;
  private loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    this.frameCount++;
    try {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const lighting = this.tod.update(dt);
      this.character.update(dt, this.terrain, this.camCtrl.forwardYaw);
      this.camCtrl.update(this.camera, this.character.position);
      this.sky.followCamera(this.camera.position);
      this.sky.update(lighting);
      this.fog.update(lighting, this.scene);
      const fogColor = this.fog.getCurrentColor();
      const fogDensity = this.fog.getCurrentDensity();
      this.trees.update(dt, lighting.sunDir, lighting.ambientColor, lighting.ambientIntensity, fogColor, fogDensity, this.camera.position);
      this.geoPoints.update(dt, fogDensity, this.camera.position);
      this.fox.update(dt, fogDensity, this.camera.position);
      this.water.update(dt, this.camera, fogColor, fogDensity);

      this.water.mesh.visible = false;
      this.sky.mesh.visible   = false;
      this.renderer.setRenderTarget(this.depthRT);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      this.water.mesh.visible = true;
      this.sky.mesh.visible   = true;
      this.water.setDepthTexture(this.depthRT.depthTexture as THREE.DepthTexture);
      this.renderer.render(this.scene, this.camera);

      this.fpsBuffer.push(dt > 0 ? 1 / dt : 60);
      if (this.fpsBuffer.length > 30) this.fpsBuffer.shift();
      if (this.frameCount % 20 === 0) {
        const avgFps = Math.round(this.fpsBuffer.reduce((a, b) => a + b, 0) / this.fpsBuffer.length);
        const t = this.tod.getTime();
        const h = Math.floor(t * 24);
        const m = Math.floor((t * 24 - h) * 60);
        const p = this.character.position;
        if (this.hudTime) this.hudTime.textContent = `Time: ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        if (this.hudPos)  this.hudPos.textContent  = `Pos: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
        if (this.hudFps)  this.hudFps.textContent  = `FPS: ${avgFps}`;
      }
    } catch (err) { console.error('[WorldEngine] Loop error:', err); }
  };

  getTOD()     { return this.tod; }
  getTerrain() { return this.terrain; }
  getGrass()   { return null; }
  getWater()   { return this.water; }
  getSky()     { return this.sky; }
  getFog()     { return this.fog; }

  private onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = w; this.canvas.height = h;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h); this.buildDepthRT(w, h);
  }
}
