import { describe, expect, it } from "vitest";
import { TVA_RATE, calculateInvoice, type FiscalLineInput, type PaymentMethod } from "./calculator";

const DA = (v: number) => Math.round(v * 100);

/** One unit of an item priced `priceDA` (HT) at the given rate. */
const item = (priceDA: number, tvaRateBp: FiscalLineInput["tvaRateBp"], extra: Partial<FiscalLineInput> = {}) => ({
  quantityMilli: 1000,
  unitPriceCentimes: DA(priceDA),
  tvaRateBp,
  ...extra,
});

describe("TVA rates", () => {
  it("exposes the standard, reduced and exempt rates", () => {
    expect(TVA_RATE).toEqual({ STANDARD: 1900, REDUCED: 900, EXEMPT: 0 });
  });

  it.each([
    ["19 %", TVA_RATE.STANDARD, DA(190)],
    ["9 %", TVA_RATE.REDUCED, DA(90)],
    ["0 %", TVA_RATE.EXEMPT, 0],
  ])("applies %s on 1 000 DA HT", (_l, rate, tva) => {
    const r = calculateInvoice({ lines: [item(1000, rate)], paymentMethod: "virement" });
    expect(r.totalHTCentimes).toBe(DA(1000));
    expect(r.totalTVACentimes).toBe(tva);
    expect(r.totalTTCCentimes).toBe(DA(1000) + tva);
  });

  it("rejects an unsupported rate", () => {
    expect(() =>
      calculateInvoice({ lines: [item(100, 1400 as never)], paymentMethod: "virement" }),
    ).toThrow(RangeError);
  });
});

describe("net commercial (HT after item discount)", () => {
  it("applies the discount to the line: 2 × 500 DA − 10 % = 900 DA", () => {
    const r = calculateInvoice({
      lines: [item(500, TVA_RATE.STANDARD, { quantityMilli: 2000, discountBp: 1000 })],
      paymentMethod: "virement",
    });
    expect(r.lines[0].netCommercialCentimes).toBe(DA(900));
    expect(r.totalHTCentimes).toBe(DA(900));
    expect(r.totalTVACentimes).toBe(DA(171));
  });

  it("handles fractional quantities: 2,5 × 100 DA = 250 DA", () => {
    const r = calculateInvoice({
      lines: [item(100, TVA_RATE.EXEMPT, { quantityMilli: 2500 })],
      paymentMethod: "virement",
    });
    expect(r.lines[0].netCommercialCentimes).toBe(DA(250));
  });

  it("a 100 % discount gives 0 everywhere", () => {
    const r = calculateInvoice({
      lines: [item(500, TVA_RATE.STANDARD, { discountBp: 10000 })],
      paymentMethod: "especes",
    });
    expect(r).toMatchObject({ totalHTCentimes: 0, totalTVACentimes: 0, totalTTCCentimes: 0, timbreCentimes: 0, netAPayerCentimes: 0 });
  });

  it("rejects an out-of-range discount", () => {
    expect(() => calculateInvoice({ lines: [item(1, 0, { discountBp: 10001 })], paymentMethod: "virement" })).toThrow(RangeError);
    expect(() => calculateInvoice({ lines: [item(1, 0, { discountBp: -1 })], paymentMethod: "virement" })).toThrow(RangeError);
  });
});

describe("zero values", () => {
  it("an empty invoice is all zeros with no TVA bracket", () => {
    const r = calculateInvoice({ lines: [], paymentMethod: "especes" });
    expect(r).toEqual({
      lines: [],
      totalHTCentimes: 0,
      tvaBrackets: [],
      totalTVACentimes: 0,
      totalTTCCentimes: 0,
      timbreCentimes: 0,
      netAPayerCentimes: 0,
    });
  });

  it("a free item (price 0) yields 0 and no timbre", () => {
    const r = calculateInvoice({ lines: [item(0, TVA_RATE.STANDARD)], paymentMethod: "especes" });
    expect(r.netAPayerCentimes).toBe(0);
    expect(r.tvaBrackets).toEqual([{ rateBp: 1900, baseHTCentimes: 0, tvaCentimes: 0 }]);
  });

  it("rejects a zero quantity and a negative price", () => {
    expect(() => calculateInvoice({ lines: [item(1, 0, { quantityMilli: 0 })], paymentMethod: "virement" })).toThrow(RangeError);
    expect(() => calculateInvoice({ lines: [{ quantityMilli: 1000, unitPriceCentimes: -1, tvaRateBp: 0 }], paymentMethod: "virement" })).toThrow(RangeError);
  });
});

describe("timbre fiscal (cash only; art. 100 Code du timbre, LF 2025)", () => {
  it("is 0 for every non-cash payment method, even on a large invoice", () => {
    const methods: PaymentMethod[] = ["virement", "cheque", "carte", "autre"];
    for (const paymentMethod of methods) {
      const r = calculateInvoice({ lines: [item(500_000, TVA_RATE.STANDARD)], paymentMethod });
      expect(r.timbreCentimes).toBe(0);
      expect(r.netAPayerCentimes).toBe(r.totalTTCCentimes);
    }
  });

  it("cash, 1 000 DA HT at 19 %: TTC 1 190 DA -> 12 tranches × 1 DA = 12 DA", () => {
    const r = calculateInvoice({ lines: [item(1000, TVA_RATE.STANDARD)], paymentMethod: "especes" });
    expect(r.totalTTCCentimes).toBe(DA(1190));
    expect(r.timbreCentimes).toBe(DA(12));
    expect(r.netAPayerCentimes).toBe(DA(1202));
  });

  it("is computed on TTC, not HT: 252 DA HT -> 299,88 TTC is exempt, 253 DA HT -> 301,07 TTC is not", () => {
    const below = calculateInvoice({ lines: [item(252, TVA_RATE.STANDARD)], paymentMethod: "especes" });
    expect(below.totalTTCCentimes).toBe(DA(299.88));
    expect(below.timbreCentimes).toBe(0);
    const above = calculateInvoice({ lines: [item(253, TVA_RATE.STANDARD)], paymentMethod: "especes" });
    expect(above.totalTTCCentimes).toBe(DA(301.07));
    expect(above.timbreCentimes).toBe(DA(5)); // 4 tranches -> 5 DA minimum
  });

  it("exemption threshold: 300 DA -> 0, 300,01 DA -> 5 DA minimum", () => {
    expect(calculateInvoice({ lines: [item(300, 0)], paymentMethod: "especes" }).timbreCentimes).toBe(0);
    expect(calculateInvoice({ lines: [item(300.01, 0)], paymentMethod: "especes" }).timbreCentimes).toBe(DA(5));
  });

  it("bracket edges: 30 000 DA -> 300 DA, 30 000,01 DA -> 451,50 DA", () => {
    expect(calculateInvoice({ lines: [item(30000, 0)], paymentMethod: "especes" }).timbreCentimes).toBe(DA(300));
    expect(calculateInvoice({ lines: [item(30000.01, 0)], paymentMethod: "especes" }).timbreCentimes).toBe(DA(451.5));
  });

  it("50 000 DA -> 750 DA (whole amount takes the 1,5 DA rate)", () => {
    expect(calculateInvoice({ lines: [item(50000, 0)], paymentMethod: "especes" }).timbreCentimes).toBe(DA(750));
  });

  it("has no cap: 1 000 000 DA -> 20 000 DA (the pre-2025 10 000 DA cap is gone)", () => {
    const r = calculateInvoice({ lines: [item(1_000_000, 0)], paymentMethod: "especes" });
    expect(r.timbreCentimes).toBe(DA(20000));
    expect(r.netAPayerCentimes).toBe(DA(1_020_000));
  });
});

describe("multi-tax invoice", () => {
  const lines = [
    item(1000, TVA_RATE.STANDARD),
    item(2000, TVA_RATE.REDUCED),
    item(500, TVA_RATE.EXEMPT),
  ];

  it("splits TVA per rate bracket, highest rate first", () => {
    const r = calculateInvoice({ lines, paymentMethod: "virement" });
    expect(r.tvaBrackets).toEqual([
      { rateBp: 1900, baseHTCentimes: DA(1000), tvaCentimes: DA(190) },
      { rateBp: 900, baseHTCentimes: DA(2000), tvaCentimes: DA(180) },
      { rateBp: 0, baseHTCentimes: DA(500), tvaCentimes: 0 },
    ]);
    expect(r.totalHTCentimes).toBe(DA(3500));
    expect(r.totalTVACentimes).toBe(DA(370));
    expect(r.totalTTCCentimes).toBe(DA(3870));
    expect(r.timbreCentimes).toBe(0);
  });

  it("cash: timbre on the whole TTC (3 870 DA -> 39 tranches = 39 DA)", () => {
    const r = calculateInvoice({ lines, paymentMethod: "especes" });
    expect(r.timbreCentimes).toBe(DA(39));
    expect(r.netAPayerCentimes).toBe(DA(3909));
  });

  it("merges lines of the same rate into one bracket", () => {
    const r = calculateInvoice({
      lines: [item(100, TVA_RATE.STANDARD), item(200, TVA_RATE.STANDARD)],
      paymentMethod: "virement",
    });
    expect(r.tvaBrackets).toEqual([{ rateBp: 1900, baseHTCentimes: DA(300), tvaCentimes: DA(57) }]);
  });

  it("rounds TVA once per bracket, not per line (10 × 0,01 DA at 19 % -> 0,02 DA)", () => {
    const r = calculateInvoice({
      lines: Array.from({ length: 10 }, () => ({ quantityMilli: 1000, unitPriceCentimes: 1, tvaRateBp: TVA_RATE.STANDARD })),
      paymentMethod: "virement",
    });
    expect(r.totalHTCentimes).toBe(10);
    expect(r.totalTVACentimes).toBe(2); // 1,9 centimes rounded half up; per line it would be 0
  });

  it("keeps the sum identity HT + TVA = TTC and TTC + timbre = net à payer", () => {
    const r = calculateInvoice({ lines, paymentMethod: "especes" });
    expect(r.totalHTCentimes + r.totalTVACentimes).toBe(r.totalTTCCentimes);
    expect(r.totalTTCCentimes + r.timbreCentimes).toBe(r.netAPayerCentimes);
    expect(r.tvaBrackets.reduce((s, b) => s + b.tvaCentimes, 0)).toBe(r.totalTVACentimes);
    expect(r.lines.reduce((s, l) => s + l.netCommercialCentimes, 0)).toBe(r.totalHTCentimes);
  });
});
