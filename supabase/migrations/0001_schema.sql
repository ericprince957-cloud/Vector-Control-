-- Vector Control — core schema
create extension if not exists "pgcrypto";

-- enums ---------------------------------------------------------------------
create type public.user_role as enum ('founder', 'admin', 'staff');
create type public.prospect_status as enum ('new','contacted','responded','interested','qualified','converted','disqualified','on_hold');
create type public.outreach_channel as enum ('whatsapp','telegram','email','linkedin','phone','in_person','other');
create type public.outreach_direction as enum ('outbound','inbound');
create type public.outreach_outcome as enum ('no_response','interested','requested_info','meeting_scheduled','proposal_requested','not_interested','follow_up_required','referred');
create type public.deal_status as enum ('draft','proposal_sent','negotiation','won','lost','cancelled');
create type public.project_status as enum ('not_started','in_progress','under_review','completed','on_hold','cancelled');
create type public.payment_method as enum ('bank_transfer','cash','card','pos','other');
create type public.payment_status as enum ('pending','successful','failed','refunded');
create type public.rejection_reason as enum ('too_expensive','budget_unavailable','chose_competitor','no_response','not_interested','existing_developer','postponed','trust_concerns','timing','other');
create type public.task_priority as enum ('low','medium','high','urgent');

-- profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role public.user_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- prospects -----------------------------------------------------------------
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (length(trim(company_name)) > 0),
  contact_name text not null default '',
  industry text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  website text not null default '',
  location text not null default '',
  lead_source text not null default '',
  assigned_to uuid references public.profiles(id) on delete set null,
  estimated_budget numeric(14,2) not null default 0 check (estimated_budget >= 0),
  notes text not null default '',
  status public.prospect_status not null default 'new',
  last_contact_at date,
  next_follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index prospects_status_idx on public.prospects(status);
create index prospects_assigned_idx on public.prospects(assigned_to);
create index prospects_followup_idx on public.prospects(next_follow_up_date);
create unique index prospects_email_unique_idx on public.prospects(lower(email)) where email <> '';

-- outreach ------------------------------------------------------------------
create table public.outreach_activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  channel public.outreach_channel not null,
  direction public.outreach_direction not null default 'outbound',
  occurred_at timestamptz not null default now(),
  summary text not null default '',
  response text not null default '',
  outcome public.outreach_outcome not null default 'no_response',
  staff_id uuid references public.profiles(id) on delete set null,
  next_follow_up_date date,
  created_at timestamptz not null default now()
);
create index outreach_prospect_idx on public.outreach_activities(prospect_id);
create index outreach_channel_idx on public.outreach_activities(channel);
create index outreach_staff_idx on public.outreach_activities(staff_id);

-- deals ---------------------------------------------------------------------
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  description text not null default '',
  service text not null default '',
  quoted_amount numeric(14,2) not null default 0 check (quoted_amount >= 0),
  negotiated_amount numeric(14,2),
  expected_close_date date,
  assigned_to uuid references public.profiles(id) on delete set null,
  status public.deal_status not null default 'draft',
  proposal_notes text not null default '',
  contract_notes text not null default '',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deals_status_idx on public.deals(status);
create index deals_prospect_idx on public.deals(prospect_id);
create index deals_assigned_idx on public.deals(assigned_to);

-- rejections ----------------------------------------------------------------
create table public.rejections (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  reason public.rejection_reason not null,
  competitor text not null default '',
  rejected_at date not null default current_date,
  notes text not null default '',
  staff_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index rejections_reason_idx on public.rejections(reason);
create index rejections_prospect_idx on public.rejections(prospect_id);

-- projects ------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  client_name text not null default '',
  deal_id uuid references public.deals(id) on delete set null,
  description text not null default '',
  contract_amount numeric(14,2) not null default 0 check (contract_amount >= 0),
  start_date date,
  deadline date,
  assigned_to uuid references public.profiles(id) on delete set null,
  status public.project_status not null default 'not_started',
  progress_notes text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_status_idx on public.projects(status);
create index projects_deadline_idx on public.projects(deadline);

-- payments ------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete set null,
  client_name text not null default '',
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null default 'bank_transfer',
  status public.payment_status not null default 'pending',
  reference text not null default '',
  received_at date not null default current_date,
  recorded_by uuid references public.profiles(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index payments_status_idx on public.payments(status);
create index payments_deal_idx on public.payments(deal_id);
create index payments_received_idx on public.payments(received_at);

-- expenses ------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  category text not null default 'general',
  amount numeric(14,2) not null check (amount > 0),
  spent_at date not null default current_date,
  method public.payment_method not null default 'bank_transfer',
  reference text not null default '',
  notes text not null default '',
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index expenses_spent_idx on public.expenses(spent_at);

-- tasks ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  assigned_to uuid references public.profiles(id) on delete set null,
  due_date date,
  priority public.task_priority not null default 'medium',
  prospect_id uuid references public.prospects(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index tasks_assigned_idx on public.tasks(assigned_to);
create index tasks_due_idx on public.tasks(due_date);
create index tasks_open_idx on public.tasks(is_completed);

-- audit logs ----------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs(entity, entity_id);
create index audit_logs_actor_idx on public.audit_logs(actor_id);

-- updated_at trigger --------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_prospects_updated before update on public.prospects for each row execute function public.set_updated_at();
create trigger trg_deals_updated before update on public.deals for each row execute function public.set_updated_at();
create trigger trg_projects_updated before update on public.projects for each row execute function public.set_updated_at();
