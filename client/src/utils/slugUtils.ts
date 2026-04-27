/**
 * Converts a human-readable landmark name to a URL/filename-safe slug.
 * Mirrors the backend toSlug() logic in PlaceTowerUseCase.kt.
 *
 * Examples:
 *   "Iron Keep"       → "iron-keep"
 *   " North Gate!! 42 " → "north-gate-42"
 *   "Château Frontenac" → "ch-teau-frontenac"
 */
export function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

