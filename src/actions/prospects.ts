'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prospectSchema, parseOrError } from '@/lib/validators';
import { runAction, audit, blankToNull } from './helpers';

export async function saveProspect(formData: FormData) {
  return runAction(async (profile) => {
    const { data, error } = parseOrError(prospectSchema, formData);
    if (error) throw new Error(error);
    const supabase = await createClient();

    const values = {
      company_name: data.company_name,
      contact_name: data.contact_name ?? '',
      industry: data.industry ?? '',
      phone: data.phone ?? '',
      whatsapp: data.whatsapp ?? '',
      email: data.email ?? '',
      website: data.website ?? '',
      location: data.location ?? '',
      lead_source: data.lead_source ?? '',
      assigned_to: blankToNull(data.assigned_to),
      estimated_budget: data.estimated_budget,
      notes: data.notes ?? '',
      status: data.status,
      last_contact_at: blankToNull(data.last_contact_at as string),
      next_follow_up_date: blankToNull(data.next_follow_up_date as string)
    };

    const id = blankToNull(formData.get('id'));
    if (id) {
      const { error: upErr } = await supabase.from('prospects').update(values).eq('id', id);
      if (upErr) throw upErr;
      await audit('update', 'prospect', id, { company: data.company_name });
      revalidatePath('/prospects');
      revalidatePath(`/prospects/${id}`);
      return 'Prospect updated';
    }

    const { data: created, error: inErr } = await supabase
      .from('prospects')
      .insert({ ...values, assigned_to: values.assigned_to ?? profile.id })
      .select('id')
      .single();
    if (inErr) throw inErr;
    await audit('create', 'prospect', created.id, { company: data.company_name });
    revalidatePath('/prospects');
    return 'Prospect added';
  });
}

export async function deleteProspect(formData: FormData) {
  return runAction(async () => {
    const supabase = await createClient();
    const id = String(formData.get('id'));
    const { error } = await supabase.from('prospects').delete().eq('id', id);
    if (error) throw error;
    await audit('delete', 'prospect', id);
    revalidatePath('/prospects');
    return 'Prospect deleted';
  });
}

export async function importProspectsCSV(formData: FormData) {
  return runAction(async () => {
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
        whatsapp: rec['whatsapp'] || '',
        email: rec['email'] || '',
        location: rec['location'] || '',
        lead_source: rec['lead source'] || rec['lead_source'] || 'csv_import',
        estimated_budget: Number(rec['estimated budget'] || rec['budget'] || 0) || 0,
        status: 'new' as const
      };
    }).filter((r) => r.company_name);

    if (rows.length === 0) throw new Error('No valid rows found');
    const { error } = await supabase.from('prospects').insert(rows);
    if (error) throw error;
    await audit('import', 'prospect', null, { count: rows.length });
    revalidatePath('/prospects');
    return `Imported ${rows.length} prospects`;
  });
}

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
