import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidIntaSendChallenge } from "@/lib/payments/intasend";
import { completeVerifiedPayment } from "../_complete";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload || !isValidIntaSendChallenge(payload.challenge)) {
    return NextResponse.json({ error: "Invalid webhook challenge." }, { status: 401 });
  }

  try {
    if (payload.topic === "collection_event" && payload.invoice_id) {
      if (payload.state === "COMPLETE") {
        await completeVerifiedPayment(String(payload.invoice_id), typeof payload.api_ref === "string" ? payload.api_ref : undefined);
      } else if (payload.state === "FAILED" || payload.state === "CANCELED") {
        const admin = createAdminClient();
        if (typeof payload.api_ref === "string") {
          await admin.from("payment_orders").update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("tx_ref", payload.api_ref).eq("status", "pending");
        }
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("AJEY IntaSend webhook processing failed", error instanceof Error ? error.message : "UNKNOWN");
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
