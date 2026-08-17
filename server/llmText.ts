import type { InvokeResult, MessageContent, TextContent } from "./_core/llm";

type ContentPart = Exclude<MessageContent, string>;

function contentToText(content: string | ContentPart[] | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((part): part is TextContent => part.type === "text")
    .map(part => part.text)
    .join("\n");
}

function unwrapSerializedResult(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  // Preserve markdown responses, including fenced code blocks.
  if (
    trimmed.startsWith("#") ||
    trimmed.includes("\n```") ||
    trimmed.startsWith("```") ||
    trimmed.startsWith("-") ||
    trimmed.startsWith(">")
  ) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as any;
    if (typeof parsed === "string") return parsed;
    if (parsed?.choices?.[0]?.message?.content) {
      return contentToText(parsed.choices[0].message.content);
    }
    if (parsed?.message?.content) {
      return contentToText(parsed.message.content);
    }
    if (parsed?.content && typeof parsed.content === "string") return parsed.content;
  } catch {
    // Ordinary prose is not serialized JSON.
  }

  return trimmed;
}

export function extractLLMText(result: InvokeResult | string | unknown): string {
  if (typeof result === "string") return unwrapSerializedResult(result);

  const typed = result as Partial<InvokeResult> | undefined;
  const content = typed?.choices?.[0]?.message?.content;
  if (content) return unwrapSerializedResult(contentToText(content));

  return unwrapSerializedResult(JSON.stringify(result ?? ""));
}

export function normalizeAssistantMarkdown(value: string): string {
  return value
    .replace(/^\s*assistant\s*:\s*/i, "")
    .replace(/^\s*final answer\s*:\s*/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractAndNormalizeLLMText(result: InvokeResult | string | unknown): string {
  return normalizeAssistantMarkdown(extractLLMText(result));
}

export function formatToolResult(toolName: string, result: string): string {
  const label = toolName
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
  return `### ${label}\n\n${result}`;
}

export function isTextContent(value: MessageContent): value is TextContent {
  return typeof value !== "string" && value.type === "text";
}
