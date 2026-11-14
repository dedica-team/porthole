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

const EXPLOSION_CORE_MAT = new THREE.MeshStandardMaterial({
  color: 0xff8800,
  emissive: 0xff4400,
  emissiveIntensity: 3.0,
  roughness: 0.2,
  flatShading: true,
});

const EXPLOSION_SPARK_MAT = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  emissive: 0xff9900,
  emissiveIntensity: 2.5,
  roughness: 0.15,
  flatShading: true,
});

export const EXPLOSION_LIFETIME_MS = 450;

export interface ExplosionParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
}

export interface ExplosionInstance {
  group: THREE.Group;
  bornAt: number;
  particles: ExplosionParticle[];
  coreMesh: THREE.Mesh;
}

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

/** Small explosion effect spawned where a shot hits a bug, building, or ground. */
export function buildExplosion(): { group: THREE.Group; particles: ExplosionParticle[]; coreMesh: THREE.Mesh } {
  const group = new THREE.Group();

  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), EXPLOSION_CORE_MAT);
  group.add(coreMesh);

  const particles: ExplosionParticle[] = [];
  const sparkGeo = new THREE.DodecahedronGeometry(0.04, 0);

  const count = 8;
  for (let i = 0; i < count; i++) {
    const spark = new THREE.Mesh(sparkGeo, EXPLOSION_SPARK_MAT);
    const theta = (i / count) * Math.PI * 2 + (Math.sin(i * 3.7) * 0.4);
    const phi = Math.sin(i * 1.9) * Math.PI * 0.35;
    const speed = 1.2 + ((i * 17) % 10) / 10 * 1.5;
    const vx = Math.cos(theta) * Math.cos(phi) * speed;
    const vy = Math.abs(Math.sin(phi)) * speed + 0.6;
    const vz = Math.sin(theta) * Math.cos(phi) * speed;

    group.add(spark);
    particles.push({
      mesh: spark,
      velocity: new THREE.Vector3(vx, vy, vz),
    });
  }

  return { group, particles, coreMesh };
}

/**
 * Updates an explosion instance over time. Returns false when the explosion has expired.
 */
export function updateExplosion(
  instance: ExplosionInstance,
  now: number,
  dt: number,
): boolean {
  const age = now - instance.bornAt;
  const progress = Math.min(1, age / EXPLOSION_LIFETIME_MS);
  if (progress >= 1) return false;

  // Flash core expands quickly and then shrinks/dissipates
  const coreScale = progress < 0.2
    ? (progress / 0.2) * 1.6
    : Math.max(0.01, 1.6 * (1 - (progress - 0.2) / 0.8));
  instance.coreMesh.scale.setScalar(coreScale);

  // Sparks fly outward with gravity and shrink
  for (const p of instance.particles) {
    p.velocity.y -= 4.0 * dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    const sparkScale = Math.max(0.01, 1 - progress);
    p.mesh.scale.setScalar(sparkScale);
  }

  return true;
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
