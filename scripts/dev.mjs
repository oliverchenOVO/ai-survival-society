import { spawn } from 'node:child_process';
import { startServer } from '../server/index.mjs';
const server = await startServer({ port: 4310, allowedOrigin: 'http://127.0.0.1:5173' });
process.env.ALLOWED_ORIGIN = 'http://127.0.0.1:5173';
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' });
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
