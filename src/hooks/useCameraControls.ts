import { useState, useCallback, useEffect, useRef } from 'react';

export interface CameraState {
  x: number;
  y: number;
  scale: number;
}

interface UseCameraControlsOptions {
  minScale?: number;
  maxScale?: number;
  zoomSensitivity?: number;
  initialState?: Partial<CameraState>;
  enabled?: boolean;
}

interface UseCameraControlsResult {
  cameraState: CameraState;
  containerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  isPanning: boolean;
  resetCamera: () => void;
  centerOn: (elementRef: HTMLElement | null) => void;
  setCameraState: React.Dispatch<React.SetStateAction<CameraState>>;
}

const DEFAULT_CAMERA: CameraState = { x: 0, y: 0, scale: 1 };

export function useCameraControls(options: UseCameraControlsOptions = {}): UseCameraControlsResult {
  const {
    minScale = 0.25,
    maxScale = 3,
    zoomSensitivity = 0.001,
    initialState = {},
    enabled = true,
  } = options;

  const [cameraState, setCameraState] = useState<CameraState>({
    ...DEFAULT_CAMERA,
    ...initialState,
  });
  const [isPanning, setIsPanning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track pan start position
  const panStartRef = useRef({ x: 0, y: 0 });
  const cameraStartRef = useRef({ x: 0, y: 0 });

  // Reset camera to default
  const resetCamera = useCallback(() => {
    setCameraState(DEFAULT_CAMERA);
  }, []);

  // Center camera on a specific element within the content
  const centerOn = useCallback((element: HTMLElement | null) => {
    if (!element || !containerRef.current || !contentRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    // Calculate element's position relative to content (not screen)
    const elementCenterX = elementRect.left - contentRect.left + elementRect.width / 2;
    const elementCenterY = elementRect.top - contentRect.top + elementRect.height / 2;

    // Calculate offset to center this element in the container
    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;

    setCameraState(prev => ({
      ...prev,
      x: containerCenterX - elementCenterX * prev.scale,
      y: containerCenterY - elementCenterY * prev.scale,
    }));
  }, []);

  // Handle mouse wheel zoom
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setCameraState(prev => {
        // Calculate new scale
        const delta = -e.deltaY * zoomSensitivity;
        const newScale = Math.min(maxScale, Math.max(minScale, prev.scale * (1 + delta)));
        const scaleFactor = newScale / prev.scale;

        // Zoom toward mouse position
        const newX = mouseX - (mouseX - prev.x) * scaleFactor;
        const newY = mouseY - (mouseY - prev.y) * scaleFactor;

        return {
          x: newX,
          y: newY,
          scale: newScale,
        };
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [enabled, minScale, maxScale, zoomSensitivity]);

  // Handle middle mouse button pan
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Middle mouse button (button 1)
      if (e.button !== 1) return;
      e.preventDefault();

      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      cameraStartRef.current = { x: cameraState.x, y: cameraState.y };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;

      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;

      setCameraState(prev => ({
        ...prev,
        x: cameraStartRef.current.x + deltaX,
        y: cameraStartRef.current.y + deltaY,
      }));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        setIsPanning(false);
      }
    };

    // Prevent context menu on middle click
    const handleContextMenu = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('auxclick', handleContextMenu);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('auxclick', handleContextMenu);
    };
  }, [enabled, isPanning, cameraState.x, cameraState.y]);

  // Update cameraStartRef when camera state changes during pan
  useEffect(() => {
    if (!isPanning) {
      cameraStartRef.current = { x: cameraState.x, y: cameraState.y };
    }
  }, [isPanning, cameraState.x, cameraState.y]);

  return {
    cameraState,
    containerRef,
    contentRef,
    isPanning,
    resetCamera,
    centerOn,
    setCameraState,
  };
}
