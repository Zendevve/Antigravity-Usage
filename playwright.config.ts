import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  workers: 1,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
});
