import * as THREE from 'three';
import type { Landmark } from '@/types/landmark';
import { hexDistance } from '@/utils/hexUtils';

/**
 * Desaturates a hex color string by adjusting its HSL saturation component.
 *
 * @param colorHex Hex color code (e.g. '#22c55e')
 * @param factor Saturation multiplier (default 0.40 for distance 2 tiles)
 * @returns [r, g, b] color tuple in range 0..1
 */
export function desaturateColor(colorHex: string, factor = 0.40): [number, number, number] {
  const c = new THREE.Color(colorHex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s * factor, hsl.l);
  return [c.r, c.g, c.b];
}

export interface StatusElement {
  id: string;
  coordinate: { q: number; r: number };
  statusColor: [number, number, number];
  desaturatedColor: [number, number, number];
}

/**
 * Extracts elements (landmarks) that have an active status color for the selected metric layer.
 * If a specific metric overlay layer is selected (`metricOverlayEntries` is provided and non-empty),
 * extracts status elements based on that metric's level color.
 * If "none" overlay is selected (`metricOverlayEntries` is undefined or empty), returns an empty array
 * so that no heatmap is painted.
 * If `visibleLandmarkIds` is provided, only landmarks contained in the set are included.
 */
export function resolveStatusElements(
  landmarks: Record<string, Landmark> | undefined,
  metricOverlayEntries?: Map<string, { value: string; color: string }>,
  visibleLandmarkIds?: Set<string>,
): StatusElement[] {
  if (!landmarks || !metricOverlayEntries || metricOverlayEntries.size === 0) return [];
  const elements: StatusElement[] = [];

  for (const lm of Object.values(landmarks)) {
    if (!lm.coordinate) continue;
    if (visibleLandmarkIds && !visibleLandmarkIds.has(lm.id)) continue;

    const entry = metricOverlayEntries.get(lm.id);
    if (!entry) continue;

    const colorHex = entry.color;
    if (colorHex) {
      const c = new THREE.Color(colorHex);
      const statusColor: [number, number, number] = [c.r, c.g, c.b];
      const desaturatedColor = desaturateColor(colorHex);
      elements.push({
        id: lm.id,
        coordinate: lm.coordinate,
        statusColor,
        desaturatedColor,
      });
    }
  }

  return elements;
}

/**
 * Computes top and side RGB for a hex tile given nearby status elements.
 *
 * Rules:
 * - Distance 0 (tile with element) and Distance 1 (adjacent tiles): full status color, weight 1.0.
 * - Distance 2: desaturated color, weight 0.5.
 * - Distance > 2: no influence.
 * - When multiple elements are within distance <= 2, their contributions are combined by weighted average.
 *
 * Returns null if the tile is not influenced by any status element (distance > 2 for all).
 */
export function computeTileHeatmapColor(
  q: number,
  r: number,
  statusElements: StatusElement[],
): { topRGB: [number, number, number]; sideRGB: [number, number, number] } | null {
  if (statusElements.length === 0) return null;

  let totalWeight = 0;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;

  for (const elem of statusElements) {
    const d = hexDistance(q, r, elem.coordinate.q, elem.coordinate.r);
    if (d > 2) continue;

    const isNear = d <= 1;
    const w = isNear ? 1.0 : 0.5;
    const [cr, cg, cb] = isNear ? elem.statusColor : elem.desaturatedColor;

    totalWeight += w;
    totalR += w * cr;
    totalG += w * cg;
    totalB += w * cb;
  }

  if (totalWeight === 0) return null;

  const topRGB: [number, number, number] = [
    totalR / totalWeight,
    totalG / totalWeight,
    totalB / totalWeight,
  ];

  const sideRGB: [number, number, number] = [
    topRGB[0] * 0.85,
    topRGB[1] * 0.85,
    topRGB[2] * 0.85,
  ];

  return { topRGB, sideRGB };
}
