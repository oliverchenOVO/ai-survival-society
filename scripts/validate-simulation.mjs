import { Simulation } from '../core/simulation.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const seeds = [
  7, 42, 2048, 12345, 2026, 1, 31415, 99, 123, 8008, 65535, 18, 73, 501, 2027, 11, 22, 33, 44, 55,
];
const rows = [];
for (const seed of seeds) {
  const s = new Simulation({ seed });
  while (s.status === 'running' && s.elapsed < 750) s.tick();
  assert.equal(s.status, 'finished');
  assert.equal(s.stats().alive, 1);
  assert.ok(s.bus.log.length < 10000);
  rows.push({
    seed,
    elapsed: s.elapsed,
    winner: s.agents.find((a) => a.id === s.winner).name,
    ...s.stats(),
  });
}
await mkdir('docs/qa', { recursive: true });
await writeFile('docs/qa/simulation-results.json', JSON.stringify(rows, null, 2));
console.log(
  JSON.stringify(
    {
      matches: rows.length,
      allCompleted: true,
      alliances: rows.reduce((sum, r) => sum + r.alliances, 0),
      trades: rows.reduce((sum, r) => sum + r.trades, 0),
      betrayals: rows.reduce((sum, r) => sum + r.betrayals, 0),
      cooperation: rows.reduce((sum, r) => sum + r.cooperation, 0),
      maxSeconds: Math.max(...rows.map((r) => r.elapsed)),
    },
    null,
    2,
  ),
);
