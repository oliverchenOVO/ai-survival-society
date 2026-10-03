import geometry from '../public/assets/world-collision.json' with { type: 'json' };
import { terrainHeight } from './world.mjs';
export const COLLISION_DATA = geometry;
export const AGENT_RADIUS = 0.35;
const STEP = 0.5,
  SIZE = 113,
  MIN = -28,
  caches = new WeakMap();
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const key = (x, z) => z * SIZE + x;
const point = (n) => ({ x: MIN + (n % SIZE) * STEP, z: MIN + Math.floor(n / SIZE) * STEP });
const cell = (p) =>
  key(
    Math.max(0, Math.min(SIZE - 1, Math.round((p.x - MIN) / STEP))),
    Math.max(0, Math.min(SIZE - 1, Math.round((p.z - MIN) / STEP))),
  );
const sq = (x) => x * x;
export function segmentDistance(a, b, p) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + t * dx - p.x, a.z + t * dz - p.z);
}
export function intersects(a, b, c, pad = 0) {
  if (c.type === 'circle') return segmentDistance(a, b, c) < c.radius + pad - 1e-7;
  let lo = 0,
    hi = 1;
  for (const axis of ['x', 'z']) {
    const half = (axis === 'x' ? c.width : c.depth) / 2 + pad,
      d = b[axis] - a[axis],
      min = c[axis] - half,
      max = c[axis] + half;
    if (Math.abs(d) < 1e-9) {
      if (a[axis] <= min || a[axis] >= max) return false;
    } else {
      let t1 = (min - a[axis]) / d,
        t2 = (max - a[axis]) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      lo = Math.max(lo, t1);
      hi = Math.min(hi, t2);
      if (lo > hi) return false;
    }
  }
  return lo < hi - 1e-9 && hi > 1e-9 && lo < 1 - 1e-9;
}
class SpatialHash {
  constructor(shapes) {
    this.map = new Map();
    for (const c of shapes) {
      const rx = c.radius ?? c.width / 2,
        rz = c.radius ?? c.depth / 2;
      for (let x = Math.floor((c.x - rx) / 4); x <= Math.floor((c.x + rx) / 4); x++)
        for (let z = Math.floor((c.z - rz) / 4); z <= Math.floor((c.z + rz) / 4); z++) {
          const k = x + ',' + z;
          if (!this.map.has(k)) this.map.set(k, []);
          this.map.get(k).push(c);
        }
    }
  }
  query(a, b = a, pad = 0) {
    const set = new Set();
    for (
      let x = Math.floor((Math.min(a.x, b.x) - pad) / 4);
      x <= Math.floor((Math.max(a.x, b.x) + pad) / 4);
      x++
    )
      for (
        let z = Math.floor((Math.min(a.z, b.z) - pad) / 4);
        z <= Math.floor((Math.max(a.z, b.z) + pad) / 4);
        z++
      )
        for (const c of this.map.get(x + ',' + z) ?? []) set.add(c);
    return [...set];
  }
}
export function collisionShapes(sim, hazards = true) {
  return [
    ...geometry.colliders,
    ...sim.world.objects
      .filter(
        (o) =>
          o.type === 'door' &&
          (!['open', 'broken'].includes(o.state) || (o.metadata.passableAt ?? 0) > sim.elapsed),
      )
      .map((o) => ({
        id: o.id,
        type: 'box',
        ...o.position,
        width: 1.7,
        depth: 0.13,
        height: 2,
        kind: 'door',
      })),
    ...(hazards
      ? sim.world.hazards.map((h) => ({
          id: h.id,
          type: 'circle',
          ...h.position,
          radius: h.radius + 0.1,
          kind: h.type,
          height: 0,
        }))
      : []),
  ];
}
function signature(sim) {
  return (
    sim.world.objects
      .filter((o) => o.type === 'door')
      .map((o) => o.id + ':' + o.state + ':' + ((o.metadata.passableAt ?? 0) > sim.elapsed))
      .join('|') +
    '|' +
    sim.world.hazards.map((h) => h.id).join('|')
  );
}
function cache(sim) {
  const sig = signature(sim);
  let c = caches.get(sim);
  if (c?.signature === sig) return c;
  const shapes = collisionShapes(sim),
    index = new SpatialHash(shapes);
  c = {
    signature: sig,
    index,
    shapes,
    legal: new Uint8Array(SIZE * SIZE),
    profile: { pathTimes: [], nodes: [], avoidanceMs: 0, calls: 0 },
  };
  if (caches.has(sim)) c.profile = caches.get(sim).profile;
  caches.set(sim, c);
  for (let n = 0; n < c.legal.length; n++)
    c.legal[n] = Number(walkable(sim, point(n), AGENT_RADIUS, c));
  c.components = new Int32Array(SIZE * SIZE).fill(-1);
  let component = 0;
  for (let n = 0; n < c.legal.length; n++)
    if (c.legal[n] && c.components[n] === -1) {
      const queue = [n];
      c.components[n] = component;
      for (let i = 0; i < queue.length; i++) {
        const id = queue[i],
          p = point(id);
        for (const offset of [1, -1, SIZE, -SIZE]) {
          const j = id + offset;
          if (
            j < 0 ||
            j >= c.legal.length ||
            !c.legal[j] ||
            c.components[j] !== -1 ||
            Math.abs((j % SIZE) - (id % SIZE)) > 1
          )
            continue;
          const q = point(j);
          if (c.index.query(p, q, AGENT_RADIUS).some((s) => intersects(p, q, s, AGENT_RADIUS)))
            continue;
          c.components[j] = component;
          queue.push(j);
        }
      }
      component++;
    }
  return c;
}
function slopeAllowed(p) {
  const dx = (terrainHeight(p.x + 0.15, p.z) - terrainHeight(p.x - 0.15, p.z)) / 0.3,
    dz = (terrainHeight(p.x, p.z + 0.15) - terrainHeight(p.x, p.z - 0.15)) / 0.3;
  if (Math.hypot(dx, dz) <= 1.15) return true;
  return (
    geometry.verticalRoutes.some((r) =>
      r.nodes.some((n, i) => i && segmentDistance(r.nodes[i - 1], n, p) < r.width),
    ) || dist(p, { x: 2, z: -19 }) < 3
  );
}
export function walkable(sim, p, radius = AGENT_RADIUS, c = null) {
  if (
    !p ||
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    Math.hypot(p.x, p.z) > 28 - radius ||
    !slopeAllowed(p)
  )
    return false;
  const candidates = c ? c.index.query(p, p, radius) : collisionShapes(sim);
  return !candidates.some((s) => intersects(p, p, s, radius));
}
export function lineClear(
  sim,
  a,
  b,
  radius = 0,
  { hazards = true, ignoreObject = null, vision = false } = {},
) {
  if (radius && (!walkable(sim, b, radius) || Math.hypot(a.x, a.z) > 28 - radius)) return false;
  const c = cache(sim);
  return !c.index
    .query(a, b, radius)
    .some(
      (s) =>
        (hazards || !['fire', 'flood'].includes(s.kind)) &&
        !(vision && s.kind === 'equipment') &&
        s.id !== ignoreObject &&
        !(
          radius &&
          ['fire', 'flood'].includes(s.kind) &&
          dist(a, s) < s.radius + radius &&
          dist(b, s) > dist(a, s)
        ) &&
        intersects(a, b, s, radius),
    );
}
export function nearestLegal(sim, p, radius = AGENT_RADIUS) {
  if (walkable(sim, p, radius)) return { ...p };
  for (let ring = 1; ring < 150; ring++) {
    const r = ring * 0.2;
    for (let n = 0; n < 32; n++) {
      const a = (n * Math.PI) / 16,
        q = { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r };
      if (walkable(sim, q, radius)) return q;
    }
  }
  throw new Error('No legal spatial spawn');
}
export function regionAt(p) {
  return (
    geometry.regions
      .filter((r) => r.id !== 'outdoor')
      .find(
        (r) =>
          p.x >= r.polygon[0][0] &&
          p.x <= r.polygon[1][0] &&
          p.z >= r.polygon[0][1] &&
          p.z <= r.polygon[2][1],
      )?.id ?? 'outdoor'
  );
}
export function terrainCost(p) {
  let cost = 1;
  for (const t of geometry.terrainZones)
    if (t.id !== 'grass' && dist(p, t) < t.radius) cost = t.cost;
  return cost;
}
class Heap {
  constructor() {
    this.a = [];
  }
  push(value) {
    let i = this.a.length;
    this.a.push(value);
    while (i) {
      const p = (i - 1) >> 1;
      if (this.a[p][0] < value[0] || (this.a[p][0] === value[0] && this.a[p][1] < value[1])) break;
      this.a[i] = this.a[p];
      i = p;
    }
    this.a[i] = value;
  }
  pop() {
    const first = this.a[0],
      last = this.a.pop();
    if (this.a.length) {
      let i = 0;
      while (i * 2 + 1 < this.a.length) {
        let j = i * 2 + 1;
        if (
          j + 1 < this.a.length &&
          (this.a[j + 1][0] < this.a[j][0] ||
            (this.a[j + 1][0] === this.a[j][0] && this.a[j + 1][1] < this.a[j][1]))
        )
          j++;
        if (last[0] < this.a[j][0] || (last[0] === this.a[j][0] && last[1] < this.a[j][1])) break;
        this.a[i] = this.a[j];
        i = j;
      }
      this.a[i] = last;
    }
    return first;
  }
}
export function findPath(sim, from, to, { smooth = true } = {}) {
  const started = performance.now(),
    c = cache(sim);
  c.profile.calls++;
  const target = walkable(sim, to) ? to : nearestLegal(sim, to);
  let nodes = 0;
  const finish = (path) => {
    c.profile.pathTimes.push(performance.now() - started);
    c.profile.nodes.push(nodes);
    if (c.profile.pathTimes.length > 4096) {
      c.profile.pathTimes.shift();
      c.profile.nodes.shift();
    }
    return path;
  };
  if (lineClear(sim, from, target, AGENT_RADIUS)) return finish([{ ...target }]);
  if (
    !walkable(sim, from) &&
    sim.world.hazards.some((h) => dist(from, h.position) < h.radius + AGENT_RADIUS)
  ) {
    const exit = nearestLegal(sim, from);
    const onward = findPath(sim, exit, target, { smooth });
    return finish(onward ? [exit, ...onward] : null);
  }
  const gridNode = (p) => {
    const initial = cell(p);
    if (c.legal[initial] && lineClear(sim, p, point(initial), AGENT_RADIUS)) return initial;
    const near = [];
    for (let x = -3; x <= 3; x++)
      for (let z = -3; z <= 3; z++) {
        const n = initial + x + z * SIZE;
        if (
          n >= 0 &&
          n < c.legal.length &&
          c.legal[n] &&
          dist(point(n), p) < 2 &&
          lineClear(sim, p, point(n), AGENT_RADIUS)
        )
          near.push(n);
      }
    return near.sort((a, b) => dist(point(a), p) - dist(point(b), p) || a - b)[0];
  };
  const start = gridNode(from),
    end = gridNode(target);
  if (start === undefined || end === undefined || c.components[start] !== c.components[end])
    return finish(null);
  const g = new Float64Array(SIZE * SIZE).fill(Infinity),
    prev = new Int32Array(SIZE * SIZE).fill(-1),
    done = new Uint8Array(SIZE * SIZE),
    heap = new Heap();
  g[start] = 0;
  heap.push([dist(from, target) * 0.9, start]);
  while (heap.a.length) {
    const [, id] = heap.pop();
    if (done[id]) continue;
    done[id] = 1;
    nodes++;
    if (id === end) break;
    const p = point(id),
      cx = id % SIZE,
      cz = Math.floor(id / SIZE);
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ]) {
      const x = cx + dx,
        z = cz + dz;
      if (x < 0 || z < 0 || x >= SIZE || z >= SIZE) continue;
      const n = key(x, z);
      if (done[n] || !c.legal[n]) continue;
      const q = point(n);
      if (c.index.query(p, q, AGENT_RADIUS).some((s) => intersects(p, q, s, AGENT_RADIUS)))
        continue;
      const crowd = sim.agents.filter((a) => a.alive && dist(a.position, q) < 1.2).length * 0.025;
      const cost = g[id] + dist(p, q) * (terrainCost(q) + crowd);
      if (cost < g[n] - 1e-9) {
        g[n] = cost;
        prev[n] = id;
        heap.push([cost + dist(q, target) * 0.9, n]);
      }
    }
  }
  if (!done[end]) return finish(null);
  let n = end,
    path = [];
  while (n !== start && n !== -1) {
    path.push(point(n));
    n = prev[n];
  }
  path.reverse();
  path.push({ ...target });
  if (smooth) {
    const out = [];
    let p = from;
    for (let i = 0; i < path.length;) {
      let j = i;
      while (
        j + 1 < path.length &&
        lineClear(sim, p, path[j + 1], AGENT_RADIUS) &&
        terrainCost(path[j + 1]) <= 1.25
      )
        j++;
      out.push(path[j]);
      p = path[j];
      i = j + 1;
    }
    path = out;
  }
  return finish(path);
}
export function pathDistance(sim, a, target) {
  const path = findPath(sim, a.position, target);
  return path ? path.reduce((s, p, i) => s + dist(i ? path[i - 1] : a.position, p), 0) : Infinity;
}
export function initializeSpatial(sim, { migration = false } = {}) {
  caches.delete(sim);
  const existing = sim.world.spatial;
  sim.world.spatial ??= {
    schemaVersion: 1,
    collisionSchemaVersion: geometry.collisionSchemaVersion,
    slots: structuredClone(geometry.interactionSlots).map((s) => ({
      ...s,
      state: 'free',
      agentId: null,
      expiresAt: 0,
    })),
    portals: geometry.portals.map((p) => ({ ...p, reservations: [] })),
    metrics: Object.fromEntries(
      [
        'pathLength',
        'replans',
        'stuckEvents',
        'collisionsPrevented',
        'portalWaitTime',
        'slotWaitTime',
        'deadlockResolutions',
        'interactionApproachFailures',
        'unreachableTargets',
        'averagePathEfficiency',
        'completedPaths',
        'plannedDistance',
        'directDistance',
      ].map((k) => [k, 0]),
    ),
    migrations: [],
  };
  for (const o of sim.world.objects) {
    o.capacity = geometry.interactionSlots.filter((s) => s.objectId === o.id).length || o.capacity;
    if (o.poi === 'poi_lake' && o.type === 'container') o.position = { x: -14, z: -8.8 };
    if (o.id === 'ruins_container_1') o.position = { x: 11, z: -10, y: 1.6 };
  }
  for (const a of sim.agents) {
    a.collisionRadius = AGENT_RADIUS;
    a.socialRadius = sim.config.socialRadius;
    a.interactionRadius = 0.18;
    a.spatial ??= {
      path: [],
      target: null,
      region: regionAt(a.position),
      slotId: null,
      signature: null,
      stuckTimer: 0,
      retries: 0,
      neighbors: [],
      nextPortal: null,
      lastProgress: sim.elapsed,
    };
    if (!existing && !walkable(sim, a.position)) {
      const before = { ...a.position };
      a.position = nearestLegal(sim, a.position);
      if (migration)
        sim.world.spatial.migrations.push({
          agentId: a.id,
          from: before,
          to: { ...a.position },
          reason: 'v1.6 save has no spatial checkpoint',
        });
    }
  }
  if (migration && !existing)
    sim.world.spatial.migrations.push({
      reason: 'Added spatial checkpoint with explicit spawn validation',
      at: sim.elapsed,
    });
  if (!existing)
    for (const r of sim.resources)
      if (!walkable(sim, r.position)) r.position = nearestLegal(sim, r.position);
  revalidateSpatial(sim);
}
export function releaseSlot(sim, a) {
  const s = sim.world.spatial;
  if (!s) return;
  for (const slot of s.slots)
    if (slot.agentId === a.id) {
      slot.state = 'free';
      slot.agentId = null;
      slot.expiresAt = 0;
    }
  a.spatial.slotId = null;
}
export function revalidateSpatial(sim) {
  if (sim._spatialTickElapsed !== sim.elapsed) {
    sim._spatialTickElapsed = sim.elapsed;
    sim._spatialTickPositions = new Map(sim.agents.map((a) => [a.id, { ...a.position }]));
  }
  const s = sim.world.spatial;
  if (!s) return;
  for (const slot of s.slots) {
    const a = sim.agents.find((a) => a.id === slot.agentId);
    if (!a?.alive || a.target !== slot.objectId || slot.expiresAt <= sim.elapsed) {
      slot.state = 'free';
      slot.agentId = null;
      slot.expiresAt = 0;
    }
  }
  for (const p of s.portals) {
    const door = sim.world.objects.find((o) => o.id === p.objectId);
    p.state = door
      ? (door.metadata.passableAt ?? 0) > sim.elapsed
        ? 'opening'
        : door.state
      : 'open';
    p.reservations = p.reservations.filter(
      (r) => r.until > sim.elapsed && sim.agents.some((a) => a.id === r.agentId && a.alive),
    );
  }
  for (const a of sim.agents) {
    if (a.spatial.slotId && !s.slots.some((s) => s.id === a.spatial.slotId && s.agentId === a.id))
      a.spatial.slotId = null;
    a.spatial.region = regionAt(a.position);
    if (
      a.spatial.path.some(
        (p, i) => !lineClear(sim, i ? a.spatial.path[i - 1] : a.position, p, AGENT_RADIUS),
      )
    )
      a.spatial.signature = null;
  }
}
export function reserveInteraction(sim, a, o, dt = 0) {
  const state = sim.world.spatial;
  if (!state) return o.position;
  let slot = state.slots.find((s) => s.agentId === a.id && s.objectId === o.id);
  if (!slot) {
    releaseSlot(sim, a);
    const available = state.slots
      .filter((s) => s.objectId === o.id && s.state === 'free')
      .sort((x, y) => dist(a.position, x) - dist(a.position, y) || x.id.localeCompare(y.id));
    // Only reserve a door approach on the current side of its solid leaf.
    slot = available.find(
      (s) => o.type !== 'door' || (s.z - o.position.z) * (a.position.z - o.position.z) >= 0,
    );
    if (!slot) {
      state.metrics.slotWaitTime += dt;
      a.spatial.waitingFor = o.id;
      if (sim.elapsed - (a.spatial.waitSince ??= sim.elapsed) > 4) {
        a.nextDecision = sim.elapsed;
        a.spatial.waitSince = sim.elapsed;
      }
      return null;
    }
    slot.state = 'reserved';
    slot.agentId = a.id;
    slot.expiresAt = sim.elapsed + 16;
    a.spatial.slotId = slot.id;
    a.spatial.waitSince = null;
  }
  a.spatial.waitingFor = null;
  return slot;
}
export function atInteractionSlot(sim, a, o) {
  const slot = sim.world.spatial?.slots.find((s) => s.objectId === o.id && s.agentId === a.id);
  if (!slot || dist(a.position, slot) > 0.18 || Math.abs((a.position.y ?? 0) - (slot.y ?? 0)) > 0.2)
    return false;
  if (!lineClear(sim, a.position, o.position, 0, { hazards: false, ignoreObject: o.id }))
    return false;
  slot.state = 'occupied';
  slot.expiresAt = sim.elapsed + 5;
  a.spatial.facing = slot.facing;
  return true;
}
function portalPermit(sim, a, from, to, dt) {
  for (const p of sim.world.spatial.portals) {
    if (segmentDistance(from, to, p) > p.width / 2 + 0.15 || dist(from, p) > 1.5) continue;
    // A yielding agent must be allowed to retreat away from a contested throat.
    // Capacity governs entry/crossing, never a safe movement back into its own room.
    if (dist(to, p) > dist(from, p) + 0.001) continue;
    a.spatial.nextPortal = p.id;
    const own = p.reservations.find((r) => r.agentId === a.id);
    if (own) {
      own.until = sim.elapsed + 1;
      continue;
    }
    if (p.reservations.length >= p.capacity) {
      sim.world.spatial.metrics.portalWaitTime += dt;
      return false;
    }
    const contenders = sim.agents
      .filter((b) => b.alive && dist(b.position, p) < 1.3 && b.spatial.path.length)
      .sort((b, c) => dist(b.position, p) - dist(c.position, p) || b.id.localeCompare(c.id));
    if (contenders.length && contenders[0].id !== a.id) {
      sim.world.spatial.metrics.portalWaitTime += dt;
      return false;
    }
    p.reservations.push({ agentId: a.id, until: sim.elapsed + 1 });
  }
  return true;
}
export function moveSpatial(sim, a, destination, dt, speed) {
  const s = a.spatial,
    m = sim.world.spatial.metrics,
    c = cache(sim),
    started = performance.now();
  if (
    s.failedTarget &&
    sim.elapsed < s.failedTarget.until &&
    dist(s.failedTarget, destination) < 0.65
  )
    return false;
  const slot = sim.world.spatial.slots.find((x) => x.id === s.slotId && x.agentId === a.id);
  const vertical =
    (slot && geometry.verticalRoutes.find((r) => r.objectId === slot.objectId)) ||
    (destination.y > 0.2 &&
      geometry.verticalRoutes.find((r) => dist(r.nodes.at(-1), destination) < 0.3));
  const baseTarget = vertical ? vertical.nodes[0] : destination;
  if (
    s.signature !== c.signature &&
    s.path.length &&
    s.path.every((p, i) => lineClear(sim, i ? s.path[i - 1] : a.position, p, AGENT_RADIUS))
  )
    s.signature = c.signature;
  if (
    !s.target ||
    dist(s.target, destination) > 0.65 ||
    s.signature !== c.signature ||
    (!s.path.length && dist(a.position, destination) > 0.2 && sim.elapsed >= (s.retryAt ?? 0))
  ) {
    const departure =
      (a.position.y ?? 0) > 0.2 &&
      !vertical &&
      geometry.verticalRoutes.find((r) => dist(a.position, r.nodes.at(-1)) < 0.5);
    s.path = departure
      ? [
          ...departure.nodes.slice().reverse().slice(1),
          ...(findPath(sim, departure.nodes[0], baseTarget) ?? []),
        ]
      : (findPath(sim, a.position, baseTarget) ?? []);
    if (vertical && s.path.length) s.path.push(...vertical.nodes.slice(1));
    s.target = { ...destination };
    s.signature = c.signature;
    s.retryAt = sim.elapsed + 2;
    m.replans++;
    if (!s.path.length) {
      m.unreachableTargets++;
      s.retries++;
      if (s.retries > 2) {
        releaseSlot(sim, a);
        a.nextDecision = sim.elapsed;
        s.failedTarget = { ...destination, until: sim.elapsed + 8 };
        s.target = null;
        s.retries = 0;
      }
      return false;
    }
    m.plannedDistance += s.path.reduce(
      (sum, p, i) => sum + dist(i ? s.path[i - 1] : a.position, p),
      0,
    );
    m.directDistance += dist(a.position, destination);
  }
  while (s.path.length && dist(a.position, s.path[0]) < 0.08) s.path.shift();
  if (!s.path.length) {
    m.completedPaths++;
    m.averagePathEfficiency = m.plannedDistance ? m.directDistance / m.plannedDistance : 1;
    return dist(a.position, destination) < 0.2;
  }
  const target = s.path[0],
    d = dist(a.position, target),
    step = Math.min(d, (speed * dt) / terrainCost(a.position));
  const dx = (target.x - a.position.x) / (d || 1),
    dz = (target.z - a.position.z) / (d || 1),
    preferred = { x: a.position.x + dx * step, z: a.position.z + dz * step };
  const neighbors = sim.agents.filter(
    (b) => b.id !== a.id && b.alive && dist(a.position, b.position) < 2.2 + step,
  );
  s.neighbors = neighbors.map((b) => b.id);
  const safe = (q) =>
    lineClear(sim, a.position, q, a.collisionRadius) &&
    !neighbors.some((b) => {
      const old = sim._spatialTickPositions?.get(b.id) ?? b.position;
      return (
        segmentDistance(
          { x: a.position.x - old.x, z: a.position.z - old.z },
          { x: q.x - b.position.x, z: q.z - b.position.z },
          { x: 0, z: 0 },
        ) <
        a.collisionRadius + b.collisionRadius - 1e-7
      );
    });
  let next = null;
  const throat = sim.world.spatial.portals.find(
    (p) => dist(a.position, p) < 1.6 && neighbors.some((b) => dist(b.position, p) < 1.6),
  );
  if (throat) {
    const order = [a, ...neighbors.filter((b) => dist(b.position, throat) < 1.6)].sort(
      (b, c) => dist(b.position, throat) - dist(c.position, throat) || b.id.localeCompare(c.id),
    );
    if (order[0].id !== a.id && (s.yieldUntil ?? 0) < sim.elapsed) {
      s.yieldUntil = sim.elapsed + 1.5;
      s.yieldPoint = {
        x: a.position.x + (a.position.x - throat.x) * 2,
        z: a.position.z + (a.position.z - throat.z) * 2,
      };
      m.deadlockResolutions++;
    }
  }
  if ((s.yieldUntil ?? 0) > sim.elapsed) {
    const d = dist(a.position, s.yieldPoint) || 1;
    const q = {
      x: a.position.x + ((s.yieldPoint.x - a.position.x) / d) * step,
      z: a.position.z + ((s.yieldPoint.z - a.position.z) / d) * step,
    };
    if (safe(q)) next = q;
  }
  if (!next && portalPermit(sim, a, a.position, preferred, dt) && safe(preferred)) next = preferred;
  else if (!next) {
    m.collisionsPrevented++;
    const side = a.index % 2 ? 1 : -1;
    for (const angle of [
      side * 0.65,
      -side * 0.65,
      side * 1.2,
      -side * 1.2,
      (side * Math.PI) / 2,
      (-side * Math.PI) / 2,
    ]) {
      const q = {
        x: a.position.x + (dx * Math.cos(angle) - dz * Math.sin(angle)) * step * 0.8,
        z: a.position.z + (dx * Math.sin(angle) + dz * Math.cos(angle)) * step * 0.8,
      };
      if (safe(q) && portalPermit(sim, a, a.position, q, dt)) {
        next = q;
        break;
      }
    }
  }
  if (next) {
    const moved = dist(a.position, next);
    m.pathLength += moved;
    const fraction = step ? moved / d : 0;
    const y = (a.position.y ?? 0) + ((target.y ?? 0) - (a.position.y ?? 0)) * Math.min(1, fraction);
    a.position = { ...next, y };
    s.region = regionAt(next);
    s.stuckTimer = moved < 0.02 ? s.stuckTimer + dt : 0;
    if (moved >= 0.02) {
      s.lastProgress = sim.elapsed;
      s.retries = 0;
    }
  } else s.stuckTimer += dt;
  if (s.stuckTimer >= 3) {
    m.stuckEvents++;
    m.deadlockResolutions++;
    s.stuckTimer = 0;
    s.retries++;
    s.signature = null;
    s.retryAt = sim.elapsed + 0.5;
    if (s.retries >= 3) {
      releaseSlot(sim, a);
      s.path = [];
      s.target = null;
      a.nextDecision = sim.elapsed;
    }
  }
  c.profile.avoidanceMs += performance.now() - started;
  return dist(a.position, destination) < 0.18;
}
export function spatialProfile(sim) {
  const p = cache(sim).profile,
    sorted = [...p.pathTimes].sort((a, b) => a - b);
  return {
    pathfindingCalls: p.calls,
    averageAStarNodes: p.nodes.reduce((a, b) => a + b, 0) / (p.nodes.length || 1),
    p95PathMs: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    avoidanceMs: p.avoidanceMs,
  };
}
