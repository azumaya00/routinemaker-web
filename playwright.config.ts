import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2Eテスト設定
 * 
 * 実行方法:
 * - 通常実行: pnpm test:e2e
 * - UIモード: pnpm test:e2e:ui
 * - ヘッド付き実行: pnpm test:e2e:headed
 * 
 * 前提条件:
 * - routinemaker-web が localhost:3000 で起動していること
 * - routinemaker-api が localhost:8000 で起動していること
 * - テスト用ユーザーが存在すること（環境変数 E2E_TEST_EMAIL, E2E_TEST_PASSWORD で指定）
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'echo "Please start the web server manually: pnpm dev"',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
