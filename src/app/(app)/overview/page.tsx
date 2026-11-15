import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate, monthKey } from '@/lib/utils';
import { Card, CardHeader, StatCard, Table, TH, TD, EmptyState, Badge } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { MonthlyBars, TrendLine, PipelinePie } from '@/components/charts';
import { label } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [prospectsRes, dealsRes, paymentsRes, expensesRes, tasksRes, projectsRes, outreachRes] = await Promise.all([
    supabase.from('prospects').select('id, company_name, status, next_follow_up_date, created_at'),
    supabase.from('deals').select('id, title, status, quoted_amount, negotiated_amount, expected_close_date, prospect_id(company_name)'),
    supabase.from('payments').select('amount, status, received_at, deal_id(client_name)'),
    supabase.from('expenses').select('amount, spent_at'),
    supabase.from('tasks').select('id, title, due_date, priority, is_completed').eq('is_completed', false),
    supabase.from('projects').select('id, name, deadline, status'),
    supabase.from('outreach_activities').select('outcome, occurred_at')
  ]);

  const prospects = prospectsRes.data ?? [];
  const deals = (dealsRes.data ?? []) as Record<string, never>[];
  const payments = paymentsRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const openTasks = tasksRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const outreach = outreachRes.data ?? [];

  const byStatus = (s: string) => prospects.filter((p) => p.status === s).length;
  const wonDeals = deals.filter((d) => d.status === 'won');
  const lostDeals = deals.filter((d) => d.status === 'lost');
  const activeDeals = deals.filter((d) => ['draft', 'proposal_sent', 'negotiation'].includes(d.status));
  const successfulPayments = payments.filter((p) => p.status === 'successful');

  const revenue = successfulPayments.reduce((s, p) => s + Number(p.amount), 0);
  const thisMonth = monthKey(new Date());
  const revenueThisMonth = successfulPayments.filter((p) => monthKey(p.received_at) === thisMonth).reduce((s, p) => s + Number(p.amount), 0);
  const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const expensesThisMonth = expenses.filter((e) => monthKey(e.spent_at) === thisMonth).reduce((s, e) => s + Number(e.amount), 0);

  const outstanding = wonDeals.reduce((s, d) => {
    const value = Number(d.negotiated_amount ?? d.quoted_amount ?? 0);
    const paid = successfulPayments.filter((p) => p.deal_id && (p.deal_id as { id?: string }).id === d.id).reduce((ps, p) => ps + Number(p.amount), 0);
    return s + Math.max(0, value - paid);
  }, 0);

  const contacted = byStatus('contacted') + byStatus('responded') + byStatus('interested') + byStatus('qualified') + byStatus('converted');
  const interested = byStatus('interested') + byStatus('qualified') + byStatus('converted');
  const conversionRate = prospects.length > 0 ? ((wonDeals.length / prospects.length) * 100).toFixed(1) : '0.0';

  // monthly series (last 6 months)
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const monthly = months.map((m) => ({
    month: new Date(m + '-01').toLocaleDateString('en', { month: 'short' }),
    revenue: successfulPayments.filter((p) => monthKey(p.received_at) === m).reduce((s, p) => s + Number(p.amount), 0),
    expenses: expenses.filter((e) => monthKey(e.spent_at) === m).reduce((s, e) => s + Number(e.amount), 0),
    prospects: prospects.filter((p) => monthKey(p.created_at) === m).length
  }));

  const pipeline = ['draft', 'proposal_sent', 'negotiation', 'won', 'lost'].map((s) => ({
    name: label(s),
    value: deals.filter((d) => d.status === s).length
  }));

  const followUpsDue = prospects
    .filter((p) => p.next_follow_up_date && new Date(p.next_follow_up_date) <= new Date(Date.now() + 7 * 864e5) && !['converted', 'disqualified'].includes(p.status))
    .slice(0, 6);

  const topPayments = successfulPayments.slice(-5).reverse();
  const today = new Date().toISOString().slice(0, 10);
  const overdueProjects = projects.filter((p) => !['completed', 'cancelled'].includes(p.status) && p.deadline && p.deadline < today);

  return (
    <>
      <PageHeader title={`Welcome back, ${profile.full_name || 'Founder'}`} description="Live business overview — all figures from the database." />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total prospects" value={prospects.length} />
        <StatCard label="Contacted" value={contacted} />
        <StatCard label="Interested" value={interested} tone="gold" />
        <StatCard label="Active deals" value={activeDeals.length} />
        <StatCard label="Deals won" value={wonDeals.length} tone="green" />
        <StatCard label="Deals lost" value={lostDeals.length} tone="red" />
        <StatCard label="Revenue received" value={formatNGN(revenue)} tone="green" />
        <StatCard label="Outstanding" value={formatNGN(outstanding)} tone="gold" />
        <StatCard label="Expenses (month)" value={formatNGN(expensesThisMonth)} tone="red" />
        <StatCard label="Net (month)" value={formatNGN(revenueThisMonth - expensesThisMonth)} />
        <StatCard label="Conversion rate" value={`${conversionRate}%`} />
        <StatCard label="Follow-ups due" value={followUpsDue.length} tone="gold" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue vs expenses" subtitle="Last 6 months" />
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
                  <span className="text-xs text-muted">{formatDate(p.next_follow_up_date)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent payments" />
          {topPayments.length === 0 ? <EmptyState title="No payments recorded" /> : (
            <div className="p-4">
              {topPayments.map((p, i) => (
                <div key={i} className="flex items-center justify-between border-b border-line/50 py-2 text-sm last:border-0">
                  <span>{p.deal_id?.client_name || 'Direct client'}</span>
                  <span className="text-emerald-400">{formatNGN(p.amount)}</span>
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
                <span className="truncate">{p.name}</span>
                <Badge tone="red">Overdue</Badge>
              </div>
            ))}
            {openTasks.filter((t) => t.due_date && t.due_date < today).slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-line/50 py-2 last:border-0">
                <span className="truncate">{t.title}</span>
                <Badge tone="amber">Task overdue</Badge>
              </div>
            ))}
            {overdueProjects.length === 0 && openTasks.filter((t) => t.due_date && t.due_date < today).length === 0 ? (
              <EmptyState title="Nothing overdue. Well done." />
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}
