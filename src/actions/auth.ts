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
  const { data } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', user?.id ?? '')
    .single();

  if (data && !data.is_active) {
    await supabase.auth.signOut();
    redirect('/login?error=' + encodeURIComponent('This account has been deactivated'));
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
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000';
  const proto = headerList.get('x-forwarded-proto') ?? 'http';
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${proto}://${host}/reset-password` });
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
