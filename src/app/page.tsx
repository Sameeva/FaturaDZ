"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { Button, EmptyState, IconButton, Notice, PageHeader, SearchField, Segmented, Skeleton, StatusBadge } from "@/components/ui";
import { useDbQuery } from "@/components/useDb";
import { getDb } from "@/db";
import { documentTotals, newDraft, saveDraft, todayIso } from "@/db/repository";
import type { FinalDocument, InvoiceDocument } from "@/db/schema";
import { fr } from "@/i18n/fr";
import { documentsToCsv } from "@/lib/csv";
import { downloadBlob } from "@/lib/download";
import { formatDA } from "@/lib/money";
import { summarizeMonth } from "@/lib/monthTotal";
import type { DocumentType } from "@/lib/numbering";
import { formatDateFr } from "@/pdf/model";

type Filter = "all" | DocumentType | "draft";
const filterOptions: { value: Filter; label: string }[] = [
  { value: "all", label: fr.dashboard.all },
  { value: "facture", label: fr.dashboard.factures },
  { value: "recu", label: fr.dashboard.recus },
  { value: "draft", label: fr.dashboard.drafts },
];

function netCentimes(doc: InvoiceDocument): number | null {
  try {
    return documentTotals(doc).netAPayerCentimes;
  } catch {
    return null;
  }
}

/** Net amount per document id, recomputed only when the documents change (not on each keystroke). */
function useNetAmounts(documents: InvoiceDocument[] | undefined): Map<string, number | null> {
  return useMemo(() => new Map((documents ?? []).map((d) => [d.id, netCentimes(d)])), [documents]);
}

export default function DashboardPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const documents = useDbQuery((db) => db.documents.orderBy("updatedAt").reverse().toArray());
  const business = useDbQuery(async (db) => (await db.settings.get("business")) ?? null);
  const nets = useNetAmounts(documents);

  async function create(type: DocumentType) {
    const draft = await saveDraft(getDb(), newDraft(type));
    router.push(`/documents/${draft.id}`);
  }

  const q = query.trim().toLowerCase();
  const visible = (documents ?? []).filter((d) => {
    if (filter === "draft" ? d.status !== "draft" : filter !== "all" && d.type !== filter) return false;
    return !q || d.client.name.toLowerCase().includes(q) || (d.number ?? "").toLowerCase().includes(q);
  });

  const finals = visible.filter((d): d is FinalDocument => d.status === "final");
  const exportCsv = () =>
    downloadBlob(new Blob([documentsToCsv(finals)], { type: "text/csv;charset=utf-8" }), `documents-${new Date().toISOString().slice(0, 10)}.csv`);

  const monthSummary = useMemo(() => {
    const entries = (documents ?? [])
      .filter((d) => d.status === "final" && d.type === "facture")
      .map((d) => ({ issueDate: d.issueDate, netCentimes: nets.get(d.id) ?? null }));
    try {
      return summarizeMonth(entries, todayIso().slice(0, 7));
    } catch {
      return null;
    }
  }, [documents, nets]);
  const draftCount = (documents ?? []).filter((d) => d.status === "draft").length;
  const monthLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={fr.dashboard.title}
        subtitle={documents ? `${documents.length} ${fr.dashboard.documentsCount}` : undefined}
        actions={
          <>
            <IconButton icon="download" label={fr.dashboard.exportCsv} onClick={exportCsv} disabled={finals.length === 0} />
            <Button variant="primary" icon="plus" size="lg" onClick={() => setCreating(true)}>
              {fr.dashboard.newDocument}
            </Button>
          </>
        }
      />

      {business === null && (
        <Notice tone="warn">
          {fr.dashboard.setupFirst}{" "}
          <Link href="/settings" className="font-bold underline">
            {fr.dashboard.goSettings}
          </Link>
        </Notice>
      )}

      {documents && documents.length > 0 && (
        <section aria-label="Résumé" className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)]">
            <p className="text-sm font-semibold text-muted">{fr.dashboard.finalizedThisMonth}</p>
            <p className="mt-1 font-display text-2xl leading-tight font-bold tabular-nums">
              {monthSummary ? formatDA(monthSummary.totalCentimes) : "—"}
            </p>
            <p className="mt-0.5 text-sm text-muted capitalize">
              {monthLabel} · {monthSummary?.count ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-warn/70 bg-warn-soft/50 p-4">
            <p className="text-sm font-semibold text-warn">{fr.dashboard.drafts}</p>
            <p className="mt-1 font-display text-2xl leading-tight font-bold tabular-nums">{draftCount}</p>
            <p className="mt-0.5 text-sm text-muted">{fr.dashboard.draftsToFinish}</p>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3">
        <SearchField label={fr.common.search} placeholder={fr.dashboard.searchPlaceholder} value={query} onChange={setQuery} />
        <Segmented label={fr.dashboard.filterLabel} value={filter} options={filterOptions} onChange={setFilter} />
      </div>

      {!documents && (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Chargement">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}

      {documents && documents.length === 0 && (
        <EmptyState
          title="Aucun document pour l'instant"
          text={fr.dashboard.empty}
          action={
            <Button variant="primary" size="lg" icon="plus" onClick={() => setCreating(true)}>
              {fr.doc.newFacture}
            </Button>
          }
        />
      )}
      {documents && documents.length > 0 && visible.length === 0 && <p className="py-6 text-center text-muted">{fr.dashboard.noMatch}</p>}

      <ul className="flex flex-col gap-3">
        {visible.map((d, i) => {
          const net = nets.get(d.id);
          return (
            <li key={d.id} className="rise" data-i={i}>
              <Link
                href={`/documents/${d.id}`}
                className="press flex min-h-[4.75rem] items-center gap-3.5 rounded-2xl border border-border bg-surface p-3.5 shadow-[var(--shadow)] hover:border-border-strong"
              >
                <span
                  aria-hidden="true"
                  className={`hidden size-12 shrink-0 place-items-center rounded-xl min-[400px]:grid ${d.status === "draft" ? "border border-dashed border-warn bg-warn-soft text-warn" : "bg-accent-soft text-accent"}`}
                >
                  <Icon name={d.type === "facture" ? "invoice" : "receipt"} size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-base font-semibold whitespace-nowrap">
                    {d.number ?? fr.docType[d.type]}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {d.number ? `${fr.docType[d.type]} · ` : ""}
                    {d.client.name || "Client non renseigné"}
                  </span>
                  <span className="block text-sm text-muted">{formatDateFr(d.issueDate)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-display text-base font-bold whitespace-nowrap tabular-nums">{net == null ? "—" : formatDA(net)}</span>
                  <StatusBadge status={d.status} label={fr.status[d.status]} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Sheet open={creating} onClose={() => setCreating(false)} title={fr.dashboard.newDocumentTitle}>
        <div className="flex flex-col gap-3">
          {(
            [
              { type: "facture", icon: "invoice", label: fr.doc.newFacture, hint: fr.dashboard.factureHint },
              { type: "recu", icon: "receipt", label: fr.doc.newRecu, hint: fr.dashboard.recuHint },
            ] as const
          ).map((o) => (
            <button
              key={o.type}
              type="button"
              onClick={() => create(o.type)}
              className="press flex min-h-[4.5rem] items-center gap-4 rounded-2xl border border-border-strong bg-surface p-4 text-start"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon name={o.icon} size={24} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-semibold">{o.label}</span>
                <span className="block text-sm text-muted">{o.hint}</span>
              </span>
              <Icon name="chevron" className="text-muted rtl:rotate-180" />
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
