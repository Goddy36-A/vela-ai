export const ENV = {
  appId:          process.env.VITE_APP_ID          ?? "",
  cookieSecret:   process.env.JWT_SECRET            ?? "",
  databaseUrl:    process.env.DATABASE_URL          ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL      ?? "",
  ownerOpenId:    process.env.OWNER_OPEN_ID         ?? "",
  isProduction:   process.env.NODE_ENV === "production",

  // ── LLM providers (priority: Forge → Gemini → Groq → OpenRouter → OpenAI) ──
  forgeApiUrl:      process.env.BUILT_IN_FORGE_API_URL   ?? "",
  forgeApiKey:      process.env.BUILT_IN_FORGE_API_KEY   ?? "",
  geminiApiKey:     process.env.GEMINI_API_KEY            ?? "",   // aistudio.google.com — FREE
  geminiModel:      process.env.GEMINI_MODEL              ?? "gemini-3.1-pro-preview-customtools", // override if needed
  groqApiKey:       process.env.GROQ_API_KEY              ?? "",   // console.groq.com    — FREE
  openRouterApiKey: process.env.OPENROUTER_API_KEY        ?? "",   // openrouter.ai       — FREE models
  openAIApiKey:     process.env.OPENAI_API_KEY            ?? "",   // platform.openai.com — paid
};
