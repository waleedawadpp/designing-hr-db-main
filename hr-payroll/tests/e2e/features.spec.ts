import { expect, test, type Page } from "@playwright/test";

// الميزات المضافة: اعتماد الشهر وقفله، قسيمة الراتب، المستخدمون وكلمة المرور،
// إيقاف الدخول بعد محاولات خاطئة، النسخة الاحتياطية، الإعدادات.

async function login(page: Page, email = "admin@example.com", password = "Admin@12345") {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click("button");
  await page.waitForURL("/");
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await page.waitForURL(/\/login/);
}

test("اعتماد الشهر يقفل البيانات ويثبّت الرواتب حتى إعادة الفتح", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await login(page);

  await page.goto("/monthly?y=2026&m=10");
  const net = page.getByTestId("monthly-row-622001").getByTestId("net");
  const before = await net.innerText();
  await page.getByRole("button", { name: "اعتماد الشهر" }).click();
  await expect(page.getByTestId("month-status")).toContainText("معتمد ومقفل");

  // الحضور والخصم للقراءة فقط
  await page.goto("/attendance?month=2026-10");
  await expect(page.getByText(/شهر 10\/2026 معتمد ومقفل/)).toBeVisible();
  await page.getByTestId("grid-row-622001").locator('button[data-day="2"]').click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.goto("/deductions?y=2026&m=10");
  await expect(page.getByText(/معتمد ومقفل — أسطره للقراءة فقط/)).toBeVisible();

  // تعديل الراتب لا يغيّر شهرًا معتمدًا
  await page.goto("/employees");
  const salary = page.getByTestId("emp-622001").getByLabel("monthlySalary");
  const oldSalary = await salary.inputValue();
  await salary.fill("2000");
  await salary.blur();
  await expect(page.getByText(/✔ تم الحفظ/)).toBeVisible();
  await page.goto("/monthly?y=2026&m=10");
  await expect(net).toHaveText(before);

  // القسيمة من الرواتب المعتمدة
  await page.getByTestId("monthly-row-622001").getByRole("link").click();
  await page.waitForURL(/\/payslip/);
  await expect(page.getByTestId("payslip-622001").getByTestId("payslip-net")).toHaveText(`ر.ع. ${before}`);
  await expect(page.getByTestId("payslip-622001").getByText("معتمدة", { exact: true })).toBeVisible();

  // إعادة الفتح: يُحسب من البيانات الحالية
  await page.goto("/monthly?y=2026&m=10");
  await page.getByRole("button", { name: "إعادة فتح" }).click();
  await expect(page.getByTestId("month-status")).toHaveText("مفتوح للتعديل");
  await expect(net).not.toHaveText(before);

  // إرجاع الراتب
  await page.goto("/employees");
  await page.getByTestId("emp-622001").getByLabel("monthlySalary").fill(oldSalary);
  await page.getByTestId("emp-622001").getByLabel("monthlySalary").blur();
  await expect(page.getByText(/✔ تم الحفظ/)).toBeVisible();
  await page.goto("/monthly?y=2026&m=10");
  await expect(net).toHaveText(before);
});

test("قسائم كل العاملين في صفحة واحدة", async ({ page }) => {
  await login(page);
  await page.goto("/payslip?y=2026&m=10&emp=all");
  await expect(page.locator('[data-testid^="payslip-"][data-testid$="1"]').first()).toBeVisible();
  expect(await page.locator("section.payslip").count()).toBe(28);
});

test("المستخدمون وتغيير كلمة المرور", async ({ page }) => {
  await login(page);
  await page.goto("/users");
  await page.getByLabel("الاسم", { exact: true }).fill("محاسب تجريبي");
  await page.getByLabel("البريد الإلكتروني").fill("acc@example.com");
  await page.getByLabel("كلمة المرور").fill("Acc12345");
  await page.getByRole("button", { name: "إضافة مستخدم" }).click();
  await expect(page.getByText("✔ أُضيف محاسب تجريبي")).toBeVisible();
  await expect(page.getByTestId("users-table")).toContainText("acc@example.com");

  // كلمة مرور ضعيفة مرفوضة
  await page.getByLabel("الاسم", { exact: true }).fill("ضعيف");
  await page.getByLabel("البريد الإلكتروني").fill("weak@example.com");
  await page.getByLabel("كلمة المرور").fill("123");
  await page.getByRole("button", { name: "إضافة مستخدم" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "8 أحرف على الأقل" })).toBeVisible();
  await logout(page);

  // المشاهد الجديد: لا يرى شاشات المدير، ويغيّر كلمة مروره
  await login(page, "acc@example.com", "Acc12345");
  await expect(page.getByRole("link", { name: "المستخدمون" })).toHaveCount(0);
  await page.goto("/users");
  await expect(page.getByText("هذه الشاشة للمدير فقط.")).toBeVisible();
  await page.goto("/account");
  await page.locator('input[name="current"]').fill("Acc12345");
  await page.locator('input[name="next"]').fill("NewPass2026");
  await page.locator('input[name="confirm"]').fill("NewPass2026");
  await page.getByRole("button", { name: "حفظ" }).click();
  await expect(page.getByText("✔ تغيّرت كلمة المرور")).toBeVisible();
  await logout(page);
  await login(page, "acc@example.com", "NewPass2026");

  // تعطيل المستخدم يوقف جلسته فورًا
  const ctx2 = await page.context().browser()!.newContext({ baseURL: test.info().project.use.baseURL, locale: "ar" });
  const admin = await ctx2.newPage();
  await login(admin, "admin@example.com", "Admin@12345");
  await admin.goto("/users");
  await admin.getByRole("row", { name: /acc@example.com/ }).getByRole("button", { name: "تعطيل" }).click();
  await expect(admin.getByRole("row", { name: /acc@example.com/ })).toContainText("معطّل");
  await ctx2.close();
  await page.goto("/monthly");
  await page.waitForURL(/\/login/);
});

test("إيقاف الدخول بعد 5 محاولات خاطئة", async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await page.goto("/login");
    await page.fill('input[name="email"]', "nobody@example.com");
    await page.fill('input[name="password"]', "wrong-password");
    await page.click("button");
    await expect(page.getByRole("alert").filter({ hasText: "غير صحيحة" })).toBeVisible();
  }
  await page.goto("/login");
  await page.fill('input[name="email"]', "nobody@example.com");
  await page.fill('input[name="password"]', "Any@12345");
  await page.click("button");
  await expect(page.getByRole("alert").filter({ hasText: "أُوقف الدخول" })).toBeVisible();
});

test("النسخة الاحتياطية للمدير فقط والإعدادات", async ({ page }) => {
  await login(page);
  const res = await page.request.get("/api/export?table=backup");
  expect(res.status()).toBe(200);
  expect((await res.body()).subarray(0, 2).toString()).toBe("PK");

  await page.goto("/settings");
  await page.locator('input[name="annualLeaveEntitlement"]').fill("25");
  await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
  await expect(page.getByText("✔ تم الحفظ")).toBeVisible();
  await page.goto("/leave-form?y=2026");
  await expect(page.getByText("الرصيد السنوي: 25 يوم")).toBeVisible();
  await page.goto("/settings");
  await page.locator('input[name="annualLeaveEntitlement"]').fill("30");
  await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
  await expect(page.getByText("✔ تم الحفظ")).toBeVisible();

  const anon = await page.context().browser()!.newContext({ baseURL: test.info().project.use.baseURL });
  const r2 = await anon.request.get("/api/export?table=backup", { maxRedirects: 0 });
  expect(r2.status()).toBe(401);
  await anon.close();
});
