import { describe, expect, it } from "vitest";
import { safeNext } from "./safeNext";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/reset-password")).toBe("/reset-password");
    expect(safeNext("/documents/abc?x=1")).toBe("/documents/abc?x=1");
  });
  it("rejects anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", "", null, undefined]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});
