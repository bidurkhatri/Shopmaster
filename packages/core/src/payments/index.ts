/**
 * Payments abstraction (BE-07..BE-09, PAY-04). One interface — authorize / capture / refund /
 * getStatus — with one adapter per rail. Adding a rail is a new adapter, never a change to the
 * order service's payment-calling code. No raw card data ever reaches this layer; adapters return
 * only a processor token (PAY-07).
 *
 * IMPORTANT: every non-cash adapter here is a clearly-labelled MOCK/SANDBOX. It simulates the
 * shape of the real rail (authorize → capture → token) with NO network call and NO real money.
 * Wiring a live rail = replacing one adapter's body. There is deliberately NO Web3 adapter, and
 * by construction no crypto rail is ever selectable for an NPR (Nepal) merchant (Payment-Integration §6.1).
 */
import type { PaymentRail } from "@shopmaster/shared";

export type PaymentResultStatus = "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";

export interface PaymentIntent {
  orderId: string;
  amountMinor: number;
  currency: string;
  rail: PaymentRail;
  tenderedMinor?: number;
}

export interface PaymentResult {
  status: PaymentResultStatus;
  processorToken?: string;
  changeMinor?: number;
  message: string;
  mock: boolean;
}

export interface PaymentAdapter {
  rail: PaymentRail;
  /** T+? settlement note, surfaced to merchant reporting (Payment-Integration §9). */
  settlement: string;
  authorize(intent: PaymentIntent): Promise<PaymentResult>;
  capture(intent: PaymentIntent, processorToken?: string): Promise<PaymentResult>;
  refund(processorToken: string, amountMinor: number): Promise<PaymentResult>;
  getStatus(processorToken: string): Promise<PaymentResultStatus>;
}

function token(prefix: string, orderId: string): string {
  return `${prefix}_${orderId.slice(-8)}_${Math.abs(hash(orderId + prefix)).toString(36)}`;
}
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

/** Cash — the always-available, first-class tender (PAY-01). Real: computes change, no processor. */
const cashAdapter: PaymentAdapter = {
  rail: "CASH",
  settlement: "Instant, in hand",
  async authorize(intent) {
    const tendered = intent.tenderedMinor ?? intent.amountMinor;
    if (tendered < intent.amountMinor) {
      return { status: "FAILED", message: "Tendered amount is less than the total due.", mock: false };
    }
    return {
      status: "CAPTURED",
      changeMinor: tendered - intent.amountMinor,
      message: "Cash accepted.",
      mock: false,
    };
  },
  async capture(intent) {
    return this.authorize(intent);
  },
  async refund() {
    return { status: "REFUNDED", message: "Cash refunded from drawer.", mock: false };
  },
  async getStatus() {
    return "CAPTURED";
  },
};

/** Factory for a mock external rail (Fonepay/eSewa/Khalti/Tyro). Simulated authorize→capture. */
function mockRail(rail: PaymentRail, prefix: string, settlement: string): PaymentAdapter {
  return {
    rail,
    settlement,
    async authorize(intent) {
      return {
        status: "AUTHORIZED",
        processorToken: token(prefix, intent.orderId),
        message: `[MOCK ${rail}] Authorized ${intent.amountMinor} ${intent.currency}. Replace this adapter with the live rail.`,
        mock: true,
      };
    },
    async capture(intent, processorToken) {
      return {
        status: "CAPTURED",
        processorToken: processorToken ?? token(prefix, intent.orderId),
        message: `[MOCK ${rail}] Captured.`,
        mock: true,
      };
    },
    async refund(processorToken) {
      return { status: "REFUNDED", processorToken, message: `[MOCK ${rail}] Refunded.`, mock: true };
    },
    async getStatus() {
      return "CAPTURED";
    },
  };
}

const ADAPTERS: Record<PaymentRail, PaymentAdapter> = {
  CASH: cashAdapter,
  FONEPAY: mockRail("FONEPAY", "fpay", "T+1 to merchant bank (NepalQR / Fonepay)"),
  ESEWA: mockRail("ESEWA", "esw", "To merchant eSewa wallet, withdrawable to bank"),
  KHALTI: mockRail("KHALTI", "kh", "To merchant Khalti wallet, withdrawable to bank"),
  TYRO: mockRail("TYRO", "tyro", "Same-day to merchant Tyro Transaction Account"),
};

export function getPaymentAdapter(rail: PaymentRail): PaymentAdapter {
  const a = ADAPTERS[rail];
  if (!a) throw new Error(`No payment adapter for rail: ${rail}`);
  return a;
}

/** Charge helper: authorize then capture in one call (what the order service uses). */
export async function charge(intent: PaymentIntent): Promise<PaymentResult> {
  const adapter = getPaymentAdapter(intent.rail);
  const auth = await adapter.authorize(intent);
  if (auth.status !== "AUTHORIZED") return auth; // CAPTURED (cash) or FAILED
  const captured = await adapter.capture(intent, auth.processorToken);
  return { ...captured, changeMinor: auth.changeMinor };
}
