import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Keep randomly generated games deterministic while still exercising the real UI.
  await page.addInitScript(() => {
    Math.random = () => 0;
    window.localStorage.clear();
  });
  await page.goto('./#/');
});

test('plays a Wordle guess and keeps absent keyboard letters usable', async ({ page }) => {
  await page.getByRole('link', { name: /Wordle/ }).click();
  await page.getByRole('button', { name: 'Play solo game' }).click();

  await page.keyboard.type('crane');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('gridcell', { name: 'C, absent' })).toBeVisible();

  const absentKey = page.getByRole('button', { name: 'C, not in word' });
  await expect(absentKey).toBeEnabled();
  await absentKey.click();
  await expect(page.getByRole('gridcell', { name: 'C', exact: true })).toBeVisible();
});

test('opens statistics without submitting a guess and restores focus', async ({ page }) => {
  await page.getByRole('link', { name: /Wordle/ }).click();
  await page.getByRole('button', { name: 'Play solo game' }).click();

  const statsButton = page.getByRole('button', { name: 'View statistics' });
  await statsButton.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('dialog', { name: 'Statistics' })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'Empty' })).toHaveCount(30);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Statistics' })).toBeHidden();
  await expect(statsButton).toBeFocused();
});

test('loads Boggle and supports keyboard board navigation', async ({ page }) => {
  await page.getByRole('link', { name: /Boggle/ }).click();
  await page.getByRole('button', { name: 'Play solo game' }).click();
  await page.getByRole('button', { name: /Relaxed/ }).click();

  const cells = page.getByRole('gridcell');
  await expect(cells).toHaveCount(16);

  await cells.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(cells.nth(1)).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(cells.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Clear' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Submit word' })).toBeDisabled();
});
