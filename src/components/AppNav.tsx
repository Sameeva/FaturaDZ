"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fr } from "@/i18n/fr";
import { Icon, type IconName } from "./icons";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: fr.nav.documents, icon: "documents" },
  { href: "/clients", label: fr.nav.clients, icon: "clients" },
  { href: "/products", label: fr.nav.products, icon: "products" },
  { href: "/settings", label: fr.nav.settings, icon: "settings" },
];

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

function Mark() {
  return (
    <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-accent text-accent-contrast">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3h7l5 5v13H7V3Z" />
        <path d="M10 14h6M10 18h4" />
      </svg>
    </span>
  );
}

export function AppNav() {
  const pathname = usePathname();
  if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  const inDocument = pathname.startsWith("/documents");
  const isActive = (href: string) => (href === "/" ? pathname === "/" || inDocument : pathname.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur-none">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 md:h-16 md:px-6">
          {inDocument && (
            <Link href="/" aria-label="Retour aux documents" className="press -ms-2 grid size-11 place-items-center rounded-xl md:hidden">
              <Icon name="back" size={24} className="rtl:rotate-180" />
            </Link>
          )}
          <Link href="/" className={`items-center gap-2.5 ${inDocument ? "hidden md:flex" : "flex"}`}>
            <Mark />
            <span className="font-display text-xl font-bold tracking-tight">{fr.appName}</span>
          </Link>
          {inDocument && <span className="font-display text-lg font-semibold md:hidden">{fr.nav.documents}</span>}
          <nav aria-label="Navigation principale" className="ms-auto hidden md:block">
            <ul className="flex gap-1">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={`press flex min-h-11 items-center rounded-xl px-4 text-[0.9375rem] font-semibold ${
                      isActive(link.href) ? "bg-accent-soft text-accent" : "text-muted hover:bg-sunk hover:text-foreground"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      {/* Phone: bottom tab bar (hidden inside a document, where the editor owns the bottom edge). */}
      {!inDocument && (
        <nav
          aria-label="Navigation principale"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <ul className="mx-auto grid max-w-md grid-cols-4">
            {LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`press flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${active ? "text-accent" : "text-muted"}`}
                  >
                    <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${active ? "bg-accent-soft" : ""}`}>
                      <Icon name={link.icon} size={22} />
                    </span>
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
