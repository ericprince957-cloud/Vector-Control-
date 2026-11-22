'use client';

import { useState, useTransition } from 'react';
import { Select } from './ui';
import { useToast } from './toast';
import { PROSPECT_STATUSES, label } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ActionState } from '@/lib/validators';

const accent: Record<string, string> = {
  new: 'border-line-strong text-muted',
  contacted: 'border-gold/50 text-gold',
  responded: 'border-sky-800 text-info',
  interested: 'border-sky-800 text-info',
  qualified: 'border-emerald-800 text-success',
  converted: 'border-emerald-700 text-success',
  disqualified: 'border-red-900 text-danger',
  on_hold: 'border-amber-900 text-warn'
};

/** Inline status dropdown. Saves on change and shows the real server response. */
export function StatusSelect({ prospectId, status, action }: {
  prospectId: string;
  status: string;
  action: (fd: FormData) => Promise<ActionState>;
}) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  const { notify } = useToast();

  function change(next: string) {
    const previous = value;
    setValue(next);
    const fd = new FormData();
    fd.set('id', prospectId);
    fd.set('status', next);
    start(async () => {
      try {
        const res = await action(fd);
        notify(res.ok, res.message);
        if (!res.ok) setValue(previous);
      } catch {
        notify(false, 'The request failed. Check your connection and try again.');
        setValue(previous);
      }
    });
  }

  return (
    <Select
      aria-label="Prospect status"
      value={value}
      disabled={pending}
      onChange={(e) => change(e.target.value)}
      className={cn('min-h-8 w-auto rounded-full !py-1 pl-3 text-xs font-medium', accent[value] ?? accent.new)}
    >
      {PROSPECT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
    </Select>
  );
}
