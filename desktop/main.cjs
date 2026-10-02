const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
// Allows isolated desktop QA profiles without disturbing the user's saved runs.
if (process.env.SOCIETY_USER_DATA_DIR) {
  const dataPath = path.resolve(process.env.SOCIETY_USER_DATA_DIR);
  require('node:fs').mkdirSync(dataPath, { recursive: true });
  app.setPath('userData', dataPath);
}
let runtime,
  win,
  closing = false;
app.requestSingleInstanceLock() || app.quit();
app.on('second-instance', () => {
  if (win) {
    win.restore();
    win.focus();
  }
});
app.whenReady().then(async () => {
  try {
    const { startServer } = await import(
      pathToFileURL(path.join(__dirname, '..', 'server', 'index.mjs')).href
    );
    runtime = await startServer({ port: 0, dataDir: app.getPath('userData') });
    win = new BrowserWindow({
      width: 1540,
      height: 980,
      minWidth: 800,
      minHeight: 700,
      backgroundColor: '#080f18',
      title: 'AI Survival Society',
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    const origin = `http://127.0.0.1:${runtime.port}`;
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(origin + '/')) event.preventDefault();
    });
    win.webContents.session.on('will-download', (_, item) => {
      if (!/\.(json|md|png)$/i.test(item.getFilename())) item.cancel();
    });
    await win.loadURL(origin);
  } catch (error) {
    const { translate, localizeError } = await import(
      pathToFileURL(path.join(__dirname, '..', 'src', 'i18n', 'translate.mjs')).href
    );
    const { Preferences } = await import(
      pathToFileURL(path.join(__dirname, '..', 'server', 'preferences.mjs')).href
    );
    const { language } = await new Preferences(app.getPath('userData')).init();
    dialog.showErrorBox(
      translate('desktop.startError', language),
      localizeError(error.message, language),
    );
    app.quit();
  }
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (runtime && !closing) {
    event.preventDefault();
    closing = true;
    runtime.close().finally(() => app.quit());
  }
});
