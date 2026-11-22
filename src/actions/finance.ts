'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { paymentSchema, expenseSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull, withAuditWarning } from './helpers';

export async function savePayment(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(paymentSchema, formData);
    if (error || !data) throw new Error(error || 'Invalid form data');
    const supabase = await createClient();
    const values = {
      deal_id: blankToNull(data.deal_id),
      project_id: blankToNull(data.project_id),
      client_name: data.client_name ?? '',
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      payment_method: data.payment_method,
      payment_reference: data.payment_reference ?? '',
      paid_at: data.paid_at,
      transaction_type: data.transaction_type,
      notes: data.notes ?? '',
      recorded_by: profile.id
    };
    const id = blankToNull(formData.get('id'));
    if (id) {
      const { error: upErr } = await supabase.from('payments').update(values).eq('id', id);
      if (upErr) throw upErr;
      revalidatePath('/finance');
      revalidatePath('/overview');
      return withAuditWarning('Payment updated', await audit('update', 'payment', id, { amount: data.amount, status: data.status, type: data.transaction_type }));
    }
    const { data: created, error: inErr } = await supabase.from('payments').insert(values).select('id').single();
    if (inErr) throw inErr;
    revalidatePath('/finance');
    revalidatePath('/overview');
    return withAuditWarning(
      data.transaction_type === 'refund' ? 'Refund recorded' : 'Payment recorded',
      await audit('create', 'payment', created.id, { amount: data.amount, status: data.status, type: data.transaction_type })
    );
  });
}

export async function saveExpense(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(expenseSchema, formData);
    if (error || !data) throw new Error(error || 'Invalid form data');
    const supabase = await createClient();
    const values = {
      title: data.title,
      category: data.category,
      amount: data.amount,
      currency: data.currency,
      expense_date: data.expense_date,
      vendor: data.vendor ?? '',
      reference: data.reference ?? '',
      notes: data.notes ?? '',
      recorded_by: profile.id
    };
    const id = blankToNull(formData.get('id'));
    if (id) {
      const { error: upErr } = await supabase.from('expenses').update(values).eq('id', id);
      if (upErr) throw upErr;
      revalidatePath('/finance');
      revalidatePath('/overview');
      return withAuditWarning('Expense updated', await audit('update', 'expense', id, { amount: data.amount }));
    }
    const { data: created, error: inErr } = await supabase.from('expenses').insert(values).select('id').single();
    if (inErr) throw inErr;
    revalidatePath('/finance');
    revalidatePath('/overview');
    return withAuditWarning('Expense recorded', await audit('create', 'expense', created.id, { amount: data.amount }));
  });
}
