-- =====================================================================
-- Slime game - migration 003: save slots + evolution
-- Run after 001 and 002. Safe to run twice.
--  * max 3 characters per user (value lives in slime_config 'characters.max_per_user')
--  * magicules accrue over real time on the server, evolution spends them
-- All evolution numbers are PLACEHOLDERS stored in slime_config: tune them there.
-- =====================================================================

alter table slime_characters
  add column if not exists magicules    numeric     not null default 0,
  add column if not exists last_tick_at timestamptz not null default now();

insert into slime_config (key, value, note) values
  ('characters.max_per_user',         '3',   'Save slots per user'),
  ('evolution.base_rate_per_hour',    '20',  'Magicules per hour for a depth-0 form (PLACEHOLDER)'),
  ('evolution.rate_growth_per_depth', '1.8', 'Rate multiplier for each evolution depth (PLACEHOLDER)'),
  ('evolution.base_cost',             '100', 'Magicule cost of a depth-1 evolution (PLACEHOLDER)'),
  ('evolution.cost_growth_per_depth', '4',   'Cost multiplier for each extra depth (PLACEHOLDER)')
on conflict (key) do update set value = excluded.value, note = excluded.note;

-- ---------- helpers ----------
create or replace function slime_cfg(p_key text, p_default numeric)
returns numeric language sql stable as $$
  select coalesce((select (value #>> '{}')::numeric from slime_config where key = p_key), p_default)
$$;

create or replace function slime_rate_per_hour(p_depth int)
returns numeric language sql stable as $$
  select slime_cfg('evolution.base_rate_per_hour', 20)
         * power(slime_cfg('evolution.rate_growth_per_depth', 1.8), greatest(p_depth, 0))
$$;

create or replace function slime_evolution_cost(p_target_depth int)
returns numeric language sql stable as $$
  select slime_cfg('evolution.base_cost', 100)
         * power(slime_cfg('evolution.cost_growth_per_depth', 4), greatest(p_target_depth, 1) - 1)
$$;

-- ---------- create character (replaces the 001 version): adds the save-slot limit ----------
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
  v_max     int;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  -- serialise per user so two quick requests cannot exceed the limit
  perform pg_advisory_xact_lock(hashtext(v_uid::text));
  v_max := slime_cfg('characters.max_per_user', 3)::int;
  if (select count(*) from slime_characters where user_id = v_uid) >= v_max then
    raise exception 'all % save slots are used: delete a character first', v_max;
  end if;

  if p_species_id is null then
    v_mode := 'random';
    select * into v_species
    from slime_species
    where start_weight > 0
    order by -ln(1.0 - random()) / start_weight
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
                                biome_id, has_body, magicules, last_tick_at)
  values (v_uid, p_name, v_mode, v_species.id, v_species.id,
          v_species.primary_biome, v_species.spirit_line is null, 0, now())
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

-- ---------- tick: bring magicules up to date (server clock) ----------
create or replace function slime_tick(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_c     slime_characters%rowtype;
  v_depth int;
  v_rate  numeric;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_c from slime_characters where id = p_character_id and user_id = v_uid for update;
  if not found then raise exception 'character not found'; end if;

  select depth into v_depth from slime_species where id = v_c.species_id;
  v_rate := slime_rate_per_hour(v_depth);

  update slime_characters
     set magicules    = magicules + v_rate * extract(epoch from (now() - last_tick_at)) / 3600.0,
         last_tick_at = now()
   where id = v_c.id
   returning * into v_c;

  return jsonb_build_object('magicules', v_c.magicules, 'rate_per_hour', v_rate,
                            'species_id', v_c.species_id, 'synced_at', v_c.last_tick_at);
end;
$$;

-- ---------- options: forms this character can evolve into ----------
create or replace function slime_evolution_options(p_character_id uuid)
returns table (
  id text, name_en text, name_jp text, group_name text, depth int,
  primary_biome text, evolution_condition text, evolution_condition_source text,
  cost numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name_en, s.name_jp, s.group_name, s.depth, s.primary_biome,
         s.evolution_condition, s.evolution_condition_source,
         slime_evolution_cost(s.depth)
    from slime_characters c
    join slime_species s on s.parent_id = c.species_id
   where c.id = p_character_id and c.user_id = auth.uid()
   order by s.name_en
$$;

-- ---------- evolve ----------
create or replace function slime_evolve_character(p_character_id uuid, p_target_species_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_c     slime_characters%rowtype;
  v_t     slime_species%rowtype;
  v_depth int;
  v_rate  numeric;
  v_cost  numeric;
  v_from  text;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_c from slime_characters where id = p_character_id and user_id = v_uid for update;
  if not found then raise exception 'character not found'; end if;
  v_from := v_c.species_id;

  -- bring magicules up to date first
  select depth into v_depth from slime_species where id = v_c.species_id;
  v_rate := slime_rate_per_hour(v_depth);
  v_c.magicules := v_c.magicules + v_rate * extract(epoch from (now() - v_c.last_tick_at)) / 3600.0;

  select * into v_t from slime_species where id = p_target_species_id and parent_id = v_c.species_id;
  if not found then
    raise exception 'that form is not an evolution of the current species';
  end if;

  v_cost := slime_evolution_cost(v_t.depth);
  if v_c.magicules < v_cost then
    raise exception 'not enough magicules: need %, have %', round(v_cost, 1), round(v_c.magicules, 1);
  end if;

  update slime_characters
     set species_id   = v_t.id,
         magicules    = v_c.magicules - v_cost,
         last_tick_at = now(),
         updated_at   = now()
   where id = v_c.id
   returning * into v_c;

  insert into slime_character_events (character_id, kind, detail)
  values (v_c.id, 'evolved', jsonb_build_object('from', v_from, 'to', v_t.id, 'cost', v_cost));

  return jsonb_build_object('magicules', v_c.magicules, 'rate_per_hour', slime_rate_per_hour(v_t.depth),
                            'species_id', v_c.species_id, 'synced_at', v_c.last_tick_at);
end;
$$;

revoke all on function slime_tick(uuid), slime_evolution_options(uuid), slime_evolve_character(uuid, text)
  from public, anon;
grant execute on function slime_tick(uuid), slime_evolution_options(uuid), slime_evolve_character(uuid, text)
  to authenticated;
-- Deleting a save: clients may delete their own rows in slime_characters (policy "own characters");
-- skills and events are removed by ON DELETE CASCADE.
