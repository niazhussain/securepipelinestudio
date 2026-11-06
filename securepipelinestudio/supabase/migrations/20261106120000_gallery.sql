-- Community gallery for SecurePipeline Studio.
-- Apply this file in the Supabase SQL editor, or with the Supabase CLI:
--   supabase link --project-ref <ref>
--   supabase db push
--
-- The anon key is public. Row Level Security is the access control for every
-- table below. Do not put a privileged database key in the app, in CI, or in
-- an example. Status changes are made by running SQL as the project owner in
-- the SQL editor, which is not the anon or authenticated role.
--
-- Trigger helpers live in the private schema. The API roles have no usage on
-- that schema, so the helpers are not callable through the data API.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_handle text not null,
  title text not null,
  description text not null,
  tags text[] not null default '{}',
  license text not null,
  yaml text not null,
  created_at timestamptz not null default now(),
  status text not null default 'visible',
  constraint templates_author_handle_len check (char_length(author_handle) between 1 and 39),
  constraint templates_author_handle_format check (author_handle ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$'),
  constraint templates_title_len check (char_length(title) between 1 and 80),
  constraint templates_description_len check (char_length(description) between 1 and 500),
  constraint templates_tags_count check (cardinality(tags) between 1 and 8),
  constraint templates_license_allowed check (
    license in ('MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'CC0-1.0', 'Unlicense')
  ),
  constraint templates_yaml_size check (octet_length(yaml) between 1 and 65536),
  constraint templates_status_allowed check (status in ('visible', 'hidden'))
);

create or replace function private.templates_tags_ok(tags text[])
returns boolean
language sql
immutable
as $$
  select not exists (
    select 1
    from unnest(tags) as tag
    where char_length(tag) < 1
      or char_length(tag) > 24
      or tag !~ '^[a-z0-9][a-z0-9-]*$'
  );
$$;

alter table public.templates
  add constraint templates_tags_format check (private.templates_tags_ok(tags));

create index templates_visible_created_at
  on public.templates (created_at desc)
  where status = 'visible';

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  reporter uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint reports_reason_len check (char_length(reason) between 1 and 500),
  constraint reports_one_per_user unique (template_id, reporter)
);

create index reports_template_id on public.reports (template_id);

alter table public.templates enable row level security;
alter table public.reports enable row level security;

grant usage on schema public to anon, authenticated;

grant select on public.templates to anon, authenticated;
grant insert (author_handle, title, description, tags, license, yaml)
  on public.templates to authenticated;
grant update (title, description, tags, license, yaml)
  on public.templates to authenticated;
grant delete on public.templates to authenticated;

grant select, insert (template_id, reason) on public.reports to authenticated;

create policy templates_select_visible
  on public.templates
  for select
  to anon, authenticated
  using (status = 'visible');

create policy templates_insert_own
  on public.templates
  for insert
  to authenticated
  with check (owner = auth.uid() and status = 'visible');

create policy templates_update_own
  on public.templates
  for update
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid() and status = 'visible');

create policy templates_delete_own
  on public.templates
  for delete
  to authenticated
  using (owner = auth.uid());

create policy reports_select_own
  on public.reports
  for select
  to authenticated
  using (reporter = auth.uid());

create policy reports_insert_own
  on public.reports
  for insert
  to authenticated
  with check (reporter = auth.uid());

create or replace function private.protect_template_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owner is distinct from old.owner then
    raise exception 'template rejected';
  end if;
  if new.status is distinct from old.status and current_user in ('anon', 'authenticated') then
    raise exception 'template rejected';
  end if;
  return new;
end;
$$;

create trigger templates_protect_columns
  before update on public.templates
  for each row
  execute function private.protect_template_columns();

create or replace function private.enforce_publish_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  published_today integer;
begin
  select count(*)
    into published_today
  from public.templates
  where owner = new.owner
    and created_at > now() - interval '1 day';
  if published_today >= 10 then
    raise exception 'template rejected';
  end if;
  return new;
end;
$$;

create trigger templates_publish_quota
  before insert on public.templates
  for each row
  execute function private.enforce_publish_quota();

create or replace function private.reject_template_secrets()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.yaml ~ '-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----'
     or new.yaml ~ 'gh[pousr]_[A-Za-z0-9]{36}'
     or new.yaml ~ 'github_pat_[A-Za-z0-9_]{22,}'
     or new.yaml ~ 'AKIA[0-9A-Z]{16}'
     or new.yaml ~ 'xox[baprs]-[A-Za-z0-9-]{10,}'
  then
    raise exception 'template rejected';
  end if;
  return new;
end;
$$;

create trigger templates_reject_secrets
  before insert or update on public.templates
  for each row
  execute function private.reject_template_secrets();

revoke all on function private.templates_tags_ok(text[]) from public, anon, authenticated;
revoke all on function private.protect_template_columns() from public, anon, authenticated;
revoke all on function private.enforce_publish_quota() from public, anon, authenticated;
revoke all on function private.reject_template_secrets() from public, anon, authenticated;

-- The role that runs an insert still needs to execute the trigger functions.
-- Schema usage stays revoked, so these grants do not expose an API endpoint.
grant execute on function private.protect_template_columns() to authenticated;
grant execute on function private.enforce_publish_quota() to authenticated;
grant execute on function private.reject_template_secrets() to authenticated;
