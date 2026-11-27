import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await createClient();
  if (!auth) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to listen to your podcast." }, { status: 401 });
  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: document } = await admin.from("member_documents").select("audio_path").eq("id", id).eq("user_id", user.id).single();
  if (!document?.audio_path) return NextResponse.json({ error: "Audio is not available for this note yet." }, { status: 404 });
  const { data, error } = await admin.storage.from("ajey-member-notes").createSignedUrl(document.audio_path, 3600);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Could not open this podcast." }, { status: 502 });
  return NextResponse.json({ url: data.signedUrl });
}
