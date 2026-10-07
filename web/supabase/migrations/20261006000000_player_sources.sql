create schema if not exists cineverse;

create table if not exists cineverse.player_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  enabled boolean not null default true,
  priority integer not null default 100 check (priority >= 0),
  supported_types text[] not null default '{movie,tv}' check (supported_types <@ array['movie','tv']::text[]),
  movie_url_template text,
  tv_url_template text,
  id_type text not null default 'either' check (id_type in ('tmdb','imdb','either')),
  secret_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_sources_at_least_one_template check (movie_url_template is not null or tv_url_template is not null)
);

alter table cineverse.player_sources enable row level security;
drop policy if exists "Anyone can read enabled player sources" on cineverse.player_sources;
drop policy if exists "Super admin can manage player sources" on cineverse.player_sources;
create policy "Anyone can read enabled player sources"
  on cineverse.player_sources for select using (enabled = true);

create policy "Super admin can manage player sources"
  on cineverse.player_sources for all
  to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@memoire.com')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@memoire.com');

comment on column cineverse.player_sources.movie_url_template is 'HTTPS URL using {id}, {tmdb_id}, or {imdb_id}.';
comment on column cineverse.player_sources.tv_url_template is 'HTTPS URL using an ID token plus {season} and {episode}.';
comment on column cineverse.player_sources.secret_reference is 'Name of a server-side secret; never store the secret value here.';
