import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ItemKind } from "../api/types";

export const KIND_LABEL: Record<ItemKind, string> = {
  definition: "Definice",
  theorem: "Věta",
  proposition: "Tvrzení",
  lemma: "Lemma",
  corollary: "Důsledek",
  algorithm: "Algoritmus",
  remark: "Poznámka",
};

const KIND_VAR: Record<ItemKind, string> = {
  definition: "--k-definition",
  theorem: "--k-theorem",
  proposition: "--k-theorem",
  lemma: "--k-lemma",
  corollary: "--k-lemma",
  algorithm: "--k-algorithm",
  remark: "--k-remark",
};

export const PROVABLE: ItemKind[] = ["theorem", "proposition", "lemma", "corollary"];

export function kindColor(kind: ItemKind) {
  return `var(${KIND_VAR[kind]})`;
}

/** Item label like "Věta 2.2" – set like a textbook run-in heading, coloured by kind. */
export function KindBadge({ kind, label }: { kind: ItemKind; label?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-sm border px-1.5 py-px font-display text-[0.78rem] font-semibold whitespace-nowrap"
      style={{ color: kindColor(kind), borderColor: `color-mix(in srgb, ${kindColor(kind)} 45%, transparent)` }}
    >
      {label || KIND_LABEL[kind]}
    </span>
  );
}

export function SupplementedBadge() {
  return (
    <span
      className="hand inline-flex -rotate-2 items-center rounded-sm border border-dashed border-warn/60 px-1.5 text-[1.02rem] leading-5 text-warn"
      title="Doplněno mimo materiály TGD1 (skripta / folie z přednášek)"
    >
      doplněno
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-surface p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color = pct >= 80 ? "var(--ok)" : pct >= 40 ? "var(--accent)" : "var(--warn)";
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-2 ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Spinner({ label = "Načítám…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-bad/40 bg-bad-soft p-4 text-bad">
      <p className="font-semibold">Načtení se nepovedlo: {error.message}</p>
      {onRetry && (
        <button className="mt-2 text-sm underline" onClick={onRetry}>
          Zkusit znovu
        </button>
      )}
    </div>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "ok" | "bad";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-accent text-accent-ink shadow-[0_1px_0_0_color-mix(in_srgb,var(--ink)_35%,transparent)] hover:brightness-110",
  secondary: "border border-line bg-surface hover:border-[color-mix(in_srgb,var(--ink)_35%,var(--line))]",
  ghost: "hover:bg-surface-2",
  ok: "bg-ok text-[var(--surface)] hover:brightness-110",
  bad: "bg-bad text-[var(--surface)] hover:brightness-110",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${BTN[variant]} ${className}`}
      {...props}
    />
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
      <div className="min-w-0">
        <h1 className="text-[2rem] leading-tight font-bold sm:text-[2.4rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[65ch] text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function LoginHint({ what }: { what: string }) {
  return (
    <div className="rounded-md border border-dashed border-line bg-surface px-3 py-2 text-sm">
      <Link to="/prihlaseni" className="font-semibold text-accent underline underline-offset-2">
        Přihlas se
      </Link>{" "}
      a {what} se ti bude ukládat.
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-md border border-line bg-surface p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-sm px-3 py-1.5 text-sm font-semibold transition ${
            value === o.value ? "bg-ink text-bg" : "text-muted hover:bg-surface-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function pct(v: number | null | undefined) {
  return v == null ? "–" : `${Math.round(v * 100)} %`;
}
