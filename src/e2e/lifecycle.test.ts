import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportBackup, parseBackup, restoreBackup } from "@/db/backup";
import { FaturaDb } from "@/db";
import {
  documentTotals,
  finalizeDocument,
  getBusiness,
  newDraft,
  newId,
  saveBusiness,
  saveClient,
  saveDraft,
  sellerFromBusiness,
} from "@/db/repository";
import { clientSnapshotSchema, type Business, type Client, type DraftDocument, type DocumentLine } from "@/db/schema";
import { amountInWords } from "@/lib/amountInWords";
import { checkArticleImposition, checkNif, checkNis } from "@/lib/validators";
import { buildPdfModel } from "@/pdf/model";

/**
 * A full business session, in the order a user would do it:
 * company profile -> B2B client -> B2C client -> multi-rate invoice with
 * discounts -> cash vs bank transfer -> PDF data model.
 */

const seller: Business = {
  id: "business",
  name: "SARL Tafsut Distribution",
  legalForm: "SARL",
  capitalCentimes: 1_000_000_000,
  activity: "Commerce de gros",
  address: "Zone industrielle, Rouiba, Alger",
  phone: "023 85 00 00",
  email: "contact@tafsut.example",
  nif: "000116001234567",
  nis: "000116010012345",
  rc: "16/00-1234567 B 18",
  articleImposition: "16012345678",
  rib: "00100123456789012345",
  bank: "BNA",
  logo: null,
  tvaLiable: true,
  defaultTvaRateBp: 1900,
  footer: "Paiement à réception.",
};

const emptyIds = { address: "", phone: "", email: "", nif: "", nis: "", rc: "", articleImposition: "" };

const b2b: Client = {
  id: "client-b2b",
  name: "EURL El Baraka",
  ...emptyIds,
  address: "Oran",
  nif: "000131009876543",
  nis: "000131010098765",
  rc: "31/00-7654321 B 20",
  articleImposition: "31009876543",
  createdAt: 1,
};

const b2c: Client = { id: "client-b2c", name: "Karim Benali", ...emptyIds, phone: "0550 00 00 00", createdAt: 2 };

const line = (over: Partial<DocumentLine>): DocumentLine => ({
  designation: "Article",
  unit: "u",
  quantityMilli: 1000,
  unitPriceCentimes: 100_00,
  discountBp: 0,
  tvaRateBp: 1900,
  ...over,
});

// HT: 10 000,00 + 900,00 + 250,00 + 150,00 = 11 300,00
const LINES: DocumentLine[] = [
  line({ designation: "Farine 25 kg", unit: "sac", quantityMilli: 10_000, unitPriceCentimes: 1_000_00 }), // 19 %
  line({ designation: "Lait UHT", unit: "carton", quantityMilli: 2_000, unitPriceCentimes: 500_00, discountBp: 1000, tvaRateBp: 900 }), // 9 %, -10 %
  line({ designation: "Transport (exonéré)", quantityMilli: 1_000, unitPriceCentimes: 250_00, tvaRateBp: 0 }), // 0 %
  line({ designation: "Emballage", quantityMilli: 3_000, unitPriceCentimes: 100_00, discountBp: 5000 }), // 19 %, -50 %
];

const toClientSnapshot = (c: Client) => clientSnapshotSchema.parse(c);

let db: FaturaDb;
let n = 0;

beforeEach(() => {
  db = new FaturaDb(`lifecycle-${n++}`);
});
afterEach(async () => {
  await db.delete();
});

async function invoiceFor(client: Client, over: Partial<DraftDocument>) {
  const draft = await saveDraft(db, {
    ...newDraft("facture"),
    issueDate: "2026-03-10",
    client: toClientSnapshot(client),
    lines: LINES,
    ...over,
  });
  return finalizeDocument(db, draft.id);
}

describe("full invoice lifecycle", () => {
  it("validates the Algerian identifiers of the seller and the B2B client", () => {
    for (const p of [seller, b2b]) {
      expect(checkNif(p.nif)).toBeNull();
      expect(checkNis(p.nis)).toBeNull();
      expect(checkArticleImposition(p.articleImposition)).toBeNull();
    }
    expect(checkNif("123")).toMatch(/NIF/);
    expect(checkNis("12345678901234x")).toMatch(/NIS/);
    expect(checkArticleImposition("AB12")).toMatch(/Article d'imposition/);
    // The B2C client has no tax profile and that is fine.
    expect(checkNif(b2c.nif)).toBeNull();
  });

  it("refuses to finalize before the company profile exists", async () => {
    const draft = await saveDraft(db, { ...newDraft("facture"), client: toClientSnapshot(b2b), lines: LINES });
    await expect(finalizeDocument(db, draft.id)).rejects.toThrow(/entreprise/);
  });

  it("computes cash totals with timbre, and legal notes match the net à payer", async () => {
    await saveBusiness(db, seller);
    await saveClient(db, b2b);
    const invoice = await invoiceFor(b2b, { paymentMethod: "especes", applyTimbre: true });

    const t = documentTotals(invoice);
    expect(t.lineHTCentimes).toEqual([10_000_00, 900_00, 250_00, 150_00]);
    expect(t.totalHTCentimes).toBe(11_300_00);
    expect(t.tva).toEqual([
      { rateBp: 1900, baseHTCentimes: 10_150_00, tvaCentimes: 1_928_50 },
      { rateBp: 900, baseHTCentimes: 900_00, tvaCentimes: 81_00 },
      { rateBp: 0, baseHTCentimes: 250_00, tvaCentimes: 0 },
    ]);
    expect(t.totalTVACentimes).toBe(2_009_50);
    expect(t.totalTTCCentimes).toBe(13_309_50);
    expect(t.timbreCentimes).toBe(134_00); // 134 started 100 DA tranches × 1 DA
    expect(t.netAPayerCentimes).toBe(13_443_50);

    const pdf = buildPdfModel(invoice, sellerFromBusiness(seller));
    expect(pdf.number).toBe("FA-2026-0001");
    expect(pdf.net).toEqual(["Net à payer", "13 443,50 DA"]);
    expect(pdf.inWords).toBe("Treize mille quatre cent quarante-trois dinars algériens et cinquante centimes");
    expect(pdf.inWords.toLowerCase()).toBe(amountInWords(t.netAPayerCentimes));
    expect(pdf.totals.map(([label]) => label)).toEqual([
      "Total HT",
      "TVA 19 % (base 10 150,00)",
      "TVA 9 % (base 900,00)",
      "TVA 0 % (base 250,00)",
      "Total TTC",
      "Droit de timbre",
    ]);
    expect(pdf.totals.at(-1)).toEqual(["Droit de timbre", "134,00 DA"]);
    expect(pdf.rows.map((r) => r.at(-1))).toEqual(["10 000,00", "900,00", "250,00", "150,00"]);
    expect(pdf.rows[1].slice(4, 6)).toEqual(["10 %", "9 %"]);
    expect(pdf.payment).toBe("Mode de paiement : Espèces");
    expect(pdf.seller.ids).toEqual([
      ["NIF", seller.nif],
      ["NIS", seller.nis],
      ["RC", seller.rc],
      ["Art. imp.", seller.articleImposition],
      ["RIB", seller.rib],
      ["Banque", seller.bank],
    ]);
    expect(pdf.client?.ids).toEqual([
      ["NIF", b2b.nif],
      ["NIS", b2b.nis],
      ["RC", b2b.rc],
      ["Art. imp.", b2b.articleImposition],
    ]);
  });

  it("applies no timbre on bank transfer", async () => {
    await saveBusiness(db, seller);
    const invoice = await invoiceFor(b2b, { paymentMethod: "virement" });
    const t = documentTotals(invoice);
    expect(t.timbreCentimes).toBe(0);
    expect(t.netAPayerCentimes).toBe(t.totalTTCCentimes);

    const pdf = buildPdfModel(invoice, sellerFromBusiness(seller));
    expect(pdf.net[1]).toBe("13 309,50 DA");
    expect(pdf.totals.map(([label]) => label)).not.toContain("Droit de timbre");
    expect(pdf.inWords).toBe("Treize mille trois cent neuf dinars algériens et cinquante centimes");
  });

  it("lets a cash invoice opt out of the timbre", async () => {
    await saveBusiness(db, seller);
    const invoice = await invoiceFor(b2b, { paymentMethod: "especes", applyTimbre: false });
    expect(documentTotals(invoice).timbreCentimes).toBe(0);
  });

  it("handles a B2C client without tax identifiers", async () => {
    await saveBusiness(db, seller);
    await saveClient(db, b2c);
    const invoice = await invoiceFor(b2c, { lines: [LINES[0]] });
    const pdf = buildPdfModel(invoice, sellerFromBusiness(seller));
    expect(pdf.client?.name).toBe("Karim Benali");
    expect(pdf.client?.ids).toEqual([]);
    // 10 × 1 000 DA at 19 % = 11 900 TTC; cash by default, so timbre 119 DA
    expect(pdf.net[1]).toBe("12 019,00 DA");
  });

  it("numbers consecutive invoices and keeps the seller frozen after profile edits", async () => {
    await saveBusiness(db, seller);
    const first = await invoiceFor(b2b, {});
    const second = await invoiceFor(b2c, {});
    expect([first.number, second.number]).toEqual(["FA-2026-0001", "FA-2026-0002"]);

    await saveBusiness(db, { ...seller, name: "Renamed", rc: "00/00-0000000 B 00" });
    const pdf = buildPdfModel((await db.documents.get(first.id))!, sellerFromBusiness((await getBusiness(db))!));
    expect(pdf.seller.name).toBe("SARL Tafsut Distribution");
    expect(pdf.seller.ids).toContainEqual(["RC", seller.rc]);
  });

  it("survives a backup and restore with identical PDF output", async () => {
    await saveBusiness(db, seller);
    const invoice = await invoiceFor(b2b, {});
    const before = buildPdfModel(invoice, sellerFromBusiness(seller));

    const parsed = parseBackup(JSON.stringify(await exportBackup(db)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const other = new FaturaDb(`lifecycle-restore-${n++}`);
    await restoreBackup(other, parsed.backup);
    const restored = (await other.documents.get(invoice.id))!;
    expect(buildPdfModel(restored, sellerFromBusiness(seller))).toEqual(before);
    // the counter continues after the restored invoice
    await saveBusiness(other, seller);
    const next = await finalizeDocument(other, (await saveDraft(other, { ...newDraft("facture"), id: newId(), issueDate: "2026-03-11", client: toClientSnapshot(b2b), lines: LINES })).id);
    expect(next.number).toBe("FA-2026-0002");
    await other.delete();
  });

  it("keeps a TVA-exempt seller at 0 % on every line", async () => {
    await saveBusiness(db, { ...seller, tvaLiable: false, defaultTvaRateBp: 0 });
    const draft = await saveDraft(db, { ...newDraft("facture"), client: toClientSnapshot(b2b), lines: LINES });
    await expect(finalizeDocument(db, draft.id)).rejects.toThrow(/TVA/);
    const ok = await saveDraft(db, { ...draft, lines: LINES.map((l) => ({ ...l, tvaRateBp: 0 as const })) });
    const final = await finalizeDocument(db, ok.id);
    // the document prints the frozen (exempt) seller, not the liable one passed as "current"
    const pdf = buildPdfModel(final, sellerFromBusiness(seller));
    expect(pdf.tvaNotice).toBe("Non assujetti à la TVA");
    expect(pdf.totals.map(([label]) => label)).toEqual(["Total HT", "TVA 0 % (base 11 300,00)", "Total TTC", "Droit de timbre"]);
  });
});
