import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const SECTIONS: Record<string, { title: string; description: string; table: string; columns: { key: string; label: string }[] }> = {
  properties: { title: 'Properties', description: 'Manage residential, commercial and land opportunities.', table: 'realty_properties', columns: [{ key: 'title', label: 'Property' }, { key: 'property_type', label: 'Type' }, { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'price', label: 'Price (NGN)' }, { key: 'status', label: 'Status' }] },
  contacts: { title: 'Contacts', description: 'Owners, buyers, tenants, investors and professional contacts.', table: 'realty_contacts', columns: [{ key: 'full_name', label: 'Name' }, { key: 'contact_type', label: 'Relationship' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'location', label: 'Location' }, { key: 'status', label: 'Status' }] },
  enquiries: { title: 'Enquiries', description: 'Inbound interest in properties, investment and development opportunities.', table: 'realty_enquiries', columns: [{ key: 'full_name', label: 'Name' }, { key: 'enquiry_type', label: 'Enquiry type' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Received' }] },
  partnerships: { title: 'Partnerships', description: 'Developers, sourcing partners and professional relationships.', table: 'realty_partnerships', columns: [{ key: 'organization', label: 'Organisation' }, { key: 'partner_type', label: 'Partner type' }, { key: 'contact_name', label: 'Contact' }, { key: 'location', label: 'Location' }, { key: 'status', label: 'Status' }] },
  deals: { title: 'Deals', description: 'Track property transactions and development opportunities.', table: 'realty_deals', columns: [{ key: 'title', label: 'Opportunity' }, { key: 'deal_type', label: 'Type' }, { key: 'deal_value', label: 'Value (NGN)' }, { key: 'commission_rate', label: 'Commission %' }, { key: 'expected_close_date', label: 'Target close' }, { key: 'status', label: 'Status' }] }
};

function display(value: unknown, key: string) {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'price' || key === 'deal_value') return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value));
  if (key === 'created_at') return new Date(String(value)).toLocaleDateString('en-NG');
  return String(value).replaceAll('_', ' ');
}

export default async function RealtySectionPage({ params }: { params: Promise<{ section: string }> }) {
  const profile = await requireProfile();
  if (profile.role !== 'founder') redirect('/access-denied');
  const { section } = await params;
  const config = SECTIONS[section];
  if (!config) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from(config.table).select('*').order('created_at', { ascending: false }).limit(100);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/realty/overview" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted hover:text-gold"><ArrowLeft size={13} /> Realty overview</Link>
          <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
          <p className="mt-1 text-sm text-muted">{config.description}</p>
        </div>
        <span className="rounded border border-line bg-surface px-3 py-2 text-xs text-muted">{data?.length ?? 0} records</span>
      </div>
      <section className="overflow-hidden rounded-md border border-line bg-surface">
        {error ? <p className="p-5 text-sm text-danger">Could not load this workspace section. Refresh and try again.</p> : !data?.length ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded border border-line bg-surface-2 text-gold"><Plus size={19} /></div>
            <h2 className="mt-4 text-sm font-semibold">No {config.title.toLowerCase()} added yet</h2>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted">This section is ready for your records. We have kept it empty rather than filling it with demonstration data.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-line bg-surface-2 text-[10px] uppercase tracking-wider text-muted"><tr>{config.columns.map((column) => <th key={column.key} className="px-4 py-3 font-semibold">{column.label}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {data.map((row: any) => <tr key={row.id} className="hover:bg-surface-2/60">{config.columns.map((column) => <td key={column.key} className="max-w-64 truncate px-4 py-3 capitalize">{display(row[column.key], column.key)}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
