import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: Number(process.env.SOCIETY_DEV_PORT ?? 5173),
    strictPort: true,
    proxy: {
      '/api': `http://localhost:${process.env.PORT ?? 4310}`,
      '/ws': { target: `ws://localhost:${process.env.PORT ?? 4310}`, ws: true },
    },
  },
  build: { outDir: 'dist' },
});
