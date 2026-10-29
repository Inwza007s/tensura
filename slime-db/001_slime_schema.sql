-- =====================================================================
-- Slime game (personal project) - schema
-- Shared Supabase project: every table uses the slime_ prefix.
-- Run this file first, then 002_slime_seed.sql.
-- Reference tables (species, skills, biomes, rules) are read-only for clients.
-- Player tables are protected by RLS: a user sees only their own characters.
-- =====================================================================

-- ---------- reference: biomes ----------
create table if not exists slime_biomes (
  id          text primary key,            -- e.g. forest, cave_underground
  name        text not null,
  description text not null default ''
);

-- ---------- reference: species (one row per wiki species entry) ----------
create table if not exists slime_species (
  id                text primary key,       -- SP001 ...
  name_en           text not null,
  name_jp           text,
  reading           text,
  gloss             text,
  group_name        text not null,          -- e.g. 'Demi-human / Sprite'
  media             text not null default 'Main',   -- Main | ISEKAI Memories | ISEKAI Chronicles
  parent_id         text references slime_species(id) deferrable initially deferred,
  depth             int  not null default 0,
  root_id           text,                   -- first species of its line (filled by seed)
  start_status      text not null check (start_status in
                      ('Yes','Yes - review','Evolved-only','Spin-off (optional)','No')),
  start_weight      numeric not null default 0 check (start_weight >= 0),   -- random-roll weight
  start_selectable  boolean not null default false,                          -- player may pick it
  spirit_line       text,                   -- Angel | Daemon | Elemental | Pixie | Dryad (needs a body)
  primary_biome     text references slime_biomes(id),
  secondary_biome   text references slime_biomes(id),
  biome_confidence  text check (biome_confidence in ('High','Medium','Low')),
  biome_basis       text,
  biome_note        text,
  evolution_condition        text,          -- known condition to reach this form from its parent
  evolution_condition_source text,
  source            text
);
create index if not exists slime_species_parent_idx on slime_species(parent_id);
create index if not exists slime_species_start_idx  on slime_species(start_status);

-- links between lines that are not parent->child in the tree (hobgoblin -> ogre, elf -> high elf ...)
create table if not exists slime_species_cross_links (
  id          bigserial primary key,
  from_label  text not null,
  to_label    text not null,
  how         text,
  confidence  text,
  source      text
);

-- ---------- reference: skills ----------
create table if not exists slime_skills (
  id              text primary key,         -- slug of the wiki title
  name            text not null,
  wiki_title      text not null unique,
  tier_group      text not null check (tier_group in ('common','extra','unique','ultimate','other')),
  tier_wiki       text,                     -- raw infobox type
  wiki_categories text[] not null default '{}',
  scope           text,                     -- 'Main story' | 'Game only'
  noncanon_page   boolean not null default false,
  aliases         text[] not null default '{}',
  effect          text,                     -- short summary in my own words
  wiki_url        text,
  source          text,
  in_unique_pool  boolean not null default false   -- can be rolled as a start Unique skill
);
create index if not exists slime_skills_tier_idx on slime_skills(tier_group);

create table if not exists slime_skill_links (
  id               bigserial primary key,
  skill_id         text not null references slime_skills(id) on delete cascade,
  relation         text not null check (relation in ('evolves_from','evolves_to','sub_skill')),
  related_name     text not null,
  related_skill_id text references slime_skills(id) on delete set null   -- null when the name has no skill page
);
create index if not exists slime_skill_links_skill_idx on slime_skill_links(skill_id);

create table if not exists slime_skill_users (
  skill_id text not null references slime_skills(id) on delete cascade,
  person   text not null,
  kind     text not null check (kind in ('current','former')),
  primary key (skill_id, person, kind)
);

-- ---------- reference: game rules ----------
create table if not exists slime_config (
  key   text primary key,
  value jsonb not null,
  note  text
);

create table if not exists slime_spirit_lines (
  line                  text primary key,
  home_area             text,
  steps_to_max          int,
  self_create_unlock_at text,               -- stage at which the line may build its own body
  note                  text
);

create table if not exists slime_spirit_rules (
  id           bigserial primary key,
  line         text not null,
  topic        text,
  home_area    text,
  without_body text,
  with_body    text,
  difficulty   text,
  source       text
);

create table if not exists slime_spirit_fuel (
  id          bigserial primary key,
  stage       text not null,
  fuel        text,
  days_min    numeric,
  days_max    numeric,
  unlimited   boolean not null default false,
  mode        text,
  fails_when  text,
  source      text
);

create table if not exists slime_body_methods (
  id          int primary key,
  method      text not null,
  how         text,
  stability   text,
  examples    text,
  limits      text,
  source      text
);

-- ---------- player data ----------
create table if not exists slime_characters (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 40),
  start_mode       text not null check (start_mode in ('random','chosen')),
  start_species_id text not null references slime_species(id),
  species_id       text not null references slime_species(id),      -- current form
  biome_id         text references slime_biomes(id),
  has_body         boolean not null default true,                   -- false for spirit lines at start
  body_method      text,
  fuel_days        numeric,                                         -- remaining days outside home area
  fuel_updated_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists slime_characters_user_idx on slime_characters(user_id);

create table if not exists slime_character_skills (
  character_id uuid not null references slime_characters(id) on delete cascade,
  skill_id     text not null references slime_skills(id),
  source       text not null default 'start',
  acquired_at  timestamptz not null default now(),
  primary key (character_id, skill_id)
);

create table if not exists slime_character_events (
  id           bigserial primary key,
  character_id uuid not null references slime_characters(id) on delete cascade,
  kind         text not null,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists slime_character_events_idx on slime_character_events(character_id, created_at);

-- ---------- row level security ----------
do $$
declare t text;
begin
  foreach t in array array['slime_biomes','slime_species','slime_species_cross_links','slime_skills',
                           'slime_skill_links','slime_skill_users','slime_config','slime_spirit_lines',
                           'slime_spirit_rules','slime_spirit_fuel','slime_body_methods']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "read %1$s" on %1$I', t);
    execute format('create policy "read %1$s" on %1$I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

alter table slime_characters       enable row level security;
alter table slime_character_skills enable row level security;
alter table slime_character_events enable row level security;

drop policy if exists "own characters" on slime_characters;
create policy "own characters" on slime_characters
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own character skills" on slime_character_skills;
create policy "own character skills" on slime_character_skills
  for select to authenticated
  using (exists (select 1 from slime_characters c
                 where c.id = character_id and c.user_id = (select auth.uid())));

drop policy if exists "own character events" on slime_character_events;
create policy "own character events" on slime_character_events
  for select to authenticated
  using (exists (select 1 from slime_characters c
                 where c.id = character_id and c.user_id = (select auth.uid())));
-- Skills and events are written only by the server-side functions below (no insert policy for clients).

-- ---------- game logic ----------
-- Create a character. p_species_id = null -> random weighted species; otherwise the player picks
-- a start species (must have start_selectable = true).
-- Unique skills: always 1; a 2nd one with the chance stored in slime_config
--   start.second_unique_chance.random (random species) or .chosen (player-chosen species).
create or replace function slime_create_character(p_name text, p_species_id text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_mode    text;
  v_species slime_species%rowtype;
  v_chance  numeric;
  v_id      uuid;
  v_skill1  text;
  v_skill2  text;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  if p_species_id is null then
    v_mode := 'random';
    select * into v_species
    from slime_species
    where start_weight > 0
    order by -ln(1.0 - random()) / start_weight      -- weighted sampling (exponential race)
    limit 1;
  else
    v_mode := 'chosen';
    select * into v_species from slime_species where id = p_species_id and start_selectable;
    if not found then
      raise exception 'species % cannot be chosen at start', p_species_id;
    end if;
  end if;

  if v_species.id is null then
    raise exception 'no start species available';
  end if;

  select (value #>> '{}')::numeric into v_chance
  from slime_config where key = 'start.second_unique_chance.' || v_mode;
  v_chance := coalesce(v_chance, 0);

  insert into slime_characters (user_id, name, start_mode, start_species_id, species_id,
                                biome_id, has_body)
  values (v_uid, p_name, v_mode, v_species.id, v_species.id,
          v_species.primary_biome, v_species.spirit_line is null)
  returning id into v_id;

  select id into v_skill1 from slime_skills where in_unique_pool order by random() limit 1;
  if v_skill1 is null then
    raise exception 'unique skill pool is empty';
  end if;
  insert into slime_character_skills (character_id, skill_id, source) values (v_id, v_skill1, 'start');

  if random() < v_chance then
    select id into v_skill2 from slime_skills
    where in_unique_pool and id <> v_skill1 order by random() limit 1;
    if v_skill2 is not null then
      insert into slime_character_skills (character_id, skill_id, source) values (v_id, v_skill2, 'start');
    end if;
  end if;

  insert into slime_character_events (character_id, kind, detail)
  values (v_id, 'created', jsonb_build_object('mode', v_mode, 'species', v_species.id,
                                              'skills', to_jsonb(array_remove(array[v_skill1, v_skill2], null))));
  return v_id;
end;
$$;

revoke all on function slime_create_character(text, text) from public, anon;
grant execute on function slime_create_character(text, text) to authenticated;
