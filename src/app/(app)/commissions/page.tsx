import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, CardHeader, StatCard, Table, TH, TD, Badge, EmptyState, ErrorState, Button, Input, Notice } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { FilterBar } from '@/components/filter-bar';
import { Pagination } from '@/components/pagination';
import { updateCommissionStatus, payApprovedCommissionBatch } from '@/actions/commissions';
import { PAGE_SIZE, pageParam, rangeFor, one, commissionTone } from '@/lib/ui-helpers';

export const metadata: Metadata = { title: 'Commissions', description: 'Sales commission ledger and payouts.' };
export const dynamic = 'force-dynamic';

type Rel<T> = T | T[] | null;
type Entry = {
  id: string; staff_id: string; client_name: string | null; deal_title: string | null;
  eligible_amount: number; commission_rate: number; commission_amount: number;
  status: 'pending' | 'approved' | 'paid' | 'void'; created_at: string; payout_reference: string | null;
  staff: Rel<{ full_name: string | null; email: string }>;
};
type SP = { status?: string; staff?: string; page?: string };
const STATUSES = ['pending', 'approved', 'paid', 'void'];

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const profile = await requireProfile();
  const isFounder = profile.role === 'founder';
  const sp = await searchParams;
  const supabase = await createClient();
  const page = pageParam(sp.page);
  const [from, to] = rangeFor(page);

  const cols = 'id, staff_id, client_name, deal_title, eligible_amount, commission_rate, commission_amount, status, created_at, payout_reference, staff:profiles!commission_entries_staff_id_fkey(full_name,email)';
  let list = supabase.from('commission_entries').select(cols, { count: 'exact' }).order('created_at', { ascending: false });
  let all = supabase.from('commission_entries').select(cols);
  // Staff only ever see their own ledger (RLS enforces it too).
  if (!isFounder && profile.role === 'staff') { list = list.eq('staff_id', profile.id); all = all.eq('staff_id', profile.id); }
  if (STATUSES.includes(sp.status ?? '')) list = list.eq('status', sp.status!);
  if (sp.staff && isFounder) list = list.eq('staff_id', sp.staff);

  const [{ data, count, error }, { data: allData, error: allError }] = await Promise.all([list.range(from, to), all]);
  const entries = (data ?? []) as unknown as Entry[];
  const ledger = (allData ?? []) as unknown as Entry[];
  const sum = (s: Entry['status']) => ledger.filter((e) => e.status === s).reduce((t, e) => t + Number(e.commission_amount), 0);

  const staffNames = new Map<string, string>();
  ledger.forEach((e) => { const s = one(e.staff); staffNames.set(e.staff_id, s?.full_name || s?.email || 'Sales representative'); });

  const groups = new Map<string, { name: string; net: number; count: number }>();
  if (isFounder) {
    for (const e of ledger.filter((x) => x.status === 'approved')) {
      const g = groups.get(e.staff_id) ?? { name: staffNames.get(e.staff_id) ?? 'Sales representative', net: 0, count: 0 };
      g.net += Number(e.commission_amount); g.count += 1; groups.set(e.staff_id, g);
    }
  }
  const payouts = ledger.filter((e) => e.status === 'paid' && e.payout_reference);
  const payoutHistory = [...new Map(payouts.map((p) => [`${p.staff_id}|${p.payout_reference}`, p])).values()].slice(0, 8);

  return (
    <>
      <PageHeader title="Commissions" description="10% of eligible successful payments actually received. Refunds create negative adjustments that reduce the next payout." />
      {error || allError ? <ErrorState title="Could not load commissions" message={(error ?? allError)?.message} /> : null}

      <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Awaiting approval" value={formatNGN(sum('pending'))} />
        <StatCard label="Approved (unpaid)" value={formatNGN(sum('approved'))} tone="gold" />
        <StatCard label="Paid out" value={formatNGN(sum('paid'))} tone="green" />
        <StatCard label="Net earned" value={formatNGN(sum('pending') + sum('approved') + sum('paid'))} />
      </section>

      {!isFounder ? <div className="mb-4"><Notice>Commissions are approved and paid by the founder. You can see your own ledger here.</Notice></div> : null}

      {isFounder ? (
        <Card className="mb-4">
          <CardHeader title="Process payouts" subtitle="Approved entries (including negative refund adjustments) are settled together per representative." />
          {!groups.size ? <EmptyState title="No approved commissions awaiting payout" /> : (
            <div className="divide-y divide-line">
              {[...groups.entries()].map(([staffId, g]) => (
                <div key={staffId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{g.name}</p>
                    <p className="mb-1 text-xs text-muted">{g.count} approved entries · net {formatNGN(g.net)}</p>
                    {g.net > 0 ? <Badge tone="green">Ready for payout</Badge> : <Badge tone="amber">Adjustment carries forward</Badge>}
                  </div>
                  {g.net > 0 ? (
                    <ActionForm
                      action={payApprovedCommissionBatch}
                      className="flex flex-col gap-2 sm:flex-row"
                      confirm={{ title: `Record ${formatNGN(g.net)} payout to ${g.name}?`, description: 'This marks all of their approved entries as paid. Make sure the transfer has been made.', confirmLabel: 'Record payout', danger: false }}
                    >
                      <input type="hidden" name="staff_id" value={staffId} />
                      <Input name="payout_reference" required aria-label="Payout reference" placeholder="Bank transfer reference" className="sm:w-56" />
                      <Button type="submit">Record payout</Button>
                    </ActionForm>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      <FilterBar
        basePath="/commissions"
        values={{ status: sp.status, staff: sp.staff }}
        filters={[
          { kind: 'select', name: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s })) },
          ...(isFounder ? [{ kind: 'select' as const, name: 'staff', label: 'Representative', options: [...staffNames.entries()].map(([value, label]) => ({ value, label })) }] : [])
        ]}
      />

      <Card>
        <CardHeader title="Commission ledger" subtitle={isFounder ? 'Approvals and payout records' : 'Your commission history'} />
        {!entries.length && !error ? (
          <EmptyState title="No commission entries" hint="An entry is created automatically when a successful payment is recorded on a deal assigned to a sales representative." />
        ) : (
          <>
            <Table minWidth={820}>
              <thead><tr>
                {isFounder ? <TH>Representative</TH> : null}
                <TH>Client / deal</TH><TH>Eligible</TH><TH>Rate</TH><TH>Commission</TH><TH>Status</TH><TH>Date</TH>
                {isFounder ? <TH>Action</TH> : null}
              </tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-2/60">
                    {isFounder ? <TD className="text-xs">{staffNames.get(e.staff_id) ?? '—'}</TD> : null}
                    <TD><p>{e.client_name || 'Client'}</p><p className="text-xs text-muted">{e.deal_title}</p></TD>
                    <TD className="tabular-nums">{formatNGN(e.eligible_amount)}</TD>
                    <TD>{Number(e.commission_rate)}%</TD>
                    <TD className={`tabular-nums font-medium ${Number(e.commission_amount) < 0 ? 'text-danger' : ''}`}>{formatNGN(e.commission_amount)}</TD>
                    <TD><Badge tone={commissionTone[e.status]}>{e.status}</Badge>{e.payout_reference ? <p className="mt-1 max-w-32 truncate text-[10px] text-muted">{e.payout_reference}</p> : null}</TD>
                    <TD className="whitespace-nowrap text-xs text-muted">{formatDate(e.created_at)}</TD>
                    {isFounder ? (
                      <TD>
                        {e.status === 'pending' ? (
                          <div className="flex gap-1">
                            <ActionForm action={updateCommissionStatus}>
                              <input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="approved" />
                              <Button type="submit" size="sm">Approve</Button>
                            </ActionForm>
                            <ActionForm action={updateCommissionStatus} confirm={{ title: 'Void this commission?', description: 'A voided commission will not be paid.', confirmLabel: 'Void', danger: true }}>
                              <input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="void" />
                              <Button type="submit" size="sm" variant="danger">Void</Button>
                            </ActionForm>
                          </div>
                        ) : <span className="text-xs text-muted">{e.status === 'approved' ? 'In next payout' : '—'}</span>}
                      </TD>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination basePath="/commissions" page={page} pageSize={PAGE_SIZE} total={count ?? entries.length} params={{ status: sp.status, staff: sp.staff }} />
          </>
        )}
      </Card>

      {payoutHistory.length ? (
        <Card className="mt-4">
          <CardHeader title="Recent payouts" />
          <ul>
            {payoutHistory.map((p) => (
              <li key={p.id} className="flex items-center justify-between border-b border-line/60 px-4 py-2.5 text-sm last:border-0">
                <span>{staffNames.get(p.staff_id)} <span className="text-xs text-muted">· ref {p.payout_reference}</span></span>
                <span className="text-xs text-muted">{formatDate(p.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
