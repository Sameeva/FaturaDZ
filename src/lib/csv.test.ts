import { describe, expect, it } from "vitest";
import { csvCell, documentsToCsv } from "./csv";
import type { FinalDocument } from "@/db/schema";

const doc = (over: Partial<FinalDocument>): FinalDocument =>
  ({
    id: "1",
    type: "facture",
    status: "final",
    number: "FA-2026-0001",
    issueDate: "2026-03-10",
    dueDate: null,
    client: { name: "Client; SPA", address: "", phone: "", email: "", nif: "000016001234567", nis: "", rc: "", articleImposition: "" },
    lines: [{ designation: "P", unit: "u", quantityMilli: 1000, unitPriceCentimes: 100000, discountBp: 0, tvaRateBp: 1900 }],
    paymentMethod: "virement",
    applyTimbre: false,
    notes: "",
    createdAt: 0,
    updatedAt: 0,
    finalizedAt: 0,
    seller: {} as FinalDocument["seller"],
    ...over,
  }) as FinalDocument;

describe("csvCell", () => {
  it("quotes separators, quotes and newlines", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("plain")).toBe("plain");
  });
  it("defuses spreadsheet formulas", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });
});

describe("documentsToCsv", () => {
  it("writes a BOM, a header and one row per document with decimal-comma amounts", () => {
    const lines = documentsToCsv([doc({})]).replace("﻿", "").trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("Numéro;Type;Date;Client;NIF client;Total HT;TVA;Timbre;Net à payer");
    expect(lines[1]).toBe('FA-2026-0001;Facture;10/03/2026;"Client; SPA";000016001234567;1000,00;190,00;0,00;1190,00');
  });
  it("sorts by date then number", () => {
    const out = documentsToCsv([doc({ number: "FA-2026-0002", issueDate: "2026-04-01" }), doc({})]);
    expect(out.indexOf("FA-2026-0001")).toBeLessThan(out.indexOf("FA-2026-0002"));
  });
});
