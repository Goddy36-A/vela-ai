import { describe, expect, it } from "vitest";

describe("agent system verification", () => {
  it("verifies basic math tool simulation", () => {
    const code = "2 + 2";
    const res = eval(code);
    expect(res).toBe(4);
  });
});
