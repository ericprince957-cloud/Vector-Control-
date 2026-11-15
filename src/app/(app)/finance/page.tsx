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

type FinancialOverview = {
  total_net_revenue: number; total_expenses: number; net_operating_result: number;
  outstanding_balance: number; current_month_net_revenue: number; current_month_expenses: number;
};

export default async function FinancePage() {
  await requireFinanceAccess();
  const supabase = await createClient();

  const [finRes, paymentsRes, expensesRes, dealsRes, projectsRes] = await Promise.all([
    supabase.from('financial_overview').select('*').maybeSingle(),
    supabase.from('payments').select('*, deal:deals(title), project:projects(project_name)').order('paid_at', { ascending: false }),
    supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
    supabase.from('deals').select('id, title, status, deal_value, prospect_id(company_name)').order('created_at', { ascending: false }),
    supabase.from('projects').select('id, project_name').order('created_at', { ascending: false })
  ]);

  const fin = (finRes.data ?? null) as FinancialOverview | null;
  const pays = paymentsRes.data ?? [];
  const exps = expensesRes.data ?? [];
  const deals = dealsRes.data ?? [];

  // Per-deal outstanding: won deal value − net successful payments (refunds netted), min 0.
  const perDealOutstanding = deals.filter((d) => d.status === 'won').map((d) => {
    const netPaid = pays
      .filter((p) => p.deal_id === d.id && p.status === 'successful')
      .reduce((s, p) => s + (p.transaction_type === 'refund' ? -Number(p.amount) : Number(p.amount)), 0);
    return { deal: d, outstanding: Math.max(0, Number(d.deal_value) - netPaid) };
  }).filter((x) => x.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);

  const revenueByService = new Map<string, number>();
  for (const p of pays) {
    if (p.status !== 'successful') continue;
    const deal = deals.find((d) => d.id === p.deal_id);
    const key = deal?.title ? deal.title : 'Other';
    revenueByService.set(key, (revenueByService.get(key) ?? 0) + (p.transaction_type === 'refund' ? -Number(p.amount) : Number(p.amount)));
  }

  return (
    <>
      <PageHeader title="Finance" description="All amounts in Nigerian Naira (NGN). Revenue = successful payments minus refunds. Headline figures use the financial_overview view.">
        <a href="/api/export?type=payments"><Button variant="ghost">Export payments</Button></a>
        <a href="/api/export?type=expenses"><Button variant="ghost">Export expenses</Button></a>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total net revenue" value={formatNGN(fin?.total_net_revenue ?? 0)} tone="green" />
        <StatCard label="Revenue (this month)" value={formatNGN(fin?.current_month_net_revenue ?? 0)} tone="gold" />
        <StatCard label="Outstanding balances" value={formatNGN(fin?.outstanding_balance ?? 0)} tone="gold" />
        <StatCard label="Total expenses" value={formatNGN(fin?.total_expenses ?? 0)} tone="red" />
        <StatCard label="Expenses (this month)" value={formatNGN(fin?.current_month_expenses ?? 0)} tone="red" />
        <StatCard label="Net operating result" value={formatNGN(fin?.net_operating_result ?? 0)} tone={(fin?.net_operating_result ?? 0) >= 0 ? 'green' : 'red'} />
      </div>

      <div className="mb-6">
        <PaymentForm action={savePayment} deals={deals.map((d) => ({ id: d.id, name: `${d.title} — ${d.prospect_id?.company_name ?? ''}` }))} projects={projectsRes.data ?? []} />
        <ExpenseForm action={saveExpense} />
      </div>

      {perDealOutstanding.length > 0 ? (
        <Card className="mb-4">
          <CardHeader title="Outstanding balances by deal" subtitle="Won deal value − net successful payments" />
          <Table>
            <thead><tr><TH>Deal</TH><TH>Client</TH><TH>Deal value</TH><TH>Outstanding</TH></tr></thead>
            <tbody>
              {perDealOutstanding.map(({ deal, outstanding }) => (
                <tr key={deal.id}>
                  <TD className="font-medium">{deal.title}</TD>
                  <TD>{deal.prospect_id?.company_name ?? '—'}</TD>
                  <TD className="tabular-nums">{formatNGN(deal.deal_value)}</TD>
                  <TD className="tabular-nums text-gold">{formatNGN(outstanding)}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Payments & refunds" subtitle={`${pays.length} records`} />
          {!pays.length ? <EmptyState title="No payments recorded" /> : (
            <Table>
              <thead><tr><TH>Date</TH><TH>Client / Deal</TH><TH>Amount</TH><TH>Type</TH><TH>Status</TH></tr></thead>
              <tbody>
                {pays.slice(0, 25).map((p) => (
                  <tr key={p.id}>
                    <TD className="text-xs">{formatDate(p.paid_at)}</TD>
                    <TD>{p.client_name || p.deal?.title || p.project?.project_name || '—'}</TD>
                    <TD className={`tabular-nums ${p.transaction_type === 'refund' ? 'text-red-400' : ''}`}>{p.transaction_type === 'refund' ? '−' : ''}{formatNGN(p.amount)}</TD>
                    <TD className="capitalize text-xs text-muted">{p.transaction_type}</TD>
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
                    <TD className="text-xs">{formatDate(e.expense_date)}</TD>
                    <TD>{e.title}{e.vendor ? <span className="text-xs text-muted"> · {e.vendor}</span> : null}</TD>
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
        <CardHeader title="Net revenue by deal" subtitle="Successful payments, refunds netted" />
        <div className="p-4">
          {revenueByService.size === 0 ? <EmptyState title="No revenue yet" /> : [...revenueByService.entries()].sort((a, b) => b[1] - a[1]).map(([name, amount]) => (
            <div key={name} className="flex items-center justify-between border-b border-line/50 py-2 text-sm last:border-0">
              <span className="capitalize">{name}</span>
              <span className={amount >= 0 ? 'text-emerald-400 tabular-nums' : 'text-red-400 tabular-nums'}>{formatNGN(amount)}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
