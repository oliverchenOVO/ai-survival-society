import { distance } from './random.mjs';
import { relation } from './agents.mjs';
import { WORLD_ACTIONS, worldCandidates, canSee, observeWorld } from './living-world.mjs';
export const ACTIONS = [
  ...WORLD_ACTIONS,
  'eat',
  'heal',
  'rest',
  'forage',
  'explore',
  'talk',
  'trade',
  'ally',
  'cooperate',
  'deceive',
  'steal',
  'attack',
  'flee',
  'betray',
];
export function candidates(sim, a) {
  observeWorld(sim, a);
  const p = a.personality;
  const options = [];
  const add = (action, score, target, public_reason, destination = null) =>
    options.push({ action, score: score + sim.rng() * 0.12, target, public_reason, destination });
  const inside = distance(a.position, { x: 0, z: 0 }) < sim.safeRadius - 1.5;
  if (!inside)
    add(
      'flee',
      2 + (100 - a.hp) / 100,
      null,
      'The storm ring is closing. I need to reach shelter.',
      { x: a.position.x * 0.25, z: a.position.z * 0.25 },
    );
  if (a.inventory.food > 0)
    add('eat', a.hunger / 40, null, 'Eat now to preserve health and energy.');
  if (a.inventory.medicine > 0 && a.hp < 85)
    add('heal', (100 - a.hp) / 30, null, 'Use my medicine before the next encounter.');
  add(
    'rest',
    (100 - a.energy) / 45 + (a.hp < 40 ? 0.5 : 0),
    null,
    'Recover energy; exhaustion makes every encounter dangerous.',
  );
  const resources = sim.resources.filter(
    (r) => distance(r.position, { x: 0, z: 0 }) < sim.safeRadius && canSee(sim, a, r.position),
  );
  resources.sort((x, y) => {
    const cost = (r) =>
      distance(a.position, r.position) -
      (r.type === 'food'
        ? a.hunger * 0.1
        : r.type === 'weapon' && a.weapon === 'None'
          ? 6 * p.aggression
          : 0);
    return cost(x) - cost(y);
  });
  if (resources[0])
    add(
      'forage',
      0.25 + a.hunger / 100 + p.greed * 0.3 + (a.inventory.food === 0 ? 0.35 : -0.1),
      resources[0].id,
      `Seek ${resources[0].type} while supplies remain.`,
      resources[0].position,
    );
  const nearby = sim.agents.filter(
    (b) =>
      b.alive &&
      b.id !== a.id &&
      canSee(sim, a, b.position, ['hide', 'take_cover'].includes(b.action)),
  );
  a.observed = nearby.length
    ? `${nearby
        .map((b) => b.name)
        .slice(0, 3)
        .join(', ')} nearby. ${resources.length} supplies inside the ring.`
    : `${resources.length} supplies inside the ring; no agents nearby.`;
  for (const b of nearby) {
    const r = relation(a, b);
    const danger = r.hostility + b.personality.aggression * 0.3;
    const urgent = a.hunger / 100;
    const socialNovelty = a.memory.some(
      (m) => m.who === b.id && ['CONVERSATION', 'ALLIANCE_CREATED'].includes(m.event),
    )
      ? 0
      : 0.25;
    add(
      'talk',
      0.25 + p.sociability * 0.55 + socialNovelty - r.hostility * 0.6,
      b.id,
      'Conversation can reveal intentions before taking a risk.',
    );
    if (!r.alliance && r.trust > 0.2 && r.hostility < 0.4)
      add(
        'ally',
        0.42 + p.loyalty * 0.35 + p.empathy * 0.15 + r.trust * 0.4 - a.alliance.length * 0.28,
        b.id,
        `An alliance with ${b.name} offers mutual protection.`,
      );
    if (a.inventory.food > 1 && (b.inventory.food < 1 || b.hunger > 35) && r.hostility < 0.5)
      add(
        'trade',
        0.45 +
          p.sociability * 0.3 +
          p.greed * 0.18 +
          r.trust * 0.2 +
          (a.inventory.medicine === 0 && b.inventory.medicine > 0 ? 0.3 : 0),
        b.id,
        'Exchange surplus food for medicine or a future favor.',
      );
    if (a.inventory.food === 0 && b.inventory.food > 1 && relation(b, a).hostility < 0.5)
      add(
        'trade',
        0.4 + urgent + r.trust * 0.3 - p.aggression * 0.15,
        b.id,
        'Trade for food rather than risk a fight.',
      );
    if (
      r.alliance &&
      (((b.hp < 75 || b.infected) && a.inventory.medicine) ||
        (b.hunger > 35 && b.inventory.food === 0 && a.inventory.food > 1))
    )
      add(
        'cooperate',
        0.8 + p.empathy * 0.6 + p.loyalty * 0.35,
        b.id,
        'Keep an ally alive by sharing essential supplies.',
      );
    if (b.inventory.food > 0 && !r.alliance) {
      add(
        'steal',
        0.12 + p.greed * 0.65 + p.deception * 0.3 + urgent * 0.45 - r.fear * 0.3 - p.empathy * 0.45,
        b.id,
        'Their food could protect me, but discovery would damage trust.',
      );
      add(
        'deceive',
        0.12 + p.deception * 0.62 + p.greed * 0.3 - p.empathy * 0.3 + urgent * 0.15,
        b.id,
        'Offer a misleading promise to gain a supply advantage.',
      );
    }
    const strength = (a.hp - b.hp) / 150 + (a.weapon !== 'None' ? 0.2 : 0);
    const pressure = sim.elapsed / sim.config.matchDuration;
    const violence =
      0.08 +
      p.aggression * 0.72 +
      r.hostility * 0.95 +
      pressure * 0.62 +
      strength * p.riskTolerance -
      p.empathy * 0.38 -
      r.fear * 0.15;
    if (!r.alliance)
      add(
        'attack',
        violence,
        b.id,
        r.hostility > 0.4
          ? 'Past harm has made this encounter a threat.'
          : 'Scarcity and the shrinking ring make a rival dangerous.',
      );
    else if (p.deception > 0.45)
      add(
        'betray',
        violence + p.greed * 0.25 + p.deception * 0.4 - p.loyalty * 0.65 - r.trust * 0.2,
        b.id,
        'Survival pressure is testing my loyalty to this alliance.',
      );
    if (danger > 0.4 && a.hp < 65)
      add(
        'flee',
        danger * (1 - p.riskTolerance) + (100 - a.hp) / 55,
        b.id,
        'A retreat is safer than a fight I may not survive.',
        {
          x: a.position.x + (a.position.x - b.position.x) * 0.6,
          z: a.position.z + (a.position.z - b.position.z) * 0.6,
        },
      );
  }
  const angle = sim.rng() * Math.PI * 2;
  add(
    'explore',
    0.2 + p.curiosity * 0.45,
    null,
    'Explore unfamiliar ground and look for opportunity.',
    { x: Math.cos(angle) * sim.safeRadius * 0.65, z: Math.sin(angle) * sim.safeRadius * 0.65 },
  );
  options.push(...worldCandidates(sim, a));
  return options.filter(o=>!a.spatial?.blockedActions?.some(b=>b.until>sim.elapsed&&b.action===o.action&&b.target===o.target)).sort((x, y) => y.score - x.score);
}
export function chooseDecision(sim, a) {
  const options = candidates(sim, a);
  a.utility = options
    .slice(0, 5)
    .map((o) => ({ action: o.action, score: +o.score.toFixed(3), target: o.target }));
  let decision = options[0];
  const model = sim.modelDecisions.get(a.id);
  if (model && sim.elapsed - model.time < 35 && decision.score < 2) {
    const legal = options.find((o) => o.action === model.action && o.target === model.target);
    if (legal)
      decision = {
        ...legal,
        public_reason: model.public_reason,
        message: model.message,
        source: 'llm',
      };
    sim.modelDecisions.delete(a.id);
  }
  a.action = decision.action;
  a.target = decision.target;
  a.public_reason = decision.public_reason;
  a.reasonData = decision.reasonData;
  a.destination = decision.destination ? { ...decision.destination } : null;
  a.decisionSource = decision.source ?? 'utility';
  a.goal =
    {
      forage: 'Secure supplies',
      eat: 'Satisfy hunger',
      heal: 'Recover health',
      rest: 'Conserve energy',
      talk: 'Understand a stranger',
      ally: 'Build an alliance',
      trade: 'Exchange resources',
      attack: 'Remove a threat',
      flee: 'Reach safety',
      betray: 'Break a fragile alliance',
      cooperate: 'Protect an ally',
      steal: 'Acquire food covertly',
      deceive: 'Gain through deception',
      explore: 'Explore the island',
    }[decision.action] ?? 'world.goal';
  return decision;
}
