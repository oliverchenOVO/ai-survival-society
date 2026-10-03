import { reserveInteraction, atInteractionSlot, releaseSlot } from '../core/spatial.mjs';
import { launchBrowser, closeElectron } from './qa-runtime.mjs';
// Browser plugin not available; isolated Playwright Chrome and actual Electron.
import { chromium, _electron as electron } from 'playwright';
import { Simulation } from '../core/simulation.mjs';
import { startServer } from '../server/index.mjs';
import { Persistence } from '../server/persistence.mjs';
import { setWeather, startHazard, performInteraction, updateWorld } from '../core/living-world.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
function placeAtSlot(s, a, o) {
  releaseSlot(s, a);
  a.target = o.id;
  const slot = reserveInteraction(s, a, o);
  assert.ok(slot);
  a.position = { x: slot.x, y: slot.y ?? 0, z: slot.z };
  assert.ok(atInteractionSlot(s, a, o));
}
const desktop = process.argv.includes('--desktop'),
  profile = path.resolve(`.qa/world-${desktop ? 'desktop' : 'browser'}-${Date.now()}`);
await mkdir(profile, { recursive: true });
const store = new Persistence(profile);
await store.init();
const completed = new Simulation({ seed: 7 });
while (completed.status === 'running') completed.tick();
await store.persist(completed);
const storyId = store.identity(completed).simulationId;
const checkpoint = new Simulation({ seed: 42 });
for (let i = 0; i < 300; i++) checkpoint.tick();
await store.persist(checkpoint);
const checkpointId = store.identity(checkpoint).simulationId;
const fixture = new Simulation({ seed: 7 });
fixture.elapsed = 95;
fixture.world.timeOfDay = 'night';
setWeather(fixture, 'storm', 60);
startHazard(fixture, 'fire', 'poi_village');
fixture.timeline.push({
  timestamp: 95,
  world: structuredClone(fixture.world),
  stats: fixture.stats(),
  agents: fixture.agents.map((a) => ({
    id: a.id,
    position: a.position,
    alive: a.alive,
    hp: a.hp,
    action: a.action,
  })),
});
await store.persist(fixture);
const fixtureId = store.identity(fixture).simulationId;
let runtime, browser, app, page, context;
const errors = [],
  checks = [],
  layouts = [],
  frameRates = [];
const check = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
try {
  if (desktop) {
    app = await electron.launch({
      executablePath: path.resolve('builds/win-unpacked/AI Survival Society.exe'),
      args: process.env.SOCIETY_QA_SOFTWARE === '1' ? ['--use-angle=swiftshader'] : [],
      env: { ...process.env, SOCIETY_USER_DATA_DIR: profile },
      timeout: 180000,
    });
    page = await app.firstWindow();
    context = page.context();
  } else {
    runtime = await startServer({ port: 0, dataDir: profile, config: { autoRestart: false } });
    browser = await launchBrowser({ channel: 'chrome', headless: true });
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(`http://localhost:${runtime.port}`);
  }
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const base = new URL(page.url()).origin,
    post = async (url, data) => {
      const r = await page.request.post(base + url, { data });
      assert.ok(r.ok(), await r.text());
      return r.json();
    };
  await page.locator('canvas').waitFor({ timeout: 60000 });
  await post('/api/control', { action: 'pause' });
  await page.locator('.living-hud').waitFor();
  assert.ok((await page.title()).includes('Survival'));
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    layouts.push(
      await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        overflow: document.documentElement.scrollWidth > innerWidth,
        overlappingPlaces: (() => {
          const labels = [...document.querySelectorAll('.poi-label')]
            .filter((e) => e.getClientRects().length)
            .map((e) => ({ name: e.textContent, rect: e.getBoundingClientRect() }));
          return labels.flatMap((a, i) =>
            labels
              .slice(i + 1)
              .filter(
                (b) =>
                  a.rect.left < b.rect.right &&
                  a.rect.right > b.rect.left &&
                  a.rect.top < b.rect.bottom &&
                  a.rect.bottom > b.rect.top,
              )
              .map((b) => [a.name, b.name]),
          );
        })(),
      })),
    );
  }
  assert.ok(layouts.every((l) => !l.overflow));
  assert.ok(
    layouts.every((l) => !l.overlappingPlaces.length),
    'POI marker text overlaps',
  );
  check('World desktop layouts, identity, meaningful content and no overlay');
  if (runtime) {
    const s = runtime.getSimulation(),
      a = s.agents[0];
    s.elapsed = 30;
    setWeather(s, 'clear', 100);
    updateWorld(s, 0.25);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'docs/images/v1.7-day-world.png' });
    const g = s.world.objects.find((o) => o.type === 'generator');
    placeAtSlot(s, a, g);
    a.target = g.id;
    a.action = 'repair';
    performInteraction(s, a, g, 3);
    assert.equal(g.state, 'online');
    const clinic = s.world.pois.find((p) => p.type === 'clinic');
    for (const b of s.agents) b.position = { x: 24, z: 0 };
    a.position = { ...clinic.position };
    updateWorld(s, 11);
    assert.equal(clinic.controller, a.id);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/images/v1.7-clinic-control.png' });
    s.elapsed = 100;
    s.world.timeOfDay = 'night';
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/images/v1.7-night-world.png' });
    setWeather(s, 'storm', 60);
    const bed = s.world.objects.find((o) => o.type === 'bed' && o.poi === 'poi_shelter');
    placeAtSlot(s, a, bed);
    a.energy = 20;
    a.target = bed.id;
    a.action = 'rest_at';
    performInteraction(s, a, bed, 1);
    await page.waitForTimeout(500);
    assert.ok((await page.locator('.living-hud').innerText()).includes('暴風雨'));
    await page.screenshot({ path: 'docs/images/v1.7-storm-shelter.png' });
    startHazard(s, 'fire', 'poi_village');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/images/v1.7-fire-event.png' });
    check(
      'Authority fixtures: day/night, generator restoration, clinic control, storm shelter and fire rendered',
    );
  }
  const resumed = await post('/api/load', { id: checkpointId });
  assert.equal(resumed.elapsed, checkpoint.elapsed);
  assert.deepEqual(resumed.world, checkpoint.world);
  assert.equal(resumed.status, 'paused');
  await page.reload();
  await page.locator('.living-hud').waitFor();
  check('Saved world resumes intact and remains intact after reload');
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const speed of [1, 10]) {
    // Isolate speed samples: a loaded host may finish the previous world while
    // Chromium schedules the measurement. Never measure an already ended run.
    await post('/api/control', { action: 'restart', value: 7 });
    await post('/api/control', { action: 'speed', value: speed });
    await post('/api/control', { action: 'resume' });
    const before = await page.request.get(base + '/api/state').then((r) => r.json());
    assert.equal(before.status, 'running');
    frameRates.push(
      await page.evaluate(
        (speed) =>
          new Promise((resolve) => {
            const firstRender = document.querySelector('.world-canvas')._visual.renderedFrames ?? 0;
            let start,
              count = 0;
            function frame(now) {
              if (start === undefined) start = now;
              count++;
              if (now - start < 2000) requestAnimationFrame(frame);
              else
                resolve({
                  speed,
                  elapsedMs: now - start,
                  frames: count,
                  fps: ((count - 1) * 1000) / (now - start),
                  renderedFrames:
                    (document.querySelector('.world-canvas')._visual.renderedFrames ?? 0) -
                    firstRender,
                  renderedFps:
                    (((document.querySelector('.world-canvas')._visual.renderedFrames ?? 0) -
                      firstRender) *
                      1000) /
                    (now - start),
                });
            }
            requestAnimationFrame(frame);
          }),
        speed,
      ),
    );
    const after = await page.request.get(base + '/api/state').then((r) => r.json());
    assert.ok(after.elapsed > before.elapsed);
    await post('/api/control', { action: 'pause' });
  }
  check('Actual authoritative 1x and 10x run progression');
  await page.goto(base + '/replay/' + fixtureId + '?t=95');
  await page.locator('.living-hud').waitFor();
  assert.ok((await page.locator('.living-hud').innerText()).includes('暴風雨'));
  check('Deep-linked replay uses sampled night/storm/hazard world');
  await page.goto(base + '/story/' + storyId);
  await page.locator('#world-moments').waitFor();
  assert.ok((await page.locator('#world-moments .story-event').count()) > 0);
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  }
  check('Story World Moments at desktop and mobile sizes');
  const visitorIndex = completed.agents.findIndex(
    (a) => Object.keys(a.placeStats ?? {}).length > 0,
  );
  assert.ok(visitorIndex >= 0);
  await page.locator('.cast-card').nth(visitorIndex).click();
  await page.getByRole('heading', { name: '重要地點', exact: true }).waitFor();
  await page.getByRole('button', { name: '關閉視窗' }).click();
  check('Life Story displays recorded important places');
  await page.locator('select').first().selectOption('en');
  await page.getByRole('heading', { name: 'World Moments', exact: true }).waitFor();
  await page.goto(base + '/replay/' + fixtureId + '?t=95');
  await page.locator('.living-hud').waitFor();
  assert.ok((await page.locator('.living-hud').innerText()).includes('Storm'));
  check('English world labels and bilingual Story');
  if (desktop) assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.deepEqual(errors, []);
  check('No renderer/console errors');
  await writeFile(
    `docs/qa/world-${desktop ? 'desktop' : 'browser'}-v1.7.json`,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browserPath: 'Browser plugin not available; Playwright',
        checks,
        frameRates,
        layouts,
        errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error({
    errors,
    url: page?.url(),
    body: await page
      ?.locator('body')
      .innerText()
      .catch(() => 'unavailable'),
  });
  throw error;
} finally {
  if (app) await closeElectron(app);
  if (browser) await browser.close();
  if (runtime) await runtime.close();
}
