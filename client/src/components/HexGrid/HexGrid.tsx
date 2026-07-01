import {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {HexCoordinate, HexTile, Terrain} from '@/types/hex';
import type {Landmark} from '@/types/landmark';
import type {SessionState} from '@/types/session';
import {worstLevel} from '@/types/landmark';
import {hexToWorld} from '@/utils/hexUtils.ts';
import {useMapStore} from '@/store/mapStore.ts';
import {TERRAIN_RENDERER_MAP, tileHeight,} from './terrainRenderers';
import type {Adjacent} from './landmarks/index';
import {getLandmarkRenderer} from './landmarks/index';
import {clearNamePlaneCache} from './landmarks/landmarkUtils';
import {buildConnectionGroup, buildXrayLine} from './connectionRenderers';
import {useThreeScene} from './useThreeScene';
import type {RendererQualityProfile} from './renderQuality';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { LOADING_COPY } from '@/components/ui/loadingCopy';
import {
    buildTileGeo,
    EDGE_MAT, EDGE_MAT_VERT, EDGE_MAT_DARK,
    TILE_TOP_MAT, TILE_SIDE_MAT,
    TMPL_TOP_VERT_COUNT, TMPL_SIDE_VERT_COUNT,
    SELECTION_COL_HEIGHT, SELECTION_GEO, SELECTION_MAT,
} from './tileGeometry';
import {ProcessArrowRenderer} from './ProcessArrowRenderer';
import type {StageConnectionEntry} from './ProcessArrowRenderer';
import {CSS2DObject} from 'three/examples/jsm/renderers/CSS2DRenderer.js';


function makeXrayLabel(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = [
        'font-family: ui-monospace, monospace',
        'font-size: 10px',
        'font-weight: 700',
        'color: #000000',
        'background: rgba(255,255,255,0.92)',
        'padding: 1px 5px',
        'border-radius: 3px',
        'pointer-events: none',
        'white-space: nowrap',
        'user-select: none',
    ].join(';');
    return el;
}

/** Slightly off-white hex surface for process (xray) mode. */
const PROCESS_TOP_RGB: [number, number, number] = [0.91, 0.91, 0.91];
const PROCESS_SIDE_RGB: [number, number, number] = [0.78, 0.78, 0.78];
const PROCESS_EDGE_MAT = new THREE.LineBasicMaterial({color: 0x999999, transparent: false});

/** Blue-tinted tiles for the active stage. */
const STAGE_TOP_RGB: [number, number, number] = [0.86, 0.91, 1.0];
const STAGE_SIDE_RGB: [number, number, number] = [0.76, 0.81, 0.92];

interface Props {
    map: SessionState;
    onTileClick: (q: number, r: number) => void;
    fpsRef?: React.RefObject<HTMLDivElement | null>;
    brushMode?: boolean;
    crosshairCursor?: boolean;
    /**     * All connection IDs that belong to the active process (used for dimming/hiding).
     * Connections in this set that are also in activeStageConnectionIds are hidden (replaced by arrows).
     * Connections in this set but not in activeStageConnectionIds stay at full opacity.
     * Connections not in this set are dimmed to 0.18 opacity.
     */
    highlightConnectionIds?: Set<string>;
    /**
     * Connection IDs of the currently open stage — their regular meshes are hidden
     * because the ProcessArrowRenderer renders them instead.
     */
    activeStageConnectionIds?: Set<string>;
    /**
     * Map of "q,r" → hex color (0xRRGGBB) for landmark tiles to highlight with a
     * ring in process mode. Each entry gets its own color (typically the group color).
     */
    landmarkHighlightColors?: Map<string, number>;
    /**
     * Set of "q,r" tile keys for the active stage (landmarks + connection paths).
     * These tiles are painted with a lighter grey in process mode.
     */
    stageHighlightTiles?: Set<string>;
    /**
     * Per-landmark metric overlay entries (keyed by landmark ID).
     * When set, a CSS2D billboard label is rendered above each landmark's position
     * showing the metric value with the quality-level colour as a border.
     * Labels auto-face the camera (billboarding via CSS2DRenderer).
     */
    metricOverlayEntries?: Map<string, { value: string; color: string }>;
    onConnectionClick?: (connectionId: string) => void;
    patchTileRef?: React.RefObject<((q: number, r: number, terrain: Terrain, elevation: number) => void) | null>;
    /**
     * Resolved StageConnection + Connection pairs for the active stage.
     * When set, ProcessArrowRenderer builds an arrow overlay for each entry.
     */
    processStageConnections?: StageConnectionEntry[];
    /** Name of the currently selected stage, shown as a CSS2D label on the map in xray mode. */
    activeStageName?: string;
    /** When true, terrain decorations (trees, rocks, vegetation) are not rendered. */
    hideDecorations?: boolean;
    /** Renderer quality profile – passed to useThreeScene to (re-)init the WebGL renderer. */
    rendererQualityProfile?: RendererQualityProfile;
}

const HEX_SIZE = 1;
/** Distance between any two adjacent hex centers – always √3 * HEX_SIZE. */
const HEX_NEIGHBOR_DIST = Math.sqrt(3) * HEX_SIZE;
const HEX_DIRS = ([
    {dq: 1, dr: 0}, {dq: 1, dr: -1}, {dq: 0, dr: -1},
    {dq: -1, dr: 0}, {dq: -1, dr: 1}, {dq: 0, dr: 1},
] as const).map(({dq, dr}) => {
    const {x, z} = hexToWorld(dq, dr, HEX_SIZE);
    const unit = new THREE.Vector2(x / HEX_NEIGHBOR_DIST, z / HEX_NEIGHBOR_DIST);
    (unit as unknown as { _len: number })._len = HEX_NEIGHBOR_DIST;
    return {dq, dr, unit};
});

export default function HexGrid({
                                    map,
                                    onTileClick,
                                    fpsRef,
                                    brushMode = false,
                                    crosshairCursor = false,
                                    highlightConnectionIds,
                                    activeStageConnectionIds,
                                    landmarkHighlightColors,
                                    stageHighlightTiles,
                                    metricOverlayEntries,
                                    onConnectionClick,
                                    patchTileRef,
                                    processStageConnections,
                                    activeStageName,
                                    hideDecorations = false,
                                    rendererQualityProfile,
                                }: Props) {
    const mountRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);

    const tileMergedRef = useRef<{
        tops: THREE.Mesh;
        sides: THREE.Mesh;
        edges: THREE.LineSegments;
        edgesVert: THREE.LineSegments;
        edgesDark: THREE.LineSegments
    } | null>(null);
    /** Flat Float32Array of RGB vertex colours for every top vertex, in tile order. */
    const topColBufRef = useRef<{ buf: THREE.Float32BufferAttribute; vertsPerTile: number } | null>(null);
    const sideColBufRef = useRef<{ buf: THREE.Float32BufferAttribute; vertsPerTile: number } | null>(null);
    const tileIndexRef = useRef<Map<string, number>>(new Map());
    const tileByCoordRef = useRef<Map<string, HexTile>>(new Map());
    const landmarkCoordsRef = useRef<Set<string>>(new Set());
    const landmarkMeshMapRef = useRef<Map<string, THREE.Group>>(new Map());
    const connectionMeshMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
    const highlightEdgesRef = useRef<THREE.Object3D | null>(null);
    const processArrowRendererRef = useRef<ProcessArrowRenderer | null>(null);
    const metricOverlayObjectsRef = useRef<CSS2DObject[]>([]);
    const connectionLabelMapRef = useRef<Map<string, CSS2DObject>>(new Map());
    const arrowLabelObjectsRef = useRef<CSS2DObject[]>([]);
    const stageLabelRef = useRef<CSS2DObject | null>(null);
    const connectionXrayMatRef = useRef<Map<string, THREE.MeshBasicMaterial>>(new Map());

    const optimisticTerrainRef = useRef<Map<string, Terrain>>(new Map());
    const selectionMeshRef = useRef<THREE.Mesh | null>(null);
    const stageHighlightTilesRef = useRef<Set<string> | undefined>(stageHighlightTiles);
    useEffect(() => {
        stageHighlightTilesRef.current = stageHighlightTiles;
    }, [stageHighlightTiles]);

    const selectedTile = useMapStore((s) => s.selectedTile);
    const setSelectedTile = useMapStore((s) => s.setSelectedTile);
    const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

    const onTileClickRef = useRef(onTileClick);
    useEffect(() => {
        onTileClickRef.current = onTileClick;
    }, [onTileClick]);

    const brushModeRef = useRef(brushMode);
    useEffect(() => {
        brushModeRef.current = brushMode;
    }, [brushMode]);

    const brushActiveRef = useRef(false);
    const brushedInStrokeRef = useRef<Set<string>>(new Set());
    const raycasterRef = useRef(new THREE.Raycaster());

    // ── Native pointermove handler (passed to useThreeScene) ─────────────────
    const onNativeMove = (e: PointerEvent) => {
        const three = threeRef.current;
        if (!three) return;
        const {camera, renderer, requestRender} = three;

        const pickTileNative = (clientX: number, clientY: number) => {
            const merged = tileMergedRef.current;
            if (!merged) return null;
            const rect = renderer.domElement.getBoundingClientRect();
            const ndc = new THREE.Vector2(
                ((clientX - rect.left) / rect.width) * 2 - 1,
                -((clientY - rect.top) / rect.height) * 2 + 1,
            );
            const ray = raycasterRef.current;
            ray.setFromCamera(ndc, camera);
            const hits = ray.intersectObject(merged.tops);
            if (!hits.length) return null;
            const tiles = useMapStore.getState().currentMap?.map?.tiles ?? [];
            const idx = Math.floor((hits[0].face?.a ?? 0) / TMPL_TOP_VERT_COUNT);
            const tile = tiles[idx];
            return tile ? tile.coordinate : null;
        };

        if (!brushModeRef.current || !brushActiveRef.current) return;
        const coord = pickTileNative(e.clientX, e.clientY);
        if (!coord) return;
        const key = `${coord.q},${coord.r}`;
        if (brushedInStrokeRef.current.has(key)) return;
        brushedInStrokeRef.current.add(key);
        onTileClickRef.current(coord.q, coord.r);
        requestRender();
    };
    const onNativeMoveRef = useRef(onNativeMove);
    useEffect(() => {
        onNativeMoveRef.current = onNativeMove;
    });
    const stableNativeMove = useRef((e: PointerEvent) => onNativeMoveRef.current(e));

    // ── Scene (delegated to useThreeScene) ───────────────────────────────────
    const threeRef = useThreeScene({mountRef, fpsRef, onNativePointerMove: stableNativeMove.current, qualityProfile: rendererQualityProfile, orthographic: hideDecorations});

    const requestRender = () => {
        threeRef.current?.requestRender();
    };


    // ── patchTileMaterial ─────────────────────────────────────────────────────
    const patchTileMaterial = (q: number, r: number, terrain: Terrain, elevation: number) => {
        const idx = tileIndexRef.current.get(`${q},${r}`);
        if (idx === undefined) return;
        optimisticTerrainRef.current.set(`${q},${r}`, terrain);
        const tc = TERRAIN_RENDERER_MAP[terrain]?.tileColors() ?? TERRAIN_RENDERER_MAP['GRASS'].tileColors();

        const topInfo = topColBufRef.current;
        const sideInfo = sideColBufRef.current;

        const writeRGB = (info: { buf: THREE.Float32BufferAttribute; vertsPerTile: number },
                          hex: number, emissive: THREE.Color) => {
            const base = idx * info.vertsPerTile * 3;
            const col = new THREE.Color(hex);
            const r = Math.min(1, col.r + emissive.r);
            const g = Math.min(1, col.g + emissive.g);
            const b = Math.min(1, col.b + emissive.b);
            for (let v = 0; v < info.vertsPerTile; v++) {
                info.buf.array[base + v * 3] = r;
                info.buf.array[base + v * 3 + 1] = g;
                info.buf.array[base + v * 3 + 2] = b;
            }
            info.buf.needsUpdate = true;
        };

        if (topInfo) writeRGB(topInfo, tc.topColor, tc.topEmissive);
        if (sideInfo) writeRGB(sideInfo, tc.sideColor, tc.sideEmissive);
        void elevation;
        requestRender();
    };

    useEffect(() => {
        if (patchTileRef) {
            (patchTileRef as React.MutableRefObject<typeof patchTileMaterial | null>).current = patchTileMaterial;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const disposeHighlightRings = (scene: THREE.Scene) => {
        const obj = highlightEdgesRef.current;
        if (!obj) return;
        scene.remove(obj);
        obj.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).geometry?.dispose();
                const mat = (child as THREE.Mesh).material;
                if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
                else (mat as THREE.Material)?.dispose();
            }
        });
        highlightEdgesRef.current = null;
    };

    // ── Hex tiles (merged geometry, single material per face type) ─────────────
    useEffect(() => {
        const scene = threeRef.current?.scene;
        if (!scene) return;

        setLoading(true);

        // Defer all expensive geometry work so the browser can paint the loading
        // overlay above before the JS thread is blocked.
        const tid = setTimeout(() => {
        if (tileMergedRef.current) {
            scene.remove(tileMergedRef.current.tops, tileMergedRef.current.sides, tileMergedRef.current.edges, tileMergedRef.current.edgesVert, tileMergedRef.current.edgesDark);
            tileMergedRef.current.tops.geometry.dispose();
            tileMergedRef.current.sides.geometry.dispose();
            tileMergedRef.current.edges.geometry.dispose();
            tileMergedRef.current.edgesVert.geometry.dispose();
            tileMergedRef.current.edgesDark.geometry.dispose();
        }
        topColBufRef.current = null;
        sideColBufRef.current = null;
        tileIndexRef.current.clear();
        tileByCoordRef.current.clear();
        optimisticTerrainRef.current.clear();

        // Remove stale highlight ring on tile rebuild – not needed here;
        // the ring effect re-runs via the map.map.tiles dependency.

        const tiles = map.map?.tiles ?? [];
        const topGeos: THREE.BufferGeometry[] = [], sideGeos: THREE.BufferGeometry[] = [];
        const edgeGeosBright: THREE.BufferGeometry[] = [];   // land H edges (top/bottom rings)
        const edgeGeosVert: THREE.BufferGeometry[] = [];   // land V edges (pillars)
        const edgeGeosDark: THREE.BufferGeometry[] = [];   // water/swamp all edges
        const tmp = new THREE.Color();

        tiles.forEach((tile: HexTile, idx: number) => {
            const {q, r} = tile.coordinate;
            const {x, z} = hexToWorld(q, r, HEX_SIZE);

            let topRGB: [number, number, number];
            let sideRGB: [number, number, number];
            if (hideDecorations) {
                // Process mode: flat uniform grey
                topRGB = PROCESS_TOP_RGB;
                sideRGB = PROCESS_SIDE_RGB;
            } else {
                const tc = TERRAIN_RENDERER_MAP[tile.terrain]?.tileColors() ?? TERRAIN_RENDERER_MAP['GRASS'].tileColors();
                tmp.setHex(tc.topColor);
                topRGB = [
                    Math.min(1, tmp.r + tc.topEmissive.r),
                    Math.min(1, tmp.g + tc.topEmissive.g),
                    Math.min(1, tmp.b + tc.topEmissive.b),
                ];
                tmp.setHex(tc.sideColor);
                sideRGB = [
                    Math.min(1, tmp.r + tc.sideEmissive.r),
                    Math.min(1, tmp.g + tc.sideEmissive.g),
                    Math.min(1, tmp.b + tc.sideEmissive.b),
                ];
            }

            const {topGeo, sideGeo, edgeGeoH, edgeGeoV} = buildTileGeo(tile.elevation, x, z, topRGB, sideRGB);
            topGeos.push(topGeo);
            sideGeos.push(sideGeo);
            if (hideDecorations) {
                // All edges into a single bucket – rendered with the grey material
                edgeGeosDark.push(edgeGeoH, edgeGeoV);
            } else {
                const darkEdge = tile.terrain === 'WATER' || tile.terrain === 'SWAMP';
                if (darkEdge) {
                    edgeGeosDark.push(edgeGeoH, edgeGeoV);
                } else {
                    edgeGeosBright.push(edgeGeoH);
                    edgeGeosVert.push(edgeGeoV);
                }
            }
            tileIndexRef.current.set(`${q},${r}`, idx);
            tileByCoordRef.current.set(`${q},${r}`, tile);
        });

        // Merge without groups → single draw call each
        const mergedTop = mergeGeometries(topGeos, false) ?? new THREE.BufferGeometry();
        topGeos.forEach((g) => g.dispose());
        const topMesh = new THREE.Mesh(mergedTop, TILE_TOP_MAT);
        scene.add(topMesh);

        const mergedSide = mergeGeometries(sideGeos, false) ?? new THREE.BufferGeometry();
        sideGeos.forEach((g) => g.dispose());
        const sideMesh = new THREE.Mesh(mergedSide, TILE_SIDE_MAT);
        scene.add(sideMesh);

        // Store colour buffer refs for patchTileMaterial
        const topColAttr = mergedTop.getAttribute('color') as THREE.Float32BufferAttribute | undefined;
        const sideColAttr = mergedSide.getAttribute('color') as THREE.Float32BufferAttribute | undefined;
        if (topColAttr) topColBufRef.current = {buf: topColAttr, vertsPerTile: TMPL_TOP_VERT_COUNT};
        if (sideColAttr) sideColBufRef.current = {buf: sideColAttr, vertsPerTile: TMPL_SIDE_VERT_COUNT};

        const mergedEdgeBright = edgeGeosBright.length
            ? mergeGeometries(edgeGeosBright, false) ?? new THREE.BufferGeometry()
            : new THREE.BufferGeometry();
        edgeGeosBright.forEach((g) => g.dispose());
        const edgeLines = new THREE.LineSegments(mergedEdgeBright, EDGE_MAT);
        scene.add(edgeLines);

        const mergedEdgeVert = edgeGeosVert.length
            ? mergeGeometries(edgeGeosVert, false) ?? new THREE.BufferGeometry()
            : new THREE.BufferGeometry();
        edgeGeosVert.forEach((g) => g.dispose());
        const edgeLinesVert = new THREE.LineSegments(mergedEdgeVert, EDGE_MAT_VERT);
        scene.add(edgeLinesVert);

        const mergedEdgeDark = edgeGeosDark.length
            ? mergeGeometries(edgeGeosDark, false) ?? new THREE.BufferGeometry()
            : new THREE.BufferGeometry();
        edgeGeosDark.forEach((g) => g.dispose());
        const edgeLinesDark = new THREE.LineSegments(mergedEdgeDark, hideDecorations ? PROCESS_EDGE_MAT : EDGE_MAT_DARK);
        scene.add(edgeLinesDark);

        tileMergedRef.current = {
            tops: topMesh,
            sides: sideMesh,
            edges: edgeLines,
            edgesVert: edgeLinesVert,
            edgesDark: edgeLinesDark
        };

        // Ensure the process arrow group is in the scene after every tile rebuild.
        // (The tile effect clears and re-creates the scene objects, so we must re-add.)
        if (!processArrowRendererRef.current) {
            processArrowRendererRef.current = new ProcessArrowRenderer();
        }
        const arrowGroup = processArrowRendererRef.current.getGroup();
        arrowGroup.renderOrder = 20;
        if (!scene.getObjectById(arrowGroup.id)) {
            scene.add(arrowGroup);
        }

        // Apply stage tile highlights immediately after geometry is written so
        // the colour buffers are in the correct state before the first render.
        applyTileHighlights(tiles);

        requestRender();
        setLoading(false);
        }); // end setTimeout
        return () => {
            clearTimeout(tid);
            setLoading(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map.map, hideDecorations]);

    // ── Landmark meshes ─────────────────────────────────────────────────────────
    useEffect(() => {
        const scene = threeRef.current?.scene;
        if (!scene) return;
        landmarkMeshMapRef.current.forEach((g) => {
            scene.remove(g);
            g.traverse((child) => {
                if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
                if ((child as THREE.Sprite).material) {
                    const m = (child as THREE.Sprite).material as THREE.SpriteMaterial;
                    m.map?.dispose();
                    m.dispose();
                }
                if (child instanceof CSS2DObject) child.element.remove();
            });
        });
        landmarkMeshMapRef.current.clear();

        // O(1) lookup maps – built once, used for every landmark below.
        const tileByCoord = tileByCoordRef.current;

        // Set of "q,r" keys that contain any landmark – kept in a ref so it is
        // available globally within HexGrid for O(1) neighbour checks.
        landmarkCoordsRef.current.clear();
        const landmarkByCoord = new Map<string, Landmark>();
        Object.values(map.landmarks ?? {}).forEach((l: Landmark) => {
            if (!l.coordinate) return;
            const key = `${l.coordinate.q},${l.coordinate.r}`;
            landmarkCoordsRef.current.add(key);
            landmarkByCoord.set(key, l);
        });
        const landmarkCoords = landmarkCoordsRef.current;

        Object.values(map.landmarks ?? {}).forEach((landmark: Landmark) => {
            if (!landmark.coordinate) return;
            const {q, r} = landmark.coordinate;
            const tile = tileByCoord.get(`${q},${r}`);
            const elevation = tile?.elevation ?? 0;
            const h = tileHeight(elevation);
            const {x, z} = hexToWorld(q, r, HEX_SIZE);
            if (hideDecorations) {
                const groupColor = landmark.groupId ? (map.groups ?? {})[landmark.groupId]?.color : undefined;
                const MARKER_COLOR = new THREE.Color(groupColor ? parseInt(groupColor.replace('#', ''), 16) : 0x333333);
                const g = new THREE.Group();
                const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.4, 16);
                const mat = new THREE.MeshBasicMaterial({ color: MARKER_COLOR });
                const cylinder = new THREE.Mesh(geo, mat);
                cylinder.position.y = 0.2;
                g.add(cylinder);

                // crisp CSS2D label — black text on white background
                const el = document.createElement('div');
                el.textContent = landmark.name;
                el.style.cssText = [
                    'font-family: ui-monospace, monospace',
                    'font-size: 11px',
                    'font-weight: 700',
                    'color: #000000',
                    'background: #ffffff',
                    'padding: 1px 5px',
                    'border-radius: 3px',
                    'border: 2px solid ' + (groupColor ?? '#aaaaaa'),
                    'pointer-events: none',
                    'white-space: nowrap',
                    'user-select: none',
                ].join(';');
                const label = new CSS2DObject(el);
                label.position.set(0, 0, 0.6);
                g.add(label);
                g.position.set(x, h, z);
                scene.add(g);
                landmarkMeshMapRef.current.set(landmark.id, g);
                return;
            }

            const groupColor = landmark.groupId ? (map.groups ?? {})[landmark.groupId]?.color : undefined;
            const tintHex = groupColor ? parseInt(groupColor.replace('#', ''), 16) : 0xeeeeee;

            const renderer = getLandmarkRenderer(landmark.type);
            let adjacent: Adjacent[] | undefined;
            if (renderer.requiresAdjacent) {
                adjacent = HEX_DIRS
                    .filter(({dq, dr}) => landmarkCoords.has(`${q + dq},${r + dr}`))
                    .map(({dq, dr, unit}) => {
                        const nbrKey = `${q + dq},${r + dr}`;
                        const nbrLandmark = landmarkByCoord.get(nbrKey) ?? null;
                        return {
                            dir: unit,
                            landmark: nbrLandmark,
                            hexTile: tileByCoord.get(nbrKey) ?? null,
                        } satisfies Adjacent;
                    });
            }

            const lmWorstLevel = worstLevel(Object.values(landmark.metrics ?? {}));
            const landmarkGroup = renderer.build(landmark, elevation, new THREE.Color(tintHex), adjacent, lmWorstLevel);
            landmarkGroup.position.set(x, h, z);
            scene.add(landmarkGroup);
            landmarkMeshMapRef.current.set(landmark.id, landmarkGroup);
        });
        requestRender();
        return () => {
            clearNamePlaneCache();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map.landmarks, map.map.tiles]);

    // ── Highlight selected tile – infinity column ────────────────────────────
    useEffect(() => {
        const scene = threeRef.current?.scene;
        if (!scene) return;

        // Remove previous selection mesh
        if (selectionMeshRef.current) {
            scene.remove(selectionMeshRef.current);
            selectionMeshRef.current = null;
        }

        if (selectedTile) {
            const tiles = map.map?.tiles ?? [];
            const idx = tileIndexRef.current.get(`${selectedTile.q},${selectedTile.r}`);
            const tile = idx !== undefined ? tiles[idx] : undefined;
            const {x, z} = hexToWorld(selectedTile.q, selectedTile.r, HEX_SIZE);
            const top = tileHeight(tile?.elevation ?? 0);

            let mesh: THREE.Mesh;
            if (hideDecorations) {
                // Xray/top-down: flat hex ring on the tile surface, clearly visible from above.
                const INNER = HEX_SIZE * 0.72;
                const OUTER = HEX_SIZE * 0.98;
                const y = top + 0.06;
                const verts: number[] = [];
                const idx2: number[] = [];
                for (let k = 0; k < 6; k++) {
                    const a0 = (k * Math.PI * 2) / 6;
                    const a1 = ((k + 1) * Math.PI * 2) / 6;
                    const ox0 = OUTER * Math.cos(a0), oz0 = OUTER * Math.sin(a0);
                    const ox1 = OUTER * Math.cos(a1), oz1 = OUTER * Math.sin(a1);
                    const ix0 = INNER * Math.cos(a0), iz0 = INNER * Math.sin(a0);
                    const ix1 = INNER * Math.cos(a1), iz1 = INNER * Math.sin(a1);
                    const base = k * 4;
                    verts.push(ox0, y, oz0, ox1, y, oz1, ix1, y, iz1, ix0, y, iz0);
                    idx2.push(base, base + 1, base + 2, base, base + 2, base + 3);
                }
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
                geo.setIndex(idx2);
                const mat = new THREE.MeshBasicMaterial({
                    color: 0x00f0ff,
                    transparent: true,
                    opacity: 0.85,
                    depthWrite: false,
                    side: THREE.DoubleSide,
                });
                mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, 0, z);
                mesh.renderOrder = 20;
            } else {
                mesh = new THREE.Mesh(SELECTION_GEO, SELECTION_MAT);
                mesh.position.set(x, top + SELECTION_COL_HEIGHT / 2, z);
            }

            scene.add(mesh);
            selectionMeshRef.current = mesh;
        }

        requestRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTile, map.map.tiles, hideDecorations]);

    const adjacentTiles = (coordinate: HexCoordinate): HexTile[] => {
        return HEX_DIRS.map(
            dir => {
                const adjacent = coordinate.q + dir.dq + ',' + (coordinate.r + dir.dr);
                return tileByCoordRef.current.get(adjacent)
            }
        ).filter((tile): tile is HexTile => tile !== undefined);
    };

    // ── Terrain vegetation (all renderers) ──────────────────────────────────────
    const terrainObjectsRef = useRef<Map<string, THREE.Object3D[]>>(new Map());

    useEffect(() => {
        const scene = threeRef.current?.scene;
        if (!scene) return;

        // Dispose previous objects
        terrainObjectsRef.current.forEach((objs) => {
            objs.forEach((obj) => {
                scene.remove(obj);
                obj.traverse((child) => {
                    (child as THREE.Mesh).geometry?.dispose();
                });
            });
        });
        terrainObjectsRef.current.clear();

        const tiles = map.map?.tiles ?? [];

        // Let each renderer pre-allocate shared GPU resources.
        // We pass the total tile count as a safe upper bound; each renderer
        // multiplies by its own MAX_X_PER_TILE constant internally.
        if (!hideDecorations) {
            Object.entries(TERRAIN_RENDERER_MAP).forEach(([terrain, renderer]) => {
                if (renderer.init) {
                    const objs = renderer.init(scene, tiles.length);
                    if (objs.length) terrainObjectsRef.current.set(`__init__${terrain}`, objs);
                }
            });

            tiles.forEach((tile) => {
                const key = `${tile.coordinate.q},${tile.coordinate.r}`;
                const objs = TERRAIN_RENDERER_MAP[tile.terrain].build(tile, scene, adjacentTiles(tile.coordinate));
                if (objs.length) terrainObjectsRef.current.set(key, objs);
            });

            // Flush all renderers that batch across tiles
            Object.entries(TERRAIN_RENDERER_MAP).forEach(([terrain, renderer]) => {
                if (renderer.flush) {
                    const objs = renderer.flush(scene);
                    if (objs.length) terrainObjectsRef.current.set(`__flush__${terrain}`, objs);
                }
            });
        }
        requestRender();
        // Capture ref map for cleanup — the ref may point elsewhere by the time
        // the cleanup runs, so we close over the current Map instance.
        const capturedTerrainObjects = terrainObjectsRef.current;
        return () => {
            capturedTerrainObjects.forEach((objs) => {
                objs.forEach((obj) => {
                    scene.remove(obj);
                    obj.traverse((child) => {
                        (child as THREE.Mesh).geometry?.dispose();
                    });
                });
            });
            capturedTerrainObjects.clear();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map.map.tiles, hideDecorations]);

    // ── Connection lines ─────────────────────────────────────────────────────────
    useEffect(() => {
        const scene = threeRef.current?.scene;
        if (!scene) return;
        connectionMeshMapRef.current.forEach((obj) => {
            scene.remove(obj);
            obj.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    (child as THREE.Mesh).geometry?.dispose();
                    const mat = (child as THREE.Mesh).material;
                    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
                    else (mat as THREE.Material | undefined)?.dispose();
                }
            });
        });
        connectionMeshMapRef.current.clear();

        connectionLabelMapRef.current.forEach((lbl) => { scene.remove(lbl); lbl.element.remove(); });
        connectionLabelMapRef.current.clear();
        connectionXrayMatRef.current.clear();

        const tiles = map.map?.tiles ?? [];
        Object.values(map.connections ?? {}).forEach((conn) => {
            let obj: THREE.Object3D | null;
            if (hideDecorations) {
                const result = buildXrayLine(conn, tiles);
                if (!result) return;
                obj = result.group;
                connectionXrayMatRef.current.set(conn.id, result.mat);
            } else {
                obj = buildConnectionGroup(conn, tiles);
                if (!obj) return;
            }
            scene.add(obj);
            connectionMeshMapRef.current.set(conn.id, obj);

            if (hideDecorations && conn.name && conn.path.length >= 2) {
                const first = conn.path[0];
                const last  = conn.path[conn.path.length - 1];
                const { x: ax, z: az } = hexToWorld(first.q, first.r, HEX_SIZE);
                const { x: bx, z: bz } = hexToWorld(last.q,  last.r,  HEX_SIZE);
                const firstTile = tileByCoordRef.current.get(`${first.q},${first.r}`);
                const lastTile  = tileByCoordRef.current.get(`${last.q},${last.r}`);
                const my = (tileHeight(firstTile?.elevation ?? 1) + tileHeight(lastTile?.elevation ?? 1)) * 0.5 + 0.15;
                const lbl = new CSS2DObject(makeXrayLabel(conn.name));
                lbl.position.set((ax + bx) * 0.5, my, (az + bz) * 0.5);
                lbl.visible = false;
                scene.add(lbl);
                connectionLabelMapRef.current.set(conn.id, lbl);
            }
        });

        requestRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map.connections, map.map.tiles, hideDecorations]);

    // ── Connection highlight / dim / hide in process mode ────────────────────────────────
    useEffect(() => {
        if (hideDecorations) {
            // Xray mode: three levels — active stage (black), rest of process (dark grey), unrelated (grey).
            const hasProcess = !!highlightConnectionIds;
            const hasStage   = !!activeStageConnectionIds;
            connectionXrayMatRef.current.forEach((mat, connId) => {
                const inStage   = activeStageConnectionIds?.has(connId) ?? false;
                const inProcess = highlightConnectionIds?.has(connId) ?? false;
                const color = (hasStage && inStage) ? 0x111111
                            : (hasProcess && inProcess) ? 0x555555
                            : 0x888888;
                mat.color.set(color);
            });
            // Labels only appear on active-stage connections; hidden when nothing selected.
            connectionLabelMapRef.current.forEach((lbl, connId) => {
                lbl.visible = hasStage
                    ? (activeStageConnectionIds?.has(connId) ?? false)
                    : (highlightConnectionIds?.has(connId) ?? false);
            });
            // Stage name label — positioned at the centroid of stage connection midpoints.
            const scene = threeRef.current?.scene;
            if (stageLabelRef.current) {
                scene?.remove(stageLabelRef.current);
                stageLabelRef.current.element.remove();
                stageLabelRef.current = null;
            }
            if (scene && activeStageName && activeStageConnectionIds && activeStageConnectionIds.size > 0) {
                let cx = 0, cy = 0, cz = 0, count = 0;
                const conns = map.connections ?? {};
                activeStageConnectionIds.forEach((id) => {
                    const conn = conns[id];
                    if (!conn?.path || conn.path.length < 2) return;
                    const first = conn.path[0], last = conn.path[conn.path.length - 1];
                    const { x: ax, z: az } = hexToWorld(first.q, first.r, HEX_SIZE);
                    const { x: bx, z: bz } = hexToWorld(last.q,  last.r,  HEX_SIZE);
                    const firstTile = tileByCoordRef.current.get(`${first.q},${first.r}`);
                    const lastTile  = tileByCoordRef.current.get(`${last.q},${last.r}`);
                    cx += (ax + bx) * 0.5;
                    cy += (tileHeight(firstTile?.elevation ?? 1) + tileHeight(lastTile?.elevation ?? 1)) * 0.5 + 0.4;
                    cz += (az + bz) * 0.5;
                    count++;
                });
                if (count > 0) {
                    const el = document.createElement('div');
                    el.textContent = activeStageName;
                    el.style.cssText = [
                        'font-family: ui-monospace, monospace', 'font-size: 12px',
                        'font-weight: 800', 'color: #ffffff',
                        'background: #111111', 'padding: 2px 8px',
                        'border-radius: 4px', 'pointer-events: none',
                        'white-space: nowrap', 'user-select: none',
                        'letter-spacing: 0.05em', 'text-transform: uppercase',
                    ].join(';');
                    const lbl = new CSS2DObject(el);
                    lbl.position.set(cx / count, cy / count, cz / count);
                    scene.add(lbl);
                    stageLabelRef.current = lbl;
                }
            }
            requestRender();
            return;
        }

        connectionMeshMapRef.current.forEach((obj, connId) => {
            const inProcess = !highlightConnectionIds || highlightConnectionIds.has(connId);
            const inOpenStage = !!(activeStageConnectionIds?.has(connId));
            // Connections in the open stage are hidden — replaced by the arrow overlay
            obj.visible = !inOpenStage;
            obj.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mat = (child as THREE.Mesh).material as THREE.Material;
                    (mat as THREE.MeshLambertMaterial).opacity = inProcess ? 1 : 0.18;
                    (mat as THREE.MeshLambertMaterial).transparent = true;
                } else if ((child as THREE.Line).isLine) {
                    const mat = (child as THREE.Line).material as THREE.LineBasicMaterial;
                    mat.opacity = inProcess ? 1 : 0.18;
                    mat.transparent = true;
                }
            });
        });
        connectionLabelMapRef.current.forEach((lbl, connId) => {
            lbl.visible = !activeStageConnectionIds?.has(connId);
        });
        requestRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightConnectionIds, activeStageConnectionIds, activeStageName, hideDecorations, map.connections]);

    // ── Stage tile highlight (lighter grey for active-stage tiles in process mode) ──
    // Extracted as a plain function so it can be called both after geometry rebuild
    // and whenever stageHighlightTiles changes — avoiding the ordering race.
    const applyTileHighlights = (tiles = map.map?.tiles ?? []) => {
        const topInfo = topColBufRef.current;
        const sideInfo = sideColBufRef.current;
        if (!topInfo || !sideInfo || !hideDecorations) return;
        const highlighted = stageHighlightTilesRef.current;
        // When no set is provided the stage-specific highlight feature is inactive —
        // reset everything to uniform process grey.
        tiles.forEach((_tile, idx) => {
            const key = `${_tile.coordinate.q},${_tile.coordinate.r}`;
            const isHighlighted = highlighted != null && highlighted.has(key);
            const [tr, tg, tb] = isHighlighted ? STAGE_TOP_RGB : PROCESS_TOP_RGB;
            const [sr, sg, sb] = isHighlighted ? STAGE_SIDE_RGB : PROCESS_SIDE_RGB;
            const tBase = idx * topInfo.vertsPerTile * 3;
            for (let v = 0; v < topInfo.vertsPerTile; v++) {
                topInfo.buf.array[tBase + v * 3] = tr;
                topInfo.buf.array[tBase + v * 3 + 1] = tg;
                topInfo.buf.array[tBase + v * 3 + 2] = tb;
            }
            const sBase = idx * sideInfo.vertsPerTile * 3;
            for (let v = 0; v < sideInfo.vertsPerTile; v++) {
                sideInfo.buf.array[sBase + v * 3] = sr;
                sideInfo.buf.array[sBase + v * 3 + 1] = sg;
                sideInfo.buf.array[sBase + v * 3 + 2] = sb;
            }
        });
        topInfo.buf.needsUpdate = true;
        sideInfo.buf.needsUpdate = true;
    };

    // Re-apply highlights whenever the set changes (geometry already exists)
    useEffect(() => {
        stageHighlightTilesRef.current = stageHighlightTiles;
        applyTileHighlights();
        requestRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stageHighlightTiles]);

    // ── CSS2D metric overlay renderer toggle ───────────────────────────────────
    useEffect(() => {
        const hasMetricOverlayEntries = !!metricOverlayEntries && metricOverlayEntries.size > 0;
        const hasXrayLabels = hideDecorations && Object.keys(map.landmarks ?? {}).length > 0;
        threeRef.current?.setCss2dActive(hasMetricOverlayEntries || hasXrayLabels);
    }, [metricOverlayEntries, hideDecorations, map.landmarks, threeRef]);

    // ── Highlighted tile ring mesh (process mode) ─────────────────────────────────
    // For each landmark tile: build a flat annular hex ring (6 quads) that sits
    // on the top surface, using the landmark's group colour.
    // Rings are batched per unique colour → one Mesh per colour group.
    useEffect(() => {
        const scene = threeRef.current?.scene;
        if (!scene) return;

        // Remove previous ring
        disposeHighlightRings(scene);

        if (!landmarkHighlightColors || landmarkHighlightColors.size === 0 || hideDecorations) {
            requestRender();
            return;
        }

        const INNER = HEX_SIZE * 0.80;
        const OUTER = HEX_SIZE * 0.97;
        const CORNER = 0;

        // Group tile geometries by colour value
        const geosByColor = new Map<number, THREE.BufferGeometry[]>();

        landmarkHighlightColors.forEach((color, key) => {
            const tile = tileByCoordRef.current.get(key);
            if (!tile) return;
            const {q, r} = tile.coordinate;
            const {x: cx, z: cz} = hexToWorld(q, r, HEX_SIZE);
            const y = tileHeight(tile.elevation) + 0.04;

            const verts: number[] = [];
            const idx: number[] = [];
            for (let k = 0; k < 6; k++) {
                const a0 = (k * Math.PI * 2) / 6 + CORNER;
                const a1 = ((k + 1) * Math.PI * 2) / 6 + CORNER;
                const ox0 = cx + OUTER * Math.cos(a0), oz0 = cz + OUTER * Math.sin(a0);
                const ox1 = cx + OUTER * Math.cos(a1), oz1 = cz + OUTER * Math.sin(a1);
                const ix0 = cx + INNER * Math.cos(a0), iz0 = cz + INNER * Math.sin(a0);
                const ix1 = cx + INNER * Math.cos(a1), iz1 = cz + INNER * Math.sin(a1);
                const base = k * 4;
                verts.push(ox0, y, oz0, ox1, y, oz1, ix1, y, iz1, ix0, y, iz0);
                idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
            geo.setIndex(idx);
            geo.computeVertexNormals();
            if (!geosByColor.has(color)) geosByColor.set(color, []);
            geosByColor.get(color)!.push(geo);
        });

        if (geosByColor.size === 0) {
            requestRender();
            return;
        }

        // Merge per-colour group and add one Mesh per unique colour.
        // Store all in a Group so we can remove them at once via highlightEdgesRef.
        const group = new THREE.Group();
        geosByColor.forEach((geos, color) => {
            const merged = mergeGeometries(geos, false) ?? new THREE.BufferGeometry();
            geos.forEach((g) => g.dispose());
            const mat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.65,
                depthWrite: false,
                depthTest: true,
                side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(merged, mat);
            mesh.renderOrder = 15;
            group.add(mesh);
        });

        scene.add(group);
        highlightEdgesRef.current = group;
        requestRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [landmarkHighlightColors, map.map.tiles]);

    // ── Metric overlay labels (CSS2D billboarding) ───────────────────────────────
    useEffect(() => {
        const scene = threeRef.current?.scene;
        if (!scene) return;

        // Remove previous overlay labels
        metricOverlayObjectsRef.current.forEach((obj) => {
            scene.remove(obj);
            obj.element.remove();
        });
        metricOverlayObjectsRef.current = [];

        if (!metricOverlayEntries || metricOverlayEntries.size === 0) {
            requestRender();
            return;
        }

        Object.values(map.landmarks ?? {}).forEach((landmark) => {
            const entry = metricOverlayEntries.get(landmark.id);
            if (!entry || !landmark.coordinate) return;

            const tile = tileByCoordRef.current.get(`${landmark.coordinate.q},${landmark.coordinate.r}`);
            const {x, z} = hexToWorld(landmark.coordinate.q, landmark.coordinate.r, HEX_SIZE);
            const y = tileHeight(tile?.elevation ?? 0) + 1.25;

            const el = document.createElement('div');
            el.textContent = entry.value;
            el.style.cssText = [
                'font-family: monospace',
                'font-size: 11px',
                'font-weight: 700',
                'line-height: 1',
                'padding: 2px 5px',
                'border-radius: 3px',
                'border: 1.5px solid ' + entry.color,
                'color: ' + entry.color,
                'background: rgba(0,0,0,0.72)',
                'pointer-events: none',
                'white-space: nowrap',
                'user-select: none',
            ].join(';');

            const obj = new CSS2DObject(el);
            obj.position.set(x, y, z);
            scene.add(obj);
            metricOverlayObjectsRef.current.push(obj);
        });

        requestRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metricOverlayEntries, map.landmarks, map.map.tiles]);

    // ── Process arrow overlay ─────────────────────────────────────────────────────
    useEffect(() => {
        const renderer = processArrowRendererRef.current;
        const scene = threeRef.current?.scene;
        if (!renderer) return;

        arrowLabelObjectsRef.current.forEach((lbl) => { scene?.remove(lbl); lbl.element.remove(); });
        arrowLabelObjectsRef.current = [];

        const tiles = map.map?.tiles ?? [];

        // Xray mode uses straight lines for everything; no WebGL arrow ribbons.
        renderer.update(hideDecorations ? [] : (processStageConnections ?? []), tiles);

        if (!hideDecorations && processStageConnections && processStageConnections.length > 0 && scene) {
            processStageConnections.forEach(({ stageConn, connection }) => {
                    const text = stageConn.title || connection.name;
                    if (!text) return;
                    const mid = connection.path[Math.floor(connection.path.length / 2)];
                    if (!mid) return;
                    const midTile = tileByCoordRef.current.get(`${mid.q},${mid.r}`);
                    const { x: mx, z: mz } = hexToWorld(mid.q, mid.r, HEX_SIZE);
                    const my = tileHeight(midTile?.elevation ?? 1) + 0.15;
                    const el = makeXrayLabel(text);
                    el.style.borderLeft = '3px solid #38bdf8';
                    const lbl = new CSS2DObject(el);
                    lbl.position.set(mx, my, mz);
                    scene.add(lbl);
                    arrowLabelObjectsRef.current.push(lbl);
                });
        }
        requestRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [processStageConnections, map.map]);

    // Dispose arrow renderer on unmount
    useEffect(() => {
        return () => {
            processArrowRendererRef.current?.dispose();
            metricOverlayObjectsRef.current.forEach((obj) => obj.element.remove());
            metricOverlayObjectsRef.current = [];
            connectionLabelMapRef.current.forEach((lbl) => lbl.element.remove());
            connectionLabelMapRef.current.clear();
            arrowLabelObjectsRef.current.forEach((lbl) => lbl.element.remove());
            arrowLabelObjectsRef.current = [];
            stageLabelRef.current?.element.remove();
            stageLabelRef.current = null;
        };
    }, []);

    // ── Shared raycaster helper ──────────────────────────────────────────────────
    const pickTile = (clientX: number, clientY: number): { q: number; r: number } | null => {
        const three = threeRef.current;
        const merged = tileMergedRef.current;
        if (!three || !merged) return null;
        const {renderer, camera} = three;
        const rect = renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1,
        );
        const raycaster = raycasterRef.current;
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObject(merged.tops);
        if (!hits.length) return null;
        const idx = Math.floor((hits[0].face?.a ?? 0) / TMPL_TOP_VERT_COUNT);
        const tile = (map.map?.tiles ?? [])[idx];
        return tile ? tile.coordinate : null;
    };

    // ── Pointer handlers ─────────────────────────────────────────────────────────
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        pointerDownRef.current = {x: e.clientX, y: e.clientY};
        if (brushMode) {
            brushActiveRef.current = true;
            brushedInStrokeRef.current = new Set();
            if (threeRef.current) threeRef.current.controls.enabled = false;
            const coord = pickTile(e.clientX, e.clientY);
            if (coord) {
                brushedInStrokeRef.current.add(`${coord.q},${coord.r}`);
                onTileClick(coord.q, coord.r);
            }
        }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!brushMode || !brushActiveRef.current) return;
        const coord = pickTile(e.clientX, e.clientY);
        if (!coord) return;
        const key = `${coord.q},${coord.r}`;
        if (brushedInStrokeRef.current.has(key)) return;
        brushedInStrokeRef.current.add(key);
        onTileClick(coord.q, coord.r);
    };

    const handlePointerUp = () => {
        if (brushMode) {
            brushActiveRef.current = false;
            brushedInStrokeRef.current = new Set();
            if (threeRef.current) threeRef.current.controls.enabled = true;
        }
    };

    const handlePointerLeave = () => {
        handlePointerUp();
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (brushMode) return;
        const down = pointerDownRef.current;
        if (down) {
            const dx = e.clientX - down.x, dy = e.clientY - down.y;
            if (Math.sqrt(dx * dx + dy * dy) > 5) return;
        }

        // Connection-click for process mode
        if (onConnectionClick) {
            const three = threeRef.current;
            if (three) {
                const {renderer, camera} = three;
                const rect = renderer.domElement.getBoundingClientRect();
                const ndc = new THREE.Vector2(
                    ((e.clientX - rect.left) / rect.width) * 2 - 1,
                    -((e.clientY - rect.top) / rect.height) * 2 + 1,
                );
                const ray = raycasterRef.current;
                ray.setFromCamera(ndc, camera);
                const connObjects = [...connectionMeshMapRef.current.entries()];
                for (const [connId, obj] of connObjects) {
                    const hits = ray.intersectObject(obj, true);
                    if (hits.length > 0) {
                        onConnectionClick(connId);
                        return;
                    }
                }
            }
        }

        const coord = pickTile(e.clientX, e.clientY);
        if (coord) {
            setSelectedTile(coord);
            onTileClick(coord.q, coord.r);
        }
    };

    // ── Keyboard navigation ────────────────────────────────────────────────────
    // Arrow keys move the selection to the neighbouring tile; Enter triggers the
    // tile-click handler.  This makes the map navigable without a mouse.
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (brushMode) return;
        const dirMap: Record<string, { dq: number; dr: number }> = {
            ArrowRight: { dq: 1, dr: 0 },
            ArrowUpRight: { dq: 1, dr: -1 },
            ArrowUp: { dq: 0, dr: -1 },
            ArrowLeft: { dq: -1, dr: 0 },
            ArrowDownLeft: { dq: -1, dr: 1 },
            ArrowDown: { dq: 0, dr: 1 },
        };
        const dir = dirMap[e.key];
        if (dir) {
            e.preventDefault();
            const base = selectedTile ?? { q: 0, r: 0 };
            const target = { q: base.q + dir.dq, r: base.r + dir.dr };
            if (tileByCoordRef.current.has(`${target.q},${target.r}`)) {
                setSelectedTile(target);
                onTileClickRef.current(target.q, target.r);
            }
            return;
        }
        if (e.key === 'Enter' && selectedTile) {
            e.preventDefault();
            onTileClickRef.current(selectedTile.q, selectedTile.r);
        }
    };

    return (
        <div className="relative w-full h-full">
            <div
                ref={mountRef}
                className="w-full h-full block outline-none"
                style={{cursor: (brushMode || crosshairCursor) ? 'crosshair' : 'default'}}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                role="application"
                aria-label="Hexagonal map grid"
            />
            {loading && (
                <LoadingOverlay label={LOADING_COPY.render} variant="overlay" />
            )}
        </div>
    );
}
