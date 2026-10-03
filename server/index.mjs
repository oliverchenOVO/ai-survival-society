import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { Simulation, DIRECTOR_EVENTS } from '../core/simulation.mjs';
import { ModelQueue } from './llm.mjs';
import { Persistence } from './persistence.mjs';
import { Preferences } from './preferences.mjs';
import { translate } from '../src/i18n/translate.mjs';
import { markdown, shareURL, summary, escapeXML, publicStory } from '../src/story/facts.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function startServer(options = {}) {
  const config = {
    ...JSON.parse(readFileSync(path.join(root, 'config', 'simulation.json'), 'utf8')),
    ...options.config,
  };
  const dataDir = options.dataDir ?? process.env.DATA_DIR ?? root;
  let sim = new Simulation(config),
    speed = config.speed,
    autoRestart = config.autoRestart,
    finishedAt = null,
    savedAt = 0,
    closed = false,
    restarting = false;
  const store = new Persistence(dataDir, config.maxStoredMatches);
  await store.init();
  const preferences = await new Preferences(dataDir).init();
  const models = new ModelQueue(
    { ...config.llm, responseLanguage: preferences.language },
    () => sim,
  );
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use((req, res, next) => {
    // Loopback defaults and same-origin mutations protect a locally running control API.
    if (['POST', 'DELETE'].includes(req.method) && req.headers.origin) {
      const origin = new URL(req.headers.origin);
      const allowed = options.allowedOrigin ?? process.env.ALLOWED_ORIGIN;
      if (origin.host !== req.headers.host && req.headers.origin !== allowed)
        return res.status(403).json({ error: 'Cross-origin mutation denied' });
    }
    next();
  });
  const snapshot = () => ({
    ...sim.snapshot(),
    simulation_id: store.identity(sim).simulationId,
    speed,
    autoRestart,
    restartIn:
      finishedAt && autoRestart
        ? Math.max(0, config.restartDelaySeconds - (Date.now() - finishedAt) / 1000)
        : null,
    llm: models.snapshot(),
  });
  const restart = async (seed) => {
    const next = Number(seed);
    if (!Number.isInteger(next) || next < 0 || next > 4294967295)
      throw new Error('Seed must be a 32-bit unsigned integer');
    if (restarting) return snapshot();
    restarting = true;
    try {
      await store.persist(sim);
      models.reset();
      sim = new Simulation({ ...config, seed: next });
      finishedAt = null;
      savedAt = 0;
    } finally {
      restarting = false;
    }
    return snapshot();
  };
  app.get('/api/health', (_, res) =>
    res.json({ ok: true, app: 'AI Survival Society', version: '1.5.0' }),
  );
  app.get('/api/state', (_, res) => res.json(snapshot()));
  app.post('/api/load', async (req, res) => {
    try {
      const data = await store.read(req.body.id);
      if (data.status === 'finished') throw new Error('Only unfinished checkpoints can resume');
      const loaded = Simulation.fromSave(data);
      await store.persist(sim);
      models.reset();
      sim = loaded;
      sim.status = 'paused';
      store.identities.set(sim, {
        simulationId: data.simulation_id,
        startedAt: data.startedAt,
        simulationVersion: '1.5.0',
        finishedAt: null,
      });
      finishedAt = null;
      savedAt = 0;
      res.json(snapshot());
    } catch {
      res.status(400).json({ error: 'Save has no living-world checkpoint' });
    }
  });
  app.get('/api/preferences', (_, res) => res.json({ language: preferences.language }));
  app.post('/api/preferences', async (req, res) => {
    if (!['zh-TW', 'en'].includes(req.body.language))
      return res.status(400).json({ error: 'Unsupported interface language' });
    try {
      const result = await preferences.set(req.body.language);
      models.config.responseLanguage = result.language;
      res.json(result);
    } catch {
      res.status(503).json({ error: 'Could not save interface preference' });
    }
  });
  app.get('/api/matches/:id/export', async (req, res) => {
    try {
      const raw =
        req.params.id === sim.matchId ? store.capture(sim) : await store.read(req.params.id);
      const data = raw.status === 'finished' ? publicStory(raw) : raw;
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="society-${data.simulation_id}.json"`,
      );
      res.json(data);
    } catch {
      res.status(404).json({ error: 'Match is no longer in the archive' });
    }
  });
  app.post('/api/control', async (req, res) => {
    const { action, value } = req.body;
    switch (action) {
      case 'pause':
        if (sim.status === 'running') sim.status = 'paused';
        break;
      case 'resume':
        if (sim.status === 'paused') sim.status = 'running';
        break;
      case 'restart':
        await restart(value ?? sim.config.seed);
        break;
      case 'speed':
        if (![0.5, 1, 2, 4, 8, 10, 16, 32].includes(value))
          return res.status(400).json({ error: 'Unsupported speed' });
        speed = value;
        break;
      case 'auto_restart':
        autoRestart = Boolean(value);
        break;
      default:
        return res.status(400).json({ error: 'Unknown control' });
    }
    res.json(snapshot());
  });
  app.post('/api/director', (req, res) => {
    if (!DIRECTOR_EVENTS.includes(req.body.event))
      return res.status(400).json({ error: 'Unknown world event' });
    try {
      sim.director(req.body.event);
      res.json(snapshot());
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.get('/api/config/llm', (_, res) => res.json(models.config));
  app.post('/api/config/llm', (req, res) => {
    const c = { ...models.config, ...req.body };
    let url;
    try {
      url = new URL(c.endpoint);
    } catch {
      return res.status(400).json({ error: 'Invalid endpoint URL' });
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      !['ollama', 'compatible', 'fallback'].includes(c.provider) ||
      typeof c.model !== 'string' ||
      !c.model.trim() ||
      c.model.length > 100
    )
      return res.status(400).json({ error: 'Invalid provider configuration' });
    const clean = {
      enabled: Boolean(c.enabled),
      provider: c.provider,
      endpoint: url.toString().replace(/\/$/, ''),
      model: c.model,
      temperature: Math.max(0, Math.min(2, Number(c.temperature) || 0)),
      timeoutMs: Math.max(500, Math.min(60000, Number(c.timeoutMs) || 12000)),
      intervalSeconds: Math.max(8, Math.min(120, Number(c.intervalSeconds) || 22)),
      concurrency: 1,
      maxQueue: 6,
      responseLanguage: preferences.language,
    };
    models.configure(clean);
    res.json(clean);
  });
  app.get('/api/export', (_, res) => {
    const data = store.capture(sim);
    res
      .attachment(`society-${data.simulation_id}.json`)
      .json(data.status === 'finished' ? publicStory(data) : data);
  });
  app.post('/api/save', async (_, res) => {
    await store.persist(sim);
    res.json({ id: store.identity(sim).simulationId, saved: true });
  });
  app.get('/api/replays', async (_, res) => res.json(await store.list()));
  app.get('/api/replays/:id', async (req, res) => {
    try {
      const data = await store.read(req.params.id);
      res.json(data.status === 'finished' ? publicStory(data) : data);
    } catch {
      res.status(404).json({ error: 'Replay not found' });
    }
  });
  const dist = path.join(root, 'dist');
  app.get('/api/stories', async (_, res) => res.json(await store.list()));
  app.get('/api/stories/:id', async (req, res) => {
    try {
      const story = await store.story(req.params.id);
      const publicBase = options.publicBaseURL ?? process.env.PUBLIC_BASE_URL ?? '';
      const origin = `${req.protocol}://${req.get('host')}`;
      const url = shareURL(story.simulation_id, origin, publicBase);
      const hostname = new URL(url).hostname;
      res.json({
        ...story,
        share: {
          url,
          local: !publicBase && ['localhost', '127.0.0.1', '[::1]'].includes(hostname),
          configured: Boolean(publicBase),
        },
      });
    } catch (e) {
      res.status(e.status ?? 422).json({ error: 'Story unavailable' });
    }
  });
  const exportStory = async (req, res) => {
    try {
      const story = await store.story(req.params.id),
        locale = req.query.lang === 'en' ? 'en' : 'zh-TW';
      if (req.query.format === 'markdown')
        res
          .attachment(`simulation-${story.simulation_id}.md`)
          .type('text/markdown; charset=utf-8')
          .send(markdown(story, locale));
      else res.attachment(`simulation-${story.simulation_id}.json`).json(story);
    } catch (e) {
      res.status(e.status ?? 422).json({ error: 'Story unavailable' });
    }
  };
  app.get('/api/stories/:id/export', exportStory);
  app.post('/api/stories/:id/export', exportStory);
  app.delete('/api/stories/:id', async (req, res) => {
    try {
      await store.remove(req.params.id);
      res.json({ deleted: true });
    } catch (e) {
      res.status(e.status ?? 400).json({ error: 'Story unavailable' });
    }
  });
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/', (_, res) => res.sendFile(path.join(dist, 'index.html')));
    app.get('/replay/:id', (_, res) => res.sendFile(path.join(dist, 'index.html')));
    app.get('/story/:id', async (req, res) => {
      let html = readFileSync(path.join(dist, 'index.html'), 'utf8');
      try {
        const data = await store.story(req.params.id),
          locale = req.query.lang === 'en' ? 'en' : 'zh-TW';
        const title = `AI Survival Society — ${data.agents.find((a) => a.id === data.winner)?.name ?? translate('result.extinction', locale)}`;
        const description = summary(data, locale)[4].text;
        const url = shareURL(
          data.simulation_id,
          `${req.protocol}://${req.get('host')}`,
          options.publicBaseURL ?? process.env.PUBLIC_BASE_URL ?? '',
        );
        html = html
          .replace(/<title>[^<]*<\/title>/, `<title>${escapeXML(title)}</title>`)
          .replace(
            '</head>',
            `<meta name="description" content="${escapeXML(description)}"><meta property="og:title" content="${escapeXML(title)}"><meta property="og:description" content="${escapeXML(description)}"><meta property="og:url" content="${escapeXML(url)}"><meta name="twitter:card" content="summary"></head>`,
          );
      } catch {
        /* SPA still presents its localized missing/corrupt record state. */
      }
      res.type('html').send(html);
    });
  } else app.get('/', (_, res) => res.send(translate('error.build', preferences.language)));
  app.use((error, req, res, next) => {
    console.error(error.message);
    if (!res.headersSent) res.status(400).json({ error: String(error.message).slice(0, 180) });
  });
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 });
  wss.on('connection', (socket, req) => {
    if (req.headers.origin) {
      try {
        if (
          new URL(req.headers.origin).host !== req.headers.host &&
          req.headers.origin !== process.env.ALLOWED_ORIGIN
        ) {
          socket.close(1008, 'Origin denied');
          return;
        }
      } catch {
        socket.close(1008);
        return;
      }
    }
    socket.send(JSON.stringify(snapshot()));
    socket.on('error', () => {});
  });
  let clock = Date.now();
  const timer = setInterval(() => {
    if (closed) return;
    const now = Date.now();
    const dt = Math.min(0.5, (now - clock) / 1000);
    clock = now;
    if (sim.status === 'running') {
      // Fixed simulation steps preserve seed reproducibility across presentation speeds.
      accumulator += dt * speed;
      let steps = 0;
      while (accumulator >= config.tickSeconds && steps++ < 128 && sim.status === 'running') {
        sim.tick(config.tickSeconds);
        accumulator -= config.tickSeconds;
      }
      models.schedule(sim);
    } else accumulator = 0;
    if (sim.status === 'finished' && !finishedAt) {
      finishedAt = now;
      const completedSimulation = sim;
      store.persist(completedSimulation).catch(console.error);
      models
        .historian(completedSimulation)
        .then(() => store.persist(completedSimulation))
        .catch(console.error);
    }
    if (
      sim.status === 'finished' &&
      autoRestart &&
      now - finishedAt > config.restartDelaySeconds * 1000
    )
      restart((sim.config.seed + 1) >>> 0).catch(console.error);
    if (sim.elapsed - savedAt > 30) {
      savedAt = sim.elapsed;
      store.persist(sim).catch(console.error);
    }
    const message = JSON.stringify(snapshot());
    for (const socket of wss.clients)
      if (socket.readyState === 1 && socket.bufferedAmount < 1024 * 1024) socket.send(message);
  }, 100);
  let accumulator = 0;
  const port = options.port ?? Number(process.env.PORT ?? 4310),
    host = options.host ?? process.env.HOST ?? 'localhost';
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const actualPort = server.address().port;
  console.log(`AI Survival Society listening at http://${host}:${actualPort}`);
  return {
    server,
    port: actualPort,
    getSimulation: () => sim,
    models,
    store,
    close: async () => {
      closed = true;
      clearInterval(timer);
      models.reset();
      await store.persist(sim);
      for (const socket of wss.clients) socket.terminate();
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => {
        server.close(resolve);
        // A renderer can leave an accepted HTTP connection without complete
        // headers. Save first, then drain it so desktop quit never waits on
        // the HTTP header timeout. Upgraded sockets were terminated above.
        server.closeAllConnections();
      });
    },
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtime = await startServer();
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, async () => {
      if (stopping) return;
      stopping = true;
      await runtime.close();
      process.exit(0);
    });
}
