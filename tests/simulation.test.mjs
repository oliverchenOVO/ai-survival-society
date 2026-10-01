import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, DIRECTOR_EVENTS } from '../core/simulation.mjs';
import { executeAction } from '../core/actions.mjs';
import { relation } from '../core/agents.mjs';
function run(seed, events = false) {
  const s = new Simulation({ seed });
  while (s.status === 'running' && s.elapsed < 700) {
    s.tick();
    if (events && s.elapsed === 40) s.director('food_crisis');
    if (events && s.elapsed === 80) s.director('supply_drop');
  }
  return s;
}
test('same seed and same event timings reproduce the full event log and result', () => {
  const a = run(7, true),
    b = run(7, true);
  assert.deepEqual(a.bus.log, b.bus.log);
  assert.equal(a.winner, b.winner);
  assert.deepEqual(a.agents, b.agents);
});
test('complete runs contain autonomous survival, alliances, trade, conflict, memories and a winner', () => {
  for (const seed of [7, 42, 2048, 12345, 2026, 99, 123]) {
    const s = run(seed);
    assert.equal(s.status, 'finished');
    assert.equal(s.stats().alive, 1);
    assert.ok(s.winner);
    assert.equal(s.stats().deaths, 11);
    for (const type of [
      'RESOURCE_FOUND',
      'CONVERSATION',
      'TRADE',
      'ALLIANCE_CREATED',
      'ATTACK',
      'DEATH',
      'MATCH_ENDED',
    ])
      assert.ok(s.stats().counts[type] > 0, `${seed} missing ${type}`);
    assert.ok(s.agents.every((a) => a.memory.length > 0 && a.memory.length <= 40));
    assert.equal(s.history.eventCount, s.bus.log.length);
    for (const a of s.agents) {
      assert.ok(a.hp >= 0 && a.hp <= 100);
      assert.ok(a.hunger >= 0 && a.hunger <= 100);
      assert.ok(a.energy >= 0 && a.energy <= 100);
      for (const p of Object.values(a.personality)) assert.ok(p >= 0 && p <= 1);
      for (const count of Object.values(a.inventory)) assert.ok(count >= 0);
    }
  }
  const s = run(7);
  assert.ok(s.stats().betrayals > 0);
  assert.ok(s.stats().cooperation > 0);
  assert.ok(s.stats().counts.THEFT > 0);
  assert.ok(s.stats().counts.DECEPTION > 0);
});
test('simultaneous exposure stops immediately when one survivor remains', () => {
  const s = new Simulation({ agentCount: 2 });
  s.elapsed = 600;
  for (const a of s.agents) {
    a.hp = 0.01;
    a.position = { x: 30, z: 0 };
  }
  s.tick();
  assert.equal(s.status, 'finished');
  assert.equal(s.stats().alive, 1);
  assert.ok(s.winner);
});
test('events include required structured fields and important memories affect social relationships', () => {
  const s = new Simulation();
  const [a, b] = s.agents;
  a.position = { x: 0, z: 0 };
  b.position = { x: 1, z: 0 };
  a.action = 'attack';
  a.target = b.id;
  s.elapsed = 10;
  executeAction(s, a, 0.25);
  const e = s.bus.log.at(-1);
  for (const key of [
    'timestamp',
    'actor',
    'target',
    'event',
    'position',
    'result',
    'relationship_change',
  ])
    assert.ok(key in e);
  assert.equal(e.event, 'ATTACK');
  assert.ok(relation(b, a).trust < 0);
  assert.ok(relation(b, a).fear > 0);
  assert.ok(relation(b, a).hostility > 0);
  const m = b.memory.at(-1);
  for (const key of ['who', 'what', 'when', 'importance', 'emotionalImpact']) assert.ok(key in m);
  assert.ok(m.emotionalImpact < 0);
});
test('all six Director events change environment and safe zone contracts', () => {
  const s = new Simulation();
  const inventories = s.agents.map((a) => ({ ...a.inventory }));
  s.director('food_crisis');
  assert.equal(s.effects.food_crisis, 90);
  assert.equal(s.nextResource, 6);
  const count = s.resources.length;
  s.director('supply_drop');
  assert.equal(s.resources.length, count + 9);
  s.director('storm');
  assert.equal(s.effects.storm, 60);
  s.director('rumor');
  assert.ok(s.effects.rumor);
  assert.ok(s.agents.some((a) => a.memory.some((m) => m.event === 'RUMOR')));
  s.director('treasure');
  assert.equal(s.resources.length, count + 15);
  s.director('plague');
  assert.equal(s.effects.plague, 80);
  assert.ok(s.agents.some((a) => a.infected));
  assert.deepEqual(
    s.agents.map((a) => a.inventory),
    inventories,
  ); // Director does not puppeteer actions or grant inventory.
  const radius = s.safeRadius;
  s.tick();
  assert.ok(s.safeRadius < radius);
  assert.throws(() => s.director('shell'));
});
test('pause is inert and repeated independent runs do not share state', () => {
  const s = new Simulation({ seed: 5 });
  s.status = 'paused';
  const before = JSON.stringify(s.export());
  s.tick();
  assert.equal(JSON.stringify(s.export()), before);
  const a = run(7),
    b = new Simulation({ seed: 7 });
  assert.equal(b.elapsed, 0);
  assert.equal(b.stats().alive, 12);
  assert.equal(b.bus.log.length, 1);
  assert.ok(a.bus.log.length > 1);
});
