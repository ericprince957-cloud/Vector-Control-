import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { formatNGN, formatDate, monthKey } from '@/lib/utils';
import { Card, CardHeader, StatCard, EmptyState, Badge, ErrorState } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { MonthlyBars, TrendLine, DonutChart } from '@/components/charts';
import { label } from '@/lib/constants';
import { netAmount, one, paymentTone, prospectTone, projectTone } from '@/lib/ui-helpers';

export const metadata: Metadata = { title: 'Overview', description: 'Executive overview of Vector Codes operations.' };
export const dynamic = 'force-dynamic';

type FinancialOverview = {
  total_net_revenue: number;
  total_expenses: number;
  net_operating_result: number;
  outstanding_balance: number;
};

type Deadline = { key: string; when: string; title: string; kind: string; href: string };

export default async function OverviewPage() {
  const profile = await requireProfile();
  const canViewFinance = profile.role !== 'staff';
  const isFounder = profile.role === 'founder';
  const supabase = await createClient();

  const empty = Promise.resolve({ data: null as null, error: null });
  const [finRes, prospectsRes, dealsRes, paymentsRes, expensesRes, tasksRes, projectsRes, activityRes] = await Promise.all([
    canViewFinance ? supabase.from('financial_overview').select('*').maybeSingle() : empty,
    supabase.from('prospects').select('id, company_name, status, next_follow_up_at, created_at, industry').order('created_at', { ascending: false }),
    supabase.from('deals').select('id, title, status, deal_value, expected_close_date, prospect:prospects(company_name)'),
    canViewFinance
      ? supabase.from('payments').select('id, amount, status, transaction_type, paid_at, client_name, deal:deals(title)').order('paid_at', { ascending: false })
      : empty,
    canViewFinance ? supabase.from('expenses').select('amount, expense_date') : empty,
    supabase.from('tasks').select('id, title, status, due_at, project_id'),
    supabase.from('projects').select('id, project_name, client_name, status, due_date'),
    isFounder
      ? supabase.from('audit_logs').select('id, action, entity_type, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name)').order('created_at', { ascending: false }).limit(8)
      : supabase.from('outreach_activities').select('id, channel, outcome, contacted_at, prospect:prospects(company_name)').order('contacted_at', { ascending: false }).limit(8)
  ]);

  const loadError = [prospectsRes.error, dealsRes.error, tasksRes.error, projectsRes.error].find(Boolean);

  const fin = (finRes.data ?? null) as FinancialOverview | null;
  const prospects = prospectsRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const payments = (paymentsRes.data ?? []) as unknown as {
    id: string; amount: number; status: string; transaction_type: string; paid_at: string; client_name: string | null; deal: { title: string } | { title: string }[] | null;
  }[];
  const expenses = (expensesRes.data ?? []) as { amount: number; expense_date: string }[];
  const tasks = tasksRes.data ?? [];
  const projects = projectsRes.data ?? [];

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  const wonDeals = deals.filter((d) => d.status === 'won');
  const activeDeals = deals.filter((d) => ['draft', 'proposal_sent', 'negotiation'].includes(d.status));
  const openTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
  const activeProjects = projects.filter((p) => !['completed', 'cancelled'].includes(p.status));
  const bookedRevenue = wonDeals.reduce((s, d) => s + Number(d.deal_value), 0);
  const conversionRate = prospects.length ? (wonDeals.length / prospects.length) * 100 : 0;

  // Last 6 months — revenue counts only successful payments, refunds netted.
  const months: string[] = [];
  const base = new Date();
  for (let i = 5; i >= 0; i--) months.push(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  const monthly = months.map((m) => ({
    month: new Date(m + '-01').toLocaleDateString('en', { month: 'short' }),
    revenue: payments.filter((p) => p.paid_at && monthKey(p.paid_at) === m).reduce((s, p) => s + netAmount(p), 0),
    expenses: expenses.filter((e) => monthKey(e.expense_date) === m).reduce((s, e) => s + Number(e.amount), 0),
    prospects: prospects.filter((p) => monthKey(p.created_at) === m).length
  }));

  const pipeline = ['draft', 'proposal_sent', 'negotiation', 'won', 'lost'].map((s) => ({ name: label(s), value: deals.filter((d) => d.status === s).length }));

  // Delivery progress derives from linked tasks (done ÷ total) — there is no milestone table.
  const progress = activeProjects.slice(0, 6).map((p) => {
    const linked = tasks.filter((t) => t.project_id === p.id && t.status !== 'cancelled');
    const done = linked.filter((t) => t.status === 'done').length;
    return { ...p, total: linked.length, done, pct: linked.length ? Math.round((done / linked.length) * 100) : null };
  });

  // Upcoming deadlines (next 14 days, plus anything overdue).
  const horizon = new Date(Date.now() + 14 * 864e5).toISOString();
  const deadlines: Deadline[] = [
    ...openTasks.filter((t) => t.due_at && t.due_at <= horizon).map((t) => ({ key: 't' + t.id, when: t.due_at!, title: t.title, kind: 'Task', href: '/tasks' })),
    ...activeProjects.filter((p) => p.due_date && p.due_date <= horizon.slice(0, 10)).map((p) => ({ key: 'p' + p.id, when: p.due_date!, title: p.project_name, kind: 'Project', href: '/projects' })),
    ...activeDeals.filter((d) => d.expected_close_date && d.expected_close_date <= horizon.slice(0, 10)).map((d) => ({ key: 'd' + d.id, when: d.expected_close_date!, title: d.title, kind: 'Deal close', href: `/deals/${d.id}` })),
    ...prospects.filter((p) => p.next_follow_up_at && p.next_follow_up_at <= horizon && !['converted', 'disqualified'].includes(p.status)).map((p) => ({ key: 'f' + p.id, when: p.next_follow_up_at!, title: p.company_name, kind: 'Follow-up', href: `/prospects/${p.id}` }))
  ].sort((a, b) => a.when.localeCompare(b.when)).slice(0, 8);

  const overdueTasks = openTasks.filter((t) => t.due_at && t.due_at < nowIso);
  const overdueProjects = activeProjects.filter((p) => p.due_date && p.due_date < today);
  const pendingPayments = payments.filter((p) => p.status === 'pending');
  const failedPayments = payments.filter((p) => p.status === 'failed');
  const alerts: { key: string; text: string; href: string; tone: 'red' | 'amber' }[] = [
    ...(overdueProjects.length ? [{ key: 'op', text: `${overdueProjects.length} project${overdueProjects.length > 1 ? 's' : ''} past the due date`, href: '/projects', tone: 'red' as const }] : []),
    ...(overdueTasks.length ? [{ key: 'ot', text: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`, href: '/tasks', tone: 'red' as const }] : []),
    ...(canViewFinance && (fin?.outstanding_balance ?? 0) > 0 ? [{ key: 'ob', text: `${formatNGN(fin?.outstanding_balance)} outstanding from clients`, href: '/finance', tone: 'amber' as const }] : []),
    ...(pendingPayments.length ? [{ key: 'pp', text: `${pendingPayments.length} pending payment${pendingPayments.length > 1 ? 's' : ''} (not counted as revenue)`, href: '/finance', tone: 'amber' as const }] : []),
    ...(failedPayments.length ? [{ key: 'fp', text: `${failedPayments.length} failed payment${failedPayments.length > 1 ? 's' : ''}`, href: '/finance', tone: 'red' as const }] : [])
  ];

  const activity = (activityRes.data ?? []) as unknown as Record<string, unknown>[];

  return (
    <>
      <PageHeader title={`Welcome back, ${profile.full_name?.split(' ')[0] || 'there'}`} description="A live view of sales, delivery and finance across Vector Codes." />

      {loadError ? <div className="mb-6"><ErrorState title="Some figures could not be loaded" message={loadError.message} /></div> : null}

      {canViewFinance ? (
        <section aria-label="Financial position" className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Total revenue" value={formatNGN(bookedRevenue)} hint="Value of won deals" />
          <StatCard label="Revenue received" value={formatNGN(fin?.total_net_revenue ?? 0)} tone="green" hint="Successful payments, net of refunds" />
          <StatCard label="Outstanding" value={formatNGN(fin?.outstanding_balance ?? 0)} tone="gold" hint="Owed by clients" />
          <StatCard label="Total expenses" value={formatNGN(fin?.total_expenses ?? 0)} tone="red" />
          <StatCard label="Net position" value={formatNGN(fin?.net_operating_result ?? 0)} tone={(fin?.net_operating_result ?? 0) >= 0 ? 'green' : 'red'} hint="Received minus expenses" />
        </section>
      ) : null}

      <section aria-label="Operations" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Active projects" value={activeProjects.length} />
        <StatCard label="Total prospects" value={prospects.length} />
        <StatCard label="Active deals" value={activeDeals.length} tone="gold" />
        <StatCard label="Conversion rate" value={`${conversionRate.toFixed(1)}%`} hint="Won deals ÷ prospects" />
        <StatCard label="Pending tasks" value={openTasks.length} tone={overdueTasks.length ? 'red' : undefined} hint={overdueTasks.length ? `${overdueTasks.length} overdue` : undefined} />
      </section>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        {canViewFinance ? (
          <Card className="lg:col-span-2">
            <CardHeader title="Revenue analytics" subtitle="Last 6 months · revenue counts successful payments only" />
            <div className="p-4"><MonthlyBars data={monthly} /></div>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader title="Prospect acquisition" subtitle="New prospects per month" />
            <div className="p-4"><TrendLine data={monthly} dataKey="prospects" name="New prospects" /></div>
          </Card>
        )}
        <Card>
          <CardHeader title="Sales pipeline" subtitle="Deals by stage" />
          <div className="p-4"><DonutChart data={pipeline} /></div>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Important alerts" />
          {alerts.length === 0 ? <EmptyState title="Nothing needs attention" /> : (
            <ul>
              {alerts.map((a) => (
                <li key={a.key} className="border-b border-line/60 last:border-0">
                  <Link href={a.href} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                    <Badge tone={a.tone}>{a.tone === 'red' ? 'Urgent' : 'Review'}</Badge>
                    <span className="min-w-0">{a.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Upcoming deadlines" subtitle="Next 14 days and overdue" />
          {deadlines.length === 0 ? <EmptyState title="No upcoming deadlines" /> : (
            <ul>
              {deadlines.map((d) => (
                <li key={d.key} className="border-b border-line/60 last:border-0">
                  <Link href={d.href} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
                    <span className="min-w-0">
                      <span className="block truncate">{d.title}</span>
                      <span className="text-[11px] text-muted">{d.kind}</span>
                    </span>
                    <span className={`shrink-0 text-xs ${d.when < (d.when.length > 10 ? nowIso : today) ? 'text-danger' : 'text-muted'}`}>{formatDate(d.when)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Project progress" subtitle="Share of linked tasks completed" action={<Link href="/projects" className="text-xs text-gold hover:text-gold-light">All projects</Link>} />
          {progress.length === 0 ? <EmptyState title="No active projects" /> : (
            <ul>
              {progress.map((p) => (
                <li key={p.id} className="border-b border-line/60 px-4 py-3 last:border-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{p.project_name}</span>
                    <Badge tone={projectTone[p.status]}>{label(p.status)}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={p.pct ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.project_name} progress`}>
                      <div className="h-full bg-gold" style={{ width: `${p.pct ?? 0}%` }} />
                    </div>
                    <span className="w-20 text-right text-[11px] text-muted">{p.pct === null ? 'No tasks' : `${p.done}/${p.total} tasks`}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {canViewFinance ? (
          <Card>
            <CardHeader title="Recent transactions" action={<Link href="/finance" className="text-xs text-gold hover:text-gold-light">View all</Link>} />
            {payments.length === 0 ? <EmptyState title="No payments recorded" /> : (
              <ul>
                {payments.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-2.5 text-sm last:border-0">
                    <span className="min-w-0">
                      <span className="block truncate">{p.client_name || one(p.deal)?.title || 'Direct client'}</span>
                      <span className="text-[11px] text-muted">{formatDate(p.paid_at)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`tabular-nums ${p.transaction_type === 'refund' ? 'text-danger' : ''}`}>{p.transaction_type === 'refund' ? '−' : ''}{formatNGN(p.amount)}</span>
                      <Badge tone={paymentTone[p.status]}>{p.status}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Recent prospects" action={<Link href="/prospects" className="text-xs text-gold hover:text-gold-light">View all</Link>} />
          {prospects.length === 0 ? <EmptyState title="No prospects yet" hint="Add your first prospect from the Prospects page." /> : (
            <ul>
              {prospects.slice(0, 6).map((p) => (
                <li key={p.id} className="border-b border-line/60 last:border-0">
                  <Link href={`/prospects/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
                    <span className="min-w-0">
                      <span className="block truncate">{p.company_name}</span>
                      <span className="text-[11px] text-muted">{formatDate(p.created_at)}</span>
                    </span>
                    <Badge tone={prospectTone[p.status]}>{label(p.status)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent business activity" subtitle={isFounder ? 'Latest recorded changes' : 'Your latest outreach'} />
          {activity.length === 0 ? <EmptyState title="No activity recorded yet" /> : (
            <ul>
              {activity.map((a) => (
                <li key={String(a.id)} className="border-b border-line/60 px-4 py-2.5 text-sm last:border-0">
                  {isFounder ? (
                    <>
                      <p><span className="capitalize">{String(a.action).replace(/_/g, ' ')}</span> <span className="text-muted">· {label(String(a.entity_type))}</span></p>
                      <p className="text-[11px] text-muted">{one(a.actor as { full_name: string } | { full_name: string }[] | null)?.full_name ?? 'System'} · {formatDate(String(a.created_at))}</p>
                    </>
                  ) : (
                    <>
                      <p>{one(a.prospect as { company_name: string } | { company_name: string }[] | null)?.company_name ?? 'Prospect'} <span className="text-muted">· {label(String(a.channel))}</span></p>
                      <p className="text-[11px] text-muted">{label(String(a.outcome ?? 'no_response'))} · {formatDate(String(a.contacted_at))}</p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
