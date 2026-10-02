import { chromium } from 'playwright';
import { startServer } from '../server/index.mjs';
import { mkdir } from 'node:fs/promises';
const runtime = await startServer({ port: 0, dataDir: '.qa/video-data' }),
  base = `http://127.0.0.1:${runtime.port}`;
await mkdir('.qa/video', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: '.qa/video', size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const post = (url, data) => page.request.post(base + url, { data });
try {
  await page.addInitScript(() => localStorage.setItem('society.locale.v1', 'en'));
  await page.goto(base);
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(1000);
  await post('/api/control', { action: 'auto_restart', value: false });
  await post('/api/control', { action: 'restart', value: 7 });
  await post('/api/control', { action: 'speed', value: 8 });
  await page.waitForTimeout(3500);
  await page.getByRole('combobox', { name: 'Selected agent' }).selectOption('Agent_03');
  await page.getByRole('button', { name: 'Follow selected agent' }).click();
  await page.getByRole('button', { name: 'Show world relationships' }).click();
  await page.waitForTimeout(3000);
  await post('/api/director', { event: 'supply_drop' });
  await page.waitForTimeout(3000);
  await post('/api/director', { event: 'rumor' });
  await page.waitForTimeout(2000);
  await post('/api/director', { event: 'storm' });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Reset camera' }).click();
  await page.waitForTimeout(2500);
  const video = page.video();
  await context.close();
  await video.saveAs('.qa/video/society-demo.webm');
  console.log('Video captured at .qa/video/society-demo.webm');
} finally {
  await browser.close();
  await runtime.close();
}
