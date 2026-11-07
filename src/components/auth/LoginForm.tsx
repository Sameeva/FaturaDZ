"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Notice, TextField } from "@/components/ui";
import { signInWithPassword } from "@/lib/auth/actions";
import { fr } from "@/i18n/fr";
import { AuthShell, linkClass } from "./AuthShell";
import { Divider, PasswordField } from "./fields";
import { GoogleButton } from "./GoogleButton";
import { isValidEmail } from "./passwordRules";

export function LoginForm() {
  const router = useRouter();
  const t = fr.auth;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const next: typeof errors = {};
    if (!email.trim()) next.email = t.errors.emailRequired;
    else if (!isValidEmail(email)) next.email = t.errors.emailInvalid;
    if (!password) next.password = t.errors.passwordRequired;
    setErrors(next);
    setFormError("");
    if (next.email || next.password) return;
    setPending(true);
    try {
      const r = await signInWithPassword(email.trim(), password);
      if (r.ok) router.replace("/");
      else setFormError(r.error);
    } catch {
      setFormError(t.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title={t.title.login}
      subtitle={t.subtitle.login}
      footer={
        <>
          {t.noAccount}{" "}
          <Link href="/register" className={linkClass}>
            {t.registerLink}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError && <Notice tone="danger">{formError}</Notice>}
        <TextField label={t.email} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder={t.emailPlaceholder} value={email} onChange={setEmail} error={errors.email} disabled={pending} />
        <PasswordField label={t.password} autoComplete="current-password" value={password} onChange={setPassword} error={errors.password} disabled={pending} />
        <div className="-mt-2 flex justify-end">
          <Link href="/forgot-password" className={linkClass}>
            {t.forgotLink}
          </Link>
        </div>
        <Button type="submit" variant="primary" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? t.pendingLogin : t.submitLogin}
        </Button>
        <Divider>{t.or}</Divider>
        <GoogleButton onError={setFormError} disabled={pending} />
      </form>
    </AuthShell>
  );
}
