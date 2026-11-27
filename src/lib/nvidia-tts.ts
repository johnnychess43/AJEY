const NVIDIA_TTS_URL = "https://877104f7-e885-42b9-8de8-f6e4c6303969.invocation.api.nvcf.nvidia.com/v1/audio/synthesize";

function splitText(text: string, max = 1800): string[] {
  const words = text.trim().split(/\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? current + " " + word : word;
    if (next.length > max && current) {
      chunks.push(current);
      current = word;
    } else current = next;
  }
  if (current) chunks.push(current);
  return chunks;
}

function readWavParts(wav: Buffer): { fmt: Buffer; data: Buffer } {
  if (wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("NVIDIA_TTS_INVALID_WAV");
  }
  let offset = 12;
  let fmt: Buffer | undefined;
  let data: Buffer | undefined;
  while (offset + 8 <= wav.length) {
    const id = wav.toString("ascii", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > wav.length) throw new Error("NVIDIA_TTS_INVALID_WAV");
    if (id === "fmt ") fmt = wav.subarray(start - 8, start + size);
    if (id === "data") data = wav.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (!fmt || !data) throw new Error("NVIDIA_TTS_INVALID_WAV");
  return { fmt, data };
}

function combineWav(parts: Array<{ fmt: Buffer; data: Buffer }>): Buffer {
  const fmt = parts[0].fmt;
  const audio = Buffer.concat(parts.map((part) => part.data));
  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0, "ascii");
  dataHeader.writeUInt32LE(audio.length, 4);
  const body = Buffer.concat([fmt, dataHeader, audio]);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WAVE", 8, "ascii");
  return Buffer.concat([header, body]);
}

export async function generateNvidiaPodcastAudio(text: string): Promise<Buffer> {
  const apiKey = (process.env.NVIDIA_TTS_API_KEY || process.env.NVIDIA_API_KEY || "").trim();
  if (!apiKey) throw new Error("NVIDIA_TTS_NOT_CONFIGURED");

  const chunks = splitText(text);
  const audioParts: Array<{ fmt: Buffer; data: Buffer }> = [];
  for (const chunk of chunks) {
    const form = new FormData();
    form.set("text", chunk);
    form.set("language", "en-US");
    form.set("voice", process.env.NVIDIA_TTS_VOICE?.trim() || "Magpie-Multilingual.EN-US.Aria");
    form.set("encoding", "LINEAR_PCM");
    form.set("sample_rate_hz", "22050");

    const response = await fetch(NVIDIA_TTS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.error("AJEY NVIDIA TTS request failed", { status: response.status, detail });
      throw new Error(response.status === 401 || response.status === 403 ? "NVIDIA_TTS_AUTH_FAILED" :
        response.status === 429 ? "NVIDIA_TTS_RATE_LIMITED" : "NVIDIA_TTS_REQUEST_FAILED");
    }
    const wav = Buffer.from(await response.arrayBuffer());
    audioParts.push(readWavParts(wav));
  }
  return combineWav(audioParts);
}
