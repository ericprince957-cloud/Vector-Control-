import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'founder' | 'admin' | 'staff';
  is_active: boolean;
};

/**
 * Returns the authenticated user's profile, INCLUDING inactive accounts.
 * Callers must decide how to treat inactive accounts — returning null here
 * previously caused a middleware redirect loop for deactivated users.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', user.id)
    .single();

  return (data as Profile) ?? null;
}

/** Guard for protected pages. Inactive users get an access-restricted page, not a loop. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  if (!profile.is_active) redirect('/access-denied');
  return profile;
}

export async function requireFounder(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== 'founder') redirect('/overview');
  return profile;
}

export async function requireFinanceAccess(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role === 'staff') redirect('/overview');
  return profile;
}

/** Server-side verification helper for privileged server actions. */
export async function requireFounderForAction(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !profile.is_active) throw new Error('Not authenticated');
  if (profile.role !== 'founder') throw new Error('Only the founder can perform this action');
  return profile;
}
