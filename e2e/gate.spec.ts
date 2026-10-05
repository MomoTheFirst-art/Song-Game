import { expect, test } from '@playwright/test'

/**
 * The one thing worth a browser: the name gate is the first screen every
 * player meets, and it has to appear whether or not Firebase answers. Unit
 * tests cannot see it — this is the gap that left the gate shipped and
 * unverified.
 */
test('the name gate renders and is the only way in', async ({ page }) => {
  await page.goto('/')

  const name = page.getByLabel('اسم اللاعب')
  await expect(name).toBeVisible()

  // Disabled until a name is typed: the gate's whole job.
  const start = page.getByRole('button', { name: 'ابدأ اللعب' })
  await expect(start).toBeDisabled()

  await name.fill('لاعب تجريبي')
  await expect(start).toBeEnabled()
})

test('the page is right-to-left and titled', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Guess it under 15s')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})
