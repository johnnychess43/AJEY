import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAIText } from "@/lib/ai";
import pdfParse from "pdf-parse";
import * as mammoth from "mammoth";

export const runtime = "nodejs";
export const maxDuration = 60;

function stripRtf(value: string) {
  return value.replace(/\\'[0-9a-f]{2}/gi, " ").replace(/\\[a-z]+-?\d* ?/gi, " ").replace(/[{}]/g, " ").replace(/\s+/g, " ").trim();
}

function extractJson(value: string) {
  const clean = value.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI_JSON_INVALID");
  return JSON.parse(clean.slice(start, end + 1));
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await createClient();
  if (!auth) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to process your notes." }, { status: 401 });
  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: document, error } = await admin.from("member_documents").select("*").eq("id", id).eq("user_id", user.id).single();
  if (error || !document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (document.processing_status === "ready") return NextResponse.json({ ready: true });

  await admin.from("member_documents").update({ processing_status: "processing", processing_error: null }).eq("id", id);
  try {
    const { data: blob, error: downloadError } = await admin.storage.from("ajey-member-notes").download(document.storage_path);
    if (downloadError || !blob) throw new Error("DOCUMENT_DOWNLOAD_FAILED");
    const bytes = Buffer.from(await blob.arrayBuffer());
    let extracted = "";
    if (document.mime_type === "application/pdf") {
      const parsed = await pdfParse(bytes);
      extracted = parsed.text;
    } else if (document.mime_type.includes("wordprocessingml")) {
      const parsed = await mammoth.extractRawText({ buffer: bytes });
      extracted = parsed.value;
    } else {
      const raw = bytes.toString("utf8");
      extracted = document.mime_type === "text/rtf" ? stripRtf(raw) : raw;
    }
    extracted = extracted.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").trim();
    if (extracted.length < 40) throw new Error("NO_READABLE_TEXT");
    if (extracted.length > 90000) extracted = extracted.slice(0, 90000);

    const generated = await generateAIText([
      { role: "system", content: "You are AJEY, an expert study coach. Analyze only the supplied document. Return valid JSON only, with keys summary (clear, structured study summary), questions (array of 8 objects each with question, answer, and type; mix recall and understanding), and podcast_script (a friendly two-host educational podcast script, 2 to 4 minutes, no markdown, maximum 3500 characters). Do not invent facts not present in the notes." },
      { role: "user", content: `Document title: ${document.title}\n\nDOCUMENT TEXT:\n${extracted}` }
    ], { maxTokens: 5000, temperature: 0.35 });
    const result = extractJson(generated.text);
    if (typeof result.summary !== "string" || !Array.isArray(result.questions) || typeof result.podcast_script !== "string") {
      throw new Error("AI_OUTPUT_INVALID");
    }

    let audioPath: string | null = null;
    const openAiKey = process.env.OPENAI_API_KEY?.trim();
    if (openAiKey && result.podcast_script.length <= 4000) {
      const speech = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
          voice: "alloy",
          input: result.podcast_script,
          instructions: "Speak warmly and clearly like a friendly educational podcast with natural pacing.",
          response_format: "mp3"
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(30000)
      });
      if (speech.ok) {
        const audio = Buffer.from(await speech.arrayBuffer());
        audioPath = `${user.id}/audio/${id}.mp3`;
        const { error: audioError } = await admin.storage.from("ajey-member-notes").upload(audioPath, audio, { contentType: "audio/mpeg", upsert: true });
        if (audioError) audioPath = null;
      } else {
        console.error("AJEY podcast audio generation failed", { status: speech.status });
      }
    }

    const { error: updateError } = await admin.from("member_documents").update({
      extracted_text: extracted,
      summary: result.summary,
      questions: result.questions.slice(0, 12),
      podcast_script: result.podcast_script,
      audio_path: audioPath,
      processing_status: "ready",
      updated_at: new Date().toISOString()
    }).eq("id", id).eq("user_id", user.id);
    if (updateError) throw updateError;
    return NextResponse.json({ ready: true, audioReady: Boolean(audioPath) });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    await admin.from("member_documents").update({
      processing_status: "failed",
      processing_error: reason === "NO_READABLE_TEXT" ? "No readable text was found in this document." : "AJEY could not process this document. Please try again.",
      updated_at: new Date().toISOString()
    }).eq("id", id).eq("user_id", user.id);
    console.error("AJEY document processing failed", { reason });
    return NextResponse.json({ error: reason === "NO_READABLE_TEXT" ? "No readable text was found. Try a text-based PDF, DOCX or TXT file." : "AJEY could not process this document. Please try again." }, { status: 502 });
  }
}
