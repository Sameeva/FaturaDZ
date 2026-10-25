"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { Icon, type IconName } from "./icons";

export function Card({ title, children, actions, className = "" }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow)] md:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-display text-lg font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Page title with the ledger rule underneath and an optional action area. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-1 flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="ledger-rule" aria-hidden="true" />
    </header>
  );
}

type Variant = "primary" | "secondary" | "danger" | "dangerSolid" | "ghost";
type Size = "md" | "lg";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-contrast shadow-sm active:brightness-90",
  secondary: "border border-border-strong bg-surface active:bg-sunk",
  danger: "border border-danger text-danger active:bg-danger-soft",
  dangerSolid: "bg-danger text-white active:brightness-90 dark:text-[#2b0b08]",
  ghost: "text-foreground active:bg-sunk",
};
const SIZES: Record<Size, string> = { md: "min-h-11 px-4 text-[0.9375rem]", lg: "min-h-12 px-5 text-base" };

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: IconName }) {
  return (
    <button
      type="button"
      className={`press inline-flex items-center justify-center gap-2 rounded-xl font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; variant?: Variant }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`press grid size-11 shrink-0 place-items-center rounded-xl disabled:opacity-45 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}

/** Document state: dashed amber for a draft, solid green with a check for a finalized document. */
export function StatusBadge({ status, label }: { status: "draft" | "final"; label: string }) {
  return status === "draft" ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-warn bg-warn-soft px-2 py-0.5 text-xs font-bold tracking-wide text-warn uppercase">
      {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-bold tracking-wide text-accent uppercase">
      <Icon name="check" size={12} strokeWidth={3} />
      {label}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Segmented control with a spring thumb (CSS only; position from data-i). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="group" aria-label={label} className="seg" data-n={options.length} data-i={index}>
      <span className="seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" className="seg-opt" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const inputClass =
  "w-full min-h-12 rounded-xl border border-border-strong bg-surface px-3.5 text-base transition-colors placeholder:text-muted/70 hover:border-muted focus:border-accent focus-visible:outline-2 aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft/40";

interface FieldShellProps {
  label: string;
  hint?: string | null;
  warning?: string | null;
  error?: string | null;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

function FieldShell({ label, hint, warning, error, children }: FieldShellProps) {
  const id = useId();
  const message = error ?? warning ?? hint;
  const describedBy = message ? `${id}-msg` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children(id, describedBy)}
      {message && (
        <p id={describedBy} className={`flex items-start gap-1.5 text-sm ${error ? "font-medium text-danger" : warning ? "text-warn" : "text-muted"}`} role={error ? "alert" : undefined}>
          {(error || warning) && <Icon name="warn" size={16} className="mt-0.5 shrink-0" />}
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string | null;
  warning?: string | null;
  error?: string | null;
};

export function TextField({ label, value, onChange, hint, warning, error, ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} warning={warning} error={error}>
      {(id, describedBy) => (
        <input
          id={id}
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
      )}
    </FieldShell>
  );
}

/** Search box with a magnifier; same contract as TextField. */
export function SearchField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon name="search" size={20} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        id={id}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder={placeholder ?? label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ps-11`}
      />
    </div>
  );
}

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function TextArea({ label, value, onChange, ...props }: TextAreaProps) {
  return (
    <FieldShell label={label}>
      {(id) => <textarea id={id} className={`${inputClass} py-2.5`} rows={3} value={value} onChange={(e) => onChange(e.target.value)} {...props} />}
    </FieldShell>
  );
}

type SelectProps<T extends string> = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
};

export function SelectField<T extends string>({ label, value, options, onChange, ...props }: SelectProps<T>) {
  return (
    <FieldShell label={label}>
      {(id) => (
        <select
          id={id}
          className={inputClass}
          value={value}
          onChange={(e) => {
            const next = options.find((o) => o.value === e.target.value);
            if (next) onChange(next.value);
          }}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export function Checkbox({ label, checked, onChange, hint, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={`flex min-h-11 items-center gap-3 text-base ${disabled ? "opacity-60" : ""}`}>
        <input id={id} type="checkbox" className="size-6 shrink-0 accent-[var(--accent)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {hint && <p className="ms-9 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "success"; children: ReactNode }) {
  const tones = {
    info: "border-border bg-surface text-muted",
    warn: "border-warn/60 bg-warn-soft text-warn",
    danger: "border-danger/60 bg-danger-soft text-danger",
    success: "border-accent/60 bg-accent-soft text-accent",
  };
  return (
    <p className={`rounded-xl border px-3.5 py-2.5 text-[0.9375rem] font-medium ${tones[tone]}`} role={tone === "danger" ? "alert" : "status"}>
      {children}
    </p>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Icon name="invoice" size={28} />
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}
