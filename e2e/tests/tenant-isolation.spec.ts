import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Self-contained helpers, mirrored from flows.spec.ts (screenshots + Tier-1 login).
const SHOTS = "screenshots";
mkdirSync(`${__dirname}/../${SHOTS}`, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

// The REST surface the web app talks to (apps/api). Matches NEXT_PUBLIC_API_URL's default.
const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function login(page: Page, email = "owner@harbour-view.test") {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/pos/);
}

/**
 * GAP-05 — tenant isolation at the API boundary. The Sydney owner (Harbour View Kitchen) holds a
 * valid Tier-1 JWT scoped to their own organization. Reading an order that belongs to the OTHER
 * tenant (Himalayan Tea House) must return 404, never 200 — the org id, not the caller, decides
 * visibility (apps/api getOrderScoped; API_CONTRACT `GET /orders/:id` — "404 cross-tenant").
 */
test("tenant isolation: Sydney owner cannot read a Himalayan-tea order (GAP-05)", async ({ page }) => {
  await login(page); // owner@harbour-view.test — the Sydney (AUD, Growth) owner
  await expect(page.getByRole("heading", { name: "Point of Sale" })).toBeVisible();

  // The bearer token the web app persisted (zustand `persist`, localStorage key "shopmaster-auth").
  const token = await page.evaluate(() => {
    const raw = localStorage.getItem("shopmaster-auth");
    return raw ? ((JSON.parse(raw) as { state?: { token?: string } }).state?.token ?? null) : null;
  });
  expect(token).toBeTruthy();

  // A genuine order that belongs to the OTHER tenant. Created via the unauthenticated public
  // storefront endpoint (orgSlug → Himalayan Tea House), so we own a real cross-tenant order id.
  const created = await page.request.post(`${API_BASE}/public/orders`, {
    data: { orgSlug: "himalayan-tea", fulfillment: "PICKUP" },
  });
  expect(created.status()).toBe(201);
  const foreignOrder = (await created.json()) as { id: string; organizationId: string };
  expect(foreignOrder.id).toBeTruthy();

  // Sanity: the order genuinely exists (public read is 200), so the 404 below can only be isolation.
  const publicRead = await page.request.get(`${API_BASE}/public/orders/${foreignOrder.id}`);
  expect(publicRead.status()).toBe(200);

  // Positive control: the Sydney token authenticates fine against its OWN tenant (rules out a
  // false 404 caused by a bad/expired token — that path would 401, not 404).
  const own = await page.request.get(`${API_BASE}/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(own.status()).toBe(200);

  // GAP-05: cross-tenant read of the Himalayan order is 404 — tenant isolation holds at the boundary.
  const cross = await page.request.get(`${API_BASE}/orders/${foreignOrder.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(cross.status()).toBe(404);

  await shot(page, "13-tenant-isolation");
});
