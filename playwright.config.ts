import { defineConfig, devices } from '@playwright/test';

const appUrl = 'http://127.0.0.1:4173/gamehub/';
const pwaUpgradeUrl = 'http://127.0.0.1:4175/gamehub/';
const pwaTest = '**/pwa-upgrade.spec.ts';
const visualTest = '**/visual.spec.ts';
const multiplayerTest = '**/multiplayer.spec.ts';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  use: {
    baseURL: appUrl,
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [pwaTest, visualTest],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], serviceWorkers: 'block' },
      testIgnore: [pwaTest, visualTest, multiplayerTest],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], serviceWorkers: 'block' },
      testIgnore: [pwaTest, visualTest, multiplayerTest],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'], serviceWorkers: 'block' },
      testIgnore: [pwaTest, visualTest, multiplayerTest],
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 15'], serviceWorkers: 'block' },
      testIgnore: [pwaTest, visualTest, multiplayerTest],
    },
    {
      name: 'pwa-upgrade',
      use: { ...devices['Desktop Chrome'], baseURL: pwaUpgradeUrl },
      testMatch: pwaTest,
    },
    {
      name: 'visual-chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: visualTest,
    },
  ],
  webServer: {
    // Builds once, then starts the production app, an isolated PWA-upgrade
    // origin, and a local PeerServer for real two-browser multiplayer tests.
    command: 'node scripts/e2e-stack.mjs',
    url: appUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
