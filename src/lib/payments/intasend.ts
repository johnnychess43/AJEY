import { timingSafeEqual } from "node:crypto";

type Currency = "KES" | "USD";

const API_BASE = "https://api.intasend.com/api/v1";

export function getCertificatePrice(currency: Currency): number | null {
  const raw = currency === "KES"
    ? process.env.AJEY_CERTIFICATE_PRICE_KES
    : process.env.AJEY_CERTIFICATE_PRICE_USD;
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function createIntaSendCheckout(input: {
  amount: number;
  currency: Currency;
  txRef: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  redirectUrl: string;
}) {
  const publishableKey = process.env.INTASEND_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error("INTASEND_NOT_CONFIGURED");

  const response = await fetch(`${API_BASE}/checkout/`, {
    method: "POST",
    headers: {
      "X-IntaSend-Public-API-Key": publishableKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      email: input.email,
      first_name: input.firstName || "AJEY",
      last_name: input.lastName || "Learner",
      phone_number: input.phoneNumber,
      api_ref: input.txRef,
      redirect_url: input.redirectUrl,
      host: new URL(input.redirectUrl).origin
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.id || !payload?.url) {
    console.error("IntaSend checkout initialization failed", {
      status: response.status,
      message: payload?.message ?? payload?.detail ?? "Unknown provider error"
    });
    throw new Error("INTASEND_CHECKOUT_FAILED");
  }
  return { invoiceId: String(payload.id), checkoutUrl: String(payload.url) };
}

export async function verifyIntaSendInvoice(invoiceId: string) {
  const secret = process.env.INTASEND_SECRET_KEY;
  if (!secret) throw new Error("INTASEND_NOT_CONFIGURED");

  const response = await fetch(`${API_BASE}/payment/status/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
  });
  const payload = await response.json().catch(() => null);
  const invoice = payload?.invoice ?? payload;
  if (!response.ok || !invoice?.invoice_id) {
    console.error("IntaSend invoice verification failed", { status: response.status });
    throw new Error("INTASEND_VERIFICATION_FAILED");
  }
  return invoice as {
    invoice_id: string;
    state: string;
    value: string | number;
    currency: string;
    api_ref?: string | null;
    provider_ref?: string | null;
    provider?: string | null;
  };
}

export function isValidIntaSendChallenge(received: unknown) {
  const expected = process.env.INTASEND_WEBHOOK_CHALLENGE;
  if (!expected || typeof received !== "string" || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer);
}
