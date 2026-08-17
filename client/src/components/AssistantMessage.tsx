import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Streamdown } from "streamdown";

function cleanAssistantContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as any;
    const nested = parsed?.choices?.[0]?.message?.content ?? parsed?.message?.content ?? parsed?.content;
    if (typeof nested === "string") return nested.trim();
  } catch {
    // This is ordinary Markdown/prose.
  }

  return trimmed
    .replace(/^\s*assistant\s*:\s*/i, "")
    .replace(/^\s*final answer\s*:\s*/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractCode(content: string): string {
  return Array.from(content.matchAll(/```(?:[\\w+-]+)?\\s*\\n?([\\s\\S]*?)```/g))
    .map(match => match[1]?.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function AssistantMessage({ content }: { content: string }) {
  const cleaned = useMemo(() => cleanAssistantContent(content), [content]);
  const code = useMemo(() => extractCode(cleaned), [cleaned]);
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="assistant-markdown relative text-sm leading-7 group">
      <Streamdown>{cleaned}</Streamdown>
      {code && (
        <button
          type="button"
          onClick={copyCode}
          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/40 px-2 py-1 text-[11px] leading-4 text-white/80 opacity-0 transition hover:bg-black/60 group-hover:opacity-100 focus:opacity-100"
          aria-label="Copy code blocks"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy code"}
        </button>
      )}
    </div>
  );
}

export default AssistantMessage;
