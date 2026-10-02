import { polar, clamp } from './random.mjs';
export const NAMES = [
  'Nova',
  'Atlas',
  'Echo',
  'Vex',
  'Iris',
  'Kairo',
  'Lyra',
  'Onyx',
  'Sage',
  'Rune',
  'Pax',
  'Juno',
];
export const COLORS = [
  '#8ee6c0',
  '#eabc7e',
  '#86c6ef',
  '#ec827e',
  '#c6a0ed',
  '#f2bb9a',
  '#9caeee',
  '#c7d6d8',
  '#b8d983',
  '#da9bbe',
  '#78d8d1',
  '#e4d281',
];
export const TRAITS = [
  'aggression',
  'greed',
  'loyalty',
  'empathy',
  'riskTolerance',
  'sociability',
  'deception',
  'curiosity',
];
export function createAgents(count, rng) {
  return Array.from({ length: count }, (_, index) => {
    const personality = Object.fromEntries(
      TRAITS.map((key) => [key, +(0.08 + rng() * 0.84).toFixed(2)]),
    );
    return {
      id: `Agent_${String(index + 1).padStart(2, '0')}`,
      name: NAMES[index],
      color: COLORS[index],
      index,
      personality,
      position: polar(7 + rng() * 10, (index / count) * Math.PI * 2 + rng() * 0.2),
      hp: 100,
      hunger: 12 + rng() * 25,
      energy: 75 + rng() * 25,
      // Seeded supplies create complementary needs without assigning social roles by identity.
      inventory: { food: Math.floor(rng() * 3), medicine: rng() < 0.3 ? 2 : 0, relic: 0 },
      weapon: 'None',
      goal: 'Understand the island',
      alive: true,
      memory: [],
      relationships: {},
      action: 'explore',
      target: null,
      destination: null,
      public_reason: 'Discover supplies and potential allies.',
      observed: 'A new island, twelve strangers.',
      nextDecision: index * 0.18,
      nextLLM: 10 + index * 2,
      alliance: [],
      infected: false,
      stats: {
        kills: 0,
        trades: 0,
        alliances: 0,
        betrayals: 0,
        conversations: 0,
        attacks: 0,
        steals: 0,
        resources: 0,
      },
      lastAction: -10,
      decisionSource: 'utility',
      utility: [],
      diedAt: null,
      reflection: '',
    };
  });
}
export function relation(a, b) {
  return (a.relationships[b.id] ??= {
    trust: 0.15,
    affinity: 0,
    fear: 0,
    hostility: 0,
    alliance: false,
  });
}
export function changeRelation(a, b, delta) {
  const r = relation(a, b);
  for (const [key, value] of Object.entries(delta)) {
    if (key === 'alliance') r[key] = value;
    else r[key] = clamp(r[key] + value, key === 'affinity' || key === 'trust' ? -1 : 0, 1);
  }
}
