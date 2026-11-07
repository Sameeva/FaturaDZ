/**
 * Public Supabase settings (URL + publishable/anon key, safe for the browser).
 * Null when not configured: the app then runs without accounts.
 * Each variable is read by its literal name so Next.js can inline it in client code.
 */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  try {
    if (new URL(url).protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { url, key };
}
