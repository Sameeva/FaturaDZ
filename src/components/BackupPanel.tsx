"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { getDb } from "@/db";
import { describeDbError } from "@/db/errors";
import { exportBackup, findFinalsMissingFromBackup, MAX_BACKUP_BYTES, parseBackup, restoreBackup } from "@/db/backup";
import type { Backup } from "@/db/schema";
import { todayIso } from "@/db/repository";
import { fr } from "@/i18n/fr";
import { downloadBlob } from "@/lib/download";
import { ConfirmSheet } from "./ConfirmSheet";
import { Button, Card, Notice } from "./ui";

const RESTORED_KEY = "faturadz:restored";

export function BackupPanel() {
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  // A restore reloads the page; the confirmation survives the reload through sessionStorage.
  useEffect(() => {
    if (sessionStorage.getItem(RESTORED_KEY)) {
      sessionStorage.removeItem(RESTORED_KEY);
      queueMicrotask(() => setMessage({ tone: "success", text: fr.backup.imported }));
    }
  }, []);

  async function onExport() {
    try {
      const backup = await exportBackup(getDb());
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      downloadBlob(blob, `faturadz-sauvegarde-${todayIso()}.json`);
    } catch (e) {
      setMessage({ tone: "danger", text: describeDbError(e) });
    }
  }

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setMessage({ tone: "danger", text: "Fichier trop volumineux." });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setMessage({ tone: "danger", text: fr.errors.generic });
      return;
    }
    const result = parseBackup(text);
    if (!result.ok) {
      setMessage({ tone: "danger", text: result.error });
      return;
    }
    try {
      setMissing(await findFinalsMissingFromBackup(getDb(), result.backup));
    } catch (err) {
      setMessage({ tone: "danger", text: describeDbError(err) });
      return;
    }
    setPending(result.backup);
  }

  async function doRestore() {
    const backup = pending;
    setPending(null);
    if (!backup) return;
    try {
      await restoreBackup(getDb(), backup);
      sessionStorage.setItem(RESTORED_KEY, "1");
      window.location.reload();
    } catch (e) {
      // The restore is one transaction: on failure the previous data is untouched.
      setMessage({ tone: "danger", text: describeDbError(e) });
    }
  }

  return (
    <Card title={fr.backup.title}>
      <div className="flex flex-col gap-3">
        <Notice tone="warn">{fr.backup.warning}</Notice>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={onExport}>
            {fr.backup.export}
          </Button>
          <label className="press inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-border-strong bg-surface px-4 text-[0.9375rem] font-semibold active:bg-sunk">
            {fr.backup.import}
            <input type="file" accept="application/json,.json" className="sr-only" onChange={onImport} />
          </label>
        </div>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
      <ConfirmSheet
        open={pending !== null}
        title={fr.backup.import}
        confirmLabel="Restaurer"
        tone="danger"
        onConfirm={doRestore}
        onCancel={() => setPending(null)}
      >
        <p>{fr.backup.importConfirm}</p>
        {missing.length > 0 && <p className="mt-3 font-semibold text-danger">{fr.backup.missingFinals(missing)}</p>}
      </ConfirmSheet>
    </Card>
  );
}
