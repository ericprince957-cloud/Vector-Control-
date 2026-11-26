-- Vectors Realty workspace. Kept in dedicated tables so Vector Codes records remain untouched.
create table if not exists public.realty_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  contact_type text not null default 'buyer' check (contact_type in ('owner','buyer','investor','tenant','developer','partner','professional')),
  phone text not null default '',
  email text not null default '',
  location text not null default '',
  notes text not null default '',
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);



create table if not exists public.realty_properties (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  property_type text not null default 'residential' check (property_type in ('residential','commercial','land','mixed_use','industrial')),
  listing_type text not null default 'sale' check (listing_type in ('sale','rent','lease','investment')),
  address text not null default '',
  city text not null default '',
  state text not null default '',
  price numeric(16,2) not null default 0 check (price >= 0),
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  bathrooms integer check (bathrooms is null or bathrooms >= 0),
  land_size text not null default '',
  description text not null default '',
  owner_contact_id uuid,
  status text not null default 'draft' check (status in ('draft','available','under_offer','sold','leased','withdrawn')),
  is_published boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.realty_enquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.realty_properties(id) on delete set null,
  full_name text not null check (length(trim(full_name)) > 0),
  email text not null default '',
  phone text not null default '',
  enquiry_type text not null default 'property' check (enquiry_type in ('property','investment','development','partnership','general')),
  message text not null default '',
  source text not null default 'dashboard',
  status text not null default 'new' check (status in ('new','contacted','qualified','closed','spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.realty_partnerships (
  id uuid primary key default gen_random_uuid(),
  organization text not null check (length(trim(organization)) > 0),
  contact_name text not null default '',
  partner_type text not null default 'developer' check (partner_type in ('developer','sourcing','agent','legal','finance','construction','other')),
  phone text not null default '',
  email text not null default '',
  location text not null default '',
  notes text not null default '',
  status text not null default 'prospective' check (status in ('prospective','active','paused','ended')),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.realty_deals (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  property_id uuid references public.realty_properties(id) on delete set null,
  contact_id uuid references public.realty_contacts(id) on delete set null,
  deal_type text not null default 'sale' check (deal_type in ('sale','rent','lease','joint_venture','development','investment')),
  deal_value numeric(16,2) not null default 0 check (deal_value >= 0),
  commission_rate numeric(5,2) not null default 0 check (commission_rate between 0 and 100),
  expected_close_date date,
  status text not null default 'lead' check (status in ('lead','negotiation','due_diligence','won','lost','cancelled')),
  notes text not null default '',
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


alter table public.realty_properties add constraint realty_properties_owner_contact_fkey foreign key (owner_contact_id) references public.realty_contacts(id) on delete set null;

create index if not exists realty_properties_status_idx on public.realty_properties(status);
create index if not exists realty_properties_location_idx on public.realty_properties(state, city);
create index if not exists realty_contacts_type_idx on public.realty_contacts(contact_type);
create index if not exists realty_enquiries_status_idx on public.realty_enquiries(status);
create index if not exists realty_partnerships_status_idx on public.realty_partnerships(status);
create index if not exists realty_deals_status_idx on public.realty_deals(status);

create or replace function private.realty_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['realty_properties','realty_contacts','realty_enquiries','realty_partnerships','realty_deals'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function private.realty_set_updated_at()', t || '_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_founder_access', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select private.is_active_user()) and (select private.is_founder_user())) with check ((select private.is_active_user()) and (select private.is_founder_user()))', t || '_founder_access', t);
  end loop;
end;
$$;

revoke all on function private.realty_set_updated_at() from public, anon, authenticated;
