'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireFounderForAction } from '@/lib/auth';
import { runAction, audit, withAuditWarning } from './helpers';

const applicationSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(40),
  whatsapp: z.string().trim().max(40).optional(),
  location: z.string().trim().max(120).optional(),
  experience_level: z.enum(['no_experience', 'entry_level', 'intermediate', 'experienced']),
  years_experience: z.coerce.number().min(0).max(60).optional(),
  skills: z.string().max(600).optional(),
  portfolio_url: z.union([z.string().url(), z.literal('')]).optional(),
  linkedin_url: z.union([z.string().url(), z.literal('')]).optional(),
  github_url: z.union([z.string().url(), z.literal('')]).optional(),
  cv_url: z.union([z.string().url(), z.literal('')]).optional(),
  cover_letter: z.string().trim().min(40).max(3000),
  availability: z.enum(['immediately', 'one_week', 'two_weeks', 'flexible']),
  website: z.string().max(0).optional()
});

export async function submitApplication(formData: FormData) {
  const parsed = applicationSchema.safeParse({
    full_name: formData.get('full_name'),
    email: String(formData.get('email') ?? '').toLowerCase(),
    phone: formData.get('phone'),
    whatsapp: formData.get('whatsapp'),
    location: formData.get('location'),
    experience_level: formData.get('experience_level'),
    years_experience: formData.get('years_experience') || undefined,
    skills: formData.get('skills'),
    portfolio_url: formData.get('portfolio_url'),
    linkedin_url: formData.get('linkedin_url'),
    github_url: formData.get('github_url'),
    cv_url: formData.get('cv_url'),
    cover_letter: formData.get('cover_letter'),
    availability: formData.get('availability'),
    website: formData.get('website')
  });

  if (!parsed.success) {
    redirect('/careers?error=' + encodeURIComponent(parsed.error.issues[0]?.message || 'Please check your application details') + '#apply');
  }

  const data = parsed.data;
  if (data.website) redirect('/careers?submitted=1');

  const supabase = await createClient();
  const { error } = await supabase.from('staff_applications').insert({
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    whatsapp: data.whatsapp || null,
    location: data.location || null,
    position: 'Sales Representative',
    employment_type: 'commission',
    experience_level: data.experience_level,
    years_experience: data.years_experience ?? null,
    skills: (data.skills || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 15),
    portfolio_url: data.portfolio_url || null,
    linkedin_url: data.linkedin_url || null,
    github_url: data.github_url || null,
    cv_url: data.cv_url || null,
    cover_letter: data.cover_letter,
    availability: data.availability,
    status: 'pending'
  });

  if (error) {
    const message = error.code === '23505'
      ? 'An active application already exists for this email address.'
      : 'We could not submit your application right now. Please try again.';
    redirect('/careers?error=' + encodeURIComponent(message) + '#apply');
  }

  revalidatePath('/recruitment');
  redirect('/careers?submitted=1');
}

export async function updateApplicationStatus(formData: FormData) {
  return runAction(async () => {
    const founder = await requireFounderForAction();
    const id = String(formData.get('id') ?? '').trim();
    const status = String(formData.get('status') ?? '');
    const adminNotes = String(formData.get('admin_notes') ?? '').trim();
    if (!id) throw new Error('Application not found');
    if (!['under_review', 'shortlisted', 'interview', 'rejected', 'withdrawn'].includes(status)) {
      throw new Error('Choose a valid review status');
    }

    const admin = await createAdminClient();
    const { error } = await admin.from('staff_applications').update({
      status,
      admin_notes: adminNotes || null,
      reviewed_by: founder.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', id);
    if (error) throw new Error('Could not update this application');

    revalidatePath('/recruitment');
    return withAuditWarning('Application updated', await audit('update', 'staff_application', id, { status }));
  });
}

export async function approveApplication(formData: FormData) {
  return runAction(async () => {
    const founder = await requireFounderForAction();
    const id = String(formData.get('id') ?? '').trim();
    if (!id) throw new Error('Application not found');

    const admin = await createAdminClient();
    const { data: application, error: lookupError } = await admin
      .from('staff_applications')
      .select('id, full_name, email, status')
      .eq('id', id)
      .single();
    if (lookupError || !application) throw new Error('Could not find this application');
    if (application.status === 'approved') throw new Error('This application has already been approved');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error('Server configuration is missing NEXT_PUBLIC_APP_URL');
    const redirectTo = new URL('/auth/callback?next=%2Fset-password', appUrl).toString();

    const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(application.email, {
      redirectTo,
      data: { full_name: application.full_name, source: 'careers_application' }
    });
    if (inviteError || !invitation.user) {
      throw new Error(inviteError?.message.includes('already') 
        ? 'An account already exists for this email. Review the existing staff account before approving this application.'
        : 'The invitation email could not be sent. Check Supabase Auth email configuration and try again.');
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: invitation.user.id,
      email: application.email,
      full_name: application.full_name,
      role: 'staff',
      is_active: false
    });
    if (profileError) throw new Error('Invitation sent, but the inactive staff profile could not be prepared. Contact the system administrator.');

    const { error: updateError } = await admin.from('staff_applications').update({
      status: 'approved',
      reviewed_by: founder.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', id);
    if (updateError) throw new Error('Invitation sent, but the application status could not be updated.');

    revalidatePath('/recruitment');
    revalidatePath('/staff');
    return withAuditWarning(
      `Application approved. A secure account invitation was sent to ${application.email}. The account remains inactive until you activate it in Staff.`,
      await audit('approve_and_invite', 'staff_application', id, { email: application.email, user_id: invitation.user.id })
    );
  });
}
