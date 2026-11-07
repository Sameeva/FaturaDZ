import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { fr } from "@/i18n/fr";

export const metadata: Metadata = { title: `${fr.auth.title.forgot} | ${fr.appName}` };

export default function Page() {
  return <ForgotPasswordForm />;
}
