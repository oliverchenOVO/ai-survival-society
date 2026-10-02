import { Simulation } from '../core/simulation.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const economic = new Set([
  'TRADE',
  'ALLIANCE_CREATED',
  'COOPERATION',
  'BETRAYAL',
  'ATTACK',
  'THEFT',
  'DECEPTION',
]);
const social = new Set([...economic, 'CONVERSATION']);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export function benchmark(seeds = Array.from({ length: 50 }, (_, i) => i + 1)) {
  const runs = seeds.map((seed) => {
    const sim = new Simulation({ seed });
    while (sim.status === 'running' && sim.elapsed < 900) sim.tick();
    assert.equal(sim.status, 'finished', `seed ${seed} failed to terminate`);
    const events = sim.bus.log,
      counts = sim.stats().counts,
      meaningful = events.filter((e) => economic.has(e.event));
    return {
      seed,
      duration: sim.elapsed,
      meanAgentSurvival: mean(sim.agents.map((a) => a.diedAt ?? sim.elapsed)),
      firstSocial: events.find((e) => social.has(e.event))?.timestamp ?? null,
      firstMeaningful: meaningful[0]?.timestamp ?? null,
      meaningfulEvents: meaningful.length,
      uniqueSocialPairs: new Set(meaningful.map((e) => [e.actor, e.target].sort().join(':'))).size,
      trades: counts.TRADE ?? 0,
      alliances: counts.ALLIANCE_CREATED ?? 0,
      combat: counts.ATTACK ?? 0,
      betrayals: counts.BETRAYAL ?? 0,
      cooperation: counts.COOPERATION ?? 0,
      environmentalDeaths: events.filter((e) => e.event === 'DEATH' && e.data.cause !== 'combat')
        .length,
      extinction: sim.stats().alive === 0,
      zeroSocial: !events.some((e) => social.has(e.event)),
      winner: sim.winner,
    };
  });
  const summary = {
    seeds: runs.length,
    meanDuration: mean(runs.map((r) => r.duration)),
    meanAgentSurvival: mean(runs.map((r) => r.meanAgentSurvival)),
    meanFirstSocial: mean(runs.map((r) => r.firstSocial).filter((x) => x !== null)),
    meanFirstMeaningful: mean(runs.map((r) => r.firstMeaningful).filter((x) => x !== null)),
    missingSocial: runs.filter((r) => r.firstSocial === null).length,
    missingMeaningful: runs.filter((r) => r.firstMeaningful === null).length,
    meanMeaningfulEvents: mean(runs.map((r) => r.meaningfulEvents)),
    meanUniqueSocialPairs: mean(runs.map((r) => r.uniqueSocialPairs)),
    repeatedMeaningfulRate:
      runs.filter((r) => r.meaningfulEvents >= 5 && r.uniqueSocialPairs >= 3).length / runs.length,
    extinctionRate: runs.filter((r) => r.extinction).length / runs.length,
    zeroSocialExtinctions: runs.filter((r) => r.extinction && r.zeroSocial).length,
    meanEnvironmentalDeaths: mean(runs.map((r) => r.environmentalDeaths)),
  };
  for (const key of ['trades', 'alliances', 'combat', 'betrayals', 'cooperation']) {
    summary[`${key}Rate`] = runs.filter((r) => r[key] > 0).length / runs.length;
    summary[`mean${key[0].toUpperCase() + key.slice(1)}`] = mean(runs.map((r) => r[key]));
  }
  return {
    method:
      '50 deterministic seeds 1–50, default rules, utility-only, no Director events; missing times separately counted',
    summary,
    runs,
  };
}
if (process.argv[1]?.endsWith('benchmark-social.mjs')) {
  const holdout = process.argv.includes('--holdout');
  const result = benchmark(holdout ? Array.from({ length: 50 }, (_, i) => 1001 + i) : undefined),
    output = process.argv[2] ?? 'docs/qa/social-v1.1.json';
  result.method = holdout ? result.method.replace('1–50', '1001–1050 (holdout)') : result.method;
  await mkdir('docs/qa', { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result.summary, null, 2));
  if (!process.argv.includes('--baseline')) {
    const s = result.summary;
    assert.equal(s.missingSocial, 0);
    assert.equal(s.zeroSocialExtinctions, 0);
    assert.ok(
      s.repeatedMeaningfulRate >= 0.9,
      'At least 90% of seeds need 5 meaningful events across 3 pairs',
    );
    assert.ok(
      s.tradesRate >= 0.9 && s.alliancesRate >= 0.9 && s.combatRate >= 0.9,
      'Core interaction rates must remain >=90%',
    );
    assert.ok(s.betrayalsRate >= 0.1, 'Betrayal must remain possible across the suite');
    assert.ok(s.meanFirstSocial <= 20 && s.meanFirstMeaningful <= 45, 'Social opening is too slow');
    assert.ok(s.extinctionRate <= 0.1, 'Too many extinction endings');
    assert.ok(
      s.meanTrades >= 12 && s.meanCooperation >= 3.5 && s.meanMeaningfulEvents >= 85,
      'Resource/social incentives regressed',
    );
  }
}
