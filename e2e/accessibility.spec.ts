import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectNoAutomatedAccessibilityViolations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `,
  });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
    } catch {
      // The script also runs for the initial opaque about:blank document.
    }
  });
});

test('dashboard and game lobbies meet automated WCAG checks', async ({ page }) => {
  await page.goto('./#/');
  await expectNoAutomatedAccessibilityViolations(page);

  await page.getByRole('link', { name: /Wordle/ }).click();
  await expectNoAutomatedAccessibilityViolations(page);

  await page.getByRole('button', { name: 'Join an existing multiplayer game' }).click();
  await expectNoAutomatedAccessibilityViolations(page);
});

test('active Wordle, statistics, and Boggle states meet automated WCAG checks', async ({
  page,
}) => {
  await page.goto('./#/wordle');
  await page.getByRole('button', { name: 'Play solo game' }).click();
  await expectNoAutomatedAccessibilityViolations(page);

  await page.getByRole('button', { name: 'View statistics' }).click();
  await expectNoAutomatedAccessibilityViolations(page);
  await page.keyboard.press('Escape');

  await page.goto('./#/boggle');
  await page.getByRole('button', { name: 'Play solo game' }).click();
  await page.getByRole('button', { name: /Relaxed/ }).click();
  await expect(page.getByRole('gridcell')).toHaveCount(16);
  await expectNoAutomatedAccessibilityViolations(page);
});
