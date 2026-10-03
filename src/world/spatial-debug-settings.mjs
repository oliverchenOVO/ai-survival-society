export const DEBUG_KEY = 'society.spatial-debug.v1';
export const DEBUG_LAYERS = [
  'collision',
  'regions',
  'portals',
  'paths',
  'slots',
  'reservations',
  'radii',
];
export function readSpatialDebug() {
  try {
    return JSON.parse(localStorage.getItem(DEBUG_KEY) ?? '{}');
  } catch {
    return {};
  }
}
