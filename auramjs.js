/**
 * Auram Particle Engine
 * A reactive audio visualizer using Three.js and custom GLSL shaders.
 */

class AudioManager {
  constructor() {
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.isMic = false;
    this.stream = null;
    this.dataArray = null;
    this.frequencyData = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 512;
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.initialized = true;
  }

  async toggleMic() {
    if (!window.isSecureContext && window.location.protocol !== 'localhost:') {
      alert('Microphone access requires a Secure Context (HTTPS or localhost). Please run this via a local server.');
      return false;
    }

    if (!this.initialized) await this.init();
    
    // Always attempt to resume context on user interaction
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    if (this.isMic) {
      this.stopMic();
      return false;
    } else {
      const success = await this.startMic();
      return success;
    }
  }

  async startMic() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not available');
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (this.source) {
        this.source.disconnect();
      }
      
      this.source = this.context.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);
      this.isMic = true;
      console.log('Microphone input started');
      return true;
    } catch (err) {
      console.error('Microphone access failed:', err);
      alert('Microphone access failed: ' + err.message);
      this.isMic = false;
      return false;
    }
  }

  stopMic() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    this.isMic = false;
    console.log('Microphone input stopped');
  }

  update() {
    if (!this.analyser) return { bass: 0, mid: 0, high: 0, avg: 0, frequencies: [] };
    
    this.analyser.getByteFrequencyData(this.frequencyData);
    
    let sum = 0;
    let bassSum = 0;
    let midSum = 0;
    let highSum = 0;
    
    const len = this.frequencyData.length;
    const bassLimit = Math.floor(len * 0.1);
    const midLimit = Math.floor(len * 0.5);
    
    for (let i = 0; i < len; i++) {
      const val = this.frequencyData[i] / 255.0;
      sum += val;
      if (i < bassLimit) bassSum += val;
      else if (i < midLimit) midSum += val;
      else highSum += val;
    }
    
    const avg = sum / len;
    return {
      bass: bassSum / bassLimit,
      mid: midSum / (midLimit - bassLimit),
      high: highSum / (len - midLimit),
      avg: avg,
      frequencies: this.frequencyData
    };
  }
}

class AuramVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    
    this.particles = null;
    this.particleCount = 70000; // Slightly more particles for the volume
    
    this.init();
  }

  init() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.position.z = 100;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const frequencies = new Float32Array(this.particleCount);
    const ages = new Float32Array(this.particleCount * 2);

    for (let i = 0; i < this.particleCount; i++) {
      // Create a wide-field distribution (surrounding the camera)
      const x = (Math.random() - 0.5) * 400;
      const y = (Math.random() - 0.5) * 400;
      const z = (Math.random() - 0.5) * 600; // Deep field
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      
      frequencies[i] = Math.random();
      
      ages[i * 2] = Math.random() * 100;
      ages[i * 2 + 1] = 100 + Math.random() * 100;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('frequency', new THREE.BufferAttribute(frequencies, 1));
    geometry.setAttribute('age', new THREE.BufferAttribute(ages, 2));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_bass: { value: 0 },
        u_mid: { value: 0 },
        u_high: { value: 0 },
        u_frequencyAvg: { value: 0 },
        u_hueStart: { value: 0.55 },
        u_hueRange: { value: 0.35 },
        u_texture: { value: new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/disc.png') },
        u_frequencyScale: { value: 3.5 },
        u_frequencyAvgScale: { value: 2.0 },
        u_noiseScale: { value: 2.5 },
        u_particleSizeMin: { value: 0.8 },
        u_particleSizeScale: { value: 1.5 },
        u_applyNoise: { value: true },
        u_displacementScale: { value: 12.0 },
        u_particleDirection: { value: 1.0 },
        u_particleSpeed: { value: 0.4 },
        u_displacementDirection: { value: 1.0 }
      },
      vertexShader: document.getElementById('particle-vert').textContent,
      fragmentShader: document.getElementById('particle-frag').textContent,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(audioData, time) {
    if (this.particles) {
      const uniforms = this.particles.material.uniforms;
      uniforms.u_time.value = time;
      uniforms.u_bass.value = audioData.bass;
      uniforms.u_mid.value = audioData.mid;
      uniforms.u_high.value = audioData.high;
      uniforms.u_frequencyAvg.value = audioData.avg;
      
      // Gentle camera movement through the field
      this.camera.position.z = Math.sin(time * 0.05) * 20 + 120;
      this.camera.rotation.z = time * 0.02;
    }
    
    this.renderer.render(this.scene, this.camera);
  }
}

// Main Application Logic
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('auram-canvas');
  const micBtn = document.getElementById('mic-toggle-btn');
  const micIcon = document.getElementById('mic-icon');
  const musicIcon = document.getElementById('music-icon');
  const playBtn = document.getElementById('play-pause');
  
  const audio = new AudioManager();
  const visualizer = new AuramVisualizer(canvas);
  
  let startTime = Date.now();
  let isRunning = false;

  const animate = () => {
    requestAnimationFrame(animate);
    const time = (Date.now() - startTime) * 0.001;
    const audioData = audio.update();
    visualizer.render(audioData, time);
  };

  micBtn.addEventListener('click', async () => {
    const isMicActive = await audio.toggleMic();
    if (isMicActive) {
      micBtn.classList.add('active');
      micIcon.style.display = 'none';
      musicIcon.style.display = 'block';
    } else {
      micBtn.classList.remove('active');
      micIcon.style.display = 'block';
      musicIcon.style.display = 'none';
    }
    
    if (!isRunning) {
      isRunning = true;
      playBtn.textContent = 'PAUSE';
    }
  });

  playBtn.addEventListener('click', async () => {
    if (!audio.initialized) await audio.init();
    
    if (isRunning) {
      isRunning = false;
      playBtn.textContent = 'PLAY';
    } else {
      isRunning = true;
      playBtn.textContent = 'PAUSE';
      if (audio.context.state === 'suspended') await audio.context.resume();
    }
  });

  // Start the loop
  animate();
});
