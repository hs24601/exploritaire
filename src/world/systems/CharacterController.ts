import * as THREE from 'three';
import type { TerrainSystem } from './TerrainSystem';

export class CameraController {
  private yaw = 0;
  private pitch = -0.35;
  private distance = 9;
  private isDragging = false;
  private lastMouse = { x: 0, y: 0 };
  private sensitivity = 0.003;

  constructor(canvas: HTMLCanvasElement) {
    canvas.addEventListener('mousedown', e => {
      this.isDragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => { this.isDragging = false; });
    window.addEventListener('mousemove', e => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.yaw -= dx * this.sensitivity;
      this.pitch = Math.max(-1.3, Math.min(-0.08, this.pitch - dy * this.sensitivity));
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('wheel', e => {
      this.distance = Math.max(3, Math.min(25, this.distance + e.deltaY * 0.01));
    }, { passive: true });

    // Touch support for mobile
    let touchStart = { x: 0, y: 0 };
    canvas.addEventListener('touchstart', e => {
      this.isDragging = true;
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.lastMouse = touchStart;
    });
    window.addEventListener('touchend', () => { this.isDragging = false; });
    window.addEventListener('touchmove', e => {
      if (!this.isDragging) return;
      const dx = e.touches[0].clientX - this.lastMouse.x;
      const dy = e.touches[0].clientY - this.lastMouse.y;
      this.yaw -= dx * this.sensitivity;
      this.pitch = Math.max(-1.3, Math.min(-0.08, this.pitch - dy * this.sensitivity));
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });
  }

  update(camera: THREE.PerspectiveCamera, target: THREE.Vector3) {
    const cx = Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
    const cy = -Math.sin(this.pitch) * this.distance;
    const cz = Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;
    camera.position.set(target.x + cx, target.y + cy, target.z + cz);
    camera.lookAt(target.x, target.y + 0.8, target.z);
  }

  /** Forward direction on XZ plane, for movement relative to camera */
  get forwardYaw() { return this.yaw; }
}

export class CharacterController {
  private keys = new Set<string>();
  private yVelocity = 0;
  private isGrounded = false;

  // Expose for NatureManager + HUD
  public readonly position = new THREE.Vector3(0, 5, 0);

  constructor() {
    window.addEventListener('keydown', e => this.keys.add(e.code));
    window.addEventListener('keyup',   e => this.keys.delete(e.code));
  }

  update(dt: number, terrain: TerrainSystem, cameraYaw: number) {
    const isSprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = isSprinting ? 12 : 5;

    // Camera-relative movement direction
    const dir = new THREE.Vector3();
    const fwd = new THREE.Vector3(Math.sin(cameraYaw),  0, Math.cos(cameraYaw));
    const rgt = new THREE.Vector3(Math.cos(cameraYaw),  0, -Math.sin(cameraYaw));

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))    dir.addScaledVector(fwd, -1);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))  dir.addScaledVector(fwd, 1);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dir.addScaledVector(rgt, 1);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))  dir.addScaledVector(rgt, -1);

    if (dir.lengthSq() > 0) dir.normalize();

    this.position.x += dir.x * speed * dt;
    this.position.z += dir.z * speed * dt;

    // Jump
    if ((this.keys.has('Space')) && this.isGrounded) {
      this.yVelocity = 7;
      this.isGrounded = false;
    }

    // Gravity
    this.yVelocity -= 18 * dt;
    this.position.y += this.yVelocity * dt;

    // Snap to terrain
    const groundY = terrain.getHeight(this.position.x, this.position.z);
    const eyeHeight = 1.7;
    if (this.position.y < groundY + eyeHeight) {
      this.position.y = groundY + eyeHeight;
      if (this.yVelocity < 0) {
        this.yVelocity = 0;
        this.isGrounded = true;
      }
    } else {
      this.isGrounded = false;
    }
  }
}
