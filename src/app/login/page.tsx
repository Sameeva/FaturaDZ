import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { fr } from "@/i18n/fr";

export const metadata: Metadata = { title: `${fr.auth.title.login} | ${fr.appName}` };

export default function Page() {
  return <LoginForm />;
}
