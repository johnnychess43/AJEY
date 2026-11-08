import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeVerifiedPayment } from "../_complete";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const txRef = url.searchParams.get("ref");
  if (!txRef) return NextResponse.redirect(new URL("/?certificate_payment=not_verified", url.origin));

  try {
    const admin = createAdminClient();
    const { data: order } = await admin.from("payment_orders")
      .select("id,provider_invoice_id")
      .eq("tx_ref", txRef)
      .maybeSingle();
    if (!order?.provider_invoice_id) {
      return NextResponse.redirect(new URL("/?certificate_payment=not_found", url.origin));
    }
    const certificate = await completeVerifiedPayment(order.provider_invoice_id, txRef);
    return NextResponse.redirect(new URL(`/?certificate_payment=success&certificate=${certificate.id}`, url.origin));
  } catch (error) {
    console.error("AJEY IntaSend callback verification failed", error instanceof Error ? error.message : "UNKNOWN");
    return NextResponse.redirect(new URL("/?certificate_payment=verification_failed", url.origin));
  }
}
