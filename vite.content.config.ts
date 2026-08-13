import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false, // DO NOT clean dist directory, as Config 1 just populated it
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.ts')
      },
      output: {
        entryFileNames: 'content/index.js',
        // Force all dependencies to be inlined since this is a single entry build
        inlineDynamicImports: true
      }
    }
  }
});
