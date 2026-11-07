import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Builds the Content-Security-Policy for one request.
 *
 * - Scripts only run if they come from this origin and carry the nonce
 *   ('strict-dynamic' lets those trusted scripts load their own chunks).
 * - 'wasm-unsafe-eval' is needed by the PDF layout engine (yoga, WebAssembly);
 *   it allows compiling WebAssembly only, not JavaScript eval.
 * - Images: self, data: (stored logo) and blob: (PDF preview).
 * - Invoices never leave the browser. The only network origin besides this one is the
 *   Supabase project (accounts only), passed as `supabaseUrl`.
 */
export function buildCsp(nonce: string, isDev: boolean, supabaseUrl?: string): string {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // data: lets the PDF engine load its inlined WebAssembly; reading a data: URL sends nothing out.
    "connect-src 'self' data:" + (supabaseOrigin ? ` ${supabaseOrigin}` : "") + (isDev ? " ws:" : ""),
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/** Pages reachable without an account. /reset-password needs the session the email link creates. */
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/auth", "/confidentialite"];
const isPublic = (path: string) => PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const env = supabaseEnv();
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development", env?.url);

  // Rebuilt after a token refresh so the page sees the refreshed cookies.
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };
  let response = forward();

  if (env) {
    const supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = forward();
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    let signedIn = false;
    try {
      // Verifies the token (and refreshes it when expired); a failure counts as signed out.
      const { data } = await supabase.auth.getClaims();
      signedIn = Boolean(data?.claims);
    } catch {
      signedIn = false;
    }
    const path = request.nextUrl.pathname;
    const redirectTo = !signedIn && !isPublic(path) ? "/login" : signedIn && (path === "/login" || path === "/register") ? "/" : null;
    if (redirectTo) {
      const redirect = NextResponse.redirect(new URL(redirectTo, request.url));
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      redirect.headers.set("Content-Security-Policy", csp);
      return redirect;
    }
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|fonts/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
