-- Ringgit Log: accounts, expense records, receipt files and reading limits.
-- Every table has row-level security, so a signed-in person can only read or change their own rows and files.

-- profiles: one per account
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  settings     jsonb not null default '{}'::jsonb
               check (jsonb_typeof(settings) = 'object' and length(settings::text) <= 20000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.profiles is 'One row per Ringgit Log account: display name and app settings such as office parking places.';

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'display_name', 80), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.profiles_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_before_write before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

-- records: every expense, owned by one account
create table public.records (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id          text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  date        date not null check (date between date '2000-01-01' and date '2099-12-31'),
  time        text not null default '' check (time = '' or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  amount      numeric(12, 2) not null default 0 check (amount >= 0),
  category    text not null default 'other'
              check (category in ('food', 'travel', 'parking', 'shopping', 'bills', 'other')),
  travel_kind text not null default '' check (travel_kind in ('', 'toll', 'fuel', 'transit', 'ride', 'other')),
  description text not null default '' check (char_length(description) <= 200),
  note        text not null default '' check (char_length(note) <= 1000),
  source      text not null default 'manual' check (source ~ '^[a-z]{1,20}$'),
  parking     jsonb check (parking is null or (jsonb_typeof(parking) = 'object' and length(parking::text) <= 4000)),
  trip        jsonb check (trip is null or (jsonb_typeof(trip) = 'object' and length(trip::text) <= 20000)),
  attachments jsonb not null default '[]'::jsonb
              check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 20 and length(attachments::text) <= 20000),
  extra       jsonb not null default '{}'::jsonb
              check (jsonb_typeof(extra) = 'object' and length(extra::text) <= 4000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);
comment on table public.records is 'Ringgit Log expense records. Each row belongs to one account (user_id).';
comment on column public.records.parking is 'Parking details: kind (office or onsite), location, operator, entry, exit, mins.';
comment on column public.records.trip is 'Trip details: from, to, route, roads, km, mins, tolls, round, basis.';
comment on column public.records.attachments is 'Receipt files in the receipts bucket: [{id (path), pdf, name, at}].';
create index records_user_date on public.records (user_id, date);

create function public.records_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger records_before_write before insert or update on public.records
  for each row execute function public.records_before_write();

-- automatic reading: how many readings each account used per day (Malaysia time)
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  calls   integer not null default 0 check (calls >= 0),
  primary key (user_id, day)
);
comment on table public.ai_usage is 'Automatic readings used per account per day (Malaysia time). Written only by the read Edge Function.';

-- row-level security: each account sees only its own rows; ai_usage has no policies, so only the server can use it
alter table public.profiles enable row level security;
alter table public.records enable row level security;
alter table public.ai_usage enable row level security;

create policy "Read own profile" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "Add own profile" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "Update own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Read own records" on public.records for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Add own records" on public.records for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Change own records" on public.records for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own records" on public.records for delete to authenticated
  using ((select auth.uid()) = user_id);

-- receipt files: a private bucket; each account's files live in a folder named after its user id
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 20971520,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);

create policy "Read own receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Add own receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- for the site owner only: a schema the website cannot reach; open it in Table Editor (schema: private)
create schema private;
create view private.accounts as
select u.id,
       u.email,
       coalesce(p.display_name, '') as display_name,
       u.created_at                 as signed_up,
       u.last_sign_in_at,
       (select count(*) from public.records r where r.user_id = u.id) as records,
       (select max(r.date) from public.records r where r.user_id = u.id) as last_record
from auth.users u
left join public.profiles p on p.id = u.id;
comment on view private.accounts is 'Every Ringgit Log account with its sign-up date, last sign-in and number of records.';
