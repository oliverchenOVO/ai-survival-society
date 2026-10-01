import { polar } from './random.mjs';
export const ZONES = [
  { name: 'Verdant forest', x: -13, z: -8, kind: 'forest' },
  { name: 'Old sanctuary', x: 10, z: -10, kind: 'ruins' },
  { name: 'Haven village', x: -10, z: 12, kind: 'village' },
  { name: 'North ridge', x: 2, z: -19, kind: 'mountain' },
  { name: 'Supply beacon', x: 0, z: 0, kind: 'supply' },
];
export function terrainHeight(x, z) {
  const mountain = Math.max(0, 1 - Math.hypot(x - 2, z + 19) / 8) * 10;
  return 2.0 + Math.sin(x * 0.15) * Math.cos(z * 0.18) * 0.7 + mountain;
}
export function createResource(sim, type = null, position = null) {
  const p =
    position ??
    polar(Math.sqrt(sim.rng()) * Math.max(3, sim.safeRadius - 2), sim.rng() * Math.PI * 2);
  const roll = sim.rng();
  const kind =
    type ?? (roll < 0.65 ? 'food' : roll < 0.83 ? 'medicine' : roll < 0.94 ? 'weapon' : 'relic');
  return {
    id: `Resource_${++sim.resourceId}`,
    type: kind,
    position: p,
    amount: kind === 'food' ? 2 : 1,
  };
}
