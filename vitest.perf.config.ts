import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/perf/**/*.spec.ts'],
    testTimeout: 30000000,
  },
});
