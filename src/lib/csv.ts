import type { FinalDocument } from "@/db/schema";
import { documentTotals } from "@/db/repository";
import { fr } from "@/i18n/fr";

const SEPARATOR = ";"; // French Excel opens ";" separated files directly
const BOM = "﻿"; // lets Excel detect UTF-8 (accents)

/** 123456 -> "1234,56" (no thousands separator, so spreadsheets read it as a number). */
function amount(centimes: number): string {
  return `${Math.floor(centimes / 100)},${String(centimes % 100).padStart(2, "0")}`;
}

/** Quotes a cell when needed and defuses spreadsheet formulas ("=", "+", "-", "@"). */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Finalized documents as a CSV for accounting: number, date, client, HT, TVA, timbre, net à payer. */
export function documentsToCsv(documents: FinalDocument[]): string {
  const header = ["Numéro", "Type", "Date", "Client", "NIF client", "Total HT", "TVA", "Timbre", "Net à payer"];
  const rows = [...documents]
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.number.localeCompare(b.number))
    .map((d) => {
      const t = documentTotals(d);
      const [y, m, day] = d.issueDate.split("-");
      return [
        d.number,
        fr.docType[d.type],
        `${day}/${m}/${y}`,
        d.client.name,
        d.client.nif,
        amount(t.totalHTCentimes),
        amount(t.totalTVACentimes),
        amount(t.timbreCentimes),
        amount(t.netAPayerCentimes),
      ];
    });
  return BOM + [header, ...rows].map((r) => r.map(csvCell).join(SEPARATOR)).join("\r\n") + "\r\n";
}
