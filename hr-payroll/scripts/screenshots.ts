// لقطات شاشة لكل الشاشات: npm run screenshots  (يتطلب تشغيل الخادم على BASE_URL)
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT_DIR ?? "docs/screenshots";
const Q = process.env.MONTH_QUERY ?? "y=2026&m=10";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, locale: "ar" });
  await page.goto(`${BASE}/login`);
  await page.screenshot({ path: `${OUT}/00-login.png` });
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL ?? "admin@example.com");
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD ?? "Admin@12345");
  await page.click("button");
  await page.waitForURL(`${BASE}/`);
  const shots: [string, string][] = [
    ["01-dashboard", `/?${Q}`],
    ["02-monthly", `/monthly?${Q}`],
    ["03-attendance", `/attendance`],
    ["04-employees", `/employees`],
    ["05-extras", `/extras?${Q}`],
    ["06-deductions", `/deductions?${Q}`],
    ["07-leave-form", `/leave-form?y=2026`],
    ["11-payslip", `/payslip?${Q}`],
    ["12-users", `/users`],
    ["13-settings", `/settings`],
    ["14-account", `/account`],
  ];
  for (const [name, url] of shots) {
    await page.goto(BASE + url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: name === "01-dashboard" });
    console.log("✔", name);
  }
  // قائمة الرموز الصغيرة في إدخال الحضور، ثم تعديل خانة (يظهر في سجل التدقيق)
  await page.goto(`${BASE}/attendance`);
  await page.waitForLoadState("networkidle");
  const cell = page.locator('[data-testid^="grid-row-"]').nth(1).locator('button[data-day="5"]');
  await cell.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/09-attendance-menu.png` });
  await page.getByRole("menuitem", { name: "م", exact: true }).click();
  await page.getByText("✔ تم الحفظ").waitFor();
  console.log("✔ 09-attendance-menu");

  await page.goto(`${BASE}/audit`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/08-audit.png` });
  console.log("✔ 08-audit");

  // معاينة الطباعة (A4 أفقي)
  await page.goto(`${BASE}/monthly?${Q}`);
  await page.waitForLoadState("networkidle");
  await page.emulateMedia({ media: "print" });
  await page.screenshot({ path: `${OUT}/10-monthly-print.png` });
  await page.pdf({ path: `${OUT}/monthly-${Q.replace(/\W+/g, "-")}.pdf`, format: "A4", landscape: true, printBackground: true });
  await page.emulateMedia({ media: "screen" });
  console.log("✔ 10-monthly-print");

  // الجوال
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "ar", deviceScaleFactor: 2 });
  await phone.context().addCookies(await page.context().cookies());
  for (const [name, url] of [["20-mobile-dashboard", `/?${Q}`], ["21-mobile-attendance", "/attendance"], ["22-mobile-payslip", `/payslip?${Q}`]] as const) {
    await phone.goto(BASE + url);
    await phone.waitForLoadState("networkidle");
    await phone.waitForTimeout(500);
    await phone.screenshot({ path: `${OUT}/${name}.png` });
    console.log("✔", name);
  }
  await phone.getByRole("button", { name: "فتح القائمة" }).click();
  await phone.waitForTimeout(300);
  await phone.screenshot({ path: `${OUT}/23-mobile-menu.png` });
  console.log("✔ 23-mobile-menu");

  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
