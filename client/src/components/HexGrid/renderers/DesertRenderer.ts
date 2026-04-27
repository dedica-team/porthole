import * as THREE from 'three';
import type {HexTile} from '@/types/map.ts';
import {hexToWorld} from '@/utils/hexUtils.ts';
import {
    tileHeight,
    seed,
    RockBatcher,
    LineBatcher,
    TRON_CYAN_DIM,
    DEFAULT_TILE_COLORS,
    type TileColors,
    type TerrainRenderer
} from '../terrainUtils';


export class DesertRenderer implements TerrainRenderer {
    private lineBatcher: LineBatcher | null = null;
    private rockBatcher: RockBatcher | null = null;

    tileColors(): TileColors { return DEFAULT_TILE_COLORS; }

    init(_scene: THREE.Scene, _maxTiles: number): THREE.Object3D[] {
        this.lineBatcher = new LineBatcher(new THREE.LineBasicMaterial({ color: TRON_CYAN_DIM }));
        this.rockBatcher = new RockBatcher({ radius: 0.06, minCount: 0, countSpread: 3, heightScale: 0.35 });
        return [];
    }

    build(tile: HexTile, _scene: THREE.Scene, _adjacentTiles: HexTile[]): THREE.Object3D[] {
        const verts: number[] = [];
        const {q, r} = tile.coordinate;
        const {x, z} = hexToWorld(q, r, 1);
        const top = tileHeight(tile.elevation);
        const s = seed(tile, 61, 37, 13);
        const count = 1 + (s % 5); // 1–5 cactuses

        for (let i = 0; i < count; i++) {
            const angle = ((s * (i + 1) * 97) % 360) * (Math.PI / 180);
            const cx = x + Math.cos(angle) * ((s * (i + 3) * 53) % 60) / 100;
            const cz = z + Math.sin(angle) * ((s * (i + 3) * 53) % 60) / 100;
            const h = 0.18 + ((s * (i + 5) * 41) % 20) / 100;
            const scale = 0.7 + ((s * (i + 13) * 67) % 60) / 100;
            const sh = h * scale;
            const sArm = scale;

            // trunk
            verts.push(cx, top, cz, cx, top + sh, cz);

            // two arms
            for (let a = 0; a < 2; a++) {
                const sign = a === 0 ? 1 : -1;
                const armY = top + sh * (0.45 + a * 0.15);
                const armLen = (0.07 + ((s * (i + a + 7) * 29) % 6) / 100) * sArm;
                const midX = cx + sign * armLen;
                verts.push(cx, armY, cz,
                    midX, armY, cz,
                    midX, armY, cz,
                    midX, armY + armLen, cz);
            }
        }

        this.lineBatcher?.addSegments(verts);

        // ~50% of desert tiles get a few small rocks
        if ((seed(tile, 17, 43, 91) % 2) === 0) {
            this.rockBatcher?.addTile(tile);
        }
        return [];
    }

    flush(scene: THREE.Scene): THREE.Object3D[] {
        const objects: THREE.Object3D[] = [];
        const ls = this.lineBatcher?.flush(scene);
        if (ls) objects.push(ls);
        const rocks = this.rockBatcher?.flush(scene);
        if (rocks) objects.push(rocks.columns, rocks.edges);
        this.lineBatcher = null;
        this.rockBatcher = null;
        return objects;
    }
}
