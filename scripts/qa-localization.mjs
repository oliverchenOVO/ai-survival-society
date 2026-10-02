import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { startServer } from '../server/index.mjs';
import { NAMES } from '../core/agents.mjs';

const runtime = await startServer({
  port: 0,
  dataDir: `.qa/locale-${Date.now()}`,
  config: { autoRestart: false },
});
const base = `http://127.0.0.1:${runtime.port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [],
  checks = [],
  layouts = [],
  fonts = [];
const sockets = [];
let disconnect = false;
await page.routeWebSocket('**/ws', (socket) => {
  if (disconnect) socket.close();
  else {
    socket.connectToServer();
    sockets.push(socket);
  }
});
page.on('pageerror', (e) => errors.push(e.message));
const post = (url, data) => page.request.post(base + url, { data });
const check = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
const allowed = new Set([
  'ID',
  'Markdown',
  'AI',
  'SURVIVAL',
  'SOCIETY',
  'AGENT',
  'INSPECTOR',
  'CURRENT',
  'DECISION',
  'DIRECTOR',
  'MODE',
  'Utility',
  'LLM',
  'Seed',
  'SEED',
  'HP',
  'API',
  'English',
  'OpenAI',
  'Ollama',
  'JSON',
  'ms',
  'm',
  'N',
  'D',
  'LLM_API_KEY',
  ...NAMES,
  ...NAMES.map((n) => n.toUpperCase()),
]);
async function audit(label) {
  // Audit rendered copy and accessibility/tooltips, excluding technical input values.
  const text = await page.evaluate(
    () =>
      document.body.innerText +
      '\n' +
      [...document.querySelectorAll('[title],[aria-label]')]
        .map((e) => e.getAttribute('title') || e.getAttribute('aria-label'))
        .join('\n'),
  );
  const words = [
    ...new Set(text.replace(/S-[0-9A-HJKMNP-TV-Z]{16}/g, '').match(/[A-Za-z_]+/g) ?? []),
  ].filter((w) => !allowed.has(w));
  assert.deepEqual(words, [], `${label}: residual English`);
  const result = await page.evaluate(() => {
    const clipped = [
      ...document.querySelectorAll(
        'button, .panel-title, .director-actions strong, .director-actions small, .trait > span, .topbar, .simulation-strip',
      ),
    ]
      .filter((e) => {
        const r = e.getBoundingClientRect(),
          s = getComputedStyle(e);
        return r.width && r.height && s.display !== 'none' && e.scrollWidth > e.clientWidth + 2;
      })
      .map((e) => ({ text: e.textContent.trim(), width: e.clientWidth, content: e.scrollWidth }));
    const overlaps = [];
    for (const row of document.querySelectorAll(
      '.topbar, .simulation-strip, .panel-title, .inventory, .modal-footer, .form-row',
    )) {
      const items = [...row.children].filter((e) => e.getBoundingClientRect().width > 0);
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i].getBoundingClientRect(),
            b = items[j].getBoundingClientRect();
          if (
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
          )
            overlaps.push(items[i].textContent.trim() + ' / ' + items[j].textContent.trim());
        }
    }
    return {
      width: innerWidth,
      height: innerHeight,
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
      clipped,
      overlaps,
    };
  });
  layouts.push({ label, ...result });
  assert.equal(result.pageOverflow, false, label);
  assert.deepEqual(result.clipped, [], `${label}: clipped controls`);
  assert.deepEqual(result.overlaps, [], `${label}: overlapping UI labels`);
}
async function close() {
  await page.getByRole('button', { name: '關閉視窗', exact: true }).click();
}
try {
  await mkdir('docs/images', { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(base);
  await page.locator('canvas').waitFor();
  await post('/api/control', { action: 'speed', value: 32 });
  await page.waitForTimeout(2000);
  await post('/api/control', { action: 'pause' });
  await page.waitForTimeout(400);
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-TW');
  check('Fresh profile defaults to zh-TW with real generated social events');
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(size);
    await audit(`world ${size.width}`);
    await page.screenshot({ path: `docs/images/zh-TW-world-${size.width}.png` });
    for (const [nav, title] of [
      ['角色', '十二個心智'],
      ['紀錄', '世界事件紀錄'],
      ['關係網', '社會的紋理'],
      ['導演模式', '導演模式'],
      ['模擬檔案庫', '模擬檔案庫'],
      ['設定', '模擬設定'],
    ]) {
      await page.getByRole('button', { name: nav, exact: true }).click();
      await page.getByRole('dialog', { name: title, exact: true }).waitFor();
      await page.waitForTimeout(200);
      await audit(`${nav} ${size.width}`);
      if (nav === '設定')
        await page.screenshot({ path: `docs/images/zh-TW-settings-${size.width}.png` });
      await close();
    }
    await page.getByRole('button', { name: '操作與作品說明' }).click();
    await audit(`help ${size.width}`);
    await close();
  }
  const cdp = await context.newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: '.brand > span',
  });
  fonts.push(...(await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts);
  assert.ok(
    fonts.some((f) => /JhengHei/i.test(f.familyName) && f.glyphCount > 0),
    JSON.stringify(fonts),
  );
  check('Windows actually renders CJK glyphs with Microsoft JhengHei fallback');
  await page.getByRole('button', { name: '設定', exact: true }).click();
  const simBefore = await page.request.get(base + '/api/state').then((r) => r.json());
  await page.getByTestId('language-select').selectOption('en');
  await page.getByRole('dialog', { name: 'Simulation settings' }).waitFor();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
  const simAfter = await page.request.get(base + '/api/state').then((r) => r.json());
  assert.deepEqual(simAfter, simBefore);
  check('Switch/reload preserves English and all paused simulation data');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByTestId('language-select').selectOption('zh-TW');
  await close();
  await post('/api/save', {});
  await page.getByRole('button', { name: '模擬檔案庫', exact: true }).click();
  await page.locator('.archive-list button').first().click();
  await page.getByRole('button', { name: '返回即時模擬' }).waitFor();
  await audit('replay');
  await page.getByRole('button', { name: '返回即時模擬' }).click();
  check('Archive loading, saved run, replay and return-live are translated');
  // Explicit QA fixtures exercise both ending presentations; production core is unchanged.
  const sim = runtime.getSimulation();
  sim.status = 'running';
  while (sim.status === 'running') sim.tick();
  assert.ok(sim.winner, 'This deterministic seed should finish with a survivor');
  await page.getByRole('dialog', { name: '島嶼記得一切' }).waitFor();
  await page.getByText('最終生還者', { exact: true }).waitFor();
  await audit('winner historian');
  await page.screenshot({ path: 'docs/images/zh-TW-result.png' });
  await close();
  await post('/api/control', { action: 'restart', value: 9 });
  const extinction = runtime.getSimulation();
  extinction.elapsed = 600;
  for (const a of extinction.agents) {
    a.hp = 0.01;
    a.position = { x: 30, z: 0 };
  }
  extinction.tick();
  await page.getByRole('dialog', { name: '島嶼記得一切' }).waitFor();
  await page.getByText('全滅事件', { exact: true }).waitFor();
  await audit('extinction historian');
  await page.screenshot({ path: 'docs/images/zh-TW-extinction.png' });
  await close();
  check('Winner, extinction and templated Historian contain no untranslated fixed prose');
  await page.getByRole('button', { name: '模擬檔案庫', exact: true }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await page.getByRole('status').filter({ hasText: '不支援' }).waitFor();
  await audit('invalid replay error');
  await close();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await page.route('**/api/preferences', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.getByTestId('language-select').selectOption('en');
  await page.getByRole('status').filter({ hasText: 'could not save preference' }).waitFor();
  await page.getByTestId('language-select').selectOption('zh-TW');
  await page.getByRole('status').filter({ hasText: '設定未能儲存' }).waitFor();
  check('Preference save failure is localized and never blocks the simulation');
  await close();
  disconnect = true;
  for (const socket of sockets) await socket.close();
  await page.getByText('重新連線中', { exact: true }).waitFor();
  check('Dropped live connection shows the localized reconnecting state');
  const offline = await context.newPage();
  await offline.route('**/api/state', (route) => route.abort());
  await offline.routeWebSocket('**/ws', (socket) => socket.close());
  // Serving the already-built shell while APIs are offline exercises initial loading.
  await offline.route(base + '/', (route) =>
    route.fulfill({ path: 'dist/index.html', contentType: 'text/html' }),
  );
  await offline.route(base + '/assets/**', async (route) => {
    const file = 'dist' + new URL(route.request().url()).pathname;
    await route.fulfill({ path: file });
  });
  await offline.goto(base);
  await offline.getByText('正在連接觀測站…', { exact: true }).waitFor();
  await offline.getByText('無法連接伺服器，請確認本機服務正在運行。', { exact: true }).waitFor();
  check('Offline initial loading and network failure messages are Traditional Chinese');
  await offline.close();
  assert.deepEqual(errors, []);
  await writeFile(
    'docs/qa/localization-browser.json',
    JSON.stringify(
      {
        browser: 'Playwright Chrome (Browser plugin unavailable)',
        checks,
        layouts,
        fonts,
        rendererErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await runtime.close();
}
