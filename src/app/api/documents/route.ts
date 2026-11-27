import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await createClient();
  if (!auth) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your notes." }, { status: 401 });
  const [{ data: documents, error }, { data: subscription }] = await Promise.all([
    auth.from("member_documents").select("id,title,original_filename,file_size,summary,questions,audio_path,processing_status,processing_error,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    auth.from("member_subscriptions").select("status,next_billing_date").eq("user_id", user.id).maybeSingle()
  ]);
  if (error) return NextResponse.json({ error: "Could not load your uploaded notes." }, { status: 500 });
  return NextResponse.json({
    documents: documents ?? [],
    plan: subscription?.status === "active" ? "premium" : "basic",
    limit: subscription?.status === "active" ? null : 11,
    used: documents?.length ?? 0
  });
}
