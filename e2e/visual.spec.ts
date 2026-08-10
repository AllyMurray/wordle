import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
    try {
      window.localStorage.clear();
      window.localStorage.setItem('wordle-theme', 'dark');
    } catch {
      // The script also runs for the initial opaque about:blank document.
    }
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('captures stable dashboard themes and narrow layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./#/');
  await expect(page).toHaveScreenshot('dashboard-dark.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.02,
  });

  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page).toHaveScreenshot('dashboard-light.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.02,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page).toHaveScreenshot('dashboard-mobile.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});

test('captures Wordle at a viewport equivalent to 200 percent zoom', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 450 });
  await page.goto('./#/wordle');
  await page.getByRole('button', { name: 'Play solo game' }).click();
  await page.keyboard.type('crane');
  await page.keyboard.press('Enter');

  await expect(page).toHaveScreenshot('wordle-200-percent.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});
