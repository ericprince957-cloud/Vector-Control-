import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate, monthKey } from '@/lib/utils';
import { Card, CardHeader, StatCard, EmptyState, Badge } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { MonthlyBars, TrendLine, PipelinePie } from '@/components/charts';
import { label } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type FinancialOverview = {
  currency: string;
  total_net_revenue: number;
  total_expenses: number;
  net_operating_result: number;
  outstanding_balance: number;
  current_month_net_revenue: number;
  current_month_expenses: number;
};

export default async function OverviewPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [finRes, prospectsRes, dealsRes, paymentsRes, tasksRes, projectsRes, outreachRes] = await Promise.all([
    supabase.from('financial_overview').select('*').maybeSingle(),
    supabase.from('prospects').select('id, company_name, status, next_follow_up_at, created_at'),
    supabase.from('deals').select('id, title, status, deal_value, expected_close_date, prospect_id(company_name)'),
    supabase.from('payments').select('amount, status, transaction_type, paid_at, client_name, deal_id(title)').order('paid_at', { ascending: false }).limit(5),
    supabase.from('tasks').select('id, title, due_at, priority, status').neq('status', 'done').neq('status', 'cancelled'),
    supabase.from('projects').select('id, project_name, due_date, status'),
    supabase.from('outreach_activities').select('outcome, contacted_at')
  ]);

  const fin = (finRes.data ?? null) as FinancialOverview | null;
  const prospects = prospectsRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const recentPayments = paymentsRes.data ?? [];
  const openTasks = tasksRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const outreach = outreachRes.data ?? [];

  const byStatus = (s: string) => prospects.filter((p) => p.status === s).length;
  const wonDeals = deals.filter((d) => d.status === 'won');
  const lostDeals = deals.filter((d) => d.status === 'lost');
  const activeDeals = deals.filter((d) => ['draft', 'proposal_sent', 'negotiation'].includes(d.status));
  const contacted = byStatus('contacted') + byStatus('responded') + byStatus('interested') + byStatus('qualified') + byStatus('converted');
  const interested = byStatus('interested') + byStatus('qualified') + byStatus('converted');
  const conversionRate = prospects.length > 0 ? ((wonDeals.length / prospects.length) * 100).toFixed(1) : '0.0';

  // Monthly series (last 6 months) computed from payments/expenses with
  // transaction_type-aware netting; headline figures come from the view.
  const successful = (await supabase.from('payments').select('amount, paid_at, transaction_type').eq('status', 'successful')).data ?? [];
  const expenses = (await supabase.from('expenses').select('amount, expense_date')).data ?? [];
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const monthly = months.map((m) => ({
    month: new Date(m + '-01').toLocaleDateString('en', { month: 'short' }),
    revenue: successful.filter((p) => monthKey(p.paid_at) === m).reduce((s, p) => s + (p.transaction_type === 'refund' ? -Number(p.amount) : Number(p.amount)), 0),
    expenses: expenses.filter((e) => monthKey(e.expense_date) === m).reduce((s, e) => s + Number(e.amount), 0),
    prospects: prospects.filter((p) => monthKey(p.created_at) === m).length
  }));

  const pipeline = ['draft', 'proposal_sent', 'negotiation', 'won', 'lost'].map((s) => ({
    name: label(s),
    value: deals.filter((d) => d.status === s).length
  }));

  const followUpsDue = prospects
    .filter((p) => p.next_follow_up_at && new Date(p.next_follow_up_at) <= new Date(Date.now() + 7 * 864e5) && !['converted', 'disqualified'].includes(p.status))
    .slice(0, 6);

  const today = new Date().toISOString().slice(0, 10);
  const overdueProjects = projects.filter((p) => !['completed', 'cancelled'].includes(p.status) && p.due_date && p.due_date < today);

  return (
    <>
      <PageHeader title={`Welcome back, ${profile.full_name || 'Founder'}`} description="Live business overview — headline figures from the financial_overview view." />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total prospects" value={prospects.length} />
        <StatCard label="Contacted" value={contacted} />
        <StatCard label="Interested" value={interested} tone="gold" />
        <StatCard label="Active deals" value={activeDeals.length} />
        <StatCard label="Deals won" value={wonDeals.length} tone="green" />
        <StatCard label="Deals lost" value={lostDeals.length} tone="red" />
        <StatCard label="Net revenue" value={formatNGN(fin?.total_net_revenue ?? 0)} tone="green" />
        <StatCard label="Revenue (this month)" value={formatNGN(fin?.current_month_net_revenue ?? 0)} tone="gold" />
        <StatCard label="Outstanding" value={formatNGN(fin?.outstanding_balance ?? 0)} tone="gold" />
        <StatCard label="Expenses (month)" value={formatNGN(fin?.current_month_expenses ?? 0)} tone="red" />
        <StatCard label="Net operating result" value={formatNGN(fin?.net_operating_result ?? 0)} tone={(fin?.net_operating_result ?? 0) >= 0 ? 'green' : 'red'} />
        <StatCard label="Conversion rate" value={`${conversionRate}%`} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue vs expenses" subtitle="Last 6 months (refunds netted)" />
          <div className="p-4"><MonthlyBars data={monthly} /></div>
        </Card>
        <Card>
          <CardHeader title="Prospect acquisition" subtitle="New prospects per month" />
          <div className="p-4"><TrendLine data={monthly} dataKey="prospects" name="New prospects" /></div>
        </Card>
        <Card>
          <CardHeader title="Sales pipeline" subtitle="Deals by stage" />
          <div className="p-4"><PipelinePie data={pipeline} /></div>
        </Card>
        <Card>
          <CardHeader title="Outreach performance" subtitle="Outcomes recorded" />
          <div className="space-y-2 p-4">
            {Object.entries(outreach.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.outcome]: (acc[o.outcome] ?? 0) + 1 }), {}))
              .sort((a, b) => b[1] - a[1])
              .map(([outcome, count]) => (
                <div key={outcome} className="flex items-center justify-between border-b border-line/50 pb-2 text-sm last:border-0">
                  <span className="capitalize text-muted">{label(outcome)}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            {outreach.length === 0 ? <EmptyState title="No outreach recorded yet" /> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Upcoming follow-ups" />
          {followUpsDue.length === 0 ? <EmptyState title="No follow-ups due" /> : (
            <div className="p-4">
              {followUpsDue.map((p) => (
                <Link key={p.id} href={`/prospects/${p.id}`} className="flex items-center justify-between border-b border-line/50 py-2 text-sm last:border-0 hover:text-gold">
                  <span>{p.company_name}</span>
                  <span className="text-xs text-muted">{formatDate(p.next_follow_up_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent payments" />
          {recentPayments.length === 0 ? <EmptyState title="No payments recorded" /> : (
            <div className="p-4">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-line/50 py-2 text-sm last:border-0">
                  <span className="truncate">{p.client_name || p.deal_id?.title || 'Direct client'}</span>
                  <span className={p.transaction_type === 'refund' ? 'text-red-400' : 'text-emerald-400'}>
                    {p.transaction_type === 'refund' ? '−' : ''}{formatNGN(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Needs attention" />
          <div className="p-4 text-sm">
            {overdueProjects.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-line/50 py-2 last:border-0">
                <span className="truncate">{p.project_name}</span>
                <Badge tone="red">Overdue</Badge>
              </div>
            ))}
            {openTasks.filter((t) => t.due_at && t.due_at < new Date().toISOString()).slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-line/50 py-2 last:border-0">
                <span className="truncate">{t.title}</span>
                <Badge tone="amber">Task overdue</Badge>
              </div>
            ))}
            {overdueProjects.length === 0 && openTasks.filter((t) => t.due_at && t.due_at < new Date().toISOString()).length === 0 ? (
              <EmptyState title="Nothing overdue. Well done." />
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}
