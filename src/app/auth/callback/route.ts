import { completeSignIn } from "@/lib/auth/exchange";

/** Email confirmation and Google sign-in. */
export async function GET(request: Request) {
  return completeSignIn(request, new URL(request.url).searchParams.get("next") ?? "/");
}
