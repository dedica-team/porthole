import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  BUG_CLEARANCE,
  buildBugMesh,
  buildProjectile,
  disposeGameObject,
  interpolateBugPosition,
} from '../components/HexGrid/gameRenderers';

describe('gameRenderers', () => {
  describe('BUG_CLEARANCE', () => {
    it('provides a positive clearance above tile surface to prevent clipping', () => {
      expect(BUG_CLEARANCE).toBeGreaterThan(0);
      expect(BUG_CLEARANCE).toBeLessThanOrEqual(0.1);
    });
  });

  describe('buildBugMesh and buildProjectile', () => {
    it('creates bug mesh group with body parts', () => {
      const bug = buildBugMesh();
      expect(bug).toBeInstanceOf(THREE.Group);
      expect(bug.children.length).toBeGreaterThan(0);

      disposeGameObject(bug);
    });

    it('creates projectile mesh', () => {
      const projectile = buildProjectile();
      expect(projectile).toBeInstanceOf(THREE.Mesh);
      expect(projectile.renderOrder).toBe(25);

      disposeGameObject(projectile);
    });
  });

  describe('interpolateBugPosition', () => {
    it('maintains constant elevation when moving on flat ground', () => {
      const from = new THREE.Vector3(0, 0.45 + BUG_CLEARANCE, 0);
      const to = new THREE.Vector3(1.5, 0.45 + BUG_CLEARANCE, 0.86);

      const atStart = interpolateBugPosition(from, to, 0);
      expect(atStart.x).toBeCloseTo(0);
      expect(atStart.y).toBeCloseTo(0.45 + BUG_CLEARANCE);
      expect(atStart.z).toBeCloseTo(0);

      const atMid = interpolateBugPosition(from, to, 0.5);
      expect(atMid.x).toBeCloseTo(0.75);
      expect(atMid.y).toBeCloseTo(0.45 + BUG_CLEARANCE);
      expect(atMid.z).toBeCloseTo(0.43);

      const atEnd = interpolateBugPosition(from, to, 1);
      expect(atEnd.x).toBeCloseTo(1.5);
      expect(atEnd.y).toBeCloseTo(0.45 + BUG_CLEARANCE);
      expect(atEnd.z).toBeCloseTo(0.86);
    });

    it('performs piecewise height step transition when ascending across differing elevations', () => {
      const yFrom = 0.2 + BUG_CLEARANCE; // elevation 0
      const yTo = 0.7 + BUG_CLEARANCE;   // elevation 2
      const from = new THREE.Vector3(0, yFrom, 0);
      const to = new THREE.Vector3(2, yTo, 0);

      // On source tile before crossing boundary (eased <= 0.4)
      const at02 = interpolateBugPosition(from, to, 0.2);
      expect(at02.y).toBeCloseTo(yFrom);

      const at04 = interpolateBugPosition(from, to, 0.4);
      expect(at04.y).toBeCloseTo(yFrom);

      // At hex boundary crossing (eased = 0.5)
      const at05 = interpolateBugPosition(from, to, 0.5);
      expect(at05.y).toBeCloseTo((yFrom + yTo) / 2);

      // On target tile after crossing boundary (eased >= 0.6)
      const at06 = interpolateBugPosition(from, to, 0.6);
      expect(at06.y).toBeCloseTo(yTo);

      const at08 = interpolateBugPosition(from, to, 0.8);
      expect(at08.y).toBeCloseTo(yTo);

      const at10 = interpolateBugPosition(from, to, 1.0);
      expect(at10.y).toBeCloseTo(yTo);
    });

    it('performs piecewise height step transition when descending across differing elevations', () => {
      const yFrom = 0.95 + BUG_CLEARANCE; // elevation 3
      const yTo = 0.45 + BUG_CLEARANCE;   // elevation 1
      const from = new THREE.Vector3(0, yFrom, 0);
      const to = new THREE.Vector3(2, yTo, 0);

      // On source tile before crossing boundary (eased <= 0.4)
      const at02 = interpolateBugPosition(from, to, 0.2);
      expect(at02.y).toBeCloseTo(yFrom);

      const at04 = interpolateBugPosition(from, to, 0.4);
      expect(at04.y).toBeCloseTo(yFrom);

      // At hex boundary crossing (eased = 0.5)
      const at05 = interpolateBugPosition(from, to, 0.5);
      expect(at05.y).toBeCloseTo((yFrom + yTo) / 2);

      // On target tile after crossing boundary (eased >= 0.6)
      const at06 = interpolateBugPosition(from, to, 0.6);
      expect(at06.y).toBeCloseTo(yTo);

      const at10 = interpolateBugPosition(from, to, 1.0);
      expect(at10.y).toBeCloseTo(yTo);
    });
  });
});
