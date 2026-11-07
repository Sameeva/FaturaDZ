import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { fr } from "@/i18n/fr";

export const metadata: Metadata = { title: `${fr.auth.title.login} | ${fr.appName}` };

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginForm linkError={error === "link"} />;
}
