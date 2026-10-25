"use client";

import { useState } from "react";
import { tvaOptions } from "@/components/BusinessForm";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { Button, EmptyState, IconButton, Notice, PageHeader, SearchField, SelectField, Skeleton, TextField } from "@/components/ui";
import { useDbQuery } from "@/components/useDb";
import { getDb } from "@/db";
import { describeDbError } from "@/db/errors";
import { newId, saveProduct } from "@/db/repository";
import type { Product } from "@/db/schema";
import { fr } from "@/i18n/fr";
import type { TvaRateBp } from "@/lib/fiscal-config";
import { MAX_UNIT_PRICE_CENTIMES, amountToInput, formatDA, formatPercent, parseAmount } from "@/lib/money";

function ProductForm({ initial, defaultRate, onDone }: { initial: Product | null; defaultRate: TvaRateBp; onDone: () => void }) {
  const [designation, setDesignation] = useState(initial?.designation ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [price, setPrice] = useState(initial ? amountToInput(initial.unitPriceCentimes) : "");
  const [rate, setRate] = useState<TvaRateBp>(initial?.tvaRateBp ?? defaultRate);
  const [error, setError] = useState<string | null>(null);

  const designationError = designation.trim() === "" ? fr.errors.required : null;
  const priceCentimes = parseAmount(price, MAX_UNIT_PRICE_CENTIMES);
  const priceError = priceCentimes === null ? fr.errors.amount : null;

  async function onSave() {
    if (designationError || priceCentimes === null) return;
    try {
      await saveProduct(getDb(), {
        id: initial?.id ?? newId(),
        designation,
        unit,
        unitPriceCentimes: priceCentimes,
        tvaRateBp: rate,
        createdAt: initial?.createdAt ?? Date.now(),
      });
      onDone();
    } catch (e) {
      setError(describeDbError(e));
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <TextField label={fr.fields.designation} value={designation} onChange={setDesignation} error={designationError} required />
        </div>
        <TextField label={fr.fields.unit} value={unit} onChange={setUnit} placeholder="u, kg, h…" />
        <TextField label={fr.fields.unitPrice} value={price} onChange={setPrice} error={price === "" ? null : priceError} inputMode="decimal" />
        <SelectField
          label={fr.fields.tvaRate}
          value={String(rate) as `${TvaRateBp}`}
          options={tvaOptions}
          onChange={(v) => setRate(Number(v) as TvaRateBp)}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onSave} disabled={Boolean(designationError || priceError)}>
          {fr.common.save}
        </Button>
        <Button onClick={onDone}>{fr.common.cancel}</Button>
      </div>
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
    </div>
  );
}

export default function ProductsPage() {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ key: string; product: Product | null } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const products = useDbQuery((db) => db.products.orderBy("designation").toArray());
  const business = useDbQuery((db) => db.settings.get("business"));
  const defaultRate: TvaRateBp = business ? (business.tvaLiable ? business.defaultTvaRateBp : 0) : 1900;

  const q = query.trim().toLowerCase();
  const visible = (products ?? []).filter((p) => !q || p.designation.toLowerCase().includes(q));
  const openForm = (product: Product | null) => {
    setEditing({ key: product?.id ?? newId(), product });
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={fr.nav.products}
        subtitle={products ? `${products.length} produit${products.length > 1 ? "s" : ""}` : undefined}
        actions={
          <Button variant="primary" size="lg" icon="plus" onClick={() => openForm(null)}>
            {fr.common.add}
          </Button>
        }
      />
      <SearchField label={fr.common.search} value={query} onChange={setQuery} />
      {!products && (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}
      {products && products.length === 0 && <EmptyState title="Aucun produit" text={fr.common.none} />}
      {products && products.length > 0 && visible.length === 0 && <p className="py-6 text-center text-muted">{fr.dashboard.noMatch}</p>}
      <ul className="flex flex-col gap-3">
        {visible.map((p) => (
          <li key={p.id} className="rise flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-[var(--shadow)]">
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Icon name="products" size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold">{p.designation}</p>
              <p className="text-sm text-muted tabular-nums">
                {formatDA(p.unitPriceCentimes)} HT{p.unit && ` / ${p.unit}`} · TVA {formatPercent(p.tvaRateBp)}
              </p>
            </div>
            <IconButton icon="edit" label={`${fr.common.edit} ${p.designation}`} onClick={() => openForm(p)} />
            <IconButton icon="trash" label={`${fr.common.delete} ${p.designation}`} variant="danger" onClick={() => setToDelete(p)} />
          </li>
        ))}
      </ul>

      <Sheet open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} title={editing?.product ? editing.product.designation : "Nouveau produit"}>
        {editing && <ProductForm key={editing.key} initial={editing.product} defaultRate={defaultRate} onDone={() => setFormOpen(false)} />}
      </Sheet>
      <ConfirmSheet
        open={toDelete !== null}
        title={fr.common.delete}
        confirmLabel={fr.common.delete}
        tone="danger"
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const p = toDelete;
          setToDelete(null);
          if (p) await getDb().products.delete(p.id);
        }}
      >
        <p>{toDelete ? `${toDelete.designation} : ` : ""}{fr.common.confirmDelete}</p>
      </ConfirmSheet>
    </div>
  );
}
