import { defineConfig } from '@playwright/test';

// Saved-page tests: the built extension (dist/) in Playwright's Chromium, on trimmed YouTube
// pages served at youtube.com URLs. Run with `npm test` (typecheck, build, then these).
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: true,
  reporter: 'list',
  timeout: 20_000,
});
