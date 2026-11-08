import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeVerifiedPayment } from "../_complete";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const txRef = url.searchParams.get("tx_ref");
  const transactionId = url.searchParams.get("transaction_id");
  const status = url.searchParams.get("status");
  const auth = await createClient();
  const { data: { user } } = auth ? await auth.auth.getUser() : { data: { user: null } };

  if (!txRef || !transactionId || status !== "successful" || !user) {
    return NextResponse.redirect(new URL("/?certificate_payment=not_verified", url.origin));
  }

  try {
    const admin = createAdminClient();
    const { data: order } = await admin.from("payment_orders")
      .select("id,user_id,tx_ref")
      .eq("tx_ref", txRef)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!order) return NextResponse.redirect(new URL("/?certificate_payment=not_found", url.origin));
    const certificate = await completeVerifiedPayment(transactionId, txRef);
    return NextResponse.redirect(new URL(`/?certificate_payment=success&certificate=${certificate.id}`, url.origin));
  } catch (error) {
    console.error("AJEY payment callback verification failed", error instanceof Error ? error.message : "UNKNOWN");
    return NextResponse.redirect(new URL("/?certificate_payment=verification_failed", url.origin));
  }
}
