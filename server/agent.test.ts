import { describe, expect, it } from "vitest";
import { extractAndNormalizeLLMText } from "./llmText";

describe("agent system verification", () => {
  it("verifies basic math tool simulation", () => {
    const code = "2 + 2";
    const res = eval(code);
    expect(res).toBe(4);
  });

  it("extracts clean assistant text from an OpenAI-shaped response", () => {
    const response = {
      choices: [{
        message: {
          role: "assistant" as const,
          content: "assistant: ## Result\n\nThe answer is **42**."
        }
      }]
    };

    expect(extractAndNormalizeLLMText(response)).toBe("## Result\n\nThe answer is **42**.");
  });

  it("preserves Markdown code fences for the UI renderer", () => {
    const markdown = "## Example\n\n```ts\nconst answer = 42;\n```";
    expect(extractAndNormalizeLLMText(markdown)).toContain("```ts");
    expect(extractAndNormalizeLLMText(markdown)).toContain("const answer = 42;");
  });
});
