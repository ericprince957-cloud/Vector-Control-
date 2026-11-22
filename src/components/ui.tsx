import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/* ───────────────────────────── Surfaces ───────────────────────────── */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[6px] border border-line bg-surface', className)} {...props} />;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-wide">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ───────────────────────────── Status ───────────────────────────── */

export type Tone = 'neutral' | 'gold' | 'green' | 'red' | 'blue' | 'amber';

const toneStyles: Record<Tone, string> = {
  neutral: 'border-line-strong text-muted',
  gold: 'border-gold/40 text-gold',
  green: 'border-emerald-800 text-success',
  red: 'border-red-900 text-danger',
  blue: 'border-sky-900 text-info',
  amber: 'border-amber-900 text-warn'
};

const dotStyles: Record<Tone, string> = {
  neutral: 'bg-muted',
  gold: 'bg-gold',
  green: 'bg-success',
  red: 'bg-danger',
  blue: 'bg-info',
  amber: 'bg-warn'
};

/** Compact status indicator: coloured dot + label inside a hairline pill. */
export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize leading-4', toneStyles[tone])}>
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dotStyles[tone])} />
      {children}
    </span>
  );
}

/* ───────────────────────────── Form controls ───────────────────────────── */

const fieldStyles =
  'w-full rounded-[5px] border border-line-strong bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-gold/70 focus:outline-none focus-visible:outline-none disabled:opacity-60 min-h-10';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input ref={ref} {...props} className={cn(fieldStyles, props.className)} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) {
  return <textarea ref={ref} {...props} className={cn(fieldStyles, 'min-h-24', props.className)} />;
});

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldStyles, 'pr-8', props.className)} />;
}

export function Label({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-xs font-medium text-muted', className)}>
      {children}
    </label>
  );
}

/**
 * Labelled field. Clones its single child to wire id / aria attributes so the
 * label is programmatically associated with the control.
 */
export function Field({ label, children, hint, className }: { label: string; children: React.ReactElement<Record<string, unknown>>; hint?: string; className?: string }) {
  const id = React.useId();
  const control = React.isValidElement(children)
    ? React.cloneElement(children, { id: (children.props.id as string) ?? id, 'aria-describedby': hint ? `${id}-hint` : undefined })
    : children;
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {control}
      {hint ? <p id={`${id}-hint`} className="mt-1 text-[11px] text-muted/80">{hint}</p> : null}
    </div>
  );
}

/* ───────────────────────────── Buttons ───────────────────────────── */

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle';
type Size = 'md' | 'sm';

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-[5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap';
const buttonVariants: Record<Variant, string> = {
  primary: 'bg-gold text-black hover:bg-gold-light font-semibold',
  ghost: 'border border-line-strong text-text hover:border-gold/60 hover:text-gold',
  subtle: 'text-muted hover:bg-surface-3 hover:text-text',
  danger: 'border border-red-900 text-danger hover:bg-red-950/40'
};
const buttonSizes: Record<Size, string> = {
  md: 'min-h-10 px-4 py-2 text-sm',
  sm: 'min-h-8 px-3 py-1 text-xs'
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} {...props} className={buttonClass(variant, size, className)} />;
}

/** Link that looks like a button (navigation, downloads). */
export function LinkButton({ href, variant = 'ghost', size = 'md', className, children, ...rest }: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const external = href.startsWith('/api/');
  const classes = buttonClass(variant, size, className);
  return external ? (
    <a href={href} className={classes} {...rest}>{children}</a>
  ) : (
    <Link href={href} className={classes} {...rest}>{children}</Link>
  );
}

/* ───────────────────────────── Tables ───────────────────────────── */

export function Table({ children, minWidth = 640 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="vc-scroll overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>{children}</table>
    </div>
  );
}

export function TH({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn('whitespace-nowrap border-b border-line bg-surface px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted', className)}>
      {children}
    </th>
  );
}

export function TD({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn('border-b border-line/60 px-4 py-3 align-middle', className)}>{children}</td>;
}

/* ───────────────────────────── States ───────────────────────────── */

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <div aria-hidden className="mb-2 h-8 w-8 rounded-full border border-line-strong" />
      <p className="text-sm text-text">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-muted">{hint}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message }: { title?: string; message?: string }) {
  return (
    <div role="alert" className="rounded-[6px] border border-red-900/70 bg-red-950/20 px-4 py-3">
      <p className="text-sm font-medium text-danger">{title}</p>
      {message ? <p className="mt-0.5 text-xs text-red-300/80">{message}</p> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('vc-skeleton', className)} />;
}

export function Notice({ tone = 'neutral', children }: { tone?: 'neutral' | 'warn' | 'danger'; children: React.ReactNode }) {
  const styles = {
    neutral: 'border-line-strong bg-surface-2 text-muted',
    warn: 'border-amber-900/70 bg-amber-950/20 text-amber-200/90',
    danger: 'border-red-900/70 bg-red-950/20 text-red-300'
  };
  return <p role="status" className={cn('rounded-[5px] border px-3 py-2 text-xs', styles[tone])}>{children}</p>;
}

/* ───────────────────────────── Metrics ───────────────────────────── */

export function StatCard({ label: statLabel, value, tone, hint }: { label: string; value: string | number; tone?: 'gold' | 'green' | 'red'; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{statLabel}</p>
      <p className={cn('mt-1.5 truncate text-xl font-semibold tabular-nums', tone === 'gold' && 'text-gold', tone === 'green' && 'text-success', tone === 'red' && 'text-danger')}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted/80">{hint}</p> : null}
    </Card>
  );
}

/** Definition list row used in detail panels. */
export function DetailRow({ label: rowLabel, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/60 py-2.5 text-sm last:border-0">
      <dt className="shrink-0 text-muted">{rowLabel}</dt>
      <dd className="min-w-0 break-words text-right">{children}</dd>
    </div>
  );
}

/** Link-driven tab strip (state lives in the URL so pages stay server-rendered). */
export function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <nav aria-label="Sections" className="vc-scroll mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? 'page' : undefined}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
            active === t.key ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-text'
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
