"use client";

import type { ReactNode } from "react";
import { Button } from "./ui";
import { Sheet } from "./Sheet";

/** Designed replacement for window.confirm: same decision, but readable, thumb-sized and themed. */
export function ConfirmSheet({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Annuler",
  tone = "primary",
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <div className="flex flex-col gap-4">
        <div className="text-base text-muted">{children}</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="lg" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button size="lg" variant={tone === "danger" ? "dangerSolid" : "primary"} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
