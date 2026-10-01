import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const executablePath = process.argv[2] ?? 'builds/win-unpacked/AI Survival Society.exe';
const app = await electron.launch({ executablePath, args: [] });
const errors = [];
try {
  const page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('heading', { name: 'AI SURVIVAL SOCIETY', exact: true }).waitFor();
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(1500);
  assert.equal(await page.title(), 'AI Survival Society');
  await page.getByTestId('pause').click();
  await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
  await page.getByTestId('pause').click();
  await page.getByRole('button', { name: 'Restart simulation' }).click();
  await page.getByRole('combobox', { name: 'Selected agent' }).selectOption('Agent_04');
  assert.equal(
    await page.getByRole('combobox', { name: 'Selected agent' }).inputValue(),
    'Agent_04',
  );
  await page.getByRole('button', { name: 'Reset camera' }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/images/desktop-build.png' });
  const security = await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return w.webContents.getLastWebPreferences();
  });
  assert.equal(security.nodeIntegration, false);
  assert.equal(security.contextIsolation, true);
  assert.equal(security.sandbox, true);
  assert.deepEqual(errors, []);
  await writeFile(
    'docs/qa/desktop-results.json',
    JSON.stringify(
      {
        executablePath,
        title: await page.title(),
        rendererErrors: errors,
        pauseResumeRestartSelection: 'PASS',
        nodeIntegration: security.nodeIntegration,
        contextIsolation: security.contextIsolation,
        sandbox: security.sandbox,
      },
      null,
      2,
    ),
  );
  console.log('PASS packaged desktop launch, canvas, pause/resume/restart, selection and sandbox');
} finally {
  await app.close();
}
