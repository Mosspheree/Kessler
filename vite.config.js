import { defineConfig } from 'vite';
import { resolve } from 'path';

// Stub out satellite.js WASM modules that cause build failures.
// We only use the pure JS SGP4 functions — no WASM needed.
function stubSatelliteWasm() {
  const STUB_TARGETS = ['#wasm-single-thread', '#wasm-multi-thread'];

  return {
    name: 'stub-satellite-wasm',
    enforce: 'pre',
    resolveId(id, importer) {
      if (STUB_TARGETS.includes(id)) return '\0stub-wasm';
      // Stub the entire wasm runtimes barrel to prevent scanning wasm-build/
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
  plugins: [stubSatelliteWasm()],
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  server: {
    open: true,
  },
});
