import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fr } from "./fr";

function leaves(value: unknown, path = "fr"): [string, unknown][] {
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, `${path}.${k}`));
  }
  return [[path, value]];
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

describe("fr dictionary", () => {
  it("has no empty text", () => {
    const empty = leaves(fr).filter(([, v]) => typeof v === "string" && v.trim() === "");
    expect(empty).toEqual([]);
  });

  // Only one language exists today; when an Arabic dictionary is added, compare
  // its key set to this one here so a missing key fails the build.
  it("is the only dictionary (update this test when another language is added)", () => {
    const files = readdirSync(__dirname).filter((f) => /^[a-z]{2}\.ts$/.test(f));
    expect(files).toEqual(["fr.ts"]);
  });

  it("uses the same wording for fiscal identifiers everywhere", () => {
    expect(fr.fiscalShort.nif).toBe(fr.fields.nif);
    expect(fr.fiscalShort.nis).toBe(fr.fields.nis);
    expect(fr.fields.rc).toContain(fr.fiscalShort.rc);
    expect(fr.fields.articleImposition).toBe("Article d'imposition");
    expect(fr.totals.timbre).toBe("Droit de timbre");
  });

  it("does not hardcode fiscal labels outside the dictionary", () => {
    const forbidden = [/"Art\. imp\."/, /"N° RC"/, /"Droit de timbre"/, /"Timbre fiscal"/i, /"Article d'imposition"/];
    const offenders = sourceFiles(join(__dirname, ".."))
      .filter((f) => !f.endsWith(join("i18n", "fr.ts")))
      .filter((f) => forbidden.some((re) => re.test(readFileSync(f, "utf8"))));
    expect(offenders).toEqual([]);
  });
});
