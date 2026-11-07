"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Notice, TextField } from "@/components/ui";
import { Icon } from "@/components/icons";
import { requestPasswordReset } from "@/lib/auth/actions";
import { fr } from "@/i18n/fr";
import { AuthShell, linkClass } from "./AuthShell";
import { isValidEmail } from "./passwordRules";

export function ForgotPasswordForm() {
  const t = fr.auth;
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setFormError("");
    const msg = !email.trim() ? t.errors.emailRequired : !isValidEmail(email) ? t.errors.emailInvalid : "";
    setError(msg);
    if (msg) return;
    setPending(true);
    try {
      const r = await requestPasswordReset(email.trim());
      if (r.ok) setDone(true);
      else setFormError(r.error);
    } catch {
      setFormError(t.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title={done ? t.successForgotTitle : t.title.forgot}
      subtitle={done ? t.successForgot : t.subtitle.forgot}
      footer={
        <Link href="/login" className={linkClass}>
          {t.backToLogin}
        </Link>
      }
    >
      {done ? (
        <div className="flex justify-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Icon name="check" size={28} />
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {formError && <Notice tone="danger">{formError}</Notice>}
          <TextField label={t.email} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder={t.emailPlaceholder} value={email} onChange={setEmail} error={error} disabled={pending} />
          <Button type="submit" variant="primary" size="lg" disabled={pending} aria-busy={pending}>
            {pending ? t.pendingForgot : t.submitForgot}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
