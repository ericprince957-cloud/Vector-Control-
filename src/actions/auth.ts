'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/login?error=' + encodeURIComponent('Invalid email or password'));

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', user?.id ?? '')
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    redirect('/login?error=' + encodeURIComponent('No staff profile exists for this account'));
  }
  if (!profile.is_active) {
    // Keep the session (so the user can be shown a clear restricted page and
    // sign out cleanly) but send them to the access-denied screen.
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
  if (password !== confirm) redirect('/reset-password?error=' + encodeURIComponent('Passwords do not match'));

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect('/reset-password?error=' + encodeURIComponent('Could not update password'));
  redirect('/overview');
}
