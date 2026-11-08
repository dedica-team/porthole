import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {HexCoordinate, HexTile, Terrain} from '@/types/hex';
import type {Landmark} from '@/types/landmark';
import {worstLevel} from '@/types/landmark';
import type {SessionState} from '@/types/session';
import {hexToWorld} from '@/utils/hexUtils.ts';
import {useMapStore} from '@/store/mapStore.ts';
import {TERRAIN_RENDERER_MAP, tileHeight,} from './terrainRenderers';
import type {Adjacent} from './landmarks/index';
import {getLandmarkRenderer} from './landmarks/index';
import {clearNamePlaneCache} from './landmarks/landmarkUtils';
import {buildConnectionGroup, buildXrayLine} from './connectionRenderers';
import {useThreeScene} from './useThreeScene';
import type {FirstPersonState} from './useThreeScene';
import type {GameState} from '@/types/game';
import {
    BUG_CLEARANCE,
    buildBugMesh,
    buildExplosion,
    buildProjectile,
    disposeGameObject,
    type ExplosionInstance,
    interpolateBugPosition,
    updateExplosion,
} from './gameRenderers';
import VirtualJoystick from './VirtualJoystick';
import {shoot as fireShot} from '@/api/mapApi';
import type {RendererQualityProfile} from './renderQuality';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import {LOADING_COPY} from '@/components/ui/loadingCopy';
import {
    buildTileGeo,
    EDGE_MAT,
    EDGE_MAT_DARK,
    EDGE_MAT_VERT,
    SELECTION_COL_HEIGHT,
    SELECTION_GEO,
    SELECTION_MAT,
    TILE_SIDE_MAT,
    TILE_TOP_MAT,
    TMPL_SIDE_VERT_COUNT,
    TMPL_TOP_VERT_COUNT,
} from './tileGeometry';
import type {StageConnectionEntry} from './ProcessArrowRenderer';
import {ProcessArrowRenderer} from './ProcessArrowRenderer';
import {CSS2DObject} from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {computeTileHeatmapColor, resolveStatusElements} from './heatmapUtils';


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
const PROCESS_EDGE_MAT = new THREE.LineBasicMaterial({color: 0xd0d0d0, transparent: false});

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
    /** When set, only these landmark IDs show their CSS2D label; others are hidden. */
    visibleLandmarkLabelIds?: Set<string>;
    /** When set, only these landmark IDs (nodes) are visible on the map; others are hidden. */
    visibleLandmarkIds?: Set<string>;
    /** Tower-defense state: bugs currently on the map. */
    gameState?: GameState | null;
    /** Watchtower landmark the local user is inside; enables first-person mode. */
    activeWatchtowerId?: string | null;
}

const HEX_SIZE = 1;
/** Bugs are interpolated over slightly less than the server tick so they never lag behind. */
const BUG_MOVE_INTERP_MS = 850;
const BUG_CORPSE_LIFETIME_MS = 6000;
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
                                    visibleLandmarkLabelIds,
                                    visibleLandmarkIds,
                                    gameState,
                                    activeWatchtowerId,
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
    const tileByCoord = useMemo(() => {
        const m = new Map<string, HexTile>();
        (map.map?.tiles ?? []).forEach((t) => m.set(`${t.coordinate.q},${t.coordinate.r}`, t));
        return m;
    }, [map.map?.tiles]);
    const tileByCoordRef = useRef<Map<string, HexTile>>(tileByCoord);
    tileByCoordRef.current = tileByCoord;
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
    const bugMeshMapRef = useRef<Map<string, THREE.Group>>(new Map());
    const bugMotionRef = useRef<Map<string, { from: THREE.Vector3; to: THREE.Vector3; startedAt: number }>>(new Map());
    const buildingHealthBarsRef = useRef<CSS2DObject[]>([]);
    const projectileRef = useRef<Array<{ mesh: THREE.Mesh; velocity: THREE.Vector3; bornAt: number }>>([]);
    const bugCorpseRef = useRef<Array<{ mesh: THREE.Group; timer: number }>>([]);
    const explosionRef = useRef<ExplosionInstance[]>([]);
    const firstPersonRef = useRef<FirstPersonState | null>(null);
    const savedCameraRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
    const joystickRef = useRef({ x: 0, y: 0 });
    const fireRef = useRef<(() => void) | null>(null);

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
    const threeRef = useThreeScene({
        mountRef,
        fpsRef,
        onNativePointerMove: stableNativeMove.current,
        qualityProfile: rendererQualityProfile,
        orthographic: hideDecorations,
        firstPersonRef,
    });

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
        tileByCoordRef.current = tileByCoord;
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

    // ── Tower-defense: bug NPCs ──────────────────────────────────────────────────
    useEffect(() => {
        const scene = threeRef.current?.scene;
        if (!scene) return;

        const seen = new Set<string>();
        Object.values(gameState?.bugs ?? {}).forEach((bug) => {
            seen.add(bug.id);
            const {q, r} = bug.coordinate;
            const tile = tileByCoordRef.current.get(`${q},${r}`) ?? map.map?.tiles?.find(t => t.coordinate.q === q && t.coordinate.r === r);
            const {x, z} = hexToWorld(q, r, HEX_SIZE);

            const targetPosition = new THREE.Vector3(x, tileHeight(tile?.elevation ?? 0) + BUG_CLEARANCE, z);

            let group = bugMeshMapRef.current.get(bug.id);
            if (!group) {
                group = buildBugMesh();
                // Bugs are intentionally half the previous size on screen.
                group.scale.setScalar(0.5);
                group.position.copy(targetPosition);
                scene.add(group);
                bugMeshMapRef.current.set(bug.id, group);
            } else {
                const motion = bugMotionRef.current.get(bug.id);
                if (!motion || motion.to.distanceToSquared(targetPosition) > 1e-6) {
                    // Start each step from the currently rendered position, not the
                    // server tile, so back-to-back updates never snap.
                    bugMotionRef.current.set(bug.id, {
                        from: group.position.clone(),
                        to: targetPosition,
                        startedAt: performance.now(),
                    });
                }
                if (gameState?.phase !== 'ACTIVE' && (!motion || motion.to.distanceToSquared(targetPosition) <= 1e-6)) {
                    group.position.copy(targetPosition);
                }
            }

            const target = bug.targetLandmarkId ? map.landmarks[bug.targetLandmarkId] : null;
            if (target?.coordinate) {
                const {x: tx, z: tz} = hexToWorld(target.coordinate.q, target.coordinate.r, HEX_SIZE);
                group.rotation.y = Math.atan2(tx - x, tz - z);
            }
        });

        bugMeshMapRef.current.forEach((group, id) => {
            if (!seen.has(id)) {
                scene.remove(group);
                disposeGameObject(group);
                bugMeshMapRef.current.delete(id);
                bugMotionRef.current.delete(id);
            }
        });

        requestRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState?.bugs, gameState?.phase, map.map.tiles, map.landmarks, tileByCoord]);

    useEffect(() => {
        const bugMeshes = bugMeshMapRef.current;
        return () => {
            // The scene lives for the component lifetime; reading the ref at unmount is intentional.
            // eslint-disable-next-line react-hooks/exhaustive-deps
            const scene = threeRef.current?.scene;
            if (!scene) return;
            bugMeshes.forEach((group) => {
                scene.remove(group);
                disposeGameObject(group);
            });
            bugMeshes.clear();
        };
    }, [threeRef]);

    useEffect(() => {
        return () => {
            const scene = threeRef.current?.scene;
            bugCorpseRef.current.forEach(({ mesh, timer }) => {
                window.clearTimeout(timer);
                scene?.remove(mesh);
                disposeGameObject(mesh);
            });
            bugCorpseRef.current = [];
        };
    }, [threeRef]);

    // Smooth bug movement: ease each step over most of the server tick.
    useEffect(() => {
        if (gameState?.phase !== 'ACTIVE') return;

        let raf = 0;
        const animate = (now: number) => {
            let moving = false;
            bugMotionRef.current.forEach((motion, id) => {
                const group = bugMeshMapRef.current.get(id);
                if (!group) return;
                const t = Math.min(1, (now - motion.startedAt) / BUG_MOVE_INTERP_MS);
                const eased = t * t * (3 - 2 * t);
                interpolateBugPosition(motion.from, motion.to, eased, group.position);
                if (t < 1) moving = true;
            });
            if (moving) {
                requestRender();
                raf = requestAnimationFrame(animate);
            }
        };
        raf = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState?.phase, gameState?.bugs, threeRef]);

    // ── Tower-defense: building health bars ─────────────────────────────────────
    useEffect(() => {
        const scene = threeRef.current?.scene;
        if (!scene) return;

        buildingHealthBarsRef.current.forEach((obj) => {
            scene.remove(obj);
            obj.element.remove();
        });
        buildingHealthBarsRef.current = [];

        if (!gameState || gameState.phase === 'IDLE') {
            requestRender();
            return;
        }

        const maxHealth = gameState.buildingMaxHealth && gameState.buildingMaxHealth > 0
            ? gameState.buildingMaxHealth
            : 100;
        const healthByLandmark = gameState.buildingHealth ?? {};

        Object.values(map.landmarks ?? {}).forEach((landmark) => {
            if (!landmark.coordinate) return;
            if (landmark.type === 'WALL' || landmark.type === 'RUINS') return;
            const health = healthByLandmark[landmark.id];
            if (health == null) return;

            const ratio = Math.max(0, Math.min(1, health / maxHealth));
            const color = ratio > 0.6 ? '#22c55e' : ratio > 0.3 ? '#f59e0b' : '#ef4444';

            const el = document.createElement('div');
            el.style.cssText = [
                'width: 34px',
                'height: 6px',
                'border: 1px solid rgba(0,0,0,0.75)',
                'border-radius: 2px',
                'background: rgba(0,0,0,0.65)',
                'overflow: hidden',
                'pointer-events: none',
                'user-select: none',
                'box-shadow: 0 1px 2px rgba(0,0,0,0.6)',
            ].join(';');
            const fill = document.createElement('div');
            fill.style.cssText = [
                'height: 100%',
                `width: ${ratio * 100}%`,
                `background: ${color}`,
                'transition: width 120ms linear',
            ].join(';');
            el.appendChild(fill);

            const tile = tileByCoordRef.current.get(`${landmark.coordinate.q},${landmark.coordinate.r}`);
            const {x, z} = hexToWorld(landmark.coordinate.q, landmark.coordinate.r, HEX_SIZE);
            const y = tileHeight(tile?.elevation ?? 0) + 1.15;
            const obj = new CSS2DObject(el);
            obj.position.set(x, y, z);
            scene.add(obj);
            buildingHealthBarsRef.current.push(obj);
        });

        requestRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState?.buildingHealth, gameState?.buildingMaxHealth, gameState?.phase, map.landmarks, map.map.tiles]);

    // ── Tower-defense: first-person watchtower camera ────────────────────────────
    useEffect(() => {
        const three = threeRef.current;
        if (!three) return;

        const tower = activeWatchtowerId ? map.landmarks[activeWatchtowerId] : null;
        const towerHealth = activeWatchtowerId
            ? (gameState?.buildingHealth?.[activeWatchtowerId] ?? gameState?.buildingMaxHealth ?? 100)
            : null;
        const isRuined = !tower || tower.type !== 'WATCHTOWER' || (towerHealth !== null && towerHealth <= 0);

        if (!activeWatchtowerId || isRuined || !tower?.coordinate) {
            if (firstPersonRef.current) {
                firstPersonRef.current = null;
                const saved = savedCameraRef.current;
                if (saved) {
                    three.camera.position.copy(saved.position);
                    three.controls.target.copy(saved.target);
                    three.controls.update();
                }
                savedCameraRef.current = null;
                three.requestRender();
            }
            if (activeWatchtowerId && isRuined) {
                useMapStore.getState().setActiveWatchtowerId(null);
            }
            return;
        }

        const {q, r} = tower.coordinate;
        const tile = tileByCoordRef.current.get(`${q},${r}`) ?? map.map?.tiles?.find(t => t.coordinate.q === q && t.coordinate.r === r);
        const {x, z} = hexToWorld(q, r, HEX_SIZE);
        const y = tileHeight(tile?.elevation ?? 0) + 1.35;
        const yaw = Math.atan2(x, z);

        const existing = firstPersonRef.current;
        if (!existing || existing.towerId !== activeWatchtowerId) {
            if (!existing) {
                savedCameraRef.current = {
                    position: three.camera.position.clone(),
                    target: three.controls.target.clone(),
                };
            }
            firstPersonRef.current = {
                enabled: true,
                towerId: activeWatchtowerId ?? undefined,
                position: new THREE.Vector3(x, y, z),
                yaw,
                pitch: -0.08,
            };
        } else {
            // Map updates (landmark edits, terrain changes, game broadcasts) must not
            // reset the player's aim; only move the camera if the tower itself moved.
            existing.position.set(x, y, z);
        }
        three.requestRender();
    }, [activeWatchtowerId, gameState?.buildingHealth, gameState?.buildingMaxHealth, map.landmarks, map.map.tiles, threeRef]);

    // ── Tower-defense: AWSD / Joystick aiming, Space firing, ballistic projectiles ──────────
    useEffect(() => {
        if (!activeWatchtowerId) return;

        const spawnExplosion = (position: THREE.Vector3) => {
            const three = threeRef.current;
            if (!three) return;

            const explosion = buildExplosion();
            explosion.group.position.copy(position);
            three.scene.add(explosion.group);
            explosionRef.current.push({
                group: explosion.group,
                bornAt: performance.now(),
                particles: explosion.particles,
                coreMesh: explosion.coreMesh,
            });
            three.requestRender();
        };

        const dropCorpse = (position: THREE.Vector3, yaw: number) => {
            const three = threeRef.current;
            if (!three) return;

            const corpse = buildBugMesh();
            corpse.scale.setScalar(0.5);
            // Flip belly-up and lift slightly so the legs point at the sky.
            corpse.position.set(position.x, position.y + 0.25, position.z);
            corpse.rotation.set(Math.PI, yaw, 0);
            three.scene.add(corpse);
            three.requestRender();

            const timer = window.setTimeout(() => {
                threeRef.current?.scene.remove(corpse);
                disposeGameObject(corpse);
                bugCorpseRef.current = bugCorpseRef.current.filter((entry) => entry.mesh !== corpse);
                threeRef.current?.requestRender();
            }, BUG_CORPSE_LIFETIME_MS);

            bugCorpseRef.current.push({mesh: corpse, timer});
        };

        const fire = () => {
            const fp = firstPersonRef.current;
            const three = threeRef.current;
            if (!fp?.enabled || !three) return;

            const aim = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(fp.pitch, fp.yaw, 0, 'YXZ'));
            const origin = fp.position.clone().add(aim.clone().multiplyScalar(0.6));
            const projectile = buildProjectile();
            projectile.position.copy(origin);
            three.scene.add(projectile);
            projectileRef.current.push({
                mesh: projectile,
                velocity: aim.clone().multiplyScalar(60),
                bornAt: performance.now(),
            });
            three.requestRender();

            // Capture visible positions before the server broadcast removes the bug.
            const visibleBugs = new Map<string, { position: THREE.Vector3; yaw: number }>();
            Object.keys(useMapStore.getState().gameState?.bugs ?? {}).forEach((id) => {
                const mesh = bugMeshMapRef.current.get(id);
                if (mesh) visibleBugs.set(id, { position: mesh.position.clone(), yaw: mesh.rotation.y });
            });

            fireShot(
                map.id,
                {x: origin.x, y: origin.y, z: origin.z},
                {x: aim.x, y: aim.y, z: aim.z},
            )
                .then((result) => {
                    if (!result.hit) {
                        if (result.hitPosition) {
                            spawnExplosion(new THREE.Vector3(result.hitPosition.x, result.hitPosition.y, result.hitPosition.z));
                        }
                        return;
                    }
                    if (result.bugId) {
                        const hit = visibleBugs.get(result.bugId);
                        if (hit) {
                            dropCorpse(hit.position, hit.yaw);
                            spawnExplosion(hit.position);
                        } else if (result.hitPosition) {
                            spawnExplosion(new THREE.Vector3(result.hitPosition.x, result.hitPosition.y, result.hitPosition.z));
                        }
                        useMapStore.getState().removeBug(result.bugId);
                    } else if (result.landmarkId) {
                        const targetBuilding = map.landmarks[result.landmarkId];
                        if (targetBuilding?.coordinate) {
                            const {q, r} = targetBuilding.coordinate;
                            const tile = tileByCoordRef.current.get(`${q},${r}`);
                            const {x, z} = hexToWorld(q, r, HEX_SIZE);
                            const y = tileHeight(tile?.elevation ?? 0) + 0.6;
                            spawnExplosion(new THREE.Vector3(x, y, z));
                        } else if (result.hitPosition) {
                            spawnExplosion(new THREE.Vector3(result.hitPosition.x, result.hitPosition.y, result.hitPosition.z));
                        }
                    } else if (result.hitPosition) {
                        spawnExplosion(new THREE.Vector3(result.hitPosition.x, result.hitPosition.y, result.hitPosition.z));
                    }
                })
                .catch(() => { /* server rejects shots from outside a tower */ });
        };

        fireRef.current = fire;

        const isEditableTarget = (target: EventTarget | null) => {
            const el = target as HTMLElement | null;
            if (!el) return false;
            return (
                el.tagName === 'INPUT' ||
                el.tagName === 'TEXTAREA' ||
                el.tagName === 'SELECT' ||
                el.isContentEditable
            );
        };

        const keysPressed = new Set<string>();

        const onKeyDown = (event: KeyboardEvent) => {
            if (isEditableTarget(event.target)) return;
            const code = event.code;
            const key = event.key.toLowerCase();
            if (code === 'Space') {
                event.preventDefault();
                if (!event.repeat) fire();
                return;
            }
            if (
                code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD' ||
                key === 'w' || key === 'a' || key === 's' || key === 'd' ||
                code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight'
            ) {
                event.preventDefault();
                keysPressed.add(key);
                keysPressed.add(code.toLowerCase());
            }
        };

        const onKeyUp = (event: KeyboardEvent) => {
            const code = event.code;
            const key = event.key.toLowerCase();
            keysPressed.delete(key);
            keysPressed.delete(code.toLowerCase());
        };

        const onBlur = () => {
            keysPressed.clear();
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);

        let last = performance.now();
        let raf = 0;
        const loop = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;

            const fp = firstPersonRef.current;
            if (fp?.enabled) {
                let keyX = 0;
                let keyY = 0;
                if (keysPressed.has('a') || keysPressed.has('keya') || keysPressed.has('arrowleft')) keyX -= 1;
                if (keysPressed.has('d') || keysPressed.has('keyd') || keysPressed.has('arrowright')) keyX += 1;
                if (keysPressed.has('w') || keysPressed.has('keyw') || keysPressed.has('arrowup')) keyY += 1;
                if (keysPressed.has('s') || keysPressed.has('keys') || keysPressed.has('arrowdown')) keyY -= 1;

                const joy = joystickRef.current;
                const combinedX = Math.max(-1, Math.min(1, joy.x + keyX));
                const combinedY = Math.max(-1, Math.min(1, joy.y + keyY));

                const turnSpeed = 0.8;
                if (Math.abs(combinedX) > 0.02) fp.yaw -= combinedX * turnSpeed * dt;
                if (Math.abs(combinedY) > 0.02) {
                    fp.pitch = Math.max(-1.2, Math.min(1.2, fp.pitch + combinedY * turnSpeed * dt));
                }

                const three = threeRef.current;
                if (three) {
                    const survivors: typeof projectileRef.current = [];
                    for (const projectile of projectileRef.current) {
                        const age = (now - projectile.bornAt) / 1000;
                        if (age > 3) {
                            three.scene.remove(projectile.mesh);
                            disposeGameObject(projectile.mesh);
                            continue;
                        }
                        projectile.velocity.y -= 9.81 * dt;
                        projectile.mesh.position.addScaledVector(projectile.velocity, dt);

                        // If projectile hits ground elevation, trigger small impact explosion and remove
                        const pos = projectile.mesh.position;
                        const approxQ = Math.round(pos.x / (HEX_SIZE * 1.5));
                        const approxR = Math.round((pos.z / (HEX_SIZE * Math.sqrt(3))) - approxQ / 2);
                        const tile = tileByCoordRef.current.get(`${approxQ},${approxR}`);
                        const groundY = tileHeight(tile?.elevation ?? 0);
                        if (pos.y <= groundY + 0.05) {
                            spawnExplosion(new THREE.Vector3(pos.x, Math.max(groundY + 0.05, pos.y), pos.z));
                            three.scene.remove(projectile.mesh);
                            disposeGameObject(projectile.mesh);
                            continue;
                        }

                        survivors.push(projectile);
                    }
                    projectileRef.current = survivors;

                    const survivingExplosions: ExplosionInstance[] = [];
                    for (const exp of explosionRef.current) {
                        const alive = updateExplosion(exp, now, dt);
                        if (!alive) {
                            three.scene.remove(exp.group);
                            disposeGameObject(exp.group);
                        } else {
                            survivingExplosions.push(exp);
                        }
                    }
                    explosionRef.current = survivingExplosions;

                    three.requestRender();
                }
            }

            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
            fireRef.current = null;
            joystickRef.current = {x: 0, y: 0};

            const three = threeRef.current;
            projectileRef.current.forEach((projectile) => {
                three?.scene.remove(projectile.mesh);
                disposeGameObject(projectile.mesh);
            });
            projectileRef.current = [];

            explosionRef.current.forEach((exp) => {
                three?.scene.remove(exp.group);
                disposeGameObject(exp.group);
            });
            explosionRef.current = [];
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeWatchtowerId, map.id]);

    // ── Landmark visibility in process mode ──────────────────────────────────────
    useEffect(() => {
        if (!hideDecorations) return;
        landmarkMeshMapRef.current.forEach((group, landmarkId) => {
            const showNode = !visibleLandmarkIds || visibleLandmarkIds.has(landmarkId);
            const showLabel = showNode && (!visibleLandmarkLabelIds || visibleLandmarkLabelIds.has(landmarkId));
            group.visible = showNode;
            group.children.forEach((child) => {
                if (child instanceof CSS2DObject) child.visible = showLabel;
            });
        });
        requestRender();
    }, [visibleLandmarkIds, visibleLandmarkLabelIds, hideDecorations]);

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
                const mid = conn.path[Math.floor(conn.path.length / 2)];
                const { x: mx, z: mz } = hexToWorld(mid.q, mid.r, HEX_SIZE);
                const midTile = tileByCoordRef.current.get(`${mid.q},${mid.r}`);
                const my = tileHeight(midTile?.elevation ?? 1) + 0.15;
                const lbl = new CSS2DObject(makeXrayLabel(conn.name));
                lbl.position.set(mx, my, mz);
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
            // Xray mode: active stage (white), rest of process (dark grey), unrelated (hidden when a process is active, grey when no process is active).
            const hasProcess = !!highlightConnectionIds;
            const hasStage   = !!activeStageConnectionIds;
            connectionXrayMatRef.current.forEach((mat, connId) => {
                const inStage   = activeStageConnectionIds?.has(connId) ?? false;
                const inProcess = highlightConnectionIds?.has(connId) ?? false;
                const color = (hasStage && inStage) ? 0xffffff
                            : (hasProcess && inProcess) ? 0x555555
                            : 0x888888;
                mat.color.set(color);
            });
            connectionMeshMapRef.current.forEach((obj, connId) => {
                obj.visible = !hasProcess || (highlightConnectionIds?.has(connId) ?? false);
            });
            // Labels only appear on active-stage connections (or active process connections when no stage open); hidden when nothing selected or unrelated.
            connectionLabelMapRef.current.forEach((lbl, connId) => {
                const inProcess = !hasProcess || (highlightConnectionIds?.has(connId) ?? false);
                lbl.visible = inProcess && (hasStage
                    ? (activeStageConnectionIds?.has(connId) ?? false)
                    : (highlightConnectionIds?.has(connId) ?? false));
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
                    const mid = conn.path[Math.floor(conn.path.length / 2)];
                    const { x: mx, z: mz } = hexToWorld(mid.q, mid.r, HEX_SIZE);
                    const midTile = tileByCoordRef.current.get(`${mid.q},${mid.r}`);
                    cx += mx;
                    cy += tileHeight(midTile?.elevation ?? 1) + 0.4;
                    cz += mz;
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
                        'letter-spacing: 0.05em',
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

    // ── Stage tile highlight & status heatmaps in process (xray) mode ─────────
    // Extracted as a plain function so it can be called both after geometry rebuild
    // and whenever stageHighlightTiles / landmarks / metricOverlayEntries change.
    const applyTileHighlights = (tiles = map.map?.tiles ?? []) => {
        const topInfo = topColBufRef.current;
        const sideInfo = sideColBufRef.current;
        if (!topInfo || !sideInfo || !hideDecorations) return;
        const highlighted = stageHighlightTilesRef.current;
        const statusElements = resolveStatusElements(
            map.landmarks,
            metricOverlayEntries,
            hideDecorations ? visibleLandmarkIds : undefined,
        );

        tiles.forEach((_tile, idx) => {
            const key = `${_tile.coordinate.q},${_tile.coordinate.r}`;
            const isHighlighted = highlighted != null && highlighted.has(key);

            const heatmap = computeTileHeatmapColor(_tile.coordinate.q, _tile.coordinate.r, statusElements);

            let tr: number, tg: number, tb: number;
            let sr: number, sg: number, sb: number;

            if (heatmap) {
                [tr, tg, tb] = heatmap.topRGB;
                [sr, sg, sb] = heatmap.sideRGB;
            } else if (isHighlighted) {
                [tr, tg, tb] = STAGE_TOP_RGB;
                [sr, sg, sb] = STAGE_SIDE_RGB;
            } else {
                [tr, tg, tb] = PROCESS_TOP_RGB;
                [sr, sg, sb] = PROCESS_SIDE_RGB;
            }

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

    // Re-apply highlights and heatmaps whenever stage, landmarks, or metric overlays change
    useEffect(() => {
        stageHighlightTilesRef.current = stageHighlightTiles;
        applyTileHighlights();
        requestRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stageHighlightTiles, map.landmarks, metricOverlayEntries, hideDecorations, visibleLandmarkIds]);

    // ── CSS2D metric overlay renderer toggle ───────────────────────────────────
    useEffect(() => {
        const hasMetricOverlayEntries = !!metricOverlayEntries && metricOverlayEntries.size > 0;
        const hasXrayLabels = hideDecorations && Object.keys(map.landmarks ?? {}).length > 0;
        // Health bars are CSS2D objects too; enable the renderer while they exist.
        const hasHealthBars = buildingHealthBarsRef.current.length > 0;
        threeRef.current?.setCss2dActive(hasMetricOverlayEntries || hasXrayLabels || hasHealthBars);
    }, [
        metricOverlayEntries,
        hideDecorations,
        map.landmarks,
        map.map.tiles,
        gameState?.buildingHealth,
        gameState?.phase,
        threeRef,
    ]);

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
            if (hideDecorations && visibleLandmarkIds && !visibleLandmarkIds.has(landmark.id)) return;

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
    }, [metricOverlayEntries, map.landmarks, map.map.tiles, hideDecorations, visibleLandmarkIds]);

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
                    el.style.borderLeft = '3px solid #ffffff';
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
            {activeWatchtowerId && (
                <div className="pointer-events-none absolute inset-0 z-20">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="relative h-7 w-7">
                            <span className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-red-400" />
                            <span className="absolute left-1/2 bottom-0 h-2 w-px -translate-x-1/2 bg-red-400" />
                            <span className="absolute top-1/2 left-0 w-2 h-px -translate-y-1/2 bg-red-400" />
                            <span className="absolute top-1/2 right-0 w-2 h-px -translate-y-1/2 bg-red-400" />
                            <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-300" />
                        </div>
                    </div>
                    <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
                        <VirtualJoystick
                            onChange={(x, y) => {
                                joystickRef.current = {x, y};
                            }}
                        />
                    </div>
                    <button
                        type="button"
                        aria-label="Fire"
                        className="pointer-events-auto absolute bottom-4 right-4 h-20 w-20 touch-none select-none rounded-full border-2 border-red-300/70 bg-red-600/90 text-sm font-bold uppercase tracking-wider text-white shadow-lg transition active:scale-95 active:bg-red-700 sm:bottom-6 sm:right-6"
                        onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            fireRef.current?.();
                        }}
                    >
                        Fire
                    </button>
                </div>
            )}
            {loading && (
                <LoadingOverlay label={LOADING_COPY.render} variant="overlay" />
            )}
        </div>
    );
}
