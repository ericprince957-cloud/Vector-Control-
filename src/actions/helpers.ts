'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import type { ActionState } from '@/lib/validators';

export async function runAction(fn: (profile: Awaited<ReturnType<typeof requireProfile>>) => Promise<string | void>): Promise<ActionState> {
  try {
    const profile = await requireProfile();
    const message = await fn(profile);
    return { ok: true, message: message || 'Saved successfully' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong';
    // Safe error messages: never leak internals to the UI
    const safe = /duplicate key|unique/i.test(message)
      ? 'A record with these details already exists'
      : message.includes('row-level security')
        ? 'You do not have permission to perform this action'
        : message.length > 200 ? 'Action failed. Please try again.' : message;
    return { ok: false, message: safe };
  }
}

export async function audit(action: string, entity: string, entityId?: string | null, details: Record<string, unknown> = {}) {
  const supabase = await createClient();
  await supabase.rpc('log_audit', { p_action: action, p_entity: entity, p_entity_id: entityId ?? null, p_details: details });
}

export function blankToNull(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
}
