# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: province-city.parity.spec.ts >> City create/update/delete with province selector
- Location: e2e\province-city.parity.spec.ts:68:1

# Error details

```
TimeoutError: page.waitForURL: Timeout 20000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - complementary "ناوبری مدیریت" [ref=f1e4]:
    - generic [ref=f1e5]:
      - link "ک Karfansa CONTROL CENTER" [ref=f1e6] [cursor=pointer]:
        - /url: /
        - generic [ref=f1e7]: ک
        - generic [ref=f1e8]:
          - strong [ref=f1e9]: Karfansa
          - generic [ref=f1e10]: CONTROL CENTER
      - button "جمع‌کردن منو" [ref=f1e11] [cursor=pointer]
    - navigation [ref=f1e15]:
      - generic [ref=f1e16]:
        - generic [ref=f1e17]: مرکز فرمان
        - link "نمای کلی" [ref=f1e18] [cursor=pointer]:
          - /url: /
      - generic [ref=f1e25]:
        - generic [ref=f1e26]: security
        - link "گ گروه‌های دسترسی" [ref=f1e27] [cursor=pointer]:
          - /url: /resources/auth.group
          - generic [ref=f1e28]: گ
          - generic [ref=f1e29]: گروه‌های دسترسی
      - generic [ref=f1e30]:
        - generic [ref=f1e31]: users
        - link "ک کاربران" [ref=f1e32] [cursor=pointer]:
          - /url: /resources/accounts.user
          - generic [ref=f1e33]: ک
          - generic [ref=f1e34]: کاربران
      - generic [ref=f1e35]:
        - generic [ref=f1e36]: support
        - link "پ پیام‌های تماس" [ref=f1e37] [cursor=pointer]:
          - /url: /resources/contact.contactmessage
          - generic [ref=f1e38]: پ
          - generic [ref=f1e39]: پیام‌های تماس
        - link "د درخواست‌های پشتیبانی" [ref=f1e40] [cursor=pointer]:
          - /url: /resources/support.supportticket
          - generic [ref=f1e41]: د
          - generic [ref=f1e42]: درخواست‌های پشتیبانی
        - link "پ پیام‌های پشتیبانی" [ref=f1e43] [cursor=pointer]:
          - /url: /resources/support.ticketmessage
          - generic [ref=f1e44]: پ
          - generic [ref=f1e45]: پیام‌های پشتیبانی
      - generic [ref=f1e46]:
        - generic [ref=f1e47]: content
        - link "ا اسلایدرها" [ref=f1e48] [cursor=pointer]:
          - /url: /resources/home.slide
          - generic [ref=f1e49]: ا
          - generic [ref=f1e50]: اسلایدرها
        - link "م محتوای درباره ما" [ref=f1e51] [cursor=pointer]:
          - /url: /resources/home.aboutpagecontent
          - generic [ref=f1e52]: م
          - generic [ref=f1e53]: محتوای درباره ما
        - link "آ آگهی‌های تبلیغاتی" [ref=f1e54] [cursor=pointer]:
          - /url: /resources/advertising.advertisement
          - generic [ref=f1e55]: آ
          - generic [ref=f1e56]: آگهی‌های تبلیغاتی
      - generic [ref=f1e57]:
        - generic [ref=f1e58]: analytics
        - link "ا اهداف کاربران" [ref=f1e59] [cursor=pointer]:
          - /url: /resources/intents.userintent
          - generic [ref=f1e60]: ا
          - generic [ref=f1e61]: اهداف کاربران
      - generic [ref=f1e62]:
        - generic [ref=f1e63]: analysis
        - link "د دسته‌بندی گزارش‌ها" [ref=f1e64] [cursor=pointer]:
          - /url: /resources/analysis.analysiscategory
          - generic [ref=f1e65]: د
          - generic [ref=f1e66]: دسته‌بندی گزارش‌ها
        - link "ن نویسندگان" [ref=f1e67] [cursor=pointer]:
          - /url: /resources/analysis.analysisauthor
          - generic [ref=f1e68]: ن
          - generic [ref=f1e69]: نویسندگان
        - link "گ گزارش‌ها و مقالات" [ref=f1e70] [cursor=pointer]:
          - /url: /resources/analysis.analysisreport
          - generic [ref=f1e71]: گ
          - generic [ref=f1e72]: گزارش‌ها و مقالات
        - link "پ پیوست‌های گزارش" [ref=f1e73] [cursor=pointer]:
          - /url: /resources/analysis.analysisattachment
          - generic [ref=f1e74]: پ
          - generic [ref=f1e75]: پیوست‌های گزارش
      - generic [ref=f1e76]:
        - generic [ref=f1e77]: geography
        - link "ک کشورها" [ref=f1e78] [cursor=pointer]:
          - /url: /resources/geography.country
          - generic [ref=f1e79]: ک
          - generic [ref=f1e80]: کشورها
        - link "ا استان‌ها" [ref=f1e81] [cursor=pointer]:
          - /url: /resources/geography.province
          - generic [ref=f1e82]: ا
          - generic [ref=f1e83]: استان‌ها
        - link "ص صنایع استان" [ref=f1e84] [cursor=pointer]:
          - /url: /resources/geography.provinceindustry
          - generic [ref=f1e85]: ص
          - generic [ref=f1e86]: صنایع استان
        - link "آ آمار استان" [ref=f1e87] [cursor=pointer]:
          - /url: /resources/geography.provincestatistics
          - generic [ref=f1e88]: آ
          - generic [ref=f1e89]: آمار استان
        - link "ش شهرها" [ref=f1e90] [cursor=pointer]:
          - /url: /resources/geography.city
          - generic [ref=f1e91]: ش
          - generic [ref=f1e92]: شهرها
      - generic [ref=f1e93]:
        - generic [ref=f1e94]: market
        - link "م منابع داده بازار" [ref=f1e95] [cursor=pointer]:
          - /url: /resources/market.marketdataprovider
          - generic [ref=f1e96]: م
          - generic [ref=f1e97]: منابع داده بازار
        - link "ش شاخص‌های بازار" [ref=f1e98] [cursor=pointer]:
          - /url: /resources/market.marketindicator
          - generic [ref=f1e99]: ش
          - generic [ref=f1e100]: شاخص‌های بازار
        - link "ق قیمت‌های بازار" [ref=f1e101] [cursor=pointer]:
          - /url: /resources/market.marketprice
          - generic [ref=f1e102]: ق
          - generic [ref=f1e103]: قیمت‌های بازار
      - generic [ref=f1e104]:
        - generic [ref=f1e105]: organizations
        - link "ص صنایع" [ref=f1e106] [cursor=pointer]:
          - /url: /resources/organizations.industry
          - generic [ref=f1e107]: ص
          - generic [ref=f1e108]: صنایع
        - link "م محصولات پایه" [ref=f1e109] [cursor=pointer]:
          - /url: /resources/organizations.product
          - generic [ref=f1e110]: م
          - generic [ref=f1e111]: محصولات پایه
        - link "ش شرکت‌ها و سازمان‌ها" [ref=f1e112] [cursor=pointer]:
          - /url: /resources/organizations.organization
          - generic [ref=f1e113]: ش
          - generic [ref=f1e114]: شرکت‌ها و سازمان‌ها
        - link "ا اعضای شرکت" [ref=f1e115] [cursor=pointer]:
          - /url: /resources/organizations.organizationmember
          - generic [ref=f1e116]: ا
          - generic [ref=f1e117]: اعضای شرکت
        - link "م مدارک اعتبارسنجی" [ref=f1e118] [cursor=pointer]:
          - /url: /resources/organizations.verificationdocument
          - generic [ref=f1e119]: م
          - generic [ref=f1e120]: مدارک اعتبارسنجی
      - generic [ref=f1e121]:
        - generic [ref=f1e122]: audit
        - link "ر رویدادهای تجاری" [ref=f1e123] [cursor=pointer]:
          - /url: /resources/organizations.businessauditlog
          - generic [ref=f1e124]: ر
          - generic [ref=f1e125]: رویدادهای تجاری
      - generic [ref=f1e126]:
        - generic [ref=f1e127]: trade
        - link "ف فرصت‌های تجاری" [ref=f1e128] [cursor=pointer]:
          - /url: /resources/trade.tradeopportunity
          - generic [ref=f1e129]: ف
          - generic [ref=f1e130]: فرصت‌های تجاری
      - generic [ref=f1e131]:
        - generic [ref=f1e132]: services
        - link "ک کسب‌وکارهای فردی" [ref=f1e133] [cursor=pointer]:
          - /url: /resources/services.sellerprofile
          - generic [ref=f1e134]: ک
          - generic [ref=f1e135]: کسب‌وکارهای فردی
        - link "د دسته‌بندی خدمات" [ref=f1e136] [cursor=pointer]:
          - /url: /resources/services.servicecategory
          - generic [ref=f1e137]: د
          - generic [ref=f1e138]: دسته‌بندی خدمات
        - link "م محصولات و خدمات" [ref=f1e139] [cursor=pointer]:
          - /url: /resources/services.productlisting
          - generic [ref=f1e140]: م
          - generic [ref=f1e141]: محصولات و خدمات
        - link "ت تصاویر آگهی" [ref=f1e142] [cursor=pointer]:
          - /url: /resources/services.listingimage
          - generic [ref=f1e143]: ت
          - generic [ref=f1e144]: تصاویر آگهی
        - link "و ویژگی‌های محصول" [ref=f1e145] [cursor=pointer]:
          - /url: /resources/services.productspecification
          - generic [ref=f1e146]: و
          - generic [ref=f1e147]: ویژگی‌های محصول
      - generic [ref=f1e148]:
        - generic [ref=f1e149]: inquiries
        - link "ا استعلام‌ها" [ref=f1e150] [cursor=pointer]:
          - /url: /resources/services.productinquiry
          - generic [ref=f1e151]: ا
          - generic [ref=f1e152]: استعلام‌ها
      - generic [ref=f1e153]:
        - generic [ref=f1e154]: transportation
        - link "ش شیوه‌های حمل" [ref=f1e155] [cursor=pointer]:
          - /url: /resources/transportation.transportmode
          - generic [ref=f1e156]: ش
          - generic [ref=f1e157]: شیوه‌های حمل
        - link "ن نوع وسیله نقلیه" [ref=f1e158] [cursor=pointer]:
          - /url: /resources/transportation.vehicletype
          - generic [ref=f1e159]: ن
          - generic [ref=f1e160]: نوع وسیله نقلیه
        - link "ش شرکت‌های حمل‌ونقل" [ref=f1e161] [cursor=pointer]:
          - /url: /resources/transportation.transportcompany
          - generic [ref=f1e162]: ش
          - generic [ref=f1e163]: شرکت‌های حمل‌ونقل
      - generic [ref=f1e164]:
        - generic [ref=f1e165]: عملیات
        - link "وضعیت سامانه" [ref=f1e166] [cursor=pointer]:
          - /url: /health
        - link "امنیت و مدیران" [ref=f1e170] [cursor=pointer]:
          - /url: /security
    - generic [ref=f1e175]:
      - generic [ref=f1e176]:
        - generic [ref=f1e177]: e
        - generic [ref=f1e178]:
          - strong [ref=f1e179]: e2e-admin@example.test
          - generic [ref=f1e180]: مدیر ارشد
      - button "خروج" [ref=f1e181] [cursor=pointer]
  - generic [ref=f1e185]:
    - banner [ref=f1e186]:
      - generic [ref=f1e188]:
        - generic [ref=f1e189]: مرکز کنترل
        - strong [ref=f1e192]: شهرها
      - generic [ref=f1e193]:
        - button "جستجوی بخش‌های مدیریت" [ref=f1e194] [cursor=pointer]:
          - generic [ref=f1e198]: جستجو در بخش‌ها…
          - generic [ref=f1e199]: Ctrl K
        - link "فعالیت‌های مدیریتی" [ref=f1e200] [cursor=pointer]:
          - /url: /security?tab=audit
        - button "e" [ref=f1e205] [cursor=pointer]
    - main [ref=f1e209]:
      - generic [ref=f1e210]:
        - generic [ref=f1e212]:
          - link "بازگشت" [ref=f1e213] [cursor=pointer]:
            - /url: /resources/geography.city
          - heading "افزودن شهرها" [level=1] [ref=f1e216]
          - paragraph [ref=f1e217]: فیلدهای مجاز این بخش را تکمیل کنید.
        - generic [ref=f1e218]:
          - generic [ref=f1e219]:
            - generic [ref=f1e220]:
              - heading "اطلاعات پرونده" [level=2] [ref=f1e221]
              - generic [ref=f1e222]: 9 فیلد
            - generic [ref=f1e223]:
              - generic [ref=f1e224]:
                - generic [ref=f1e225]: name fa*
                - textbox "name fa*" [ref=f1e226]: شهر آزمون 751220
              - generic [ref=f1e227]:
                - generic [ref=f1e228]: name en
                - textbox "name en" [ref=f1e229]: TestCity751220
              - generic [ref=f1e230]:
                - generic [ref=f1e231]: province*
                - generic [ref=f1e232]:
                  - textbox "جستجوی province" [ref=f1e233]:
                    - /placeholder: جستجوی گزینه…
                  - combobox [ref=f1e234]:
                    - option "انتخاب کنید"
                    - option "یزد" [selected]
                    - option "همدان"
                    - option "هرمزگان"
                    - option "مرکزی"
                    - option "مازندران"
                    - option "لرستان"
                    - option "گیلان"
                    - option "گلستان"
                    - option "کهگیلویه و بویراحمد"
                    - option "کرمانشاه"
                    - option "کرمان"
                    - option "کردستان"
                    - option "قم"
                    - option "قزوین"
                    - option "فارس"
                    - option "سیستان و بلوچستان"
                    - option "سمنان"
                    - option "زنجان"
                    - option "خوزستان"
                    - option "خراسان شمالی"
                    - option "خراسان رضوی"
                    - option "خراسان جنوبی"
                    - option "چهارمحال و بختیاری"
                    - option "تهران"
                    - option "بوشهر"
                    - option "ایلام"
                    - option "البرز"
                    - option "اصفهان"
                    - option "اردبیل"
                    - option "آذربایجان غربی"
                    - option "آذربایجان شرقی"
              - generic [ref=f1e235]:
                - generic [ref=f1e236]: مرکز شهرستان
                - generic [ref=f1e237]:
                  - checkbox "مرکز شهرستان" [ref=f1e238]
                  - text: مرکز شهرستان
                - alert [ref=f1e239]: "Invalid input: expected boolean, received null"
              - generic [ref=f1e240]:
                - generic [ref=f1e241]: نامک*
                - textbox "نامک*" [ref=f1e242]: test-city-751220
              - generic [ref=f1e243]:
                - generic [ref=f1e244]: جمعیت
                - spinbutton "جمعیت" [ref=f1e245]
              - generic [ref=f1e246]:
                - generic [ref=f1e247]: توضیحات
                - textbox "توضیحات" [ref=f1e248]
                - alert [ref=f1e249]: "Invalid input: expected string, received null"
              - generic [ref=f1e250]:
                - generic [ref=f1e251]: عرض جغرافیایی
                - spinbutton "عرض جغرافیایی" [ref=f1e252]
              - generic [ref=f1e253]:
                - generic [ref=f1e254]: طول جغرافیایی
                - spinbutton "طول جغرافیایی" [ref=f1e255]
          - generic [ref=f1e256]:
            - link "انصراف" [ref=f1e257] [cursor=pointer]:
              - /url: /resources/geography.city
            - button "ذخیره اطلاعات" [active] [ref=f1e258] [cursor=pointer]
```

# Test source

```ts
  1  | import { expect, test, type Page } from '@playwright/test'
  2  | 
  3  | const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5174'
  4  | const email = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.test'
  5  | const password = process.env.E2E_ADMIN_PASSWORD ?? 'e2e-test-pass-12345'
  6  | 
  7  | async function login(page: Page) {
  8  |   await page.goto(base + '/login')
  9  |   await page.waitForLoadState('networkidle')
  10 |   await page.locator('input').nth(0).fill(email)
  11 |   await page.locator('input').nth(1).fill(password)
  12 |   await page.locator('button[type=submit]').click()
  13 |   await page.waitForURL((url) => url.pathname === '/' || !url.pathname.startsWith('/login'), { timeout: 20000 })
  14 | }
  15 | 
  16 | function field(page: Page, label: string) {
  17 |   return page.locator('.form-field', { hasText: label }).first()
  18 | }
  19 | 
  20 | test('Super Administrator can create, read, update, delete a province and manage province-industry inline', async ({ page }) => {
  21 |   const suffix = Date.now().toString().slice(-6)
  22 |   await login(page)
  23 | 
  24 |   await page.goto(base + '/resources/geography.province')
  25 |   await expect(page.locator('h1').first()).toBeVisible()
  26 | 
  27 |   // CREATE
  28 |   await page.goto(base + '/resources/geography.province/new')
  29 |   const countrySelect = field(page, 'country').locator('select').first()
  30 |   await expect.poll(async () => (await countrySelect.locator('option').allTextContents()).length).toBeGreaterThan(1)
  31 |   const firstValue = await countrySelect.locator('option').nth(1).getAttribute('value')
  32 |   await countrySelect.selectOption(firstValue!)
  33 |   await field(page, 'name fa').locator('input').first().fill(`استان آزمون ${suffix}`)
  34 |   await field(page, 'name en').locator('input').first().fill(`TestProvince${suffix}`)
  35 |   await field(page, 'slug').locator('input').first().fill(`test-province-${suffix}`)
  36 |   await page.locator('button[type=submit]').click()
  37 |   await page.waitForURL(/resources\/geography\.province\/\d+$/, { timeout: 20000 })
  38 | 
  39 |   await expect(page.getByText(`TestProvince${suffix}`).first()).toBeVisible()
  40 |   const provinceId = page.url().split('/').pop()!
  41 | 
  42 |   // UPDATE
  43 |   await page.goto(`${base}/resources/geography.province/${provinceId}/edit`)
  44 |   await field(page, 'name fa').locator('input').first().fill(`استان آزمون ویرایش ${suffix}`)
  45 |   await page.locator('button[type=submit]').click()
  46 |   await page.waitForURL(new RegExp(`resources/geography.province/${provinceId}$`), { timeout: 20000 })
  47 |   await expect(page.getByText(`استان آزمون ویرایش ${suffix}`).first()).toBeVisible()
  48 | 
  49 |   // inline province-industry workflow
  50 |   await page.goto(`${base}/resources/geography.province/${provinceId}`)
  51 |   const inline = page.locator('.inline-panel')
  52 |   await expect(inline).toBeVisible()
  53 |   await inline.getByRole('button', { name: /افزودن ردیف/ }).click()
  54 |   const industrySelect = inline.locator('.inline-row').last().locator('.form-field', { hasText: 'صنعت' }).locator('select').first()
  55 |   await expect.poll(async () => (await industrySelect.locator('option').allTextContents()).length).toBeGreaterThan(1)
  56 |   const v = await industrySelect.locator('option').nth(1).getAttribute('value')
  57 |   await industrySelect.selectOption(v!)
  58 |   await inline.getByRole('button', { name: /ذخیره این بخش/ }).click()
  59 |   await expect(page.getByText(/ذخیره شدند/)).toBeVisible({ timeout: 10000 })
  60 | 
  61 |   // DELETE province
  62 |   await page.goto(`${base}/resources/geography.province/${provinceId}`)
  63 |   await page.getByRole('button', { name: 'حذف', exact: true }).click()
  64 |   await page.getByRole('button', { name: /تأیید و اجرا/ }).click()
  65 |   await page.waitForURL(/resources\/geography\.province$/, { timeout: 20000 })
  66 | })
  67 | 
  68 | test('City create/update/delete with province selector', async ({ page }) => {
  69 |   const suffix = Date.now().toString().slice(-6)
  70 |   await login(page)
  71 |   await page.goto(base + '/resources/geography.city/new')
  72 |   const provinceSelect = field(page, 'province').locator('select').first()
  73 |   await expect.poll(async () => (await provinceSelect.locator('option').allTextContents()).length).toBeGreaterThan(1)
  74 |   const v = await provinceSelect.locator('option').nth(1).getAttribute('value')
  75 |   await provinceSelect.selectOption(v!)
  76 |   await field(page, 'name fa').locator('input').first().fill(`شهر آزمون ${suffix}`)
  77 |   await field(page, 'name en').locator('input').first().fill(`TestCity${suffix}`)
  78 |   await field(page, 'نامک').locator('input').first().fill(`test-city-${suffix}`)
  79 |   await page.locator('button[type=submit]').click()
> 80 |   await page.waitForURL(/resources\/geography\.city\/\d+$/, { timeout: 20000 })
     |              ^ TimeoutError: page.waitForURL: Timeout 20000ms exceeded.
  81 |   await page.getByRole('button', { name: 'حذف', exact: true }).click()
  82 |   await page.getByRole('button', { name: /تأیید و اجرا/ }).click()
  83 |   await page.waitForURL(/resources\/geography\.city$/, { timeout: 20000 })
  84 | })
  85 | 
```