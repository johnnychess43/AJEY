import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPremiumCardSubscription } from "@/lib/payments/intasend-subscriptions";

export const runtime = "nodejs";

function safeName(value: unknown, fallback: string) {
  const cleaned = String(value ?? "").replace(/[^a-zA-Z0-9 _:-]/g, "").trim().slice(0, 60);
  return cleaned || fallback;
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const appOrigin = new URL(request.url).origin;
    if (origin && origin !== appOrigin) {
      return NextResponse.json({ error: "Cross-origin subscription requests are not allowed." }, { status: 403 });
    }
    const auth = await createClient();
    if (!auth) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
    const { data: { user } } = await auth.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Sign in before upgrading to Premium." }, { status: 401 });

    const admin = createAdminClient();
    const { data: existing } = await admin.from("member_subscriptions")
      .select("status,provider_subscription_id")
      .eq("user_id", user.id).maybeSingle();
    if (existing?.status === "active") {
      return NextResponse.json({ error: "Your AJEY Premium membership is already active." }, { status: 409 });
    }

    const reference = `AJEY-${randomUUID()}`;
    const metadata = user.user_metadata ?? {};
    const parts = safeName(metadata.full_name ?? metadata.name, "AJEY Learner").split(/\s+/);
    const redirectUrl = `${appOrigin}/?premium=return`;
    const subscription = await createPremiumCardSubscription({
      userId: user.id,
      email: user.email,
      firstName: safeName(parts[0], "AJEY"),
      lastName: safeName(parts.slice(1).join(" "), "Learner"),
      redirectUrl,
      reference
    });

    const { error } = await admin.from("member_subscriptions").upsert({
      user_id: user.id,
      provider: "intasend",
      provider_customer_id: subscription.customerId,
      provider_subscription_id: subscription.subscriptionId,
      reference,
      status: subscription.status.toLowerCase() === "active" ? "active" : "pending",
      amount: 50,
      currency: "KES",
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (error) throw error;
    return NextResponse.json({ setupUrl: subscription.setupUrl });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    console.error("AJEY Premium checkout failed", { reason });
    const status = reason === "PAYMENTS_ADMIN_NOT_CONFIGURED" || reason === "INTASEND_NOT_CONFIGURED" ? 503 : 502;
    return NextResponse.json({
      error: status === 503 ? "AJEY Premium payments are not configured yet." : "AJEY could not start Premium checkout. Please try again."
    }, { status });
  }
}
