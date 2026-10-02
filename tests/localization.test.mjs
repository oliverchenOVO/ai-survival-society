import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  catalogs,
  translate,
  localizeText,
  localizeEvent,
  localizeHistory,
} from '../src/i18n/translate.mjs';
import { Simulation, DIRECTOR_EVENTS } from '../core/simulation.mjs';
import { startServer } from '../server/index.mjs';
import { proseLanguageInstruction } from '../server/llm.mjs';

test('catalogs have matching keys and interpolation parameters in both languages', () => {
  assert.deepEqual(Object.keys(catalogs.en).sort(), Object.keys(catalogs['zh-TW']).sort());
  for (const [key, value] of Object.entries(catalogs.en)) {
    assert.ok(catalogs['zh-TW'][key].trim(), key);
    const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(params(value), params(catalogs['zh-TW'][key]), key);
  }
  assert.equal(translate('stats.deathCount', 'zh-TW', { count: 12 }), '12 人死亡');
  assert.throws(() => translate('unknown.key'), /Missing localization key/);
});

test('real utility simulations and every Director event translate without mutating logs or decisions', () => {
  const types = new Set();
  for (const seed of [7, 42, 99, 123, 2048]) {
    const sim = new Simulation({ seed });
    for (const event of DIRECTOR_EVENTS) sim.director(event);
    while (sim.status === 'running') {
      sim.tick();
      for (const agent of sim.agents.filter((a) => a.alive)) {
        for (const field of ['goal', 'observed', 'public_reason'])
          assert.notEqual(
            localizeText(agent[field], 'zh-TW'),
            agent[field],
            `${field}: ${agent[field]}`,
          );
      }
    }
    const before = JSON.stringify(sim.export());
    for (const event of sim.bus.log) {
      types.add(event.event);
      assert.notEqual(localizeEvent(event, 'zh-TW'), event.result, event.result);
      assert.equal(localizeEvent(event, 'en'), event.result);
    }
    const localized = localizeHistory(sim.export(), 'zh-TW');
    for (const chapter of localized.chapters)
      assert.ok(
        !/formed an alliance|more events|shared food|Storm:|survive|damage/.test(chapter.text),
        chapter.text,
      );
    assert.equal(JSON.stringify(sim.export()), before);
  }
  for (const type of [
    'TRADE',
    'ALLIANCE_CREATED',
    'ATTACK',
    'DEATH',
    'CONVERSATION',
    'COOPERATION',
    'DECEPTION',
    'BETRAYAL',
  ])
    assert.ok(types.has(type), type);
});

test('free model prose stays original; concatenated history events translate independently', () => {
  const free = 'I will remember the stars when this island falls.';
  assert.equal(localizeText(free), free);
  assert.equal(
    localizeEvent({ result: `Nova → Atlas: “${free}”` }, 'zh-TW'),
    `Nova → Atlas：「${free}」`,
  );
  const state = {
    agents: [],
    winner: null,
    history: {
      narration: free,
      chapters: [
        {
          title: '01 · The first connections',
          text: 'Nova and Atlas formed an alliance. Iris and Echo formed an alliance. 4 more events followed.',
        },
      ],
    },
  };
  const history = localizeHistory(state, 'zh-TW');
  assert.equal(history.narration, free);
  assert.equal(
    history.chapters[0].text,
    'Nova 與 Atlas 建立同盟。 Iris 與 Echo 建立同盟。 其後另有 4 則事件。',
  );
  assert.match(proseLanguageInstruction('zh-TW'), /message and public_reason only/);
  assert.match(proseLanguageInstruction('zh-TW'), /Keep action enums and target IDs unchanged/);
});

test('language preference persists across server ports and does not alter paused simulation state', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'society-locale-'));
  let runtime;
  try {
    runtime = await startServer({ port: 0, dataDir: dir });
    let base = `http://127.0.0.1:${runtime.port}`;
    const post = (url, body) =>
      fetch(base + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const get = (url) => fetch(base + url).then((r) => r.json());
    assert.equal((await get('/api/preferences')).language, 'zh-TW');
    await post('/api/control', { action: 'pause' });
    const before = await get('/api/state');
    await post('/api/preferences', { language: 'en' });
    await post('/api/preferences', { language: 'zh-TW' });
    await post('/api/preferences', { language: 'en' });
    assert.deepEqual(await get('/api/state'), before);
    assert.equal((await post('/api/preferences', { language: 'invalid' })).status, 400);
    await runtime.close();
    runtime = await startServer({ port: 0, dataDir: dir });
    base = `http://127.0.0.1:${runtime.port}`;
    assert.equal((await get('/api/preferences')).language, 'en');
  } finally {
    await runtime?.close();
    await rm(dir, { recursive: true, force: true });
  }
});
