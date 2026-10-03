import { Simulation } from '../core/simulation.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const golden = process.argv.includes('--update'),
  report = {
    version: '1.5.0',
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
    while (s.status === 'running' && s.elapsed < 900) s.tick();
    assert.equal(s.status, 'finished');
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
    summary.interactions >= 10 && runs.filter((r) => r.interactions > 0).length === 50,
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
const file = 'docs/qa/world-v1.5-golden.json';
if (golden) await writeFile(file, JSON.stringify(report, null, 2) + '\n');
else
  assert.deepEqual(
    report,
    JSON.parse(await readFile(file, 'utf8')),
    'v1.5 deterministic golden changed: review gameplay before updating',
  );
