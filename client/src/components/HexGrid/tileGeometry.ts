/**
 * tileGeometry.ts
 * Pre-computed Three.js geometry templates and builder function for hex tiles.
 * All constants here are 3-D modelling concerns; hex-grid math lives elsewhere.
 */
import * as THREE from 'three';
import { tileHeight } from './terrainUtils';
import { EDGE_COLOR, EDGE_COLOR_DARK } from './terrainUtils';

const HEX_SIZE     = 1;
const HEX_SEGMENTS = 6;

// ── Shared cylinder template ──────────────────────────────────────────────────
export const TEMPLATE_GEO = new THREE.CylinderGeometry(
    HEX_SIZE * 0.95, HEX_SIZE * 0.95, 1, HEX_SEGMENTS,
);
TEMPLATE_GEO.rotateY(Math.PI / 6);

// ── Pre-extract group index slices from the shared template once ──────────────
// CylinderGeometry groups: [0]=side, [1]=top, [2]=bottom  (Three.js r150+)
const _tmplIdx = TEMPLATE_GEO.index!;
const _tmplPos = TEMPLATE_GEO.attributes.position as THREE.BufferAttribute;
const _tmplNor = TEMPLATE_GEO.attributes.normal   as THREE.BufferAttribute;

function extractGroupFast(groupIndex: number): {
    positions: Float32Array;
    normals:   Float32Array;
    indices:   number[];
} {
    const grp = TEMPLATE_GEO.groups[groupIndex];
    const remap    = new Map<number, number>();
    const positions: number[] = [];
    const normals:   number[] = [];
    const indices:   number[] = [];

    for (let i = grp.start; i < grp.start + grp.count; i++) {
        const vi = _tmplIdx.getX(i);
        let ni = remap.get(vi);
        if (ni === undefined) {
            ni = positions.length / 3;
            remap.set(vi, ni);
            positions.push(_tmplPos.getX(vi), _tmplPos.getY(vi), _tmplPos.getZ(vi));
            normals  .push(_tmplNor.getX(vi), _tmplNor.getY(vi), _tmplNor.getZ(vi));
        }
        indices.push(ni);
    }
    return {
        positions: new Float32Array(positions),
        normals:   new Float32Array(normals),
        indices,
    };
}

const TMPL_TOP  = extractGroupFast(1);
const TMPL_SIDE = extractGroupFast(0);

/** Number of vertices in the top face of one tile (constant for all tiles). */
export const TMPL_TOP_VERT_COUNT  = TMPL_TOP.positions.length  / 3;
/** Number of vertices in the side face of one tile (constant for all tiles). */
export const TMPL_SIDE_VERT_COUNT = TMPL_SIDE.positions.length / 3;

// Pre-computed flat edge-vertex lists, split into horizontal (top/bottom rings)
// and vertical (pillar) edges of the unit hex-cylinder.
// Each entry is a flat Float32 sequence of [x0,y0,z0, x1,y1,z1, ...] pairs.
const { TMPL_EDGE_H, TMPL_EDGE_V } = (() => {
    const eg  = new THREE.EdgesGeometry(TEMPLATE_GEO);
    const pos = (eg.attributes.position as THREE.BufferAttribute).array;
    eg.dispose();
    const horiz: number[] = [];
    const vert:  number[] = [];
    // Segments come in pairs of 3 floats each (6 floats per segment).
    for (let i = 0; i < pos.length; i += 6) {
        const dy = Math.abs(pos[i + 1] - pos[i + 4]);
        if (dy > 0.1) {
            // Vertical (pillar) edge
            vert.push(pos[i], pos[i+1], pos[i+2], pos[i+3], pos[i+4], pos[i+5]);
        } else {
            // Horizontal ring edge – skip the bottom ring (y < 0), it is buried
            if (pos[i + 1] > 0) {
                horiz.push(pos[i], pos[i+1], pos[i+2], pos[i+3], pos[i+4], pos[i+5]);
            }
        }
    }
    return { TMPL_EDGE_H: new Float32Array(horiz), TMPL_EDGE_V: new Float32Array(vert) };
})();

// ── buildTileGeo ──────────────────────────────────────────────────────────────
/** Build top-face, side-face and edge geometries for a single hex tile,
 *  placed at world position (x, z) and scaled to the tile's elevation.
 *  Optional r/g/b vertex colour is baked into every vertex so the whole map
 *  can share a single material. */
export function buildTileGeo(elevation: number, x: number, z: number,
    topRGB?: [number, number, number],
    sideRGB?: [number, number, number],
) {
    const h  = tileHeight(elevation);
    const sy = h;
    const ty = h / 2;

    // ── Top face ──────────────────────────────────────────────────────────────
    const topCount = TMPL_TOP.positions.length / 3;
    const topPos   = new Float32Array(topCount * 3);
    const topNor   = new Float32Array(topCount * 3);
    const topCol   = topRGB ? new Float32Array(topCount * 3) : null;
    for (let i = 0; i < topCount; i++) {
        topPos[i * 3]     = TMPL_TOP.positions[i * 3]     + x;
        topPos[i * 3 + 1] = TMPL_TOP.positions[i * 3 + 1] * sy + ty;
        topPos[i * 3 + 2] = TMPL_TOP.positions[i * 3 + 2] + z;
        topNor[i * 3]     = TMPL_TOP.normals[i * 3];
        topNor[i * 3 + 1] = TMPL_TOP.normals[i * 3 + 1];
        topNor[i * 3 + 2] = TMPL_TOP.normals[i * 3 + 2];
        if (topCol && topRGB) {
            topCol[i * 3] = topRGB[0]; topCol[i * 3 + 1] = topRGB[1]; topCol[i * 3 + 2] = topRGB[2];
        }
    }
    const topGeo = new THREE.BufferGeometry();
    topGeo.setAttribute('position', new THREE.Float32BufferAttribute(topPos, 3));
    topGeo.setAttribute('normal',   new THREE.Float32BufferAttribute(topNor, 3));
    if (topCol) topGeo.setAttribute('color', new THREE.Float32BufferAttribute(topCol, 3));
    topGeo.setIndex(TMPL_TOP.indices);

    // ── Side face ─────────────────────────────────────────────────────────────
    const sideCount = TMPL_SIDE.positions.length / 3;
    const sidePos   = new Float32Array(sideCount * 3);
    const sideNor   = new Float32Array(sideCount * 3);
    const sideCol   = sideRGB ? new Float32Array(sideCount * 3) : null;
    for (let i = 0; i < sideCount; i++) {
        sidePos[i * 3]     = TMPL_SIDE.positions[i * 3]     + x;
        sidePos[i * 3 + 1] = TMPL_SIDE.positions[i * 3 + 1] * sy + ty;
        sidePos[i * 3 + 2] = TMPL_SIDE.positions[i * 3 + 2] + z;
        sideNor[i * 3]     = TMPL_SIDE.normals[i * 3];
        sideNor[i * 3 + 1] = TMPL_SIDE.normals[i * 3 + 1];
        sideNor[i * 3 + 2] = TMPL_SIDE.normals[i * 3 + 2];
        if (sideCol && sideRGB) {
            sideCol[i * 3] = sideRGB[0]; sideCol[i * 3 + 1] = sideRGB[1]; sideCol[i * 3 + 2] = sideRGB[2];
        }
    }
    const sideGeo = new THREE.BufferGeometry();
    sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(sidePos, 3));
    sideGeo.setAttribute('normal',   new THREE.Float32BufferAttribute(sideNor, 3));
    if (sideCol) sideGeo.setAttribute('color', new THREE.Float32BufferAttribute(sideCol, 3));
    sideGeo.setIndex(TMPL_SIDE.indices);

    // ── Edge lines ────────────────────────────────────────────────────────────
    const buildEdgeGeo = (tmpl: Float32Array): THREE.BufferGeometry => {
        const count = tmpl.length / 3;
        const ePos  = new Float32Array(tmpl.length);
        for (let i = 0; i < count; i++) {
            ePos[i * 3]     = tmpl[i * 3]     + x;
            ePos[i * 3 + 1] = tmpl[i * 3 + 1] * sy + ty;
            ePos[i * 3 + 2] = tmpl[i * 3 + 2] + z;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(ePos, 3));
        return g;
    };
    const edgeGeoH = buildEdgeGeo(TMPL_EDGE_H);
    const edgeGeoV = buildEdgeGeo(TMPL_EDGE_V);

    return { topGeo, sideGeo, edgeGeoH, edgeGeoV };
}

// ── Shared single-material for the merged tile mesh (vertex colours) ──────────
export const TILE_TOP_MAT = new THREE.MeshStandardMaterial({
    vertexColors:  true,
    roughness:     1.0,
    metalness:     0.0,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});

export const TILE_SIDE_MAT = new THREE.MeshStandardMaterial({
    vertexColors:  true,
    roughness:     1.0,
    metalness:     0.0,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});

// ── Tile edge line materials ───────────────────────────────────────────────────
export const EDGE_MAT      = new THREE.LineBasicMaterial({ color: EDGE_COLOR,      transparent: false });
/** Darker vertical-edge colour for land tiles (pillar edges, not top/bottom rings). */
export const EDGE_MAT_VERT = new THREE.LineBasicMaterial({ color: 0x111111,        transparent: false });
export const EDGE_MAT_DARK = new THREE.LineBasicMaterial({ color: EDGE_COLOR_DARK, transparent: false });

// ── Selection column ──────────────────────────────────────────────────────────
/** Height of the infinite-column highlight placed over the selected tile. */
export const SELECTION_COL_HEIGHT = 500;

export const SELECTION_GEO = (() => {
    const geo = new THREE.CylinderGeometry(
        HEX_SIZE * 0.95, HEX_SIZE * 0.95, SELECTION_COL_HEIGHT, HEX_SEGMENTS,
    );
    geo.rotateY(Math.PI / 6);
    return geo;
})();

export const SELECTION_MAT = new THREE.MeshBasicMaterial({
    color:      0x00f0ff,
    transparent: true,
    opacity:     0.18,
    depthWrite:  false,
});

