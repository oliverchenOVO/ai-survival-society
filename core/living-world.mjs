import { clamp, distance, randomGenerator } from './random.mjs';
import { relation } from './agents.mjs';
import { remember } from './events.mjs';

export const WORLD_ACTIONS = [
  'interact',
  'open',
  'close',
  'search',
  'use',
  'rest_at',
  'heal_at',
  'repair',
  'occupy',
  'broadcast',
  'hide',
  'take_cover',
];
const layouts = [
  ['village', -10, 12, 0.2, 0.8],
  ['clinic', -3, 6, 0.25, 0.9],
  ['watchtower', 2, -19, 0.35, 0.15],
  ['ruins', 10, -10, 0.55, 0.1],
  ['depot', 0, 0, 0.3, 0.25],
  ['shelter', 9, 10, 0.1, 1],
  ['bridge', 3, 2, 0.45, 0.05],
  ['lake', -14, -5, 0.1, 0.2],
];
const types = {
  village: ['door', 'container', 'bed', 'campfire', 'generator', 'radio'],
  clinic: ['door', 'medical_station', 'bed', 'container'],
  watchtower: ['watchtower'],
  ruins: ['door', 'container', 'campfire'],
  depot: ['container', 'radio'],
  shelter: ['bed', 'campfire', 'door'],
  bridge: ['watchtower'],
  lake: ['container'],
};
export function createLivingWorld(seed) {
  // Independent gameplay stream: construction does not perturb personality/resource RNG.
  const rng = randomGenerator((Number(seed) ^ 0x574f524c) >>> 0);
  const world = {
    schemaVersion: 1,
    timeOfDay: 'day',
    weather: 'clear',
    weatherUntil: 65 + rng() * 40,
    nextHazard: 100 + rng() * 60,
    serial: 0,
    hazards: [],
    objects: [],
    pois: [],
    metrics: {
      visits: 0,
      interactions: 0,
      searches: 0,
      restUses: 0,
      medicalUses: 0,
      repairs: 0,
      controls: 0,
      shelterUses: 0,
      hazardAvoidance: 0,
      broadcasts: 0,
      reroutes: 0,
    },
    walls: [
      { x: -13.5, z: 9, hx: 2.5, hz: 0.35 },
      { x: -6.5, z: 9, hx: 2.5, hz: 0.35 },
      { x: 7, z: -12, hx: 2, hz: 0.35 },
      { x: 13, z: -12, hx: 2, hz: 0.35 },
    ],
  };
  for (const [type, x, z, risk, shelter] of layouts) {
    const poi = {
      id: `poi_${type}`,
      type,
      position: { x, z },
      risk,
      shelter,
      resources: {},
      interactables: [],
      occupancy: [],
      controller: null,
      controllers: [],
      access: 'public',
      recentEvents: [],
      claim: {},
      controlSince: null,
    };
    world.pois.push(poi);
    types[type].forEach((kind, index) => {
      const position =
        kind === 'door'
          ? { x, z: type === 'village' ? 9 : type === 'ruins' ? -12 : z - 2 }
          : { x: x + ((index % 3) - 1) * 1.8, z: z + Math.floor(index / 3) * 1.8 };
      const stock =
        kind === 'container'
          ? {
              food: type === 'village' ? 6 : 2 + Math.floor(rng() * 3),
              medicine: type === 'clinic' ? 4 : Math.floor(rng() * 2),
              weapon: ['ruins', 'depot'].includes(type) ? 1 : 0,
              water: type === 'lake' ? 12 : 2,
              wood: 3,
              relic: type === 'ruins' ? 2 : 0,
            }
          : {};
      const object = {
        id: `${type}_${kind}_${index}`,
        type: kind,
        poi: poi.id,
        position,
        state:
          kind === 'door'
            ? rng() < 0.25
              ? 'locked'
              : 'closed'
            : kind === 'generator'
              ? 'damaged'
              : kind === 'campfire'
                ? 'unlit'
                : kind === 'container'
                  ? 'full'
                  : 'available',
        capacity: kind === 'bed' ? 1 : 2,
        durability: 100,
        owner: null,
        controller: null,
        cooldown: 0,
        usable: true,
        visible: true,
        metadata: {
          stock,
          charges: kind === 'medical_station' ? 8 : 0,
          occupants: [],
          fuel: 0,
          powerZone: ['clinic', 'village'].includes(type) ? 'village' : type,
          visits: {},
        },
      };
      world.objects.push(object);
      poi.interactables.push(object.id);
    });
  }
  return world;
}
export function poiAt(world, position) {
  return world?.pois.find((p) => distance(p.position, position) < 4.5) ?? null;
}
export function powered(world, o) {
  return (
    !['medical_station', 'radio'].includes(o.type) ||
    world.objects.some(
      (g) =>
        g.type === 'generator' &&
        g.metadata.powerZone === o.metadata.powerZone &&
        g.state === 'online',
    ) ||
    !['village'].includes(o.metadata.powerZone)
  );
}
export function shelterAt(sim, a) {
  const p = poiAt(sim.world, a.position);
  if (!p) return 0;
  const doors = sim.world.objects.filter((o) => o.poi === p.id && o.type === 'door');
  return p.shelter * (doors.some((o) => ['open', 'broken'].includes(o.state)) ? 0.65 : 1);
}
export function perceptionRadius(sim, a) {
  const tower = sim.world.objects.some(
    (o) => o.type === 'watchtower' && o.metadata.occupants.includes(a.id),
  );
  const fire = sim.world.objects.some(
    (o) => o.type === 'campfire' && o.state === 'lit' && distance(o.position, a.position) < 5,
  );
  return (
    sim.config.socialRadius *
    (sim.world.timeOfDay === 'night' ? (fire ? 0.9 : 0.68) : 1) *
    (sim.world.weather === 'storm' ? 0.68 : 1) *
    (tower ? 1.9 : 1)
  );
}
function cuts(a, b, rect) {
  let low = 0,
    high = 1;
  for (const axis of ['x', 'z']) {
    const half = axis === 'x' ? rect.hx : rect.hz,
      d = b[axis] - a[axis],
      min = rect[axis] - half,
      max = rect[axis] + half;
    if (Math.abs(d) < 1e-9) {
      if (a[axis] < min || a[axis] > max) return false;
    } else {
      let t1 = (min - a[axis]) / d,
        t2 = (max - a[axis]) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      low = Math.max(low, t1);
      high = Math.min(high, t2);
      if (low > high) return false;
    }
  }
  return low <= high;
}
export function blockers(sim, navigation = false) {
  const pad = navigation ? 0.3 : 0;
  return [
    ...sim.world.walls.map((r) => ({ ...r, hx: r.hx + pad, hz: r.hz + pad })),
    ...sim.world.objects
      .filter((o) => o.type === 'door' && ['closed', 'locked'].includes(o.state))
      .map((o) => ({ ...o.position, hx: 0.85 + pad, hz: 0.3 + pad })),
    ...(navigation
      ? sim.world.hazards.map((h) => ({ ...h.position, hx: h.radius + 0.4, hz: h.radius + 0.4 }))
      : []),
  ];
}
export function canSee(sim, a, position, hidden = false) {
  return (
    distance(a.position, position) < perceptionRadius(sim, a) * (hidden ? 0.5 : 1) &&
    !blockers(sim).some((r) => cuts(a.position, position, r))
  );
}
export function navigationWaypoint(sim, a, destination) {
  const obstacles = blockers(sim, true).filter(
    (r) => Math.abs(a.position.x - r.x) > r.hx || Math.abs(a.position.z - r.z) > r.hz,
  );
  const clear = (x, y) => !obstacles.some((r) => cuts(x, y, r));
  if (clear(a.position, destination)) return destination;
  const nodes = [a.position, destination];
  for (const r of obstacles)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        nodes.push({ x: r.x + sx * (r.hx + 0.12), z: r.z + sz * (r.hz + 0.12) });
  const costs = nodes.map(() => Infinity),
    prev = [],
    done = new Set();
  costs[0] = 0;
  for (let n = 0; n < nodes.length; n++) {
    let i = -1;
    for (let j = 0; j < nodes.length; j++)
      if (!done.has(j) && (i < 0 || costs[j] < costs[i])) i = j;
    if (i < 0 || !Number.isFinite(costs[i])) break;
    if (i === 1) break;
    done.add(i);
    for (let j = 1; j < nodes.length; j++)
      if (!done.has(j) && clear(nodes[i], nodes[j])) {
        const c = costs[i] + distance(nodes[i], nodes[j]);
        if (c < costs[j]) {
          costs[j] = c;
          prev[j] = i;
        }
      }
  }
  if (!Number.isFinite(costs[1])) return a.position;
  let i = 1;
  while (prev[i] !== 0 && prev[i] !== undefined) i = prev[i];
  if (sim.elapsed - (a.lastReroute ?? -10) > 5) {
    sim.world.metrics.reroutes = (sim.world.metrics.reroutes ?? 0) + 1;
    if (
      sim.world.hazards.some((h) =>
        cuts(a.position, destination, { ...h.position, hx: h.radius + 0.4, hz: h.radius + 0.4 }),
      )
    )
      sim.world.metrics.hazardAvoidance++;
    worldEvent(sim, 'ROUTE_CHANGED', a, poiAt(sim.world, a.position), null);
    a.lastReroute = sim.elapsed;
  }
  return nodes[i];
}
export function worldEvent(sim, type, a, p, o, extra = {}) {
  const data = {
    poi: p?.id ?? o?.poi ?? null,
    object: o?.id ?? null,
    objectType: o?.type ?? null,
    ...extra,
  };
  const e = sim.event(
    type,
    a,
    null,
    type,
    data,
    ['POI_CONTROLLED', 'POI_CONTESTED', 'FIRE_STARTED', 'BRIDGE_BLOCKED'].includes(type)
      ? 0.85
      : 0.45,
  );
  e.position = { ...(o?.position ?? p?.position ?? a?.position ?? { x: 0, z: 0 }) };
  if (p) {
    p.recentEvents.push(e.id);
    p.recentEvents = p.recentEvents.slice(-12);
  }
  if (a && a.memory.at(-1)) {
    a.memory.at(-1).poi = data.poi;
    a.memory.at(-1).position = { ...e.position };
  }
  return e;
}
export function knowledgeState(entry, elapsed) {
  return !entry
    ? 'unknown'
    : elapsed - entry.seenAt < 8
      ? 'recently_seen'
      : elapsed - entry.seenAt < 35
        ? 'known'
        : 'stale';
}
export function observeWorld(sim, a) {
  a.worldKnowledge ??= {};
  a.placeStats ??= {};
  for (const p of sim.world.pois)
    if (canSee(sim, a, p.position)) {
      const previous = a.worldKnowledge[p.id];
      a.worldKnowledge[p.id] = {
        id: p.id,
        type: p.type,
        position: { ...p.position },
        controller: p.controller,
        controllers: [...p.controllers],
        risk: p.risk,
        shelter: p.shelter,
        seenAt: sim.elapsed,
        objects: sim.world.objects
          .filter(
            (o) =>
              o.poi === p.id &&
              (canSee(sim, a, o.position) ||
                (o.type === 'door' && distance(a.position, o.position) < perceptionRadius(sim, a))),
          )
          .map((o) => structuredClone(o)),
        danger: sim.world.hazards.filter((h) => distance(h.position, p.position) < h.radius + 4)
          .length,
        lastConflict: previous?.lastConflict ?? null,
      };
    }
  const p = poiAt(sim.world, a.position);
  if (p && a.currentPOI !== p.id) {
    sim.world.metrics.visits++;
    a.placeStats[p.id] ??= { visits: 0, controlSeconds: 0 };
    a.placeStats[p.id].visits++;
    worldEvent(sim, 'POI_VISITED', a, p, null);
  }
  a.currentPOI = p?.id ?? null;
}
export function accessRisk(a, p) {
  if (!p?.controller || p.controllers?.includes(a.id)) return 0;
  const r = a.relationships[p.controller] ?? { trust: 0.15, hostility: 0 };
  return Math.max(-0.25, r.hostility * 0.9 - r.trust * 0.25);
}
const allowed = {
  door: ['open', 'close', 'interact'],
  container: ['search', 'use', 'interact'],
  bed: ['rest_at', 'use', 'interact'],
  campfire: ['use', 'interact', 'close'],
  medical_station: ['heal_at', 'use', 'interact'],
  generator: ['repair', 'interact'],
  watchtower: ['occupy', 'use', 'interact'],
  radio: ['broadcast', 'use', 'interact'],
};
export function canInteract(sim, a, o, action = a.action, requireRange = true) {
  if (
    !o ||
    !a.alive ||
    !o.usable ||
    !o.visible ||
    !(allowed[o.type] ?? []).includes(action) ||
    o.cooldown > sim.elapsed
  )
    return false;
  if (requireRange && distance(a.position, o.position) > 1.7) return false;
  if (o.metadata.occupants.filter((id) => id !== a.id).length >= o.capacity) return false;
  if (
    o.type === 'door' &&
    ((action === 'close' && o.state !== 'open') ||
      (action === 'open' && !['closed', 'locked'].includes(o.state)))
  )
    return false;
  if (o.type === 'generator' && o.state === 'online') return false;
  if (
    o.type === 'medical_station' &&
    (!powered(sim.world, o) || a.hp >= 98 || (o.metadata.charges <= 0 && a.inventory.medicine <= 0))
  )
    return false;
  if (o.type === 'radio' && !powered(sim.world, o)) return false;
  if (o.type === 'campfire' && o.state !== 'lit' && (a.inventory.wood ?? 0) <= 0) return false;
  return true;
}
export function getUtility(sim, a, o, p) {
  const d = distance(a.position, o.position),
    danger =
      (p?.danger ?? 0) * 0.6 +
      accessRisk(a, p) +
      (p?.lastConflict != null && sim.elapsed - p.lastConflict < 45 ? 0.3 : 0),
    night = sim.world.timeOfDay === 'night',
    storm = sim.world.weather === 'storm';
  const decay = d / 28 + danger,
    trait = a.personality;
  let score = 0,
    action = 'use';
  switch (o.type) {
    case 'door':
      action = o.state === 'open' ? 'close' : 'open';
      score = o.state === 'open' ? (storm ? 0.75 : 0.05) : 0.55 + trait.curiosity * 0.3;
      break;
    case 'container':
      action = 'search';
      score = Object.values(o.metadata.stock).some((v) => v > 0)
        ? 0.5 + a.hunger / 95 + (a.inventory.food < 1 ? 0.3 : 0) + trait.greed * 0.2
        : 0.03;
      break;
    case 'bed':
      action = 'rest_at';
      score = (100 - a.energy) / 40 + (storm ? 0.45 : night ? 0.2 : 0) + (100 - a.hp) / 250;
      break;
    case 'medical_station':
      action = 'heal_at';
      score = (100 - a.hp) / 23 + (a.infected ? 0.8 : 0);
      break;
    case 'generator':
      action = 'repair';
      score = 0.8 + trait.curiosity * 0.5 + (100 - a.hp) / 90 + (night ? 0.35 : 0);
      break;
    case 'campfire':
      score =
        (100 - a.energy) / 70 +
        (night ? 0.65 : 0.05) +
        (storm ? -0.7 : 0) +
        trait.sociability * 0.12;
      break;
    case 'watchtower':
      action = 'occupy';
      score = 0.3 + trait.curiosity * 0.45 + (night ? 0.2 : 0) + (100 - a.hp) / 180;
      break;
    case 'radio':
      action = 'broadcast';
      score = 0.25 + trait.sociability * 0.5 + trait.deception * 0.15;
      break;
  }
  return { action, score: score - decay };
}
export function worldCandidates(sim, a) {
  const out = [];
  for (const k of Object.values(a.worldKnowledge ?? {}).filter(Boolean)) {
    if (distance(k.position, { x: 0, z: 0 }) > sim.safeRadius - 1) continue;
    for (const o of k.objects ?? []) {
      const c = getUtility(sim, a, o, k);
      if (!canInteract(sim, a, o, c.action, false)) continue;
      const stale = knowledgeState(k, sim.elapsed) === 'stale';
      out.push({
        ...c,
        score: c.score - (stale ? 0.12 : 0),
        target: o.id,
        destination: o.position,
        public_reason: 'world.reason',
        reasonData: { objectType: o.type, poi: k.type },
      });
    }
    if (
      (sim.world.weather === 'storm' || sim.world.timeOfDay === 'night' || a.hp < 40) &&
      k.shelter > 0.6
    )
      out.push({
        action: 'take_cover',
        score:
          (100 - a.energy) / 65 +
          (sim.world.weather === 'storm' ? 0.6 : 0.15) +
          k.shelter * 0.3 -
          distance(a.position, k.position) / 22 -
          accessRisk(a, k),
        target: null,
        destination: k.position,
        public_reason: 'world.cover',
      });
  }
  if (a.hp < 45 && a.personality.riskTolerance < 0.6)
    out.push({
      action: 'hide',
      score: (100 - a.hp) / 80,
      target: null,
      destination: null,
      public_reason: 'world.hide',
    });
  const hazard = sim.world.hazards.find((h) => distance(a.position, h.position) < h.radius + 1);
  if (hazard) {
    const dx = a.position.x - hazard.position.x,
      dz = a.position.z - hazard.position.z,
      d = Math.hypot(dx, dz) || 1;
    out.push({
      action: 'flee',
      score: 3 + (100 - a.hp) / 100,
      target: null,
      destination: {
        x: hazard.position.x + (dx / d) * (hazard.radius + 2),
        z: hazard.position.z + (dz / d) * (hazard.radius + 2),
      },
      public_reason: 'world.flee',
    });
  }
  return out;
}
export function performInteraction(sim, a, o, dt) {
  if (!canInteract(sim, a, o)) return false;
  const p = sim.world.pois.find((p) => p.id === o.poi),
    m = sim.world.metrics;
  const record = (event, extra = {}) => {
    m.interactions++;
    worldEvent(sim, event, a, p, o, extra);
    a.worldKnowledge ??= {};
    delete a.worldKnowledge[p.id];
  };
  switch (o.type) {
    case 'door':
      if (a.action === 'close') {
        o.state = 'closed';
        record('DOOR_CLOSED');
      } else {
        if (o.state === 'locked') {
          o.durability -= dt * 35;
          a.energy = Math.max(0, a.energy - dt * 2);
          if (o.durability > 0) return true;
          o.state = 'broken';
          record('DOOR_FORCED');
        } else {
          o.state = 'open';
          record('DOOR_OPENED');
        }
      }
      break;
    case 'container': {
      const stock = o.metadata.stock,
        amount = Object.values(stock).reduce((s, v) => s + v, 0);
      if (!amount) {
        o.state = 'searched';
        record('DISAPPOINTED_SEARCH');
      } else {
        for (const [kind, value] of Object.entries(stock)) {
          if (value <= 0) continue;
          const take = Math.min(value, kind === 'food' ? 2 : 1);
          stock[kind] -= take;
          if (kind === 'weapon') a.weapon = 'Pulse blade';
          else a.inventory[kind] = (a.inventory[kind] ?? 0) + take;
        }
        o.state = Object.values(stock).some((v) => v > 0) ? 'partial' : 'empty';
        a.stats.resources++;
        m.searches++;
        record('CONTAINER_SEARCHED', { stock: { ...stock } });
      }
      break;
    }
    case 'bed':
    case 'watchtower':
    case 'campfire': {
      if (o.type === 'campfire' && a.action === 'close') {
        o.state = 'unlit';
        record('CAMPFIRE_EXTINGUISHED');
        break;
      }
      if (o.type === 'campfire' && o.state !== 'lit') {
        a.inventory.wood--;
        o.state = 'lit';
        o.metadata.fuel = 80;
        record('CAMPFIRE_LIT');
      }
      if (!o.metadata.occupants.includes(a.id)) {
        o.metadata.occupants.push(a.id);
        if (o.type === 'bed') m.restUses++;
        if (shelterAt(sim, a) > 0.4) m.shelterUses++;
        record(o.type === 'watchtower' ? 'WATCHTOWER_OCCUPIED' : 'REST_STARTED');
      }
      a.energy = clamp(a.energy + dt * (o.type === 'bed' ? 7 : 4), 0, 100);
      a.hp = clamp(a.hp + dt * 0.25, 0, 100);
      return true;
    }
    case 'medical_station':
      if (a.inventory.medicine > 0) a.inventory.medicine--;
      else o.metadata.charges--;
      a.hp = clamp(a.hp + 40, 0, 100);
      a.infected = false;
      m.medicalUses++;
      record('STATION_HEAL');
      break;
    case 'generator':
      o.durability = clamp(o.durability + dt * 25, 0, 100);
      o.metadata.repairProgress = (o.metadata.repairProgress ?? 0) + dt;
      if (o.metadata.repairProgress < 3) return true;
      o.state = 'online';
      m.repairs++;
      record('GENERATOR_REPAIRED');
      break;
    case 'radio':
      m.broadcasts++;
      record('BROADCAST_SENT', { message: a.message || null });
      for (const b of sim.agents.filter(
        (b) => b.alive && b !== a && distance(a.position, b.position) < 20,
      )) {
        remember(b, sim.bus.log.at(-1), 0.1, 0.6);
        b.worldKnowledge ??= {};
        b.worldKnowledge[p.id] = {
          ...structuredClone(a.worldKnowledge[p.id] ?? {}),
          id: p.id,
          type: p.type,
          position: { ...p.position },
          controller: p.controller,
          controllers: [...p.controllers],
          seenAt: sim.elapsed - 10,
          objects: [],
          risk: p.risk,
          shelter: p.shelter,
        };
      }
      break;
  }
  o.cooldown = sim.elapsed + (o.type === 'radio' ? 35 : o.type === 'container' ? 5 : 1);
  a.nextDecision = sim.elapsed;
  return true;
}
export function setWeather(sim, weather, duration) {
  sim.world.weather = weather;
  sim.world.weatherUntil = sim.elapsed + duration;
  sim.effects.storm = weather === 'storm' ? sim.world.weatherUntil : 0;
  worldEvent(sim, 'WEATHER_CHANGED', null, null, null, { weather });
}
export function startHazard(sim, type, poiId) {
  const p = sim.world.pois.find((p) => p.id === poiId) ?? sim.world.pois[3];
  const h = {
    id: `hazard_${++sim.world.serial}`,
    type,
    poi: p.id,
    position: { ...p.position },
    radius: type === 'fire' ? 2.5 : 1.6,
    duration: 45,
    until: sim.elapsed + 45,
    damage: type === 'fire' ? 2 : 0.3,
    spreadChance: type === 'fire' ? 0.08 : 0,
  };
  sim.world.hazards.push(h);
  worldEvent(sim, type === 'fire' ? 'FIRE_STARTED' : 'BRIDGE_BLOCKED', null, p, null, {
    hazard: type,
  });
  return h;
}
export function updateWorld(sim, dt) {
  const w = sim.world;
  w.timeOfDay = Math.floor(sim.elapsed / 90) % 2 ? 'night' : 'day';
  if (sim.elapsed >= w.weatherUntil) {
    const r = sim.rng();
    setWeather(sim, r < 0.55 ? 'clear' : r < 0.83 ? 'rain' : 'storm', 50 + sim.rng() * 40);
  }
  if (sim.elapsed >= w.nextHazard) {
    const type = sim.rng() < 0.5 ? 'fire' : 'flood';
    startHazard(
      sim,
      type,
      type === 'flood' ? 'poi_bridge' : sim.rng() < 0.5 ? 'poi_village' : 'poi_ruins',
    );
    w.nextHazard = sim.elapsed + 90 + sim.rng() * 60;
  }
  for (const h of [...w.hazards])
    if (sim.elapsed >= h.until) {
      w.hazards.splice(w.hazards.indexOf(h), 1);
      worldEvent(
        sim,
        h.type === 'fire' ? 'FIRE_EXTINGUISHED' : 'BRIDGE_REOPENED',
        null,
        w.pois.find((p) => p.id === h.poi),
        null,
        { hazard: h.type },
      );
    }
  for (const o of w.objects) {
    o.metadata.occupants = o.metadata.occupants.filter((id) =>
      sim.agents.some(
        (a) => a.id === id && a.alive && a.target === o.id && distance(a.position, o.position) < 2,
      ),
    );
    if (o.type === 'campfire' && o.state === 'lit') {
      o.metadata.fuel -= dt * (w.weather === 'storm' ? 20 : 1);
      if (o.metadata.fuel <= 0) {
        o.state = 'unlit';
        worldEvent(
          sim,
          'CAMPFIRE_EXTINGUISHED',
          null,
          w.pois.find((p) => p.id === o.poi),
          o,
        );
      }
    }
  }
  for (const a of sim.agents.filter((a) => a.alive)) {
    for (const h of w.hazards)
      if (distance(a.position, h.position) < h.radius)
        a.hp = Math.max(0, a.hp - dt * h.damage * (1 - shelterAt(sim, a) * 0.5));
    if (sim.elapsed >= (a.nextObservation ?? 0)) {
      observeWorld(sim, a);
      a.nextObservation = sim.elapsed + 1;
    }
  }
  for (const p of w.pois) {
    const present = sim.agents.filter((a) => a.alive && distance(a.position, p.position) < 4);
    p.occupancy = present.map((a) => a.id);
    p.resources = Object.fromEntries(
      ['food', 'water', 'medicine', 'weapon', 'wood', 'relic'].map((k) => [
        k,
        w.objects
          .filter((o) => o.poi === p.id)
          .reduce(
            (s, o) =>
              s + (o.metadata.stock[k] ?? 0) + (k === 'medicine' ? (o.metadata.charges ?? 0) : 0),
            0,
          ),
      ]),
    );
    const holders = present.filter(
      (a) => a.id === p.controller || a.alliance.includes(p.controller),
    );
    if (p.controller && !holders.length) {
      if (sim.elapsed - (p.lastHeld ?? sim.elapsed) > 8) {
        worldEvent(sim, 'POI_RELEASED', null, p, null, { controller: p.controller });
        p.controller = null;
        for (const o of w.objects.filter((o) => o.poi === p.id)) o.controller = null;
        p.controllers = [];
        p.claim = {};
        p.controlSince = null;
      }
    } else if (holders.length) p.lastHeld = sim.elapsed;
    const factions = [];
    for (const a of present) {
      let group = factions.find((g) => g.some((b) => a.alliance.includes(b.id)));
      if (!group) {
        group = [];
        factions.push(group);
      }
      group.push(a);
    }
    const previousAccess = p.access;
    p.access = factions.length > 1 ? 'contested' : p.controller ? 'friendly' : 'public';
    if (p.controller && p.access === 'contested' && previousAccess !== 'contested')
      worldEvent(
        sim,
        'POI_CONTESTED',
        present.find((a) => !p.controllers.includes(a.id)) ?? null,
        p,
        null,
        { controller: p.controller },
      );
    for (const a of present) {
      const enemy = present.some(
        (b) => b.id !== a.id && !a.alliance.includes(b.id) && relation(a, b).hostility > 0.45,
      );
      p.claim[a.id] = enemy ? 0 : (p.claim[a.id] ?? 0) + dt;
      if (p.claim[a.id] >= 10 && (!p.controller || !holders.length)) {
        p.controller = a.id;
        p.controllers = present
          .filter((b) => b.id === a.id || a.alliance.includes(b.id))
          .map((b) => b.id);
        p.controlSince = sim.elapsed;
        p.lastHeld = sim.elapsed;
        w.metrics.controls++;
        worldEvent(sim, 'POI_CONTROLLED', a, p, null, { controllers: [...p.controllers] });
        for (const o of w.objects.filter((o) => o.poi === p.id)) o.controller = a.id;
        break;
      }
    }
    for (const id of p.controllers) {
      const a = sim.agents.find((a) => a.id === id);
      if (a?.alive) {
        a.placeStats ??= {};
        a.placeStats[p.id] ??= { visits: 0, controlSeconds: 0 };
        a.placeStats[p.id].controlSeconds += dt;
      }
    }
    for (const id of Object.keys(p.claim)) if (!p.occupancy.includes(id)) delete p.claim[id];
  }
}
