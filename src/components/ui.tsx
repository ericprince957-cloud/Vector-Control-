import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-line bg-surface', className)} {...props} />;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'gold' | 'green' | 'red' | 'blue' | 'amber' }) {
  const tones = {
    neutral: 'border-line text-muted',
    gold: 'border-gold/40 text-gold',
    green: 'border-emerald-800 text-emerald-400',
    red: 'border-red-900 text-red-400',
    blue: 'border-sky-900 text-sky-400',
    amber: 'border-amber-900 text-amber-400'
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize', tones[tone])}>
      {children}
    </span>
  );
}

const fieldStyles =
  'w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-gold/60 focus:outline-none';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldStyles, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldStyles, 'min-h-20', props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldStyles, 'appearance-none', props.className)} />;
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn('mb-1.5 block text-xs font-medium text-muted', className)}>{children}</label>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' };

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  const variants = {
    primary: 'bg-gold text-black hover:bg-gold-light font-semibold',
    ghost: 'border border-line text-text hover:border-gold/50 hover:text-gold',
    danger: 'border border-red-900 text-red-400 hover:bg-red-950/40'
  };
  return (
    <button
      {...props}
      className={cn('inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm transition-colors disabled:opacity-50', variants[variant], className)}
    />
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function TH({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn('border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted', className)}>{children}</th>;
}

export function TD({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('border-b border-line/60 px-4 py-3 align-middle', className)}>{children}</td>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
      <p className="text-sm text-muted">{title}</p>
      {hint ? <p className="text-xs text-muted/60">{hint}</p> : null}
    </div>
  );
}

export function StatCard({ label: statLabel, value, tone }: { label: string; value: string | number; tone?: 'gold' | 'green' | 'red' }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{statLabel}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', tone === 'gold' && 'text-gold', tone === 'green' && 'text-emerald-400', tone === 'red' && 'text-red-400')}>
        {value}
      </p>
    </Card>
  );
}
