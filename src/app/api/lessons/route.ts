import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 180) : "";
    if (!topic) {
      return NextResponse.json({ error: "Enter a subject or lesson to search." }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) {
      return NextResponse.json(
        { error: "AJEY lesson notes are not configured yet. Add GEMINI_API_KEY to the Vercel environment variables." },
        { status: 503 }
      );
    }

    const prompt = `Create accurate, beginner-friendly study notes for the lesson: "${topic}".
Use this structure with clear headings:
1. Learning objectives
2. Simple explanation of the main ideas
3. Important terms and definitions
4. Step-by-step examples or worked examples where relevant
5. Key formulas or rules (only if relevant)
6. Common mistakes and how to avoid them
7. Short summary
8. Five practice questions, with answers in a separate answer key at the end.
Keep the notes educational, specific to the requested topic, and suitable for a student. If the topic is broad, introduce it and cover its most important foundations. Do not invent citations or claim to have used a textbook.`;

    // Send the key in the documented API-key header rather than the URL.
    const notesResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 2200 }
        }),
        cache: "no-store"
      }
    );

    if (!notesResponse.ok) {
      let upstreamMessage = "";
      let upstreamStatus = "";
      try {
        const failure = await notesResponse.json();
        upstreamMessage = typeof failure.error?.message === "string"
          ? failure.error.message.slice(0, 240)
          : "";
        upstreamStatus = typeof failure.error?.status === "string"
          ? failure.error.status.slice(0, 60)
          : "";
      } catch {
        // Keep a safe generic diagnostic if Google did not return JSON.
      }

      console.error("Gemini lesson request failed", {
        httpStatus: notesResponse.status,
        apiStatus: upstreamStatus || "UNKNOWN",
        message: upstreamMessage || "No diagnostic message returned"
      });

      let hint = "Gemini rejected the request. Check the API key and its Gemini API restrictions.";
      if (notesResponse.status === 401 || notesResponse.status === 403) {
        hint = "Gemini authentication or permission failed. In Google AI Studio, verify this key is active and allowed to use the Gemini API.";
      } else if (notesResponse.status === 404) {
        hint = "The selected Gemini model or API method is unavailable for this key.";
      } else if (notesResponse.status === 429) {
        hint = "Gemini quota or rate limit reached. Check usage and limits in Google AI Studio.";
      } else if (notesResponse.status >= 500) {
        hint = "Google Gemini is temporarily unavailable. Please try again shortly.";
      }

      return NextResponse.json(
        {
          error: hint,
          diagnostic: {
            httpStatus: notesResponse.status,
            apiStatus: upstreamStatus || "UNKNOWN",
            message: upstreamMessage || undefined
          }
        },
        { status: 502 }
      );
    }

    const generated = await notesResponse.json();
    const notes = generated.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!notes) {
      return NextResponse.json(
        { error: "The lesson generator returned empty notes. Please try another search." },
        { status: 502 }
      );
    }

    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " lesson tutorial")}`;
    let videos: { title: string; channel: string; videoId: string; url: string }[] = [];
    const youtubeKey = process.env.YOUTUBE_API_KEY?.trim();

    if (youtubeKey) {
      const youtubeUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      youtubeUrl.searchParams.set("part", "snippet");
      youtubeUrl.searchParams.set("type", "video");
      youtubeUrl.searchParams.set("maxResults", "5");
      youtubeUrl.searchParams.set("safeSearch", "strict");
      youtubeUrl.searchParams.set("q", topic + " lesson tutorial");
      youtubeUrl.searchParams.set("key", youtubeKey);

      try {
        const videoResponse = await fetch(youtubeUrl, { cache: "no-store" });
        if (videoResponse.ok) {
          const videoData = await videoResponse.json();
          videos = (videoData.items ?? []).flatMap((item: {
            id?: { videoId?: string };
            snippet?: { title?: string; channelTitle?: string };
          }) => {
            const videoId = item.id?.videoId;
            if (!videoId) return [];
            return [{
              title: item.snippet?.title ?? "Related lesson",
              channel: item.snippet?.channelTitle ?? "YouTube",
              videoId,
              url: `https://www.youtube.com/watch?v=${videoId}`
            }];
          });
        }
      } catch (error) {
        console.error("YouTube lesson search failed", error);
      }
    }

    return NextResponse.json({ topic, notes, videos, youtubeSearchUrl });
  } catch (error) {
    console.error("AJEY lesson route failed", error);
    return NextResponse.json(
      { error: "AJEY could not process this lesson search. Please try again." },
      { status: 500 }
    );
  }
}
