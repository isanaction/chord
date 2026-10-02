import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Pixel 7'],
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
