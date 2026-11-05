type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ProviderResult = { text: string; provider: "openai" | "nvidia" };

async function requestProvider(
  provider: "openai" | "nvidia",
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number
): Promise<ProviderResult> {
  const isOpenAI = provider === "openai";
  const apiKey = (isOpenAI ? process.env.OPENAI_API_KEY : process.env.NVIDIA_API_KEY)?.trim();
  if (!apiKey) throw new Error(`${provider.toUpperCase()}_KEY_MISSING`);

  const response = await fetch(
    isOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://integrate.api.nvidia.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: isOpenAI ? "gpt-4.1-mini" : "nvidia/nemotron-3.5-bolt-e4b",
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000)
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`AJEY ${provider} request failed`, {
      status: response.status,
      detail: detail.slice(0, 240)
    });
    throw new Error(`${provider.toUpperCase()}_HTTP_${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error(`${provider.toUpperCase()}_EMPTY_RESPONSE`);
  }
  return { text: text.trim(), provider };
}

export async function generateAIText(
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<ProviderResult> {
  const maxTokens = options.maxTokens ?? 1200;
  const temperature = options.temperature ?? 0.5;
  const configured: Array<"openai" | "nvidia"> = [
    ...(process.env.OPENAI_API_KEY?.trim() ? ["openai" as const] : []),
    ...(process.env.NVIDIA_API_KEY?.trim() ? ["nvidia" as const] : [])
  ];

  if (configured.length === 0) {
    throw new Error("AI_KEYS_MISSING");
  }

  const failures: string[] = [];
  for (const provider of configured) {
    try {
      return await requestProvider(provider, messages, maxTokens, temperature);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "UNKNOWN_PROVIDER_ERROR");
      console.warn(`AJEY switching AI provider after ${provider} failure`);
    }
  }

  throw new Error(failures.join(",") || "AI_PROVIDERS_UNAVAILABLE");
}
