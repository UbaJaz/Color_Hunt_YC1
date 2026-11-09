import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { uploadAndConfirm } from './helpers';

const configured = !!process.env.VITE_SUPABASE_URL || existsSync('.env');
test.skip(!configured, 'online play is not configured');
test.setTimeout(150_000);

test('when the host disappears the next player takes over, and the old host can come back as a player', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await (await browser.newContext()).newPage();

  await host.goto('/');
  await host.getByRole('button', { name: 'Play online with friends' }).click();
  await host.getByLabel('Your name').fill('Hosty');
  await host.getByRole('button', { name: 'Create room' }).click();
  const code = (await host.locator('h1').first().innerText()).trim();

  await guest.goto('/');
  await guest.getByRole('button', { name: 'Play online with friends' }).click();
  await guest.getByLabel('Your name').fill('Guesty');
  await guest.getByLabel('Room code').fill(code);
  await guest.getByRole('button', { name: 'Join room' }).click();
  await expect(host.getByText('Guesty')).toBeVisible({ timeout: 20_000 });
  await expect(guest.getByText('Waiting for the host')).toBeVisible();

  // The host's phone dies.
  await host.close();
  await expect(guest.getByRole('status')).toContainText('You are now the host', { timeout: 30_000 });

  // The new host has the controls and the game carries on.
  await guest.getByRole('button', { name: 'Start game' }).click();
  await guest.getByRole('button', { name: 'Skip, use default' }).click();
  await uploadAndConfirm(guest);
  await guest.getByRole('button', { name: 'Submit', exact: true }).click();
  await guest.getByRole('button', { name: 'Continue without waiting' }).click(); // Hosty never submits
  await expect(guest.getByRole('heading', { name: 'Cast your votes' })).toBeVisible({ timeout: 20_000 });

  // The old host reopens the page and rejoins as an ordinary player (its stale host state must not win).
  const back = await hostCtx.newPage();
  await back.goto('/');
  await back.getByRole('button', { name: 'Play online with friends' }).click();
  await back.getByRole('button', { name: /Rejoin room/ }).click();
  await expect(back.getByRole('status')).toContainText('Guesty is now the host', { timeout: 30_000 });
  await expect(back.getByText('Start next round')).toHaveCount(0);
  await expect(guest.getByRole('heading', { name: 'Cast your votes' })).toBeVisible(); // guest is still the host and was not demoted
});

test('a player who refreshes while the host is gone still takes over (the last snapshot survives the reload)', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  await host.goto('/');
  await host.getByRole('button', { name: 'Play online with friends' }).click();
  await host.getByLabel('Your name').fill('Hosty');
  await host.getByRole('button', { name: 'Create room' }).click();
  const code = (await host.locator('h1').first().innerText()).trim();

  await guest.goto('/');
  await guest.getByRole('button', { name: 'Play online with friends' }).click();
  await guest.getByLabel('Your name').fill('Guesty');
  await guest.getByLabel('Room code').fill(code);
  await guest.getByRole('button', { name: 'Join room' }).click();
  await expect(guest.getByText('Waiting for the host')).toBeVisible({ timeout: 20_000 });

  await host.close();
  await guest.reload();
  await expect(guest.getByText('Waiting for the host')).toBeVisible(); // restored from the saved snapshot, not "room not found"
  await expect(guest.getByRole('status')).toContainText('You are now the host', { timeout: 40_000 });
  await expect(guest.getByRole('button', { name: 'Start game' })).toBeVisible();
});
