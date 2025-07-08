import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: ['..']
    },
    hmr: {
      port: 5174
    }
  },
  worker: {
    format: 'es',
    plugins: () => [],
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
    include: []
  },
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  build: {
    target: ['es2020', 'chrome80', 'safari14', 'firefox78'],
    rollupOptions: {
      output: {
        manualChunks: {
          'transformers': ['@huggingface/transformers']
        }
      }
    },
    chunkSizeWarningLimit: 2000
  },
  esbuild: {
    target: 'es2020',
    supported: {
      'bigint': true
    }
  }
});