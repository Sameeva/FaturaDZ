"use client";

import { useState, type ChangeEvent } from "react";
import { getDb } from "@/db";
import { describeDbError } from "@/db/errors";
import { exportBackup, MAX_BACKUP_BYTES, parseBackup, restoreBackup } from "@/db/backup";
import { todayIso } from "@/db/repository";
import { fr } from "@/i18n/fr";
import { downloadBlob } from "@/lib/download";
import { Button, Card, Notice } from "./ui";

export function BackupPanel() {
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

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
    if (!window.confirm(fr.backup.importConfirm)) return;
    try {
      await restoreBackup(getDb(), result.backup);
      window.alert(fr.backup.imported);
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
          <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-background">
            {fr.backup.import}
            <input type="file" accept="application/json,.json" className="sr-only" onChange={onImport} />
          </label>
        </div>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </div>
    </Card>
  );
}
