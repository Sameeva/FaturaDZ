"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { Button, Notice, TextField } from "@/components/ui";
import { Icon } from "@/components/icons";
import { signUpWithPassword } from "@/lib/auth/actions";
import { fr } from "@/i18n/fr";
import { AuthShell, linkClass } from "./AuthShell";
import { Divider, PasswordField } from "./fields";
import { GoogleButton } from "./GoogleButton";
import { checkPassword, isValidEmail } from "./passwordRules";

type Errors = { email?: string; password?: string; confirm?: string; privacy?: string };

export function RegisterForm() {
  const t = fr.auth;
  const privacyId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const next: Errors = {};
    if (!email.trim()) next.email = t.errors.emailRequired;
    else if (!isValidEmail(email)) next.email = t.errors.emailInvalid;
    if (!password) next.password = t.errors.passwordRequired;
    else if (!checkPassword(password).valid) next.password = t.errors.passwordWeak;
    if (confirm !== password) next.confirm = t.errors.confirmMismatch;
    if (!accepted) next.privacy = t.errors.privacyRequired;
    setErrors(next);
    setFormError("");
    if (Object.keys(next).length > 0) return;
    setPending(true);
    try {
      const r = await signUpWithPassword(email.trim(), password);
      if (r.ok) setSentTo(email.trim());
      else setFormError(r.error);
    } catch {
      setFormError(t.errors.generic);
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <AuthShell
        title={t.successRegisterTitle}
        subtitle={t.successRegisterTo}
        footer={
          <Link href="/login" className={linkClass}>
            {t.backToLogin}
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Icon name="check" size={28} />
          </div>
          <p className="font-display text-lg font-semibold">{sentTo}</p>
          <Notice tone="success">{t.successRegister}</Notice>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t.title.register}
      subtitle={t.subtitle.register}
      footer={
        <>
          {t.haveAccount}{" "}
          <Link href="/login" className={linkClass}>
            {t.loginLink}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError && <Notice tone="danger">{formError}</Notice>}
        <TextField label={t.email} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder={t.emailPlaceholder} value={email} onChange={setEmail} error={errors.email} disabled={pending} />
        <PasswordField label={t.password} autoComplete="new-password" rules value={password} onChange={setPassword} error={errors.password} disabled={pending} />
        <PasswordField label={t.confirmPassword} autoComplete="new-password" value={confirm} onChange={setConfirm} matchWith={password} error={errors.confirm} disabled={pending} />
        <div className="flex flex-col gap-1">
          <div className="flex min-h-11 items-start gap-3 py-1.5">
            <input
              id={privacyId}
              type="checkbox"
              className="mt-0.5 size-6 shrink-0 accent-[var(--accent)]"
              checked={accepted}
              disabled={pending}
              onChange={(e) => setAccepted(e.target.checked)}
              aria-invalid={errors.privacy ? true : undefined}
              aria-describedby={errors.privacy ? `${privacyId}-err` : undefined}
            />
            <label htmlFor={privacyId} className="text-[0.9375rem]">
              {t.acceptPrivacyPrefix}
              <Link href="/confidentialite" className="font-semibold text-accent underline underline-offset-4">
                {t.privacyLink}
              </Link>
              .
            </label>
          </div>
          {errors.privacy && (
            <p id={`${privacyId}-err`} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
              <Icon name="warn" size={16} className="mt-0.5 shrink-0" />
              <span>{errors.privacy}</span>
            </p>
          )}
        </div>
        <Button type="submit" variant="primary" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? t.pendingRegister : t.submitRegister}
        </Button>
        <Divider>{t.or}</Divider>
        <GoogleButton onError={setFormError} disabled={pending} />
      </form>
    </AuthShell>
  );
}
