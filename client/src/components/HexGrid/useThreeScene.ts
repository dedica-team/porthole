import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';

import { TRON_BLACK } from './terrainUtils';

interface UseThreeSceneOptions {
  mountRef: React.RefObject<HTMLDivElement | null>;
  fpsRef?: React.RefObject<HTMLDivElement | null>;
  /** Called whenever the scene should re-render. Set needsRender = true inside. */
  onNativePointerMove?: (e: PointerEvent) => void;
}

export interface ThreeRefs {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  css2dRenderer: CSS2DRenderer;
  controls: OrbitControls;
  needsRenderRef: React.MutableRefObject<boolean>;
  requestRender: () => void;
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
}: UseThreeSceneOptions): React.RefObject<ThreeRefs | null> {
  const threeRef = useRef<ThreeRefs | null>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(TRON_BLACK);

    // Use getBoundingClientRect for the initial size – it reflects the actual
    // painted dimensions even when clientWidth/clientHeight are still 0 (e.g.
    // immediately after a conditional mount / mode switch).
    const initRect = mount.getBoundingClientRect();
    const initW = initRect.width  || mount.clientWidth  || 1;
    const initH = initRect.height || mount.clientHeight || 1;

    const camera = new THREE.PerspectiveCamera(55, initW / initH, 0.1, 200);
    camera.position.set(0, 60, 60);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(initW, initH);
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    mount.appendChild(renderer.domElement);

    // ── CSS2D overlay renderer ─────────────────────────────────────────────────
    const css2dRenderer = new CSS2DRenderer();
    css2dRenderer.setSize(initW, initH);
    css2dRenderer.domElement.style.position = 'absolute';
    css2dRenderer.domElement.style.top = '0';
    css2dRenderer.domElement.style.left = '0';
    css2dRenderer.domElement.style.pointerEvents = 'none';
    mount.appendChild(css2dRenderer.domElement);

    const needsRenderRef = { current: true };
    const requestRender = () => { needsRenderRef.current = true; };

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 5;
    controls.maxDistance = 150;
    controls.addEventListener('change', requestRender);

    // Lighting
    scene.add(new THREE.HemisphereLight(0x0a1a2a, 0x000000, 0.5));
    const sun = new THREE.DirectionalLight(0xd0f0ff, 1.8);
    sun.position.set(20, 40, 20);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x204060, 0.6);
    fill.position.set(-20, 20, -20);
    scene.add(fill);

    threeRef.current = { scene, camera, renderer, css2dRenderer, controls, needsRenderRef, requestRender };

    // ── Stats (native three.js FPS panel) ─────────────────────────────────────
    const stats = new Stats();
    stats.showPanel(0); // 0 = FPS
    // Style the panel so it sits in the same top-left corner as the old overlay.
    stats.dom.style.position = 'absolute';
    stats.dom.style.top      = 'auto';
    stats.dom.style.bottom   = '0';
    stats.dom.style.left     = '0';
    stats.dom.style.zIndex   = '100';
    mount.appendChild(stats.dom);
    // Hide the React overlay div – Stats owns the display now.
    // Capture fpsRef.current at setup time so the cleanup below reads the
    // same DOM node (ref values may change between setup and teardown).
    const fpsEl = fpsRef?.current ?? null;
    if (fpsEl) fpsEl.style.display = 'none';

    // ── Adaptive FPS cap ──────────────────────────────────────────────────────
    // rAF fires at the display refresh rate (60/120/144 Hz).  We limit actual
    // renders to a target FPS by tracking the timestamp of the last rendered
    // frame.  controls.update() is still called every rAF tick so OrbitControls
    // damping remains visually smooth even though we skip draw calls.
    //
    // Adaptive tier logic
    // -------------------
    // We track the render-exclusive cost (time from just before renderer.render()
    // to just after) using an exponential moving average (EMA).  If the machine
    // is consistently spending more than a tier's full frame budget on the GPU
    // draw alone, we drop to the next slower tier so the browser stays
    // responsive.  We step back up if the EMA falls well below the current
    // budget (hysteresis prevents oscillation).
    //
    //   Tier 0 – 30 fps  (budget ~33.3 ms)   normal
    //   Tier 1 – 25 fps  (budget ~40.0 ms)   moderate load
    //   Tier 2 – 20 fps  (budget ~50.0 ms)   heavy load
    //
    // Thresholds (ms of render cost that trigger a tier change):
    //   upgrade:   EMA < 70 % of current budget  → try one tier faster
    //   downgrade: EMA > 85 % of current budget  → drop one tier slower
    const FPS_TIERS        = [30, 25, 20] as const;
    const UPGRADE_FACTOR   = 0.70; // EMA < 70 % of budget  → go faster
    const DOWNGRADE_FACTOR = 0.85; // EMA > 85 % of budget  → go slower
    const EMA_ALPHA        = 0.1;  // smoothing: weight of the newest sample
    // After a tier change, wait this many rendered frames before reconsidering
    // (prevents rapid oscillation right at a threshold).
    const SETTLE_FRAMES    = 30;

    let tierIndex      = 0;                        // start at 30 fps
    let frameBudget    = 1000 / FPS_TIERS[tierIndex];
    let lastRenderTime = 0;
    let renderCostEma  = frameBudget * 0.5;        // optimistic initial estimate
    let settleCounter  = SETTLE_FRAMES;            // skip adaptation on startup

    const animate = (now: DOMHighResTimeStamp) => {
      frameRef.current = requestAnimationFrame(animate);
      stats.begin();

      // Always tick controls so damping / auto-rotate interpolate correctly.
      const stillDamping = controls.update();

      const elapsed = now - lastRenderTime;
      if (elapsed >= frameBudget || needsRenderRef.current || stillDamping) {
        lastRenderTime = now - (elapsed % frameBudget);
        needsRenderRef.current = false;

        // Measure render cost exclusively (GPU flush is synchronous for WebGL).
        const t0 = performance.now();
        renderer.render(scene, camera);
        css2dRenderer.render(scene, camera);
        const renderCost = performance.now() - t0;

        // Update EMA of render cost.
        renderCostEma = EMA_ALPHA * renderCost + (1 - EMA_ALPHA) * renderCostEma;

        // Adaptive tier evaluation (skip during settle period).
        if (settleCounter > 0) {
          settleCounter--;
        } else {
          if (renderCostEma > frameBudget * DOWNGRADE_FACTOR && tierIndex < FPS_TIERS.length - 1) {
            // Too slow for current tier – drop down.
            tierIndex++;
            frameBudget   = 1000 / FPS_TIERS[tierIndex];
            settleCounter = SETTLE_FRAMES;
          } else if (renderCostEma < frameBudget * UPGRADE_FACTOR && tierIndex > 0) {
            // Plenty of headroom – try going faster.
            tierIndex--;
            frameBudget   = 1000 / FPS_TIERS[tierIndex];
            settleCounter = SETTLE_FRAMES;
          }
        }
      }

      stats.end();
    };
    animate(0);

    if (onNativePointerMove) {
      renderer.domElement.addEventListener('pointermove', onNativePointerMove);
    }

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      css2dRenderer.setSize(w, h);
      requestRender();
    };
    // Use ResizeObserver to catch all size changes (window resize, panel open/close, etc.).
    // The FIRST callback fires after the browser has completed layout for the newly-mounted
    // element – this is the earliest moment we have reliable clientWidth/clientHeight.
    // We use it to correct the renderer size (getBoundingClientRect() in a React useEffect
    // runs before the browser paint and may still return 0×0), then immediately render.
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(mount);
    // Also keep window resize as a fallback
    window.addEventListener('resize', handleResize);
    // Cancel the deferred initial sync RAF – no longer needed since we size
    // correctly up-front with getBoundingClientRect().
    const initialSyncRaf = requestAnimationFrame(handleResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      cancelAnimationFrame(initialSyncRaf);
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
  }, []);

  return threeRef;
}
