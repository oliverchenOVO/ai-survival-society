import { chromium } from 'playwright';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import net from 'node:net';
const probe = net.createServer();
await new Promise((resolve) => probe.listen(0, 'localhost', resolve));
const debugPort = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const exe = path.resolve(process.argv[2] ?? 'builds/AI-Survival-Society-1.7.0.exe');
const profile = path.resolve(`.qa/portable-locale-${Date.now()}`);
const env = { ...process.env, SOCIETY_USER_DATA_DIR: profile };
const processHandle = spawn(exe, [`--remote-debugging-port=${debugPort}`], {
  stdio: 'ignore',
  windowsHide: true,
  env,
});
let browser, page, repeatedLaunch;
try {
  // NSIS must decompress the complete Electron runtime on a cold launch.
  // On a loaded host this can exceed two minutes before Chromium exists.
  const deadline = Date.now() + 300000;
  let port;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${debugPort}/json/version`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        port = debugPort;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(port, 'Portable must start its Chromium debug target within 300 seconds');
  console.log('Portable Chromium endpoint ready');
  // The debug endpoint can open before Chromium finishes the cold NSIS launch.
  browser = await chromium.connectOverCDP(`http://localhost:${port}`, { timeout: 60000 });
  console.log('Portable DevTools attached');
  page =
    browser
      .contexts()[0]
      .pages()
      .find((p) => p.url().startsWith('http://localhost:')) ?? browser.contexts()[0].pages()[0];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('heading', { name: 'AI SURVIVAL SOCIETY', exact: true }).waitFor();
  await page.locator('canvas').waitFor();
  console.log('Portable world canvas ready');
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-TW');
  await page.getByTestId('restart').click();
  await page.waitForTimeout(300);
  await page.getByTestId('pause').click();
  await page.getByRole('button', { name: '繼續', exact: true }).waitFor();
  await page.getByTestId('pause').click();
  await page.getByRole('combobox', { name: '所選角色' }).selectOption('Agent_04');
  assert.equal(await page.getByRole('combobox', { name: '所選角色' }).inputValue(), 'Agent_04');
  await page.getByRole('button', { name: '重設攝影機' }).click();
  await page.waitForTimeout(800);
  assert.equal(await page.locator('canvas').count(), 1);
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.deepEqual(errors, []);
  const origin = new URL(page.url()).origin;
  await page.request.post(origin + '/api/control', { data: { action: 'pause' } });
  const beforeRepeat = await page.request.get(origin + '/api/state').then((r) => r.json());
  repeatedLaunch = spawn(exe, [], { stdio: 'ignore', windowsHide: true, env });
  const repeatDeadline = Date.now() + 300000;
  while (repeatedLaunch.exitCode === null && Date.now() < repeatDeadline)
    await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(
    repeatedLaunch.exitCode,
    0,
    'Repeated launch must exit through the single-instance lock',
  );
  const afterRepeat = await page.request.get(origin + '/api/state').then((r) => r.json());
  assert.equal(afterRepeat.matchId, beforeRepeat.matchId);
  assert.equal(afterRepeat.elapsed, beforeRepeat.elapsed);
  await page.reload();
  await page.locator('canvas').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-TW');
  assert.deepEqual(errors, []);
  console.log(
    'PASS repeat launch preserves the running instance, snapshot and extracted renderer files',
  );
  await page.screenshot({ path: 'docs/images/v1.7-zh-TW-portable-build.png' });
  await writeFile(
    'docs/qa/portable-results-v1.7.json',
    JSON.stringify(
      {
        executablePath: exe,
        launch: 'PASS',
        locale: 'zh-TW',
        canvas: 'PASS',
        pauseResumeRestartSelection: 'PASS',
        repeatedLaunchPreservesFirstInstance: 'PASS',
        rendererNodeAccess: 'unavailable',
        rendererErrors: errors,
        verificationMethod:
          'Real portable executable launched, then attached through Chromium DevTools. NSIS does not forward the stderr awaited by electron.launch.',
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS actual portable executable, canvas, pause/resume/restart, selection and renderer isolation',
  );
} catch (error) {
  console.error('Portable QA failed:', error.message);
  throw error;
} finally {
  let cleanupTimeout;
  await Promise.race([
    (async () => {
      if (page && !page.isClosed()) await page.close().catch(() => {});
      await browser?.close().catch(() => {});
    })(),
    new Promise((resolve) => {
      cleanupTimeout = setTimeout(resolve, 10000);
    }),
  ]);
  clearTimeout(cleanupTimeout);
  for (const ownedProcess of [repeatedLaunch, processHandle])
    if (ownedProcess && ownedProcess.exitCode === null)
      await promisify(execFile)('taskkill', ['/PID', String(ownedProcess.pid), '/T', '/F'], {
        windowsHide: true,
        timeout: 10000,
      }).catch(() => {});
}
