/**
 * Domain event emitter (BE-03). The Order Service emits an internal event on every state change;
 * Inventory, Reporting, and CRM subscribe independently so confirming an order never waits on a
 * secondary effect. In production this is Redis/BullMQ; here it's a tiny in-process emitter behind
 * the same publish/subscribe shape, so swapping the transport later touches only this file.
 */
export type DomainEvent =
  | { type: "order.created"; orderId: string; organizationId: string }
  | { type: "order.paid"; orderId: string; organizationId: string; amountMinor: number }
  | { type: "order.confirmed"; orderId: string; organizationId: string }
  | { type: "order.closed"; orderId: string; organizationId: string };

type Handler = (e: DomainEvent) => void;

const handlers = new Set<Handler>();

export function onDomainEvent(handler: Handler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function emitDomainEvent(e: DomainEvent): void {
  for (const h of handlers) {
    try {
      h(e);
    } catch {
      // A subscriber failure must never break the primary order path (BE-03). Swallow + continue.
    }
  }
}
