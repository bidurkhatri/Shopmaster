/**
 * Offline outbox (FE-03/FE-04). Staff POS writes every order event into a local IndexedDB queue
 * first — actions complete instantly, nothing waits on the network. A background drain pushes the
 * batch to POST /sync whenever connectivity exists (the client half of the sync engine, BE-03).
 * Orders opened offline are created server-side from their queued ORDER_CREATED event.
 */
"use client";
import { openDB, type IDBPDatabase } from "idb";
import { api } from "./api";
import type { OrderEventInput } from "@shopmaster/shared";

const LAST_SYNC_KEY = "shopmaster-last-sync";

let dbp: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB("shopmaster-outbox", 1, {
      upgrade(d) {
        d.createObjectStore("events", { keyPath: "key" });
      },
    });
  }
  return dbp;
}

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((l) => l());
}
export function subscribeOutbox(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export async function enqueueEvents(events: OrderEventInput[], deviceId?: string): Promise<void> {
  const d = await db();
  const tx = d.transaction("events", "readwrite");
  for (const e of events) {
    await tx.store.put({ key: e.idempotencyKey, event: e, createdAt: Date.now() });
  }
  await tx.done;
  notify();
  void drain(deviceId);
}

export async function pendingCount(): Promise<number> {
  try {
    const d = await db();
    return await d.count("events");
  } catch {
    return 0;
  }
}

export function lastSyncAt(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LAST_SYNC_KEY);
}

let draining = false;
export async function drain(deviceId?: string): Promise<{ ok: boolean; sent: number }> {
  if (draining) return { ok: false, sent: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, sent: 0 };
  draining = true;
  try {
    const d = await db();
    const all = (await d.getAll("events")) as { key: string; event: OrderEventInput }[];
    if (all.length === 0) return { ok: true, sent: 0 };
    await api.post("/sync", { deviceId, events: all.map((r) => r.event) });
    const tx = d.transaction("events", "readwrite");
    for (const r of all) await tx.store.delete(r.key);
    await tx.done;
    if (typeof localStorage !== "undefined") localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    notify();
    return { ok: true, sent: all.length };
  } catch {
    return { ok: false, sent: 0 }; // stays queued; will retry
  } finally {
    draining = false;
  }
}

let started = false;
export function startOutboxSync(deviceId?: string): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => void drain(deviceId));
  window.addEventListener("offline", notify);
  setInterval(() => void drain(deviceId), 5000);
  void drain(deviceId);
}
