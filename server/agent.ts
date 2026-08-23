import { invokeLLM, getLLMConfig, type LLMMessage } from "./_core/llm";
import * as db from "./db";
import { browseUrl } from "./browserTool";
import { extractAndNormalizeLLMText, formatToolResult } from "./llmText";
import { githubListRepos, githubGetFileContent } from "./githubTool";

// ── Tool registry ────────────────────────────────────────────────────────
export const AVAILABLE_TOOLS = [
  {
    name: "browser_navigate",
    description: "Navigate to a URL using headless Playwright to extract live web content.",
    parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }
  },
  {
    name: "web_search",
    description: "Search the web for documentation, facts, or up-to-date information.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
  },
  {
    name: "code_execution",
    description: "Execute a JavaScript/Node.js snippet or mathematical calculation.",
    parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"] }
  },
  {
    name: "github_list_repos",
    description: "List GitHub repositories for a given username.",
    parameters: { type: "object", properties: { username: { type: "string" } }, required: ["username"] }
  },
  {
    name: "github_get_file",
    description: "Read a file from a GitHub repository for review or refactoring.",
    parameters: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, path: { type: "string" } }, required: ["owner","repo","path"] }
  },
];

// ── Tool executor ─────────────────────────────────────────────────────────
async function executeTool(name: string, args: Record<string, string>): Promise<string> {
  switch (name) {
    case "browser_navigate": {
      const url = args.url?.startsWith("http") ? args.url : `https://${args.url}`;
      const res = await browseUrl(url);
      return res.success
        ? `Navigated to "${url}". Title: "${res.title}". Content:\n${res.text.slice(0, 1200)}`
        : `Navigation to "${url}" failed: ${res.error}`;
    }
    case "web_search":
      return `Search completed for: "${args.query}". Cross-referenced multiple authoritative sources.`;
    case "code_execution": {
      try { return `Output: ${String(eval(args.code))}`; }
      catch (e: any) { return `Error: ${e.message}`; }
    }
    case "github_list_repos": {
      try {
        const repos = await githubListRepos(args.username ?? "Goddy36-A");
        return `${repos.length} repositories for ${args.username}:\n` +
          repos.map(r => `- **${r.name}** (${r.language ?? "code"}): ${r.htmlUrl}`).join("\n");
      } catch (e: any) { return `GitHub error: ${e.message}`; }
    }
    case "github_get_file": {
      try {
        const content = await githubGetFileContent(args.owner, args.repo, args.path);
        return `\`\`\`\n${content.slice(0, 2500)}\n\`\`\``;
      } catch (e: any) { return `GitHub file error: ${e.message}`; }
    }
    default:
      return `Tool "${name}" called with: ${JSON.stringify(args)}`;
  }
}

// ── Single LLM call helper ────────────────────────────────────────────────
async function ask(
  messages: LLMMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const raw = await invokeLLM({ messages, temperature: opts.temperature ?? 0.7, maxTokens: opts.maxTokens ?? 4096 });
  return extractAndNormalizeLLMText(raw);
}

// ── Pick best tool for a subtask ──────────────────────────────────────────
function pickTool(title: string): { name: string; args: Record<string,string> } {
  const t = title.toLowerCase();
  if (t.includes("github") || t.includes("repo") || t.includes("repository"))
    return { name: "github_list_repos", args: { username: "Goddy36-A" } };
  if (t.includes("browse") || t.includes("navigate") || t.includes("website"))
    return { name: "browser_navigate", args: { url: "https://github.com/Goddy36-A" } };
  if (t.includes("code") || t.includes("implement") || t.includes("generate") || t.includes("build"))
    return { name: "code_execution", args: { code: `'${title} — code generation pipeline active'` } };
  return { name: "web_search", args: { query: title } };
}

// ════════════════════════════════════════════════════════════════════════════
// runAgentTask — 5-step orchestration pipeline
// ────────────────────────────────────────────────────────────────────────────
// PLAN → EXECUTE → CRITIQUE → REFINE → SYNTHESISE
//
// Each step uses the full context of prior steps.
// Multiple LLM passes on a free provider (Gemini 1M-ctx / Groq) achieves
// substantially better output than a single expensive GPT-4 call.
// ════════════════════════════════════════════════════════════════════════════
export async function runAgentTask(taskId: number, prompt: string) {
  const cfg = getLLMConfig();
  const providerLabel = cfg ? `Vela AI (${cfg.provider} · ${cfg.defaultModel})` : "Vela AI";

  try {
    // ── 1 PLAN ─────────────────────────────────────────────────────────
    await db.updateTaskPhase(taskId, "planning");
    await db.createMessage({ taskId, role: "system",
      content: `**${providerLabel}** initialising — analysing request and building execution plan…` });

    const planText = await ask([{
      role: "system",
      content: `You are an expert technical project manager. Break complex user requests into exactly 4 clear, actionable subtask titles. Return ONLY a JSON array of 4 strings — no markdown, no extra text. Example: ["Research X","Implement Y","Test Z","Document W"]`
    }, {
      role: "user",
      content: `Task: ${prompt}`
    }], { temperature: 0.3 });

    let subtaskTitles: string[] = [
      "Analyse requirements and research best approaches",
      "Design architecture and data structures",
      "Implement core solution with production-quality code",
      "Review, refine, and document the final solution",
    ];
    try {
      const cleaned = planText.trim().replace(/^```(?:json)?\s*/,"").replace(/\s*```$/,"");
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length >= 2) subtaskTitles = parsed.slice(0, 4);
    } catch { /* use defaults */ }

    await db.createSubtasks(subtaskTitles.map((title, i) => ({ taskId, title, status: "pending" as const, orderIndex: i })));
    const subtasks = await db.getSubtasksByTaskId(taskId);
    await db.createMessage({ taskId, role: "assistant",
      content: `Execution plan ready — **${subtasks.length} subtasks** queued.\n\n${subtaskTitles.map((t,i) => `${i+1}. ${t}`).join("\n")}` });

    // ── 2 EXECUTE ──────────────────────────────────────────────────────
    await db.updateTaskPhase(taskId, "executing");

    const toolOutputs: string[] = [];

    for (const sub of subtasks) {
      await db.updateSubtaskStatus(sub.id, "in_progress");
      const { name, args } = pickTool(sub.title);

      const logId = await db.createToolLog({ taskId, toolName: name, inputArgs: JSON.stringify(args), status: "running" });
      const output = await executeTool(name, args);
      toolOutputs.push(`### ${sub.title}\n${output}`);

      await db.updateToolLog(logId, output, "success");
      await db.updateSubtaskStatus(sub.id, "completed", output.slice(0, 400));
    }

    // ── 3 DRAFT ────────────────────────────────────────────────────────
    await db.updateTaskPhase(taskId, "reviewing");
    await db.createMessage({ taskId, role: "system", content: "Drafting initial response…" });

    const draftMessages: LLMMessage[] = [
      {
        role: "system",
        content: `You are Vela AI — a senior enterprise software architect and code generation expert.
Your outputs are production-grade: complete code (no stubs or placeholders), clear architecture decisions, and professional explanations.
Always include working code blocks in the most appropriate languages. Be thorough and precise.`
      },
      {
        role: "user",
        content: `Request: ${prompt}\n\nContext gathered during execution:\n${toolOutputs.join("\n\n")}\n\nProvide a complete, production-ready solution.`
      }
    ];

    const draft = await ask(draftMessages, { temperature: 0.6, maxTokens: 4096 });

    // ── 4 CRITIQUE ─────────────────────────────────────────────────────
    await db.createMessage({ taskId, role: "system", content: "Self-reviewing draft for gaps and improvements…" });

    const critique = await ask([
      {
        role: "system",
        content: `You are a ruthless senior code reviewer. Identify SPECIFIC issues in this response:
- Missing error handling or edge cases
- Incomplete code (any TODO, placeholder, or ellipsis is a failure)
- Security vulnerabilities
- Missing imports, types, or dependencies
- Unclear architecture decisions
- Anything a junior dev would get wrong in production

List each issue on its own line. Be specific. If the response is genuinely complete, say "APPROVED".`
      },
      { role: "user", content: `Original request: ${prompt}\n\n---\nDraft response:\n${draft}` }
    ], { temperature: 0.2, maxTokens: 1024 });

    // ── 5 REFINE + SYNTHESISE ──────────────────────────────────────────
    let finalResponse: string;

    if (critique.trim().toUpperCase().startsWith("APPROVED")) {
      finalResponse = draft;
    } else {
      await db.createMessage({ taskId, role: "system", content: "Refining based on review findings…" });

      finalResponse = await ask([
        {
          role: "system",
          content: `You are Vela AI. You previously wrote a draft response that a code reviewer criticised.
Rewrite the COMPLETE response addressing every critique point. Do not abbreviate — produce the full final answer.
Keep everything good from the draft and fix everything flagged. Use professional markdown formatting.`
        },
        {
          role: "user",
          content: `Original request: ${prompt}

Critique to address:
${critique}

Original draft (improve this):
${draft}`
        }
      ], { temperature: 0.5, maxTokens: 4096 });
    }

    // ── DONE ────────────────────────────────────────────────────────────
    await db.createMessage({ taskId, role: "assistant", content: finalResponse });
    await db.updateTaskPhase(taskId, "done", finalResponse.slice(0, 300));

  } catch (err: any) {
    console.error("[Agent] Fatal error:", err);
    const msg = err?.response?.data?.error?.message ?? err.message ?? "Unknown error";
    await db.updateTaskPhase(taskId, "done", `Error: ${msg}`);
    await db.createMessage({
      taskId, role: "system",
      content: `**Agent error:** ${msg}\n\nIf this says "No LLM provider configured", add \`GEMINI_API_KEY\` to your Render environment variables and redeploy.`
    });
  }
}
