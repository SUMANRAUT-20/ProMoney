import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  envDir: '..',
  envPrefix: ['VITE_', 'DEMO_'],
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:4000' } },
});
