'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { paymentSchema, expenseSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull } from './helpers';

export async function savePayment(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(paymentSchema, formData);
    if (error) throw new Error(error);
    const supabase = await createClient();
    const values = {
      deal_id: blankToNull(data.deal_id),
      client_name: data.client_name ?? '',
      amount: data.amount,
      method: data.method,
      status: data.status,
      reference: data.reference ?? '',
      received_at: data.received_at,
      recorded_by: profile.id,
      notes: data.notes ?? ''
    };
    const id = blankToNull(formData.get('id'));
    if (id) {
      const { error: upErr } = await supabase.from('payments').update(values).eq('id', id);
      if (upErr) throw upErr;
      await audit('update', 'payment', id, { amount: data.amount, status: data.status });
      revalidatePath('/finance');
      return 'Payment updated';
    }
    const { data: created, error: inErr } = await supabase.from('payments').insert(values).select('id').single();
    if (inErr) throw inErr;
    await audit('create', 'payment', created.id, { amount: data.amount, status: data.status });
    revalidatePath('/finance');
    return 'Payment recorded';
  });
}

export async function deletePayment(formData: FormData) {
  return runAction(async () => {
    const supabase = await createClient();
    const id = String(formData.get('id'));
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) throw error;
    await audit('delete', 'payment', id);
    revalidatePath('/finance');
    return 'Payment deleted';
  });
}

export async function saveExpense(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(expenseSchema, formData);
    if (error) throw new Error(error);
    const supabase = await createClient();
    const values = {
      title: data.title,
      category: data.category,
      amount: data.amount,
      spent_at: data.spent_at,
      method: data.method,
      reference: data.reference ?? '',
      notes: data.notes ?? '',
      recorded_by: profile.id
    };
    const id = blankToNull(formData.get('id'));
    if (id) {
      const { error: upErr } = await supabase.from('expenses').update(values).eq('id', id);
      if (upErr) throw upErr;
      await audit('update', 'expense', id, { amount: data.amount });
      revalidatePath('/finance');
      return 'Expense updated';
    }
    const { data: created, error: inErr } = await supabase.from('expenses').insert(values).select('id').single();
    if (inErr) throw inErr;
    await audit('create', 'expense', created.id, { amount: data.amount });
    revalidatePath('/finance');
    return 'Expense recorded';
  });
}

export async function deleteExpense(formData: FormData) {
  return runAction(async () => {
    const supabase = await createClient();
    const id = String(formData.get('id'));
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    await audit('delete', 'expense', id);
    revalidatePath('/finance');
    return 'Expense deleted';
  });
}
