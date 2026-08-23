import axios from "axios";
import { ENV } from "./env";

// ── LLM provider priority chain ────────────────────────────────────────
// First match wins. All providers expose OpenAI-compatible /v1/chat/completions.
// Set ONE of these env vars on Render to activate the corresponding provider.
//
//  GEMINI_API_KEY      → Google Gemini 2.0 Flash (FREE, 1M ctx, fast)
//  GROQ_API_KEY        → Groq + Llama-3.3-70B   (FREE, very fast)
//  OPENROUTER_API_KEY  → OpenRouter DeepSeek-R1  (FREE models available)
//  OPENAI_API_KEY      → OpenAI GPT-4o-mini      (paid)
//  BUILT_IN_FORGE_API_KEY → Manus Forge          (original, Manus-only)

export type LLMConfig = {
  url:          string;
  key:          string;
  defaultModel: string;
  provider:     string;
};

export function getLLMConfig(): LLMConfig | null {
  if (ENV.forgeApiKey && ENV.forgeApiUrl) {
    return { url: `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`, key: ENV.forgeApiKey, defaultModel: "claude-3-sonnet", provider: "forge" };
  }
  if (ENV.geminiApiKey) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: ENV.geminiApiKey,
      // gemini-3.1-pro-preview-customtools is optimised for agentic pipelines
      // that use custom tools (exactly what Vela AI does).
      // Override via GEMINI_MODEL env var, e.g. gemini-3.5-flash for free tier.
      defaultModel: ENV.geminiModel,
      provider: "gemini",
    };
  }
  if (ENV.groqApiKey) {
    return { url: "https://api.groq.com/openai/v1/chat/completions", key: ENV.groqApiKey, defaultModel: "llama-3.3-70b-versatile", provider: "groq" };
  }
  if (ENV.openRouterApiKey) {
    return { url: "https://openrouter.ai/api/v1/chat/completions", key: ENV.openRouterApiKey, defaultModel: "deepseek/deepseek-r1:free", provider: "openrouter" };
  }
  if (ENV.openAIApiKey) {
    return { url: "https://api.openai.com/v1/chat/completions", key: ENV.openAIApiKey, defaultModel: "gpt-4o-mini", provider: "openai" };
  }
  return null;
}

// ── invokeLLM ──────────────────────────────────────────────────────────
export type LLMMessage = { role: "system" | "user" | "assistant"; content: string };

export async function invokeLLM({
  messages,
  model,
  temperature = 0.7,
  maxTokens = 4096,
}: {
  messages:     LLMMessage[];
  model?:       string;
  temperature?: number;
  maxTokens?:   number;
}): Promise<unknown> {
  const config = getLLMConfig();
  if (!config) {
    throw new Error(
      "No LLM provider configured. Add one of these to your Render environment variables:\n" +
      "  GEMINI_API_KEY      — Google AI Studio (free): https://aistudio.google.com/app/apikey\n" +
      "  GROQ_API_KEY        — Groq console (free):     https://console.groq.com/\n" +
      "  OPENAI_API_KEY      — OpenAI platform (paid):  https://platform.openai.com/"
    );
  }

  const resolvedModel = model ?? config.defaultModel;

  const { data } = await axios.post(
    config.url,
    { model: resolvedModel, messages, temperature, max_tokens: maxTokens },
    { headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" }, timeout: 120_000 }
  );

  console.log(`[LLM:${config.provider}] ${resolvedModel} — ${messages.length} msgs`);
  return data;
}

// ── listLLMModels ──────────────────────────────────────────────────────
export async function listLLMModels() {
  const config = getLLMConfig();
  if (!config) return [];
  try {
    const baseUrl = config.url.replace("/chat/completions", "").replace("/completions", "");
    const { data } = await axios.get(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.key}` }, timeout: 10_000,
    });
    return data?.data ?? [];
  } catch {
    return [];
  }
}
