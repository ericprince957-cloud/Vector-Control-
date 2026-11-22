import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceAccess } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, CardHeader, StatCard, Table, TH, TD, Badge, EmptyState, ErrorState, LinkButton } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { FilterBar } from '@/components/filter-bar';
import { Pagination } from '@/components/pagination';
import { PaymentDialog } from '@/components/forms';
import { savePayment } from '@/actions/finance';
import { PAYMENT_METHODS, PAYMENT_STATUSES, label } from '@/lib/constants';
import { PAGE_SIZE, pageParam, rangeFor, dateParam, one, paymentTone, safeSearch } from '@/lib/ui-helpers';

export const metadata: Metadata = { title: 'Payments', description: 'Client payments, balances and refunds.' };
export const dynamic = 'force-dynamic';

type SP = { status?: string; method?: string; q?: string; from?: string; to?: string; page?: string };
type Rel<T> = T | T[] | null;

export default async function FinancePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireFinanceAccess();
  const sp = await searchParams;
  const supabase = await createClient();
  const page = pageParam(sp.page);
  const [from, to] = rangeFor(page);
  const dFrom = dateParam(sp.from);
  const dTo = dateParam(sp.to);
  const q = safeSearch(sp.q);

  let query = supabase
    .from('payments')
    .select('*, deal:deals(title), project:projects(project_name)', { count: 'exact' })
    .order('paid_at', { ascending: false });
  if ((PAYMENT_STATUSES as readonly string[]).includes(sp.status ?? '')) query = query.eq('status', sp.status!);
  if ((PAYMENT_METHODS as readonly string[]).includes(sp.method ?? '')) query = query.eq('payment_method', sp.method!);
  if (q) query = query.or(`client_name.ilike.%${q}%,payment_reference.ilike.%${q}%`);
  if (dFrom) query = query.gte('paid_at', dFrom);
  if (dTo) query = query.lte('paid_at', dTo + 'T23:59:59');

  const [{ data: payments, count, error }, finRes, summaryRes, statusRes, dealsRes, projectsRes] = await Promise.all([
    query.range(from, to),
    supabase.from('financial_overview').select('*').maybeSingle(),
    supabase.from('deal_financial_summary').select('deal_id, title, deal_value, net_received, outstanding_balance, deal_status').eq('deal_status', 'won').gt('outstanding_balance', 0).order('outstanding_balance', { ascending: false }),
    supabase.from('payments').select('status, amount, transaction_type'),
    supabase.from('deals').select('id, title').order('created_at', { ascending: false }),
    supabase.from('projects').select('id, project_name').order('created_at', { ascending: false })
  ]);

  const fin = (finRes.data ?? {}) as Record<string, number>;
  const outstanding = summaryRes.data ?? [];
  const all = statusRes.data ?? [];
  const sumBy = (s: string) => all.filter((p) => p.status === s && p.transaction_type === 'payment').reduce((t, p) => t + Number(p.amount), 0);
  const refunds = all.filter((p) => p.status === 'successful' && p.transaction_type === 'refund').reduce((t, p) => t + Number(p.amount), 0);
  const dealOptions = (dealsRes.data ?? []).map((d) => ({ id: d.id, name: d.title }));
  const projectOptions = (projectsRes.data ?? []).map((p) => ({ id: p.id, name: p.project_name }));
  const rows = payments ?? [];
  const filtered = Boolean(sp.status || sp.method || q || dFrom || dTo);

  return (
    <>
      <PageHeader title="Payments" description="All amounts in Nigerian Naira. Revenue counts successful payments only, minus refunds.">
        <LinkButton href="/api/export?type=payments" variant="ghost">Export CSV</LinkButton>
        <PaymentDialog action={savePayment} deals={dealOptions} projects={projectOptions} />
      </PageHeader>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Revenue received" value={formatNGN(fin.total_net_revenue ?? 0)} tone="green" hint="Net of refunds" />
        <StatCard label="This month" value={formatNGN(fin.current_month_net_revenue ?? 0)} />
        <StatCard label="Outstanding balances" value={formatNGN(fin.outstanding_balance ?? 0)} tone="gold" hint="Won deals not yet paid in full" />
        <StatCard label="Pending" value={formatNGN(sumBy('pending'))} hint="Not counted as revenue" />
        <StatCard label="Refunded" value={formatNGN(refunds)} tone="red" />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FilterBar
            basePath="/finance"
            values={{ q: sp.q, status: sp.status, method: sp.method, from: sp.from, to: sp.to }}
            filters={[
              { kind: 'search', name: 'q', placeholder: 'Search client or reference…' },
              { kind: 'select', name: 'status', label: 'Status', options: PAYMENT_STATUSES.map((s) => ({ value: s, label: label(s) })) },
              { kind: 'select', name: 'method', label: 'Method', options: PAYMENT_METHODS.map((m) => ({ value: m, label: label(m) })) },
              { kind: 'date', name: 'from', label: 'From' },
              { kind: 'date', name: 'to', label: 'To' }
            ]}
          />
          {error ? <ErrorState title="Could not load payments" message={error.message} /> : null}
          <Card>
            <CardHeader title="Payment history" subtitle={`${count ?? 0} records`} />
            {!rows.length && !error ? (
              <EmptyState title={filtered ? 'No payments match these filters' : 'No payments recorded'} hint={filtered ? undefined : 'Record a payment when a client pays.'} />
            ) : (
              <>
                <Table minWidth={860}>
                  <thead><tr><TH>Date</TH><TH>Client / link</TH><TH>Type</TH><TH>Amount</TH><TH>Method</TH><TH>Status</TH><TH><span className="sr-only">Actions</span></TH></tr></thead>
                  <tbody>
                    {rows.map((p) => {
                      const deal = one(p.deal as Rel<{ title: string }>);
                      const project = one(p.project as Rel<{ project_name: string }>);
                      const refund = p.transaction_type === 'refund';
                      return (
                        <tr key={p.id} className="hover:bg-surface-2/60">
                          <TD className="whitespace-nowrap text-xs">{formatDate(p.paid_at)}</TD>
                          <TD>
                            <p>{p.client_name || '—'}</p>
                            <p className="text-xs text-muted">
                              {p.deal_id ? <Link href={`/deals/${p.deal_id}`} className="hover:text-gold">{deal?.title}</Link> : null}
                              {p.deal_id && p.project_id ? ' · ' : ''}
                              {p.project_id ? <Link href={`/projects/${p.project_id}`} className="hover:text-gold">{project?.project_name}</Link> : null}
                            </p>
                          </TD>
                          <TD className="text-muted">{label(p.transaction_type)}</TD>
                          <TD className={`tabular-nums ${refund ? 'text-danger' : ''}`}>{refund ? '−' : ''}{formatNGN(p.amount)}</TD>
                          <TD className="text-muted">{label(p.payment_method)}</TD>
                          <TD><Badge tone={paymentTone[p.status]}>{p.status}</Badge></TD>
                          <TD><PaymentDialog action={savePayment} deals={dealOptions} projects={projectOptions} payment={p} /></TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                <Pagination basePath="/finance" page={page} pageSize={PAGE_SIZE} total={count ?? rows.length} params={{ q: sp.q, status: sp.status, method: sp.method, from: sp.from, to: sp.to }} />
              </>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Outstanding balances" subtitle="Won deals with money still owed" />
          {!outstanding.length ? <EmptyState title="No outstanding balances" /> : (
            <ul>
              {outstanding.map((d) => (
                <li key={d.deal_id} className="border-b border-line/60 last:border-0">
                  <Link href={`/deals/${d.deal_id}`} className="block px-4 py-3 text-sm hover:bg-surface-2">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate">{d.title}</span>
                      <span className="shrink-0 tabular-nums text-gold">{formatNGN(d.outstanding_balance)}</span>
                    </span>
                    <span className="text-[11px] text-muted">{formatNGN(d.net_received)} of {formatNGN(d.deal_value)} received</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
