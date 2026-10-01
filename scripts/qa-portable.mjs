import { chromium } from 'playwright';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const debugFile = path.join(process.env.APPDATA, 'ai-survival-society', 'DevToolsActivePort');
const oldStamp = await stat(debugFile)
  .then((s) => s.mtimeMs)
  .catch(() => 0);
const exe = path.resolve('builds/AI-Survival-Society-1.0.0.exe');
const processHandle = spawn(exe, ['--remote-debugging-port=0'], { stdio: 'ignore' });
let browser, page;
try {
  const deadline = Date.now() + 120000;
  let port;
  while (Date.now() < deadline) {
    const stamp = await stat(debugFile)
      .then((s) => s.mtimeMs)
      .catch(() => 0);
    if (stamp > oldStamp) {
      port = Number((await readFile(debugFile, 'utf8')).split('\n')[0]);
      if (port) break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(port, 'Portable must start its Chromium debug target within 120 seconds');
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 10000 });
  page =
    browser
      .contexts()[0]
      .pages()
      .find((p) => p.url().startsWith('http://127.0.0.1:')) ?? browser.contexts()[0].pages()[0];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('heading', { name: 'AI SURVIVAL SOCIETY', exact: true }).waitFor();
  await page.locator('canvas').waitFor();
  await page.getByTestId('restart').click();
  await page.waitForTimeout(300);
  await page.getByTestId('pause').click();
  await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
  await page.getByTestId('pause').click();
  await page.getByRole('combobox', { name: 'Selected agent' }).selectOption('Agent_04');
  assert.equal(
    await page.getByRole('combobox', { name: 'Selected agent' }).inputValue(),
    'Agent_04',
  );
  await page.getByRole('button', { name: 'Reset camera' }).click();
  await page.waitForTimeout(800);
  assert.equal(await page.locator('canvas').count(), 1);
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: 'docs/images/portable-build.png' });
  await writeFile(
    'docs/qa/portable-results.json',
    JSON.stringify(
      {
        executablePath: 'builds/AI-Survival-Society-1.0.0.exe',
        launch: 'PASS',
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
