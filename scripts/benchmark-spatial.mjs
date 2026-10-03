import { Simulation } from '../core/simulation.mjs';
import { walkable, spatialProfile } from '../core/spatial.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const performanceRuns = [];
const benchmarkStart = performance.now();
const golden = process.argv.includes('--update'),
  report = {
    version: '1.7.0',
    method:
      'Utility-only, no Director, primary 1–50 + holdout 1001–1050; hash verifies events, agents, world and ending',
    cohorts: [],
  };
for (const [name, start] of [
  ['primary', 1],
  ['holdout', 1001],
]) {
  const runs = [];
  const started = performance.now();
  for (let seed = start; seed < start + 50; seed++) {
    const s = new Simulation({ seed });
    while (s.status === 'running' && s.elapsed < 900) {
      s.tick();
      const alive = s.agents.filter((a) => a.alive);
      for (let i = 0; i < alive.length; i++) {
        const a = alive[i];
        assert.ok(
          walkable(s, a.position) ||
            s.world.hazards.some(
              (h) =>
                Math.hypot(a.position.x - h.position.x, a.position.z - h.position.z) <
                h.radius + 0.45,
            ),
          'Static penetration seed ' + seed,
        );
        for (let j = i + 1; j < alive.length; j++)
          assert.ok(
            Math.hypot(a.position.x - alive[j].position.x, a.position.z - alive[j].position.z) >=
              0.7 - 1e-7,
            'Agent overlap seed ' + seed,
          );
      }
      const ids = s.world.spatial.slots.filter((slot) => slot.agentId).map((slot) => slot.agentId);
      assert.equal(ids.length, new Set(ids).size, 'Multiple slots per agent');
    }
    assert.ok(s.world.spatial.metrics.stuckEvents < 100, 'Excess stuck seed ' + seed);
    assert.ok(s.world.spatial.metrics.replans < 2000, 'Replan storm seed ' + seed);
    assert.equal(s.status, 'finished');
    performanceRuns.push({ seed, simulationSeconds: s.elapsed, ...spatialProfile(s) });
    if ((seed - start + 1) % 10 === 0)
      console.log('PASS spatial seeds', name, seed - start + 1, '/ 50');
    const counts = s.stats().counts;
    runs.push({
      seed,
      winner: s.winner,
      extinction: !s.winner,
      duration: s.elapsed,
      trades: counts.TRADE ?? 0,
      alliances: counts.ALLIANCE_CREATED ?? 0,
      betrayals: counts.BETRAYAL ?? 0,
      combat: counts.ATTACK ?? 0,
      campfires: counts.CAMPFIRE_LIT ?? 0,
      doorsOpened: (counts.DOOR_OPENED ?? 0) + (counts.DOOR_FORCED ?? 0),
      socialEvents: s.bus.log.filter((e) =>
        [
          'TRADE',
          'ALLIANCE_CREATED',
          'BETRAYAL',
          'ATTACK',
          'COOPERATION',
          'THEFT',
          'DECEPTION',
        ].includes(e.event),
      ).length,
      hazards: (counts.FIRE_STARTED ?? 0) + (counts.BRIDGE_BLOCKED ?? 0),
      ...s.world.metrics,
      ...s.world.spatial.metrics,
      hash: createHash('sha256')
        .update(
          JSON.stringify({ events: s.bus.log, agents: s.agents, world: s.world, winner: s.winner }),
        )
        .digest('hex'),
    });
  }
  const average = (key) => runs.reduce((s, r) => s + Number(r[key]), 0) / 50;
  const summary = Object.fromEntries(
    Object.keys(runs[0])
      .filter((k) => !['seed', 'winner', 'hash'].includes(k))
      .map((k) => [k, average(k)]),
  );
  assert.ok(
    summary.interactions >= 3 && runs.filter((r) => r.interactions > 0).length >= 45,
    'World interaction missing',
  );
  assert.ok(
    summary.socialEvents >= 40 && summary.trades >= 5 && summary.alliances >= 5,
    'Social ecology collapsed',
  );
  assert.ok(
    runs.every((r) => r.socialEvents > 0),
    'Zero social ending',
  );
  assert.ok(summary.extinction <= 0.15, 'Extinction excess');
  report.cohorts.push({ name, summary, runs });
  console.log(
    name,
    JSON.stringify(summary),
    `wall ${((performance.now() - started) / 1000).toFixed(1)}s`,
  );
}
const file = 'docs/qa/spatial-v1.7-golden.json';
if (golden) await writeFile(file, JSON.stringify(report, null, 2) + '\n');
else
  assert.deepEqual(
    report,
    JSON.parse(await readFile(file, 'utf8')),
    'v1.7 deterministic spatial golden changed: review gameplay before updating',
  );

await writeFile(
  'docs/qa/spatial-v1.7-performance.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      wallSeconds: (performance.now() - benchmarkStart) / 1000,
      method:
        'Timing excluded from deterministic golden; path calls include utility reachability queries',
      runs: performanceRuns,
    },
    null,
    2,
  ) + '\n',
);
