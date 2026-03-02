import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const DICE_PARAMS = {
  segments: 40,
  edgeRadius: 0.1,
  notchRadius: 0.15,
  notchDepth: 0.09,
};

const FLOOR_Y = -7;

type DiceInstance = {
  mesh: THREE.Group;
  body: CANNON.Body;
};

interface PhysicsDiceRollerState {
  token: number;
  results: Map<number, number>;
  completed: boolean;
}

const initialRollState = (): PhysicsDiceRollerState => ({
  token: 0,
  results: new Map(),
  completed: false,
});

function createDiceMesh(): THREE.Group {
  const boxMaterialOuter = new THREE.MeshStandardMaterial({
    color: 0xfdfdfd,
    metalness: 0.3,
    roughness: 0.5,
  });
  const boxMaterialInner = new THREE.MeshStandardMaterial({
    color: 0x191919,
    roughness: 0,
    metalness: 1,
    side: THREE.DoubleSide,
  });

  const diceMesh = new THREE.Group();
  const innerMesh = new THREE.Mesh(createInnerGeometry(), boxMaterialInner);
  const outerMesh = new THREE.Mesh(createBoxGeometry(), boxMaterialOuter);
  outerMesh.castShadow = true;
  outerMesh.receiveShadow = true;
  diceMesh.add(innerMesh, outerMesh);

  return diceMesh;
}

function createDiceInstance(template: THREE.Group, scene: THREE.Scene, physicsWorld: CANNON.World): DiceInstance {
  const mesh = template.clone();
  mesh.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const castMesh = child as THREE.Mesh;
      castMesh.castShadow = true;
      castMesh.receiveShadow = true;
    }
  });
  scene.add(mesh);

  const body = new CANNON.Body({
    mass: 0.3,
    shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
    sleepTimeLimit: 0.02,
  });
  physicsWorld.addBody(body);

  return { mesh, body };
}

function createBoxGeometry(): THREE.BufferGeometry {
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1, DICE_PARAMS.segments, DICE_PARAMS.segments, DICE_PARAMS.segments);
  const positionAttr = boxGeometry.attributes.position;
  const subCubeHalfSize = 0.5 - DICE_PARAMS.edgeRadius;

  for (let i = 0; i < positionAttr.count; i += 1) {
    const position = new THREE.Vector3().fromBufferAttribute(positionAttr, i);
    const subCube = new THREE.Vector3(Math.sign(position.x), Math.sign(position.y), Math.sign(position.z)).multiplyScalar(subCubeHalfSize);
    const addition = new THREE.Vector3().subVectors(position, subCube);

    if (
      Math.abs(position.x) > subCubeHalfSize
      && Math.abs(position.y) > subCubeHalfSize
      && Math.abs(position.z) > subCubeHalfSize
    ) {
      addition.normalize().multiplyScalar(DICE_PARAMS.edgeRadius);
      position.copy(subCube.add(addition));
    } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize) {
      addition.z = 0;
      addition.normalize().multiplyScalar(DICE_PARAMS.edgeRadius);
      position.x = subCube.x + addition.x;
      position.y = subCube.y + addition.y;
    } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
      addition.y = 0;
      addition.normalize().multiplyScalar(DICE_PARAMS.edgeRadius);
      position.x = subCube.x + addition.x;
      position.z = subCube.z + addition.z;
    } else if (Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
      addition.x = 0;
      addition.normalize().multiplyScalar(DICE_PARAMS.edgeRadius);
      position.y = subCube.y + addition.y;
      position.z = subCube.z + addition.z;
    }

    const notchWave = (value: number) => {
      let v = (1 / DICE_PARAMS.notchRadius) * value;
      v = Math.PI * Math.max(-1, Math.min(1, v));
      return DICE_PARAMS.notchDepth * (Math.cos(v) + 1);
    };

    const notch = (pos: [number, number]) => notchWave(pos[0]) * notchWave(pos[1]);
    const offset = 0.23;

    if (position.y === 0.5) {
      position.y -= notch([position.x, position.z]);
    } else if (position.x === 0.5) {
      position.x -= notch([position.y + offset, position.z + offset]);
      position.x -= notch([position.y - offset, position.z - offset]);
    } else if (position.z === 0.5) {
      position.z -= notch([position.x - offset, position.y + offset]);
      position.z -= notch([position.x, position.y]);
      position.z -= notch([position.x + offset, position.y - offset]);
    } else if (position.z === -0.5) {
      position.z += notch([position.x + offset, position.y + offset]);
      position.z += notch([position.x + offset, position.y - offset]);
      position.z += notch([position.x - offset, position.y + offset]);
      position.z += notch([position.x - offset, position.y - offset]);
    } else if (position.x === -0.5) {
      position.x += notch([position.y + offset, position.z + offset]);
      position.x += notch([position.y + offset, position.z - offset]);
      position.x += notch([position.y, position.z]);
      position.x += notch([position.y - offset, position.z + offset]);
      position.x += notch([position.y - offset, position.z - offset]);
    } else if (position.y === -0.5) {
      position.y += notch([position.x + offset, position.z + offset]);
      position.y += notch([position.x + offset, position.z]);
      position.y += notch([position.x + offset, position.z - offset]);
      position.y += notch([position.x - offset, position.z + offset]);
      position.y += notch([position.x - offset, position.z]);
      position.y += notch([position.x - offset, position.z - offset]);
    }

    positionAttr.setXYZ(i, position.x, position.y, position.z);
  }

  boxGeometry.deleteAttribute('normal');
  boxGeometry.deleteAttribute('uv');
  const merged = BufferGeometryUtils.mergeVertices(boxGeometry);
  merged.computeVertexNormals();
  return merged;
}

function createInnerGeometry(): THREE.BufferGeometry {
  const baseGeometry = new THREE.PlaneGeometry(1 - 2 * DICE_PARAMS.edgeRadius, 1 - 2 * DICE_PARAMS.edgeRadius);
  const offset = 0.48;
  return BufferGeometryUtils.mergeGeometries(
    [
      baseGeometry.clone().translate(0, 0, offset),
      baseGeometry.clone().translate(0, 0, -offset),
      baseGeometry.clone().rotateX(0.5 * Math.PI).translate(0, -offset, 0),
      baseGeometry.clone().rotateX(0.5 * Math.PI).translate(0, offset, 0),
      baseGeometry.clone().rotateY(0.5 * Math.PI).translate(-offset, 0, 0),
      baseGeometry.clone().rotateY(0.5 * Math.PI).translate(offset, 0, 0),
    ],
    false
  );
}

function createFloor(scene: THREE.Scene, physicsWorld: CANNON.World) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.ShadowMaterial({ opacity: 0.15 })
  );
  floor.receiveShadow = true;
  floor.position.y = FLOOR_Y;
  floor.quaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), Math.PI * 0.5);
  scene.add(floor);

  const floorBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
  });
  floorBody.position.set(floor.position.x, floor.position.y, floor.position.z);
  floorBody.quaternion.set(floor.quaternion.x, floor.quaternion.y, floor.quaternion.z, floor.quaternion.w);
  physicsWorld.addBody(floorBody);
}

function resolveDieValue(body: CANNON.Body): number | null {
  const euler = new CANNON.Vec3();
  body.quaternion.toEuler(euler);

  const eps = 0.12;
  const isZero = (value: number) => Math.abs(value) < eps;
  const isHalfPi = (value: number) => Math.abs(value - 0.5 * Math.PI) < eps;
  const isMinusHalfPi = (value: number) => Math.abs(value + 0.5 * Math.PI) < eps;
  const isPiOrMinus = (value: number) => Math.abs(Math.PI - value) < eps || Math.abs(Math.PI + value) < eps;

  if (isZero(euler.z)) {
    if (isZero(euler.x)) {
      return 1;
    }
    if (isHalfPi(euler.x)) {
      return 4;
    }
    if (isMinusHalfPi(euler.x)) {
      return 3;
    }
    if (isPiOrMinus(euler.x)) {
      return 6;
    }
    body.allowSleep = true;
    return null;
  }

  if (isHalfPi(euler.z)) {
    return 2;
  }
  if (isMinusHalfPi(euler.z)) {
    return 5;
  }

  body.allowSleep = true;
  return null;
}

export interface PhysicsDiceRollerProps {
  diceCount?: number;
  disabled?: boolean;
  className?: string;
  rollLabel?: string;
  statusLabel?: string;
  onRollStart?: () => void;
  onRollComplete?: (values: number[], sum: number) => void;
}

export function PhysicsDiceRoller({
  diceCount = 2,
  disabled = false,
  className = '',
  rollLabel = 'Roll dice',
  statusLabel,
  onRollStart,
  onRollComplete,
}: PhysicsDiceRollerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    physicsWorld: CANNON.World;
    dice: DiceInstance[];
    diceMeshTemplate: THREE.Group;
    animationId?: number;
  } | null>(null);
  const rollTokenRef = useRef(0);
  const [isRolling, setIsRolling] = useState(false);
  const rollStateRef = useRef<PhysicsDiceRollerState>(initialRollState());

  const updateRollState = useCallback(() => {
    rollStateRef.current = initialRollState();
    rollStateRef.current.token = rollTokenRef.current;
  }, []);

  const triggerRoll = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || disabled || engine.dice.length === 0) return;

    rollTokenRef.current += 1;
    rollStateRef.current = initialRollState();
    rollStateRef.current.token = rollTokenRef.current;
    setIsRolling(true);
    onRollStart?.();

    engine.dice.forEach((dice, index) => {
      const offset = index * 0.4;
      dice.body.velocity.setZero();
      dice.body.angularVelocity.setZero();
      dice.body.position.set(2, 2 + index * 1.4, -0.5);
      dice.mesh.position.set(dice.body.position.x, dice.body.position.y, dice.body.position.z);
      dice.mesh.rotation.set(2 * Math.PI * Math.random(), 0, 2 * Math.PI * Math.random());
      dice.body.quaternion.set(
        dice.mesh.quaternion.x,
        dice.mesh.quaternion.y,
        dice.mesh.quaternion.z,
        dice.mesh.quaternion.w
      );
      const force = 1 + 2 * Math.random();
      dice.body.applyImpulse(new CANNON.Vec3(-force, force, 0), new CANNON.Vec3(0, 0, 0.2));
      dice.body.allowSleep = true;
    });
  }, [disabled, onRollStart]);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const width = Math.max(
      canvas.clientWidth,
      canvas.parentElement?.clientWidth ?? 0,
      240
    );
    const height = Math.max(
      canvas.clientHeight,
      canvas.parentElement?.clientHeight ?? 0,
      220
    );
    engine.camera.aspect = width / height;
    engine.camera.updateProjectionMatrix();
    engine.renderer.setSize(width, height);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x02040f, 0);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x02040f, 2, 10);
    scene.background = new THREE.Color(0x02040f);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0.4, 3.5).multiplyScalar(5);
    camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const keyLight = new THREE.PointLight(0xffffff, 1.3, 25);
    keyLight.position.set(3, 5, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x4dd0ff, 0.8, 20);
    fillLight.position.set(-3, 2, 4);
    scene.add(fillLight);

    const physicsWorld = new CANNON.World({
      gravity: new CANNON.Vec3(0, -40, 0),
    });
    physicsWorld.defaultContactMaterial.restitution = 0.35;

    createFloor(scene, physicsWorld);

    const diceMeshTemplate = createDiceMesh();
    const dice: DiceInstance[] = [];
    for (let i = 0; i < diceCount; i += 1) {
      dice.push(createDiceInstance(diceMeshTemplate, scene, physicsWorld));
    }

    engineRef.current = {
      renderer,
      scene,
      camera,
      physicsWorld,
      dice,
      diceMeshTemplate,
    };

    const animate = () => {
      const activeEngine = engineRef.current;
      if (!activeEngine) return;

      activeEngine.physicsWorld.fixedStep();
      activeEngine.dice.forEach((diceInstance) => {
        diceInstance.mesh.position.set(
          diceInstance.body.position.x,
          diceInstance.body.position.y,
          diceInstance.body.position.z
        );
        diceInstance.mesh.quaternion.set(
          diceInstance.body.quaternion.x,
          diceInstance.body.quaternion.y,
          diceInstance.body.quaternion.z,
          diceInstance.body.quaternion.w
        );
      });

      activeEngine.renderer.render(activeEngine.scene, activeEngine.camera);
      activeEngine.animationId = requestAnimationFrame(animate);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    engineRef.current.animationId = requestAnimationFrame(animate);

    const sleepHandlers: Array<{ body: CANNON.Body; callback: (event: any) => void }> = [];

    const handleSleep = (diceInstance: DiceInstance) => () => {
      if (!engineRef.current) return;
      const state = rollStateRef.current;
      if (state.token !== rollTokenRef.current || state.completed) return;

      const value = resolveDieValue(diceInstance.body);
      if (value === null) {
        diceInstance.body.allowSleep = true;
        return;
      }
      if (state.results.has(diceInstance.body.id)) return;
      state.results.set(diceInstance.body.id, value);

      if (state.results.size === diceCount) {
        state.completed = true;
        const values = engineRef.current.dice.map((entry) => state.results.get(entry.body.id) ?? 0);
        const sum = values.reduce((acc, cur) => acc + cur, 0);
        setIsRolling(false);
        onRollComplete?.(values, sum);
      }
    };

    engineRef.current.dice.forEach((diceInstance) => {
      const callback = handleSleep(diceInstance);
      diceInstance.body.addEventListener('sleep', callback);
      sleepHandlers.push({ body: diceInstance.body, callback });
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      if (engineRef.current?.animationId) {
        cancelAnimationFrame(engineRef.current.animationId);
      }
      const currentEngine = engineRef.current;
      if (currentEngine) {
        sleepHandlers.forEach(({ body, callback }) => {
          body.removeEventListener('sleep', callback);
        });
        currentEngine.dice.forEach((diceInstance) => {
          currentEngine.physicsWorld.removeBody(diceInstance.body);
          currentEngine.scene.remove(diceInstance.mesh);
        });
      }
      renderer.dispose();
      engineRef.current = null;
    };
  }, [diceCount, handleResize, onRollComplete]);

  const handleRollClick = useCallback(() => {
    if (disabled || isRolling) return;
    triggerRoll();
  }, [disabled, isRolling, triggerRoll]);

  const buttonLabel = isRolling ? 'Rolling...' : rollLabel;

  useEffect(() => {
    updateRollState();
  }, [diceCount, updateRollState]);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-slate-900/95 via-slate-950/80 to-black shadow-[0_0_40px_rgba(15,118,110,0.45)] ${className}`}
      style={{ minHeight: 220 }}
    >
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.4),_transparent_50%)]" />
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="absolute inset-0 flex flex-col justify-end px-4 pb-4">
        <button
          type="button"
          onClick={handleRollClick}
          disabled={disabled || isRolling}
          className={`w-full rounded-full bg-gradient-to-br from-sky-500 via-cyan-400 to-emerald-400 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-[0_10px_30px_rgba(34,211,238,0.4)] transition hover:-translate-y-0.5 disabled:opacity-70 disabled:shadow-none`}
        >
          {buttonLabel}
        </button>
        {statusLabel && (
          <div className="mt-2 text-center text-[11px] uppercase tracking-[0.18em] text-white/70">{statusLabel}</div>
        )}
      </div>
      {(disabled || isRolling) && (
        <div className="absolute inset-0 bg-black/40 pointer-events-none" aria-hidden="true" />
      )}
    </div>
  );
}
