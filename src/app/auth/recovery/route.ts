import { completeSignIn } from "@/lib/auth/exchange";

/**
 * Password reset link target. It has no query string of its own on purpose: Supabase only
 * honours redirect URLs that match its allow-list, and a `?next=` suffix made it fall back to the Site URL.
 */
export async function GET(request: Request) {
  return completeSignIn(request, "/reset-password");
}
