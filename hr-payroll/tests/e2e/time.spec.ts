import { expect, test, type Page } from "@playwright/test";

// الدوام والإضافي: 9 ساعات رسمية، ما بعدها إضافي بمعدل الإعدادات، والعمل في الإجازة الرسمية كله إضافي.
// الموظف 622001 راتبه 1000 — أكتوبر 2026 (31 يومًا): أجرة الساعة = 1000 ÷ 31 ÷ 9 = 3.5842

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@example.com");
  await page.fill('input[name="password"]', "Admin@12345");
  await page.click("button");
  await page.waitForURL("/");
}

async function setTimes(page: Page, date: string, checkIn: string, checkOut: string) {
  const row = page.getByTestId(`time-row-${date}`);
  await row.getByLabel(`دخول ${date}`).fill(checkIn);
  await row.getByLabel(`خروج ${date}`).fill(checkOut);
  await row.getByLabel(`خروج ${date}`).blur();
  await expect(page.getByText(/✔ تم الحفظ/)).toBeVisible();
  return row;
}

test("الدوام ← الإضافي التلقائي بمعدل الإعدادات، والإجازة الرسمية", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await login(page);

  // الإعدادات: الإضافي بساعة وربع، وإجازة رسمية يوم الأربعاء 14/10/2026
  await page.goto("/settings");
  await page.locator('select[name="overtimeRate"]').selectOption("1.25");
  await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
  await expect(page.getByText(/✔ تم الحفظ/)).toBeVisible();
  await page.getByLabel("تاريخ الإجازة").fill("2026-10-14");
  await page.getByLabel("اسم الإجازة").fill("إجازة اختبار");
  await page.getByRole("button", { name: "إضافة", exact: true }).click();
  await expect(page.getByText("✔ أُضيفت إجازة اختبار")).toBeVisible();

  // شاشة الدوام: ملخص الشهر ثم أيام الموظف
  await page.goto("/time?y=2026&m=10");
  await page.getByTestId("time-sum-622001").getByRole("link").click();
  await page.waitForURL(/emp=/);

  // يوم عادي: 08:00 – 19:30 = 11:30 ← إضافي 2:30 ×1.25
  const r1 = await setTimes(page, "2026-10-12", "08:00", "19:30");
  await expect(r1.getByTestId("time-ot")).toHaveText("2:30 ×1.25");
  // نقص: 08:30 – 17:00 = 8:30 ← نقص 0:30 بلا إضافي، ويُخصم لأنه تجاوز مهلة السماح (15 دقيقة)
  const r2 = await setTimes(page, "2026-10-13", "08:30", "17:00");
  await expect(r2.getByTestId("time-ot")).toHaveText("");
  await expect(r2.getByTestId("time-cut")).toHaveText("0:30");
  // نقص ضمن المهلة: 08:10 – 17:00 = 8:50 ← لا خصم
  const r4 = await setTimes(page, "2026-10-15", "08:10", "17:00");
  await expect(r4).toContainText("0:10");
  await expect(r4.getByTestId("time-cut")).toHaveText("");
  // الإجازة الرسمية: 09:00 – 13:00 ← كل الساعات إضافي 4:00 ×1.5 (معدل العطلات)
  const r3 = await setTimes(page, "2026-10-14", "09:00", "13:00");
  await expect(r3).toContainText("إجازة اختبار");
  await expect(r3.getByTestId("time-ot")).toHaveText("4:00 ×1.5");

  // سجل الإضافي: سطور تلقائية بالمبالغ الصحيحة
  await page.goto("/extras?y=2026&m=10");
  const ot1 = page.getByTestId("entry-row").filter({ hasText: "12/10/2026" }).filter({ has: page.getByTestId("from-time") });
  await expect(ot1.getByTestId("entry-amount")).toHaveText("11.201"); // 2.5 × 1.25 × 3.5842
  const ot3 = page.getByTestId("entry-row").filter({ hasText: "14/10/2026" }).filter({ has: page.getByTestId("from-time") });
  await expect(ot3.getByTestId("entry-amount")).toHaveText("21.505"); // 4 × 1.5 × 3.5842

  // سجل الخصومات: سطر تأخير تلقائي ساعة بساعة — 30 دقيقة × 3.5842 ÷ 60
  await page.goto("/deductions?y=2026&m=10");
  const cut = page.getByTestId("entry-row").filter({ has: page.getByTestId("from-time") });
  await expect(cut).toHaveCount(1);
  await expect(cut).toContainText("13/10/2026");
  await expect(cut.getByTestId("entry-amount")).toHaveText("1.792");

  // تعديل الوقت يحدّث السطر نفسه، ولا يكرره
  await page.goto("/time?y=2026&m=10");
  await page.getByTestId("time-sum-622001").getByRole("link").click();
  const r1b = await setTimes(page, "2026-10-12", "08:00", "18:00");
  await expect(r1b.getByTestId("time-ot")).toHaveText("1:00 ×1.25");
  await page.goto("/extras?y=2026&m=10");
  const rows12 = page.getByTestId("entry-row").filter({ hasText: "12/10/2026" }).filter({ has: page.getByTestId("from-time") });
  await expect(rows12).toHaveCount(1);
  await expect(rows12.getByTestId("entry-amount")).toHaveText("4.480"); // 1 × 1.25 × 3.5842

  // إكمال الساعات يحذف خصم ذلك اليوم
  await page.goto("/time?y=2026&m=10");
  await page.getByTestId("time-sum-622001").getByRole("link").click();
  const r2b = await setTimes(page, "2026-10-13", "08:00", "17:00");
  await expect(r2b.getByTestId("time-cut")).toHaveText("");
  await page.goto("/deductions?y=2026&m=10");
  await expect(page.getByTestId("entry-row").filter({ has: page.getByTestId("from-time") })).toHaveCount(0);

  // إرجاع الإعدادات وحذف الإجازة
  await page.goto("/settings");
  await page.locator('select[name="overtimeRate"]').selectOption("1.5");
  await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
  await expect(page.getByText(/✔ تم الحفظ/)).toBeVisible();
  await page.getByRole("button", { name: "حذف إجازة اختبار" }).click();
  await expect(page.getByTestId("holidays")).not.toContainText("إجازة اختبار");
});
