import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateNvidiaPodcastAudio } from "@/lib/nvidia-tts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await createClient();
  if (!auth) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to generate your podcast audio." }, { status: 401 });

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: document, error } = await admin
    .from("member_documents")
    .select("id,podcast_script,audio_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (document.audio_path) return NextResponse.json({ ready: true, audioReady: true });
  if (!document.podcast_script?.trim()) {
    return NextResponse.json({ error: "This note has no podcast script yet. Process the document first." }, { status: 409 });
  }

  let audio: Buffer;
  try {
    audio = await generateNvidiaPodcastAudio(document.podcast_script);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "NVIDIA_TTS_REQUEST_FAILED";
    const message =
      reason === "NVIDIA_TTS_NOT_CONFIGURED" ? "NVIDIA TTS is not configured. Add NVIDIA_TTS_API_KEY to the AJEY Vercel environment variables." :
      reason === "NVIDIA_TTS_AUTH_FAILED" ? "NVIDIA rejected the TTS key. Check that the key has access to the Magpie TTS model." :
      reason === "NVIDIA_TTS_RATE_LIMITED" ? "NVIDIA TTS rate limit reached. Please wait a moment and try again." :
      "AJEY could not generate audio with NVIDIA right now. Your podcast script is safe; please try again.";
    console.error("AJEY NVIDIA podcast generation failed", { reason });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const audioPath = `${user.id}/audio/${id}.wav`;
  const { error: uploadError } = await admin.storage
    .from("ajey-member-notes")
    .upload(audioPath, audio, { contentType: "audio/wav", upsert: true });
  if (uploadError) {
    console.error("AJEY podcast audio storage failed", { message: uploadError.message });
    return NextResponse.json({ error: "Audio was generated but could not be saved. Check the private notes storage bucket configuration." }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("member_documents")
    .update({ audio_path: audioPath, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateError) {
    console.error("AJEY podcast audio record update failed", { message: updateError.message });
    return NextResponse.json({ error: "Audio was created but its record could not be updated. Please retry." }, { status: 500 });
  }

  return NextResponse.json({ ready: true, audioReady: true });
}
