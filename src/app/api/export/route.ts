import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceAccess } from '@/lib/auth';
import { toCSV } from '@/lib/utils';

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get('type') ?? '';
  const supabase = await createClient();

  const financeTypes = ['payments', 'expenses', 'report-monthly'];
  if (financeTypes.includes(type)) await requireFinanceAccess();

  let rows: Record<string, unknown>[] = [];
  let filename = 'export.csv';

  if (type === 'prospects') {
    const { data } = await supabase.from('prospects').select('*').order('created_at');
    rows = data ?? [];
    filename = 'prospects.csv';
  } else if (type === 'payments') {
    const { data } = await supabase.from('payments').select('*').order('paid_at');
    rows = data ?? [];
    filename = 'payments.csv';
  } else if (type === 'expenses') {
    const { data } = await supabase.from('expenses').select('*').order('expense_date');
    rows = data ?? [];
    filename = 'expenses.csv';
  } else if (type === 'deals') {
    const { data } = await supabase.from('deals').select('*').order('created_at');
    rows = data ?? [];
    filename = 'deals.csv';
  } else if (type === 'report-monthly') {
    const [{ data: payments }, { data: expenses }] = await Promise.all([
      supabase.from('payments').select('amount, status, transaction_type, paid_at'),
      supabase.from('expenses').select('amount, expense_date')
    ]);
    const months = new Set<string>();
    (payments ?? []).forEach((p) => months.add(String(p.paid_at).slice(0, 7)));
    (expenses ?? []).forEach((e) => months.add(String(e.expense_date).slice(0, 7)));
    rows = [...months].sort().map((m) => {
      const revenue = (payments ?? [])
        .filter((p) => p.status === 'successful' && String(p.paid_at).slice(0, 7) === m)
        .reduce((s, p) => s + (p.transaction_type === 'refund' ? -Number(p.amount) : Number(p.amount)), 0);
      const exp = (expenses ?? []).filter((e) => String(e.expense_date).slice(0, 7) === m).reduce((s, e) => s + Number(e.amount), 0);
      return { month: m, revenue, expenses: exp, net: revenue - exp };
    });
    filename = 'monthly-report.csv';
  } else {
    return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
  }

  return new NextResponse(toCSV(rows) || 'no data', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
