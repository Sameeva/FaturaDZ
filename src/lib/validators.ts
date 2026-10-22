import { rcSchema } from "./validations/client";
import { fr } from "@/i18n/fr";
import { ID_FORMATS } from "./fiscal-config";

/**
 * Format checks for Algerian identifiers. They return a warning message (French)
 * or null. They never block saving: see ID_FORMATS in fiscal-config.ts.
 */

const digitsOnly = (value: string) => value.replace(/[\s.-]/g, "");

function checkDigits(value: string, lengths: readonly number[], label: string): string | null {
  const v = digitsOnly(value);
  if (v === "") return null;
  if (!/^\d+$/.test(v)) return `${label} : chiffres uniquement.`;
  if (!lengths.includes(v.length)) {
    return `${label} : ${lengths.join(" ou ")} chiffres attendus (${v.length} saisis).`;
  }
  return null;
}

export const checkNif = (v: string) => checkDigits(v, ID_FORMATS.nif.lengths, fr.fields.nif);
export const checkNis = (v: string) => checkDigits(v, ID_FORMATS.nis.lengths, fr.fields.nis);
export const checkRib = (v: string) => checkDigits(v, ID_FORMATS.rib.lengths, "RIB");

export function checkArticleImposition(value: string): string | null {
  const v = digitsOnly(value);
  if (v === "") return null;
  return /^\d+$/.test(v) ? null : `${fr.fields.articleImposition} : chiffres uniquement.`;
}

/** Non-blocking RC format hint, using the strict schema from validations/client.ts. */
export function checkRc(value: string): string | null {
  if (value.trim() === "") return null;
  const result = rcSchema.safeParse(value);
  return result.success ? null : result.error.issues[0].message;
}
