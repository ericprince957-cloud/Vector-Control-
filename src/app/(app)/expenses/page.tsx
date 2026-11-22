import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceAccess } from '@/lib/auth';
import { formatNGN, formatDate } from '@/lib/utils';
import { Card, CardHeader, StatCard, Table, TH, TD, Badge, EmptyState, ErrorState, LinkButton } from '@/components/ui';
import { PageHeader } from '@/components/page-header';
import { FilterBar } from '@/components/filter-bar';
import { Pagination } from '@/components/pagination';
import { ExpenseDialog } from '@/components/forms';
import { HorizontalBars } from '@/components/charts';
import { saveExpense } from '@/actions/finance';
import { PAGE_SIZE, pageParam, rangeFor, dateParam, safeSearch } from '@/lib/ui-helpers';
import { label } from '@/lib/constants';

export const metadata: Metadata = { title: 'Expenses', description: 'Company expenditure.' };
export const dynamic = 'force-dynamic';

type SP = { category?: string; q?: string; from?: string; to?: string; page?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireFinanceAccess();
  const sp = await searchParams;
  const supabase = await createClient();
  const page = pageParam(sp.page);
  const [from, to] = rangeFor(page);
  const dFrom = dateParam(sp.from);
  const dTo = dateParam(sp.to);
  const q = safeSearch(sp.q);

  // Totals respect the active filters, so "total expenditure" always matches what is listed.
  let totals = supabase.from('expenses').select('category, amount');
  let query = supabase.from('expenses').select('*', { count: 'exact' }).order('expense_date', { ascending: false });
  for (const apply of [(b: typeof query) => {
    if (sp.category) b = b.eq('category', sp.category);
    if (q) b = b.or(`title.ilike.%${q}%,vendor.ilike.%${q}%`);
    if (dFrom) b = b.gte('expense_date', dFrom);
    if (dTo) b = b.lte('expense_date', dTo);
    return b;
  }]) { query = apply(query); totals = apply(totals as never) as never; }

  const [{ data: expenses, count, error }, { data: totalRows }, { data: catRows }] = await Promise.all([
    query.range(from, to),
    totals,
    supabase.from('expenses').select('category')
  ]);

  const categories = [...new Set((catRows ?? []).map((c) => c.category as string).filter(Boolean))].sort();
  const rows = expenses ?? [];
  const totalSpend = (totalRows ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = Object.entries(
    (totalRows ?? []).reduce<Record<string, number>>((acc, e) => { const k = (e.category as string) || 'other'; acc[k] = (acc[k] ?? 0) + Number(e.amount); return acc; }, {})
  ).map(([name, value]) => ({ name: label(name), value })).sort((a, b) => b.value - a.value).slice(0, 8);
  const filtered = Boolean(sp.category || q || dFrom || dTo);

  return (
    <>
      <PageHeader title="Expenses" description="Record and review company spending.">
        <LinkButton href="/api/export?type=expenses" variant="ghost">Export CSV</LinkButton>
        <ExpenseDialog action={saveExpense} categories={categories} />
      </PageHeader>

      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label={filtered ? 'Total (filtered)' : 'Total expenditure'} value={formatNGN(totalSpend)} tone="red" />
        <StatCard label="Records" value={(totalRows ?? []).length} />
        <StatCard label="Categories" value={categories.length} />
      </section>

      <FilterBar
        basePath="/expenses"
        values={{ q: sp.q, category: sp.category, from: sp.from, to: sp.to }}
        filters={[
          { kind: 'search', name: 'q', placeholder: 'Search title or vendor…' },
          { kind: 'select', name: 'category', label: 'Category', options: categories.map((c) => ({ value: c, label: label(c) })) },
          { kind: 'date', name: 'from', label: 'From' },
          { kind: 'date', name: 'to', label: 'To' }
        ]}
      />
      {error ? <ErrorState title="Could not load expenses" message={error.message} /> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Expense history" />
          {!rows.length && !error ? (
            <EmptyState title={filtered ? 'No expenses match these filters' : 'No expenses recorded'} hint={filtered ? undefined : 'Record your first company expense.'} />
          ) : (
            <>
              <Table minWidth={760}>
                <thead><tr><TH>Date</TH><TH>Title</TH><TH>Category</TH><TH>Vendor</TH><TH>Amount</TH><TH><span className="sr-only">Actions</span></TH></tr></thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-2/60">
                      <TD className="whitespace-nowrap text-xs">{formatDate(e.expense_date)}</TD>
                      <TD>{e.title}{e.reference ? <p className="text-[11px] text-muted">Ref: {e.reference}</p> : null}</TD>
                      <TD><Badge>{label(e.category ?? 'other')}</Badge></TD>
                      <TD className="text-muted">{e.vendor || '—'}</TD>
                      <TD className="tabular-nums">{formatNGN(e.amount)}</TD>
                      <TD><ExpenseDialog action={saveExpense} categories={categories} expense={e} /></TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination basePath="/expenses" page={page} pageSize={PAGE_SIZE} total={count ?? rows.length} params={{ q: sp.q, category: sp.category, from: sp.from, to: sp.to }} />
            </>
          )}
        </Card>
        <Card className="h-fit">
          <CardHeader title="Spending by category" />
          <div className="p-4"><HorizontalBars data={byCategory} money /></div>
        </Card>
      </div>
    </>
  );
}
