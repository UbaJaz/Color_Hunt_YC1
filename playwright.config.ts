import { defineConfig } from '@playwright/test';

// Uses the Chrome already installed on the machine (no browser download). Camera is denied by default,
// so the tests exercise the photo-upload fallback, which is deterministic.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:5199', channel: 'chrome' },
  webServer: { command: 'npx vite --port 5199 --strictPort', url: 'http://localhost:5199', reuseExistingServer: true, timeout: 60_000 },
});
