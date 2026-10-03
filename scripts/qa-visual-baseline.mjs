import { startServer } from '../server/index.mjs';
import { launchBrowser } from './qa-runtime.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const version = process.argv[2] ?? 'v1.5';
await mkdir('docs/images', { recursive: true });
const runtime = await startServer({
  port: 0,
  dataDir: `.qa/baseline-${Date.now()}`,
  config: { seed: 7, autoRestart: false },
});
let browser;
try {
  const sim = runtime.getSimulation();
  sim.status = 'running';
  while (sim.elapsed < 90) sim.tick();
  sim.status = 'paused';
  browser = await launchBrowser({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`http://localhost:${runtime.port}`);
  await page.locator('.living-hud').waitFor();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `docs/images/${version}-baseline-seed7-t90.png` });
  await writeFile(
    `docs/qa/${version}-baseline.json`,
    JSON.stringify(
      {
        seed: sim.config.seed,
        elapsed: sim.elapsed,
        camera: [37, 23, 43],
        target: [0, 3, 0],
        viewport: [1920, 1080],
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await runtime.close();
}
