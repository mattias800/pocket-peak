import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4186',
    viewport: { width: 1440, height: 1000 },
    launchOptions: { args: ['--enable-webgl', '--ignore-gpu-blocklist'] },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 4186 --strictPort',
    url: 'http://127.0.0.1:4186',
    reuseExistingServer: !process.env.CI,
  },
});
