import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'founder' | 'admin' | 'staff';
  is_active: boolean;
};

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', user.id)
    .single();

  if (!data || !data.is_active) return null;
  return data as Profile;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect('/login');
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
