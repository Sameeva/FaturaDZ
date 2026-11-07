import { describe, expect, it } from "vitest";
import { buildCsp } from "./proxy";

describe("buildCsp", () => {
  it("allows only this origin for connections when accounts are off", () => {
    expect(buildCsp("n", false)).toContain("connect-src 'self' data:;");
  });
  it("adds just the Supabase origin when accounts are on", () => {
    const csp = buildCsp("n", false, "https://abcd.supabase.co/rest/v1");
    expect(csp).toContain("connect-src 'self' data: https://abcd.supabase.co;");
    expect(csp).not.toContain("/rest/v1");
  });
});
