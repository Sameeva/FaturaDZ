import { z } from "zod";
import { ID_FORMATS } from "@/lib/fiscal-config";

/**
 * Strict Zod schemas for Algerian fiscal identifiers, plus the check run on a
 * client's tax profile before an invoice is generated.
 *
 * These are STRICT (they reject bad formats). The form-level warnings in
 * src/lib/validators.ts stay non-blocking; only validateClientTaxProfile is
 * meant to gate invoice generation, and only for business clients.
 *
 * Formats marked TO VERIFY follow the most cited interpretation; check with an
 * accountant / the DGI and change them here only.
 */

/** Strip the separators people type in (spaces, dots, dashes, slashes). */
const compact = (value: string) => value.replace(/[\s./-]/g, "");

/**
 * Wilaya code, "01".."69". TO VERIFY: Algeria had 58 wilayas until 2025; the
 * 2025 territorial reform raised the count to 69. Lower MAX_WILAYA_CODE to 58
 * if you only want the pre-reform list.
 */
export const MAX_WILAYA_CODE = 69;
export const wilayaCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{2}$/, "Wilaya : code à 2 chiffres attendu (01 à 69).")
  .refine((v) => Number(v) >= 1 && Number(v) <= MAX_WILAYA_CODE, `Wilaya : code entre 01 et ${MAX_WILAYA_CODE}.`);

export const communeSchema = z.string().trim().min(1, "Commune obligatoire.").max(80);

/** NIF: 15 digits (20 for some legal entities / secondary establishments, see fiscal-config). */
export const nifSchema = z
  .string()
  .transform(compact)
  .pipe(
    z
      .string()
      .regex(/^\d+$/, "NIF : chiffres uniquement.")
      .refine((v) => (ID_FORMATS.nif.lengths as readonly number[]).includes(v.length), {
        message: `NIF : ${ID_FORMATS.nif.lengths.join(" ou ")} chiffres attendus.`,
      }),
  );

/** NIS: 15 digits, 18 for a secondary establishment (15 + 3 sequential digits). */
export const nisSchema = z
  .string()
  .transform(compact)
  .pipe(
    z
      .string()
      .regex(/^\d+$/, "NIS : chiffres uniquement.")
      .refine((v) => (ID_FORMATS.nis.lengths as readonly number[]).includes(v.length), {
        message: `NIS : ${ID_FORMATS.nis.lengths.join(" ou ")} chiffres attendus.`,
      }),
  );

/**
 * RC (registre du commerce), written "WW/00-SSSSSSS C YY":
 *   WW       wilaya code of the registering CNRC office (01..MAX_WILAYA_CODE)
 *   00       office/series prefix, two digits
 *   SSSSSSS  7-digit sequence number
 *   C        category letter, A or B  (TO VERIFY: meaning of each letter)
 *   YY       registration year, two digits
 * Spaces around the letter are optional on input; the output is normalized.
 * TO VERIFY: older RCs (e.g. "98 B 0123456") use a different layout and are rejected.
 */
const RC_PATTERN = /^(\d{2})\/(\d{2})-(\d{7})\s*([AB])\s*(\d{2})$/i;

export const rcSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const m = RC_PATTERN.exec(value);
    if (!m) {
      ctx.addIssue({ code: "custom", message: "RC : format attendu 16/00-1234567 B 18." });
      return;
    }
    const wilaya = Number(m[1]);
    if (wilaya < 1 || wilaya > MAX_WILAYA_CODE) {
      ctx.addIssue({ code: "custom", message: `RC : code wilaya (${m[1]}) hors de 01-${MAX_WILAYA_CODE}.` });
    }
  })
  .transform((value) => {
    const m = RC_PATTERN.exec(value)!;
    return `${m[1]}/${m[2]}-${m[3]} ${m[4].toUpperCase()} ${m[5]}`;
  });

/** Parse an RC into its parts; null if the format is invalid. */
export function parseRc(value: string) {
  const r = rcSchema.safeParse(value);
  if (!r.success) return null;
  const m = RC_PATTERN.exec(r.data)!;
  return { wilaya: m[1], prefix: m[2], sequence: m[3], category: m[4] as "A" | "B", year: m[5] };
}

/**
 * Article d'imposition: alphanumeric, 5 to 20 characters once separators are
 * removed. TO VERIFY: no source confirmed the exact length.
 */
export const articleImpositionSchema = z
  .string()
  .transform((v) => compact(v).toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{5,20}$/, "Article d'imposition : 5 à 20 caractères alphanumériques."));

/** Optional variant: an empty string means "not provided". */
const optional = <T extends z.ZodType<string>>(schema: T) =>
  z.union([z.literal(""), schema]).transform((v) => v as string);

/** Tax-relevant part of a client, as stored/typed (all strings, "" = empty). */
export const clientTaxProfileSchema = z.object({
  name: z.string().trim().max(120),
  address: z.string().trim().max(240).default(""),
  wilaya: optional(wilayaCodeSchema).default(""),
  commune: z.string().trim().max(80).default(""),
  nif: optional(nifSchema).default(""),
  nis: optional(nisSchema).default(""),
  rc: optional(rcSchema).default(""),
  articleImposition: optional(articleImpositionSchema).default(""),
});
export type ClientTaxProfile = z.infer<typeof clientTaxProfileSchema>;

export type TaxProfileIssue = { field: keyof ClientTaxProfile; message: string };
export type TaxProfileResult =
  | { ok: true; profile: ClientTaxProfile; issues: [] }
  | { ok: false; issues: TaxProfileIssue[] };

/**
 * Validate a client before invoice generation.
 *  - "business": a professional client. Name, wilaya, commune and all four fiscal
 *    identifiers are required and must be well-formed.
 *  - "individual": a private customer. Only the name is required; fiscal
 *    identifiers are checked for format when present.
 * On success `profile` holds the normalized values (RC reformatted, separators
 * removed from NIF/NIS/AI).
 */
export function validateClientTaxProfile(input: unknown, mode: "business" | "individual"): TaxProfileResult {
  const issues: TaxProfileIssue[] = [];
  const parsed = clientTaxProfileSchema.safeParse(input);
  if (!parsed.success) {
    for (const i of parsed.error.issues) {
      issues.push({ field: (i.path[0] ?? "name") as keyof ClientTaxProfile, message: i.message });
    }
    return { ok: false, issues };
  }
  const p = parsed.data;
  if (p.name === "") issues.push({ field: "name", message: "Nom du client obligatoire." });

  if (mode === "business") {
    const required: [keyof ClientTaxProfile, string][] = [
      ["wilaya", "Wilaya obligatoire."],
      ["commune", "Commune obligatoire."],
      ["nif", "NIF obligatoire."],
      ["nis", "NIS obligatoire."],
      ["rc", "RC obligatoire."],
      ["articleImposition", "Article d'imposition obligatoire."],
    ];
    for (const [field, message] of required) {
      if (p[field] === "") issues.push({ field, message });
    }
  }
  return issues.length === 0 ? { ok: true, profile: p, issues: [] } : { ok: false, issues };
}
