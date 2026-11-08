import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";

export async function completeVerifiedPayment(transactionId: string, expectedTxRef?: string) {
  const verified = await verifyFlutterwaveTransaction(transactionId);
  if (verified.status !== "successful") throw new Error("PAYMENT_NOT_SUCCESSFUL");
  if (!verified.tx_ref || (expectedTxRef && verified.tx_ref !== expectedTxRef)) {
    throw new Error("PAYMENT_REFERENCE_MISMATCH");
  }

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("payment_orders")
    .select("id,user_id,course_slug,amount,currency,status,tx_ref")
    .eq("tx_ref", verified.tx_ref)
    .single();
  if (error || !order) throw new Error("PAYMENT_ORDER_NOT_FOUND");

  if (Number(verified.amount) !== Number(order.amount) ||
      verified.currency !== order.currency ||
      verified.tx_ref !== order.tx_ref) {
    throw new Error("PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH");
  }

  await admin.from("payment_orders").update({
    status: "successful",
    flutterwave_transaction_id: String(verified.id),
    paid_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", order.id);

  const { data: existing } = await admin
    .from("certificates")
    .select("id,certificate_number")
    .eq("payment_order_id", order.id)
    .maybeSingle();

  if (existing) return existing;

  const certificateNumber = `AJY-${new Date().getFullYear()}-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  const { data: certificate, error: certificateError } = await admin
    .from("certificates")
    .insert({
      user_id: order.user_id,
      payment_order_id: order.id,
      course_slug: order.course_slug,
      certificate_number: certificateNumber
    })
    .select("id,certificate_number")
    .single();
  if (certificateError) throw certificateError;
  return certificate;
}
