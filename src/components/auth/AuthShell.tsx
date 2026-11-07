import type { ReactNode } from "react";
import { fr } from "@/i18n/fr";

/** Logged-out layout: logo above a single card, centred, safe-area aware. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-md flex-col justify-center gap-6 py-4 md:min-h-[calc(100dvh-6rem)]">
      <div className="rise flex items-center justify-center gap-2.5">
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-accent text-accent-contrast">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 3h7l5 5v13H7V3Z" />
            <path d="M10 14h6M10 18h4" />
          </svg>
        </span>
        <span className="font-display text-2xl font-bold tracking-tight">{fr.appName}</span>
      </div>
      <section className="rise rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow)] md:p-8">
        <header className="mb-6 flex flex-col gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          <div className="ledger-rule" aria-hidden="true" />
          <p className="text-[0.9375rem] text-muted">{subtitle}</p>
        </header>
        {children}
      </section>
      {footer && <p className="rise text-center text-[0.9375rem] text-muted">{footer}</p>}
    </div>
  );
}

export const linkClass =
  "press inline-flex min-h-11 items-center rounded-lg px-1 font-semibold text-accent underline-offset-4 hover:underline";
