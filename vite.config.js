import { defineConfig } from 'vite';

function stubSatelliteWasm() {
  const STUB_TARGETS = ['#wasm-single-thread', '#wasm-multi-thread'];
  return {
    name: 'stub-satellite-wasm',
    enforce: 'pre',
    resolveId(id, importer) {
      if (STUB_TARGETS.includes(id)) return '\0stub-wasm';
      if (importer && id.includes('/wasm/runtimes/')) return '\0stub-wasm';
      if (id.includes('wasm-build/')) return '\0stub-wasm';
    },
    load(id) {
      if (id === '\0stub-wasm') {
        return 'export default function() {}; export function createSingleThreadRuntime() {} export function createMultiThreadRuntime() {}';
      }
    },
  };
}

export default defineConfig({
  base: '/Kessler/',
  plugins: [stubSatelliteWasm()],
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  server: {
    open: true,
  },
});
