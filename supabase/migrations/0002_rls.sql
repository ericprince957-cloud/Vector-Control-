-- Vector Control — Row Level Security
-- Roles are resolved from profiles server-side. Never trust client metadata.

create or replace function public.current_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_founder() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() = 'founder'
$$;

create or replace function public.is_admin_or_founder() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() in ('founder','admin')
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active)
$$;

-- profiles: everyone active can read; only founder can change roles/activation
alter table public.profiles enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (public.is_active_user());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()) and is_active = (select is_active from public.profiles where id = auth.uid()));
create policy profiles_founder_update on public.profiles for update to authenticated
  using (public.is_founder()) with check (public.is_founder());

-- helper to apply standard CRUD policies
-- prospects ---------------------------------------------------------------
alter table public.prospects enable row level security;
create policy prospects_select on public.prospects for select to authenticated using (true);
create policy prospects_insert on public.prospects for insert to authenticated with check (public.is_active_user());
create policy prospects_update on public.prospects for update to authenticated
  using (public.is_admin_or_founder() or assigned_to = auth.uid())
  with check (public.is_admin_or_founder() or assigned_to = auth.uid());
create policy prospects_delete on public.prospects for delete to authenticated using (public.is_founder());

-- outreach ----------------------------------------------------------------
alter table public.outreach_activities enable row level security;
create policy outreach_select on public.outreach_activities for select to authenticated using (true);
create policy outreach_insert on public.outreach_activities for insert to authenticated with check (public.is_active_user());
create policy outreach_update on public.outreach_activities for update to authenticated
  using (public.is_admin_or_founder() or staff_id = auth.uid())
  with check (public.is_admin_or_founder() or staff_id = auth.uid());
create policy outreach_delete on public.outreach_activities for delete to authenticated using (public.is_founder());

-- deals -------------------------------------------------------------------
alter table public.deals enable row level security;
create policy deals_select on public.deals for select to authenticated using (true);
create policy deals_insert on public.deals for insert to authenticated with check (public.is_active_user());
create policy deals_update on public.deals for update to authenticated
  using (public.is_admin_or_founder() or assigned_to = auth.uid())
  with check (public.is_admin_or_founder() or assigned_to = auth.uid());
create policy deals_delete on public.deals for delete to authenticated using (public.is_founder());

-- rejections (no deletes via normal actions — preserve history) -----------
alter table public.rejections enable row level security;
create policy rejections_select on public.rejections for select to authenticated using (true);
create policy rejections_insert on public.rejections for insert to authenticated with check (public.is_active_user());
create policy rejections_update on public.rejections for update to authenticated using (public.is_admin_or_founder()) with check (public.is_admin_or_founder());
-- intentionally no delete policy

-- projects ----------------------------------------------------------------
alter table public.projects enable row level security;
create policy projects_select on public.projects for select to authenticated using (true);
create policy projects_insert on public.projects for insert to authenticated with check (public.is_active_user());
create policy projects_update on public.projects for update to authenticated
  using (public.is_admin_or_founder() or assigned_to = auth.uid())
  with check (public.is_admin_or_founder() or assigned_to = auth.uid());
create policy projects_delete on public.projects for delete to authenticated using (public.is_founder());

-- payments / expenses: finance is founder + admin only ---------------------
alter table public.payments enable row level security;
create policy payments_select on public.payments for select to authenticated using (public.is_admin_or_founder());
create policy payments_insert on public.payments for insert to authenticated with check (public.is_admin_or_founder());
create policy payments_update on public.payments for update to authenticated using (public.is_admin_or_founder()) with check (public.is_admin_or_founder());
create policy payments_delete on public.payments for delete to authenticated using (public.is_founder());

alter table public.expenses enable row level security;
create policy expenses_select on public.expenses for select to authenticated using (public.is_admin_or_founder());
create policy expenses_insert on public.expenses for insert to authenticated with check (public.is_admin_or_founder());
create policy expenses_update on public.expenses for update to authenticated using (public.is_admin_or_founder()) with check (public.is_admin_or_founder());
create policy expenses_delete on public.expenses for delete to authenticated using (public.is_founder());

-- tasks -------------------------------------------------------------------
alter table public.tasks enable row level security;
create policy tasks_select on public.tasks for select to authenticated using (true);
create policy tasks_insert on public.tasks for insert to authenticated with check (public.is_active_user());
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_admin_or_founder() or assigned_to = auth.uid() or created_by = auth.uid())
  with check (public.is_admin_or_founder() or assigned_to = auth.uid() or created_by = auth.uid());
create policy tasks_delete on public.tasks for delete to authenticated using (public.is_founder());

-- audit logs: read for admin+, write via service role / founder only -------
alter table public.audit_logs enable row level security;
create policy audit_select on public.audit_logs for select to authenticated using (public.is_admin_or_founder());
create policy audit_insert on public.audit_logs for insert to authenticated with check (actor_id = auth.uid());
