import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCertificatePrice } from "@/lib/payments/flutterwave";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your certificates." }, { status: 401 });

  const [{ data: certificates, error }, { data: progress, error: progressError }] = await Promise.all([
    supabase.from("certificates").select("id,course_slug,certificate_number,issued_at").order("issued_at", { ascending: false }),
    supabase.from("learning_progress").select("course_slug,progress_percent").eq("user_id", user.id)
  ]);
  if (error || progressError) return NextResponse.json({ error: "Could not load your certificate records." }, { status: 500 });

  return NextResponse.json({
    certificates: certificates ?? [],
    progress: progress ?? [],
    prices: {
      KES: getCertificatePrice("KES"),
      USD: getCertificatePrice("USD")
    }
  });
}
