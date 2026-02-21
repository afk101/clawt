import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
    environment: 'node',
    setupFiles: ['tests/helpers/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/types/**',
        'src/logger/**',
      ],
      reporter: ['text', 'lcov', 'html'],
    },
    restoreMocks: true,
    clearMocks: true,
  },
});
