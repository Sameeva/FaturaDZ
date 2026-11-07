import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/auth/safeNext";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Completes an email link or Google sign-in (PKCE code exchange), then sends the user to `next`.
 * A missing or rejected code goes back to the login page with ?error=link.
 */
export async function completeSignIn(request: Request, next: string): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const env = supabaseEnv();
  const failed = () => NextResponse.redirect(new URL("/login?error=link", url.origin));
  if (!env || !code) return failed();

  const store = await cookies();
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? failed() : NextResponse.redirect(new URL(safeNext(next), url.origin));
}
