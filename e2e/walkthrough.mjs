/**
 * Live walkthrough: drives the running app (http://localhost:3000) in a real browser and captures
 * full-page screenshots of every channel + the new Phase-2 features, as proof it runs end-to-end.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = "/home/user/Shopmaster/e2e/walkthrough";
mkdirSync(OUT, { recursive: true });
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3000";

const shots = [];
async function shot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  shots.push(name);
  console.log(`  ✓ ${name}`);
}

async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/pos/);
}

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
const page = await ctx.newPage();

try {
  console.log("Landing + channels");
  await page.goto(BASE);
  await page.waitForSelector("h1");
  await shot(page, "01-landing");

  console.log("Harbour View POS (tips, split, discount PIN)");
  await login(page, "owner@harbour-view.test");
  const addTwo = async () => {
    await page.waitForSelector('[data-testid="menu-item"]');
    await page.getByTestId("menu-item").nth(0).click();
    await page.getByTestId("menu-item").nth(1).click();
  };
  await addTwo();
  await shot(page, "02-pos");

  // Tip in the payment modal (fresh /pos each demo to keep them independent)
  await page.getByRole("button", { name: "Take Payment" }).click();
  await page.getByRole("button", { name: "10%" }).click();
  await shot(page, "03-pos-tip");

  // Discount -> manager PIN prompt
  await page.goto(`${BASE}/pos`);
  await addTwo();
  await page.getByLabel("Discount value").fill("25");
  await page.getByText(/tap to approve/).click();
  await shot(page, "04-pos-discount-pin");
  await page.getByLabel("Manager PIN").fill("1111");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByText(/Discount approved by/).first().waitFor();
  await shot(page, "05-pos-discount-approved");

  // Split bill
  await page.goto(`${BASE}/pos`);
  await addTwo();
  await page.getByRole("button", { name: "Split bill" }).click();
  await page.getByText("Pay share 1 of 2").waitFor();
  await shot(page, "06-pos-split");

  console.log("Admin — dashboard, inventory, customers, cash");
  await page.goto(`${BASE}/admin`);
  await page.getByText("Payment mix (per rail)").waitFor();
  await shot(page, "07-admin-dashboard");
  await page.getByRole("button", { name: "Inventory" }).click();
  await page.getByText("Stock levels").waitFor();
  await shot(page, "08-admin-inventory");
  await page.getByRole("button", { name: "Customers" }).click();
  await page.getByText("Rewards members").waitFor();
  await shot(page, "09-admin-customers");
  await page.getByRole("button", { name: "Cash", exact: true }).click();
  await page.getByText("Start a shift").waitFor();
  await shot(page, "10-admin-cash");

  console.log("Kitchen display");
  await page.goto(`${BASE}/kitchen`);
  await page.getByRole("heading", { name: "Kitchen Display" }).waitFor();
  await shot(page, "11-kitchen");

  console.log("Metro Coffee — Enterprise multi-location");
  await ctx.clearCookies();
  const page2 = await ctx.newPage();
  await login(page2, "owner@metro-coffee.test");
  await page2.goto(`${BASE}/admin`);
  await page2.getByText("Payment mix (per rail)").waitFor();
  await page2.getByLabel("Location").waitFor();
  await shot(page2, "12-admin-multilocation");
  await page2.close();

  console.log("Customer channels — QR + Nepal storefront");
  await page.goto(`${BASE}/t/hv-t1`);
  await page.getByRole("heading", { name: "Harbour View Kitchen" }).waitFor();
  await shot(page, "13-qr-storefront");
  await page.goto(`${BASE}/s/himalayan-tea`);
  await page.getByRole("heading", { name: "Himalayan Tea House" }).waitFor();
  await shot(page, "14-nepal-storefront");

  console.log(`\nDONE — ${shots.length} screenshots in ${OUT}`);
} catch (e) {
  console.error("WALKTHROUGH ERROR:", e.message);
  await page.screenshot({ path: `${OUT}/ERROR.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
