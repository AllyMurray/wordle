import { expect, test } from '@playwright/test';

const statsFixture = {
  state: {
    stats: {
      gamesPlayed: 7,
      gamesWon: 5,
      currentStreak: 2,
      maxStreak: 3,
      guessDistribution: [0, 1, 2, 1, 1, 0],
      lastGameDate: '2026-08-10',
      soloGamesPlayed: 4,
      multiplayerGamesPlayed: 3,
    },
    boggleStats: {
      gamesPlayed: 2,
      soloGamesPlayed: 1,
      multiplayerGamesPlayed: 1,
      bestScore: 25,
      mostWords: 6,
      totalScore: 40,
      averageScore: 20,
    },
  },
  version: 1,
};

test.afterEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4175/__e2e/reset-build');
});

test('activates a new build, removes the old cache, preserves stats, and stays offline', async ({
  context,
  page,
  request,
}) => {
  await page.goto('./#/');
  await page.evaluate(async (persistedStats) => {
    window.localStorage.setItem('wordle-statistics', JSON.stringify(persistedStats));
    await navigator.serviceWorker.ready;
  }, statsFixture);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  const [initialCache] = await page.evaluate(() => caches.keys());
  expect(initialCache).toMatch(/^gamehub-[0-9a-f]{16}$/);

  await request.post('http://127.0.0.1:4175/__e2e/switch-build');
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });

  const updatePrompt = page.getByText('A new version is ready.');
  await expect(updatePrompt).toBeVisible();
  await page.getByRole('button', { name: 'Reload' }).click();
  await expect(page.getByRole('heading', { name: 'Game Hub' })).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => caches.keys()))
    .toEqual(['gamehub-ffffffffffffffff']);
  expect(await page.evaluate(() => window.localStorage.getItem('wordle-statistics'))).toBe(
    JSON.stringify(statsFixture)
  );

  await page.getByRole('link', { name: /Wordle/ }).click();
  await page.getByRole('button', { name: 'Play solo game' }).click();
  await page.getByRole('button', { name: 'View statistics' }).click();
  await expect(page.getByText('Played').locator('..')).toContainText('7');
  await page.keyboard.press('Escape');

  await page.goto('./#/');
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('link', { name: /Boggle/ }).click();
  await page.getByRole('button', { name: 'Play solo game' }).click();
  await page.getByRole('button', { name: /Relaxed/ }).click();
  await expect(page.getByRole('gridcell')).toHaveCount(16);
});
