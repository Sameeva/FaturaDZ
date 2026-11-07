"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Notice } from "@/components/ui";
import { currentEmail, signOut } from "@/lib/auth/actions";
import { fr } from "@/i18n/fr";

/** Shows the signed-in account and the sign-out button. Hidden when accounts are not configured. */
export function AccountPanel() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    currentEmail().then((value) => live && setEmail(value), () => {});
    return () => {
      live = false;
    };
  }, []);

  if (!email) return null;

  async function out() {
    setPending(true);
    setError("");
    const result = await signOut();
    if (result.ok) router.replace("/login");
    else {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <Card title={fr.auth.account.title}>
      <div className="flex flex-col gap-3">
        <p className="text-[0.9375rem] text-muted">
          {fr.auth.account.signedInAs} <strong className="font-semibold">{email}</strong>
        </p>
        {error && <Notice tone="danger">{error}</Notice>}
        <div>
          <Button onClick={out} disabled={pending} aria-busy={pending}>
            {pending ? fr.auth.account.signingOut : fr.auth.account.signOut}
          </Button>
        </div>
      </div>
    </Card>
  );
}
