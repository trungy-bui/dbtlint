-- noqa: disable=PRS
alter table public.users alter column full_name drop not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'uuid'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'id'
  ) then
    alter table public.users rename column uuid to id;
  end if;
end;
$$;

alter table public.users add column if not exists avatar_url text;
alter table public.users add column if not exists updated_at timestamp default now();
alter table public.users drop column if exists password;

alter table public.scans add column if not exists user_id uuid references public.users(id) on delete cascade;
alter table public.scans alter column user_id set not null;
create index if not exists scans_user_id_date_idx on public.scans(user_id, date desc);

alter table public.scans enable row level security;

drop policy if exists "Users can view their own scans" on public.scans;
drop policy if exists "Users can insert their own scans" on public.scans;

create policy "Users can view their own scans"
  on public.scans for select
  using (auth.uid() = user_id);

create policy "Users can insert their own scans"
  on public.scans for insert
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.users.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_id_fkey'
  ) then
    alter table public.users add constraint users_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end;
$$;
