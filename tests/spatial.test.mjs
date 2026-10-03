import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../core/simulation.mjs';
import { moveAgent, executeAction } from '../core/actions.mjs';
import {
  COLLISION_DATA,
  AGENT_RADIUS,
  walkable,
  lineClear,
  findPath,
  reserveInteraction,
  atInteractionSlot,
  revalidateSpatial,
  initializeSpatial,
  nearestLegal,
  terrainCost,
} from '../core/spatial.mjs';
import { performInteraction } from '../core/living-world.mjs';
const fixture = () => {
  const s = new Simulation({ seed: 7 });
  s.world.hazards = [];
  for (const a of s.agents) {
    a.alive = false;
    a.action = 'rest';
  }
  return s;
};
const activate = (s, i, p) => {
  const a = s.agents[i];
  a.alive = true;
  a.position = { ...p, y: 0 };
  a.energy = 100;
  a.spatial.path = [];
  a.spatial.target = null;
  return a;
};
function advance(s, agents, targets, seconds = 40) {
  for (let tick = 0; tick < seconds * 4; tick++) {
    s.elapsed += 0.25;
    revalidateSpatial(s);
    for (let i = 0; i < agents.length; i++) moveAgent(s, agents[i], targets[i], 0.25);
    for (let i = 0; i < agents.length; i++) {
      assert.ok(walkable(s, agents[i].position), 'static collision');
      for (let j = i + 1; j < agents.length; j++)
        assert.ok(
          Math.hypot(
            agents[i].position.x - agents[j].position.x,
            agents[i].position.z - agents[j].position.z,
          ) >=
            AGENT_RADIUS * 2 - 1e-7,
          'character overlap',
        );
    }
  }
}
test('versioned collision records, terrain, static furniture, wall, lake and bridge rails', () => {
  const s = fixture();
  assert.equal(COLLISION_DATA.collisionSchemaVersion, 1);
  assert.equal(COLLISION_DATA.regions.length, 9);
  for (const id of ['clinic_back', 'depot_rack1', 'deep_lake', 'bridge_rail1']) {
    const c = COLLISION_DATA.colliders.find((c) => c.id === id);
    assert.ok(c);
    assert.equal(walkable(s, c), false, id);
  }
  assert.equal(terrainCost({ x: -18, z: -10 }), 1.15);
  assert.equal(terrainCost({ x: 15, z: -12 }), 1.25);
  assert.equal(walkable(s, { x: 29, z: 0 }), false);
});
test('closed, locked, opening, open and broken door paths and wall line of fire', () => {
  const s = fixture(),
    o = s.world.objects.find((o) => o.id === 'clinic_door_0'),
    outside = { x: -3, z: 3.4 },
    inside = { x: -3, z: 4.7 };
  for (const state of ['closed', 'locked']) {
    o.state = state;
    assert.equal(lineClear(s, outside, inside, AGENT_RADIUS), false);
    assert.equal(findPath(s, outside, inside), null);
  }
  o.state = 'open';
  o.metadata.passableAt = s.elapsed + 0.6;
  assert.equal(lineClear(s, outside, inside, AGENT_RADIUS), false);
  s.elapsed += 0.7;
  assert.equal(lineClear(s, outside, inside, AGENT_RADIUS), true);
  assert.ok(findPath(s, outside, inside));
  o.state = 'broken';
  assert.equal(lineClear(s, outside, inside, AGENT_RADIUS), true);
  assert.equal(lineClear(s, { x: -7, z: 6 }, { x: -4, z: 6 }, 0, { hazards: false }), false);
});
test('indoor enter/exit, shelter, depot, bridge and smoothed outdoor navigation', () => {
  const s = fixture();
  for (const o of s.world.objects.filter((o) => o.type === 'door')) o.state = 'open';
  for (const [from, to] of [
    [
      { x: -3, z: 3.4 },
      { x: -3, z: 4.8 },
    ],
    [
      { x: -3, z: 4.8 },
      { x: -3, z: 3.4 },
    ],
    [
      { x: 9, z: 6.5 },
      { x: 9, z: 9 },
    ],
    [
      { x: 0, z: -4 },
      { x: 0, z: -1.2 },
    ],
    [
      { x: -1, z: 2 },
      { x: 7, z: 2 },
    ],
  ]) {
    const path = findPath(s, from, to);
    assert.ok(path, JSON.stringify({ from, to }));
    let p = from;
    for (const q of path) {
      assert.ok(lineClear(s, p, q, AGENT_RADIUS));
      p = q;
    }
  }
});
test('two opposing agents and four crossing agents separate without teleport', () => {
  const s = fixture(),
    a = activate(s, 0, { x: -20, z: 2 }),
    b = activate(s, 1, { x: -16, z: 2 });
  advance(
    s,
    [a, b],
    [
      { x: -16, z: 2 },
      { x: -20, z: 2 },
    ],
    20,
  );
  assert.ok(a.position.x > -16.4 && b.position.x < -19.6);
  const t = fixture(),
    agents = [
      activate(t, 0, { x: 18, z: 2 }),
      activate(t, 1, { x: 22, z: 2 }),
      activate(t, 2, { x: 20, z: 0 }),
      activate(t, 3, { x: 20, z: 4 }),
    ];
  advance(
    t,
    agents,
    [
      { x: 22, z: 2 },
      { x: 18, z: 2 },
      { x: 20, z: 4 },
      { x: 20, z: 0 },
    ],
    30,
  );
  for (let i = 0; i < 4; i++)
    assert.ok(
      Math.hypot(
        agents[i].position.x - [22, 18, 20, 20][i],
        agents[i].position.z - [2, 2, 4, 0][i],
      ) < 0.4,
    );
});
test('interaction requires reserved exact approach, facing and LOS; ownership releases on death/expiry', () => {
  const s = fixture(),
    o = s.world.objects.find((o) => o.type === 'generator'),
    a = activate(s, 0, { x: -10, z: 11 });
  a.action = 'repair';
  a.target = o.id;
  assert.equal(performInteraction(s, a, o, 0.25), false);
  const slot = reserveInteraction(s, a, o);
  assert.ok(slot);
  assert.equal(slot.state, 'reserved');
  a.position = { x: slot.x, z: slot.z, y: 0 };
  assert.equal(atInteractionSlot(s, a, o), true);
  assert.equal(slot.state, 'occupied');
  assert.deepEqual(a.spatial.facing, slot.facing);
  assert.equal(performInteraction(s, a, o, 0.25), true);
  a.alive = false;
  revalidateSpatial(s);
  assert.equal(slot.state, 'free');
});
test('five clinic patients cannot reserve one slot; queues resolve by expiry or retarget', () => {
  const s = fixture(),
    o = s.world.objects.find((o) => o.type === 'medical_station');
  const agents = Array.from({ length: 5 }, (_, i) => activate(s, i, { x: -3 + i * 0.8, z: 1 }));
  for (const a of agents) {
    a.action = 'heal_at';
    a.target = o.id;
    a.hp = 50;
  }
  assert.ok(reserveInteraction(s, agents[0], o));
  for (const a of agents.slice(1)) assert.equal(reserveInteraction(s, a, o, 0.25), null);
  assert.equal(
    s.world.spatial.slots.filter((x) => x.objectId === o.id && x.state !== 'free').length,
    1,
  );
  agents[0].target = null;
  revalidateSpatial(s);
  assert.ok(reserveInteraction(s, agents[1], o));
});
test('twelve-agent depot density remains separated and eventually gets every search slot', () => {
  const s = fixture(),
    o = s.world.objects.find((o) => o.id === 'depot_container_0'),
    agents = Array.from({ length: 12 }, (_, i) => activate(s, i, { x: -5 + i * 0.8, z: -5 })),
    visited = new Set();
  for (const a of agents) {
    a.action = 'search';
    a.target = o.id;
  }
  for (let t = 0; t < 1200 && visited.size < 12; t++) {
    s.elapsed += 0.25;
    revalidateSpatial(s);
    for (const a of agents) {
      if (visited.has(a.id)) {
        moveAgent(s, a, { x: -7 - a.index * 0.7, z: 0 }, 0.25);
        continue;
      }
      const slot = reserveInteraction(s, a, o, 0.25);
      if (slot) {
        moveAgent(s, a, slot, 0.25);
        if (atInteractionSlot(s, a, o)) {
          visited.add(a.id);
          a.target = null;
          revalidateSpatial(s);
        }
      }
    }
    for (let i = 0; i < agents.length; i++)
      for (let j = i + 1; j < agents.length; j++)
        assert.ok(
          Math.hypot(
            agents[i].position.x - agents[j].position.x,
            agents[i].position.z - agents[j].position.z,
          ) >=
            0.7 - 1e-7,
        );
  }
  if (visited.size !== 12)
    console.log(
      agents.map((a) => ({
        id: a.id,
        visited: visited.has(a.id),
        position: a.position,
        path: a.spatial.path,
        slot: a.spatial.slotId,
        portal: a.spatial.nextPortal,
        retries: a.spatial.retries,
      })),
    );
  assert.equal(visited.size, 12);
});
test('checkpoint preserves deterministic future and legacy migration is explicit', () => {
  const s = new Simulation({ seed: 11 });
  for (let i = 0; i < 100; i++) s.tick();
  const restored = Simulation.fromSave(s.export());
  assert.deepEqual(restored.world.spatial, s.world.spatial);
  for (let i = 0; i < 20; i++) {
    s.tick();
    restored.tick();
  }
  assert.deepEqual(restored.snapshot(), s.snapshot());
  const old = s.export();
  delete old.world.spatial;
  for (const a of old.agents) delete a.spatial;
  old.agents[0].position = { x: -14, z: -5 };
  const migrated = Simulation.fromSave(old);
  assert.ok(migrated.world.spatial.migrations.length);
  assert.ok(walkable(migrated, migrated.agents[0].position));
});

test('bed capacity, dual generator slots and attack interruption remain authoritative', () => {
  const s = fixture(),
    a = activate(s, 0, { x: 18, z: 2 }),
    b = activate(s, 1, { x: 20, z: 2 }),
    c = activate(s, 2, { x: 22, z: 2 });
  const bed = s.world.objects.find((o) => o.type === 'bed'),
    generator = s.world.objects.find((o) => o.type === 'generator');
  a.action = b.action = 'rest_at';
  a.target = b.target = bed.id;
  assert.ok(reserveInteraction(s, a, bed));
  assert.equal(reserveInteraction(s, b, bed), null);
  a.target = generator.id;
  a.action = 'repair';
  revalidateSpatial(s);
  b.target = generator.id;
  b.action = 'repair';
  c.target = generator.id;
  c.action = 'repair';
  const first = reserveInteraction(s, a, generator),
    second = reserveInteraction(s, b, generator);
  assert.ok(first && second);
  assert.notEqual(first.id, second.id);
  assert.equal(reserveInteraction(s, c, generator), null);
  s.event('ATTACK', c, a, 'ATTACK', { damage: 1 });
  assert.equal(first.state, 'free');
  assert.ok(reserveInteraction(s, c, generator));
});

test('abstract goal inside furniture reaches its legal projection without endless replanning', () => {
  const s = fixture(),
    a = activate(s, 0, { x: -2, z: -3 });
  advance(s, [a], [{ x: 0, z: 0 }], 20);
  const replans = s.world.spatial.metrics.replans;
  advance(s, [a], [{ x: 0, z: 0 }], 10);
  assert.equal(s.world.spatial.metrics.replans, replans);
  assert.ok(walkable(s, a.position));
});

test('opposing clinic doorway traffic yields, separates and releases short reservations', () => {
  const s = fixture();
  const door = s.world.objects.find((o) => o.id === 'clinic_door_0');
  door.state = 'open';
  const a = activate(s, 0, nearestLegal(s, { x: -3, z: 3.2 })),
    b = activate(s, 1, { x: -3, z: 4.8 });
  advance(s, [a, b], [{ x: -4, z: 5 }, nearestLegal(s, { x: -3, z: 3.2 })], 90);
  assert.ok(Math.hypot(a.position.x + 4, a.position.z - 5) < 0.25, JSON.stringify(a.position));
  assert.ok(Math.hypot(b.position.x + 3, b.position.z - 3.2) < 0.25, JSON.stringify(b.position));
  for (const portal of s.world.spatial.portals)
    assert.ok(portal.reservations.length <= portal.capacity);
  s.elapsed += 2;
  revalidateSpatial(s);
  assert.ok(s.world.spatial.portals.every((p) => p.reservations.length === 0));
});
