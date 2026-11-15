'use client';

import { useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { Card, CardHeader } from './ui';
import { cn } from '@/lib/utils';

export function CollapsibleForm({ title, action, children, defaultOpen = false }: {
  title: string;
  action: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <Card className="mb-6">
      <CardHeader
        title={title}
        action={
          <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs text-gold hover:text-gold-light">
            {open ? 'Close' : <><Plus size={14} /> New</>}
            <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
          </button>
        }
      />
      {open ? (
        <form
          action={async (fd) => {
            const result = await action(fd);
            setFeedback(result);
            if (result.ok) setOpen(false);
          }}
          className="space-y-4 p-5"
        >
          {children}
          {feedback ? (
            <p className={cn('text-xs', feedback.ok ? 'text-emerald-400' : 'text-red-400')}>{feedback.message}</p>
          ) : null}
        </form>
      ) : feedback ? (
        <p className={cn('px-5 pb-4 text-xs', feedback.ok ? 'text-emerald-400' : 'text-red-400')}>{feedback.message}</p>
      ) : null}
    </Card>
  );
}
