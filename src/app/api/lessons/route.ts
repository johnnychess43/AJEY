import { NextResponse } from "next/server";
import { generateAIText } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 180) : "";
    if (!topic) {
      return NextResponse.json({ error: "Enter a subject or lesson to search." }, { status: 400 });
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

    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " lesson tutorial")}`;
    const videoPromise = (async () => {
      const youtubeKey = process.env.YOUTUBE_API_KEY?.trim();
      if (!youtubeKey) return [] as { title: string; channel: string; videoId: string; url: string }[];

      const youtubeUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      youtubeUrl.searchParams.set("part", "snippet");
      youtubeUrl.searchParams.set("type", "video");
      youtubeUrl.searchParams.set("maxResults", "6");
      youtubeUrl.searchParams.set("videoEmbeddable", "true");
      youtubeUrl.searchParams.set("relevanceLanguage", "en");
      youtubeUrl.searchParams.set("order", "relevance");
      youtubeUrl.searchParams.set("safeSearch", "strict");
      youtubeUrl.searchParams.set("q", topic + " lesson tutorial");
      youtubeUrl.searchParams.set("key", youtubeKey);

      try {
        const response = await fetch(youtubeUrl, {
          cache: "no-store",
          signal: AbortSignal.timeout(12_000)
        });
        if (!response.ok) {
          console.warn("YouTube lesson search unavailable", { status: response.status });
          return [];
        }
        const data = await response.json();
        return (data.items ?? []).flatMap((item: {
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
      } catch (error) {
        console.warn("YouTube lesson search failed", error instanceof Error ? error.name : "Unknown error");
        return [];
      }
    })();

    const [generated, videos] = await Promise.all([
      generateAIText([{ role: "user", content: prompt }], { temperature: 0.35, maxTokens: 2600 }),
      videoPromise
    ]);

    return NextResponse.json({
      topic,
      notes: generated.text,
      provider: generated.provider,
      videos,
      youtubeSearchUrl
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    console.error("AJEY lesson generation failed", { reason });
    const missingKeys = reason === "AI_KEYS_MISSING";
    return NextResponse.json(
      {
        error: missingKeys
          ? "AJEY lesson generation is not configured. Add OPENAI_API_KEY and/or NVIDIA_API_KEY in Vercel."
          : "AJEY could not generate these notes right now. Please try again shortly."
      },
      { status: missingKeys ? 503 : 502 }
    );
  }
}
