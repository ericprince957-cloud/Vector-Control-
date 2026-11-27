import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireFounder } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { SubmitButton } from '@/components/submit-button';
import { ActionForm } from '@/components/action-form';
import { approveApplication, updateApplicationStatus } from '@/actions/applications';

export const metadata: Metadata = { title: 'Recruitment', description: 'Review Sales Representative applications.' };
export const dynamic = 'force-dynamic';

type Application = {
  id: string; full_name: string; email: string; phone: string; whatsapp: string | null;
  location: string | null; position: string; experience_level: string | null; years_experience: number | null;
  skills: string[]; portfolio_url: string | null; linkedin_url: string | null; github_url: string | null;
  cv_url: string | null; cover_letter: string | null; availability: string | null; status: string;
  admin_notes: string | null; created_at: string;
};

const statusTone: Record<string, 'green' | 'red' | 'gold' | 'blue' | 'neutral'> = {
  pending: 'gold', under_review: 'blue', shortlisted: 'blue', interview: 'blue', approved: 'green', rejected: 'red', withdrawn: 'neutral'
};

export default async function RecruitmentPage() {
  await requireFounder();
  const supabase = await createClient();
  const { data, error } = await supabase.from('staff_applications').select('*').order('created_at', { ascending: false });
  const applications = (data ?? []) as Application[];
  const counts = ['pending', 'under_review', 'shortlisted', 'interview', 'approved', 'rejected'].map((status) => ({
    status, count: applications.filter((a) => a.status === status).length
  }));

  return (
    <>
      <PageHeader title="Recruitment" description="Review applicants for the Sales Representative role. Approvals send secure account invitations." />
      {error ? <p role="alert" className="mb-4 rounded border border-danger/40 p-3 text-sm text-danger">Could not load applications. Check the recruitment table permissions.</p> : null}
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {counts.map((item) => <div key={item.status} className="rounded-[5px] border border-line bg-surface p-3"><p className="text-[10px] uppercase tracking-wider text-muted">{item.status.replace('_', ' ')}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{item.count}</p></div>)}
      </section>
      <Card>
        <CardHeader title="Applications" subtitle="Newest applications appear first. Only the founder can review and approve applicants." />
        {!applications.length ? <EmptyState title="No applications yet" hint="Share the public careers page to start receiving applications." /> : (
          <div className="divide-y divide-line">
            {applications.map((a) => <article key={a.id} className="p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-base font-semibold">{a.full_name}</h2><p className="mt-1 text-xs text-muted">{a.email} · {a.phone}{a.location ? ` · ${a.location}` : ''}</p></div>
                <Badge tone={statusTone[a.status] ?? 'neutral'}>{a.status.replace('_', ' ')}</Badge>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2 text-xs text-muted">
                  <p><strong className="text-text">Experience:</strong> {(a.experience_level || 'Not specified').replaceAll('_', ' ')}{a.years_experience !== null ? ` · ${a.years_experience} years` : ''}</p>
                  <p><strong className="text-text">Availability:</strong> {(a.availability || 'Not specified').replaceAll('_', ' ')}</p>
                  <p><strong className="text-text">Skills:</strong> {a.skills?.join(', ') || 'Not provided'}</p>
                  <p><strong className="text-text">WhatsApp:</strong> {a.whatsapp || 'Not provided'}</p>
                  <div className="flex flex-wrap gap-3 pt-1">
                    {a.portfolio_url ? <a className="text-gold underline" href={a.portfolio_url} target="_blank" rel="noreferrer">Portfolio</a> : null}
                    {a.linkedin_url ? <a className="text-gold underline" href={a.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a> : null}
                    {a.github_url ? <a className="text-gold underline" href={a.github_url} target="_blank" rel="noreferrer">GitHub</a> : null}
                    {a.cv_url ? <a className="text-gold underline" href={a.cv_url} target="_blank" rel="noreferrer">CV</a> : null}
                  </div>
                </div>
                <div className="rounded-[5px] bg-surface-2 p-3 text-sm leading-6 text-muted"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text">Why they want to join</p>{a.cover_letter || 'No cover letter provided.'}</div>
              </div>
              <p className="mt-3 text-[10px] text-muted">Applied {formatDate(a.created_at)}</p>
              {a.admin_notes ? <p className="mt-2 text-xs text-muted"><strong className="text-text">Internal note:</strong> {a.admin_notes}</p> : null}
              {a.status !== 'approved' && a.status !== 'rejected' && a.status !== 'withdrawn' ? (
                <div className="mt-5 grid gap-3 border-t border-line pt-4 lg:grid-cols-[1fr_auto]">
                  <ActionForm action={updateApplicationStatus} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={a.id} />
                    <input name="admin_notes" defaultValue={a.admin_notes || ''} placeholder="Internal review note (optional)" className="min-h-10 min-w-0 flex-1 rounded-[5px] border border-line-strong bg-surface px-3 text-xs" />
                    <select name="status" defaultValue={a.status === 'pending' ? 'under_review' : a.status} className="min-h-10 rounded-[5px] border border-line-strong bg-surface px-2 text-xs">
                      <option value="under_review">Under review</option><option value="shortlisted">Shortlist</option><option value="interview">Interview</option><option value="rejected">Reject</option>
                    </select>
                    <SubmitButton variant="subtle" size="sm" pendingLabel="Saving…">Update</SubmitButton>
                  </form>
                  <form action={approveApplication}>
                    <input type="hidden" name="id" value={a.id} />
                    <SubmitButton size="sm" pendingLabel="Sending invite…">Approve &amp; send invite</SubmitButton>
                  </form>
                </div>
              ) : null}
            </article>)}
          </div>
        )}
      </Card>
    </>
  );
}
