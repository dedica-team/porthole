import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { pickTileFromMesh } from './useTilePicker';
import { hexToWorld } from '@/utils/hexUtils.ts';
import { tileHeight } from './terrainRenderers';
import { useMapStore } from '@/store/mapStore.ts';

const HEX_SIZE = 1;

interface UseBrushOptions {
  brushMode: boolean;
  onTileClick: (q: number, r: number) => void;
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  controlsRef: React.RefObject<OrbitControls | null>;
  spotlightRef: React.RefObject<THREE.SpotLight | null>;
  tileMergedRef: React.RefObject<{ tops: THREE.Mesh } | null>;
  needsRenderRef: React.RefObject<boolean>;
}

/**
 * Manages brush-mode state: active flag, visited-tile set, OrbitControls
 * suspension and the native pointermove spotlight preview.
 *
 * Returns refs and handlers that HexGrid attaches to its DOM div.
 */
export function useBrush({
  brushMode,
  onTileClick,
  rendererRef,
  cameraRef,
  controlsRef,
  spotlightRef,
  tileMergedRef,
  needsRenderRef,
}: UseBrushOptions) {
  const brushActiveRef     = useRef(false);
  const brushedInStrokeRef = useRef<Set<string>>(new Set());
  const brushModeRef       = useRef(brushMode);
  const onTileClickRef     = useRef(onTileClick);

  useEffect(() => { brushModeRef.current = brushMode; }, [brushMode]);
  useEffect(() => { onTileClickRef.current = onTileClick; }, [onTileClick]);

  /** Native pointermove handler – keeps spotlight and brush paint in sync. */
  const onNativePointerMove = (e: PointerEvent) => {
    const renderer = rendererRef.current;
    const camera   = cameraRef.current;
    const merged   = tileMergedRef.current;
    const spot     = spotlightRef.current;
    if (!renderer || !camera || !merged) return;

    const tiles = useMapStore.getState().currentMap?.map?.tiles ?? [];

    if (brushModeRef.current && spot) {
      const coord = pickTileFromMesh(e.clientX, e.clientY, renderer, camera, merged.tops, tiles);
      if (coord) {
        const tile = tiles.find((t) => t.coordinate.q === coord.q && t.coordinate.r === coord.r);
        const { x, z } = hexToWorld(coord.q, coord.r, HEX_SIZE);
        const tileTop = tileHeight(tile?.elevation ?? 0);
        spot.position.set(x, tileTop + 5, z);
        spot.target.position.set(x, tileTop, z);
        spot.target.updateMatrixWorld();
        spot.intensity = 3;
        spot.visible = true;
      } else {
        spot.visible = false;
        spot.intensity = 0;
      }
      needsRenderRef.current = true;
    }

    if (!brushModeRef.current || !brushActiveRef.current) return;
    const coord = pickTileFromMesh(e.clientX, e.clientY, renderer, camera, merged.tops, tiles);
    if (!coord) return;
    const key = `${coord.q},${coord.r}`;
    if (brushedInStrokeRef.current.has(key)) return;
    brushedInStrokeRef.current.add(key);
    onTileClickRef.current(coord.q, coord.r);
  };

  const startBrushStroke = (clientX: number, clientY: number) => {
    if (!brushModeRef.current) return;
    brushActiveRef.current = true;
    brushedInStrokeRef.current = new Set();
    if (controlsRef.current) controlsRef.current.enabled = false;

    const renderer = rendererRef.current;
    const camera   = cameraRef.current;
    const merged   = tileMergedRef.current;
    if (!renderer || !camera || !merged) return;
    const tiles = useMapStore.getState().currentMap?.map?.tiles ?? [];
    const coord = pickTileFromMesh(clientX, clientY, renderer, camera, merged.tops, tiles);
    if (coord) {
      brushedInStrokeRef.current.add(`${coord.q},${coord.r}`);
      onTileClickRef.current(coord.q, coord.r);
    }
  };

  const continueBrushStroke = (clientX: number, clientY: number) => {
    if (!brushModeRef.current || !brushActiveRef.current) return;
    const renderer = rendererRef.current;
    const camera   = cameraRef.current;
    const merged   = tileMergedRef.current;
    if (!renderer || !camera || !merged) return;
    const tiles = useMapStore.getState().currentMap?.map?.tiles ?? [];
    const coord = pickTileFromMesh(clientX, clientY, renderer, camera, merged.tops, tiles);
    if (!coord) return;
    const key = `${coord.q},${coord.r}`;
    if (brushedInStrokeRef.current.has(key)) return;
    brushedInStrokeRef.current.add(key);
    onTileClickRef.current(coord.q, coord.r);
  };

  const endBrushStroke = () => {
    if (!brushModeRef.current) return;
    brushActiveRef.current = false;
    brushedInStrokeRef.current = new Set();
    if (controlsRef.current) controlsRef.current.enabled = true;
  };

  return {
    brushActiveRef,
    brushedInStrokeRef,
    onNativePointerMove,
    startBrushStroke,
    continueBrushStroke,
    endBrushStroke,
  };
}

