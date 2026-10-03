import { Simulation } from '../core/simulation.mjs';
import { spatialProfile } from '../core/spatial.mjs';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const simulation = new Simulation({ seed: 7 });
const started = performance.now();
while (simulation.elapsed < 60 && simulation.status === 'running') simulation.tick();
const wallSeconds = (performance.now() - started) / 1000;
const profile = spatialProfile(simulation);
const report = {
  date: new Date().toISOString(),
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim(),
  seed: 7,
  agents: simulation.agents.length,
  simulatedSeconds: simulation.elapsed,
  wallSeconds,
  simulationRatio: simulation.elapsed / wallSeconds,
  pathfindingCallsPerWallSecond: profile.pathfindingCalls / wallSeconds,
  ...profile,
  method:
    'Authoritative headless 12-agent 60s throughput; wall timing includes current host load and is independent of renderer FPS',
};
await writeFile('docs/qa/spatial-v1.7-throughput.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
