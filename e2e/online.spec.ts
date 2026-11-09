import { existsSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { uploadAndConfirm } from './helpers';

// Needs a real Supabase project (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env or the environment).
const configured = !!process.env.VITE_SUPABASE_URL || existsSync('.env');

test.skip(!configured, 'online play is not configured');

test('host and guest create, join, play a round, vote and see the reveal', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();

  await host.goto('/');
  await host.getByRole('button', { name: 'Play online with friends' }).click();
  await host.getByLabel('Your name').fill('Hosty');
  await host.getByRole('button', { name: 'Create room' }).click();
  const code = (await host.locator('h1').first().innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{4}$/);

  await guest.goto('/');
  await guest.getByRole('button', { name: 'Play online with friends' }).click();
  await guest.getByLabel('Your name').fill('Guesty');
  await guest.getByLabel('Room code').fill(code);
  await guest.getByRole('button', { name: 'Join room' }).click();
  await expect(host.getByText('Guesty')).toBeVisible({ timeout: 20_000 });

  await host.getByRole('button', { name: 'Start game' }).click();
  for (const page of [host, guest]) {
    await page.getByRole('button', { name: 'Skip, use default' }).click();
    await uploadAndConfirm(page);
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
  }

  for (const page of [host, guest]) {
    await expect(page.getByRole('heading', { name: 'Cast your votes' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Unlikely/ }).click();
    await page.getByRole('button', { name: 'Submit votes' }).click();
  }

  for (const page of [host, guest]) {
    await expect(page.getByRole('heading', { name: 'Round 1 results' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Target', { exact: true })).toBeVisible();
  }

  // Emoji reactions reach the other player.
  await guest.getByRole('button', { name: 'React 🔥' }).click();
  await expect(host.getByText('Guesty 🔥')).toBeVisible({ timeout: 10_000 });
});
