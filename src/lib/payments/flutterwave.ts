import { createHmac, timingSafeEqual } from "node:crypto";

type Currency = "KES" | "USD";

export function getCertificatePrice(currency: Currency): number | null {
  const raw = currency === "KES"
    ? process.env.AJEY_CERTIFICATE_PRICE_KES
    : process.env.AJEY_CERTIFICATE_PRICE_USD;
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function createFlutterwaveCheckout(input: {
  amount: number;
  currency: Currency;
  txRef: string;
  email: string;
  name?: string;
  redirectUrl: string;
  courseSlug: string;
  orderId: string;
}) {
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret) throw new Error("FLUTTERWAVE_NOT_CONFIGURED");
  const paymentOptions = input.currency === "KES" ? "card, mpesa" : "card";
  const response = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tx_ref: input.txRef,
      amount: input.amount,
      currency: input.currency,
      redirect_url: input.redirectUrl,
      payment_options: paymentOptions,
      customer: { email: input.email, name: input.name ?? "AJEY learner" },
      customizations: {
        title: "AJEY Certificate",
        description: `Certificate for ${input.courseSlug.replaceAll("-", " ")}`,
        logo: `${new URL(input.redirectUrl).origin}/ajey-logo.jpg`
      },
      meta: { order_id: input.orderId, course_slug: input.courseSlug }
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status !== "success" || !payload?.data?.link) {
    console.error("Flutterwave checkout initialization failed", {
      status: response.status,
      message: payload?.message ?? "Unknown provider error"
    });
    throw new Error("FLUTTERWAVE_CHECKOUT_FAILED");
  }
  return payload.data.link as string;
}

export async function verifyFlutterwaveTransaction(transactionId: string) {
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret) throw new Error("FLUTTERWAVE_NOT_CONFIGURED");
  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`,
    {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20000)
    }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status !== "success" || !payload?.data) {
    throw new Error("FLUTTERWAVE_VERIFICATION_FAILED");
  }
  return payload.data as {
    id: number;
    tx_ref: string;
    status: string;
    amount: number;
    currency: string;
    charged_amount?: number;
  };
}

export function isValidFlutterwaveSignature(rawBody: string, signature: string | null) {
  const secretHash = process.env.FLW_SECRET_HASH;
  if (!secretHash || !signature) return false;
  const expected = createHmac("sha256", secretHash).update(rawBody).digest("base64");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer);
}
