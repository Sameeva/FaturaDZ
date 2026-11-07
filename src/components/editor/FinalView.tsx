"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Card, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { documentTotals, duplicateAsDraft, saveDraft } from "@/db/repository";
import type { FinalDocument } from "@/db/schema";
import { fr } from "@/i18n/fr";
import { formatAmount, formatPercent, formatQuantity } from "@/lib/money";
import { downloadDocumentPdf } from "@/pdf/download";
import { buildPdfModel, formatDateFr } from "@/pdf/model";
import { InvoicePreview } from "@/components/invoice/InvoicePreview";
import { InvoicePrint } from "@/components/invoice/InvoicePrint";
import { TotalsPanel } from "./TotalsPanel";

export function FinalView({ doc }: { doc: FinalDocument }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Stored documents are validated on import, but never let bad data crash the page.
  let totals: ReturnType<typeof documentTotals> | null = null;
  try {
    totals = documentTotals(doc);
  } catch {
    totals = null;
  }

  const printModel = totals ? buildPdfModel(doc, doc.seller) : null;

  async function onDownload() {
    try {
      await downloadDocumentPdf(doc, doc.seller);
    } catch {
      setError(fr.errors.generic);
    }
  }

  async function onDuplicate() {
    const copy = await saveDraft(getDb(), duplicateAsDraft(doc));
    router.push(`/documents/${copy.id}`);
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {fr.docType[doc.type]} {doc.number}
              <StatusBadge status="final" label={fr.status.final} />
            </span>
          }
          subtitle={`${formatDateFr(doc.issueDate)} · ${doc.client.name || "Client non renseigné"}`}
          actions={
            <>
              <Button icon="copy" onClick={onDuplicate}>
                {fr.doc.duplicate}
              </Button>
              <Button icon="print" onClick={() => window.print()} disabled={!totals}>
                {fr.doc.print}
              </Button>
              <Button variant="primary" icon="download" onClick={onDownload}>
                {fr.doc.download}
              </Button>
            </>
          }
        />
        <p className="flex items-start gap-2 text-sm text-muted">
          <Icon name="lock" size={16} className="mt-0.5 shrink-0" />
          {fr.doc.locked}
        </p>
        {error && <Notice tone="danger">{error}</Notice>}
        {!totals && <Notice tone="danger">Montants hors limites : ce document ne peut pas être calculé.</Notice>}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          {printModel && (
            <section aria-label={fr.doc.previewTitle} className="hidden lg:block">
              <InvoicePreview model={printModel} />
            </section>
          )}

          <div className="flex flex-col gap-5">
            <Card>
              <dl className="grid gap-3 text-[0.9375rem]">
                <div>
                  <dt className="text-sm font-semibold text-muted">{fr.fields.client}</dt>
                  <dd className="font-medium">{doc.client.name || "—"}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-sm font-semibold text-muted">{fr.fields.issueDate}</dt>
                    <dd className="font-medium">{formatDateFr(doc.issueDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-muted">{fr.fields.paymentMethod}</dt>
                    <dd className="font-medium">{fr.payment[doc.paymentMethod]}</dd>
                  </div>
                </div>
              </dl>
            </Card>

            <Card title="Lignes" className="lg:hidden">
              <ul className="divide-y divide-border">
                {doc.lines.map((l, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium">{l.designation}</p>
                      <p className="text-sm text-muted tabular-nums">
                        {formatQuantity(l.quantityMilli)} {l.unit} × {formatAmount(l.unitPriceCentimes)}
                        {l.discountBp ? ` · −${formatPercent(l.discountBp)}` : ""} · {fr.fields.tvaRate} {formatPercent(l.tvaRateBp)}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">{totals ? formatAmount(totals.lineHTCentimes[i]) : "—"}</p>
                  </li>
                ))}
              </ul>
            </Card>

            {totals && <TotalsPanel totals={totals} type={doc.type} />}
          </div>
        </div>
      </div>
      {printModel && <InvoicePrint model={printModel} />}
    </>
  );
}
