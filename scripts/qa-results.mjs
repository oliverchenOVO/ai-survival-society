import { launchBrowser } from './qa-runtime.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const baseline = process.argv.includes('--baseline');
const runtime = await startServer({
  port: 0,
  dataDir: '.qa/results-data',
  config: {
    autoRestart: false,
    seed: 7,
    matchDuration: 4,
    speed: 32,
    restartDelaySeconds: 2,
    agentCount: 2,
  },
});
const browser = await launchBrowser({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const base = `http://localhost:${runtime.port}`;
await mkdir('docs/qa', { recursive: true });
await mkdir('docs/images', { recursive: true });
try {
  await page.addInitScript(() => localStorage.setItem('society.locale.v1', 'en'));
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const dialog = page.getByRole('dialog', { name: 'The island remembers' });
  await dialog.waitFor({ timeout: 30000 });
  if (!baseline) await dialog.getByRole('link', { name: 'Export this history' }).waitFor();
  const old = await dialog.innerText();
  const completed = await page.request.get(base + '/api/state').then((r) => r.json());
  assert.equal(completed.status, 'finished');
  await page.request.post(base + '/api/control', { data: { action: 'auto_restart', value: true } });
  await page.request.post(base + '/api/control', { data: { action: 'speed', value: 1 } });
  await page.waitForFunction(
    async (id) => (await fetch('/api/state').then((r) => r.json())).matchId !== id,
    completed.matchId,
    { timeout: 10000 },
  );
  await page.request.post(base + '/api/control', { data: { action: 'pause' } });
  const nextWorld = await page.request.get(base + '/api/state').then((r) => r.json());
  await page.waitForFunction(
    (seed) => document.querySelector('.simulation-strip')?.textContent.includes('SEED ' + seed),
    nextWorld.seed,
    { timeout: 30000 },
  );
  const after = await dialog.innerText();
  if (baseline) {
    assert.ok(after.includes('No survivors'));
    await writeFile(
      'docs/qa/results-fixture-v1.5.json',
      JSON.stringify({ old, after, completedMatch: completed.matchId, errors }, null, 2),
    );
    console.log('REPRODUCED: old result reads new live run and displays No survivors');
  } else {
    assert.equal(after, old, 'Completed result changed when next world started');
    const download = page.waitForEvent('download');
    await dialog.getByRole('link', { name: 'Export this history' }).click();
    const item = await download;
    await item.saveAs('.qa/result-export.json');
    const { readFile } = await import('node:fs/promises');
    const exported = JSON.parse(await readFile('.qa/result-export.json', 'utf8'));
    assert.equal(exported.matchId, completed.matchId);
    assert.equal(exported.elapsed, completed.elapsed);
    assert.deepEqual(exported.stats, completed.stats);
    await page.screenshot({ path: 'docs/images/v1.5-result.png' });
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await page.request.post(base + '/api/control', {
      data: { action: 'auto_restart', value: false },
    });
    await page.request.post(base + '/api/control', { data: { action: 'restart', value: 9 } });
    const sim = runtime.getSimulation();
    sim.elapsed = 600;
    for (const a of sim.agents) {
      a.hp = 0.01;
      a.position = { x: 30, z: 0 };
    }
    sim.tick();
    await dialog.getByText('EXTINCTION EVENT', { exact: true }).waitFor();
    assert.ok((await dialog.innerText()).includes('The island claimed everyone.'));
    assert.ok(!(await dialog.innerText()).includes('LAST SURVIVOR'));
    const extinctionDownload = page.waitForEvent('download');
    await dialog.getByRole('link', { name: 'Export this history' }).click();
    await (await extinctionDownload).saveAs('.qa/extinction-export.json');
    const extinction = JSON.parse(await readFile('.qa/extinction-export.json', 'utf8'));
    assert.equal(extinction.matchId, sim.matchId);
    assert.equal(extinction.winner, null);
    assert.equal(extinction.outcome.kind, 'extinction');
    await page.screenshot({ path: 'docs/images/v1.5-extinction.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'docs/images/v1.5-extinction-mobile.png' });
    assert.ok(await dialog.isVisible());
    assert.deepEqual(errors, []);
    await writeFile(
      'docs/qa/results-v1.5.json',
      JSON.stringify(
        {
          browser: 'Playwright Chrome; Browser plugin not available',
          checks: [
            'Result stays bound to completed match after automatic restart',
            'Export uses completed match ID, duration and stats',
            'Simultaneous environmental death renders EXTINCTION, without winner label',
            'Desktop and mobile result display',
            'No runtime errors',
          ],
          completedSeed: completed.seed,
        },
        null,
        2,
      ),
    );
    console.log('PASS: continuous mode result and export remain consistent');
  }
} finally {
  await browser.close();
  await runtime.close();
}
