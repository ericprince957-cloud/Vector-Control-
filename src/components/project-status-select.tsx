'use client';

import { useState, useTransition } from 'react';
import { Select } from './ui';
import { useToast } from './toast';
import { label } from '@/lib/constants';
import type { ActionState } from '@/lib/validators';

const CHOICES = ['not_started', 'in_progress', 'review', 'on_hold', 'completed', 'cancelled'];

/** Inline project status dropdown (saves on change, reverts if the server refuses). */
export function ProjectStatusSelect({ projectId, status, action, canClose }: {
  projectId: string;
  status: string;
  action: (fd: FormData) => Promise<ActionState>;
  canClose: boolean;
}) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  const { notify } = useToast();

  function change(next: string) {
    const previous = value;
    setValue(next);
    const fd = new FormData();
    fd.set('id', projectId);
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
    <Select aria-label="Project status" value={value} disabled={pending} onChange={(e) => change(e.target.value)} className="min-h-8 w-auto rounded-full !py-1 pl-3 text-xs font-medium">
      {CHOICES.filter((c) => canClose || (c !== 'completed' && c !== 'cancelled') || c === value).map((c) => (
        <option key={c} value={c}>{c === 'review' ? 'Under review' : label(c)}</option>
      ))}
    </Select>
  );
}
