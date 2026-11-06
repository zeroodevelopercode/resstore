-- Jalankan di Supabase: SQL Editor

create table public.apps (
  id         bigint generated always as identity primary key,
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 60),
  category   text not null check (char_length(category) between 2 and 30),
  price      integer not null default 0 check (price >= 0),
  created_at timestamptz not null default now()
);

-- WAJIB: aktifkan Row Level Security
alter table public.apps enable row level security;

-- Semua orang boleh melihat
create policy "apps_select" on public.apps for select using (true);

-- Hanya user login yang boleh menambah, dan harus atas namanya sendiri
create policy "apps_insert" on public.apps for insert to authenticated
  with check (owner = auth.uid());

-- Hanya pemilik yang boleh mengubah / menghapus
create policy "apps_update" on public.apps for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "apps_delete" on public.apps for delete to authenticated
  using (owner = auth.uid());

-- Aktifkan realtime untuk tabel ini
alter publication supabase_realtime add table public.apps;
