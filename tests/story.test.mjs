import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Simulation } from '../core/simulation.mjs';
import { Persistence, newStoryId, legacyStoryId, validId } from '../server/persistence.mjs';
import { startServer } from '../server/index.mjs';
import {
  buildFacts,
  publicStory,
  majorMoments,
  biography,
  summary,
  markdown,
  escapeXML,
  shareURL,
  shareCardSVG,
} from '../src/story/facts.mjs';
import { catalogs } from '../src/i18n/translate.mjs';
function complete(seed = 7) {
  const sim = new Simulation({ seed });
  while (sim.status === 'running') sim.tick();
  return sim;
}
const metadata = {
  simulationId: newStoryId(),
  simulationVersion: '1.4.0',
  startedAt: '2026-10-02T00:00:00.000Z',
  finishedAt: '2026-10-02T00:10:00.000Z',
};
function record(sim = complete()) {
  const d = sim.export();
  d.simulation_id = metadata.simulationId;
  d.story = buildFacts(d, metadata);
  return d;
}
test('story facts preserve determinism, consistent counters, chronological ranked moments and bilingual biography', () => {
  const sim = complete(),
    before = structuredClone(sim.export()),
    d = record(sim);
  assert.deepEqual(sim.export(), before);
  assert.ok(d.winner);
  assert.equal(d.story.finalThree[0], d.winner);
  assert.equal(d.story.duration, d.elapsed);
  assert.equal(d.story.agents.length, 12);
  assert.ok(d.story.majorMoments.length >= 8 && d.story.majorMoments.length <= 15);
  const momentEvents = d.story.majorMoments.map((m) => d.events.find((e) => e.id === m.eventId));
  assert.ok(momentEvents.some((e) => e.event === 'MATCH_ENDED'));
  if(d.events.some(e=>e.event==='BETRAYAL'))assert.ok(momentEvents.some((e) => e.event === 'BETRAYAL'));
  assert.deepEqual(
    momentEvents.map((e) => e.timestamp),
    momentEvents.map((e) => e.timestamp).sort((a, b) => a - b),
  );
  for (const locale of ['zh-TW', 'en']) {
    assert.equal(summary(d, locale).length, 5);
    assert.ok(
      biography(d, d.winner, locale).includes(d.agents.find((a) => a.id === d.winner).name),
    );
    assert.ok(markdown(publicStory(d), locale).includes(d.simulation_id));
  }
  for (const e of d.events) assert.ok(catalogs.en['type.' + e.event], e.event);
  assert.equal(
    d.story.awards.find((a) => a.key === 'trader').value,
    Math.max(...d.agents.map((a) => a.stats.trades)),
  );
  assert.equal(
    d.story.awards.find((a) => a.key === 'loyalty').value,
    Math.max(...d.agents.map((a) => a.personality.loyalty)),
  );
});
test('extinction final three expose equal survival times rather than fabricating a winner', () => {
  const sim = new Simulation({ seed: 9 });
  sim.elapsed = 600;
  for (const a of sim.agents) {
    a.hp = 0.01;
    a.position = { x: 30, z: 0 };
  }
  sim.tick();
  const d = record(sim);
  assert.equal(d.story.outcome.kind, 'extinction');
  assert.equal(d.winner, null);
  assert.equal(new Set(d.story.agents.map((a) => a.survival)).size, 1);
  assert.equal(d.story.finalThree.length, 3);
  assert.ok(summary(d, 'zh-TW')[4].text.includes('再無生還者'));
  assert.ok(!shareCardSVG(d).includes('undefined'));
});
test('major ranking sees late rare and betrayal events in a large log', () => {
  const d = record();
  d.events = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    event: 'CONVERSATION',
    timestamp: i,
    result: 'hello',
  }));
  d.events.push(
    {
      id: 10001,
      event: 'BETRAYAL',
      timestamp: 10001,
      result: 'betrayal',
      relationship_change: { trust: -0.8, hostility: 0.7 },
    },
    { id: 10002, event: 'MATCH_ENDED', timestamp: 10002, result: 'ended' },
  );
  const start = performance.now(),
    moments = majorMoments(d);
  assert.ok(moments.some((m) => m.eventId === 10001));
  assert.ok(moments.some((m) => m.eventId === 10002));
  assert.ok(performance.now() - start < 2000);
});
test('public serialization separates credentials, safe exports escape prose, and IDs/links are independent', () => {
  const d = record();
  d.config.llm = { endpoint: 'https://secret:password@host/api', apiKey: 'NEVER_EXPORT' };
  d.secret = 'NEVER_EXPORT';
  d.agents[0].machinePath = 'C:\\Users\\oliver';
  d.story.secret = 'NEVER_EXPORT';
  d.history.narration =
    '<script>window.PWNED=true</script> C:\\Users\\oliver\\secret ghp_12345678901234567890';
  const p = publicStory(d),
    str = JSON.stringify(p);
  assert.ok(!str.includes('NEVER_EXPORT'));
  assert.ok(!str.includes('Users'));
  assert.ok(!str.includes('ghp_'));
  assert.ok(p.history.narration.includes('<script>'));
  assert.equal(escapeXML('<script>"&'), '&lt;script&gt;&quot;&amp;');
  assert.ok(markdown(p).includes('\\<script\\>'));
  assert.ok(!shareCardSVG(p).includes('<script>'));
  const ids = Array.from({ length: 10000 }, newStoryId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(validId));
  assert.equal(legacyStoryId(d.matchId), legacyStoryId(d.matchId));
  assert.equal(
    shareURL(d.simulation_id, 'http://localhost:4310'),
    `http://localhost:4310/story/${d.simulation_id}`,
  );
  assert.equal(
    shareURL(d.simulation_id, 'http://localhost:4310', 'https://example.test/app'),
    `https://example.test/app/story/${d.simulation_id}`,
  );
  assert.throws(() => shareURL(d.simulation_id, 'http://localhost', 'file:///C:/'));
  assert.throws(() => shareURL('../secret', 'http://localhost'));
  assert.throws(() =>
    shareURL(d.simulation_id, 'http://localhost', 'https://user:pass@example.test'),
  );
});
test('archive migration, permanent retention, frozen facts, canonical replay identity and durable deletion', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'society-story-'));
  try {
    await mkdir(path.join(dir, 'saves'));
    const legacy = complete().export();
    await writeFile(path.join(dir, 'saves', legacy.matchId + '.json'), JSON.stringify(legacy));
    let store = new Persistence(dir, 1);
    await store.init();
    const id = legacyStoryId(legacy.matchId);
    assert.equal((await store.read(id)).simulation_id, id);
    assert.equal((await store.read(legacy.matchId)).story.finishedAt, null);
    const migrated = JSON.parse(
      await readFile(path.join(dir, 'saves', legacy.matchId + '.json'), 'utf8'),
    );
    assert.equal(migrated.story.storySchemaVersion, 1);
    const sim = complete(8);
    await store.persist(sim);
    const current = store.identity(sim).simulationId,
      oldFacts = structuredClone((await store.read(current)).story);
    sim.history.narration = 'Free model prose.';
    await store.persist(sim);
    assert.deepEqual((await store.read(current)).story, oldFacts);
    assert.equal((await store.story(current)).history.narration, 'Free model prose.');
    assert.equal((await store.list()).filter((r) => r.status === 'finished').length, 2);
    await store.remove(current);
    await store.persist(sim);
    await assert.rejects(store.read(current), /deleted/);
    store = new Persistence(dir, 1);
    await store.init();
    await assert.rejects(store.read(current), /deleted/);
    assert.equal((await store.list()).length, 1);
    assert.ok(
      (await readdir(path.join(dir, 'logs'))).filter((f) => f.endsWith('.json')).length <= 1,
    );
    await assert.rejects(store.read('../secret'));
    assert.equal((await store.story(id)).simulation_id, id);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('authoritative Story APIs, export formats, old snapshot after restart, errors and cross-origin DELETE', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'society-story-api-'));
  let runtime;
  try {
    runtime = await startServer({
      port: 0,
      dataDir: dir,
      publicBaseURL: 'https://society.example.test',
      config: { autoRestart: false },
    });
    const base = `http://localhost:${runtime.port}`;
    const sim = runtime.getSimulation();
    while (sim.status === 'running') sim.tick();
    await runtime.store.persist(sim);
    const id = runtime.store.identity(sim).simulationId;
    const get = (url) => fetch(base + url);
    const story = await (await get('/api/stories/' + id)).json();
    assert.equal(story.share.url, `https://society.example.test/story/${id}`);
    assert.equal(story.share.local, false);
    assert.equal((await (await get('/api/replays/' + id)).json()).simulation_id, id);
    assert.equal((await get('/story/' + id)).status, 200);
    await fetch(base + '/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restart', value: 42 }),
    });
    assert.equal((await (await get('/api/stories/' + id)).json()).seed, sim.config.seed);
    const md = await get('/api/stories/' + id + '/export?format=markdown&lang=en');
    assert.equal(md.status, 200);
    const mdText = await md.text();
    assert.ok(
      mdText.includes('Major moments') && mdText.includes('Historian') && mdText.includes('Vex'),
    );
    assert.ok(md.headers.get('content-disposition').includes(id + '.md'));
    const html = await (await get('/story/' + id + '?lang=en')).text();
    assert.ok(
      html.includes('property="og:title"') &&
        html.includes('property="og:description"') &&
        !html.includes('NEVER_EXPORT'),
    );
    const bad = await get('/api/stories/' + newStoryId());
    assert.equal(bad.status, 404);
    assert.equal(
      (
        await fetch(base + '/api/stories/' + id, {
          method: 'DELETE',
          headers: { Origin: 'https://hostile.test' },
        })
      ).status,
      403,
    );
    assert.equal((await fetch(base + '/api/stories/' + id, { method: 'DELETE' })).status, 200);
    assert.equal((await get('/api/stories/' + id)).status, 410);
    assert.equal(
      (await (await get('/api/stories')).json()).some((r) => r.id === id),
      false,
    );
  } finally {
    if (runtime) await runtime.close();
    await rm(dir, { recursive: true, force: true });
  }
});
