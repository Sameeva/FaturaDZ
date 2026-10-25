import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FaturaDb } from "./index";
import { describeDbError } from "./errors";
import { fr } from "@/i18n/fr";
import { exportBackup, MAX_BACKUP_BYTES, parseBackup, reconcileCounters, restoreBackup } from "./backup";
import { deleteDraft, duplicateAsDraft, finalizeDocument, newDraft, saveBusiness, saveDraft } from "./repository";
import type { Business, DraftDocument } from "./schema";

const business: Business = {
  id: "business",
  name: "SARL Exemple",
  legalForm: "SARL",
  capitalCentimes: 10_000_000,
  activity: "Commerce",
  address: "Alger",
  phone: "",
  email: "",
  nif: "000016001234567",
  nis: "",
  rc: "16/00-1234567 B 18",
  articleImposition: "16012345678",
  rib: "",
  bank: "",
  logo: null,
  tvaLiable: true,
  defaultTvaRateBp: 1900,
  footer: "",
};

const draftWith = (over: Partial<DraftDocument> = {}): DraftDocument => ({
  ...newDraft("facture"),
  issueDate: "2026-03-10",
  client: { name: "Client SPA", address: "", phone: "", email: "", nif: "", nis: "", rc: "", articleImposition: "" },
  lines: [{ designation: "Produit", unit: "u", quantityMilli: 1000, unitPriceCentimes: 100000, discountBp: 0, tvaRateBp: 1900 }],
  ...over,
});

let db: FaturaDb;
let n = 0;

beforeEach(async () => {
  db = new FaturaDb(`test-${n++}`);
  await saveBusiness(db, business);
});
afterEach(async () => {
  await db.delete();
});

describe("finalizeDocument", () => {

  it("refuses an invoice whose client NIF has letters, but not an older RC", async () => {
    await saveBusiness(db, business);
    const bad = draftWith({ client: { ...draftWith().client, nif: "00001600123456X" } });
    await saveDraft(db, bad);
    await expect(finalizeDocument(db, bad.id)).rejects.toThrow(/NIF/);
    const oldRc = draftWith({ client: { ...draftWith().client, nif: "000016001234567", rc: "98 B 0123456" } });
    await saveDraft(db, oldRc);
    expect((await finalizeDocument(db, oldRc.id)).status).toBe("final");
  });
  it("assigns sequential numbers per type and year", async () => {
    const a = await saveDraft(db, draftWith());
    const b = await saveDraft(db, draftWith());
    const r = await saveDraft(db, draftWith({ type: "recu" }));
    const nextYear = await saveDraft(db, draftWith({ issueDate: "2027-01-02" }));

    expect((await finalizeDocument(db, a.id)).number).toBe("FA-2026-0001");
    expect((await finalizeDocument(db, b.id)).number).toBe("FA-2026-0002");
    expect((await finalizeDocument(db, r.id)).number).toBe("RE-2026-0001");
    expect((await finalizeDocument(db, nextYear.id)).number).toBe("FA-2027-0001");
  });

  it("never gives the same number to concurrent finalizations", async () => {
    const drafts = await Promise.all([1, 2, 3, 4, 5].map(() => saveDraft(db, draftWith())));
    const finals = await Promise.all(drafts.map((d) => finalizeDocument(db, d.id)));
    expect(new Set(finals.map((f) => f.number)).size).toBe(5);
  });

  it("freezes the seller details", async () => {
    const d = await saveDraft(db, draftWith());
    const final = await finalizeDocument(db, d.id);
    await saveBusiness(db, { ...business, name: "Nouveau nom" });
    expect((await db.documents.get(final.id))?.seller?.name).toBe("SARL Exemple");
  });

  it("refuses empty documents, invoices without client and missing business", async () => {
    const empty = await saveDraft(db, draftWith({ lines: [] }));
    await expect(finalizeDocument(db, empty.id)).rejects.toThrow(/au moins une ligne/);

    const noClient = await saveDraft(db, draftWith({ client: { ...draftWith().client, name: "" } }));
    await expect(finalizeDocument(db, noClient.id)).rejects.toThrow(/client/);

    await db.settings.clear();
    const ok = await saveDraft(db, draftWith());
    await expect(finalizeDocument(db, ok.id)).rejects.toThrow(/entreprise/);
    expect(await db.counters.count()).toBe(0); // no number consumed on failure
  });

  it("lets unfinished drafts be saved but refuses to finalize blank lines", async () => {
    const blank = { ...draftWith().lines[0], designation: "" };
    const d = await saveDraft(db, draftWith({ client: { ...draftWith().client, name: "" }, lines: [blank] }));
    await expect(finalizeDocument(db, d.id)).rejects.toThrow();
    const r = await saveDraft(db, draftWith({ type: "recu", client: { ...draftWith().client, name: "" }, lines: [blank] }));
    await expect(finalizeDocument(db, r.id)).rejects.toThrow(/désignation/);
  });

  it("keeps numbers in date order", async () => {
    await finalizeDocument(db, (await saveDraft(db, draftWith({ issueDate: "2026-03-01" }))).id);
    const earlier = await saveDraft(db, draftWith({ issueDate: "2026-01-15" }));
    await expect(finalizeDocument(db, earlier.id)).rejects.toThrow(/01\/03\/2026/);
    const lastYear = await saveDraft(db, draftWith({ issueDate: "2025-12-31" }));
    await expect(finalizeDocument(db, lastYear.id)).rejects.toThrow(/antérieure/);
    const sameDay = await saveDraft(db, draftWith({ issueDate: "2026-03-01" }));
    expect((await finalizeDocument(db, sameDay.id)).number).toBe("FA-2026-0002");
    // receipts have their own sequence and dates
    const receipt = await saveDraft(db, draftWith({ type: "recu", issueDate: "2026-01-15" }));
    expect((await finalizeDocument(db, receipt.id)).number).toBe("RE-2026-0001");
  });

  it("explains out-of-range amounts in French", async () => {
    const big = { ...draftWith().lines[0], quantityMilli: 1_000_000_000, unitPriceCentimes: 10_000_000_000_000 };
    const d = await saveDraft(db, draftWith({ lines: [big] }));
    await expect(finalizeDocument(db, d.id)).rejects.toThrow(/Montants trop élevés/);
  });

  it("refuses TVA lines when the business is not liable to TVA", async () => {
    await saveBusiness(db, { ...business, tvaLiable: false });
    const d = await saveDraft(db, draftWith());
    await expect(finalizeDocument(db, d.id)).rejects.toThrow(/assujettie/);
  });
});

describe("finalized documents are immutable", () => {
  it("cannot be saved over, modified or deleted", async () => {
    const d = await saveDraft(db, draftWith());
    const final = await finalizeDocument(db, d.id);

    await expect(saveDraft(db, { ...d, notes: "changed" })).rejects.toThrow();
    await expect(db.documents.update(final.id, { notes: "changed" })).rejects.toThrow();
    await expect(deleteDraft(db, final.id)).rejects.toThrow();
    await expect(finalizeDocument(db, final.id)).rejects.toThrow(/déjà/);
    expect((await db.documents.get(final.id))?.notes).toBe("");
  });

  it("can be duplicated into a new draft", async () => {
    const final = await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    const copy = duplicateAsDraft(final);
    expect(copy.id).not.toBe(final.id);
    expect(copy.status).toBe("draft");
    expect(copy.number).toBeNull();
    expect(copy.lines).toEqual(final.lines);
    copy.lines[0].designation = "edited";
    expect(final.lines[0].designation).toBe("Produit");
  });
});

describe("backup", () => {
  it("round-trips all data", async () => {
    await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    await saveDraft(db, draftWith());
    const backup = await exportBackup(db);

    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const other = new FaturaDb(`restore-${n++}`);
    await restoreBackup(other, parsed.backup);
    expect(await exportBackup(other, new Date(backup.exportedAt))).toEqual(backup);
    await other.delete();
  });

  it("restores over a database that already holds finalized documents", async () => {
    await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    const backup = await exportBackup(db);
    await finalizeDocument(db, (await saveDraft(db, draftWith())).id); // 2 finals now
    await restoreBackup(db, backup);
    expect(await db.documents.count()).toBe(1);
    // the immutability guard still applies after the restore
    const [final] = await db.documents.toArray();
    await expect(db.documents.delete(final.id)).rejects.toThrow();
  });

  it("never reissues a number already used after the backup was made", async () => {
    await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    const backup = await exportBackup(db);
    const second = await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    await restoreBackup(db, backup);
    const next = await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    expect(next.number).not.toBe(second.number);
    expect(next.number).toMatch(/-0003$/);
  });

  it("rejects a final document whose number does not match its type or year", async () => {
    await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    const backup = await exportBackup(db);
    for (const number of ["RE-2026-0001", "FA-1999-0001", "nimportequoi"]) {
      const bad = structuredClone(backup);
      bad.documents[0].number = number;
      const r = parseBackup(JSON.stringify(bad));
      expect(r.ok, number).toBe(false);
    }
  });

  it("rejects documents whose totals would overflow", async () => {
    const backup = await exportBackup(db);
    backup.documents.push({ ...draftWith(), lines: [{ ...draftWith().lines[0], quantityMilli: 1_000_000_000, unitPriceCentimes: 10_000_000_000_000 }] });
    const result = parseBackup(JSON.stringify(backup));
    expect(result.ok).toBe(false);
  });

  it("rejects invalid JSON, wrong format and bad values", () => {
    expect(parseBackup("{not json").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ format: "other" })).ok).toBe(false);
    const bad = { format: "faturadz-backup", version: 1, exportedAt: "", business: null, clients: [], products: [], documents: [], counters: [{ key: "x", last: -1 }] };
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
  });

  it("drops unknown and __proto__ keys instead of storing them", async () => {
    const backup = await exportBackup(db);
    const text = JSON.stringify(backup).replace('"id":"business"', '"id":"business","__proto__":{"polluted":true},"extra":"x"');
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Object.keys(parsed.backup.business!)).not.toContain("extra");
    expect(Object.prototype.hasOwnProperty.call(parsed.backup.business, "__proto__")).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects SVG or script logos", async () => {
    const backup = await exportBackup(db);
    backup.business!.logo = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(false);
    backup.business!.logo = "javascript:alert(1)";
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(false);
  });

  it("rejects duplicate document numbers", async () => {
    const final = await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    const backup = await exportBackup(db);
    backup.documents.push({ ...final, id: "other-id" });
    const result = parseBackup(JSON.stringify(backup));
    expect(result.ok).toBe(false);
  });

  it("raises stale counters to the highest number used", async () => {
    const final = await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    const backup = await exportBackup(db);
    backup.documents.push({ ...final, id: "other", number: "FA-2026-0007" });
    backup.counters = [];
    expect(reconcileCounters(backup)).toEqual([{ key: "facture-2026", last: 7 }]);
  });
});

describe("describeDbError", () => {
  it("explains quota, upgrade and unavailable-storage failures", () => {
    const named = (name: string) => Object.assign(new Error("x"), { name });
    expect(describeDbError(named("QuotaExceededError"))).toBe(fr.errors.storageFull);
    expect(describeDbError(named("VersionError"))).toBe(fr.errors.storageUpgrade);
    expect(describeDbError(named("DatabaseClosedError"))).toBe(fr.errors.storageUnavailable);
    // Dexie wraps the native error in `inner`
    expect(describeDbError(Object.assign(new Error("wrapped"), { name: "AbortError", inner: named("QuotaExceededError") }))).toBe(fr.errors.storageFull);
  });

  it("passes our own French messages through and hides unknown errors", () => {
    expect(describeDbError(new Error("Un document finalisé ne peut pas être modifié."))).toBe("Un document finalisé ne peut pas être modifié.");
    expect(describeDbError("boom")).toBe(fr.errors.generic);
    expect(describeDbError(null)).toBe(fr.errors.generic);
  });
});

describe("backup import safety", () => {
  const validBackup = async () => exportBackup(db);

  it("leaves existing data untouched when the restore fails midway", async () => {
    await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    const before = await exportBackup(db, new Date(0));
    const backup = await validBackup();
    // A duplicate key makes bulkAdd throw inside the restore transaction.
    backup.clients = [
      { id: "c1", name: "A", address: "", phone: "", email: "", nif: "", nis: "", rc: "", articleImposition: "", createdAt: 1 },
      { id: "c1", name: "B", address: "", phone: "", email: "", nif: "", nis: "", rc: "", articleImposition: "", createdAt: 2 },
    ];
    await expect(restoreBackup(db, backup)).rejects.toThrow();
    expect(await exportBackup(db, new Date(0))).toEqual(before);
  });

  it("rejects truncated, empty and non-object files without touching the database", async () => {
    const text = JSON.stringify(await validBackup());
    for (const bad of ["", "null", "[]", "42", '"str"', text.slice(0, text.length / 2)]) {
      const result = parseBackup(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("rejects tampered fields: wrong version, bad TVA rate, bad id, bad dates, bad status", async () => {
    await finalizeDocument(db, (await saveDraft(db, draftWith())).id);
    const base = JSON.parse(JSON.stringify(await validBackup()));
    const tamper = (mutate: (b: typeof base) => void) => {
      const copy = JSON.parse(JSON.stringify(base));
      mutate(copy);
      return parseBackup(JSON.stringify(copy)).ok;
    };
    expect(tamper(() => {})).toBe(true);
    expect(tamper((b) => (b.version = 2))).toBe(false);
    expect(tamper((b) => (b.documents[0].lines[0].tvaRateBp = 2100))).toBe(false);
    expect(tamper((b) => (b.documents[0].id = "../etc"))).toBe(false);
    expect(tamper((b) => (b.documents[0].issueDate = "2026-13-40"))).toBe(false);
    expect(tamper((b) => (b.documents[0].status = "paid"))).toBe(false);
    expect(tamper((b) => (b.documents[0].lines[0].unitPriceCentimes = 1.5))).toBe(false);
    expect(tamper((b) => (b.documents[0].lines[0].quantityMilli = 0))).toBe(false);
    expect(tamper((b) => (b.documents[0].number = null))).toBe(false);
    expect(tamper((b) => (b.documents[0].seller = null))).toBe(false);
    expect(tamper((b) => (b.business.defaultTvaRateBp = 5))).toBe(false);
  });

  it("rejects duplicate ids and oversized arrays of the wrong type", async () => {
    const backup = await validBackup();
    const client = { id: "c1", name: "A", address: "", phone: "", email: "", nif: "", nis: "", rc: "", articleImposition: "", createdAt: 1 };
    expect(parseBackup(JSON.stringify({ ...backup, clients: [client, client] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...backup, clients: "nope" })).ok).toBe(false);
  });

  it("rejects files above the size limit", () => {
    expect(parseBackup("x".repeat(MAX_BACKUP_BYTES + 1)).ok).toBe(false);
  });

  it("accepts a backup with no business profile and restores it as empty settings", async () => {
    const backup = { ...(await validBackup()), business: null };
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await restoreBackup(db, parsed.backup);
    expect(await db.settings.count()).toBe(0);
  });
});
