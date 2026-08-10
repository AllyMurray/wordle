import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const appUrl = 'http://127.0.0.1:4173/gamehub/';

async function createPlayer(browser: Browser): Promise<{
  context: BrowserContext;
  page: Page;
}> {
  const context = await browser.newContext({
    baseURL: appUrl,
    serviceWorkers: 'block',
  });
  await context.addInitScript(() => {
    try {
      window.localStorage.clear();
    } catch {
      // The script also runs for the initial opaque about:blank document.
    }
  });
  const page = await context.newPage();
  await page.goto('./#/');
  return { context, page };
}

async function openGame(page: Page, gameName: 'Wordle' | 'Boggle'): Promise<void> {
  await page.getByRole('link', { name: new RegExp(gameName) }).click();
}

async function hostSession(page: Page, pin = ''): Promise<string> {
  await page.getByRole('button', { name: 'Host a multiplayer game' }).click();
  if (pin) {
    await page.getByLabel(/Optional: Set a/).fill(pin);
  }
  await page
    .getByRole('button', {
      name: pin ? 'Host game with PIN protection' : 'Host game without PIN',
    })
    .click();

  const sessionCode = page.locator('.session-code');
  await expect(sessionCode).toHaveText(/^[A-HJ-NP-Z2-9]{6}-[0-9a-f]{6}$/);
  return (await sessionCode.textContent())!;
}

async function joinSession(page: Page, code: string, pin = ''): Promise<void> {
  await page.getByRole('button', { name: 'Join an existing multiplayer game' }).click();
  await page.getByLabel(/Enter 13-character session code/).fill(code);
  if (pin) {
    await page.getByLabel('Enter PIN if required by host').fill(pin);
  }
  await page.getByRole('button', { name: 'Confirm and join game' }).click();
}

test('connects two Wordle clients, rejects a bad PIN, and synchronizes a suggestion', async ({
  browser,
}) => {
  const host = await createPlayer(browser);
  const rejectedViewer = await createPlayer(browser);
  const viewer = await createPlayer(browser);

  try {
    await openGame(host.page, 'Wordle');
    const sessionCode = await hostSession(host.page, '2468');

    await openGame(rejectedViewer.page, 'Wordle');
    await joinSession(rejectedViewer.page, sessionCode, '0000');
    await expect(rejectedViewer.page.getByRole('alert')).toContainText('Incorrect PIN');

    await openGame(viewer.page, 'Wordle');
    await joinSession(viewer.page, sessionCode, '2468');
    await expect(viewer.page.getByText('Type a word to suggest', { exact: true })).toBeVisible();
    await expect(host.page.getByText('Partner connected', { exact: true })).toBeVisible();

    await viewer.page.keyboard.type('crane');
    await expect(host.page.getByRole('region', { name: 'Partner suggestion' })).toContainText(
      'CRANE'
    );
    await host.page.getByRole('button', { name: 'Accept suggestion: CRANE' }).click();

    const evaluatedC = /^C, (correct|present|absent)$/;
    await expect(host.page.getByRole('gridcell', { name: evaluatedC })).toBeVisible();
    await expect(viewer.page.getByRole('gridcell', { name: evaluatedC })).toBeVisible();
  } finally {
    await Promise.all([
      host.context.close(),
      rejectedViewer.context.close(),
      viewer.context.close(),
    ]);
  }
});

test('synchronizes Boggle state and accepts a replacement viewer', async ({ browser }) => {
  const host = await createPlayer(browser);
  let viewer = await createPlayer(browser);

  try {
    await openGame(host.page, 'Boggle');
    const sessionCode = await hostSession(host.page);

    await openGame(viewer.page, 'Boggle');
    await joinSession(viewer.page, sessionCode);
    await expect(viewer.page.getByText('Connected', { exact: true })).toBeVisible();
    await expect(viewer.page.getByRole('gridcell')).toHaveCount(16);

    const hostBoard = await host.page.getByRole('gridcell').allTextContents();
    await expect(viewer.page.getByRole('gridcell')).toHaveText(hostBoard);

    await viewer.context.close();
    await expect(host.page.getByText('Waiting for partner...')).toBeVisible({ timeout: 25_000 });

    viewer = await createPlayer(browser);
    await openGame(viewer.page, 'Boggle');
    await joinSession(viewer.page, sessionCode);
    await expect(viewer.page.getByText('Connected', { exact: true })).toBeVisible();
    await expect(viewer.page.getByRole('gridcell')).toHaveText(hostBoard);
  } finally {
    await Promise.all([host.context.close(), viewer.context.close()]);
  }
});

test('surfaces an unavailable multiplayer session instead of hanging', async ({ browser }) => {
  const viewer = await createPlayer(browser);
  try {
    await openGame(viewer.page, 'Wordle');
    await joinSession(viewer.page, 'ABCDEF-abcdef');

    await expect(viewer.page.getByRole('alert')).toContainText(
      /not found|unavailable|timed out|connect/i,
      { timeout: 20_000 }
    );
  } finally {
    await viewer.context.close();
  }
});
