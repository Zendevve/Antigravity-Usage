import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['src/extension.ts', 'dist/**', 'node_modules/**'],
      thresholds: {
        lines: 90,
        branches: 85,
      }
    },
  },
});
