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
 * Wilaya code, "01".."69". Algeria had 58 wilayas; law 26-06 of 4 April 2026 (JO n. 25)
 * brought the country to 69 and left 01-58 unchanged, so existing records stay valid.
 * Presidential decree 26-206 of 25 May 2026 (JO n. 40) numbers the eleven new ones 59 Aflou,
 * 60 Barika, 61 El Kantara, 62 Bir El Ater, 63 El Aricha, 64 Ksar Chellala, 65 Aïn Ouessara,
 * 66 Messaad, 67 Ksar El Boukhari, 68 Bou Saâda, 69 El Abiodh Sidi Cheikh. Lower
 * MAX_WILAYA_CODE to 58 if you only want the pre-reform list.
 */
export const MAX_WILAYA_CODE = 69;
export const wilayaCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{2}$/, "Wilaya : code à 2 chiffres attendu (01 à 69).")
  .refine((v) => Number(v) >= 1 && Number(v) <= MAX_WILAYA_CODE, `Wilaya : code entre 01 et ${MAX_WILAYA_CODE}.`);

export const communeSchema = z.string().trim().min(1, "Commune obligatoire.").max(80);

/** NIF: 15 digits; 20 for a secondary establishment (first 15 = main NIF), see fiscal-config. */
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
 * Older RCs (e.g. "98 B 0123456") use a different layout: this schema describes the modern
 * layout only, and rcLooksValid is what the forms and finalization use.
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

/**
 * Loose plausibility check for an RC as typed by users. The strict layout above is
 * the modern one; older numbers (e.g. "98 B 0123456") use other layouts and are
 * legitimate, so anything with enough digits and only usual separators passes.
 */
export function rcLooksValid(value: string): boolean {
  const v = value.trim();
  if (rcSchema.safeParse(v).success) return true;
  return /^[0-9A-Za-z/ .-]{5,40}$/.test(v) && (v.match(/\d/g) ?? []).length >= 5;
}

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
  | { ok: true; profile: ClientTaxProfile; issues: []; warnings: TaxProfileIssue[] }
  | { ok: false; issues: TaxProfileIssue[]; warnings: TaxProfileIssue[] };

/**
 * Validate a client before invoice generation.
 *  - "business": a professional client. Name, wilaya, commune, NIF, NIS and RC are
 *    required and must be well-formed. The article d'imposition is checked when
 *    present but only produces a warning when missing: the commercial-invoice
 *    decree (05-468) does not list it among the buyer's mandatory mentions.
 *  - "individual": a private customer. Name and address are required (decree
 *    05-468 asks for nom, prenom and address); fiscal identifiers are checked for
 *    format when present.
 * `warnings` never block. On success `profile` holds the normalized values (RC reformatted, separators
 * removed from NIF/NIS/AI).
 */
export function validateClientTaxProfile(input: unknown, mode: "business" | "individual"): TaxProfileResult {
  const issues: TaxProfileIssue[] = [];
  const parsed = clientTaxProfileSchema.safeParse(input);
  if (!parsed.success) {
    for (const i of parsed.error.issues) {
      issues.push({ field: (i.path[0] ?? "name") as keyof ClientTaxProfile, message: i.message });
    }
    return { ok: false, issues, warnings: [] };
  }
  const p = parsed.data;
  const warnings: TaxProfileIssue[] = [];
  if (p.name === "") issues.push({ field: "name", message: "Nom du client obligatoire." });

  if (mode === "business") {
    const required: [keyof ClientTaxProfile, string][] = [
      ["wilaya", "Wilaya obligatoire."],
      ["commune", "Commune obligatoire."],
      ["nif", "NIF obligatoire."],
      ["nis", "NIS obligatoire."],
      ["rc", "RC obligatoire."],
    ];
    for (const [field, message] of required) {
      if (p[field] === "") issues.push({ field, message });
    }
    if (p.articleImposition === "") {
      warnings.push({ field: "articleImposition", message: "Article d'imposition non renseigné." });
    }
  } else if (p.address === "") {
    issues.push({ field: "address", message: "Adresse du client obligatoire." });
  }
  return issues.length === 0 ? { ok: true, profile: p, issues: [], warnings } : { ok: false, issues, warnings };
}

export type FinalizationCheck = { errors: string[]; warnings: string[] };

/**
 * Check run on the client of an invoice (not a receipt) at finalization.
 *  - errors block: a NIF or NIS containing something other than digits.
 *  - warnings never block, because the formats are still TO VERIFY (see
 *    fiscal-config.ts): a NIF/NIS of unexpected length, an RC (older layouts such
 *    as "98 B 0123456" are legitimate), an Article d'imposition, and a client with
 *    some fiscal identifiers but no NIF, which looks like a business missing its NIF.
 * The client's address is a mandatory mention (decree 05-468), so a missing one warns too.
 * A client with no identifier at all is treated as a private customer.
 */
export function checkClientForFinalization(client: {
  address?: string;
  nif: string;
  nis: string;
  rc: string;
  articleImposition: string;
}): FinalizationCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const filled = (v: string) => v.trim() !== "";

  for (const [value, schema, label] of [
    [client.nif, nifSchema, "NIF"],
    [client.nis, nisSchema, "NIS"],
  ] as const) {
    if (!filled(value)) continue;
    if (!/^\d+$/.test(compact(value))) errors.push(`${label} : chiffres uniquement.`);
    else {
      const r = schema.safeParse(value);
      if (!r.success) warnings.push(r.error.issues[0].message);
    }
  }
  if (filled(client.rc) && !rcLooksValid(client.rc)) {
    warnings.push("RC : format non reconnu (les anciens formats restent acceptés).");
  }
  if (filled(client.articleImposition) && !articleImpositionSchema.safeParse(client.articleImposition).success) {
    warnings.push("Article d'imposition : format non reconnu.");
  }
  const anyId = [client.nis, client.rc, client.articleImposition].some(filled);
  if (anyId && !filled(client.nif)) warnings.push("NIF du client manquant.");
  if (client.address !== undefined && !filled(client.address)) {
    warnings.push("Adresse du client manquante (mention obligatoire sur la facture).");
  }
  return { errors, warnings };
}
