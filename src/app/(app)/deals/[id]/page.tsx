import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, CardHeader, Table, TH, TD, Badge, EmptyState, DetailRow, StatCard, Button } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { DealDialog } from '@/components/forms';
import { DealStageControl } from '@/components/deal-controls';
import { saveDeal, updateDealStatus, convertDealToProject } from '@/actions/deals';
import { label } from '@/lib/constants';
import { dealTone, paymentTone, projectTone, taskTone, one, netAmount } from '@/lib/ui-helpers';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('deals').select('title').eq('id', id).maybeSingle();
  return { title: data?.title ?? 'Deal' };
}

export default async function DealDetail({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const isFounder = profile.role === 'founder';
  const canViewFinance = profile.role !== 'staff';
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from('deals')
    .select('*, prospect:prospects(id, company_name, contact_name), assigned:profiles!deals_assigned_to_fkey(full_name)')
    .eq('id', id)
    .maybeSingle();
  if (!deal) notFound();

  const empty = Promise.resolve({ data: null as null });
  const [paymentsRes, tasksRes, projectsRes, rejectionsRes, prospectsRes, staffRes] = await Promise.all([
    canViewFinance ? supabase.from('payments').select('id, amount, status, transaction_type, payment_method, paid_at').eq('deal_id', id).order('paid_at', { ascending: false }) : empty,
    supabase.from('tasks').select('id, title, status, due_at').eq('deal_id', id),
    supabase.from('projects').select('id, project_name, status').eq('deal_id', id),
    supabase.from('rejections').select('id, category, reason, rejected_at').eq('deal_id', id),
    supabase.from('prospects').select('id, company_name').order('company_name'),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true)
  ]);

  const prospect = one(deal.prospect as { id: string; company_name: string; contact_name: string | null } | { id: string; company_name: string; contact_name: string | null }[] | null);
  const payments = (paymentsRes.data ?? []) as { id: string; amount: number; status: string; transaction_type: string; payment_method: string; paid_at: string }[];
  const tasks = tasksRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const rejections = rejectionsRes.data ?? [];
  const staff = (staffRes.data ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const prospectOptions = (prospectsRes.data ?? []).map((p) => ({ id: p.id, name: p.company_name }));

  const received = payments.reduce((s, p) => s + netAmount(p), 0);
  const outstanding = deal.status === 'won' ? Math.max(0, Number(deal.deal_value) - received) : 0;

  return (
    <>
      <PageHeader
        back={{ href: '/deals', label: 'Pipeline' }}
        title={deal.title}
        description={prospect ? `For ${prospect.company_name}` : undefined}
      >
        <Badge tone={dealTone[deal.status]}>{label(deal.status)}</Badge>
        <DealDialog action={saveDeal} prospects={prospectOptions} staff={staff} isFounder={isFounder} deal={deal} />
        {deal.status === 'won' && isFounder && projects.length === 0 ? (
          <ActionForm
            action={convertDealToProject}
            confirm={{ title: 'Create a client project from this deal?', description: 'A new project is created using this deal’s approved value and assignee.', confirmLabel: 'Create project', danger: false }}
          >
            <input type="hidden" name="id" value={deal.id} />
            <Button type="submit">Convert to project</Button>
          </ActionForm>
        ) : null}
      </PageHeader>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={isFounder ? 'Deal value' : 'Proposed value'} value={formatNGN(deal.deal_value)} tone="gold" />
        {canViewFinance ? <StatCard label="Received" value={formatNGN(received)} tone="green" hint="Successful payments, net of refunds" /> : null}
        {canViewFinance ? <StatCard label="Outstanding" value={formatNGN(outstanding)} hint={deal.status === 'won' ? undefined : 'Applies once the deal is won'} /> : null}
        <StatCard label="Expected close" value={formatDate(deal.expected_close_date)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Description & negotiation notes" subtitle="Use Edit to record negotiation updates." />
            <p className="whitespace-pre-wrap px-4 py-4 text-sm text-muted">{deal.description || 'No notes recorded yet.'}</p>
          </Card>

          {canViewFinance ? (
            <Card>
              <CardHeader title="Payments for this deal" />
              {!payments.length ? <EmptyState title="No payments recorded for this deal" /> : (
                <Table minWidth={520}>
                  <thead><tr><TH>Date</TH><TH>Amount</TH><TH>Method</TH><TH>Status</TH></tr></thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <TD className="text-xs">{formatDate(p.paid_at)}</TD>
                        <TD className={`tabular-nums ${p.transaction_type === 'refund' ? 'text-danger' : ''}`}>{p.transaction_type === 'refund' ? '−' : ''}{formatNGN(p.amount)}</TD>
                        <TD className="text-muted">{label(p.payment_method)}</TD>
                        <TD><Badge tone={paymentTone[p.status]}>{p.status}</Badge></TD>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Linked tasks" />
            {!tasks.length ? <EmptyState title="No tasks linked to this deal" /> : (
              <ul>
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-2.5 text-sm last:border-0">
                    <span className="truncate">{t.title}</span>
                    <Badge tone={taskTone[t.status]}>{label(t.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Stage" subtitle={isFounder ? 'Founder approval' : undefined} />
            <div className="p-4">
              <DealStageControl action={updateDealStatus} dealId={deal.id} status={deal.status} isFounder={isFounder} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <dl className="px-4 py-1">
              <DetailRow label="Prospect">{prospect ? <Link href={`/prospects/${prospect.id}`} className="hover:text-gold">{prospect.company_name}</Link> : '—'}</DetailRow>
              <DetailRow label="Contact">{prospect?.contact_name || '—'}</DetailRow>
              <DetailRow label="Responsible">{one(deal.assigned as { full_name: string } | { full_name: string }[] | null)?.full_name ?? 'Unassigned'}</DetailRow>
              <DetailRow label="Created">{formatDate(deal.created_at)}</DetailRow>
              <DetailRow label="Won">{formatDate(deal.won_at)}</DetailRow>
            </dl>
          </Card>

          {projects.length ? (
            <Card>
              <CardHeader title="Projects from this deal" />
              <ul>
                {projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-2.5 text-sm last:border-0">
                    <Link href={`/projects/${p.id}`} className="truncate hover:text-gold">{p.project_name}</Link>
                    <Badge tone={projectTone[p.status]}>{label(p.status)}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {rejections.length ? (
            <Card>
              <CardHeader title="Rejection record" />
              <ul>
                {rejections.map((r) => (
                  <li key={r.id} className="border-b border-line/60 px-4 py-2.5 text-sm last:border-0">
                    <Badge>{label(r.category)}</Badge>
                    {r.reason ? <p className="mt-1 text-xs text-muted">{r.reason}</p> : null}
                    <p className="text-[11px] text-muted">{formatDate(r.rejected_at)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
