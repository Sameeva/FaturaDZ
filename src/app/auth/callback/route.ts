import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/auth/safeNext";
import { supabaseEnv } from "@/lib/supabase/env";

/** Completes email confirmation, password reset and Google sign-in (PKCE code exchange). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const env = supabaseEnv();
  if (!env || !code) return NextResponse.redirect(new URL("/login", url.origin));

  const store = await cookies();
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? "/login" : next, url.origin));
}
