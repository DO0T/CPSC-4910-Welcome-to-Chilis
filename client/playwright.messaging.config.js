import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'messaging.test.js',
  use: { baseURL: 'http://localhost:5188' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run dev -- --host localhost --port 5188 --strictPort', url: 'http://localhost:5188', reuseExistingServer: false },
});
