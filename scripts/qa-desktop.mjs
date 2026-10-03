import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const executablePath = process.argv[2] ?? 'builds/win-unpacked/AI Survival Society.exe';
const profile = path.resolve(`.qa/desktop-locale-${Date.now()}`);
const env = { ...process.env, SOCIETY_USER_DATA_DIR: profile };
const errors = [],
  checks = [],
  ports = [],
  fonts = [],
  viewports = [];
let app;
async function launch() {
  app = await electron.launch({ executablePath, env, args: [], timeout: 60000 });
  const page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('heading', { name: 'AI SURVIVAL SOCIETY', exact: true }).waitFor();
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(700);
  ports.push(new URL(page.url()).port);
  return page;
}
try {
  let page = await launch();
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-TW');
  await page.getByTestId('pause').click();
  await page.getByRole('button', { name: '繼續', exact: true }).waitFor();
  await page.getByTestId('pause').click();
  await page.getByTestId('restart').click();
  await page.getByRole('combobox', { name: '所選角色' }).selectOption('Agent_04');
  assert.equal(await page.getByRole('combobox', { name: '所選角色' }).inputValue(), 'Agent_04');
  await page.getByRole('button', { name: '重設攝影機' }).click();
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
  ]) {
    await app.evaluate(
      ({ BrowserWindow }, { width, height }) =>
        BrowserWindow.getAllWindows()[0].setContentSize(width, height),
      { width, height },
    );
    // Pin the renderer viewport; Windows 125% scaling otherwise rounds window
    // client dimensions by a few CSS pixels.
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    const viewport = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scale: devicePixelRatio,
    }));
    viewports.push(viewport);
    assert.equal(viewport.width, width);
    assert.equal(viewport.height, height);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: `docs/images/v1.6-zh-TW-desktop-${width}.png`, scale: 'css' });
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: '.brand > span',
  });
  fonts.push(...(await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts);
  assert.ok(fonts.some((f) => /JhengHei/i.test(f.familyName) && f.glyphCount > 0));
  checks.push(
    'Fresh desktop profile defaults to zh-TW; Chinese glyphs, 1920x1080/1366x768, pause/resume/restart/selection/camera',
  );
  console.log('PASS', checks.at(-1));
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.getByTestId('language-select').selectOption('en');
  await page.waitForFunction(
    async () => (await fetch('/api/preferences').then((r) => r.json())).language === 'en',
  );
  await app.close();
  app = null;
  page = await launch();
  await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.notEqual(ports[0], ports[1]);
  checks.push('English persists after actual app close/relaunch on a different ephemeral port');
  console.log('PASS', checks.at(-1));
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByTestId('language-select').selectOption('zh-TW');
  await page.waitForFunction(
    async () => (await fetch('/api/preferences').then((r) => r.json())).language === 'zh-TW',
  );
  await app.close();
  app = null;
  page = await launch();
  await page.getByRole('button', { name: '設定', exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-TW');
  checks.push('Traditional Chinese persists after a second actual close/relaunch');
  console.log('PASS', checks.at(-1));
  const security = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  );
  assert.equal(security.nodeIntegration, false);
  assert.equal(security.contextIsolation, true);
  assert.equal(security.sandbox, true);
  assert.deepEqual(errors, []);
  await writeFile(
    'docs/qa/desktop-results-v1.6.json',
    JSON.stringify(
      {
        executablePath,
        checks,
        ports,
        viewports,
        fonts,
        rendererErrors: errors,
        nodeIntegration: security.nodeIntegration,
        contextIsolation: security.contextIsolation,
        sandbox: security.sandbox,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS packaged zh-TW desktop, both resolutions, CJK fonts, controls, 3 launches, language persistence and sandbox',
  );
} finally {
  await app?.close();
}
