import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  const auth = await createClient();
  if (!auth) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage your membership." }, { status: 401 });
  const admin = createAdminClient();
  const { data: subscription } = await admin.from("member_subscriptions").select("provider_subscription_id,status").eq("user_id", user.id).single();
  if (!subscription?.provider_subscription_id || subscription.status !== "active") return NextResponse.json({ error: "No active Premium subscription was found." }, { status: 409 });
  const secret = process.env.INTASEND_SECRET_KEY?.trim();
  if (!secret) return NextResponse.json({ error: "Premium billing is not configured." }, { status: 503 });
  const response = await fetch(`https://api.intasend.com/api/v1/subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}/unsubscribe/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) return NextResponse.json({ error: "IntaSend could not cancel the subscription. Please try again." }, { status: 502 });
  return NextResponse.json({ requested: true, message: "Cancellation requested. Your membership status will update after IntaSend confirms it." });
}
