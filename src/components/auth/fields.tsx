"use client";

import { useId, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { fr } from "@/i18n/fr";
import { checkPassword } from "./passwordRules";

const inputClass =
  "w-full min-h-12 rounded-xl border border-border-strong bg-surface ps-3.5 pe-12 text-base transition-colors placeholder:text-muted/70 hover:border-muted focus:border-accent focus-visible:outline-2 aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft/40";

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

/** Password input with a show/hide toggle (44px target) and optional live rules. */
export function PasswordField({
  label,
  value,
  onChange,
  error,
  autoComplete,
  rules = false,
  matchWith,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  autoComplete: "current-password" | "new-password";
  rules?: boolean;
  /** When set, shows a live match hint against this value. */
  matchWith?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const msgId = `${id}-msg`;
  const matches = matchWith !== undefined && value.length > 0 && value === matchWith;
  const hasMessage = Boolean(error) || rules || matches;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasMessage ? msgId : undefined}
        />
        <button
          type="button"
          aria-label={shown ? fr.auth.hidePassword : fr.auth.showPassword}
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
          className="press absolute inset-y-0 end-0 grid w-12 place-items-center rounded-e-xl text-muted hover:text-foreground"
        >
          <EyeIcon off={shown} />
        </button>
      </div>
      <div id={msgId} className="flex flex-col gap-2">
        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
            <Icon name="warn" size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
        {matches && !error && (
          <p className="flex items-center gap-1.5 text-sm text-accent">
            <Icon name="check" size={16} className="shrink-0" />
            {fr.auth.confirmMatch}
          </p>
        )}
        {rules && <Strength value={value} />}
      </div>
    </div>
  );
}

function Strength({ value }: { value: string }) {
  const c = checkPassword(value);
  const items: [boolean, string][] = [
    [c.minLength, fr.auth.rules.minLength],
    [c.hasLetter, fr.auth.rules.hasLetter],
    [c.hasDigit, fr.auth.rules.hasDigit],
  ];
  const tone = c.score <= 2 ? "bg-warn" : "bg-accent";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={`h-1.5 rounded-full transition-colors duration-200 ${c.score >= n ? tone : "bg-sunk"}`} />
          ))}
        </div>
        <span className="min-w-16 text-end text-sm font-semibold text-muted" aria-live="polite">
          <span className="sr-only">{fr.auth.rulesTitle} : </span>
          {fr.auth.strength[c.score]}
        </span>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {items.map(([ok, label]) => (
          <li key={label} className={`flex items-center gap-1.5 ${ok ? "text-accent" : "text-muted"}`}>
            <span aria-hidden="true" className={`grid size-4 place-items-center rounded-full border ${ok ? "border-accent bg-accent text-accent-contrast" : "border-border-strong"}`}>
              {ok && <Icon name="check" size={12} strokeWidth={3} />}
            </span>
            {label}
            <span className="sr-only">{ok ? " : ok" : " : manquant"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted" role="separator">
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
