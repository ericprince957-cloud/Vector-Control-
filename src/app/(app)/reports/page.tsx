import { createClient } from '@/lib/supabase/server';
import { requireFinanceAccess } from '@/lib/auth';
import { formatNGN, monthKey } from '@/lib/utils';
import { Card, CardHeader, Table, TH, TD, EmptyState, Button } from '@/components/ui';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  await requireFinanceAccess();
  const supabase = await createClient();

  const [finRes, paymentsRes, expensesRes, prospectsRes, dealsRes, projectsRes, outreachRes, staffRes] = await Promise.all([
    supabase.from('financial_overview').select('*').maybeSingle(),
    supabase.from('payments').select('amount, status, transaction_type, paid_at'),
    supabase.from('expenses').select('amount, expense_date'),
    supabase.from('prospects').select('status, created_at, assigned_to'),
    supabase.from('deals').select('status, deal_value, assigned_to, won_at'),
    supabase.from('projects').select('status, assigned_to, due_date, completed_at'),
    supabase.from('outreach_activities').select('created_by, outcome'),
    supabase.from('profiles').select('id, full_name, email')
  ]);

  const fin = finRes.data as Record<string, number> | null;
  const successful = (paymentsRes.data ?? []).filter((p) => p.status === 'successful');
  const exps = expensesRes.data ?? [];
  const now = new Date();

  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  }

  const monthly = months.map((m) => {
    const rev = successful.filter((p) => monthKey(p.paid_at) === m).reduce((s, p) => s + (p.transaction_type === 'refund' ? -Number(p.amount) : Number(p.amount)), 0);
    const exp = exps.filter((e) => monthKey(e.expense_date) === m).reduce((s, e) => s + Number(e.amount), 0);
    return { month: m, revenue: rev, expenses: exp, profit: rev - exp };
  });

  const staff = (staffRes.data ?? []).map((s) => {
    const myProspects = (prospectsRes.data ?? []).filter((p) => p.assigned_to === s.id);
    const myDeals = (dealsRes.data ?? []).filter((d) => d.assigned_to === s.id);
    const myOutreach = (outreachRes.data ?? []).filter((o) => o.created_by === s.id);
    const won = myDeals.filter((d) => d.status === 'won');
    return {
      name: s.full_name || s.email,
      prospects: myProspects.length,
      outreach: myOutreach.length,
      deals: myDeals.length,
      won: won.length,
      wonValue: won.reduce((sum, d) => sum + Number(d.deal_value), 0)
    };
  }).filter((s) => s.prospects || s.outreach || s.deals);

  const wonDeals = (dealsRes.data ?? []).filter((d) => d.status === 'won');
  const converted = (prospectsRes.data ?? []).filter((p) => p.status === 'converted').length;
  const totalProspects = (prospectsRes.data ?? []).length;
  const conversion = totalProspects ? ((converted / totalProspects) * 100).toFixed(1) : '0.0';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="Reports & analytics" description="Accurate figures computed from live database records.">
        <a href="/api/export?type=report-monthly"><Button variant="ghost">Export monthly report CSV</Button></a>
      </PageHeader>

      <Card className="mb-4">
        <CardHeader title="Monthly revenue, expenses & profitability" subtitle="Last 12 months (refunds netted)" />
        {!monthly.some((m) => m.revenue || m.expenses) ? <EmptyState title="No financial data yet" /> : (
          <Table>
            <thead><tr><TH>Month</TH><TH>Revenue</TH><TH>Expenses</TH><TH>Profit</TH></tr></thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.month}>
                  <TD>{m.month}</TD>
                  <TD className="tabular-nums text-emerald-400">{formatNGN(m.revenue)}</TD>
                  <TD className="tabular-nums text-red-400">{formatNGN(m.expenses)}</TD>
                  <TD className="tabular-nums font-medium">{formatNGN(m.profit)}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Business performance summary" subtitle="All-time, from live records and the financial_overview view" />
          <div className="p-5 text-sm">
            {[
              ['Prospects acquired', totalProspects],
              ['Prospects converted', converted],
              ['Prospect → client conversion rate', `${conversion}%`],
              ['Deals won', wonDeals.length],
              ['Deals lost', (dealsRes.data ?? []).filter((d) => d.status === 'lost').length],
              ['Total net revenue', formatNGN(fin?.total_net_revenue ?? 0)],
              ['Total expenses', formatNGN(fin?.total_expenses ?? 0)],
              ['Net operating result', formatNGN(fin?.net_operating_result ?? 0)],
              ['Outstanding balances', formatNGN(fin?.outstanding_balance ?? 0)],
              ['Projects completed', (projectsRes.data ?? []).filter((p) => p.status === 'completed').length],
              ['Projects overdue', (projectsRes.data ?? []).filter((p) => !['completed', 'cancelled'].includes(p.status) && p.due_date && p.due_date < today).length],
              ['Outreach activities', (outreachRes.data ?? []).length]
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between border-b border-line/50 py-2 last:border-0">
                <span className="text-muted">{k}</span><span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Staff performance" />
          {staff.length === 0 ? <EmptyState title="No staff activity yet" /> : (
            <Table>
              <thead><tr><TH>Staff</TH><TH>Prospects</TH><TH>Outreach</TH><TH>Deals won</TH><TH>Won value</TH></tr></thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.name}>
                    <TD className="font-medium">{s.name}</TD>
                    <TD>{s.prospects}</TD>
                    <TD>{s.outreach}</TD>
                    <TD>{s.won}</TD>
                    <TD className="tabular-nums">{formatNGN(s.wonValue)}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
