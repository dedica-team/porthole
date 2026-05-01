import * as THREE from 'three';
import type { Landmark } from '@/types/landmark';
import type { QualityLevel } from '@/types/landmark';
import {TRON_CYAN} from '../terrainUtils';
import {
    tintGrey, mesh, edges, glowMat, statusLight,
    tileHeight,
    type LandmarkRenderer, type Adjacent, LANDMARK_SURFACE_GREY,
} from './landmarkUtils';

// ── Laser barrier shader (WallRenderer-private) ───────────────────────────────
const LASER_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const LASER_FRAG = /* glsl */`
  uniform float uTime;
  uniform vec3  uColor;
  varying vec2  vUv;
  void main() {
    float scan  = fract(vUv.y * 3.0 - uTime * 0.35);
    float band  = smoothstep(0.55, 0.60, scan) * (1.0 - smoothstep(0.60, 0.75, scan));
    float edge  = smoothstep(0.45, 0.0, abs(vUv.y - 0.5));
    float side  = smoothstep(0.45, 0.0, abs(vUv.x - 0.5));
    float glow  = max(edge, side);
    float alpha = clamp(band * 0.5 + glow * 0.4 + 0.06, 0.0, 1.0);
    gl_FragColor = vec4(uColor * (band * 1.1 + glow * 0.7 + 0.12), alpha);
  }
`;

const laserUniforms = {
  uTime:  { value: 0.0 },
  uColor: { value: new THREE.Color(TRON_CYAN) },
};

const LASER_MAT = new THREE.ShaderMaterial({
  uniforms:       laserUniforms,
  vertexShader:   LASER_VERT,
  fragmentShader: LASER_FRAG,
  transparent:    true,
  blending:       THREE.AdditiveBlending,
  depthWrite:     false,
  side:           THREE.DoubleSide,
});

LASER_MAT.onBeforeRender = () => {
  laserUniforms.uTime.value = performance.now() / 1000;
};

const RAIL_MAT = new THREE.MeshLambertMaterial({
    color: TRON_CYAN,
    emissive: new THREE.Color(TRON_CYAN).multiplyScalar(0.45),
    transparent: true,
    opacity: 0.60,
});

const uvs = new Float32Array([
    0, 0, 0, 0, 0, 1, 0, 1,
    1, 0, 1, 0, 1, 1, 1, 1,
]);
const idx = [
    0, 1, 2, 0, 2, 3,   // near face
    4, 6, 5, 4, 7, 6,   // far  face
    3, 2, 6, 3, 6, 7,   // top
    0, 5, 1, 0, 4, 5,   // bottom
    0, 3, 7, 0, 7, 4,   // left
    1, 5, 6, 1, 6, 2,   // right
];

export class WallRenderer implements LandmarkRenderer {

    readonly requiresAdjacent = true;
    readonly color = 0xa09080;

    build(_landmark: Landmark, elevation: number, tintColor: THREE.Color, adjacent?: Adjacent[], worstLevel?: QualityLevel): THREE.Group {
        const g = new THREE.Group();

        const pillar = mesh(new THREE.BoxGeometry(0.28, 0.60, 0.28), LANDMARK_SURFACE_GREY);
        pillar.position.y = 0.30;
        const pillarEdge = edges(pillar);
        pillarEdge.position.y = 0.30;
        g.add(pillar, pillarEdge);

        const pillarTint = tintGrey(tintColor.getHex(), 0.70);
        const cap = mesh(new THREE.BoxGeometry(0.34, 0.10, 0.34), pillarTint);
        cap.position.y = 0.65;
        const capEdge = edges(cap);
        capEdge.position.y = 0.65;
        // Glow overlay: same geometry, additive Fresnel shader in tint colour
        const capGeo  = new THREE.BoxGeometry(0.34, 0.10, 0.34);
        const capGlow = new THREE.Mesh(capGeo, glowMat(tintColor, 1.2));
        capGlow.position.y = 0.65;
        g.add(cap, capEdge, capGlow);

        const RAIL_COUNT = 3;
        const RAIL_Y_BASE = [0.10, 0.28, 0.46];
        const RAIL_DEPTH = 0.004;
        const RAIL_THICK = 0.018;

        for (const {dir, landmark, hexTile} of (adjacent ?? [])) {

            if(landmark?.type !== 'WALL') continue;

            const len = (dir as unknown as { _len?: number })._len ?? 1.5;
            const ownH = tileHeight(elevation);
            const nbrH = tileHeight(hexTile?.elevation ?? elevation);
            const dyEnd = nbrH - ownH;
            const angle = Math.atan2(dir.x, dir.y);

            const segGroup = new THREE.Group();
            segGroup.rotation.y = angle;
            g.add(segGroup);

            for (let r = 0; r < RAIL_COUNT; r++) {
                const yNear = RAIL_Y_BASE[r];
                const yFar = yNear + dyEnd;
                const hd = RAIL_DEPTH / 2;

                // 8-vertex parallelogram slab matching the original layout.
                // Vertex 0 = near bottom-left, vertex 4 = far bottom-left (tests rely on this).
                const verts = new Float32Array([
                    // near face (z = 0)
                    -hd, yNear, 0,   // 0 near bottom-left
                    hd, yNear, 0,   // 1 near bottom-right
                    hd, yNear + RAIL_THICK, 0,   // 2 near top-right
                    -hd, yNear + RAIL_THICK, 0,   // 3 near top-left
                    // far face (z = len)
                    -hd, yFar, len, // 4 far bottom-left
                    hd, yFar, len, // 5 far bottom-right
                    hd, yFar + RAIL_THICK, len, // 6 far top-right
                    -hd, yFar + RAIL_THICK, len, // 7 far top-left
                ]);

                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
                geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                geo.setIndex(idx);
                geo.computeVertexNormals();

                // Lambert mesh satisfies tests (material type / colour / opacity checks)
                segGroup.add(new THREE.Mesh(geo, RAIL_MAT));
                // Laser glow overlay as sibling mesh — same geometry, additive shader
                segGroup.add(new THREE.Mesh(geo, LASER_MAT));
            }
        }


        if (worstLevel && worstLevel !== 'NONE') g.add(statusLight(worstLevel));
        return g;
    }
}
