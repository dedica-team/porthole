import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';

import { SCENE_BACKGROUND } from './terrainUtils';
import { resolveRendererQuality, type RendererQualityProfile } from './renderQuality';

export interface FirstPersonState {
  enabled: boolean;
  /** Tower the camera currently belongs to; changing towers re-initialises aiming. */
  towerId?: string;
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
}

interface UseThreeSceneOptions {
  mountRef: React.RefObject<HTMLDivElement | null>;
  fpsRef?: React.RefObject<HTMLDivElement | null>;
  onNativePointerMove?: (e: PointerEvent) => void;
  qualityProfile?: RendererQualityProfile;
  /** When true, use an orthographic camera locked top-down (xray/process mode). */
  orthographic?: boolean;
  /** Called after the Three.js scene has been (re-)initialised. */
  onSceneReady?: () => void;
  /** When set and enabled, the camera is driven by the first-person watchtower controller. */
  firstPersonRef?: React.RefObject<FirstPersonState | null>;
}

export interface ThreeRefs {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  css2dRenderer: CSS2DRenderer;
  controls: OrbitControls;
  needsRenderRef: React.MutableRefObject<boolean>;
  requestRender: () => void;
  setCss2dActive: (active: boolean) => void;
}

/**
 * Sets up the Three.js scene, camera, renderer, OrbitControls and lighting.
 * Cleans up on unmount.
 *
 * Returns stable refs to all scene objects so sibling hooks and effects
 * can access them without re-subscribing.
 */
export function useThreeScene({
  mountRef,
  fpsRef,
  onNativePointerMove,
  qualityProfile,
  orthographic = false,
  onSceneReady,
  firstPersonRef,
}: UseThreeSceneOptions): React.RefObject<ThreeRefs | null> {
  const threeRef = useRef<ThreeRefs | null>(null);
  const frameRef = useRef<number>(0);
  const sizeVecRef = useRef(new THREE.Vector2());

  useLayoutEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const readMountSize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(0, Math.floor(rect.width || mount.clientWidth));
      const height = Math.max(0, Math.floor(rect.height || mount.clientHeight));
      return { width, height };
    };

    const initialSize = readMountSize();
    const initialWidth = Math.max(1, initialSize.width);
    const initialHeight = Math.max(1, initialSize.height);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BACKGROUND);
    const rendererQuality = resolveRendererQuality(qualityProfile);

    const ORTHO_HALF = 20;
    const camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = orthographic
      ? (() => {
          const aspect = initialSize.width > 0 && initialSize.height > 0 ? initialSize.width / initialSize.height : 1;
          const cam = new THREE.OrthographicCamera(
            -ORTHO_HALF * aspect, ORTHO_HALF * aspect,
            ORTHO_HALF, -ORTHO_HALF,
            0.1, 300,
          );
          cam.position.set(0, 100, 0);
          cam.lookAt(0, 0, 0);
          return cam;
        })()
      : (() => {
          const cam = new THREE.PerspectiveCamera(
            55,
            initialSize.width > 0 && initialSize.height > 0 ? initialSize.width / initialSize.height : 1,
            0.1,
            200,
          );
          cam.position.set(0, 20, 20);
          cam.lookAt(0, 0, 0);
          return cam;
        })();

    const renderer = new THREE.WebGLRenderer({ antialias: rendererQuality.antialias });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, rendererQuality.maxPixelRatio));
    renderer.setSize(initialWidth, initialHeight, false);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = rendererQuality.toneMapping;
    renderer.toneMappingExposure = rendererQuality.toneMappingExposure;
    mount.appendChild(renderer.domElement);

    // ── CSS2D overlay renderer ─────────────────────────────────────────────────
    const css2dRenderer = new CSS2DRenderer();
    css2dRenderer.setSize(initialWidth, initialHeight);
    css2dRenderer.domElement.style.position = 'absolute';
    css2dRenderer.domElement.style.top = '0';
    css2dRenderer.domElement.style.left = '0';
    css2dRenderer.domElement.style.width = '100%';
    css2dRenderer.domElement.style.height = '100%';
    css2dRenderer.domElement.style.pointerEvents = 'none';
    css2dRenderer.domElement.style.display = 'none';
    mount.appendChild(css2dRenderer.domElement);

    const needsRenderRef = { current: true };
    const css2dActiveRef = { current: false };
    let hasValidViewport = false;
    let disposed = false;

    const syncViewportSize = () => {
      const { width, height } = readMountSize();
      if (width <= 0 || height <= 0) {
        hasValidViewport = false;
        return false;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, rendererQuality.maxPixelRatio);
      const currentSize = renderer.getSize(sizeVecRef.current);
      const needsResize = currentSize.x !== width || currentSize.y !== height;
      const needsDprUpdate = renderer.getPixelRatio() !== dpr;

      if (needsResize || needsDprUpdate || !hasValidViewport) {
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
        renderer.setViewport(0, 0, width, height);
        renderer.setScissorTest(false);
        css2dRenderer.setSize(width, height);
      }

      if (camera instanceof THREE.OrthographicCamera) {
        const aspect = width / height;
        camera.left   = -ORTHO_HALF * aspect;
        camera.right  =  ORTHO_HALF * aspect;
        camera.top    =  ORTHO_HALF;
        camera.bottom = -ORTHO_HALF;
      } else {
        camera.aspect = width / height;
      }
      camera.updateProjectionMatrix();
      hasValidViewport = true;
      return true;
    };

    const scheduleFrame = () => {
      if (disposed || frameRef.current !== 0) return;
      frameRef.current = requestAnimationFrame(animate);
    };

    const requestRender = () => {
      needsRenderRef.current = true;
      scheduleFrame();
    };

    const setCss2dActive = (active: boolean) => {
      if (css2dActiveRef.current === active) return;
      css2dActiveRef.current = active;
      css2dRenderer.domElement.style.display = active ? '' : 'none';
      requestRender();
    };

    camera.rotation.order = 'YXZ';

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    if (orthographic) {
      controls.enableRotate = false;
      controls.minZoom = 0.3;
      controls.maxZoom = 8;
    } else {
      controls.maxPolarAngle = Math.PI / 2.2;
      controls.minDistance = 5;
      controls.maxDistance = 150;
    }
    controls.addEventListener('change', requestRender);

    // Lighting
    scene.add(new THREE.HemisphereLight(0xb0c4de, 0x303840, 0.65));
    const sun = new THREE.DirectionalLight(0xfff8e7, 1.5);
    sun.position.set(20, 40, 20);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x406080, 0.5);
    fill.position.set(-20, 20, -20);
    scene.add(fill);

    threeRef.current = { scene, camera, renderer, css2dRenderer, controls, needsRenderRef, requestRender, setCss2dActive };

    // Notify the consumer that a fresh scene is ready (e.g. to re-populate objects).
    onSceneReady?.();

    // ── Stats (native three.js FPS panel) ─────────────────────────────────────
    const stats = new Stats();
    stats.showPanel(0); // 0 = FPS
    stats.dom.style.position = 'absolute';
    stats.dom.style.top      = 'auto';
    stats.dom.style.bottom   = '0';
    stats.dom.style.left     = '0';
    stats.dom.style.zIndex   = '100';
    mount.appendChild(stats.dom);
    const fpsEl = fpsRef?.current ?? null;
    if (fpsEl) fpsEl.style.display = 'none';

    // ── Adaptive FPS cap ──────────────────────────────────────────────────────
    const FPS_TIERS        = [30, 25, 20] as const;
    const UPGRADE_FACTOR   = 0.70;
    const DOWNGRADE_FACTOR = 0.85;
    const EMA_ALPHA        = 0.1;
    const SETTLE_FRAMES    = 30;

    let tierIndex      = 0;
    let frameBudget    = 1000 / FPS_TIERS[tierIndex];
    let lastRenderTime = 0;
    let renderCostEma  = frameBudget * 0.5;
    let settleCounter  = SETTLE_FRAMES;

    const animate = (now: DOMHighResTimeStamp) => {
      frameRef.current = 0;
      stats.begin();

      const fp = firstPersonRef?.current;
      let stillDamping = false;
      if (fp?.enabled) {
        controls.enabled = false;
        camera.position.copy(fp.position);
        camera.rotation.set(fp.pitch, fp.yaw, 0);
        needsRenderRef.current = true;
      } else {
        controls.enabled = true;
        stillDamping = controls.update();
      }
      const wantsRender = needsRenderRef.current || stillDamping;

      const elapsed = now - lastRenderTime;
      if (!wantsRender) {
        stats.end();
        return;
      }

      if (elapsed < frameBudget) {
        stats.end();
        scheduleFrame();
        return;
      }

      lastRenderTime = now;
      needsRenderRef.current = false;

      if (!syncViewportSize()) {
        stats.end();
        return;
      }

      const t0 = performance.now();
      renderer.render(scene, camera);
      if (css2dActiveRef.current) {
        css2dRenderer.render(scene, camera);
      }
      const renderCost = performance.now() - t0;

      renderCostEma = EMA_ALPHA * renderCost + (1 - EMA_ALPHA) * renderCostEma;

      if (settleCounter > 0) {
        settleCounter--;
      } else {
        if (renderCostEma > frameBudget * DOWNGRADE_FACTOR && tierIndex < FPS_TIERS.length - 1) {
          tierIndex++;
          frameBudget   = 1000 / FPS_TIERS[tierIndex];
          settleCounter = SETTLE_FRAMES;
        } else if (renderCostEma < frameBudget * UPGRADE_FACTOR && tierIndex > 0) {
          tierIndex--;
          frameBudget   = 1000 / FPS_TIERS[tierIndex];
          settleCounter = SETTLE_FRAMES;
        }
      }

      stats.end();

      if (firstPersonRef?.current?.enabled) {
        needsRenderRef.current = true;
      }

      if (needsRenderRef.current || stillDamping) {
        scheduleFrame();
      }
    };

    if (onNativePointerMove) {
      renderer.domElement.addEventListener('pointermove', onNativePointerMove);
    }

    const handleResize = () => {
      if (!syncViewportSize()) return;
      requestRender();
    };
    handleResize();
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(mount);
    window.addEventListener('resize', handleResize);
    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (onNativePointerMove) renderer.domElement.removeEventListener('pointermove', onNativePointerMove);
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      renderer.dispose();
      threeRef.current = null;
      mount.removeChild(renderer.domElement);
      if (mount.contains(css2dRenderer.domElement)) mount.removeChild(css2dRenderer.domElement);
      if (mount.contains(stats.dom)) mount.removeChild(stats.dom);
      if (fpsEl) fpsEl.style.display = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityProfile, orthographic]);

  return threeRef;
}
