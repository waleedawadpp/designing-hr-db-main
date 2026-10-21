import { expect, test, type Page } from "@playwright/test";

// المسار الكامل: إضافة موظف ← حضور شهر (11/2026) ← إضافي وخصم ← التحقق من الصافي في الكشف ولوحة التحكم.
// موظف راتبه 300 في نوفمبر 2026 (30 يومًا، 26 يوم عمل): الأجرة اليومية 10.
//  - حضور كل أيام العمل ثم: يوم 2 = غ، يوم 3 = ن ← خصم الغياب = 1.5 × 10 = 15 ← المستحق 285
//  - إضافي 2.30 يوم 02/11 = 2.5 × 1.5 × (10/9) = 4.16667 (مع تنبيه: غائب في هذا اليوم)
//  - مكافأة 20 يوم 12/11
//  - تأخير 30 دقيقة يوم 15/11 = 30 × 10/9/60 = 0.55556 ، وسلفة 50 يوم 16/11
//  الصافي = 285 + 4.16667 + 20 − 0.55556 − 50 = 258.611

const CODE = "699001";
const NAME = "موظف اختبار المسار";

async function login(page: Page, email = "admin@example.com", password = "Admin@12345") {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click("button");
  await page.waitForURL("/");
}

async function pickDate(page: Page, row: ReturnType<Page["locator"]>, day: number) {
  await row.getByRole("button", { name: "التاريخ" }).click();
  await page.locator(".rdp-day:not(.rdp-outside) button", { hasText: new RegExp(`^${day}$`) }).first().click();
}

async function pickName(page: Page, row: ReturnType<Page["locator"]>) {
  await row.getByRole("button", { name: "الاسم" }).click();
  await page.getByPlaceholder("ابحث…").fill("اختبار المسار");
  await page.getByRole("option", { name: NAME }).click();
}

test("المسار الكامل: موظف ← حضور ← إضافي وخصم ← الصافي", async ({ page }) => {
  await login(page);

  // 1) إضافة موظف في أول سطر فارغ
  await page.goto("/employees");
  const draft = page.getByTestId("emp-new");
  await draft.getByLabel("code").fill(CODE);
  await draft.getByLabel("name").fill(NAME);
  await draft.getByLabel("monthlySalary").fill("300");
  await draft.getByLabel("type").selectOption("موظف");
  await expect(page.getByTestId(`emp-${CODE}`)).toBeVisible();
  await expect(page.getByText(`✔ تم الحفظ — ${NAME}`)).toBeVisible();

  // التحقق: الاسم المكرر مرفوض
  const draft2 = page.getByTestId("emp-new");
  await draft2.getByLabel("code").fill("699002");
  await draft2.getByLabel("name").fill(NAME);
  await draft2.getByLabel("monthlySalary").fill("100");
  await draft2.getByLabel("type").selectOption("موظف");
  await expect(page.getByText("الاسم مستخدم لموظف آخر")).toBeVisible();

  // 2) إضافة شهر جديد (11/2026) وتسجيل الحضور
  await page.goto("/attendance");
  await page.getByRole("button", { name: "إضافة شهر جديد" }).click();
  await expect(page.getByText("الشهر التالي: 11/2026")).toBeVisible();
  await expect(page.getByText(`${CODE} — ${NAME}`)).toBeVisible();
  await page.getByRole("button", { name: "إنشاء صفوف 11/2026" }).click();
  await page.waitForURL(/month=2026-11/);
  const row = page.getByTestId(`grid-row-${CODE}`);
  await expect(row).toBeVisible();
  // خانة 31 مقفلة في نوفمبر
  await expect(row.getByRole("button", { name: `${NAME} يوم 31`, exact: true })).toHaveCount(0);

  await row.getByRole("button", { name: `${NAME} يوم 1`, exact: true }).focus();
  await page.getByRole("button", { name: /تعبئة الموظف حاضر لكل أيام العمل/ }).click();
  await expect(row.getByTestId("cnt-present")).toHaveText("26.0");

  // إدخال من لوحة المفاتيح: رمز غير صحيح مرفوض
  const d2 = row.getByRole("button", { name: `${NAME} يوم 2`, exact: true });
  await d2.focus();
  await page.keyboard.press("x");
  await expect(page.getByText("رمز غير صحيح — اختر: ح أو غ أو ن أو إ أو م")).toBeVisible();
  // حرف عربي من لوحة المفاتيح (Playwright لا يرسل keydown لحروف غير الإنجليزية، فنرسله مباشرة)
  await d2.dispatchEvent("keydown", { key: "غ" });
  await expect(d2).toHaveText("غ");
  // القائمة الصغيرة: يوم 3 = ن
  await row.getByRole("button", { name: `${NAME} يوم 3`, exact: true }).click();
  await page.getByRole("menuitem", { name: "ن" }).click();
  await expect(page.getByTestId("save-state")).toHaveText("✔ تم الحفظ");
  await expect(row.getByTestId("cnt-present")).toHaveText("24.5");

  // 3) سجل الإضافي: إضافي في يوم الغياب + مكافأة
  await page.goto("/extras?y=2026&m=11");
  let r = page.getByTestId("entry-draft");
  await pickDate(page, r, 2);
  const otRow = page.getByTestId("entry-row").filter({ hasText: "02/11/2026" });
  await expect(otRow).toBeVisible();
  await pickName(page, otRow);
  await otRow.getByLabel("البند").selectOption("ساعات إضافية");
  await otRow.getByLabel("الوقت الفعلي").fill("2.30");
  await otRow.getByLabel("الوقت الفعلي").blur();
  await expect(otRow.getByTestId("entry-amount")).toHaveText("4.167");
  await expect(otRow.getByTestId("link-status")).toContainText(`✔ مربوط بـ ${NAME} — كشف 11/2026`);
  await expect(otRow.getByTestId("link-status")).toContainText("⚠ الموظف مسجّل غائب في هذا اليوم");

  r = page.getByTestId("entry-draft");
  await pickDate(page, r, 12);
  const bonusRow = page.getByTestId("entry-row").filter({ hasText: "12/11/2026" });
  await expect(bonusRow).toBeVisible();
  await expect(bonusRow.getByTestId("link-status")).toContainText("⚠ أكمل: الاسم  البند");
  await pickName(page, bonusRow);
  await bonusRow.getByLabel("البند").selectOption("مكافأة");
  await bonusRow.getByLabel("مبلغ المكافأة").fill("20");
  await bonusRow.getByLabel("مبلغ المكافأة").blur();
  await expect(bonusRow.getByTestId("entry-amount")).toHaveText("20.000");

  // 4) سجل الخصم: تأخير + سلفة
  await page.goto("/deductions?y=2026&m=11");
  r = page.getByTestId("entry-draft");
  await pickDate(page, r, 15);
  const lateRow = page.getByTestId("entry-row").filter({ hasText: "15/11/2026" });
  await expect(lateRow).toBeVisible();
  await pickName(page, lateRow);
  await lateRow.getByLabel("البند").selectOption("تأخير");
  await lateRow.getByLabel("دقائق التأخير").fill("30");
  await lateRow.getByLabel("دقائق التأخير").blur();
  await expect(lateRow.getByTestId("entry-amount")).toHaveText("0.556");

  r = page.getByTestId("entry-draft");
  await pickDate(page, r, 16);
  const advRow = page.getByTestId("entry-row").filter({ hasText: "16/11/2026" });
  await expect(advRow).toBeVisible();
  await pickName(page, advRow);
  await advRow.getByLabel("البند").selectOption("سلفة");
  await advRow.getByLabel("المبلغ").fill("50");
  await advRow.getByLabel("المبلغ").blur();
  await expect(advRow.getByTestId("entry-amount")).toHaveText("50.000");

  // 5) الكشف الشهري
  await page.goto("/monthly?y=2026&m=11");
  const mrow = page.getByTestId(`monthly-row-${CODE}`);
  await expect(mrow.getByTestId("net")).toHaveText("258.611");

  // 6) لوحة التحكم
  await page.goto("/?y=2026&m=11");
  const drow = page.getByTestId(`dash-row-${CODE}`);
  await expect(drow.getByTestId("dash-net")).toHaveText("ر.ع. 258.611");
  await drow.click();
  await expect(page.getByTestId("card-الصافي المستحق")).toHaveText("ر.ع. 258.611");
  await expect(page.getByTestId("card-أيام الحضور")).toHaveText("24.5 يوم");
  // نسبة الحضور على أيام العمل: 24.5 / 26 = 94.2%
  await expect(page.getByTestId("card-نسبة الحضور")).toHaveText("94.2%");
});

test("تصدير كل الجداول إلى Excel", async ({ page }) => {
  await login(page);
  for (const q of ["monthly&ym=2026-10", "dashboard&ym=2026-10", "attendance&month=2026-10", "employees", "extras&ym=2026-10", "deductions&ym=all"]) {
    const res = await page.request.get(`/api/export?table=${q}`);
    expect(res.status(), q).toBe(200);
    expect(res.headers()["content-type"]).toContain("spreadsheetml");
    expect((await res.body()).subarray(0, 2).toString()).toBe("PK");
  }
});

test("المشاهد يقرأ فقط", async ({ page }) => {
  await login(page, "viewer@example.com", "Viewer@12345");
  await page.goto("/employees");
  await expect(page.getByTestId("emp-new")).toHaveCount(0);
  await expect(page.getByTestId("emp-622001").getByLabel("name")).toHaveAttribute("readonly", "");
  await page.goto("/attendance");
  await expect(page.getByRole("button", { name: "إضافة شهر جديد" })).toHaveCount(0);
});
