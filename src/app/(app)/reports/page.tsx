import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceAccess } from '@/lib/auth';
import { formatNGN, monthKey } from '@/lib/utils';
import { Card, CardHeader, StatCard, Table, TH, TD, EmptyState, LinkButton } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { FilterBar } from '@/components/filter-bar';
import { MonthlyBars, ProfitLine, DonutChart, HorizontalBars } from '@/components/charts';
import { label } from '@/lib/constants';
import { dateParam } from '@/lib/ui-helpers';

export const metadata: Metadata = { title: 'Reports', description: 'Revenue, pipeline and team analytics.' };
export const dynamic = 'force-dynamic';

type SP = { from?: string; to?: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireFinanceAccess();
  const sp = await searchParams;
  const dFrom = dateParam(sp.from);
  const dTo = dateParam(sp.to);
  const supabase = await createClient();

  const [paymentsRes, expensesRes, prospectsRes, dealsRes, projectsRes, outreachRes, staffRes, commRes] = await Promise.all([
    supabase.from('payments').select('amount, status, transaction_type, paid_at'),
    supabase.from('expenses').select('amount, expense_date'),
    supabase.from('prospects').select('status, assigned_to, created_at'),
    supabase.from('deals').select('status, deal_value, assigned_to, created_at'),
    supabase.from('projects').select('status, due_date'),
    supabase.from('outreach_activities').select('created_by, contacted_at'),
    supabase.from('profiles').select('id, full_name, email'),
    supabase.from('commission_entries').select('status, commission_amount, created_at')
  ]);

  const inRange = (iso: string | null | undefined) => {
    if (!iso) return false;
    const d = iso.slice(0, 10);
    return (!dFrom || d >= dFrom) && (!dTo || d <= dTo);
  };

  // Revenue = successful payments only; refunds are netted. Pending/failed never count.
  const payments = (paymentsRes.data ?? []).filter((p) => p.status === 'successful' && inRange(p.paid_at));
  const expenses = (expensesRes.data ?? []).filter((e) => inRange(e.expense_date));
  const revenue = payments.reduce((s, p) => s + (p.transaction_type === 'refund' ? -Number(p.amount) : Number(p.amount)), 0);
  const spend = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const keys = new Set<string>();
  payments.forEach((p) => keys.add(monthKey(p.paid_at)));
  expenses.forEach((e) => keys.add(monthKey(e.expense_date)));
  let months = [...keys].sort();
  if (!dFrom && !dTo) {
    const now = new Date();
    months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i), 1)).toISOString().slice(0, 7));
  }
  const monthly = months.map((m) => {
    const rev = payments.filter((p) => monthKey(p.paid_at) === m).reduce((s, p) => s + (p.transaction_type === 'refund' ? -Number(p.amount) : Number(p.amount)), 0);
    const exp = expenses.filter((e) => monthKey(e.expense_date) === m).reduce((s, e) => s + Number(e.amount), 0);
    return { month: m, revenue: rev, expenses: exp, profit: rev - exp };
  });

  const prospects = (prospectsRes.data ?? []).filter((p) => inRange(p.created_at));
  const deals = (dealsRes.data ?? []).filter((d) => inRange(d.created_at));
  const outreach = (outreachRes.data ?? []).filter((o) => inRange(o.contacted_at));
  const commissions = (commRes.data ?? []).filter((c) => inRange(c.created_at));
  const projects = projectsRes.data ?? [];

  const converted = prospects.filter((p) => p.status === 'converted').length;
  const conversion = prospects.length ? (converted / prospects.length) * 100 : 0;
  const won = deals.filter((d) => d.status === 'won');
  const lost = deals.filter((d) => d.status === 'lost');
  const closed = won.length + lost.length;
  const winRate = closed ? (won.length / closed) * 100 : 0;
  const today = new Date().toISOString().slice(0, 10);

  const prospectStatus = Object.entries(prospects.reduce<Record<string, number>>((a, p) => { a[p.status] = (a[p.status] ?? 0) + 1; return a; }, {})).map(([k, v]) => ({ name: label(k), value: v }));
  const pipeline = Object.entries(deals.reduce<Record<string, number>>((a, d) => { a[d.status] = (a[d.status] ?? 0) + Number(d.deal_value); return a; }, {})).map(([k, v]) => ({ name: label(k), value: v }));
  const projectStatus = Object.entries(projects.reduce<Record<string, number>>((a, p) => { a[p.status] = (a[p.status] ?? 0) + 1; return a; }, {})).map(([k, v]) => ({ name: label(k), value: v }));
  const commTotal = (s: string) => commissions.filter((c) => c.status === s).reduce((t, c) => t + Number(c.commission_amount), 0);

  const staff = (staffRes.data ?? []).map((s) => {
    const myDeals = deals.filter((d) => d.assigned_to === s.id);
    const myWon = myDeals.filter((d) => d.status === 'won');
    return {
      id: s.id, name: s.full_name || s.email,
      prospects: prospects.filter((p) => p.assigned_to === s.id).length,
      outreach: outreach.filter((o) => o.created_by === s.id).length,
      deals: myDeals.length, won: myWon.length,
      wonValue: myWon.reduce((t, d) => t + Number(d.deal_value), 0)
    };
  }).filter((s) => s.prospects || s.outreach || s.deals);

  const hasFinance = monthly.some((m) => m.revenue || m.expenses);

  return (
    <>
      <PageHeader title="Reports & analytics" description="Computed from live records. Use the date range to narrow every figure on this page.">
        <LinkButton href="/api/export?type=report-monthly" variant="ghost">Monthly CSV</LinkButton>
        <LinkButton href="/api/export?type=payments" variant="ghost">Payments CSV</LinkButton>
        <LinkButton href="/api/export?type=deals" variant="ghost">Deals CSV</LinkButton>
      </PageHeader>

      <FilterBar basePath="/reports" values={{ from: sp.from, to: sp.to }} filters={[{ kind: 'date', name: 'from', label: 'From' }, { kind: 'date', name: 'to', label: 'To' }]} />

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Revenue" value={formatNGN(revenue)} tone="green" hint="Successful, net of refunds" />
        <StatCard label="Expenses" value={formatNGN(spend)} tone="red" />
        <StatCard label="Net result" value={formatNGN(revenue - spend)} tone="gold" />
        <StatCard label="Prospect conversion" value={`${conversion.toFixed(1)}%`} hint={`${converted} of ${prospects.length}`} />
        <StatCard label="Deal win rate" value={`${winRate.toFixed(1)}%`} hint={`${won.length} won · ${lost.length} lost`} />
        <StatCard label="Outreach" value={outreach.length} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Revenue vs expenses" subtitle={!dFrom && !dTo ? 'Last 12 months' : 'Selected range'} />
          <div className="p-4">{hasFinance ? <MonthlyBars data={monthly} /> : <EmptyState title="No financial data in this range" />}</div>
        </Card>
        <Card>
          <CardHeader title="Profit trend" />
          <div className="p-4">{hasFinance ? <ProfitLine data={monthly} /> : <EmptyState title="No financial data in this range" />}</div>
        </Card>
        <Card>
          <CardHeader title="Prospects by status" />
          <div className="p-4">{prospectStatus.length ? <DonutChart data={prospectStatus} /> : <EmptyState title="No prospects in this range" />}</div>
        </Card>
        <Card>
          <CardHeader title="Deal value by stage" />
          <div className="p-4">{pipeline.length ? <HorizontalBars data={pipeline} money /> : <EmptyState title="No deals in this range" />}</div>
        </Card>
        <Card>
          <CardHeader title="Project delivery" subtitle="All projects" />
          <div className="p-4">
            {projectStatus.length ? <DonutChart data={projectStatus} /> : <EmptyState title="No projects yet" />}
            <p className="mt-2 text-xs text-muted">
              {projects.filter((p) => p.status === 'completed').length} completed ·{' '}
              {projects.filter((p) => !['completed', 'cancelled'].includes(p.status) && p.due_date && p.due_date < today).length} overdue
            </p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Commissions" subtitle="Created in range" />
          <dl className="px-4 py-1 text-sm">
            {(['pending', 'approved', 'paid', 'void'] as const).map((s) => (
              <div key={s} className="flex justify-between border-b border-line/60 py-2.5 last:border-0">
                <dt className="capitalize text-muted">{s}</dt><dd className="tabular-nums">{formatNGN(commTotal(s))}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Staff performance" />
        {!staff.length ? <EmptyState title="No staff activity in this range" /> : (
          <Table minWidth={640}>
            <thead><tr><TH>Staff</TH><TH>Prospects</TH><TH>Outreach</TH><TH>Deals</TH><TH>Won</TH><TH>Won value</TH></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <TD className="font-medium">{s.name}</TD><TD>{s.prospects}</TD><TD>{s.outreach}</TD><TD>{s.deals}</TD><TD>{s.won}</TD>
                  <TD className="tabular-nums">{formatNGN(s.wonValue)}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
