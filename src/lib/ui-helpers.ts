import type { Tone } from '@/components/ui';

export const PAGE_SIZE = 25;

/** Parses ?page= into a safe 1-based integer. */
export function pageParam(value: string | undefined): number {
  const n = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

export function rangeFor(page: number, size = PAGE_SIZE): [number, number] {
  return [(page - 1) * size, page * size - 1];
}

/**
 * Strips characters that have meaning inside PostgREST `.or()` filter strings
 * so free-text search input cannot alter the structure of the query.
 */
export function safeSearch(value: string | undefined): string {
  return (value ?? '').replace(/[,()%*\\"']/g, ' ').trim().slice(0, 80);
}

/** Only accept YYYY-MM-DD for date filters. */
export function dateParam(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

/**
 * PostgREST returns embedded to-one relations as an object, but generated
 * types sometimes model them as arrays. Normalise either shape.
 */
export function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export const prospectTone: Record<string, Tone> = {
  new: 'blue', contacted: 'neutral', responded: 'blue', interested: 'gold',
  qualified: 'gold', converted: 'green', disqualified: 'red', on_hold: 'amber'
};

export const dealTone: Record<string, Tone> = {
  draft: 'neutral', proposal_sent: 'blue', negotiation: 'gold', won: 'green', lost: 'red', cancelled: 'red'
};

export const projectTone: Record<string, Tone> = {
  not_started: 'neutral', in_progress: 'blue', under_review: 'amber', review: 'amber',
  completed: 'green', on_hold: 'amber', cancelled: 'red'
};

export const paymentTone: Record<string, Tone> = {
  successful: 'green', failed: 'red', pending: 'amber', refunded: 'neutral'
};

export const commissionTone: Record<string, Tone> = {
  pending: 'amber', approved: 'gold', paid: 'green', void: 'red'
};

export const priorityTone: Record<string, Tone> = {
  low: 'neutral', medium: 'blue', high: 'gold', urgent: 'red'
};

export const taskTone: Record<string, Tone> = {
  todo: 'neutral', in_progress: 'blue', done: 'green', cancelled: 'red'
};

export type Opt = { id: string; name: string };

/** Net amount of a payment row: refunds subtract, only successful rows count. */
export function netAmount(p: { amount: number | string; status: string; transaction_type: string }): number {
  if (p.status !== 'successful') return 0;
  return p.transaction_type === 'refund' ? -Number(p.amount) : Number(p.amount);
}

export function isOverdueDate(date: string | null | undefined, doneStatuses: string[], status: string): boolean {
  if (!date || doneStatuses.includes(status)) return false;
  return date < new Date().toISOString().slice(0, 10);
}
