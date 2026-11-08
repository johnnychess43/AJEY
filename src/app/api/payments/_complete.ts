import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyIntaSendInvoice } from "@/lib/payments/intasend";

export async function completeVerifiedPayment(invoiceId: string, expectedTxRef?: string) {
  const verified = await verifyIntaSendInvoice(invoiceId);
  if (verified.state !== "COMPLETE") throw new Error("PAYMENT_NOT_SUCCESSFUL");
  if (!verified.api_ref || (expectedTxRef && verified.api_ref !== expectedTxRef)) {
    throw new Error("PAYMENT_REFERENCE_MISMATCH");
  }

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("payment_orders")
    .select("id,user_id,course_slug,amount,currency,status,tx_ref,provider_invoice_id")
    .eq("tx_ref", verified.api_ref)
    .single();
  if (error || !order) throw new Error("PAYMENT_ORDER_NOT_FOUND");
  if (order.provider_invoice_id !== invoiceId ||
      Math.round(Number(verified.value) * 100) !== Math.round(Number(order.amount) * 100) ||
      verified.currency !== order.currency) {
    throw new Error("PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH");
  }
  if (order.status === "successful") {
    const { data: existing } = await admin.from("certificates").select("id,certificate_number")
      .eq("payment_order_id", order.id).single();
    if (existing) return existing;
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin.from("payment_orders").update({
    status: "successful",
    provider_reference: verified.provider_ref ?? null,
    paid_at: now,
    updated_at: now
  }).eq("id", order.id);
  if (updateError) throw updateError;

  const certificateNumber = `AJY-${new Date().getFullYear()}-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  const { error: certificateError } = await admin
    .from("certificates")
    .upsert({
      user_id: order.user_id,
      payment_order_id: order.id,
      course_slug: order.course_slug,
      certificate_number: certificateNumber
    }, { onConflict: "payment_order_id", ignoreDuplicates: true });
  if (certificateError) throw certificateError;
  const { data: certificate, error: readError } = await admin
    .from("certificates")
    .select("id,certificate_number")
    .eq("payment_order_id", order.id)
    .single();
  if (readError || !certificate) throw new Error("CERTIFICATE_ISSUANCE_FAILED");
  return certificate;
}
