import { describe, expect, it } from "vitest";
import {
  articleImpositionSchema,
  checkClientForFinalization,
  nifSchema,
  nisSchema,
  parseRc,
  rcSchema,
  validateClientTaxProfile,
  wilayaCodeSchema,
} from "./client";

const ok = (s: { safeParse: (v: string) => { success: boolean } }, v: string) => s.safeParse(v).success;

describe("NIF", () => {
  it("accepts 15 digits, with or without separators", () => {
    expect(ok(nifSchema, "000116001234567")).toBe(true);
    expect(nifSchema.parse("0001 1600 1234 567")).toBe("000116001234567");
  });
  it("rejects wrong length and non-digits", () => {
    for (const v of ["", "12345", "00011600123456", "00011600123456A", "0001160012345678"]) {
      expect(ok(nifSchema, v), v).toBe(false);
    }
  });
});

describe("NIS", () => {
  it("accepts 15 and 18 digits", () => {
    expect(ok(nisSchema, "123456789012345")).toBe(true);
    expect(ok(nisSchema, "123456789012345678")).toBe(true);
  });
  it("rejects other lengths and letters", () => {
    for (const v of ["12345678901234", "1234567890123456", "12345678901234X"]) {
      expect(ok(nisSchema, v), v).toBe(false);
    }
  });
});

describe("RC", () => {
  it("accepts and normalizes valid RCs", () => {
    expect(rcSchema.parse("16/00-1234567 B 18")).toBe("16/00-1234567 B 18");
    expect(rcSchema.parse("16/00-1234567b18")).toBe("16/00-1234567 B 18");
    expect(parseRc("31/00-0000001 A 05")).toEqual({
      wilaya: "31", prefix: "00", sequence: "0000001", category: "A", year: "05",
    });
  });
  it("rejects bad wilaya, category, sequence length and layout", () => {
    for (const v of ["00/00-1234567 B 18", "70/00-1234567 B 18", "16/00-1234567 C 18", "16/00-123456 B 18", "16-00-1234567 B 18", "1234567", ""]) {
      expect(ok(rcSchema, v), v).toBe(false);
    }
  });
});

describe("Article d'imposition", () => {
  it("accepts alphanumerics and normalizes", () => {
    expect(articleImpositionSchema.parse("16 123 456 78")).toBe("1612345678");
    expect(articleImpositionSchema.parse("ab-12345")).toBe("AB12345");
  });
  it("rejects too short, too long and symbols", () => {
    for (const v of ["1234", "123456789012345678901", "12345é", "12345#"]) {
      expect(ok(articleImpositionSchema, v), v).toBe(false);
    }
  });
});

describe("wilaya", () => {
  it("accepts 01..69 only", () => {
    expect(ok(wilayaCodeSchema, "01")).toBe(true);
    expect(ok(wilayaCodeSchema, "69")).toBe(true);
    for (const v of ["00", "70", "1", "AB"]) expect(ok(wilayaCodeSchema, v), v).toBe(false);
  });
});

describe("validateClientTaxProfile", () => {
  const business = {
    name: "SARL Exemple",
    wilaya: "16",
    commune: "Bab Ezzouar",
    nif: "0001 1600 1234 567",
    nis: "123456789012345",
    rc: "16/00-1234567 b 18",
    articleImposition: "16123456789",
  };

  it("passes a complete business profile and normalizes it", () => {
    const r = validateClientTaxProfile(business, "business");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.profile.nif).toBe("000116001234567");
      expect(r.profile.rc).toBe("16/00-1234567 B 18");
    }
  });

  it("reports every missing field for an empty business", () => {
    const r = validateClientTaxProfile({ name: "X" }, "business");
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.field).sort()).toEqual(["commune", "nif", "nis", "rc", "wilaya"]);
  });

  it("only warns when a business has no article d'imposition", () => {
    const r = validateClientTaxProfile({ ...business, articleImposition: "" }, "business");
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.field)).toEqual(["articleImposition"]);
  });

  it("still rejects a malformed article d'imposition", () => {
    expect(validateClientTaxProfile({ ...business, articleImposition: "1!" }, "business").ok).toBe(false);
  });

  it("reports malformed identifiers", () => {
    const r = validateClientTaxProfile({ ...business, nif: "123", rc: "bad" }, "business");
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.field).sort()).toEqual(["nif", "rc"]);
  });

  it("requires an address for an individual", () => {
    const r = validateClientTaxProfile({ name: "Ahmed" }, "individual");
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.field)).toEqual(["address"]);
  });

  it("lets an individual through with a name and address, but still checks given ids", () => {
    const addr = "12 rue Didouche Mourad, Alger";
    expect(validateClientTaxProfile({ name: "Ahmed", address: addr }, "individual").ok).toBe(true);
    expect(validateClientTaxProfile({ name: "Ahmed", address: addr, nif: "123" }, "individual").ok).toBe(false);
    expect(validateClientTaxProfile({ name: "", address: addr }, "individual").ok).toBe(false);
  });
});

describe("checkClientForFinalization", () => {
  const ids = { nif: "", nis: "", rc: "", articleImposition: "" };

  it("accepts a private customer with no identifier", () => {
    expect(checkClientForFinalization(ids)).toEqual({ errors: [], warnings: [] });
  });

  it("warns about a missing address, but not when the address is absent from the input", () => {
    expect(checkClientForFinalization({ ...ids, address: " " }).warnings).toHaveLength(1);
    expect(checkClientForFinalization({ ...ids, address: "Alger" }).warnings).toEqual([]);
  });

  it("blocks a NIF or NIS with non-digit characters", () => {
    expect(checkClientForFinalization({ ...ids, nif: "00001600123456X" }).errors).toHaveLength(1);
    expect(checkClientForFinalization({ ...ids, nif: "000016001234567", nis: "12ab" }).errors).toHaveLength(1);
  });

  it("only warns on a NIF of unexpected length", () => {
    const r = checkClientForFinalization({ ...ids, nif: "123" });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });

  it("accepts an older RC layout and warns on an implausible one", () => {
    const r = checkClientForFinalization({ ...ids, nif: "000016001234567", rc: "98 B 0123456" });
    expect(r).toEqual({ errors: [], warnings: [] });
    expect(checkClientForFinalization({ ...ids, nif: "000016001234567", rc: "abc" }).warnings).toHaveLength(1);
  });

  it("warns when a business-looking client has no NIF", () => {
    const r = checkClientForFinalization({ ...ids, rc: "16/00-1234567 B 18" });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toContain("NIF du client manquant.");
  });
});
