import OpenAI from "openai";
import { NextResponse } from "next/server";
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "Add a message first." }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ reply: "AJEY's AI connection is not configured yet. Add OPENAI_API_KEY to the server environment to activate your AI tutor." });
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", temperature: 0.6, max_tokens: 700,
      messages: [
        { role: "system", content: "You are AJEY, a supportive learning and productivity assistant. Explain concepts clearly, help users plan realistically, and build healthy habits. Never claim to have changed a task, calendar, or reminder unless an authorized integration actually did so." },
        ...body.messages.slice(-12)
      ]
    });
    return NextResponse.json({ reply: completion.choices[0]?.message?.content ?? "Please try again." });
  } catch {
    return NextResponse.json({ error: "AJEY could not process that message." }, { status: 500 });
  }
}
