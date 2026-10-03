import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { launchBrowser } from './qa-runtime.mjs';

// Browser plugin unavailable: exercise the real npm-dev entry point through Chrome.
const probe = net.createServer();
await new Promise((resolve) => probe.listen(0, 'localhost', resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const profile = path.resolve(`.qa/dev-${Date.now()}`);
await mkdir(profile, { recursive: true });
const child = spawn(process.execPath, ['scripts/dev.mjs'], {
  env: { ...process.env, DATA_DIR: profile, PORT: '0', SOCIETY_DEV_PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let output = '',
  browser;
child.stdout.on('data', (data) => {
  output += data;
});
child.stderr.on('data', (data) => {
  output += data;
});
try {
  const base = `http://localhost:${port}`;
  let ready = false;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      ready = (await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })).ok;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Development proxy did not start: ' + output);
  browser = await launchBrowser({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  await page.locator('canvas').waitFor({ timeout: 60000 });
  await page.locator('.living-hud').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-TW');
  const before = await page.request.get(base + '/api/state').then((r) => r.json());
  await page.waitForTimeout(1500);
  const after = await page.request.get(base + '/api/state').then((r) => r.json());
  assert.ok(after.elapsed > before.elapsed, 'Development simulation stalled');
  assert.ok(
    (await page.locator('.simulation-strip').innerText()).includes('已連線'),
    'WebSocket proxy disconnected',
  );
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.deepEqual(errors, []);
  await writeFile(
    'docs/qa/development-v1.6.json',
    JSON.stringify(
      {
        version: '1.5.0',
        date: new Date().toISOString(),
        entry: 'scripts/dev.mjs',
        frontend: base,
        checks: [
          'Isolated dev entry starts',
          'HTTP and WebSocket proxy connect to allocated backend',
          'Actual unbundled React/Three.js canvas renders in zh-TW',
          'Simulation advances without renderer errors',
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS development entry, localhost HTTP/WebSocket proxy, React canvas and simulation progression',
  );
} finally {
  if (browser) await browser.close();
  if (child.exitCode === null) {
    if (process.platform === 'win32') {
      try {
        execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
      } catch {}
    } else child.kill('SIGTERM');
  }
}
