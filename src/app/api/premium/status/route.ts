import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await createClient();
  if (!auth) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your plan." }, { status: 401 });
  const { data, error } = await auth.from("member_subscriptions")
    .select("status,amount,currency,card_mask,card_type,next_billing_date,completed_cycles")
    .eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load membership status." }, { status: 500 });
  return NextResponse.json({ plan: data?.status === "active" ? "premium" : "basic", subscription: data });
}
