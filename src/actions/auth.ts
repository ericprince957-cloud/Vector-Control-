'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_STAFF_PASSWORD } from '@/lib/constants';

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/login?error=' + encodeURIComponent('Invalid email or password'));

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileRecord } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', user?.id ?? '')
    .maybeSingle();

  // Keep this narrow runtime shape explicit: the query can return no profile
  // during auth bootstrap, and no caller should infer access from user metadata.
  const profile = profileRecord as { is_active: boolean } | null;

  if (!profile) {
    await supabase.auth.signOut();
    redirect('/login?error=' + encodeURIComponent('No staff profile exists for this account'));
  }
  if (!profile.is_active) {
    redirect('/access-denied');
  }

  redirect('/overview');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get('email') ?? '');
  const headerList = await headers();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000';
  const proto = headerList.get('x-forwarded-proto') ?? 'http';
  const base = appUrl || `${proto}://${host}`;
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${base}/reset-password` });
  redirect('/login?message=' + encodeURIComponent('If the email exists, a reset link has been sent'));
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) redirect('/reset-password?error=' + encodeURIComponent('Password must be at least 8 characters'));
  if (password === DEFAULT_STAFF_PASSWORD) redirect('/reset-password?error=' + encodeURIComponent('Choose a password different from the default one'));
  if (password !== confirm) redirect('/reset-password?error=' + encodeURIComponent('Passwords do not match'));

  const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
  if (error) redirect('/reset-password?error=' + encodeURIComponent('Could not update password'));
  redirect('/overview');
}
