import fs from 'node:fs';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(sourceDir, '../webui');
const outputAssetsDir = path.join(outputDir, 'assets');

const cleanGeneratedAssets = {
  name: 'clean-miku-webui-assets',
  buildStart() {
    if (!fs.existsSync(outputAssetsDir)) return;
    for (const name of fs.readdirSync(outputAssetsDir)) {
      if (/^index-[A-Za-z0-9_-]+\.(?:css|js)$/.test(name)) {
        fs.rmSync(path.join(outputAssetsDir, name), { force: true });
      }
    }
  },
};

export default defineConfig({
  root: sourceDir,
  base: '/static/',
  publicDir: false,
  plugins: [cleanGeneratedAssets, react()],
  build: {
    outDir: outputDir,
    emptyOutDir: false,
    target: 'es2022',
  },
});
