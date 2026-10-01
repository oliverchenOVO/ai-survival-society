import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Simulation } from '../core/simulation.mjs';
import { validateDecision, ModelQueue } from '../server/llm.mjs';
test('model schema rejects arbitrary actions, illegal targets, malformed content and trims long text', () => {
  const s = new Simulation(),
    a = s.agents[0],
    valid = {
      action: 'talk',
      target: s.agents[1].id,
      message: 'Hello',
      public_reason: 'Look for cooperation.',
    };
  assert.equal(validateDecision(valid, s, a).action, 'talk');
  for (const v of [
    { ...valid, action: 'shell' },
    { ...valid, target: 'not-an-agent' },
    { ...valid, target: a.id },
    { ...valid, public_reason: null },
    { ...valid, action: 'rest' },
  ])
    assert.throws(() => validateDecision(v, s, a));
  assert.equal(validateDecision({ ...valid, message: 'x'.repeat(999) }, s, a).message.length, 240);
});
test('slow or invalid model replies fall back without blocking simulation, and queue remains bounded', async () => {
  const server = http.createServer((req, res) => {
    setTimeout(() => {
      if (!res.destroyed) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: { content: '{"action":"shell"}' } }));
      }
    }, 350);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const s = new Simulation();
  let current = s;
  const queue = new ModelQueue(
    {
      enabled: true,
      provider: 'ollama',
      endpoint: `http://127.0.0.1:${server.address().port}`,
      model: 'fake',
      temperature: 0.5,
      timeoutMs: 100,
      intervalSeconds: 22,
      concurrency: 1,
      maxQueue: 6,
    },
    () => current,
  );
  for (const a of s.agents) a.nextLLM = 0;
  queue.schedule(s);
  assert.ok(queue.pending.length <= 6);
  const start = Date.now();
  for (let i = 0; i < 100; i++) s.tick();
  assert.ok(Date.now() - start < 2000);
  assert.equal(s.elapsed, 25);
  await new Promise((resolve) => setTimeout(resolve, 170));
  assert.ok(queue.status.failed >= 1);
  assert.ok(s.agents.every((a) => a.decisionSource === 'utility'));
  current = new Simulation();
  queue.reset();
  queue.config.enabled = false;
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(current.modelDecisions.size, 0);
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
