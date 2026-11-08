import { NextResponse } from "next/server";
import { isValidFlutterwaveSignature } from "@/lib/payments/flutterwave";
import { completeVerifiedPayment } from "../_complete";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("flutterwave-signature");
  if (!isValidFlutterwaveSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const transactionId = payload?.data?.id;
    if (payload?.type === "charge.completed" && transactionId) {
      await completeVerifiedPayment(String(transactionId));
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("AJEY Flutterwave webhook processing failed", error instanceof Error ? error.message : "UNKNOWN");
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
