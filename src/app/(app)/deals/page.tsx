import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, Badge, EmptyState, ErrorState, StatCard, Button } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { DealDialog } from '@/components/forms';
import { DealStageControl } from '@/components/deal-controls';
import { deleteDeal, saveDeal, updateDealStatus, convertDealToProject } from '@/actions/deals';
import { label } from '@/lib/constants';
import { dealTone, one } from '@/lib/ui-helpers';

export const metadata: Metadata = { title: 'Deals', description: 'Sales pipeline and deal approvals.' };
export const dynamic = 'force-dynamic';

const STAGES = ['draft', 'proposal_sent', 'negotiation', 'won', 'lost', 'cancelled'] as const;

export default async function DealsPage() {
  const profile = await requireProfile();
  const isFounder = profile.role === 'founder';
  const supabase = await createClient();

  const [{ data: deals, error }, { data: prospects }, { data: staffList }, { data: projects }] = await Promise.all([
    supabase
      .from('deals')
      .select('id, title, status, deal_value, expected_close_date, won_at, prospect_id, assigned_to, prospect:prospects(company_name), assigned:profiles!deals_assigned_to_fkey(full_name)')
      .order('created_at', { ascending: false }),
    supabase.from('prospects').select('id, company_name').order('company_name'),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true),
    supabase.from('projects').select('deal_id').not('deal_id', 'is', null)
  ]);

  const staff = (staffList ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const prospectOptions = (prospects ?? []).map((p) => ({ id: p.id, name: p.company_name }));
  const list = deals ?? [];
  const converted = new Set((projects ?? []).map((p) => p.deal_id));
  const sum = (status: string) => list.filter((d) => d.status === status).reduce((s, d) => s + Number(d.deal_value), 0);
  const openValue = sum('draft') + sum('proposal_sent') + sum('negotiation');
  const decided = list.filter((d) => d.status === 'won' || d.status === 'lost').length;
  const winRate = decided ? (list.filter((d) => d.status === 'won').length / decided) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Deals"
        description={isFounder ? 'Approve pricing, decide outcomes and convert won deals into projects.' : 'Submit deal drafts and record client responses. Final pricing and outcomes are approved by the founder.'}
      >
        <DealDialog action={saveDeal} prospects={prospectOptions} staff={staff} isFounder={isFounder} />
      </PageHeader>

      {error ? <ErrorState title="Could not load deals" message={error.message} /> : null}

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Open pipeline value" value={formatNGN(openValue)} tone="gold" hint="Expected — not revenue until paid" />
        <StatCard label="Won value" value={formatNGN(sum('won'))} tone="green" />
        <StatCard label="Lost value" value={formatNGN(sum('lost'))} tone="red" />
        <StatCard label="Win rate" value={`${winRate.toFixed(0)}%`} hint="Won ÷ (won + lost)" />
      </section>

      <div className="vc-scroll -mx-3 overflow-x-auto px-3 pb-3 sm:mx-0 sm:px-0">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {STAGES.map((stage) => {
            const stageDeals = list.filter((d) => d.status === stage);
            return (
              <section key={stage} aria-label={`${label(stage)} deals`} className="w-[17.5rem] shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{label(stage)}</h2>
                  <Badge tone={dealTone[stage]}>{stageDeals.length}</Badge>
                </div>
                <p className="mb-2 px-1 text-xs tabular-nums text-muted">{formatNGN(stageDeals.reduce((s, d) => s + Number(d.deal_value), 0))}</p>
                <div className="space-y-2">
                  {stageDeals.length === 0 ? (
                    <Card className="border-dashed"><EmptyState title="No deals" /></Card>
                  ) : stageDeals.map((d) => (
                    <Card key={d.id} className="p-3">
                      <Link href={`/deals/${d.id}`} className="block text-sm font-medium hover:text-gold">{d.title}</Link>
                      <p className="text-xs text-muted">{one(d.prospect as { company_name: string } | { company_name: string }[] | null)?.company_name ?? '—'}</p>
                      <p className="mt-2 text-sm tabular-nums text-gold">{formatNGN(d.deal_value)}</p>
                      <p className="text-[11px] text-muted">
                        {one(d.assigned as { full_name: string } | { full_name: string }[] | null)?.full_name ?? 'Unassigned'} · close {formatDate(d.expected_close_date)}
                      </p>
                      {isFounder ? <ActionForm action={deleteDeal} className="mt-2" confirm={{ title: 'Permanently delete this deal?', description: 'Linked project references and payment ledger links will be detached. Financial transactions remain in the ledger. This cannot be undone.', confirmLabel: 'Delete deal' }}><input type="hidden" name="id" value={d.id} /><Button type="submit" variant="danger" size="sm" className="w-full">Delete deal</Button></ActionForm> : null}
                      <div className="mt-3">
                        <DealStageControl action={updateDealStatus} dealId={d.id} status={d.status} isFounder={isFounder} compact />
                      </div>
                      {d.status === 'won' && isFounder ? (
                        converted.has(d.id) ? (
                          <p className="mt-2 text-[11px] text-success">Project created</p>
                        ) : (
                          <ActionForm
                            action={convertDealToProject}
                            className="mt-2"
                            confirm={{ title: 'Create a client project from this deal?', description: 'A new project is created using this deal’s approved value and assignee. This authorises delivery work to begin.', confirmLabel: 'Create project', danger: false }}
                          >
                            <input type="hidden" name="id" value={d.id} />
                            <Button type="submit" variant="primary" size="sm" className="w-full">Convert to project</Button>
                          </ActionForm>
                        )
                      ) : null}
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
