import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "AJEY authentication is not configured yet." }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in to use your AJEY assistant." }, { status: 401 });

    const body = await req.json();
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 20) {
      return NextResponse.json({ error: "Send between 1 and 20 messages." }, { status: 400 });
    }
    const messages = body.messages.slice(-12);
    if (messages.some((m: unknown) => !m || typeof m !== "object" ||
      !["user","assistant"].includes((m as {role?:string}).role ?? "") ||
      typeof (m as {content?:unknown}).content !== "string" ||
      ((m as {content:string}).content.length > 4000))) {
      return NextResponse.json({ error: "One or more messages are invalid." }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ reply: "Your AJEY account is ready. The AI provider is not connected yet; add the server-only OPENAI_API_KEY in Vercel to activate live AI tutoring." });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", temperature: 0.6, max_tokens: 700,
      messages: [
        { role: "system", content: "You are AJEY, a supportive learning and productivity assistant. Explain concepts clearly, help users plan realistically, and build healthy habits. Never claim to have changed a task, calendar, or reminder unless an authorized integration actually did so." },
        ...messages
      ]
    });
    return NextResponse.json({ reply: completion.choices[0]?.message?.content ?? "Please try again." });
  } catch {
    return NextResponse.json({ error: "AJEY could not process that message." }, { status: 500 });
  }
}
