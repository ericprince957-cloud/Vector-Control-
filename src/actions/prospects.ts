'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prospectSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull, withAuditWarning } from './helpers';

export async function saveProspect(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(prospectSchema, formData);
    if (error || !data) throw new Error(error || 'Invalid form data');
    const supabase = await createClient();

    const assignedTo = profile.role === 'staff' ? profile.id : blankToNull(data.assigned_to);
    const values = {
      company_name: data.company_name,
      contact_name: data.contact_name ?? '',
      industry: data.industry ?? '',
      phone: data.phone ?? '',
      email: data.email ?? '',
      website_url: data.website_url ?? '',
      location: data.location ?? '',
      source: data.source ?? '',
      estimated_value: data.estimated_value,
      currency: data.currency,
      notes: data.notes ?? '',
      status: data.status,
      next_follow_up_at: blankToNull(data.next_follow_up_at as string),
      assigned_to: assignedTo
    };

    const id = blankToNull(formData.get('id'));
    const amountPaid = Number(formData.get('amount_paid') ?? 0);
    if (amountPaid > Number(data.estimated_value)) throw new Error('Amount paid cannot exceed the agreed/estimated value.');
    if (amountPaid > 0 && profile.role === 'staff') throw new Error('Only finance-enabled roles can record payments.');

    if (id) {
      const { error: upErr } = await supabase.from('prospects').update(values).eq('id', id);
      if (upErr) throw upErr;
      if (amountPaid > 0) {
        const { error: payErr } = await supabase.from('payments').insert({
          prospect_id: id, client_name: data.company_name, amount: amountPaid, currency: data.currency,
          status: 'successful', payment_method: data.initial_payment_method, paid_at: data.initial_paid_at || new Date().toISOString().slice(0, 10),
          transaction_type: 'payment', notes: 'Initial payment recorded from prospect form', recorded_by: profile.id
        });
        if (payErr) throw payErr;
      }
      revalidatePath('/prospects');
      revalidatePath(`/prospects/${id}`);
      revalidatePath('/finance');
      return withAuditWarning('Prospect updated', await audit('update', 'prospect', id, { company: data.company_name }));
    }

    const { data: created, error: inErr } = await supabase
      .from('prospects')
      .insert({ ...values, created_by: profile.id })
      .select('id')
      .single();
    if (inErr) throw inErr;
    if (amountPaid > 0) {
      const { error: payErr } = await supabase.from('payments').insert({
        prospect_id: created.id, client_name: data.company_name, amount: amountPaid, currency: data.currency,
        status: 'successful', payment_method: data.initial_payment_method, paid_at: data.initial_paid_at || new Date().toISOString().slice(0, 10),
        transaction_type: 'payment', notes: 'Initial payment recorded from prospect form', recorded_by: profile.id
      });
      if (payErr) throw payErr;
    }
    revalidatePath('/prospects');
    revalidatePath('/finance');
    return withAuditWarning('Prospect added', await audit('create', 'prospect', created.id, { company: data.company_name }));
  });
}

/**
 * Soft-delete: the live database does not grant DELETE to ordinary users.
 * Archiving sets the prospect to "disqualified" and preserves all history.
 */
export async function archiveProspect(formData: FormData) {
  return runAction(async () => {
    const supabase = await createClient();
    const id = String(formData.get('id'));
    const { error } = await supabase.from('prospects').update({ status: 'disqualified' }).eq('id', id);
    if (error) throw error;
    revalidatePath('/prospects');
    return withAuditWarning('Prospect archived (marked disqualified)', await audit('archive', 'prospect', id));
  });
}

export async function importProspectsCSV(formData: FormData) {
  return runAction(async (profile) => {
    const supabase = await createClient();
    const csv = String(formData.get('csv') ?? '').trim();
    if (!csv) throw new Error('Paste CSV content first');
    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(',');
      const rec: Record<string, string> = {};
      headers.forEach((h, i) => (rec[h] = (cols[i] ?? '').trim()));
      return {
        company_name: rec['company name'] || rec['company_name'] || rec['company'] || 'Unknown',
        contact_name: rec['contact name'] || rec['contact_name'] || '',
        industry: rec['industry'] || '',
        phone: rec['phone'] || '',
        email: rec['email'] || '',
        website_url: rec['website'] || rec['website_url'] || '',
        location: rec['location'] || '',
        source: rec['source'] || rec['lead source'] || 'csv_import',
        estimated_value: Number(rec['estimated value'] || rec['estimated budget'] || rec['budget'] || 0) || 0,
        currency: 'NGN',
        status: 'new' as const,
        created_by: profile.id
      };
    }).filter((r) => r.company_name);

    if (rows.length === 0) throw new Error('No valid rows found');
    const { error } = await supabase.from('prospects').insert(rows);
    if (error) throw error;
    revalidatePath('/prospects');
    return withAuditWarning(`Imported ${rows.length} prospects`, await audit('import', 'prospect', null, { count: rows.length }));
  });
}

/** Duplicate detection on email / phone / company name. */
export async function findDuplicates() {
  const supabase = await createClient();
  const { data } = await supabase.from('prospects').select('id, company_name, email, phone');
  if (!data) return [];
  const seen = new Map<string, string[]>();
  for (const p of data) {
    const key = (p.email || p.phone || p.company_name).toLowerCase();
    if (!key) continue;
    seen.set(key, [...(seen.get(key) ?? []), p.company_name]);
  }
  return data.filter((p) => {
    const key = (p.email || p.phone || p.company_name).toLowerCase();
    return key && (seen.get(key)?.length ?? 0) > 1;
  });
}

export async function deleteProspect(formData: FormData) {
  return runAction(async (profile) => {
    if (profile.role !== 'founder') throw new Error('Only the founder can permanently delete prospects.');
    const id = String(formData.get('id') ?? '');
    if (!id) throw new Error('Prospect ID is required');
    const supabase = await createClient();
    const { error } = await supabase.from('prospects').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/prospects');
    revalidatePath('/deals');
    revalidatePath('/projects');
    revalidatePath('/finance');
    return withAuditWarning('Prospect deleted', await audit('delete', 'prospect', id));
  });
}
