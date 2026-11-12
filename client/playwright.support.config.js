import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'support.test.js',
  use: { baseURL: 'http://localhost:5187' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host localhost --port 5187 --strictPort',
    url: 'http://localhost:5187',
    reuseExistingServer: false,
  },
});
