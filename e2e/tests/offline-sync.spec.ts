import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Self-contained helpers, mirrored from flows.spec.ts (screenshots + Tier-1 login).
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

/**
 * GAP-06 / SYNC — offline-first cash sale. On /pos the staff cashier can ring up and take cash with
 * no network: every order event is written to the IndexedDB outbox first (apps/web src/lib/outbox.ts,
 * FE-03/04), and the always-on sync indicator (components/SyncIndicator.tsx, FE-11 / SYNC-05) shows
 * Offline + queue depth. On reconnect the background drain flushes the batch to POST /sync and the
 * queue empties back to Online.
 */
test("offline sync: cash sale queues in the outbox and drains on reconnect (GAP-06 / SYNC)", async ({ page, context }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Point of Sale" })).toBeVisible();

  // Let the menu (/menu) and location context (/context) load while still ONLINE: the item tiles
  // must exist to tap, and payCash needs the resolved location. The table select carrying "T1"
  // proves /context has landed.
  await expect(page.getByTestId("menu-item").first()).toBeVisible();
  await expect(page.getByRole("combobox")).toContainText("T1");

  const indicator = page.locator("header"); // the SyncIndicator lives in the staff shell header

  // --- Go offline: the sync indicator flips to Offline (FE-11). ---
  await context.setOffline(true);
  await expect(indicator.getByText("Offline", { exact: true })).toBeVisible();

  // Ring up a two-item cash sale entirely offline. Every event lands in the IndexedDB outbox;
  // the drain is a no-op while navigator.onLine is false, so it stays queued.
  await page.getByTestId("menu-item").nth(0).click();
  await page.getByTestId("menu-item").nth(1).click();
  await page.getByRole("button", { name: "Take Payment" }).click();
  await expect(page.getByRole("heading", { name: "Take Payment" })).toBeVisible();
  await page.getByRole("button", { name: "Charge Cash" }).click();

  // The outbox now holds a queue > 0 and the indicator surfaces the depth ("N queued").
  const queued = indicator.getByText(/\d+\s+queued/);
  await expect(queued).toBeVisible();
  const depth = Number((await queued.textContent())?.match(/\d+/)?.[0] ?? "0");
  expect(depth).toBeGreaterThan(0);
  await shot(page, "14-offline-queued");

  // --- Reconnect: the background drain flushes the outbox to POST /sync; queue empties to Online. ---
  await context.setOffline(false);
  await expect(indicator.getByText("Online", { exact: true })).toBeVisible();
  await expect(indicator.getByText(/queued/)).toHaveCount(0);
  await shot(page, "15-online-synced");
});
