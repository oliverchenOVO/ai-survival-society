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
const exe = path.resolve(process.argv[2] ?? 'builds/AI-Survival-Society-1.5.0.exe');
const processHandle = spawn(exe, [`--remote-debugging-port=${debugPort}`], {
  stdio: 'ignore',
  windowsHide: true,
  env: { ...process.env, SOCIETY_USER_DATA_DIR: path.resolve(`.qa/portable-locale-${Date.now()}`) },
});
let browser, page;
try {
  const deadline = Date.now() + 120000;
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
  assert.ok(port, 'Portable must start its Chromium debug target within 120 seconds');
  browser = await chromium.connectOverCDP(`http://localhost:${port}`, { timeout: 10000 });
  page =
    browser
      .contexts()[0]
      .pages()
      .find((p) => p.url().startsWith('http://localhost:')) ?? browser.contexts()[0].pages()[0];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('heading', { name: 'AI SURVIVAL SOCIETY', exact: true }).waitFor();
  await page.locator('canvas').waitFor();
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
  await page.screenshot({ path: 'docs/images/v1.5-zh-TW-portable-build.png' });
  await writeFile(
    'docs/qa/portable-results-v1.5.json',
    JSON.stringify(
      {
        executablePath: exe,
        launch: 'PASS',
        locale: 'zh-TW',
        canvas: 'PASS',
        pauseResumeRestartSelection: 'PASS',
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
} finally {
  if (page && !page.isClosed()) await page.close().catch(() => {});
  await browser?.close().catch(() => {});
  if (processHandle.exitCode === null)
    await promisify(execFile)('taskkill', ['/PID', String(processHandle.pid), '/T', '/F'], {
      windowsHide: true,
    }).catch(() => {});
}
