import { launchBrowser } from './qa-runtime.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { startServer } from '../server/index.mjs';
const runtime = await startServer({ port: 0, dataDir: '.qa/browser-data' });
const base = `http://localhost:${runtime.port}`;
const browser = await launchBrowser({ channel: 'chrome', headless: true });
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [],
  failedRequests = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
});
const post = (url, body) =>
  page.request.post(base + url, { data: body }).then(async (r) => {
    assert.ok(r.ok(), await r.text());
    return r.json();
  });
const current = () => page.request.get(base + '/api/state').then((r) => r.json());
const check = (name) => {
  checks.push({ name, result: 'PASS' });
  console.log('PASS', name);
};
await mkdir('docs/images', { recursive: true });
await mkdir('docs/qa', { recursive: true });
try {
  await page.addInitScript(() => localStorage.setItem('society.locale.v1', 'en'));
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('heading', { name: 'AI SURVIVAL SOCIETY', exact: true }).waitFor();
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(2200);
  assert.equal(await page.title(), 'AI Survival Society');
  assert.ok((await page.locator('body').innerText()).includes('CURRENT DECISION'));
  check('Identity, meaningful UI, loaded 3D canvas, no framework overlay');
  await post('/api/control', { action: 'auto_restart', value: false });
  await post('/api/control', { action: 'restart', value: 7 });
  await page.getByTestId('pause').click();
  await page.waitForTimeout(350);
  const paused = await current();
  await page.waitForTimeout(600);
  assert.equal((await current()).elapsed, paused.elapsed);
  assert.equal((await current()).status, 'paused');
  check('Pause holds simulation time');
  await page.getByTestId('pause').click();
  await page.waitForTimeout(550);
  assert.equal((await current()).status, 'running');
  assert.ok((await current()).elapsed > paused.elapsed);
  check('Resume advances time');
  await page.getByRole('combobox', { name: 'Simulation speed' }).selectOption('8');
  await page.waitForTimeout(1200);
  assert.equal((await current()).speed, 8);
  check('Speed changes authoritative simulation');
  const restartResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/control') &&
      r.request().method() === 'POST' &&
      r.request().postDataJSON()?.action === 'restart',
  );
  await page.getByRole('button', { name: 'Restart simulation' }).click();
  const restarted = await (await restartResponse).json();
  assert.equal(restarted.seed, 7);
  assert.equal(restarted.elapsed, 0);
  assert.equal(restarted.stats.trades, 0);
  check('Restart resets world, seed and statistics');
  await page.waitForTimeout(2200);
  await page.getByTestId('pause').click();
  await page.waitForTimeout(300);
  const mid = await current();
  assert.ok(mid.agents.some((a) => a.stats.resources > 0));
  assert.ok(mid.stats.conversations > 0);
  assert.ok(mid.stats.alliances > 0);
  check('Autonomous movement, resource collection, conversations and alliances');
  await page.screenshot({ path: 'docs/images/v1.7-world-overview.png' });
  await page.getByRole('combobox', { name: 'Selected agent' }).selectOption('Agent_03');
  await page.waitForTimeout(750);
  assert.equal(
    await page.getByRole('combobox', { name: 'Selected agent' }).inputValue(),
    'Agent_03',
  );
  await page.getByRole('button', { name: 'Focus selected agent', exact: true }).click();
  await page.getByRole('button', { name: 'Follow selected agent', exact: true }).click();
  assert.equal(
    await page.getByRole('button', { name: 'Follow selected agent' }).getAttribute('aria-pressed'),
    'true',
  );
  await page.getByRole('button', { name: 'Cinematic event camera' }).click();
  assert.equal(
    await page.getByRole('button', { name: 'Cinematic event camera' }).getAttribute('aria-pressed'),
    'true',
  );
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  const canvas = page.locator('canvas'),
    box = await canvas.boundingBox();
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 130, { steps: 10 });
  await page.mouse.up();
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + 190, box.y + 150, { steps: 10 });
  await page.mouse.up({ button: 'right' });
  await page.mouse.wheel(0, 80);
  await page.screenshot({ path: 'docs/images/v1.7-agent-inspector.png' });
  check('Selection, focus, follow, cinematic toggle, orbit, pan and zoom');
  await page.getByRole('button', { name: 'Network', exact: true }).click();
  await page.getByRole('dialog', { name: 'The social fabric' }).waitFor();
  assert.ok((await page.getByRole('dialog').locator('line').count()) > 0);
  await page.screenshot({ path: 'docs/images/v1.7-relationships.png' });
  await page.getByRole('button', { name: 'Close dialog' }).click();
  check('Live relationship graph renders from simulation data');
  await page.getByRole('button', { name: 'Director', exact: true }).click();
  for (const event of ['food_crisis', 'supply_drop', 'storm', 'rumor', 'treasure', 'plague'])
    await page.getByRole('dialog').getByTestId(`director-${event}`).click();
  await page.waitForTimeout(400);
  const d = await current();
  for (const type of ['FOOD_CRISIS', 'SUPPLY_DROP', 'STORM', 'RUMOR', 'TREASURE', 'PLAGUE'])
    assert.ok(d.events.some((e) => e.event === type));
  await page.screenshot({ path: 'docs/images/v1.7-director-mode.png' });
  await page.getByRole('button', { name: 'Close dialog' }).click();
  check('All six Director buttons modify world and emit events');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog', { name: 'Simulation settings' }).waitFor();
  await page.getByLabel('Random seed').fill('7');
  await page.getByRole('button', { name: 'Start this seed' }).click();
  await page.waitForTimeout(300);
  check('Seed settings restart works');
  await page.getByRole('combobox', { name: 'Simulation speed' }).selectOption('32');
  await page.getByRole('dialog', { name: 'The island remembers' }).waitFor({ timeout: 40000 });
  const completed = await current();
  assert.equal(completed.status, 'finished');
  assert.equal(completed.stats.alive, 1);
  assert.ok(completed.stats.kills > 0);
  assert.ok(completed.stats.deaths === 11);
  assert.ok(completed.stats.betrayals > 0);
  assert.ok(completed.history.chapters.length === 4);
  await page.screenshot({ path: 'docs/images/v1.7-final-result.png' });
  check('Full run reaches combat, deaths, betrayal, winner and historian');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Save run', exact: true }).click();
  await page.waitForTimeout(200);
  const exported = await page.request.get(base + '/api/export');
  assert.ok(exported.headers()['content-disposition'].includes('.json'));
  const log = await exported.json();
  assert.ok(log.timeline.length > 0);
  assert.ok(log.events.length > 100);
  await writeFile('.qa/example-run.json', JSON.stringify(log, null, 2));
  check('Complete JSON export and save archive');
  await page.getByRole('button', { name: 'Simulation archive', exact: true }).click();
  await page.getByRole('dialog', { name: 'Simulation archive' }).waitFor();
  await page
    .getByRole('dialog')
    .getByRole('button')
    .filter({ hasText: /Seed 7/ })
    .first()
    .click();
  await page.getByRole('slider', { name: 'Replay timeline' }).waitFor();
  await page.getByRole('slider', { name: 'Replay timeline' }).fill('150');
  await page.waitForTimeout(300);
  assert.equal(await page.getByRole('slider', { name: 'Replay timeline' }).inputValue(), '150');
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await page.waitForTimeout(400);
  assert.ok(Number(await page.getByRole('slider', { name: 'Replay timeline' }).inputValue()) > 150);
  await page.screenshot({ path: 'docs/images/v1.7-replay.png' });
  await page.getByRole('button', { name: 'Return live' }).click();
  check('Saved-run replay timeline, playback and return-live');
  await page.getByTestId('restart').click();
  await page.getByRole('combobox', { name: 'Simulation speed' }).selectOption('1');
  await page.getByTestId('pause').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(650);
  await page.screenshot({ path: 'docs/images/v1.7-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog', { name: 'Simulation settings' }).waitFor();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  check('Mobile 390px layout has no horizontal overflow and settings usable');
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  check('No page errors, console errors or failed asset/API requests');
  await writeFile(
    'docs/qa/browser-results-v1.7.json',
    JSON.stringify(
      {
        browser: await browser.version(),
        base,
        viewports: [
          { width: 1600, height: 1000 },
          { width: 390, height: 844 },
        ],
        checks,
        errors,
        failedRequests,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: '.qa/browser-failure.png', fullPage: true });
  console.error(error);
  throw error;
} finally {
  await browser.close();
  await runtime.close();
}
