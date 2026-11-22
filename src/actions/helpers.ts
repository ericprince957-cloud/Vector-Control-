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
    // Safe error messages: never leak database internals to the UI
    const safe = /duplicate key|unique/i.test(message)
      ? 'A record with these details already exists'
      : message.includes('row-level security') || message.includes('permission denied')
        ? 'You do not have permission to perform this action'
        : message.length > 200 ? 'Action failed. Please try again.' : message;
    return { ok: false, message: safe };
  }
}

/**
 * Writes an audit entry through the AUTHENTICATED server client (the live
 * database has no log_audit RPC — verified via PostgREST error PGRST202).
 * Returns a warning string on failure instead of silently ignoring it, so
 * important financial/administrative operations surface audit problems.
 */
export async function audit(action: string, entity: string, entityId?: string | null, details: Record<string, unknown> = {}): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('audit_logs').insert({
      actor_id: user?.id ?? null,
      action,
      entity,
      entity_id: entityId ?? null,
      details
    });
    if (error) return 'Audit logging failed: ' + error.message;
    return null;
  } catch (e) {
    return 'Audit logging failed: ' + (e instanceof Error ? e.message : 'unknown error');
  }
}

export function blankToNull(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
}

/** Appends a non-fatal audit warning to a success message. */
export function withAuditWarning(message: string, warning: string | null): string {
  return warning ? `${message} (warning: ${warning})` : message;
}
