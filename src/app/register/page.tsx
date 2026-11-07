import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { fr } from "@/i18n/fr";

export const metadata: Metadata = { title: `${fr.auth.title.register} | ${fr.appName}` };

export default function Page() {
  return <RegisterForm />;
}
