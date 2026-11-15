import { createClient } from '@/lib/supabase/server';
import { requireFinanceAccess } from '@/lib/auth';
import { formatNGN, formatDate, monthKey } from '@/lib/utils';
import { Card, CardHeader, StatCard, Table, TH, TD, EmptyState, Badge, Button } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { PaymentForm, ExpenseForm } from '@/components/forms';
import { savePayment, saveExpense } from '@/actions/finance';
import { label } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const statusTone: Record<string, 'green' | 'red' | 'amber' | 'neutral'> = {
  successful: 'green', failed: 'red', pending: 'amber', refunded: 'neutral'
};

export default async function FinancePage() {
  await requireFinanceAccess();
  const supabase = await createClient();

  const [{ data: payments }, { data: expenses }, { data: deals }] = await Promise.all([
    supabase.from('payments').select('*, deal:deals(title, client_name)').order('received_at', { ascending: false }),
    supabase.from('expenses').select('*').order('spent_at', { ascending: false }),
    supabase.from('deals').select('id, title, status, quoted_amount, negotiated_amount, prospect_id(company_name)')
  ]);

  const pays = payments ?? [];
  const exps = expenses ?? [];
  const successful = pays.filter((p) => p.status === 'successful');
  const refunded = pays.filter((p) => p.status === 'refunded');
  const revenue = successful.reduce((s, p) => s + Number(p.amount), 0) - refunded.reduce((s, p) => s + Number(p.amount), 0);
  const thisMonth = monthKey(new Date());
  const lastMonthDate = new Date(); lastMonthDate.setUTCMonth(lastMonthDate.getUTCMonth() - 1);
  const lastMonth = monthKey(lastMonthDate);

  const revenueThisMonth = successful.filter((p) => monthKey(p.received_at) === thisMonth).reduce((s, p) => s + Number(p.amount), 0);
  const revenueLastMonth = successful.filter((p) => monthKey(p.received_at) === lastMonth).reduce((s, p) => s + Number(p.amount), 0);
  const expensesTotal = exps.reduce((s, e) => s + Number(e.amount), 0);

  const outstanding = (deals ?? []).filter((d) => d.status === 'won').reduce((s, d) => {
    const value = Number(d.negotiated_amount ?? d.quoted_amount ?? 0);
    const paid = successful.filter((p) => p.deal_id === d.id).reduce((ps, p) => ps + Number(p.amount), 0);
    return s + Math.max(0, value - paid);
  }, 0);

  const revenueByService = new Map<string, number>();
  for (const p of successful) {
    const deal = (deals ?? []).find((d) => d.id === p.deal_id);
    const key = deal?.service || 'Other';
    revenueByService.set(key, (revenueByService.get(key) ?? 0) + Number(p.amount));
  }

  return (
    <>
      <PageHeader title="Finance" description="All amounts in Nigerian Naira (NGN). Revenue = successful payments, adjusted for refunds.">
        <a href="/api/export?type=payments"><Button variant="ghost">Export payments</Button></a>
        <a href="/api/export?type=expenses"><Button variant="ghost">Export expenses</Button></a>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total revenue" value={formatNGN(revenue)} tone="green" />
        <StatCard label="Revenue (this month)" value={formatNGN(revenueThisMonth)} tone="gold" />
        <StatCard label="Revenue (last month)" value={formatNGN(revenueLastMonth)} />
        <StatCard label="Outstanding balances" value={formatNGN(outstanding)} tone="gold" />
        <StatCard label="Total expenses" value={formatNGN(expensesTotal)} tone="red" />
        <StatCard label="Net operating result" value={formatNGN(revenue - expensesTotal)} tone={revenue - expensesTotal >= 0 ? 'green' : 'red'} />
      </div>

      <div className="mb-6">
        <PaymentForm action={savePayment} deals={(deals ?? []).map((d) => ({ id: d.id, name: `${d.title} — ${d.prospect_id?.company_name ?? ''}` }))} />
        <ExpenseForm action={saveExpense} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Payments" subtitle={`${pays.length} records`} />
          {!pays.length ? <EmptyState title="No payments recorded" /> : (
            <Table>
              <thead><tr><TH>Date</TH><TH>Client / Deal</TH><TH>Amount</TH><TH>Status</TH></tr></thead>
              <tbody>
                {pays.slice(0, 25).map((p) => (
                  <tr key={p.id}>
                    <TD className="text-xs">{formatDate(p.received_at)}</TD>
                    <TD>{p.client_name || p.deal?.title || '—'}</TD>
                    <TD className="tabular-nums">{formatNGN(p.amount)}</TD>
                    <TD><Badge tone={statusTone[p.status]}>{p.status}</Badge></TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Expenses" subtitle={`${exps.length} records`} />
          {!exps.length ? <EmptyState title="No expenses recorded" /> : (
            <Table>
              <thead><tr><TH>Date</TH><TH>Title</TH><TH>Category</TH><TH>Amount</TH></tr></thead>
              <tbody>
                {exps.slice(0, 25).map((e) => (
                  <tr key={e.id}>
                    <TD className="text-xs">{formatDate(e.spent_at)}</TD>
                    <TD>{e.title}</TD>
                    <TD className="capitalize text-muted">{e.category}</TD>
                    <TD className="tabular-nums text-red-400">{formatNGN(e.amount)}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Revenue by service" />
        <div className="p-4">
          {revenueByService.size === 0 ? <EmptyState title="No revenue yet" /> : [...revenueByService.entries()].sort((a, b) => b[1] - a[1]).map(([service, amount]) => (
            <div key={service} className="flex items-center justify-between border-b border-line/50 py-2 text-sm last:border-0">
              <span className="capitalize">{service}</span>
              <span className="text-emerald-400 tabular-nums">{formatNGN(amount)}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
