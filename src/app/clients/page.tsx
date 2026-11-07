"use client";

import { useState } from "react";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { Sheet } from "@/components/Sheet";
import { Button, EmptyState, IconButton, Notice, PageHeader, SearchField, Skeleton, TextField } from "@/components/ui";
import { useDbQuery } from "@/components/useDb";
import { getDb } from "@/db";
import { describeDbError } from "@/db/errors";
import { newId, saveClient } from "@/db/repository";
import type { Client } from "@/db/schema";
import { fr } from "@/i18n/fr";
import { checkArticleImposition, checkNif, checkNis, checkRc } from "@/lib/validators";

type EditableKey = "name" | "address" | "phone" | "email" | "nif" | "nis" | "rc" | "articleImposition";

const emptyClient = (): Client => ({
  id: newId(),
  name: "",
  address: "",
  phone: "",
  email: "",
  nif: "",
  nis: "",
  rc: "",
  articleImposition: "",
  createdAt: Date.now(),
});

function ClientForm({ initial, onDone }: { initial: Client; onDone: () => void }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (key: EditableKey, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const field = (key: EditableKey, warning?: string | null) => (
    <TextField label={fr.fields[key]} value={form[key]} onChange={(v) => set(key, v)} warning={warning} />
  );
  const nameError = form.name.trim() === "" ? fr.errors.required : null;

  async function onSave() {
    if (nameError) return;
    try {
      await saveClient(getDb(), form);
      onDone();
    } catch (e) {
      setError(describeDbError(e));
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={fr.fields.name} value={form.name} onChange={(v) => set("name", v)} error={nameError} required />
        {field("address")}
        {field("phone")}
        {field("email")}
        {field("nif", checkNif(form.nif))}
        {field("nis", checkNis(form.nis))}
        {field("rc", checkRc(form.rc))}
        {field("articleImposition", checkArticleImposition(form.articleImposition))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onSave} disabled={Boolean(nameError)}>
          {fr.common.save}
        </Button>
        <Button onClick={onDone}>{fr.common.cancel}</Button>
      </div>
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const letters = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft font-display text-lg font-bold text-accent">
      {letters || "?"}
    </span>
  );
}

export default function ClientsPage() {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const clients = useDbQuery((db) => db.clients.orderBy("name").toArray());

  const q = query.trim().toLowerCase();
  const visible = (clients ?? []).filter((c) => !q || c.name.toLowerCase().includes(q) || c.nif.includes(q));
  const openForm = (c: Client) => {
    setEditing(c);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={fr.nav.clients}
        subtitle={clients ? `${clients.length} client${clients.length > 1 ? "s" : ""}` : undefined}
        actions={
          <Button variant="primary" size="lg" icon="plus" onClick={() => openForm(emptyClient())}>
            {fr.common.add}
          </Button>
        }
      />
      <SearchField label={fr.common.search} value={query} onChange={setQuery} />
      {!clients && (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}
      {clients && clients.length === 0 && <EmptyState title="Aucun client" text={fr.common.none} />}
      {clients && clients.length > 0 && visible.length === 0 && <p className="py-6 text-center text-muted">{fr.dashboard.noMatch}</p>}
      <ul className="flex flex-col gap-3">
        {visible.map((c) => (
          <li key={c.id} className="rise flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-[var(--shadow)]">
            <Avatar name={c.name} />
            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold">{c.name}</p>
              <p className="truncate text-sm text-muted">{[c.address, c.nif && `${fr.fiscalShort.nif} ${c.nif}`].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            <IconButton icon="edit" label={`${fr.common.edit} ${c.name}`} onClick={() => openForm(c)} />
            <IconButton icon="trash" label={`${fr.common.delete} ${c.name}`} variant="danger" onClick={() => setToDelete(c)} />
          </li>
        ))}
      </ul>

      <Sheet open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} title={editing?.name ? editing.name : "Nouveau client"}>
        {editing && <ClientForm key={editing.id} initial={editing} onDone={() => setFormOpen(false)} />}
      </Sheet>
      <ConfirmSheet
        open={toDelete !== null}
        title={fr.common.delete}
        confirmLabel={fr.common.delete}
        tone="danger"
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          const c = toDelete;
          setToDelete(null);
          if (c) await getDb().clients.delete(c.id);
        }}
      >
        <p>{toDelete ? `${toDelete.name} : ` : ""}{fr.common.confirmDelete}</p>
      </ConfirmSheet>
    </div>
  );
}
