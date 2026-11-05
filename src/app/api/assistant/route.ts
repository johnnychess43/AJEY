import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: "AJEY authentication is not configured yet." }, { status: 503 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to use your AJEY assistant." }, { status: 401 });
    }

    const body = await req.json();
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 20) {
      return NextResponse.json({ error: "Send between 1 and 20 messages." }, { status: 400 });
    }

    const messages = body.messages.slice(-12);
    if (messages.some((m: unknown) =>
      !m ||
      typeof m !== "object" ||
      !["user", "assistant"].includes((m as { role?: string }).role ?? "") ||
      typeof (m as { content?: unknown }).content !== "string" ||
      (m as { content: string }).content.length > 4000
    )) {
      return NextResponse.json({ error: "One or more messages are invalid." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AJEY's Gemini connection is not configured yet. Add GEMINI_API_KEY to the Vercel project environment variables." },
        { status: 503 }
      );
    }

    const contents = messages.map((message: { role: "user" | "assistant"; content: string }) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "You are AJEY, a supportive learning and productivity assistant. Explain concepts clearly, adapt to the learner's level, help users plan realistically, and encourage healthy habits. Give practical, structured answers. You can suggest tasks and reminders, but never claim to have saved, changed, scheduled, or sent anything unless an authorized integration actually confirms that action. Be honest when you do not know something."
            }]
          },
          contents,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 900
          }
        }),
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Gemini could not answer right now. Check the Gemini API key and its API access, then try again." },
        { status: 502 }
      );
    }

    const result = await response.json();
    const reply = result.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!reply) {
      return NextResponse.json({ error: "Gemini returned an empty response. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "AJEY could not process that message. Please try again." }, { status: 500 });
  }
}
