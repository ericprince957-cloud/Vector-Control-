-- Vector Control — founder provisioning
-- The first user to sign up becomes Founder. Optionally, emails listed in the
-- FOUNDER_EMAILS setting (or the allow-list table below) are provisioned as founder too.

create table public.founder_allowlist (
  email text primary key
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  founder_exists boolean;
  is_allowed boolean;
begin
  select exists (select 1 from public.profiles where role = 'founder') into founder_exists;

  select exists (
    select 1 from public.founder_allowlist where lower(email) = lower(new.email)
  ) or exists (
    select 1 from pg_settings where name = 'app.founder_emails'
      and setting ilike '%' || new.email || '%'
  ) into is_allowed;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when not founder_exists or is_allowed then 'founder'::public.user_role else 'staff' end
  )
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- audit helper callable from server actions
create or replace function public.log_audit(p_action text, p_entity text, p_entity_id uuid, p_details jsonb default '{}')
returns void
language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_details);
$$;
