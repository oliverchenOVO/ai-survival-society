import { startServer } from '../server/index.mjs';
import { launchBrowser } from './qa-runtime.mjs';
import { setWeather, startHazard, worldEvent } from '../core/living-world.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const runtime = await startServer({
  port: 0,
  dataDir: `.qa/physical-${Date.now()}`,
  config: { seed: 7, autoRestart: false },
});
let browser;
const errors = [],
  checks = [],
  metrics = [];
await mkdir('docs/images', { recursive: true });
try {
  const sim = runtime.getSimulation();
  sim.status = 'paused';
  browser = await launchBrowser({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`http://localhost:${runtime.port}`);
  await page.locator('.living-hud').waitFor();
  await page.waitForTimeout(1500);
  const sample = () =>
    page.evaluate(() => {
      const v = document.querySelector('.world-canvas')._visual;
      const gl = v.renderer.getContext(),
        gpuExtension = gl.getExtension('WEBGL_debug_renderer_info');
      const targets = new Set([v.composer.renderTarget1, v.composer.renderTarget2]);
      for (const pass of v.composer.passes) {
        if (pass.renderTargetBright) targets.add(pass.renderTargetBright);
        for (const rt of [
          ...(pass.renderTargetsHorizontal ?? []),
          ...(pass.renderTargetsVertical ?? []),
        ])
          targets.add(rt);
      }
      v.scene.traverse((o) => {
        if (o.shadow?.map) targets.add(o.shadow.map);
      });
      const textureMemoryBytesEstimate = [...targets].reduce(
        (sum, rt) =>
          sum +
          rt.width * rt.height * (rt.texture.type === 1016 ? 8 : 4) +
          (rt.depthBuffer ? rt.width * rt.height * 4 : 0),
        0,
      );
      return {
        gpu: gpuExtension
          ? gl.getParameter(gpuExtension.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER),
        calls: v.renderer.info.render.calls,
        triangles: v.renderer.info.render.triangles,
        geometries: v.renderer.info.memory.geometries,
        textures: v.renderer.info.memory.textures,
        textureMemoryBytesEstimate,
        objects: [...v.livingScene.objects].map(([id, o]) => ({
          id,
          state: o.g.userData.visual,
          rotation: o.g.rotation.toArray(),
          hingeAngle: o.hinge?.rotation.y,
          lidAngle: o.lid?.rotation.x,
          contentsVisible: o.contents?.visible,
          motorAngle: o.motor?.rotation.z,
          flamesVisible: o.flames?.visible,
        })),
        pois: v.livingScene.kit.pois.size,
        poses: [...v.agents].map(([id, o]) => ({ id, pose: o.userData.pose })),
        robotAssemblies: [...v.agents].map(([id, o]) => ({
          id,
          ...o.children[0]?.userData.assembly,
        })),
        hazards: v.livingScene.hazards.size,
        traces: v.livingScene.historyGroup.children.length,
      };
    });
  const show = async (name, file, focus) => {
    if (focus)
      await page.evaluate((p) => {
        const v = document.querySelector('.world-canvas')._visual;
        v.camera.userData.focusPoi(p);
      }, focus);
    if (name === 'Agent Repair')
      await page.evaluate(() => {
        const camera = document.querySelector('.world-canvas')._visual.camera;
        const target = (camera.userData.focusTarget ?? camera.userData.target).clone();
        camera.userData.focusTarget = target;
        const p = target.clone();
        p.y += 5;
        p.z -= 9;
        camera.userData.focusPosition = p;
        camera.userData.focusStarted = performance.now();
      });
    await page.waitForTimeout(1700);
    await page.waitForFunction(
      (count) =>
        document.querySelector('.world-canvas')?._visual?.livingScene.hazards.size === count,
      sim.world.hazards.length,
      { timeout: 15000 },
    );
    const data = await sample();
    metrics.push({ name, ...data });
    checks.push(name);
    if (file) await page.screenshot({ path: 'docs/images/' + file });
    console.log('PASS', name);
    return data;
  };
  const obj = (kind) => sim.world.objects.find((o) => o.type === kind),
    poi = (kind) => sim.world.pois.find((p) => p.type === kind),
    a = sim.agents[0];
  let d = await show('Day Village', 'v1.6-village.png', poi('village').position);
  assert.equal(d.pois, 8);
  sim.elapsed = 95;
  sim.world.timeOfDay = 'night';
  const gen = obj('generator');
  gen.state = 'offline';
  d = await show('Generator Offline', null, gen.position);
  assert.ok(!d.objects.find((o) => o.id === gen.id).state.online);
  gen.state = 'damaged';
  a.position = { ...gen.position };
  a.target = gen.id;
  a.action = 'repair';
  gen.metadata.repairProgress = 1.5;
  d = await show('Agent Repair', 'v1.6-generator-repair.png', gen.position);
  assert.ok(d.objects.find((o) => o.id === gen.id).state.repairing);
  gen.state = 'online';
  worldEvent(sim, 'GENERATOR_REPAIRED', a, poi('village'), gen);
  d = await show('Generator Repaired', null, gen.position);
  assert.ok(d.objects.find((o) => o.id === gen.id).state.online);
  await show('Night Clinic', 'v1.6-clinic-night.png', poi('clinic').position);
  const med = obj('medical_station');
  a.position = { ...med.position };
  a.action = 'heal_at';
  a.target = med.id;
  d = await show('Agent Heal', null, med.position);
  assert.ok(d.objects.find((o) => o.id === med.id).state.occupied);
  const cache = obj('container');
  cache.state = 'full';
  d = await show('Supply Cache Full', null, cache.position);
  assert.ok(d.objects.find((o) => o.id === cache.id).state.contents);
  cache.state = 'empty';
  worldEvent(sim, 'CONTAINER_SEARCHED', a, poi('village'), cache);
  a.action = 'search';
  a.target = cache.id;
  a.position = { ...cache.position };
  d = await show('Supply Cache Empty', null, cache.position);
  assert.ok(!d.objects.find((o) => o.id === cache.id).state.contents);
  const door = obj('door');
  door.state = 'closed';
  d = await show('Door Closed', null, door.position);
  assert.equal(d.objects.find((o) => o.id === door.id).state.doorAngle, 0);
  door.state = 'open';
  d = await show('Door Open', null, door.position);
  assert.ok(d.objects.find((o) => o.id === door.id).state.doorAngle > 1);
  const fire = obj('campfire');
  fire.state = 'lit';
  fire.metadata.fuel = 20;
  d = await show('Campfire Lit', null, fire.position);
  assert.ok(d.objects.find((o) => o.id === fire.id).state.lit);
  setWeather(sim, 'storm', 60);
  a.action = 'rest_at';
  const bed = sim.world.objects.find((o) => o.type === 'bed' && o.poi === 'poi_shelter');
  a.position = { ...bed.position };
  a.target = bed.id;
  await show('Storm Shelter', 'v1.6-storm.png', poi('shelter').position);
  startHazard(sim, 'flood', 'poi_bridge');
  d = await show('Flooded Bridge', null, poi('bridge').position);
  assert.equal(d.hazards, 1);
  startHazard(sim, 'fire', 'poi_village');
  d = await show('Fire', 'v1.6-fire.png', poi('village').position);
  assert.equal(d.hazards, 2);
  const clinic = poi('clinic');
  clinic.controller = a.id;
  clinic.controllers = [a.id];
  worldEvent(sim, 'POI_CONTROLLED', a, clinic, null);
  await show('POI Capture', 'v1.6-poi-control.png', clinic.position);
  clinic.access = 'contested';
  worldEvent(sim, 'POI_CONTESTED', a, clinic, null);
  await show('Contested POI', null, clinic.position);
  const radio = obj('radio');
  a.position = { ...radio.position };
  a.action = 'broadcast';
  a.target = radio.id;
  d = await show('Broadcast', null, radio.position);
  assert.ok(d.objects.find((o) => o.id === radio.id).state.broadcasting);
  const b = sim.agents[1];
  a.action = 'attack';
  a.target = b.id;
  a.position = { x: 0, z: 0 };
  b.position = { x: 1, z: 0 };
  sim.event('ATTACK', a, b, 'ATTACK', { damage: 12 });
  d = await show('Combat', 'v1.6-combat.png', { x: 0, z: 0 });
  assert.equal(d.poses.find((o) => o.id === a.id).pose.action, 'attack');
  b.alive = false;
  sim.event('DEATH', a, b, `${a.name} eliminated ${b.name}.`, { cause: 'combat', victim: b.id });
  d = await show('Death', null, b.position);
  assert.ok(d.poses.find((o) => o.id === b.id).pose.shutdown > 0.9);
  await page
    .getByRole('button', { name: '電影式鏡頭', exact: false })
    .count()
    .then(async (n) => {
      if (n) await page.getByRole('button', { name: '電影式鏡頭', exact: false }).click();
      else await page.locator('.camera-tools button').last().click();
    });
  await page.waitForTimeout(600);
  assert.ok(await page.locator('.cinematic-hud').isVisible());
  await page.screenshot({ path: 'docs/images/v1.6-cinematic.png' });
  checks.push('Cinematic HUD and expanded world');
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
  ]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    checks.push(`Layout ${width}x${height}`);
  }
  // Same archive, historical states and a backward seek: final state must not leak.
  sim.elapsed = 20;
  sim.bus.log = [];
  const frame = (timestamp) => ({
    timestamp,
    world: structuredClone(sim.world),
    stats: sim.stats(),
    agents: sim.agents.map((a) => ({
      id: a.id,
      position: { ...a.position },
      alive: a.alive,
      hp: a.hp,
      action: a.action,
    })),
  });
  sim.world.hazards = [];
  gen.state = 'offline';
  door.state = 'closed';
  sim.world.weather = 'clear';
  sim.world.timeOfDay = 'day';
  const early = frame(20);
  sim.elapsed = 40;
  gen.state = 'online';
  door.state = 'open';
  sim.world.weather = 'storm';
  sim.world.timeOfDay = 'night';
  worldEvent(sim, 'GENERATOR_REPAIRED', a, poi('village'), gen);
  sim.elapsed = 50;
  startHazard(sim, 'fire', 'poi_village');
  const late = frame(50);
  sim.timeline = [early, late];
  sim.elapsed = 60;
  const saved = await page.request
    .post(`http://localhost:${runtime.port}/api/save`)
    .then((r) => r.json());
  for (const [timestamp, online, hazards] of [
    [20, false, 0],
    [50, true, 1],
    [20, false, 0],
  ]) {
    await page.goto(`http://localhost:${runtime.port}/replay/${saved.id}?t=${timestamp}`);
    await page.locator('.living-hud').waitFor();
    await page.waitForTimeout(1000);
    d = await sample();
    assert.equal(d.objects.find((o) => o.id === gen.id).state.online, online);
    assert.equal(d.hazards, hazards);
    assert.equal(d.traces > 0, online);
  }
  checks.push('Replay same world state, including backward seek and no final-state leakage');
  await page.goto(`http://localhost:${runtime.port}`);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.living-hud').waitFor();
  b.alive = true;
  b.hp = 100;
  setWeather(sim, 'storm', 100);
  sim.world.hazards = [];
  startHazard(sim, 'fire', 'poi_ruins');
  const frameRates = [];
  for (const speed of [1, 10]) {
    await page.request.post(`http://localhost:${runtime.port}/api/control`, {
      data: { action: 'speed', value: speed },
    });
    await page.request.post(`http://localhost:${runtime.port}/api/control`, {
      data: { action: 'resume' },
    });
    const before = sim.elapsed;
    frameRates.push(
      await page.evaluate(
        (speed) =>
          new Promise((resolve) => {
            let start,
              count = 0;
            function frame(now) {
              start ??= now;
              count++;
              if (now - start < 2000) requestAnimationFrame(frame);
              else
                resolve({
                  speed,
                  fps: ((count - 1) * 1000) / (now - start),
                  frames: count,
                  elapsedMs: now - start,
                });
            }
            requestAnimationFrame(frame);
          }),
        speed,
      ),
    );
    assert.ok(sim.elapsed > before);
    await page.request.post(`http://localhost:${runtime.port}/api/control`, {
      data: { action: 'pause' },
    });
  }
  metrics.push({
    name: 'Storm + fire + 12 robots, live UI, composed-frame counters',
    ...(await sample()),
    frameRates,
  });
  checks.push('Actual 1x and 10x storm/fire progression and frame-rate samples');
  assert.deepEqual(errors, []);
  await writeFile(
    'docs/qa/physical-browser-v1.6.json',
    JSON.stringify(
      { checks, metrics, errors, browser: 'Playwright Chrome; Browser plugin not available' },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await runtime.close();
}
