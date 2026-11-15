'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { runAction, audit, blankToNull } from './helpers';

export async function inviteStaff(formData: FormData) {
  return runAction(async (profile) => {
    if (profile.role !== 'founder') throw new Error('Only the founder can invite staff');
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const fullName = String(formData.get('full_name') ?? '').trim();
    const role = String(formData.get('role') ?? 'staff');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email');
    if (!['admin', 'staff'].includes(role)) throw new Error('Invalid role');

    const admin = await createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error) throw new Error(error.message.includes('already') ? 'A user with this email already exists' : 'Invitation failed');

    if (data.user) {
      const supabase = await createClient();
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName || email.split('@')[0],
        role
      });
    }
    await audit('invite', 'staff', data.user?.id, { email, role });
    revalidatePath('/staff');
    return `Invitation sent to ${email}`;
  });
}

export async function updateStaffMember(formData: FormData) {
  return runAction(async (profile) => {
    if (profile.role !== 'founder') throw new Error('Only the founder can manage staff');
    const supabase = await createClient();
    const id = String(formData.get('id'));
    const updates: Record<string, unknown> = {};
    const role = blankToNull(formData.get('role'));
    const isActive = formData.get('is_active');
    const fullName = blankToNull(formData.get('full_name'));
    if (role) {
      if (profile.id === id && role !== 'founder') throw new Error('You cannot demote your own founder account');
      updates.role = role;
    }
    if (isActive !== null) updates.is_active = isActive === 'true';
    if (fullName) updates.full_name = fullName;

    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) throw error;
    await audit('update', 'staff', id, updates);
    revalidatePath('/staff');
    return 'Staff member updated';
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
    await audit('assign', table, recordId, { staff_id: staffId });
    revalidatePath('/staff');
    return 'Assignment updated';
  });
}
