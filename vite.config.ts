import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, renameSync } from 'fs';

function copyManifestPlugin() {
  return {
    name: 'copy-manifest-and-assets',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
      }

      // Copy manifest
      const manifestPath = resolve(__dirname, 'public/manifest.json');
      if (existsSync(manifestPath)) {
        copyFileSync(manifestPath, resolve(distDir, 'manifest.json'));
      }

      // Move popup index.html if created inside src/popup
      const nestedPopupHtml = resolve(distDir, 'src/popup/index.html');
      const targetPopupDir = resolve(distDir, 'popup');
      const targetPopupHtml = resolve(targetPopupDir, 'index.html');

      if (existsSync(nestedPopupHtml)) {
        if (!existsSync(targetPopupDir)) {
          mkdirSync(targetPopupDir, { recursive: true });
        }
        copyFileSync(nestedPopupHtml, targetPopupHtml);
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), copyManifestPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background/index.js';
          }
          if (chunkInfo.name === 'content') {
            return 'content/index.js';
          }
          if (chunkInfo.name === 'popup') {
            return 'popup/popup.js';
          }
          return '[name]/[name].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
});
