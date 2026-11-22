import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, Select, Badge } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { DealForm } from '@/components/forms';
import { saveDeal, updateDealStatus, convertDealToProject } from '@/actions/deals';
import { DEAL_STATUSES, label } from '@/lib/constants';
import { SubmitButton } from '@/components/submit-button';

export const dynamic = 'force-dynamic';

const STAGES = ['draft', 'proposal_sent', 'negotiation', 'won', 'lost', 'cancelled'] as const;

export default async function DealsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: deals }, { data: prospects }, { data: staffList }] = await Promise.all([
    supabase.from('deals').select('*, prospect:prospects(company_name)').order('created_at', { ascending: false }),
    supabase.from('prospects').select('id, company_name').order('company_name'),
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true)
  ]);

  const staff = (staffList ?? []).map((s) => ({ id: s.id, name: s.full_name || s.email }));
  const prospectOptions = (prospects ?? []).map((p) => ({ id: p.id, name: p.company_name }));
  const list = deals ?? [];
  const expectedRevenue = list.filter((d) => !['won', 'lost', 'cancelled'].includes(d.status)).reduce((s, d) => s + Number(d.deal_value), 0);

  return (
    <>
      <PageHeader title="Deals" description={`Expected revenue (open deals): ${formatNGN(expectedRevenue)} — actual revenue counts only successful payment transactions.`} />
      <DealForm action={saveDeal} prospects={prospectOptions} staff={staff} role={profile.role} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {STAGES.map((stage) => {
          const stageDeals = list.filter((d) => d.status === stage);
          return (
            <Card key={stage} className="flex flex-col">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h3 className="text-sm font-semibold">{label(stage)}</h3>
                <Badge tone={stage === 'won' ? 'green' : stage === 'lost' ? 'red' : stage === 'negotiation' ? 'gold' : 'neutral'}>{stageDeals.length}</Badge>
              </div>
              <div className="flex-1 space-y-3 p-3">
                {stageDeals.length === 0 ? <p className="px-1 py-4 text-center text-xs text-muted/60">No deals</p> : stageDeals.map((d) => (
                  <div key={d.id} className="rounded-md border border-line bg-surface-2 p-3">
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted">{d.prospect?.company_name ?? '—'}</p>
                    <p className="mt-1 text-sm text-gold tabular-nums">{formatNGN(d.deal_value)}</p>
                    <p className="text-[11px] text-muted">Close: {formatDate(d.expected_close_date)}{d.won_at ? ` · won ${formatDate(d.won_at)}` : ''}</p>
                    {profile.role === 'founder' ? (
                      <ActionForm action={updateDealStatus} className="mt-2">
                        <input type="hidden" name="id" value={d.id} />
                        <Select name="status" defaultValue={d.status} className="!py-1 text-xs">
                          {DEAL_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                        </Select>
                        <SubmitButton variant="ghost" className="mt-1 w-full !px-2 !py-1 text-xs">Update status</SubmitButton>
                      </ActionForm>
                    ) : d.status === 'proposal_sent' ? (
                      <ActionForm action={updateDealStatus} className="mt-2">
                        <input type="hidden" name="id" value={d.id} />
                        <Select name="status" defaultValue="negotiation" className="!py-1 text-xs">
                          <option value="negotiation">Negotiation</option>
                        </Select>
                        <SubmitButton variant="ghost" className="mt-1 w-full !px-2 !py-1 text-xs">Record client response</SubmitButton>
                      </ActionForm>
                    ) : <p className="mt-2 text-[11px] text-muted">Founder approval required for stage changes</p>}
                    {d.status === 'won' && profile.role === 'founder' ? (
                      <ActionForm action={convertDealToProject}>
                        <input type="hidden" name="id" value={d.id} />
                        <SubmitButton variant="ghost" className="mt-2 w-full !px-2 !py-1 text-xs">Convert to project</SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
