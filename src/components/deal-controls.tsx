'use client';

import { useState } from 'react';
import { ActionForm } from './action-form';
import { Button, Select } from './ui';
import { DEAL_STATUSES, label } from '@/lib/constants';
import type { ActionState } from '@/lib/validators';

const IRREVERSIBLE = new Set(['won', 'lost', 'cancelled']);

/**
 * Stage control.
 * - Founder: can move a deal to any stage; won / lost / cancelled ask for confirmation.
 * - Staff: the only transition offered is "record client response" (proposal sent → negotiation).
 * The backend (triggers + RLS) is the real authority; this only avoids offering actions that will be refused.
 */
export function DealStageControl({ action, dealId, status, isFounder, compact = false }: {
  action: (fd: FormData) => Promise<ActionState>;
  dealId: string;
  status: string;
  isFounder: boolean;
  compact?: boolean;
}) {
  const [next, setNext] = useState(status);

  if (!isFounder) {
    if (status !== 'proposal_sent') {
      return <p className="text-[11px] text-muted">Stage changes need founder approval.</p>;
    }
    return (
      <ActionForm action={action}>
        <input type="hidden" name="id" value={dealId} />
        <input type="hidden" name="status" value="negotiation" />
        <Button type="submit" variant="ghost" size="sm" className="w-full">Record client response</Button>
      </ActionForm>
    );
  }

  const critical = IRREVERSIBLE.has(next) && next !== status;
  return (
    <ActionForm
      action={action}
      className={compact ? 'flex gap-2' : 'flex flex-wrap gap-2'}
      confirm={critical ? {
        title: `Mark this deal as ${label(next)}?`,
        description: next === 'won'
          ? 'Marking a deal as won confirms the approved terms and allows it to be converted into a client project.'
          : `Marking a deal as ${label(next).toLowerCase()} closes it. This is a founder-only decision and is recorded in the audit log.`,
        confirmLabel: `Mark ${label(next)}`,
        danger: next !== 'won'
      } : undefined}
    >
      <input type="hidden" name="id" value={dealId} />
      <Select name="status" aria-label="Deal stage" value={next} onChange={(e) => setNext(e.target.value)} className={compact ? 'min-h-8 !py-1 text-xs' : undefined}>
        {DEAL_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
      </Select>
      <Button type="submit" variant="ghost" size={compact ? 'sm' : 'md'} disabled={next === status}>Update stage</Button>
    </ActionForm>
  );
}
