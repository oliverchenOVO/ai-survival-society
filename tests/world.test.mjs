import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../core/simulation.mjs';
import { executeAction, moveAgent } from '../core/actions.mjs';
import {
  canInteract,
  performInteraction,
  getUtility,
  observeWorld,
  perceptionRadius,
  canSee,
  setWeather,
  startHazard,
  navigationWaypoint,
  knowledgeState,
  updateWorld,
} from '../core/living-world.mjs';
import { validateDecision } from '../server/llm.mjs';
import { buildFacts, publicStory, majorMoments } from '../src/story/facts.mjs';
function fixture() {
  const s = new Simulation({ seed: 7 }),
    a = s.agents[0];
  s.elapsed = 10;
  return { s, a, object: (type) => s.world.objects.find((o) => o.type === type) };
}
function act(s, a, o, action, dt = 0.25) {
  a.position = { ...o.position };
  a.action = action;
  a.target = o.id;
  o.cooldown = 0;
  return performInteraction(s, a, o, dt);
}
test('registry contracts, doors, cache depletion, occupancy and campfire finite fuel', () => {
  const { s, a, object } = fixture(),
    door = object('door');
  door.state = 'closed';
  assert.ok(act(s, a, door, 'open'));
  assert.equal(door.state, 'open');
  assert.ok(act(s, a, door, 'close'));
  assert.equal(door.state, 'closed');
  door.state = 'locked';
  act(s, a, door, 'open', 4);
  assert.equal(door.state, 'broken');
  const cache = object('container');
  let n = 0;
  while (Object.values(cache.metadata.stock).some((v) => v > 0) && n++ < 20)
    act(s, a, cache, 'search');
  assert.equal(cache.state, 'empty');
  act(s, a, cache, 'search');
  assert.equal(s.bus.log.at(-1).event, 'DISAPPOINTED_SEARCH');
  const bed = object('bed');
  a.energy = 30;
  act(s, a, bed, 'rest_at', 1);
  assert.ok(a.energy > 35);
  const b = s.agents[1];
  b.position = { ...bed.position };
  assert.equal(canInteract(s, b, bed, 'rest_at'), false);
  const fire = object('campfire');
  a.inventory.wood = 2;
  act(s, a, fire, 'use');
  assert.equal(fire.state, 'lit');
  setWeather(s, 'storm', 20);
  updateWorld(s, 5);
  assert.equal(fire.state, 'unlit');
});
test('power, medical charges, tower vision, broadcast events and legal LLM fallback', () => {
  const { s, a, object } = fixture(),
    g = object('generator'),
    med = object('medical_station');
  a.hp = 20;
  assert.equal(act(s, a, med, 'heal_at'), false);
  act(s, a, g, 'repair', 3);
  assert.equal(g.state, 'online');
  a.inventory.medicine = 0;
  const charge = med.metadata.charges;
  act(s, a, med, 'heal_at');
  assert.equal(med.metadata.charges, charge - 1);
  assert.ok(a.hp > 20);
  const tower = object('watchtower'),
    before = perceptionRadius(s, a);
  act(s, a, tower, 'occupy');
  assert.ok(perceptionRadius(s, a) > before);
  const radio = object('radio');
  act(s, a, radio, 'broadcast');
  assert.equal(s.bus.log.at(-1).event, 'BROADCAST_SENT');
  assert.throws(
    () =>
      validateDecision({ action: 'repair', target: med.id, message: '', public_reason: 'x' }, s, a),
    /world interaction/,
  );
});
test('weather, visibility blockers, knowledge stale, shelter utility and rerouting hazards', () => {
  const { s, a, object } = fixture();
  a.position = { x: 0, z: 0 };
  const day = perceptionRadius(s, a);
  s.world.timeOfDay = 'night';
  assert.ok(perceptionRadius(s, a) < day);
  setWeather(s, 'storm', 30);
  assert.ok(perceptionRadius(s, a) < day * 0.7);
  assert.equal(knowledgeState({ seenAt: 0 }, 50), 'stale');
  assert.equal(knowledgeState(null, 1), 'unknown');
  const bed = object('bed'),
    p = s.world.pois.find((p) => p.id === bed.poi);
  a.energy = 20;
  const low = getUtility(s, a, bed, p).score;
  a.energy = 100;
  assert.ok(low > getUtility(s, a, bed, p).score);
  a.position = { x: -10, z: 7 };
  assert.equal(canSee(s, a, { x: -10, z: 12 }), false);
  const waypoint = navigationWaypoint(s, a, { x: -10, z: 12 });
  assert.notDeepEqual(waypoint, { x: -10, z: 12 });
  const h = startHazard(s, 'flood', 'poi_bridge');
  a.position = { x: 0, z: 2 };
  assert.notDeepEqual(navigationWaypoint(s, a, { x: 6, z: 2 }), { x: 6, z: 2 });
  assert.equal(h.type, 'flood');
  startHazard(s, 'fire', 'poi_ruins');
  assert.equal(s.world.hazards.length, 2);
  for (let i = 0; i < 120; i++) {
    moveAgent(s, a, { x: 6, z: 2 }, 0.25);
    assert.ok(
      !(Math.abs(a.position.x - 3) < 1.6 && Math.abs(a.position.z - 2) < 1.6),
      'Agent crossed flooded bridge',
    );
  }
  assert.ok(Math.hypot(a.position.x - 6, a.position.z - 2) < 1.2);
  a.position = { x: 10, z: -10 };
  const hp = a.hp;
  updateWorld(s, 1);
  assert.ok(a.hp < hp, 'Fire must damage exposed agents');
});
test('control transfer is dwell-based; memories attach places; world save resumes exact RNG', () => {
  const { s, a } = fixture(),
    p = s.world.pois[4];
  for (const b of s.agents) b.position = { x: 26, z: 0 };
  a.position = { ...p.position };
  a.nextDecision = 100;
  s.elapsed = 11;
  updateWorld(s, 11);
  assert.equal(p.controller, a.id);
  observeWorld(s, a);
  assert.equal(a.worldKnowledge[p.id].controller, a.id);
  const b = s.agents[1];
  a.position = { x: 26, z: 0 };
  b.position = { ...p.position };
  s.elapsed = 30;
  updateWorld(s, 11);
  assert.equal(p.controller, b.id);
  b.position = { x: 26, z: 0 };
  s.elapsed = 50;
  updateWorld(s, 1);
  assert.equal(p.controller, null);
  assert.ok(s.world.objects.filter((o) => o.poi === p.id).every((o) => o.controller === null));

  const original = new Simulation({ seed: 42 });
  for (let i = 0; i < 300; i++) original.tick();
  const loaded = Simulation.fromSave(original.export());
  for (let i = 0; i < 120; i++) {
    original.tick();
    loaded.tick();
  }
  assert.deepEqual(loaded.export(), original.export());
  assert.ok(original.timeline.some((f) => f.world?.weather));
});
test('world events enter public replay, place facts and story ranking with legacy compatibility', () => {
  const { s, a, object } = fixture();
  act(s, a, object('generator'), 'repair', 3);
  for (const b of s.agents.slice(1)) s.kill(b);
  s.finish(a);
  const d = s.export();
  d.simulation_id = 'S-0000000000000000';
  d.story = buildFacts(d, { simulationId: d.simulation_id, simulationVersion: '1.5.0' });
  const pub = publicStory(d);
  assert.ok(pub.world.objects.some((o) => o.state === 'online'));
  assert.ok(pub.events.some((e) => e.event === 'GENERATOR_REPAIRED' && e.data.poi));
  assert.ok(
    majorMoments(d, 20).some(
      (m) => d.events.find((e) => e.id === m.eventId).event === 'GENERATOR_REPAIRED',
    ),
  );
  delete d.world;
  assert.equal(publicStory(d).world, null);
});
