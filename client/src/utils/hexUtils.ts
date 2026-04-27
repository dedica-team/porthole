
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


