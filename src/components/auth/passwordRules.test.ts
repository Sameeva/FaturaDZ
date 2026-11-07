import { describe, expect, it } from "vitest";
import { checkPassword, isValidEmail } from "./passwordRules";

describe("checkPassword", () => {
  it("scores empty as 0 and invalid", () => {
    expect(checkPassword("")).toMatchObject({ score: 0, valid: false });
  });
  it("requires length, a letter and a digit", () => {
    expect(checkPassword("abcdefgh").valid).toBe(false);
    expect(checkPassword("12345678").valid).toBe(false);
    expect(checkPassword("abc12").valid).toBe(false);
    expect(checkPassword("abcdefg1").valid).toBe(true);
  });
  it("rewards long passwords with a symbol", () => {
    expect(checkPassword("abcdefg1").score).toBe(3);
    expect(checkPassword("abcdefghij1!").score).toBe(4);
  });
  it("keeps weak passwords at 1 or 2", () => {
    expect(checkPassword("a").score).toBe(1);
    expect(checkPassword("abcdefgh").score).toBe(2);
  });
});

describe("isValidEmail", () => {
  it("accepts and rejects", () => {
    expect(isValidEmail(" a@b.dz ")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.dz")).toBe(false);
  });
});
