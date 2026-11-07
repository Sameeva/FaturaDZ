"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { Icon } from "@/components/icons";
import { Odometer } from "@/components/Odometer";
import { Button, Card, Checkbox, IconButton, Notice, PageHeader, SelectField, StatusBadge, TextArea, TextField } from "@/components/ui";
import { useDbQuery } from "@/components/useDb";
import { tvaOptions } from "@/components/BusinessForm";
import { getDb } from "@/db";
import { describeDbError } from "@/db/errors";
import { deleteDraft, finalizeDocument, newId, saveDraft, sellerFromBusiness } from "@/db/repository";
import type { Business, ClientSnapshot, DocumentLine, DraftDocument } from "@/db/schema";
import { fr } from "@/i18n/fr";
import type { TvaRateBp } from "@/lib/fiscal-config";
import { amountToInput, formatAmount, formatDA } from "@/lib/money";
import { computeTotals, type PaymentMethod, type Totals } from "@/lib/tax";
import { checkArticleImposition, checkNif, checkNis, checkRc } from "@/lib/validators";
import { downloadDocumentPdf } from "@/pdf/download";
import { checkClientForFinalization } from "@/lib/validations/client";
import { parseEditorLine, toEditorLine, type EditorLine } from "./lines";
import { TotalsPanel } from "./TotalsPanel";

const paymentOptions = (Object.keys(fr.payment) as PaymentMethod[]).map((p) => ({ value: p, label: fr.payment[p] }));
type ClientKey = keyof ClientSnapshot;

const AUTOSAVE_MS = 600;

export function DraftEditor({ initial, business }: { initial: DraftDocument; business: Business | null }) {
  const router = useRouter();
  const tvaLiable = business?.tvaLiable ?? true;
  const defaultRate: TvaRateBp = tvaLiable ? (business?.defaultTvaRateBp ?? 1900) : 0;

  const [meta, setMeta] = useState(() => ({
    issueDate: initial.issueDate,
    dueDate: initial.dueDate ?? "",
    paymentMethod: initial.paymentMethod,
    applyTimbre: initial.applyTimbre,
    notes: initial.notes,
  }));
  const [client, setClient] = useState<ClientSnapshot>(initial.client);
  // A business not liable to TVA can only use 0 % (the rate selector is locked).
  const [lines, setLines] = useState<EditorLine[]>(() =>
    initial.lines.map((l) => toEditorLine(tvaLiable ? l : { ...l, tvaRateBp: 0 }, newId())),
  );
  const [status, setStatus] = useState<{ tone: "info" | "danger" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"finalize" | "delete" | null>(null);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify({ ...initial, updatedAt: 0 }));
  const rootRef = useRef<HTMLDivElement>(null);

  const clients = useDbQuery((db) => db.clients.orderBy("name").toArray());
  const products = useDbQuery((db) => db.products.orderBy("designation").toArray());

  // Parse every line; the draft is only saved when all lines are valid.
  const parsed = useMemo(() => lines.map(parseEditorLine), [lines]);
  const validLines = parsed.every((p) => p.line !== null) ? parsed.map((p) => p.line as DocumentLine) : null;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(meta.issueDate) && (meta.dueDate === "" || /^\d{4}-\d{2}-\d{2}$/.test(meta.dueDate));

  const draft: DraftDocument | null =
    validLines && dateValid
      ? {
          ...initial,
          issueDate: meta.issueDate,
          dueDate: meta.dueDate || null,
          paymentMethod: meta.paymentMethod,
          applyTimbre: meta.applyTimbre,
          notes: meta.notes,
          client,
          lines: validLines,
        }
      : null;

  let totals: Totals | null = null;
  let totalsError: string | null = null;
  if (validLines) {
    try {
      totals = computeTotals(validLines, { paymentMethod: meta.paymentMethod, applyTimbre: meta.applyTimbre });
    } catch {
      totalsError = "Montants trop élevés.";
    }
  }

  // Debounced autosave of the latest valid draft.
  const draftJson = draft ? JSON.stringify({ ...draft, updatedAt: 0 }) : null;
  const lastSavedJson = useRef(JSON.stringify({ ...initial, updatedAt: 0 }));
  const finalizing = useRef(false);

  const saving = draftJson !== null && draftJson !== savedJson;

  useEffect(() => {
    if (!draftJson || draftJson === lastSavedJson.current) return;
    const timer = setTimeout(() => {
      if (finalizing.current) return;
      saveDraft(getDb(), JSON.parse(draftJson) as DraftDocument)
        .then(() => {
          lastSavedJson.current = draftJson;
          setSavedJson(draftJson);
        })
        .catch((e) => {
          setStatus({ tone: "danger", text: describeDbError(e) });
        });
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draftJson]);

  const updateLine = (key: string, patch: Partial<EditorLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = (from?: Partial<EditorLine>) =>
    setLines((ls) => [...ls, { key: newId(), designation: "", unit: "", quantity: "1", unitPrice: "", discount: "", tvaRateBp: defaultRate, ...from }]);

  function pickProduct(id: string) {
    const p = products?.find((x) => x.id === id);
    if (!p) return;
    addLine({ designation: p.designation, unit: p.unit, unitPrice: amountToInput(p.unitPriceCentimes), tvaRateBp: tvaLiable ? p.tvaRateBp : 0 });
  }

  function pickClient(id: string) {
    const c = clients?.find((x) => x.id === id);
    if (!c) return;
    setClient({ name: c.name, address: c.address, phone: c.phone, email: c.email, nif: c.nif, nis: c.nis, rc: c.rc, articleImposition: c.articleImposition });
  }

  const finalizeWarnings = draft && draft.type === "facture" ? checkClientForFinalization(draft.client).warnings : [];

  async function doFinalize() {
    if (!draft) return;
    setConfirm(null);
    setBusy(true);
    finalizing.current = true;
    try {
      await saveDraft(getDb(), draft); // flush the latest edits first
      await finalizeDocument(getDb(), draft.id);
      // The page re-renders with the finalized view (live query).
    } catch (e) {
      finalizing.current = false;
      setStatus({ tone: "danger", text: describeDbError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function onPreview() {
    if (!draft || !business) return;
    try {
      await downloadDocumentPdf(draft, sellerFromBusiness(business));
    } catch {
      setStatus({ tone: "danger", text: fr.errors.generic });
    }
  }

  async function doDelete() {
    setConfirm(null);
    finalizing.current = true; // stop autosave from recreating the draft
    try {
      await deleteDraft(getDb(), initial.id);
      router.push("/");
    } catch (e) {
      finalizing.current = false;
      setStatus({ tone: "danger", text: describeDbError(e) });
    }
  }

  // Hide the sticky bar while a text field has focus (keyboard open on a phone), without re-rendering.
  const isText = (t: EventTarget | null) =>
    t instanceof HTMLInputElement ? !["radio", "checkbox", "button", "submit"].includes(t.type) : t instanceof HTMLTextAreaElement;
  const onFocusCapture = (e: React.FocusEvent) => {
    if (isText(e.target)) rootRef.current?.setAttribute("data-typing", "");
  };
  const onBlurCapture = (e: React.FocusEvent) => {
    if (!isText(e.relatedTarget)) rootRef.current?.removeAttribute("data-typing");
  };

  const clientField = (key: ClientKey, label: string, warning?: string | null) => (
    <TextField label={label} value={client[key]} onChange={(v) => setClient((c) => ({ ...c, [key]: v }))} warning={warning} />
  );

  const netCentimes = totals?.netAPayerCentimes ?? null;
  const canFinalize = Boolean(draft) && draft!.lines.length > 0 && !busy && !totalsError;

  return (
    <div ref={rootRef} className="flex flex-col gap-5 md:pb-16" onFocusCapture={onFocusCapture} onBlurCapture={onBlurCapture}>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {fr.docType[initial.type]}
            <StatusBadge status="draft" label={fr.status.draft} />
          </span>
        }
        subtitle={
          <span className="inline-flex items-center gap-1.5" role="status">
            {!draft ? (
              <span className="text-danger">{fr.doc.unsavedShort}</span>
            ) : saving ? (
              fr.doc.savingShort
            ) : (
              <>
                <Icon name="check" size={14} strokeWidth={2.6} className="text-accent" />
                {fr.doc.savedShort}
              </>
            )}
          </span>
        }
        actions={
          <>
            <Button icon="download" onClick={onPreview} disabled={!draft || !business}>
              Aperçu PDF
            </Button>
            <IconButton icon="trash" label={fr.doc.deleteDraft} variant="danger" onClick={() => setConfirm("delete")} />
          </>
        }
      />

      {!business && <Notice tone="warn">{fr.dashboard.setupFirst}</Notice>}
      {status && <Notice tone={status.tone}>{status.text}</Notice>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={initial.type === "facture" ? fr.fields.client : `${fr.doc.received} (facultatif)`}>
          {clients && clients.length > 0 && (
            <div className="mb-3">
              <SelectField
                label={fr.doc.fromClient}
                value=""
                options={[{ value: "", label: "—" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
                onChange={pickClient}
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {clientField("name", fr.fields.name)}
            {clientField("address", fr.fields.address)}
            {clientField("phone", fr.fields.phone)}
            {clientField("email", fr.fields.email)}
            {initial.type === "facture" && (
              <>
                {clientField("nif", fr.fields.nif, checkNif(client.nif))}
                {clientField("nis", fr.fields.nis, checkNis(client.nis))}
                {clientField("rc", fr.fields.rc, checkRc(client.rc))}
                {clientField("articleImposition", fr.fields.articleImposition, checkArticleImposition(client.articleImposition))}
              </>
            )}
          </div>
        </Card>

        <Card title="Informations">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label={fr.fields.issueDate} type="date" value={meta.issueDate} onChange={(v) => setMeta((m) => ({ ...m, issueDate: v }))} error={dateValid ? null : fr.errors.required} required />
            {initial.type === "facture" && (
              <TextField label={fr.fields.dueDate} type="date" value={meta.dueDate} onChange={(v) => setMeta((m) => ({ ...m, dueDate: v }))} />
            )}
            <SelectField label={fr.fields.paymentMethod} value={meta.paymentMethod} options={paymentOptions} onChange={(v) => setMeta((m) => ({ ...m, paymentMethod: v }))} />
          </div>
          <div className="mt-3">
            <Checkbox
              label={fr.fields.applyTimbre}
              checked={meta.applyTimbre}
              disabled={meta.paymentMethod !== "especes"}
              onChange={(v) => setMeta((m) => ({ ...m, applyTimbre: v }))}
              hint={fr.doc.timbreHint}
            />
          </div>
          <div className="mt-3">
            <TextArea label={fr.fields.notes} value={meta.notes} onChange={(v) => setMeta((m) => ({ ...m, notes: v }))} maxLength={1000} />
          </div>
        </Card>
      </div>

      <Card title="Lignes">
        {lines.length === 0 && <p className="mb-3 text-muted">{fr.doc.emptyLines}</p>}
        <ol className="flex flex-col gap-3">
          {lines.map((l, i) => {
            const errors = parsed[i].errors;
            const lineTotal = totals ? totals.lineHTCentimes[i] : null;
            return (
              <li key={l.key} className="rounded-xl border border-border bg-background/60 p-3 md:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="font-display font-semibold text-muted">Ligne {i + 1}</span>
                  <span className="ms-auto font-display font-bold tabular-nums">{lineTotal != null ? formatDA(lineTotal) : ""}</span>
                  <IconButton icon="trash" label={`Supprimer la ligne ${i + 1}`} variant="danger" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} />
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                  <div className="col-span-2 md:col-span-6">
                    <TextField label={fr.fields.designation} value={l.designation} onChange={(v) => updateLine(l.key, { designation: v })} maxLength={300} />
                  </div>
                  <div className="md:col-span-1">
                    <TextField label={fr.fields.quantity} value={l.quantity} onChange={(v) => updateLine(l.key, { quantity: v })} inputMode="decimal" error={errors?.quantity ? fr.errors.quantity : null} />
                  </div>
                  <div className="md:col-span-1">
                    <TextField label={fr.fields.unit} value={l.unit} onChange={(v) => updateLine(l.key, { unit: v })} maxLength={20} />
                  </div>
                  <div className="col-span-2 md:col-span-2">
                    <TextField label={fr.fields.unitPrice} value={l.unitPrice} onChange={(v) => updateLine(l.key, { unitPrice: v })} inputMode="decimal" error={errors?.unitPrice ? fr.errors.amount : null} />
                  </div>
                  <div className="md:col-span-1">
                    <TextField label={fr.fields.discount} value={l.discount} onChange={(v) => updateLine(l.key, { discount: v })} inputMode="decimal" error={errors?.discount ? fr.errors.percent : null} />
                  </div>
                  <div className="md:col-span-1">
                    <SelectField
                      label={fr.fields.tvaRate}
                      value={String(l.tvaRateBp) as `${TvaRateBp}`}
                      options={tvaOptions}
                      disabled={!tvaLiable}
                      onChange={(v) => updateLine(l.key, { tvaRateBp: Number(v) as TvaRateBp })}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Button variant="primary" icon="plus" size="lg" onClick={() => addLine()}>
            {fr.doc.addLine}
          </Button>
          {products && products.length > 0 && (
            <div className="sm:min-w-64">
              <SelectField
                label={fr.doc.fromProduct}
                value=""
                options={[{ value: "", label: "—" }, ...products.map((p) => ({ value: p.id, label: p.designation }))]}
                onChange={pickProduct}
              />
            </div>
          )}
        </div>
      </Card>

      {totalsError && <Notice tone="danger">{totalsError}</Notice>}
      {totals && <TotalsPanel totals={totals} type={initial.type} />}

      {/* Sticky action bar: the net amount rolls as you type, the one primary action stays in reach. */}
      <div className="editor-bar fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_28px_-18px_rgb(0_0_0/0.4)]">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 md:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-wider text-muted uppercase">{fr.totals.net}</p>
            <p className="font-display text-2xl leading-tight font-bold md:text-3xl">
              {netCentimes !== null ? <Odometer text={formatAmount(netCentimes)} label={formatDA(netCentimes)} /> : "—"}
            </p>
          </div>
          <Button variant="primary" size="lg" icon="lock" onClick={() => setConfirm("finalize")} disabled={!canFinalize} className="min-w-40">
            {fr.doc.finalize}
          </Button>
        </div>
      </div>

      <ConfirmSheet
        open={confirm === "finalize"}
        title={fr.doc.finalizeTitle}
        confirmLabel={fr.doc.finalize}
        busy={busy}
        onConfirm={doFinalize}
        onCancel={() => setConfirm((c) => (c === "finalize" ? null : c))}
      >
        {finalizeWarnings.length > 0 && (
          <div className="mb-3 rounded-xl border border-warn/60 bg-warn-soft p-3 text-warn">
            <p className="mb-1 font-bold">{fr.doc.finalizeCheck}</p>
            <ul className="list-disc ps-5">
              {finalizeWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        <p>{fr.doc.finalizeBody}</p>
      </ConfirmSheet>

      <ConfirmSheet
        open={confirm === "delete"}
        title={fr.doc.deleteDraft}
        confirmLabel={fr.common.delete}
        tone="danger"
        onConfirm={doDelete}
        onCancel={() => setConfirm((c) => (c === "delete" ? null : c))}
      >
        <p>{fr.doc.deleteDraftConfirm}</p>
      </ConfirmSheet>
    </div>
  );
}
