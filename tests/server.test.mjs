import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { once } from 'node:events';
import { startServer } from '../server/index.mjs';

test('shutdown saves the world and closes unfinished HTTP headers without waiting for timeout', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'society-shutdown-'));
  const runtime = await startServer({ port: 0, dataDir: dir });
  const socket = net.createConnection({ host: 'localhost', port: runtime.port });
  let timer;
  try {
    await once(socket, 'connect');
    socket.write('GET /api/state HTTP/1.1\r\nHost: localhost\r\n');
    await new Promise((resolve) => setTimeout(resolve, 30));
    const closed = once(socket, 'close');
    await Promise.race([
      runtime.close(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Shutdown hung on incomplete HTTP headers')), 3000); }),
    ]);
    await closed;
    assert.ok((await readdir(path.join(dir, 'saves'))).some((f) => f.endsWith('.json')));
  } finally {
    clearTimeout(timer);
    socket.destroy();
    assert.ok(path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(dir, { recursive: true, force: true });
  }
});
test('HTTP controls, persistence, archive, bad inputs and cross-origin protection work end to end', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'society-test-')),
    runtime = await startServer({ port: 0, dataDir: dir });
  const base = `http://localhost:${runtime.port}`;
  const get = (url) => fetch(base + url).then((r) => r.json());
  const post = async (url, body) => {
    const res = await fetch(base + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
  };
  try {
    assert.equal((await get('/api/health')).ok, true);
    assert.equal((await get('/api/state')).agents.length, 12);
    await post('/api/control', { action: 'pause' });
    const time = (await get('/api/state')).elapsed;
    await new Promise((r) => setTimeout(r, 350));
    assert.equal((await get('/api/state')).elapsed, time);
    await post('/api/control', { action: 'resume' });
    await new Promise((r) => setTimeout(r, 350));
    assert.ok((await get('/api/state')).elapsed > time);
    assert.equal((await post('/api/control', { action: 'speed', value: 8 })).data.speed, 8);
    assert.equal((await post('/api/control', { action: 'speed', value: Infinity })).status, 400);
    assert.equal((await post('/api/director', { event: 'storm' })).status, 200);
    assert.equal((await post('/api/director', { event: 'bad' })).status, 400);
    assert.equal((await post('/api/control', { action: 'restart', value: 7 })).data.seed, 7);
    assert.equal((await post('/api/control', { action: 'restart', value: -1 })).status, 400);
    const saved = await post('/api/save', {});
    assert.equal(saved.data.saved, true);
    const list = await get('/api/replays');
    assert.ok(list.some((r) => r.id === saved.data.id));
    const replay = await get(`/api/replays/${saved.data.id}`);
    assert.equal(replay.schemaVersion, 1);
    assert.ok(Array.isArray(replay.events));
    assert.equal(
      (await post('/api/config/llm', { endpoint: 'file:///C:/', provider: 'ollama' })).status,
      400,
    );
    const forbidden = await fetch(base + '/api/control', {
      method: 'POST',
      headers: { Origin: 'https://malicious.example', 'Content-Type': 'application/json' },
      body: '{"action":"pause"}',
    });
    assert.equal(forbidden.status, 403);
    const exported = await get('/api/export');
    assert.equal(exported.agents.length, 12);
    assert.ok(exported.events[0].position);
    assert.ok((await readdir(path.join(dir, 'logs'))).some((f) => f.endsWith('.json')));
  } finally {
    await runtime.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test('continuous mode preserves completed stories and retains bounded debug logs', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'society-continuous-'));
  const runtime = await startServer({
    port: 0,
    dataDir: dir,
    config: { matchDuration: 12, restartDelaySeconds: 0.15, maxStoredMatches: 3 },
  });
  const base = `http://localhost:${runtime.port}`;
  const initial = runtime.getSimulation().config.seed;
  try {
    await fetch(base + '/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'speed', value: 32 }),
    });
    const deadline = Date.now() + 45000;
    while (runtime.getSimulation().config.seed < initial + 4 && Date.now() < deadline)
      await new Promise((r) => setTimeout(r, 100));
    assert.ok(
      runtime.getSimulation().config.seed >= initial + 4,
      'continuous mode must start at least four subsequent worlds',
    );
    await fetch(base + '/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const runs = await fetch(base + '/api/replays').then((r) => r.json());
    assert.ok(runs.filter((r) => r.status === 'finished').length >= 4);
    assert.ok(runs.filter((r) => r.status !== 'finished').length <= 3);
    assert.ok(runs.some((r) => r.status === 'finished'));
    assert.ok(
      (await readdir(path.join(dir, 'logs'))).filter((f) => f.endsWith('.json')).length <= 3,
    );
  } finally {
    await runtime.close();
    await rm(dir, { recursive: true, force: true });
  }
});
