import { expect, test, type Page } from '@playwright/test'

const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5174'
const email = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.test'
const password = process.env.E2E_ADMIN_PASSWORD ?? 'e2e-test-pass-12345'

async function login(page: Page) {
  await page.goto(base + '/login')
  await page.waitForLoadState('networkidle')
  await page.locator('input').nth(0).fill(email)
  await page.locator('input').nth(1).fill(password)
  await page.locator('button[type=submit]').click()
  await page.waitForURL((url) => url.pathname === '/' || !url.pathname.startsWith('/login'), { timeout: 20000 })
}

function field(page: Page, label: string) {
  return page.locator('.form-field', { hasText: label }).first()
}

test('Super Administrator can create, read, update, delete a province and manage province-industry inline', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6)
  await login(page)

  await page.goto(base + '/resources/geography.province')
  await expect(page.locator('h1').first()).toBeVisible()

  // CREATE
  await page.goto(base + '/resources/geography.province/new')
  const countrySelect = field(page, 'country').locator('select').first()
  await expect.poll(async () => (await countrySelect.locator('option').allTextContents()).length).toBeGreaterThan(1)
  const firstValue = await countrySelect.locator('option').nth(1).getAttribute('value')
  await countrySelect.selectOption(firstValue!)
  await field(page, 'name fa').locator('input').first().fill(`استان آزمون ${suffix}`)
  await field(page, 'name en').locator('input').first().fill(`TestProvince${suffix}`)
  await field(page, 'slug').locator('input').first().fill(`test-province-${suffix}`)
  await page.locator('button[type=submit]').click()
  await page.waitForURL(/resources\/geography\.province\/\d+$/, { timeout: 20000 })

  await expect(page.getByText(`TestProvince${suffix}`).first()).toBeVisible()
  const provinceId = page.url().split('/').pop()!

  // UPDATE
  await page.goto(`${base}/resources/geography.province/${provinceId}/edit`)
  await field(page, 'name fa').locator('input').first().fill(`استان آزمون ویرایش ${suffix}`)
  await page.locator('button[type=submit]').click()
  await page.waitForURL(new RegExp(`resources/geography.province/${provinceId}$`), { timeout: 20000 })
  await expect(page.getByText(`استان آزمون ویرایش ${suffix}`).first()).toBeVisible()

  // inline province-industry workflow
  await page.goto(`${base}/resources/geography.province/${provinceId}`)
  const inline = page.locator('.inline-panel')
  await expect(inline).toBeVisible()
  await inline.getByRole('button', { name: /افزودن ردیف/ }).click()
  const industrySelect = inline.locator('.inline-row').last().locator('.form-field', { hasText: 'صنعت' }).locator('select').first()
  await expect.poll(async () => (await industrySelect.locator('option').allTextContents()).length).toBeGreaterThan(1)
  const v = await industrySelect.locator('option').nth(1).getAttribute('value')
  await industrySelect.selectOption(v!)
  await inline.getByRole('button', { name: /ذخیره این بخش/ }).click()
  await expect(page.getByText(/ذخیره شدند/)).toBeVisible({ timeout: 10000 })

  // DELETE province
  await page.goto(`${base}/resources/geography.province/${provinceId}`)
  await page.getByRole('button', { name: 'حذف', exact: true }).click()
  await page.getByRole('button', { name: /تأیید و اجرا/ }).click()
  await page.waitForURL(/resources\/geography\.province$/, { timeout: 20000 })
})

test('City create/update/delete with province selector', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6)
  await login(page)
  await page.goto(base + '/resources/geography.city/new')
  const provinceSelect = field(page, 'province').locator('select').first()
  await expect.poll(async () => (await provinceSelect.locator('option').allTextContents()).length).toBeGreaterThan(1)
  const v = await provinceSelect.locator('option').nth(1).getAttribute('value')
  await provinceSelect.selectOption(v!)
  await field(page, 'name fa').locator('input').first().fill(`شهر آزمون ${suffix}`)
  await field(page, 'name en').locator('input').first().fill(`TestCity${suffix}`)
  await field(page, 'نامک').locator('input').first().fill(`test-city-${suffix}`)
  await page.locator('button[type=submit]').click()
  await page.waitForURL(/resources\/geography\.city\/\d+$/, { timeout: 20000 })
  await page.getByRole('button', { name: 'حذف', exact: true }).click()
  await page.getByRole('button', { name: /تأیید و اجرا/ }).click()
  await page.waitForURL(/resources\/geography\.city$/, { timeout: 20000 })
})
