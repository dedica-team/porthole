import * as THREE from 'three';
import type { HexTile } from '@/types/hex';
import { hexToWorld } from '@/utils/hexUtils.ts';
import { tileHeight, seed, lcgNext, LineBatcher, ICE_TILE_COLORS, type TileColors, type TerrainRenderer } from '../terrainUtils';
import { buildIcyShimmer } from './SnowyRenderer';

const ICE_SPIKE_GEO = new THREE.ConeGeometry(0.05, 1, 5);

const ICE_SPIKE_MAT = new THREE.MeshStandardMaterial({
  color:          0xb8dff0,
  emissive:       new THREE.Color(0x5599cc).multiplyScalar(0.18),
  roughness:      0.25,
  metalness:      0.15,
  transparent:    true,
  opacity:        0.82,
  depthWrite:     true,
  side:           THREE.FrontSide,
  polygonOffset:  true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits:  -2,
});

const ICE_SPIKE_EDGE_MAT = new THREE.LineBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.55 });

// Pre-computed edge pairs for the unit spike geometry — avoids clone()+EdgesGeometry per spike
const SPIKE_EDGE_PAIRS: Float32Array = (() => {
  const eg  = new THREE.EdgesGeometry(ICE_SPIKE_GEO);
  const buf = (eg.attributes.position as THREE.BufferAttribute).array as Float32Array;
  const out = new Float32Array(buf.length);
  out.set(buf);
  eg.dispose();
  return out;
})();
const SPIKE_EDGE_STRIDE = 6;
const SPIKE_EDGE_COUNT  = SPIKE_EDGE_PAIRS.length / SPIKE_EDGE_STRIDE;

// Max spikes per tile: 3 bunches × 8 spikes
const MAX_SPIKES_PER_TILE = 3 * 8;

export class IceRenderer implements TerrainRenderer {
  private spikeInst: THREE.InstancedMesh | null = null;
  private spikeSlot = 0;
  private edgeBatcher: LineBatcher | null = null;
  private shimmerTiles: HexTile[] = [];

  tileColors(): TileColors { return ICE_TILE_COLORS; }

  init(scene: THREE.Scene, maxTiles: number): THREE.Object3D[] {
    this.spikeSlot = 0;
    this.spikeInst = new THREE.InstancedMesh(ICE_SPIKE_GEO, ICE_SPIKE_MAT, maxTiles * MAX_SPIKES_PER_TILE);
    this.spikeInst.count = 0;
    scene.add(this.spikeInst);
    this.edgeBatcher  = new LineBatcher(ICE_SPIKE_EDGE_MAT);
    this.shimmerTiles = [];
    return [this.spikeInst];
  }

  build(tile: HexTile, _scene: THREE.Scene, _adjacentTiles: HexTile[]): THREE.Object3D[] {
    const inst = this.spikeInst;
    if (!inst) return [];

    const SPIKES_PER_BUNCH_MIN = 5;
    const SPIKES_PER_BUNCH_MAX = 8;
    const R       = 0.72;
    const sqrt3_2 = Math.sqrt(3) / 2;

    const dummy   = new THREE.Object3D();
    const edgeVerts: number[] = [];
    const _va     = new THREE.Vector3();
    const _vb     = new THREE.Vector3();

    const { q, r } = tile.coordinate;
    const { x, z } = hexToWorld(q, r, 1);
    const top = tileHeight(tile.elevation);
    let rng = seed(tile, 79, 53, 19);

    let v: number;
    [rng, v] = lcgNext(rng);
    const bunches = 1 + Math.floor(v * 3);

    for (let b = 0; b < bunches; b++) {
      let bx: number, bz: number;
      let attempts = 0;
      do {
        [rng, bx] = lcgNext(rng); bx = (bx * 2 - 1) * R;
        [rng, bz] = lcgNext(rng); bz = (bz * 2 - 1) * R;
        attempts++;
      } while (attempts < 20 && (Math.abs(bx) > R || 0.5 * Math.abs(bx) + sqrt3_2 * Math.abs(bz) > sqrt3_2 * R));

      [rng, v] = lcgNext(rng);
      const spikeCount = SPIKES_PER_BUNCH_MIN + Math.floor(v * (SPIKES_PER_BUNCH_MAX - SPIKES_PER_BUNCH_MIN + 1));

      for (let i = 0; i < spikeCount; i++) {
        let sh: number, soff_x: number, soff_z: number, stilt: number;
        [rng, sh]     = lcgNext(rng);
        [rng, soff_x] = lcgNext(rng);
        [rng, soff_z] = lcgNext(rng);
        [rng, stilt]  = lcgNext(rng);

        const h       = 0.24 + sh * 0.28;
        const ox      = bx + (soff_x * 2 - 1) * 0.06;
        const oz      = bz + (soff_z * 2 - 1) * 0.06;
        const azimuth = (i / spikeCount) * Math.PI * 2;
        const tilt    = 0.15 + stilt * 0.35;

        dummy.position.set(
          x + ox + Math.sin(tilt) * Math.sin(azimuth) * h * 0.3,
          top + Math.cos(tilt) * h * 0.5,
          z + oz + Math.sin(tilt) * Math.cos(azimuth) * h * 0.3,
        );
        dummy.scale.set(1, h, 1);
        dummy.rotation.set(tilt, azimuth, 0, 'YXZ');
        dummy.updateMatrix();
        inst.setMatrixAt(this.spikeSlot++, dummy.matrix);

        const m = dummy.matrix;
        for (let e = 0; e < SPIKE_EDGE_COUNT; e++) {
          const base = e * SPIKE_EDGE_STRIDE;
          _va.set(SPIKE_EDGE_PAIRS[base],     SPIKE_EDGE_PAIRS[base + 1], SPIKE_EDGE_PAIRS[base + 2]);
          _vb.set(SPIKE_EDGE_PAIRS[base + 3], SPIKE_EDGE_PAIRS[base + 4], SPIKE_EDGE_PAIRS[base + 5]);
          _va.applyMatrix4(m); _vb.applyMatrix4(m);
          edgeVerts.push(_va.x, _va.y, _va.z, _vb.x, _vb.y, _vb.z);
        }
      }
    }
    inst.count = this.spikeSlot;
    inst.instanceMatrix.needsUpdate = true;

    this.edgeBatcher?.addSegments(edgeVerts);
    this.shimmerTiles.push(tile);
    return [];
  }

  flush(scene: THREE.Scene): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];
    const edgesLS = this.edgeBatcher?.flush(scene);
    if (edgesLS) objects.push(edgesLS);
    if (this.shimmerTiles.length) {
      const shimmer = buildIcyShimmer(this.shimmerTiles, scene, [50, 26], [79, 53, 19]);
      if (shimmer) objects.push(shimmer);
    }
    this.edgeBatcher  = null;
    this.shimmerTiles = [];
    return objects;
  }
}

