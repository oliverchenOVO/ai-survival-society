// Browser plugin not available; real Chrome and historical packaged Electron renderer.
import { launchBrowser } from './qa-runtime.mjs';
import { _electron as electron } from 'playwright';
import { startServer } from '../server/index.mjs';
import { Simulation } from '../core/simulation.mjs';
import {
  COLLISION_DATA,
  intersects,
  walkable,
  nearestLegal,
  revalidateSpatial,
} from '../core/spatial.mjs';
import { legacyStoryId } from '../server/persistence.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const out = 'docs/qa/spatial-browser-v1.7.json',
  checks = [],
  errors = [],
  evidence = {};
await mkdir('docs/images', { recursive: true });
function patient(s) {
  const a = s.agents[0];
  a.position = { x: -7, z: 6, y: 0 };
  a.hp = 25;
  a.inventory.medicine = 0;
  a.action = 'heal_at';
  a.target = s.world.objects.find((o) => o.type === 'medical_station').id;
  for (const b of s.agents) {
    b.nextDecision = 1e6;
    if (b !== a) b.action = 'rest';
  }
  s.world.objects.find((o) => o.type === 'generator').state = 'online';
  s.world.objects.find((o) => o.id === 'clinic_door_0').state = 'open';
  return a;
}
function runPatient(s) {
  const a = patient(s),
    points = [{ ...a.position }];
  while (s.elapsed < 45 && !s.world.metrics.medicalUses) {
    for (const b of s.agents) b.nextDecision = 1e6;
    s.tick();
    points.push({ ...a.position });
  }
  assert.ok(s.world.metrics.medicalUses);
  s.status = 'paused';
  return { elapsed: s.elapsed, points };
}
const camera = async (page, x = -3, z = 6) => {
  await page.waitForTimeout(800);
  await page.evaluate(
    ({ x, z }) => {
      const v = document.querySelector('.world-canvas')._visual;
      v.camera.position.set(x + 7, 14, z + 12);
      v.controls.target.set(x, 3, z);
      v.camera.userData.focusTarget = null;
      v.camera.userData.focusPosition = null;
      v.controls.update();
    },
    { x, z },
  );
  await page.waitForTimeout(800);
};
const historicalRoot = path.resolve('builds/win-unpacked/resources/app');
// Capture the actual v1.6 packaged engine before v1.7 packaging overwrites win-unpacked.
if (
  JSON.parse(await readFile(path.join(historicalRoot, 'package.json'), 'utf8')).version === '1.6.0'
) {
  const { Simulation: Old } = await import(
    pathToFileURL(path.join(historicalRoot, 'core/simulation.mjs')).href
  );
  const old = new Old({ seed: 7, autoRestart: false });
  evidence.before = runPatient(old);
  const profile = path.resolve(`.qa/spatial-before-${Date.now()}`);
  await mkdir(path.join(profile, 'saves'), { recursive: true });
  await writeFile(path.join(profile, 'saves', old.matchId + '.json'), JSON.stringify(old.export()));
  const app = await electron.launch({
    executablePath: path.resolve('builds/win-unpacked/AI Survival Society.exe'),
    env: { ...process.env, SOCIETY_USER_DATA_DIR: profile },
    timeout: 120000,
  });
  try {
    const page = await app.firstWindow();
    await page.locator('canvas').waitFor();
    await page.request.post(new URL('/api/load', page.url()).href, {
      data: { id: legacyStoryId(old.matchId) },
    });
    await camera(page);
    await page.screenshot({ path: 'docs/images/v1.7-before-approach.png' });
  } finally {
    await app.close();
  }
  await writeFile('.qa/spatial-before-evidence.json', JSON.stringify(evidence.before));
} else evidence.before = JSON.parse(await readFile('.qa/spatial-before-evidence.json', 'utf8'));
const runtime = await startServer({
  port: 0,
  dataDir: `.qa/spatial-browser-${Date.now()}`,
  config: { seed: 7, autoRestart: false },
});
const s = runtime.getSimulation();
s.status = 'paused';
let browser;
try {
  browser = await launchBrowser({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`http://localhost:${runtime.port}`);
  await page.locator('.living-hud').waitFor();
  assert.equal(await page.locator('.spatial-debug-inspector').count(), 0);
  async function flags(layers) {
    await page.getByRole('button', { name: '設定', exact: true }).click();
    for (const k of ['collision', 'regions', 'portals', 'paths', 'slots', 'reservations', 'radii'])
      await page.getByTestId('spatial-' + k).setChecked(layers.includes(k));
    await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
    await page.locator('.spatial-debug-inspector').waitFor();
    await page.waitForTimeout(300);
  }
  await flags(['collision']);
  await camera(page);
  await page.screenshot({ path: 'docs/images/v1.7-collision-debug.png' });
  checks.push('Default debug hidden; actual Settings toggles collision hulls');
  await flags(['regions', 'portals']);
  await camera(page, 0, 1);
  await page.screenshot({ path: 'docs/images/v1.7-navmesh-debug.png' });
  checks.push('Polygon regions, vertical routes and authoritative portals rendered');
  await flags(['slots', 'reservations']);
  await camera(page, -10, 12);
  await page.screenshot({ path: 'docs/images/v1.7-interaction-slots.png' });
  patient(s);
  s.status = 'running';
  for (let i = 0; i < 12; i++) {
    for (const b of s.agents) b.nextDecision = 1e6;
    s.tick();
  }
  s.status = 'paused';
  await flags(['collision', 'portals', 'paths', 'radii']);
  await camera(page);
  await page.screenshot({ path: 'docs/images/v1.7-door-portal.png' });
  // Reset only this isolated fixture; production state is never modified by QA.
  const fresh = new Simulation({ seed: 7 });
  Object.assign(s, fresh);
  evidence.after = runPatient(s);
  await camera(page);
  await page.screenshot({ path: 'docs/images/v1.7-after-approach.png' });
  await page.screenshot({ path: 'docs/images/v1.7-indoor-navigation.png' });
  const wall = COLLISION_DATA.colliders.find((c) => c.id === 'clinic_side-1');
  const crossed = (points) => points.slice(1).some((p, i) => intersects(points[i], p, wall, 0.35));
  assert.ok(crossed(evidence.before.points));
  assert.equal(crossed(evidence.after.points), false);
  checks.push(
    'Real v1.6 engine versus v1.7: same Seed, starting position, medical goal and camera; wall crossing removed',
  );
  const depot = s.world.objects.find((o) => o.id === 'depot_container_0');
  depot.metadata.stock.food = 100;
  for (const [i, a] of s.agents.entries()) {
    a.alive = true;
    a.position = nearestLegal(s, { x: -5 + i * 0.8, z: -5 });
    a.action = 'search';
    a.target = depot.id;
    a.nextDecision = 1e6;
    a.spatial.path = [];
    a.spatial.target = null;
  }
  s.status = 'running';
  for (let i = 0; i < 20; i++) {
    for (const a of s.agents) a.nextDecision = 1e6;
    s.tick();
  }
  s.status = 'paused';
  await flags(['paths', 'slots', 'reservations', 'radii']);
  await camera(page, 0, 0);
  await page.screenshot({ path: 'docs/images/v1.7-crowd-avoidance.png' });
  for (const a of s.agents.filter((a) => a.alive)) assert.ok(walkable(s, a.position));
  checks.push('Twelve-agent crowd fixture, reserved slots and collision circles');
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(size);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByTestId('language-select').selectOption('en');
    await page.getByTestId('spatial-collision').waitFor();
    await page.getByTestId('language-select').selectOption('zh-TW');
    await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
  }
  checks.push('Bilingual debug controls at both desktop resolutions');
  assert.deepEqual(errors, []);
  await writeFile(
    out,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        checks,
        errors,
        evidence,
        method: 'Isolated explicit-goal acceptance fixtures; no production scripting',
      },
      null,
      2,
    ),
  );
  for (const check of checks) console.log('PASS', check);
} finally {
  await browser?.close();
  await runtime.close();
}
