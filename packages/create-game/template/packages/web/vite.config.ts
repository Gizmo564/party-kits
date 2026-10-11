import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` runs this with the Worker (`wrangler dev`, port 8787) answering /api and /ws.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787', '/ws': { target: 'ws://localhost:8787', ws: true } } },
  build: { outDir: 'dist', sourcemap: false },
});
