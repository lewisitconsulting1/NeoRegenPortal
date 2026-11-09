// Shared look for every page. Server-safe: no hooks.

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export const button = {
  primary: `${base} bg-ink text-white hover:bg-slate-800`,
  secondary: `${base} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`,
  danger: `${base} bg-red-700 text-white hover:bg-red-800`,
};

export const link = "font-medium text-gold-dark underline-offset-2 hover:underline";

// text-base on phones keeps iOS from zooming in when a field is focused.
export const input =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-xs focus:border-ink focus:ring-2 focus:ring-ink/15 focus:outline-none sm:text-sm";

export function Field({
  label,
  name,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-800">
        {label}
        {required ? <span className="text-red-700"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const tones = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-xs ${className}`}>{children}</section>;
}

export function Notice({
  tone = "amber",
  title,
  children,
}: {
  tone?: "amber" | "red" | "green" | "blue";
  title: string;
  children?: React.ReactNode;
}) {
  const styles = {
    amber: "border-amber-300 bg-amber-50 text-amber-900",
    red: "border-red-300 bg-red-50 text-red-900",
    green: "border-emerald-300 bg-emerald-50 text-emerald-900",
    blue: "border-sky-300 bg-sky-50 text-sky-900",
  }[tone];
  return (
    <div role={tone === "red" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</p>;
}

export const table = {
  wrap: "overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs",
  table: "min-w-full divide-y divide-slate-200 text-sm",
  th: "px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase",
  td: "px-4 py-3 align-top",
};
