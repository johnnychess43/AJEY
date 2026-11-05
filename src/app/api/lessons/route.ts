import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 180) : "";
    if (!topic) return NextResponse.json({ error: "Enter a subject or lesson to search." }, { status: 400 });

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: "AJEY lesson notes are not configured yet. Add GEMINI_API_KEY to the Vercel environment variables." }, { status: 503 });
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

    const notesResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 2200 }
        }),
        cache: "no-store"
      }
    );

    if (!notesResponse.ok) {
      return NextResponse.json({ error: "AJEY could not generate notes. Check the Gemini API key and try again." }, { status: 502 });
    }

    const generated = await notesResponse.json();
    const notes = generated.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!notes) return NextResponse.json({ error: "The lesson generator returned empty notes. Please try another search." }, { status: 502 });

    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " lesson tutorial")}`;
    let videos: { title: string; channel: string; videoId: string; url: string }[] = [];
    const youtubeKey = process.env.YOUTUBE_API_KEY;

    if (youtubeKey) {
      const youtubeUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      youtubeUrl.searchParams.set("part", "snippet");
      youtubeUrl.searchParams.set("type", "video");
      youtubeUrl.searchParams.set("maxResults", "5");
      youtubeUrl.searchParams.set("safeSearch", "strict");
      youtubeUrl.searchParams.set("q", topic + " lesson tutorial");
      youtubeUrl.searchParams.set("key", youtubeKey);

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
    }

    return NextResponse.json({ topic, notes, videos, youtubeSearchUrl });
  } catch {
    return NextResponse.json({ error: "AJEY could not process this lesson search. Please try again." }, { status: 500 });
  }
}
