import { expect, test, type Page } from "@playwright/test";

// المرونة: فتح أي شهر سابق، التسجيل بفترة تاريخ، التسجيل اليومي، صفحة الموظف، ورصيد الإجازة مع الترحيل.

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@example.com");
  await page.fill('input[name="password"]', "Admin@12345");
  await page.click("button");
  await page.waitForURL("/");
}

/** اختيار تاريخ كامل (YYYY-MM-DD) من منتقي التاريخ عبر قوائم السنة والشهر. */
async function pickDate(page: Page, label: string, iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  await page.getByRole("button", { name: label }).click();
  await page.locator("select.rdp-years_dropdown").selectOption(String(y));
  await page.locator("select.rdp-months_dropdown").selectOption(String(m - 1));
  await page.locator(".rdp-day:not(.rdp-outside) button", { hasText: new RegExp(`^${d}$`) }).first().click();
}

test("شهر سابق + إجازة بفترة تاريخ + ترحيل الرصيد للسنة التالية", async ({ page }) => {
  await login(page);

  // 1) فتح شهر سابق (03/2025) وإنشاء صفوفه
  await page.goto("/attendance");
  await page.getByRole("button", { name: "فتح / إضافة شهر" }).click();
  await page.getByLabel("الشهر المطلوب").fill("2025-03");
  await page.getByRole("button", { name: "عرض", exact: true }).click();
  await expect(page.getByText("سيُنشأ سطر فارغ لكل من يعمل في هذا الشهر")).toBeVisible();
  await page.getByRole("button", { name: "إنشاء صفوف 03/2025" }).click();
  await page.waitForURL(/month=2025-03/);
  await expect(page.getByTestId("grid-row-622002")).toBeVisible();

  // 2) إجازة من 10/03/2025 إلى 15/03/2025 — الجمعة 14/03 تُتخطّى
  await page.getByRole("button", { name: "تسجيل لفترة" }).click();
  const form = page.getByTestId("range-form");
  const sel = form.getByLabel("موظف الفترة");
  const value = await sel.locator("option", { hasText: "622002" }).getAttribute("value");
  await sel.selectOption(value!);
  await pickDate(page, "من تاريخ", "2025-03-10");
  await pickDate(page, "إلى تاريخ", "2025-03-15");
  await form.getByRole("button", { name: "تسجيل" }).click();
  await expect(form.getByRole("status")).toContainText("تم تسجيل 5 يوم");
  await expect(form.getByRole("status")).toContainText("تُخطّي 1 يوم عطلة");
  await expect(page.getByTestId("grid-row-622002").locator('button[data-day="10"]')).toHaveText("إ");
  await expect(page.getByTestId("grid-row-622002").locator('button[data-day="14"]')).toHaveText("");

  // 3) صفحة الموظف: 2025 = 30 − 5 = 25 يُرحَّل إلى 2026
  await page.goto("/employees");
  await page.getByTestId("emp-622002").getByRole("link").click();
  await page.waitForURL(/\/employees\/.+/);
  const ledger = page.getByTestId("leave-ledger");
  const r2025 = ledger.locator("tr", { hasText: /^2025/ });
  await expect(r2025.locator("td")).toHaveText(["2025", "0.0", "30", "5.0", "25.0"]);
  await expect(ledger.locator("tr", { hasText: /^2026/ }).locator("td").nth(1)).toHaveText("25.0");
  await page.getByLabel("السنة").selectOption("2025");
  await expect(page.getByTestId("leave-periods")).toContainText("10/03/2025");
  await expect(page.getByTestId("leave-periods")).toContainText("15/03/2025");
  await expect(page.getByTestId("year-row-2025-03").locator("td").nth(10)).toHaveText("إ");
});

test("التسجيل اليومي ليوم سابق: غائب واحد والباقي حاضر", async ({ page }) => {
  await login(page);
  await page.goto("/attendance/day?date=2025-03-03");
  await expect(page.getByRole("heading", { name: /الاثنين 03\/03\/2025/ })).toBeVisible();
  await page.getByRole("radio", { name: /^غائب / }).first().click();
  const empty = Number(await page.getByTestId("daily-empty").innerText());
  expect(empty).toBeGreaterThan(0);
  await page.getByRole("button", { name: /الباقي حاضر/ }).click();
  await expect(page.getByText(new RegExp(`تم تسجيل ${empty} حاضر`))).toBeVisible();
  await expect(page.getByTestId("daily-empty")).toHaveText("0");
  await page.reload();
  await expect(page.getByRole("radio", { name: /^غائب / }).first()).toHaveAttribute("aria-checked", "true");
});
