import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const apiKey = process.env.GEMINI_API_KEY?.trim();
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

    const requestBody = JSON.stringify({
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
    });

    // Send the key in Google's API-key header, not in the URL.
    // Retry only transient failures with short exponential backoff.
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: requestBody,
          cache: "no-store"
        }
      );

      const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
      if (!retryable || attempt === 2) break;
      await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
    }

    if (!response?.ok) {
      let upstreamMessage = "";
      let upstreamStatus = "";
      try {
        const failure = await response?.json();
        upstreamMessage = typeof failure?.error?.message === "string"
          ? failure.error.message.slice(0, 200)
          : "";
        upstreamStatus = typeof failure?.error?.status === "string"
          ? failure.error.status.slice(0, 50)
          : "";
      } catch {
        // Keep the diagnostic safe if Google returned a non-JSON response.
      }

      console.error("Gemini assistant request failed", {
        httpStatus: response?.status ?? 0,
        apiStatus: upstreamStatus || "UNKNOWN",
        message: upstreamMessage || "No diagnostic message returned"
      });

      let error = "AJEY could not get a response from Gemini. Please try again shortly.";
      if (response?.status === 401 || response?.status === 403) {
        error = "Gemini authentication or permission failed. Check that the API key is active and has Gemini API access.";
      } else if (response?.status === 429) {
        error = "Gemini usage limits have been reached. Check your Google AI Studio quota and try again later.";
      } else if (response?.status === 503 || (response?.status ?? 0) >= 500) {
        error = "Google Gemini is temporarily busy. AJEY retried automatically; please try again in a minute.";
      }

      return NextResponse.json(
        {
          error,
          diagnostic: {
            httpStatus: response?.status ?? 0,
            apiStatus: upstreamStatus || "UNKNOWN",
            message: upstreamMessage || undefined
          }
        },
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
  } catch (error) {
    console.error("AJEY assistant route failed", error);
    return NextResponse.json({ error: "AJEY could not process that message. Please try again." }, { status: 500 });
  }
}
