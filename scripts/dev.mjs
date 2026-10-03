import { spawn } from 'node:child_process';
import { startServer } from '../server/index.mjs';
const devPort = Number(process.env.SOCIETY_DEV_PORT ?? 5173);
const origin = `http://localhost:${devPort}`;
const server = await startServer({ port: Number(process.env.PORT ?? 4310), allowedOrigin: origin });
process.env.ALLOWED_ORIGIN = origin;
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: String(server.port) },
});
let stopped = false;
async function stop() {
  if (stopped) return;
  stopped = true;
  vite.kill();
  await server.close();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
vite.on('exit', stop);
