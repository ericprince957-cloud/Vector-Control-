import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, CardHeader, StatCard, Table, TH, TD, Badge, EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { SubmitButton } from '@/components/submit-button';
import { updateCommissionStatus } from '@/actions/commissions';

export const dynamic = 'force-dynamic';

type CommissionEntry = {
  id: string;
  staff_id: string;
  client_name: string;
  deal_title: string;
  eligible_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: 'pending' | 'approved' | 'paid' | 'void';
  created_at: string;
  payout_reference: string;
  staff?: { full_name: string | null; email: string } | null;
};

const tone: Record<CommissionEntry['status'], 'amber' | 'gold' | 'green' | 'red'> = {
  pending: 'amber',
  approved: 'gold',
  paid: 'green',
  void: 'red'
};

export default async function CommissionsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('commission_entries')
    .select('id, staff_id, client_name, deal_title, eligible_amount, commission_rate, commission_amount, status, created_at, payout_reference, staff:profiles!commission_entries_staff_id_fkey(full_name,email)')
    .order('created_at', { ascending: false });

  if (error) throw new Error('Could not load commission records');
  const entries = (data ?? []) as unknown as CommissionEntry[];
  const isFounder = profile.role === 'founder';
  const total = entries.filter((e) => e.status !== 'void').reduce((sum, e) => sum + Number(e.commission_amount), 0);
  const pending = entries.filter((e) => e.status === 'pending').reduce((sum, e) => sum + Number(e.commission_amount), 0);
  const approved = entries.filter((e) => e.status === 'approved').reduce((sum, e) => sum + Number(e.commission_amount), 0);
  const paid = entries.filter((e) => e.status === 'paid').reduce((sum, e) => sum + Number(e.commission_amount), 0);

  return (
    <>
      <PageHeader title="Commissions" description="Sales commission is 10% of eligible payments actually received. Refunds create negative adjustments." />
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Net commission earned" value={formatNGN(total)} tone="gold" />
        <StatCard label="Awaiting approval" value={formatNGN(pending)} />
        <StatCard label="Approved for payout" value={formatNGN(approved)} tone="gold" />
        <StatCard label="Paid out" value={formatNGN(paid)} tone="green" />
      </div>

      <Card>
        <CardHeader title="Commission ledger" subtitle={isFounder ? 'Founder-controlled approvals and payout records' : 'Your personal commission history'} />
        {!entries.length ? <EmptyState title="No commission entries yet" hint="A commission entry is created automatically when a successful payment is recorded against a deal assigned to a sales representative." /> : (
          <Table>
            <thead>
              <tr>
                {isFounder ? <TH>Representative</TH> : null}
                <TH>Client / deal</TH>
                <TH>Eligible payment</TH>
                <TH>Rate</TH>
                <TH>Commission</TH>
                <TH>Status</TH>
                <TH>Date</TH>
                {isFounder ? <TH>Action</TH> : null}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  {isFounder ? <TD className="text-xs">{entry.staff?.full_name || entry.staff?.email || 'Former staff'}</TD> : null}
                  <TD>
                    <p className="font-medium">{entry.client_name || 'Client'}</p>
                    <p className="text-xs text-muted">{entry.deal_title}</p>
                  </TD>
                  <TD className="tabular-nums">{formatNGN(entry.eligible_amount)}</TD>
                  <TD>{Number(entry.commission_rate)}%</TD>
                  <TD className="tabular-nums font-semibold">{formatNGN(entry.commission_amount)}</TD>
                  <TD><Badge tone={tone[entry.status]}>{entry.status}</Badge></TD>
                  <TD className="text-xs text-muted">{formatDate(entry.created_at)}</TD>
                  {isFounder ? (
                    <TD>
                      {entry.status === 'pending' ? (
                        <div className="flex flex-wrap gap-1">
                          <form action={updateCommissionStatus}>
                            <input type="hidden" name="id" value={entry.id} />
                            <input type="hidden" name="status" value="approved" />
                            <SubmitButton className="!px-2 !py-1 text-xs">Approve</SubmitButton>
                          </form>
                          <form action={updateCommissionStatus}>
                            <input type="hidden" name="id" value={entry.id} />
                            <input type="hidden" name="status" value="void" />
                            <SubmitButton variant="ghost" className="!px-2 !py-1 text-xs">Void</SubmitButton>
                          </form>
                        </div>
                      ) : entry.status === 'approved' ? (
                        <form action={updateCommissionStatus} className="flex flex-col gap-1">
                          <input type="hidden" name="id" value={entry.id} />
                          <input type="hidden" name="status" value="paid" />
                          <input name="payout_reference" placeholder="Payout reference (optional)" className="w-40 rounded border border-line bg-surface px-2 py-1 text-xs" />
                          <SubmitButton className="!px-2 !py-1 text-xs">Mark paid</SubmitButton>
                        </form>
                      ) : <span className="text-xs text-muted">—</span>}
                    </TD>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">Commission is calculated from successful payment records, not deal value or unpaid invoices. Assign the sales representative to the deal before recording client payments. Successful payment records are immutable; record refunds as separate refund transactions.</p>
    </>
  );
}
