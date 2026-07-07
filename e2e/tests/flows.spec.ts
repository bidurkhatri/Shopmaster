import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOTS = "screenshots";
mkdirSync(`${__dirname}/../${SHOTS}`, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function login(page: Page, email = "owner@harbour-view.test") {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/pos/);
}

test("landing page renders the four channels", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /One order engine/i })).toBeVisible();
  await expect(page.getByText("Point of sale")).toBeVisible();
  await shot(page, "01-landing");
});

test("staff POS: login → add items → cash payment (offline-capable outbox)", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Point of Sale" })).toBeVisible();
  // add two items from the default (Coffee) category
  await page.getByTestId("menu-item").nth(0).click();
  await page.getByTestId("menu-item").nth(1).click();
  await expect(page.getByRole("button", { name: "Take Payment" })).toBeEnabled();
  await shot(page, "02-pos");
  await page.getByRole("button", { name: "Take Payment" }).click();
  await expect(page.getByRole("heading", { name: "Take Payment" })).toBeVisible();
  await shot(page, "03-pos-payment");
  await page.getByRole("button", { name: "Charge Cash" }).click();
  await expect(page.getByText(/Paid/)).toBeVisible();
});

test("kitchen display shows confirmed orders", async ({ page }) => {
  await login(page);
  await page.goto("/kitchen");
  await expect(page.getByRole("heading", { name: "Kitchen Display" })).toBeVisible();
  await shot(page, "04-kitchen");
});

test("admin dashboard renders sales report", async ({ page }) => {
  await login(page);
  await page.goto("/admin");
  await expect(page.getByText("Payment mix (per rail)")).toBeVisible();
  await expect(page.getByText("Gross")).toBeVisible();
  await shot(page, "05-admin-dashboard");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByText("Add item")).toBeVisible();
  await shot(page, "06-admin-menu");
  await page.getByRole("button", { name: "Tables" }).click();
  await expect(page.getByText(/Printable QR codes/)).toBeVisible();
  await shot(page, "07-admin-tables");
});

test("admin inventory: stock levels and low-stock alert (INV-01/02)", async ({ page }) => {
  await login(page);
  await page.goto("/admin");
  // Growth-tier merchant → the Inventory tab is enabled by the capability manifest.
  await page.getByRole("button", { name: "Inventory" }).click();
  await expect(page.getByText("Stock levels")).toBeVisible();
  await expect(page.getByText("Tracked items")).toBeVisible();
  // Two seeded items sit below their reorder point → the low-stock banner shows.
  await expect(page.getByText(/at or below the reorder point/)).toBeVisible();
  await shot(page, "13-admin-inventory");
  // The set-stock (stock-take) dialog opens with editable fields (exact match avoids "Settings").
  await page.getByRole("button", { name: "Set", exact: true }).first().click();
  await expect(page.getByText("On hand")).toBeVisible();
});

test("admin loyalty: rewards members with visits and points (CRM-01/02)", async ({ page }) => {
  await login(page);
  await page.goto("/admin");
  // Growth-tier merchant → the Customers tab is enabled by the capability manifest.
  await page.getByRole("button", { name: "Customers" }).click();
  await expect(page.getByText("Rewards members")).toBeVisible();
  await expect(page.getByText("Points issued")).toBeVisible();
  // Seeded rewards member with two visits shows up.
  await expect(page.getByText("Jordan Lee")).toBeVisible();
  await shot(page, "16-admin-customers");
});

test("admin cash: open a shift then close and reconcile the drawer (POS-07)", async ({ page }) => {
  await login(page);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Cash", exact: true }).click();
  await expect(page.getByText("Start a shift")).toBeVisible();
  await page.getByPlaceholder("0.00").fill("100");
  await page.getByRole("button", { name: "Open shift" }).click();
  await expect(page.getByText("Drawer open")).toBeVisible();
  await expect(page.getByText("Expected in drawer")).toBeVisible();
  await shot(page, "17-admin-cash");
  // Close and count the drawer — a fresh shift with no sales balances at the float.
  await page.getByRole("button", { name: /Close.*count drawer/ }).click();
  await expect(page.getByRole("heading", { name: "Close drawer" })).toBeVisible();
  await page.getByPlaceholder("0.00").fill("100");
  await page.getByRole("button", { name: "Close shift" }).click();
  await expect(page.getByText("Balanced")).toBeVisible();
});

test("POS tipping: add a tip then charge cash (PAY-06)", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Point of Sale" })).toBeVisible();
  // Match the proven POS flow — two taps reliably put an item in the cart even if the first opens
  // the modifier sheet — so "Take Payment" is enabled.
  await page.getByTestId("menu-item").nth(0).click();
  await page.getByTestId("menu-item").nth(1).click();
  await expect(page.getByRole("button", { name: "Take Payment" })).toBeEnabled();
  await page.getByRole("button", { name: "Take Payment" }).click();
  await expect(page.getByRole("heading", { name: "Take Payment" })).toBeVisible();
  // Apply a 10% tip — the amount due updates to include it.
  await page.getByRole("button", { name: "10%" }).click();
  await expect(page.getByText(/Incl. tip/)).toBeVisible();
  await shot(page, "14-pos-tip");
  await page.getByRole("button", { name: "Charge Cash" }).click();
  await expect(page.getByText(/Paid/)).toBeVisible();
});

test("POS split bill: even 2-way split settles the order (POS-04)", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Point of Sale" })).toBeVisible();
  await page.getByTestId("menu-item").nth(0).click();
  await page.getByTestId("menu-item").nth(1).click();
  await page.getByRole("button", { name: "Split bill" }).click();
  await expect(page.getByRole("heading", { name: "Split bill" })).toBeVisible();
  await expect(page.getByText("Pay share 1 of 2")).toBeVisible();
  await shot(page, "18-pos-split");
  await page.getByRole("button", { name: "Cash", exact: true }).click();
  await expect(page.getByText("Pay share 2 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Cash", exact: true }).click();
  await expect(page.getByText(/split.*settled/i)).toBeVisible();
});

test("POS discount over threshold needs a manager PIN (POS-05)", async ({ page }) => {
  await login(page);
  await page.getByTestId("menu-item").nth(0).click();
  await page.getByTestId("menu-item").nth(1).click();
  // A 25% discount trips the manager-approval gate and blocks payment until approved.
  await page.getByLabel("Discount value").fill("25");
  await expect(page.getByText(/Manager approval required/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Take Payment" })).toBeDisabled();
  await page.getByText(/tap to approve/).click();
  await expect(page.getByRole("heading", { name: "Manager approval" })).toBeVisible();
  await page.getByLabel("Manager PIN").fill("1111");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText(/Discount approved by/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Take Payment" })).toBeEnabled();
  await shot(page, "19-pos-discount-approved");
});

test("customer QR ordering: scan table → order → confirmation", async ({ page }) => {
  await page.goto("/t/hv-t5");
  await expect(page.getByRole("heading", { name: "Harbour View Kitchen" })).toBeVisible();
  await shot(page, "08-qr-menu");
  await page.getByTestId("menu-item").first().click();
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await shot(page, "09-qr-confirmation");
});

test("branded online storefront: pickup order end-to-end", async ({ page }) => {
  await page.goto("/s/himalayan-tea");
  await expect(page.getByRole("heading", { name: "Himalayan Tea House" })).toBeVisible();
  await shot(page, "10-storefront-nepal");
  await page.getByTestId("menu-item").first().click();
  await page.getByRole("button", { name: /Place & pay/ }).click();
  await expect(page.getByRole("heading", { name: "Order placed" })).toBeVisible();
  await shot(page, "11-storefront-confirmation");
});

test("kiosk self-service order", async ({ page }) => {
  await login(page);
  await page.goto("/kiosk");
  await page.getByRole("button", { name: /Tap to order/ }).click();
  await page.getByTestId("menu-item").first().click();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Order placed")).toBeVisible();
  await shot(page, "12-kiosk");
});
