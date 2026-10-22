import { describe, expect, it } from "vitest";
import { checkRc } from "./validators";

describe("checkRc", () => {
  it("accepts an empty value and a well-formed RC", () => {
    expect(checkRc("")).toBeNull();
    expect(checkRc("16/00-1234567 B 18")).toBeNull();
  });

  it("returns a French hint for a malformed RC", () => {
    expect(checkRc("123")).toMatch(/^RC :/);
  });
});
