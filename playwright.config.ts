import { defineConfig } from '@playwright/test';

const port = Number(process.env.POCKET_PEAK_TEST_PORT ?? 4186);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    viewport: process.env.CI ? { width: 800, height: 600 } : { width: 1440, height: 1000 },
    launchOptions: {
      args: [
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
