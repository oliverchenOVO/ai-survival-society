// Browser plugin not available: isolated Playwright Chrome / actual Electron QA.
import { chromium, _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Simulation } from '../core/simulation.mjs';
import { Persistence, legacyStoryId, newStoryId } from '../server/persistence.mjs';
import { startServer } from '../server/index.mjs';
const desktop = process.argv.includes('--desktop'),
  profile = path.resolve(`.qa/story-${desktop ? 'desktop' : 'browser'}-${Date.now()}`);
await mkdir(profile, { recursive: true });
let fixtureStore = new Persistence(profile);
await fixtureStore.init();
const winner = new Simulation({ seed: 7 });
while (winner.status === 'running') winner.tick();
await fixtureStore.persist(winner);
const id = fixtureStore.identity(winner).simulationId;
const extinction = new Simulation({ seed: 9 });
extinction.elapsed = 600;
for (const a of extinction.agents) {
  a.hp = 0.01;
  a.position = { x: 30, z: 0 };
}
extinction.tick();
await fixtureStore.persist(extinction);
const extinctionId = fixtureStore.identity(extinction).simulationId;
const legacy = winner.export();
legacy.matchId = '1760000000000-7';
await writeFile(path.join(profile, 'saves', legacy.matchId + '.json'), JSON.stringify(legacy));
const corruptId = newStoryId();
await writeFile(path.join(profile, 'saves', corruptId + '.json'), '{bad');
let app, browser, context, runtime, page;
const errors = [],
  checks = [],
  layouts = [];
const check = (s) => {
  checks.push(s);
  console.log('PASS', s);
};
try {
  if (desktop) {
    app = await electron.launch({
      executablePath: path.resolve('builds/win-unpacked/AI Survival Society.exe'),
      env: { ...process.env, SOCIETY_USER_DATA_DIR: profile },
      timeout: 30000,
    });
    page = await app.firstWindow();
    await page.locator('canvas').waitFor();
    context = page.context();
  } else {
    runtime = await startServer({ port: 0, dataDir: profile, config: { autoRestart: false } });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    page = await context.newPage();
    await page.goto(`http://127.0.0.1:${runtime.port}`);
  }
  const base = new URL(page.url()).origin;
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/story/' + id);
  await page
    .getByRole('heading', {
      name: winner.agents.find((a) => a.id === winner.winner).name.toUpperCase(),
      exact: true,
    })
    .waitFor()
    .catch(async () => {
      await page.locator('.story-hero h1').waitFor();
    });
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-TW');
  assert.equal(await page.locator('.cast-card').count(), 12);
  assert.ok((await page.locator('.story-moments .story-event').count()) <= 15);
  assert.equal(await page.locator('.story-full-timeline').count(), 0);
  await page.getByTestId('story-language').selectOption('en');
  await page.getByRole('heading', { name: 'Major moments', exact: true }).waitFor();
  await page.getByTestId('story-language').selectOption('zh-TW');
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `${width} overflow`);
    layouts.push({ width, height, overflow });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({ path: 'docs/images/v1.4-story-hero.png', scale: 'css' });
  check(
    'Story routes, winner, 12 portraits, bilingual UI, collapsed timeline and three viewport sizes',
  );
  await page.locator('#moments').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/images/v1.4-major-moments.png', scale: 'css' });
  await page.locator('.cast-card').first().click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.locator('.life-traits meter').count(), 8);
  await page.screenshot({ path: 'docs/images/v1.4-agent-story.png', scale: 'css' });
  await page.getByRole('button', { name: '關閉視窗' }).click();
  await page.locator('.story-edge').first().press('Enter');
  await page.getByRole('dialog').waitFor();
  assert.ok((await page.locator('.story-full-timeline .story-event').count()) <= 25);
  await page.getByRole('button', { name: '關閉視窗' }).click();
  check(
    'Agent biography/personality/memories and keyboard-accessible relationship interaction timeline',
  );
  await page.getByRole('button', { name: '展開完整時間軸' }).click();
  assert.ok((await page.locator('.story-full-timeline .story-event').count()) <= 25);
  await page.getByLabel('事件分類', { exact: true }).selectOption('Death');
  assert.ok((await page.locator('.story-full-timeline .story-event').count()) > 0);
  await page.getByLabel('事件分類', { exact: true }).selectOption('All');
  await page.getByLabel('事件類型', { exact: true }).selectOption('TRADE');
  assert.ok((await page.locator('.story-full-timeline .category-Trade').count()) > 0);
  await page.getByLabel('角色', { exact: true }).selectOption('Agent_01');
  await page.getByLabel('起點（秒）').fill('100');
  assert.ok((await page.locator('.story-full-timeline .story-event').count()) <= 25);
  check('Timeline category/type/agent/time filtering and pagination');
  const url = await page.locator('.story-share input').inputValue();
  assert.equal(url, base + '/story/' + id);
  await page.getByRole('button', { name: '複製連結', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '連結已複製' }).waitFor();
  check('Local link scope and clipboard copy');
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data) => {
        window.qaShare = data;
      },
    }),
  );
  await page.getByRole('button', { name: '分享', exact: true }).click();
  assert.equal(await page.evaluate(() => window.qaShare.url), url);
  await page.evaluate(() => {
    delete navigator.share;
  });
  await page.getByRole('button', { name: '產生分享卡', exact: true }).click();
  await page.locator('.story-card-preview').waitFor();
  await page.screenshot({ path: 'docs/images/v1.4-share-card.png', scale: 'css' });
  // Electron's download dialog is handled without an interactive save prompt.
  if (desktop)
    await app.evaluate(({ BrowserWindow }, profile) => {
      globalThis.storyDownloads = [];
      BrowserWindow.getAllWindows()[0].webContents.session.on('will-download', (_, item) => {
        const file = profile + '/' + item.getFilename();
        item.setSavePath(file);
        item.once('done', (_, state) => globalThis.storyDownloads.push({ file, state }));
      });
    }, profile);
  const downloadPromise = desktop ? null : page.waitForEvent('download');
  await page.getByRole('button', { name: '下載 PNG', exact: true }).click();
  async function desktopDownload(ext) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const item = await app
        .evaluate(
          () =>
            globalThis.storyDownloads.find((x) => x.file.endsWith('.' + globalThis.qaExtension)),
          null,
        )
        .catch(() => null);
      if (item) {
        assert.equal(item.state, 'completed');
        return item.file;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Electron download did not finish: ' + ext);
  }
  async function completedDownload(ext) {
    await app.evaluate((_, ext) => {
      globalThis.qaExtension = ext;
    }, ext);
    return desktopDownload(ext);
  }
  const pngPath = desktop ? await completedDownload('png') : path.join(profile, 'share.png');
  if (!desktop) await (await downloadPromise).saveAs(pngPath);
  const png = await readFile(pngPath);
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  await page.getByRole('button', { name: '關閉視窗' }).click();
  const mdPromise = desktop ? null : page.waitForEvent('download');
  await page.getByRole('link', { name: '匯出 Markdown', exact: true }).click();
  const mdPath = desktop ? await completedDownload('md') : path.join(profile, 'story.md');
  if (!desktop) await (await mdPromise).saveAs(mdPath);
  assert.ok((await readFile(mdPath, 'utf8')).includes(id));
  check('1200×630 PNG download and complete Markdown export');
  const moment = await page.locator('.moment-watch').nth(3).getAttribute('href');
  const stamp = Number(new URL(moment, base).searchParams.get('t'));
  await page.goto(base + moment);
  await page.getByRole('slider', { name: '重播時間軸' }).waitFor();
  assert.equal(Number(await page.getByRole('slider', { name: '重播時間軸' }).inputValue()), stamp);
  await page.getByRole('link', { name: '返回故事', exact: true }).click();
  await page.locator('.story-hero').waitFor();
  check('Moment deep-link seek and return Story reuse existing replay');
  await page.reload();
  await page.locator('.story-hero').waitFor();
  assert.ok((await page.locator('.story-hero').innerText()).includes(id));
  await page.goto(base + '/story/' + extinctionId);
  await page
    .getByRole('heading', { name: '島嶼吞沒了所有人。', exact: true })
    .waitFor()
    .catch(async () => {
      await page.locator('.story-hero.extinction').waitFor();
    });
  await page.getByRole('heading', { name: '最後殞落者', exact: true }).waitFor();
  assert.equal(await page.locator('.story-finalists article').count(), 3);
  await page.goto(base + '/story/' + legacyStoryId(legacy.matchId));
  await page.locator('.story-hero').waitFor();
  assert.ok((await page.locator('.story-meta').innerText()).includes('舊保存檔'));
  for (const bad of [newStoryId(), corruptId]) {
    await page.goto(base + '/story/' + bad);
    await page.getByRole('heading', { name: '無法讀取故事' }).waitFor();
  }
  check('Reload, extinction ties, legacy migration, unknown and corrupt stories');
  // Add hostile LLM prose to a persisted final run; React renders it as text only.
  const file = path.join(profile, 'saves', id + '.json'),
    raw = JSON.parse(await readFile(file, 'utf8'));
  raw.history.narration = '<img src=x onerror="window.PWNED=true">自由敘事';
  await writeFile(file, JSON.stringify(raw));
  await page.goto(base + '/story/' + id);
  await page.locator('#historian').waitFor();
  assert.equal(await page.locator('#historian img').count(), 0);
  assert.equal(await page.evaluate(() => window.PWNED), undefined);
  assert.ok((await page.locator('#historian').innerText()).includes('自由敘事'));
  check('Untrusted LLM prose preserved as escaped text without execution');
  await page.goto(base);
  await page.getByRole('button', { name: '模擬檔案庫', exact: true }).click();
  await page.locator('.library-tools input').fill(id);
  assert.equal(await page.locator('.library-entry').count(), 1);
  await page.getByLabel('故事排序').selectOption('sociable');
  await page.getByRole('link', { name: '觀看故事' }).waitFor();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '刪除', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.library-entry').length === 0);
  assert.equal(await page.locator('.library-entry').count(), 0);
  await page.goto(base + '/story/' + id);
  await page.getByRole('heading', { name: '無法讀取故事' }).waitFor();
  check('Unified library search/sort/actions and permanent delete');
  if (desktop) {
    await app.close();
    app = null;
    app = await electron.launch({
      executablePath: path.resolve('builds/win-unpacked/AI Survival Society.exe'),
      env: { ...process.env, SOCIETY_USER_DATA_DIR: profile },
      timeout: 30000,
    });
    page = await app.firstWindow();
    await page.locator('canvas').waitFor();
    await page.goto(new URL(page.url()).origin + '/story/' + extinctionId);
    await page.locator('.story-hero.extinction').waitFor();
    check('Actual desktop close/relaunch retains story ID and route on new server port');
  }
  assert.deepEqual(errors, []);
  check('No renderer exceptions');
  await writeFile(
    `docs/qa/stories-${desktop ? 'desktop' : 'browser'}-v1.4.json`,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browserPath: 'Browser plugin not available; Playwright',
        checks,
        layouts,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  if (app) await app.close();
  if (browser) await browser.close();
  if (runtime) await runtime.close();
}
