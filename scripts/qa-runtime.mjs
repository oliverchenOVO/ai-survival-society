import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
export async function closeElectron(app) {
  const owned = app.process();
  let timeout;
  const closed = await Promise.race([
    app.close().then(
      () => true,
      () => false,
    ),
    new Promise((resolve) => {
      timeout = setTimeout(() => resolve(false), 10000);
    }),
  ]);
  clearTimeout(timeout);
  if (!closed && owned.pid) {
    try {
      execFileSync('taskkill', ['/PID', String(owned.pid), '/T', '/F'], {
        windowsHide: true,
        timeout: 10000,
        stdio: 'ignore',
      });
    } catch {}
    // Release this QA's launcher pipes if Windows retains an exited child.
    owned.stdin?.destroy();
    owned.stdout?.destroy();
    owned.stderr?.destroy();
    owned.unref();
  }
}
// Own a BrowserServer process so Windows teardown cannot leave QA blocked forever.
// This never closes the user's browser; only the child spawned by this invocation.
export async function launchBrowser(options = {}) {
  const server = await chromium.launchServer({
    ...options,
    args: [
      ...(options.args ?? []),
      '--no-proxy-server',
      ...(process.env.SOCIETY_QA_SOFTWARE === '1' ? ['--use-angle=swiftshader'] : []),
    ],
    timeout: 60000,
  });
  const browser = await chromium.connect(server.wsEndpoint());
  const disconnect = browser.close.bind(browser);
  browser.close = async () => {
    const child = server.process();
    let timer;
    try {
      await Promise.race([
        (async () => {
          await disconnect();
          await server.close();
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('QA browser teardown timeout')), 5000);
        }),
      ]);
    } catch {
      if (child.exitCode === null) {
        if (process.platform === 'win32')
          try {
            execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
              windowsHide: true,
              stdio: 'ignore',
              timeout: 10000,
            });
          } catch {}
        else child.kill('SIGKILL');
      }
    } finally {
      clearTimeout(timer);
    }
  };
  return browser;
}
