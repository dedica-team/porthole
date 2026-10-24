
/**
 * Converts axial hex coordinates (q, r) to 3D world position (x, z).
 * Uses flat-top hexagon layout with a configurable size.
 */
export function hexToWorld(
  q: number,
  r: number,
  size = 1,
): { x: number; z: number } {
  const x = size * (3 / 2) * q;
  const z = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, z };
}

/**
 * Calculates the axial hex distance between two coordinates (q1, r1) and (q2, r2).
 */
export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  const dq = q1 - q2;
  const dr = r1 - r2;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}


