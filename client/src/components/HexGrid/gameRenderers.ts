import * as THREE from 'three';

/** Slight vertical clearance above tile top surface to prevent z-fighting and floor clipping. */
export const BUG_CLEARANCE = 0.05;

/**
 * Calculates world-space position during bug movement across tiles.
 *
 * For horizontal movement (X, Z), positions are interpolated with smooth easing.
 * For vertical movement (Y), when moving between tiles of differing elevations,
 * a piecewise step transition is applied near the hex boundary (between 40% and 60% of progress)
 * so the bug stays on the surface plane of each tile rather than sinking below tile surfaces
 * or clipping through cliff walls.
 */
export function interpolateBugPosition(
  from: THREE.Vector3,
  to: THREE.Vector3,
  eased: number,
  target: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3 {
  const x = THREE.MathUtils.lerp(from.x, to.x, eased);
  const z = THREE.MathUtils.lerp(from.z, to.z, eased);

  let y: number;
  if (Math.abs(from.y - to.y) < 1e-4) {
    y = to.y;
  } else {
    const yProg = Math.max(0, Math.min(1, (eased - 0.4) / 0.2));
    const yEased = yProg * yProg * (3 - 2 * yProg);
    y = THREE.MathUtils.lerp(from.y, to.y, yEased);
  }
  return target.set(x, y, z);
}

const BUG_BODY = new THREE.MeshStandardMaterial({
  color: 0x5c1010,
  emissive: 0x2a0000,
  emissiveIntensity: 0.9,
  roughness: 0.55,
  metalness: 0.15,
  flatShading: true,
});

const BUG_LEG = new THREE.MeshStandardMaterial({
  color: 0x240404,
  roughness: 0.85,
  metalness: 0.05,
  flatShading: true,
});

const BUG_EYE = new THREE.MeshStandardMaterial({
  color: 0xff3b3b,
  emissive: 0xff0000,
  emissiveIntensity: 2.2,
  roughness: 0.25,
});

const PROJECTILE_MAT = new THREE.MeshStandardMaterial({
  color: 0xffd27a,
  emissive: 0xff9a00,
  emissiveIntensity: 2.5,
  roughness: 0.2,
});

/** Low-poly bug NPC. Rebuilt per tick; the bug count is intentionally small. */
export function buildBugMesh(): THREE.Group {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), BUG_BODY);
  body.scale.set(1, 0.62, 1.45);
  body.position.y = 0.2;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), BUG_BODY);
  head.position.set(0, 0.2, 0.31);
  group.add(head);

  const eyeGeo = new THREE.SphereGeometry(0.035, 6, 4);
  const leftEye = new THREE.Mesh(eyeGeo, BUG_EYE);
  leftEye.position.set(-0.055, 0.25, 0.39);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, BUG_EYE);
  rightEye.position.set(0.055, 0.25, 0.39);
  group.add(rightEye);

  const legGeo = new THREE.CylinderGeometry(0.018, 0.012, 0.34, 4);
  for (let i = 0; i < 3; i++) {
    const z = 0.16 - i * 0.16;
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, BUG_LEG);
      leg.position.set(side * 0.2, 0.13, z);
      leg.rotation.z = side * Math.PI / 3;
      leg.rotation.x = 0.25;
      group.add(leg);
    }
  }

  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      (child as THREE.Mesh).castShadow = false;
      (child as THREE.Mesh).receiveShadow = false;
    }
  });

  return group;
}

/** Cosmetic ballistic projectile; the server resolves the actual hit. */
export function buildProjectile(): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), PROJECTILE_MAT);
  mesh.renderOrder = 25;
  return mesh;
}

export function disposeGameObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      // Materials are shared module-level instances; only per-object geometry is owned.
      mesh.geometry?.dispose();
    }
  });
}
