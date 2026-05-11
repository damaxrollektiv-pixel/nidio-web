-- ============================================
-- NIDIO - Datenbankschema
-- Ausführen in: Supabase → SQL Editor → New Query
-- ============================================

-- PostGIS Extension für GPS-Koordinaten
create extension if not exists "postgis";

-- ============================================
-- TABELLE: locations
-- ============================================
create table if not exists public.locations (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  description   text,
  lat           float8 not null,
  lng           float8 not null,
  radius_m      int not null default 5,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

-- ============================================
-- TABELLE: media_items
-- ============================================
create type media_type as enum ('text', 'photo', 'audio', 'video');

create table if not exists public.media_items (
  id            uuid default gen_random_uuid() primary key,
  location_id   uuid references public.locations(id) on delete cascade not null,
  user_id       uuid references auth.users(id) on delete cascade not null,
  type          media_type not null,
  title         text,
  content       text,           -- für Text-Inhalte direkt
  file_url      text,           -- für Mediendateien (Storage URL)
  file_name     text,
  file_size     int,
  created_at    timestamptz default now() not null
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.locations enable row level security;
alter table public.media_items enable row level security;

-- Locations: User sieht und verwaltet nur seine eigenen
create policy "locations_select" on public.locations
  for select using (auth.uid() = user_id);

create policy "locations_insert" on public.locations
  for insert with check (auth.uid() = user_id);

create policy "locations_update" on public.locations
  for update using (auth.uid() = user_id);

create policy "locations_delete" on public.locations
  for delete using (auth.uid() = user_id);

-- Media Items: User sieht und verwaltet nur seine eigenen
create policy "media_select" on public.media_items
  for select using (auth.uid() = user_id);

create policy "media_insert" on public.media_items
  for insert with check (auth.uid() = user_id);

create policy "media_delete" on public.media_items
  for delete using (auth.uid() = user_id);

-- ============================================
-- STORAGE BUCKET
-- ============================================
insert into storage.buckets (id, name, public)
values ('nidio-media', 'nidio-media', false)
on conflict do nothing;

-- Storage Policy: User verwaltet nur eigene Dateien
create policy "storage_select" on storage.objects
  for select using (
    bucket_id = 'nidio-media' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'nidio-media' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_delete" on storage.objects
  for delete using (
    bucket_id = 'nidio-media' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- HILFSFUNKTION: Locations in Reichweite finden
-- (für die Mobile App später)
-- ============================================
create or replace function public.locations_nearby(
  user_lat float8,
  user_lng float8,
  max_distance_m int default 50
)
returns table (
  id uuid,
  name text,
  description text,
  lat float8,
  lng float8,
  radius_m int,
  distance_m float8
)
language sql security definer
as $$
  select
    l.id,
    l.name,
    l.description,
    l.lat,
    l.lng,
    l.radius_m,
    ST_Distance(
      ST_MakePoint(l.lng, l.lat)::geography,
      ST_MakePoint(user_lng, user_lat)::geography
    ) as distance_m
  from public.locations l
  where
    ST_DWithin(
      ST_MakePoint(l.lng, l.lat)::geography,
      ST_MakePoint(user_lng, user_lat)::geography,
      max_distance_m
    )
  order by distance_m asc;
$$;
