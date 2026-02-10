import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    clean: true,
    banner: {
      js: [
        '#!/usr/bin/env node',
        'import { createRequire as __clawt_createRequire } from "module";',
        'const require = __clawt_createRequire(import.meta.url);',
      ].join('\n'),
    },
  },
  {
    entry: ['scripts/postinstall.ts'],
    format: ['esm'],
    target: 'node18',
    outDir: 'dist',
    clean: false,
  },
]);
