import { createClient } from '@/lib/supabase/server';
import { requireFinanceAccess } from '@/lib/auth';
import { formatNGN, monthKey } from '@/lib/utils';
import { Card, CardHeader, Table, TH, TD, EmptyState, Button } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { label } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  await requireFinanceAccess();
  const supabase = await createClient();

  const [{ data: payments }, { data: expenses }, { data: prospects }, { data: deals }, { data: projects }, { data: outreach }, { data: staffList }] = await Promise.all([
    supabase.from('payments').select('amount, status, received_at, deal_id(service)').eq('status', 'successful'),
    supabase.from('expenses').select('amount, spent_at'),
    supabase.from('prospects').select('status, created_at, assigned_to'),
    supabase.from('deals').select('status, quoted_amount, assigned_to, closed_at'),
    supabase.from('projects').select('status, assigned_to, deadline, completed_at'),
    supabase.from('outreach_activities').select('staff_id, outcome'),
    supabase.from('profiles').select('id, full_name, email')
  ]);

  const successful = payments ?? [];
  const exps = expenses ?? [];
  const now = new Date();
  const thisYear = String(now.getUTCFullYear());

  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }

  const monthly = months.map((m) => {
    const rev = successful.filter((p) => monthKey(p.received_at) === m).reduce((s, p) => s + Number(p.amount), 0);
    const exp = exps.filter((e) => monthKey(e.spent_at) === m).reduce((s, e) => s + Number(e.amount), 0);
    return { month: m, revenue: rev, expenses: exp, profit: rev - exp };
  });

  const staff = (staffList ?? []).map((s) => {
    const myProspects = (prospects ?? []).filter((p) => p.assigned_to === s.id);
    const myDeals = (deals ?? []).filter((d) => d.assigned_to === s.id);
    const myOutreach = (outreach ?? []).filter((o) => o.staff_id === s.id);
    const won = myDeals.filter((d) => d.status === 'won');
    return {
      name: s.full_name || s.email,
      prospects: myProspects.length,
      outreach: myOutreach.length,
      deals: myDeals.length,
      won: won.length,
      wonValue: won.reduce((sum, d) => sum + Number(d.quoted_amount), 0)
    };
  }).filter((s) => s.prospects || s.outreach || s.deals);

  const wonDeals = (deals ?? []).filter((d) => d.status === 'won');
  const converted = (prospects ?? []).filter((p) => p.status === 'converted').length;
  const conversion = (prospects ?? []).length ? ((converted / (prospects ?? []).length) * 100).toFixed(1) : '0.0';

  return (
    <>
      <PageHeader title="Reports & analytics" description="Accurate figures computed from live database records.">
        <a href="/api/export?type=report-monthly"><Button variant="ghost">Export monthly report CSV</Button></a>
      </PageHeader>

      <Card className="mb-4">
        <CardHeader title="Monthly revenue, expenses & profitability" subtitle="Last 12 months" />
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
          <CardHeader title="Business performance summary" subtitle={`Year ${thisYear} and all-time`} />
          <div className="p-5 text-sm">
            {[
              ['Prospects acquired (all time)', (prospects ?? []).length],
              ['Prospects converted', converted],
              ['Prospect → client conversion rate', `${conversion}%`],
              ['Deals won', wonDeals.length],
              ['Deals lost', (deals ?? []).filter((d) => d.status === 'lost').length],
              ['Revenue received', formatNGN(successful.reduce((s, p) => s + Number(p.amount), 0))],
              ['Expenses total', formatNGN(exps.reduce((s, e) => s + Number(e.amount), 0))],
              ['Projects completed', (projects ?? []).filter((p) => p.status === 'completed').length],
              ['Projects overdue', (projects ?? []).filter((p) => !['completed', 'cancelled'].includes(p.status) && p.deadline && p.deadline < new Date().toISOString().slice(0, 10)).length],
              ['Outreach activities', (outreach ?? []).length]
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
