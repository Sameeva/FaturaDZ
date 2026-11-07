import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { fr } from "@/i18n/fr";

export const metadata: Metadata = { title: `${fr.auth.reset.title} | ${fr.appName}` };

export default function Page() {
  return <ResetPasswordForm />;
}
