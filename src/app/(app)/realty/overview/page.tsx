import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, Building, Users, Inbox, Handshake, BriefcaseBusiness, ArrowUpRight, MapPin, Clock3 } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function RealtyOverviewPage() {
  const profile = await requireProfile();
  if (profile.role !== 'founder') redirect('/access-denied');
  const supabase = await createClient();

  const [properties, contacts, enquiries, partnerships, deals, recentEnquiries] = await Promise.all([
    supabase.from('realty_properties').select('id', { count: 'exact', head: true }),
    supabase.from('realty_contacts').select('id', { count: 'exact', head: true }),
    supabase.from('realty_enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('realty_partnerships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('realty_deals').select('id', { count: 'exact', head: true }),
    supabase.from('realty_enquiries').select('id,full_name,enquiry_type,status,created_at,message').order('created_at', { ascending: false }).limit(5)
  ]);

  const stats = [
    { label: 'Property records', value: properties.count ?? 0, icon: Building, href: '/realty/properties', note: 'Your property pipeline' },
    { label: 'Contacts', value: contacts.count ?? 0, icon: Users, href: '/realty/contacts', note: 'Owners, buyers and investors' },
    { label: 'New enquiries', value: enquiries.count ?? 0, icon: Inbox, href: '/realty/enquiries', note: 'Awaiting first response' },
    { label: 'Active partners', value: partnerships.count ?? 0, icon: Handshake, href: '/realty/partnerships', note: 'Current relationships' },
    { label: 'Deals', value: deals.count ?? 0, icon: BriefcaseBusiness, href: '/realty/deals', note: 'Opportunities in progress' }
  ];
  const modules = [
    { title: 'Properties', detail: 'Track verified property opportunities and listing status.', href: '/realty/properties', icon: Building },
    { title: 'Contacts', detail: 'Keep owners, buyers, investors and professionals organised.', href: '/realty/contacts', icon: Users },
    { title: 'Enquiries', detail: 'Review and follow up on incoming interest.', href: '/realty/enquiries', icon: Inbox },
    { title: 'Partnerships', detail: 'Manage developers, sourcing partners and professional relationships.', href: '/realty/partnerships', icon: Handshake },
    { title: 'Deals', detail: 'Track negotiations, due diligence and completed transactions.', href: '/realty/deals', icon: BriefcaseBusiness }
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold"><Building2 size={14} /> Company workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Vectors Realty</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Real estate opportunities, relationships and transactions — managed separately from Vector Codes.</p>
        </div>
        <span className="rounded border border-line bg-surface px-3 py-2 text-xs text-muted">Founder workspace · NGN</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((item) => (
          <Link key={item.label} href={item.href} className="group rounded-md border border-line bg-surface p-4 transition-colors hover:border-gold/50">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded border border-line bg-surface-2 text-gold"><item.icon size={17} /></span>
              <ArrowUpRight size={15} className="text-muted transition-colors group-hover:text-gold" />
            </div>
            <p className="mt-4 text-2xl font-semibold tabular-nums">{item.value}</p>
            <p className="mt-1 text-xs font-medium">{item.label}</p>
            <p className="mt-1 text-[11px] text-muted">{item.note}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-md border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div><h2 className="text-sm font-semibold">Workspace modules</h2><p className="text-xs text-muted">Your real estate operating areas</p></div>
            <span className="text-[10px] uppercase tracking-wider text-muted">5 modules</span>
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-2">
            {modules.map((item) => (
              <Link key={item.title} href={item.href} className="group flex gap-3 bg-surface p-4 transition-colors hover:bg-surface-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line bg-surface-2 text-gold"><item.icon size={17} /></span>
                <span className="min-w-0 flex-1"><span className="flex items-center justify-between text-sm font-medium">{item.title}<ArrowUpRight size={14} className="text-muted group-hover:text-gold" /></span><span className="mt-1 block text-xs leading-relaxed text-muted">{item.detail}</span></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div><h2 className="text-sm font-semibold">Latest enquiries</h2><p className="text-xs text-muted">Most recent inbound interest</p></div>
            <Link href="/realty/enquiries" className="text-xs text-gold hover:underline">View all</Link>
          </div>
          {!recentEnquiries.data?.length ? (
            <div className="px-5 py-10 text-center"><Inbox size={22} className="mx-auto text-muted" /><p className="mt-3 text-sm font-medium">No enquiries yet</p><p className="mt-1 text-xs text-muted">New enquiries will appear here when they are recorded.</p></div>
          ) : (
            <div className="divide-y divide-line">
              {recentEnquiries.data.map((item: any) => (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-medium">{item.full_name}</p><span className="shrink-0 rounded border border-line px-2 py-0.5 text-[10px] capitalize text-muted">{item.status}</span></div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted">{item.message || item.enquiry_type}</p>
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-muted"><Clock3 size={11} /> {new Date(item.created_at).toLocaleDateString('en-NG')}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="rounded-md border border-gold/25 bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded border border-gold/30 text-gold"><MapPin size={17} /></span>
          <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Operate on verified information</h2><p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">Only publish property opportunities when ownership or marketing authority and relevant documents have been checked. This workspace starts empty by design; it does not contain sample listings or invented traction.</p></div>
        </div>
      </div>
    </div>
  );
}
