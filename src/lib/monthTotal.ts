import { assertCentimes } from "./money";

export interface MonthEntry {
  /** ISO date (YYYY-MM-DD) of the document. */
  issueDate: string;
  /** Net à payer in centimes, or null when the total cannot be computed. */
  netCentimes: number | null;
}

export interface MonthSummary {
  count: number;
  totalCentimes: number;
}

/**
 * Counts the entries issued in `month` (YYYY-MM) and adds up their net amounts.
 * Entries without a computable total are counted but add nothing.
 * The sum is done in BigInt so it stays exact, and throws if it leaves the safe range.
 */
export function summarizeMonth(entries: readonly MonthEntry[], month: string): MonthSummary {
  let total = BigInt(0);
  let count = 0;
  for (const entry of entries) {
    if (!entry.issueDate.startsWith(month)) continue;
    count += 1;
    if (entry.netCentimes === null) continue;
    assertCentimes(entry.netCentimes, "net amount");
    total += BigInt(entry.netCentimes);
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("monthly total is too large");
  return { count, totalCentimes: Number(total) };
}
