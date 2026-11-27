import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Audio generation is not configured. Add OPENAI_API_KEY to the AJEY Vercel environment variables." }, { status: 503 });

  const preferredModel = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
  const models = [...new Set([preferredModel, "tts-1"])];
  let audio: Buffer | null = null;
  let lastStatus = 0;

  for (const model of models) {
    const body: Record<string, string> = {
      model,
      voice: "alloy",
      input: document.podcast_script,
      response_format: "mp3"
    };
    if (model === "gpt-4o-mini-tts") {
      body.instructions = "Speak warmly and clearly like a friendly educational podcast with natural pacing.";
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(45000)
    });
    if (response.ok) {
      audio = Buffer.from(await response.arrayBuffer());
      break;
    }
    lastStatus = response.status;
    console.error("AJEY podcast audio attempt failed", { model, status: response.status });
  }

  if (!audio?.length) {
    return NextResponse.json({
      error: lastStatus === 401 ? "The OpenAI API key was rejected. Check the server-side OPENAI_API_KEY in Vercel." :
        lastStatus === 429 ? "The OpenAI audio service is busy or has insufficient quota. Check API billing and try again." :
        "AJEY could not generate audio right now. Your podcast script is safe; please try again later."
    }, { status: 502 });
  }

  const audioPath = `${user.id}/audio/${id}.mp3`;
  const { error: uploadError } = await admin.storage
    .from("ajey-member-notes")
    .upload(audioPath, audio, { contentType: "audio/mpeg", upsert: true });
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
