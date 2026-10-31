-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Every table is locked with row level security: users only see their own rows.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  business_name text,
  trade text check (trade in ('shopkeeper','doctor','tailor','teacher','driver','painter')),
  language text not null default 'hinglish',
  upi_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  kind text not null default 'bill' check (kind in ('bill','note','receipt','quote','trip')),
  items jsonb not null default '[]'::jsonb,
  total numeric(12,2) not null default 0,
  paid boolean not null default false,
  raw_transcript text,
  created_at timestamptz not null default now()
);

create index if not exists customers_user_idx on public.customers (user_id);
create index if not exists entries_user_idx on public.entries (user_id, created_at desc);

alter table public.profiles  enable row level security;
alter table public.customers enable row level security;
alter table public.entries   enable row level security;

create policy "own profile"   on public.profiles  for all using (id = auth.uid())      with check (id = auth.uid());
create policy "own customers" on public.customers for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own entries"   on public.entries   for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Create an empty profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
