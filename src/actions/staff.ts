'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireFounderForAction } from '@/lib/auth';
import { runAction, audit, blankToNull, withAuditWarning } from './helpers';

/**
 * Staff invitation — founder only, verified server-side. Privileged profile
 * writes go through the service-role admin client because normal users cannot
 * upsert other users' profiles under the live RLS policies.
 */
export async function inviteStaff(formData: FormData) {
  return runAction(async () => {
    const founder = await requireFounderForAction();
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const fullName = String(formData.get('full_name') ?? '').trim();
    const role = String(formData.get('role') ?? 'staff');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email');
    if (!['admin', 'staff'].includes(role)) throw new Error('Invalid role');

    const admin = await createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error) throw new Error(error.message.includes('already') ? 'A user with this email already exists' : 'Invitation failed — check that SUPABASE_SERVICE_ROLE_KEY is configured on the server');

    if (data.user) {
      // New accounts default to inactive staff; the founder explicitly assigns
      // the role and activates the account here.
      const { error: upErr } = await admin.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName || email.split('@')[0],
        role,
        is_active: false
      });
      if (upErr) throw new Error('Invitation sent, but the profile could not be created: ' + upErr.message);
    }
    revalidatePath('/staff');
    return withAuditWarning(`Invitation sent to ${email} (${role}, inactive until activated)`, await audit('invite', 'staff', data.user?.id, { email, role, by: founder.id }));
  });
}

/**
 * Activate / deactivate / change role — founder only, verified server-side,
 * executed through the admin client (privileged operation).
 * A founder can never demote their own founder account.
 */
export async function updateStaffMember(formData: FormData) {
  return runAction(async () => {
    const founder = await requireFounderForAction();
    const id = String(formData.get('id'));
    if (id === founder.id) throw new Error('You cannot modify your own founder account');

    const updates: Record<string, unknown> = {};
    const role = blankToNull(formData.get('role'));
    const isActive = formData.get('is_active');
    const fullName = blankToNull(formData.get('full_name'));
    if (role) {
      if (!['admin', 'staff', 'founder'].includes(role)) throw new Error('Invalid role');
      updates.role = role;
    }
    if (isActive !== null) updates.is_active = isActive === 'true';
    if (fullName) updates.full_name = fullName;
    if (Object.keys(updates).length === 0) throw new Error('Nothing to update');

    const admin = await createAdminClient();
    const { error } = await admin.from('profiles').update(updates).eq('id', id);
    if (error) throw new Error('Update failed: ' + error.message);
    revalidatePath('/staff');
    return withAuditWarning('Staff member updated', await audit('update', 'staff', id, { ...updates, by: founder.id }));
  });
}

export async function assignRecord(formData: FormData) {
  return runAction(async (profile) => {
    if (profile.role === 'staff') throw new Error('Not permitted');
    const supabase = await createClient();
    const recordType = String(formData.get('record_type'));
    const recordId = String(formData.get('record_id'));
    const staffId = blankToNull(formData.get('staff_id'));
    const table = recordType === 'deal' ? 'deals' : recordType === 'project' ? 'projects' : 'prospects';
    const { error } = await supabase.from(table).update({ assigned_to: staffId }).eq('id', recordId);
    if (error) throw error;
    revalidatePath('/staff');
    return withAuditWarning('Assignment updated', await audit('assign', table, recordId, { staff_id: staffId }));
  });
}
