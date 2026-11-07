"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/lib/auth/actions";
import { fr } from "@/i18n/fr";
import { GoogleMark } from "./fields";

export function GoogleButton({ onError, disabled }: { onError: (message: string) => void; disabled?: boolean }) {
  const [pending, setPending] = useState(false);
  async function go() {
    setPending(true);
    onError("");
    try {
      const r = await signInWithGoogle();
      if (!r.ok) onError(r.error);
    } catch {
      onError(fr.auth.errors.generic);
    } finally {
      setPending(false);
    }
  }
  return (
    <button
      type="button"
      onClick={go}
      disabled={disabled || pending}
      aria-busy={pending}
      className="press inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-border-strong bg-surface px-5 text-base font-semibold hover:bg-sunk active:bg-sunk disabled:cursor-not-allowed disabled:opacity-45"
    >
      <GoogleMark />
      {pending ? fr.auth.googlePending : fr.auth.google}
    </button>
  );
}
