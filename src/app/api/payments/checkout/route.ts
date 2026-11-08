import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createFlutterwaveCheckout, getCertificatePrice } from "@/lib/payments/flutterwave";

export const runtime = "nodejs";

const allowedCourses = new Set([
  "foundations-of-data-science",
  "programming-with-python",
  "learning-how-to-learn"
]);

export async function POST(request: Request) {
  try {
    const auth = await createClient();
    if (!auth) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
    const { data: { user } } = await auth.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Sign in before purchasing a certificate." }, { status: 401 });

    const body = await request.json();
    const courseSlug = typeof body.courseSlug === "string" ? body.courseSlug : "";
    const currency = body.currency === "USD" ? "USD" : body.currency === "KES" ? "KES" : null;
    if (!allowedCourses.has(courseSlug) || !currency) {
      return NextResponse.json({ error: "Choose a valid course and currency." }, { status: 400 });
    }

    const price = getCertificatePrice(currency);
    if (!price) return NextResponse.json({ error: `Certificate pricing for ${currency} has not been configured yet.` }, { status: 503 });

    const { data: progress, error: progressError } = await auth
      .from("learning_progress")
      .select("progress_percent")
      .eq("user_id", user.id)
      .eq("course_slug", courseSlug)
      .maybeSingle();
    if (progressError) throw progressError;
    if (!progress || progress.progress_percent < 100) {
      return NextResponse.json({ error: "Complete this course before requesting its certificate." }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: alreadyIssued } = await admin.from("certificates").select("id").eq("user_id", user.id).eq("course_slug", courseSlug).maybeSingle();
    if (alreadyIssued) return NextResponse.json({ error: "A certificate has already been issued for this course." }, { status: 409 });
    const txRef = `AJEY-${randomUUID()}`;
    const { data: order, error: insertError } = await admin
      .from("payment_orders")
      .insert({
        user_id: user.id,
        course_slug: courseSlug,
        currency,
        amount: price,
        tx_ref: txRef,
        status: "pending"
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    try {
      const origin = new URL(request.url).origin;
      const link = await createFlutterwaveCheckout({
        amount: price,
        currency,
        txRef,
        email: user.email,
        name: user.user_metadata?.full_name ?? user.user_metadata?.name,
        redirectUrl: `${origin}/api/payments/callback`,
        courseSlug,
        orderId: order.id
      });
      await admin.from("payment_orders").update({ payment_link: link, updated_at: new Date().toISOString() }).eq("id", order.id);
      return NextResponse.json({ checkoutUrl: link });
    } catch (error) {
      await admin.from("payment_orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", order.id);
      throw error;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    console.error("AJEY certificate checkout failed", { reason });
    const status = reason === "PAYMENTS_ADMIN_NOT_CONFIGURED" || reason === "FLUTTERWAVE_NOT_CONFIGURED" ? 503 : 502;
    return NextResponse.json({
      error: reason === "PAYMENTS_ADMIN_NOT_CONFIGURED"
        ? "AJEY payment administration is not configured yet."
        : reason === "FLUTTERWAVE_NOT_CONFIGURED"
          ? "AJEY payments are not connected yet."
          : "AJEY could not start checkout. Please try again."
    }, { status });
  }
}
