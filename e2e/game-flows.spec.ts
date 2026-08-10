import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Keep randomly generated games deterministic while still exercising the real UI.
  await page.addInitScript(() => {
    Math.random = () => 0;
    try {
      window.localStorage.clear();
    } catch {
      // The script also runs for the initial opaque about:blank document.
    }
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

test('preloads lazy game assets and the dictionary for offline play', async ({
  context,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'Service-worker behavior is covered by the dedicated desktop Chromium and PWA projects.'
  );

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  // A reload puts the page under the installed worker's control. Boggle has
  // not been visited yet, so its lazy chunk can only load offline if install
  // precaching included the production asset manifest.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  const builtServiceWorker = await page.evaluate(async () => {
    return (await fetch('./sw.js')).text();
  });
  expect(builtServiceWorker).not.toContain('__BUILD_ID__');
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([
    expect.stringMatching(/^gamehub-[0-9a-f]{16}$/),
  ]);

  // Reloading uses stale-while-revalidate for the entry assets. Wait for those
  // background cache writes as well as the install precache before simulating
  // a network loss.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const response = await fetch('./asset-manifest.json');
        const manifest = (await response.json()) as Record<
          string,
          { file?: string; css?: string[]; assets?: string[] }
        >;
        const paths = new Set<string>();
        for (const entry of Object.values(manifest)) {
          if (entry.file) paths.add(entry.file);
          for (const cssFile of entry.css ?? []) paths.add(cssFile);
          for (const assetFile of entry.assets ?? []) paths.add(assetFile);
        }

        const missing: string[] = [];
        for (const path of paths) {
          const assetUrl = new URL(path, document.baseURI).href;
          if (!(await caches.match(assetUrl, { ignoreVary: true }))) {
            missing.push(path);
          }
        }
        return missing;
      })
    )
    .toEqual([]);

  await context.setOffline(true);
  await page.getByRole('link', { name: /Boggle/ }).click();
  await page.getByRole('button', { name: 'Play solo game' }).click();
  await page.getByRole('button', { name: /Relaxed/ }).click();

  await expect(page.getByRole('gridcell')).toHaveCount(16);
});
