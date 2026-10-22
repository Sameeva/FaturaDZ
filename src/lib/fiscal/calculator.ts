import { TVA_RATES_BP, type TvaRateBp } from "../fiscal-config";
import { computeLineHT, computeTotals, type PaymentMethod } from "../tax";

export { TVA_RATES_BP };
export type { PaymentMethod, TvaRateBp };

/** Standard Algerian TVA rates in basis points, named for readability. */
export const TVA_RATE = {
  STANDARD: 1900,
  REDUCED: 900,
  EXEMPT: 0,
} as const satisfies Record<string, TvaRateBp>;

/** Payment methods other than cash never carry the droit de timbre. */
export const TIMBRE_PAYMENT_METHODS: readonly PaymentMethod[] = ["especes"];

export interface FiscalLineInput {
  /** Quantity in thousandths (2,5 -> 2500). Must be > 0. */
  quantityMilli: number;
  /** Unit price excluding TVA, in centimes. */
  unitPriceCentimes: number;
  /** Item discount in basis points (0..10000). Defaults to 0. */
  discountBp?: number;
  tvaRateBp: TvaRateBp;
}

export interface FiscalCalculationInput {
  lines: readonly FiscalLineInput[];
  paymentMethod: PaymentMethod;
}

export interface FiscalLineResult {
  /** Net commercial: line HT after the item discount, in centimes. */
  netCommercialCentimes: number;
  tvaRateBp: TvaRateBp;
}

export interface TvaBracketResult {
  rateBp: TvaRateBp;
  baseHTCentimes: number;
  tvaCentimes: number;
}

export interface FiscalCalculationResult {
  lines: FiscalLineResult[];
  totalHTCentimes: number;
  /** One entry per rate actually used, highest rate first. */
  tvaBrackets: TvaBracketResult[];
  totalTVACentimes: number;
  /** HT + TVA, before the timbre. The timbre base. */
  totalTTCCentimes: number;
  /** Droit de timbre: cash only, 0 for every other payment method. */
  timbreCentimes: number;
  /** TTC + timbre: the amount the customer actually pays. */
  netAPayerCentimes: number;
}

/**
 * Computes every figure of an invoice from its lines and payment method.
 *
 * Thin, typed facade over computeTotals (tax.ts) so the rounding rules and the
 * timbre schedule (fiscal-config.ts) stay defined in one place.
 */
export function calculateInvoice(input: FiscalCalculationInput): FiscalCalculationResult {
  const lines = input.lines.map((l) => ({ ...l, discountBp: l.discountBp ?? 0 }));
  const totals = computeTotals(lines, {
    paymentMethod: input.paymentMethod,
    applyTimbre: TIMBRE_PAYMENT_METHODS.includes(input.paymentMethod),
  });
  return {
    lines: lines.map((l) => ({ netCommercialCentimes: computeLineHT(l), tvaRateBp: l.tvaRateBp })),
    totalHTCentimes: totals.totalHTCentimes,
    tvaBrackets: totals.tva,
    totalTVACentimes: totals.totalTVACentimes,
    totalTTCCentimes: totals.totalTTCCentimes,
    timbreCentimes: totals.timbreCentimes,
    netAPayerCentimes: totals.netAPayerCentimes,
  };
}
