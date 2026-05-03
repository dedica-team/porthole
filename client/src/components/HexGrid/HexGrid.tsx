import {useEffect, useRef} from 'react';
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
import {buildConnectionGroup, buildSimpleConnectionLine} from './connectionRenderers';
import {useThreeScene} from './useThreeScene';
import type {RendererQualityProfile} from './renderQuality';
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


/** Uniform grey used for all tiles in process mode. */
const PROCESS_TOP_RGB: [number, number, number] = [0.13, 0.13, 0.13];
const PROCESS_SIDE_RGB: [number, number, number] = [0.07, 0.07, 0.07];
const PROCESS_EDGE_MAT = new THREE.LineBasicMaterial({color: 0x2a2a2a, transparent: false});

/** Lighter grey for tiles belonging to the active stage. */
const STAGE_TOP_RGB: [number, number, number] = [0.32, 0.32, 0.34];
const STAGE_SIDE_RGB: [number, number, number] = [0.28, 0.28, 0.30];

interface Props {
    map: SessionState;
    onTileClick: (q: number, r: number) => void;
    fpsRef?: React.RefObject<HTMLDivElement | null>;
    brushMode?: boolean;
    crosshairCursor?: boolean;
    /** Called once after the first Three.js frame with scene content. */
    onFirstRender?: () => void;
    /**
     * All connection IDs that belong to the active process (used for dimming/hiding).
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
                                    onFirstRender,
                                    highlightConnectionIds,
                                    activeStageConnectionIds,
                                    landmarkHighlightColors,
                                    stageHighlightTiles,
                                    metricOverlayEntries,
                                    onConnectionClick,
                                    patchTileRef,
                                    processStageConnections,
                                    hideDecorations = false,
                                    rendererQualityProfile,
                                }: Props) {
    const mountRef = useRef<HTMLDivElement>(null);

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
    const threeRef = useThreeScene({mountRef, fpsRef, onNativePointerMove: stableNativeMove.current, qualityProfile: rendererQualityProfile, onSceneReady: onFirstRender});

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
            const groupColor = landmark.groupId ? (map.groups ?? {})[landmark.groupId]?.color : undefined;
            const tintColor = groupColor ? parseInt(groupColor.replace('#', ''), 16) : 0xeeeeee;

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
            const landmarkGroup = renderer.build(landmark, elevation, new THREE.Color(tintColor), adjacent, lmWorstLevel);
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
            const mesh = new THREE.Mesh(SELECTION_GEO, SELECTION_MAT);
            // Centre the tall column so its bottom sits at the tile surface
            mesh.position.set(x, top + SELECTION_COL_HEIGHT / 2, z);
            scene.add(mesh);
            selectionMeshRef.current = mesh;
        }

        requestRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTile, map.map.tiles]);

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

        const tiles = map.map?.tiles ?? [];
        Object.values(map.connections ?? {}).forEach((conn) => {
            const obj = hideDecorations
                ? buildSimpleConnectionLine(conn, tiles)
                : buildConnectionGroup(conn, tiles);
            if (!obj) return;
            scene.add(obj);
            connectionMeshMapRef.current.set(conn.id, obj);
        });

        requestRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map.connections, map.map.tiles, hideDecorations]);

    // ── Connection highlight / dim / hide in process mode ────────────────────────────────
    useEffect(() => {
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
        requestRender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightConnectionIds, activeStageConnectionIds]);

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

    // ── Highlighted tile ring mesh (process mode) ─────────────────────────────────
    // For each landmark tile: build a flat annular hex ring (6 quads) that sits
    // on the top surface, using the landmark's group colour.
    // Rings are batched per unique colour → one Mesh per colour group.
    useEffect(() => {
        const scene = threeRef.current?.scene;
        if (!scene) return;

        // Remove previous ring
        disposeHighlightRings(scene);

        if (!landmarkHighlightColors || landmarkHighlightColors.size === 0) {
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
        if (!renderer) return;

        const tiles = map.map?.tiles ?? [];

        if (!processStageConnections || processStageConnections.length === 0) {
            renderer.update([], tiles);
        } else {
            renderer.update(processStageConnections, tiles);
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

    return (
        <div
            ref={mountRef}
            className="w-full h-full block"
            style={{cursor: (brushMode || crosshairCursor) ? 'crosshair' : 'default'}}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onClick={handleClick}
        />
    );
}
