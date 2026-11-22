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
      whatsapp_link: data.whatsapp_link ?? '',
      email_link: data.email_link ?? '',
      telegram_link: data.telegram_link ?? '',
      prefilled_message: data.prefilled_message ?? '',
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

import { inflateRawSync } from 'node:zlib';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim()); if (row.some((v) => v)) rows.push(row);
      row = []; cell = '';
    } else cell += ch;
  }
  row.push(cell.trim()); if (row.some((v) => v)) rows.push(row);
  return rows;
}

function readXlsx(buffer: Buffer): string[][] {
  const entries = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This Excel file is not a valid .xlsx workbook.');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = buffer.subarray(dataStart, dataStart + size);
    if (method === 0) entries.set(name, compressed);
    else if (method === 8) entries.set(name, inflateRawSync(compressed));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  const xml = (name: string) => entries.get(name)?.toString('utf8') ?? '';
  const decode = (v: string) => v.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const shared = [...xml('xl/sharedStrings.xml').matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decode(t[1])).join('')
  );
  const sheet = xml('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('No first worksheet was found in this Excel file.');
  const colIndex = (ref: string) => {
    let n = 0;
    for (const c of ref.replace(/[0-9]/g, '')) n = n * 26 + c.charCodeAt(0) - 64;
    return n - 1;
  };
  const rows: string[][] = [];
  for (const match of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cell of match[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = cell[1].match(/\br="([^"]+)"/)?.[1] ?? '';
      const type = cell[1].match(/\bt="([^"]+)"/)?.[1] ?? '';
      const value = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
      const inline = [...cell[2].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decode(t[1])).join('');
      const index = colIndex(ref);
      row[index] = type === 's' ? (shared[Number(value)] ?? '') : type === 'inlineStr' ? inline : decode(value);
    }
    rows.push(row.map((v) => v ?? ''));
  }
  return rows;
}

const headerKey = (value: string) => value.toLowerCase().trim().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const aliases: Record<string, string[]> = {
  company_name: ['company', 'company_name', 'companyname', 'business', 'business_name', 'business_name_company'],
  contact_name: ['contact', 'contact_name', 'contact_person', 'person', 'name'],
  phone: ['phone', 'telephone', 'mobile', 'phone_number', 'whatsapp_number'],
  email: ['email', 'email_address', 'contact_email'],
  whatsapp_link: ['whatsapp', 'whatsapp_link', 'whatsapp_url', 'wa_link'],
  email_link: ['email_link', 'email_url', 'mailto_link'],
  telegram_link: ['telegram', 'telegram_link', 'telegram_url', 'telegram_username'],
  prefilled_message: ['message', 'prefilled_message', 'message_template', 'outreach_message'],
  industry: ['industry', 'category', 'business_type'],
  website_url: ['website', 'website_url', 'url'],
  location: ['location', 'address', 'city'],
  source: ['source', 'lead_source'],
  estimated_value: ['estimated_value', 'estimated_budget', 'budget', 'value']
};

export async function importProspectsCSV(formData: FormData) {
  return runAction(async (profile) => {
    const supabase = await createClient();
    const upload = formData.get('file');
    let matrix: string[][];
    if (upload instanceof File && upload.size > 0) {
      if (upload.size > 10 * 1024 * 1024) throw new Error('File is too large. Maximum import size is 10 MB.');
      const name = upload.name.toLowerCase();
      if (name.endsWith('.xlsx')) matrix = readXlsx(Buffer.from(await upload.arrayBuffer()));
      else if (name.endsWith('.csv')) matrix = parseCsv(await upload.text());
      else throw new Error('Upload a .csv or .xlsx file.');
    } else {
      const csv = String(formData.get('csv') ?? '').trim();
      if (!csv) throw new Error('Choose a CSV or Excel file first.');
      matrix = parseCsv(csv);
    }
    if (matrix.length < 2) throw new Error('The file must contain a header row and at least one data row.');
    const headers = matrix[0].map(headerKey);
    const find = (row: string[], field: string) => {
      const idx = headers.findIndex((h) => aliases[field]?.includes(h) || h === field);
      return idx < 0 ? '' : String(row[idx] ?? '').trim();
    };
    const rows = matrix.slice(1).map((row) => {
      const company = find(row, 'company_name');
      const amount = Number(find(row, 'estimated_value').replace(/[₦,\s]/g, '')) || 0;
      return {
        company_name: company,
        contact_name: find(row, 'contact_name'),
        industry: find(row, 'industry'),
        phone: find(row, 'phone'),
        email: find(row, 'email'),
        whatsapp_link: find(row, 'whatsapp_link'),
        email_link: find(row, 'email_link'),
        telegram_link: find(row, 'telegram_link'),
        prefilled_message: find(row, 'prefilled_message'),
        website_url: find(row, 'website_url'),
        location: find(row, 'location'),
        source: find(row, 'source') || 'csv_import',
        estimated_value: amount,
        currency: 'NGN',
        status: 'new' as const,
        created_by: profile.id
      };
    }).filter((r) => r.company_name);
    if (!rows.length) throw new Error('No valid rows found. Ensure your sheet has a Company Name column.');
    const { error } = await supabase.from('prospects').insert(rows);
    if (error) throw error;
    revalidatePath('/prospects');
    return withAuditWarning(`Imported ${rows.length} prospects with contact links and messages`, await audit('import', 'prospect', null, { count: rows.length }));
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
