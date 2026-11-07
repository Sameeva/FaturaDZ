import type { AuthError } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { fr } from "@/i18n/fr";

/** Auth entry points called by the account forms (browser side). */
export type AuthResult = { ok: true } | { ok: false; error: string };

const e = fr.auth.errors;
const fail = (error: string): AuthResult => ({ ok: false, error });

function message(err: AuthError): string {
  switch (err.code) {
    case "invalid_credentials":
      return e.invalidCredentials;
    case "email_not_confirmed":
      return e.emailNotConfirmed;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return e.rateLimited;
    case "weak_password":
      return e.passwordWeak;
    case "same_password":
      return e.samePassword;
    default:
      return e.generic;
  }
}

function client() {
  return getSupabase();
}

const origin = () => window.location.origin;

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const sb = client();
  if (!sb) return fail(e.notConfigured);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return error ? fail(message(error)) : { ok: true };
}

export async function signUpWithPassword(email: string, password: string): Promise<AuthResult> {
  const sb = client();
  if (!sb) return fail(e.notConfigured);
  const { error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${origin()}/auth/callback` } });
  // An already-registered address also returns success, so the form never reveals who has an account.
  return error ? fail(message(error)) : { ok: true };
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const sb = client();
  if (!sb) return fail(e.notConfigured);
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin()}/auth/callback` } });
  return error ? fail(message(error)) : { ok: true };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const sb = client();
  if (!sb) return fail(e.notConfigured);
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/auth/recovery` });
  // Unknown addresses are not reported, only rate limits.
  if (error && (error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit")) return fail(e.rateLimited);
  return { ok: true };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const sb = client();
  if (!sb) return fail(e.notConfigured);
  const { error } = await sb.auth.updateUser({ password });
  return error ? fail(message(error)) : { ok: true };
}

export async function signOut(): Promise<AuthResult> {
  const sb = client();
  if (!sb) return fail(e.notConfigured);
  const { error } = await sb.auth.signOut();
  return error ? fail(message(error)) : { ok: true };
}

export async function currentEmail(): Promise<string | null> {
  const sb = client();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.email ?? null;
}
