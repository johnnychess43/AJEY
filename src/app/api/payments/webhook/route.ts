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
    if (payload.topic === "subscription_event" && typeof payload.reference === "string") {
      const planAmount = Number(payload.plan?.amount);
      const planCurrency = payload.plan?.currency;
      if (planAmount !== 50 || planCurrency !== "KES") {
        return NextResponse.json({ error: "Subscription plan mismatch." }, { status: 400 });
      }
      const rawStatus = String(payload.status ?? "").toUpperCase();
      const status = rawStatus === "ACTIVE" ? "active"
        : rawStatus === "CANCELED" ? "canceled"
        : rawStatus === "COMPLETE" ? "complete"
        : rawStatus === "FAILED" ? "failed" : "pending";
      const admin = createAdminClient();
      const { error } = await admin.from("member_subscriptions").update({
        provider_subscription_id: typeof payload.subscription_id === "string" ? payload.subscription_id : null,
        status,
        card_mask: typeof payload.card_mask === "string" ? payload.card_mask : null,
        card_type: typeof payload.card_type === "string" ? payload.card_type : null,
        next_billing_date: typeof payload.next_date === "string" ? payload.next_date : null,
        completed_cycles: Number.isInteger(payload.completed_cycles) ? payload.completed_cycles : 0,
        fail_reason: typeof payload.fail_reason === "string" ? payload.fail_reason : null,
        updated_at: new Date().toISOString()
      }).eq("reference", payload.reference);
      if (error) throw error;
    }

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
