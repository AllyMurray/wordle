import { expect, test } from '@playwright/test';

test('recovers from malformed and oversized persisted statistics', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('wordle-statistics', `{broken${'x'.repeat(100_000)}`);
    window.localStorage.setItem('wordle-theme', 'not-a-theme');
  });
  await page.goto('./#/wordle');
  await page.getByRole('button', { name: 'Play solo game' }).click();
  await page.getByRole('button', { name: 'View statistics' }).click();

  await expect(page.getByRole('dialog', { name: 'Statistics' })).toBeVisible();
  await expect(page.getByText('Played').locator('..')).toContainText('0');
  await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/);
});

test('remains usable when browser storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException('Storage is blocked', 'SecurityError');
    };
    Object.defineProperty(Storage.prototype, 'getItem', { value: blocked });
    Object.defineProperty(Storage.prototype, 'setItem', { value: blocked });
  });
  await page.goto('./#/');

  await expect(page.getByRole('heading', { name: 'Game Hub' })).toBeVisible();
  const themeRoot = page.locator('html');
  const initialTheme = await themeRoot.getAttribute('data-theme');
  await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).click();
  await expect(themeRoot).toHaveAttribute(
    'data-theme',
    initialTheme === 'dark' ? 'light' : 'dark'
  );
});
