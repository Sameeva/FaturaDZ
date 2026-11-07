"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Notice } from "@/components/ui";
import { updatePassword } from "@/lib/auth/actions";
import { fr } from "@/i18n/fr";
import { AuthShell } from "./AuthShell";
import { PasswordField } from "./fields";
import { checkPassword } from "./passwordRules";

export function ResetPasswordForm() {
  const router = useRouter();
  const t = fr.auth;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const next: typeof errors = {};
    if (!checkPassword(password).valid) next.password = t.errors.passwordWeak;
    if (password !== confirm) next.confirm = t.errors.confirmMismatch;
    setErrors(next);
    setFormError("");
    if (next.password || next.confirm) return;
    setPending(true);
    try {
      const r = await updatePassword(password);
      if (r.ok) router.replace("/");
      else setFormError(r.error);
    } catch {
      setFormError(t.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title={t.reset.title} subtitle={t.reset.subtitle}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError && <Notice tone="danger">{formError}</Notice>}
        <PasswordField label={t.password} autoComplete="new-password" rules value={password} onChange={setPassword} error={errors.password} disabled={pending} />
        <PasswordField label={t.confirmPassword} autoComplete="new-password" value={confirm} onChange={setConfirm} matchWith={password} error={errors.confirm} disabled={pending} />
        <Button type="submit" variant="primary" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? t.reset.pending : t.reset.submit}
        </Button>
      </form>
    </AuthShell>
  );
}
