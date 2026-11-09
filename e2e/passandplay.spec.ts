import { expect, test } from '@playwright/test';
import { uploadAndConfirm } from './helpers';

test('two players play a full pass-and-play round with voting', async ({ page }) => {
  await page.goto('/');
  for (const name of ['Ann', 'Bob']) {
    await page.getByPlaceholder('Player name...').fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: 'Skip, use default' }).click();

  for (const name of ['Ann', 'Bob']) {
    await expect(page.getByText(`${name}'s Turn`)).toBeVisible();
    await uploadAndConfirm(page);
    await expect(page.getByText(`${name}'s Result`)).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
  }

  for (const name of ['Ann', 'Bob']) {
    await page.getByRole('button', { name: `I'm ${name}` }).click();
    await page.getByRole('button', { name: /Done|Calculate/ }).click();
  }

  await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
  await expect(page.getByText('Round 1 Results')).toBeVisible();
  await expect(page.getByText('Total Score')).toBeVisible();
});

test('a two-colour round asks for a warm and then a cool capture', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Player name...').fill('Ann');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Two-colour rounds').click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: 'Skip, use default' }).click();

  await expect(page.getByText(/warm colour 1 of 2/i)).toBeVisible();
  await uploadAndConfirm(page);
  await expect(page.getByText(/cool colour 2 of 2/i)).toBeVisible();
  await uploadAndConfirm(page);
  await expect(page.getByText('Cool colour', { exact: false }).first()).toBeVisible();
});

test('the daily challenge starts a seeded game', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Player name...').fill('Ann');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: /Daily challenge/ }).click();
  await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible();
});
