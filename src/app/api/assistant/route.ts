import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAIText } from "@/lib/ai";

export const runtime = "nodejs";

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

    const conversation = messages.map((message: { role: "user" | "assistant"; content: string }) => ({
      role: message.role,
      content: message.content
    }));

    const result = await generateAIText([
      {
        role: "system",
        content: "You are AJEY, a supportive learning and productivity assistant. Explain concepts clearly, adapt to the learner's level, help users plan realistically, and encourage healthy habits. Give practical, structured answers. You can suggest tasks and reminders, but never claim to have saved, changed, scheduled, or sent anything unless an authorized integration actually confirms that action. Be honest when you do not know something."
      },
      ...conversation
    ], { temperature: 0.6, maxTokens: 1000 });

    return NextResponse.json({ reply: result.text, provider: result.provider });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    console.error("AJEY assistant providers failed", { reason });
    const missingKeys = reason === "AI_KEYS_MISSING";
    return NextResponse.json(
      {
        error: missingKeys
          ? "AJEY AI is not configured. Add OPENAI_API_KEY and/or NVIDIA_API_KEY in Vercel."
          : "AJEY could not reach its AI providers just now. Please try again shortly."
      },
      { status: missingKeys ? 503 : 502 }
    );
  }
}
