// Rendering projections only: no imports from simulation RNG and no mutation.
export const phase = (id) =>
  ([...String(id)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) / 4294967296) *
  Math.PI *
  2;
export function objectVisual(o, world, agents = []) {
  const power = world.objects.some(
    (g) =>
      g.type === 'generator' &&
      g.state === 'online' &&
      g.metadata.powerZone === o.metadata.powerZone,
  );
  const users = agents.filter(
    (a) =>
      a.alive &&
      a.target === o.id &&
      Math.hypot(a.position.x - o.position.x, a.position.z - o.position.z) < 2.5,
  );
  return {
    doorAngle: ['open', 'broken'].includes(o.state) ? Math.PI * 0.52 : 0,
    broken: o.state === 'broken',
    locked: o.state === 'locked',
    lidAngle: o.type === 'container' && o.state !== 'full' ? -Math.PI * 0.62 : 0,
    contents: !['empty', 'searched'].includes(o.state),
    searched: ['empty', 'searched', 'partial'].includes(o.state),
    online: o.state === 'online',
    damaged: o.state === 'damaged',
    repairing: users.some((a) => a.action === 'repair'),
    progress: Math.min(1, (o.metadata.repairProgress ?? 0) / 3),
    powered: power || !['village'].includes(o.metadata.powerZone),
    available: o.usable && (o.metadata.charges ?? 0) > 0,
    occupied: (o.metadata.occupants ?? []).length > 0 || users.some((a) => a.action === 'heal_at'),
    lit: o.state === 'lit',
    lowFuel: o.state === 'lit' && (o.metadata.fuel ?? 0) < 10,
    extinguished: o.state === 'extinguished',
    broadcasting: users.some((a) => a.action === 'broadcast'),
  };
}
export const eventPriority = {
  MATCH_ENDED: 100,
  DEATH: 90,
  BETRAYAL: 80,
  FIRE_STARTED: 70,
  POI_CONTROLLED: 60,
  GENERATOR_REPAIRED: 50,
  ATTACK: 40,
  BRIDGE_BLOCKED: 65,
};
export function visualHistory(events, elapsed, limit = 96) {
  return events
    .filter(
      (e) =>
        e.timestamp <= elapsed &&
        [
          'ATTACK',
          'BETRAYAL',
          'FIRE_STARTED',
          'BRIDGE_BLOCKED',
          'POI_CONTROLLED',
          'POI_RELEASED',
          'GENERATOR_REPAIRED',
          'CONTAINER_SEARCHED',
        ].includes(e.event),
    )
    .map((e) => ({
      ...e,
      age: elapsed - e.timestamp,
      permanent: ['FIRE_STARTED', 'GENERATOR_REPAIRED'].includes(e.event),
    }))
    .filter(
      (e) =>
        e.permanent || e.age <= (['POI_CONTROLLED', 'POI_RELEASED'].includes(e.event) ? 90 : 60),
    )
    .slice(-limit);
}
export function agentPose(a, s) {
  const object = s.world?.objects.find((o) => o.id === a.target);
  const other = s.agents.find((b) => b.id === a.target);
  const interaction =
    (!s.world?.spatial ||
      s.world.spatial.slots.some((slot) => slot.agentId === a.id && slot.state === 'occupied')) &&
    [
      'search',
      'repair',
      'heal_at',
      'rest_at',
      'broadcast',
      'occupy',
      'open',
      'close',
      'use',
    ].includes(a.action);
  const target = interaction
    ? (a.spatial?.facing ?? object?.position)
    : ['attack', 'betray', 'talk', 'trade', 'ally', 'cooperate'].includes(a.action)
      ? other?.position
      : null;
  return {
    action: a.alive ? a.action : 'shutdown',
    target,
    interaction,
    tower: s.world?.objects.find(
      (o) => o.type === 'watchtower' && o.metadata.occupants.includes(a.id),
    ),
    resting: a.action === 'rest_at',
    phase: phase(a.id),
  };
}
export function zoomTier(distance) {
  return distance > 70 ? 'far' : distance > 27 ? 'medium' : 'close';
}
