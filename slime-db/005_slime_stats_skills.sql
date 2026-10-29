-- =====================================================================
-- Slime game - migration 005: levels, stats, skill effects, species skills
-- Run after 001-004, then run 006_slime_stats_seed.sql. Safe to run twice.
--  * level / exp / 5 stats (STR VIT AGI MAG WIL); win chance in hunts comes from POWER
--  * every skill has game effects (table slime_skill_effects, seeded by 006)
--  * species grant their innate skills at birth and when you evolve into them
-- All numbers are PLACEHOLDERS stored in slime_config or the seeded tables.
-- =====================================================================

alter table slime_characters
  add column if not exists level       int     not null default 1,
  add column if not exists exp         numeric not null default 0,
  add column if not exists stat_points int     not null default 0,
  add column if not exists alloc_str   int     not null default 0,
  add column if not exists alloc_vit   int     not null default 0,
  add column if not exists alloc_agi   int     not null default 0,
  add column if not exists alloc_mag   int     not null default 0,
  add column if not exists alloc_wil   int     not null default 0;

alter table slime_skills add column if not exists game_effect text;

create table if not exists slime_species_stats (
  species_id text primary key references slime_species(id) on delete cascade,
  str int not null, vit int not null, agi int not null, mag int not null, wil int not null
);

create table if not exists slime_species_skills (
  species_id text not null references slime_species(id) on delete cascade,
  skill_id   text not null references slime_skills(id)  on delete cascade,
  evidence   text,
  primary key (species_id, skill_id)
);

create table if not exists slime_skill_effects (
  id       bigserial primary key,
  skill_id text not null references slime_skills(id) on delete cascade,
  kind     text not null check (kind in ('stat_flat','win_pct','reward_pct','xp_pct','income_pct','stamina_regen_pct')),
  stat     text check (stat in ('str','vit','agi','mag','wil')),
  value    numeric not null
);
create index if not exists slime_skill_effects_skill_idx on slime_skill_effects(skill_id);

do $$
declare t text;
begin
  foreach t in array array['slime_species_stats','slime_species_skills','slime_skill_effects']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "read %1$s" on %1$I', t);
    execute format('create policy "read %1$s" on %1$I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

insert into slime_config (key, value, note) values
  ('level.exp_base',            '40',  'XP needed for level 1 -> 2 (PLACEHOLDER)'),
  ('level.exp_exponent',        '1.5', 'XP needed = base * level^exponent (PLACEHOLDER)'),
  ('level.points_per_level',    '2',   'Free stat points per level (PLACEHOLDER)'),
  ('level.auto_stat_per_level', '1',   'Automatic +N to every stat per level above 1 (PLACEHOLDER)'),
  ('level.max',                 '100', 'Level cap'),
  ('combat.power_exponent',     '2.5', 'Win chance = P^k / (P^k + Q^k); higher k = power matters more (PLACEHOLDER)'),
  ('combat.min_win',            '0.05','Lowest win chance'),
  ('combat.max_win',            '0.95','Highest win chance'),
  ('combat.weights',  '{"str":1.0,"mag":1.0,"vit":0.8,"agi":0.7,"wil":0.5}', 'Weight of each stat in POWER (PLACEHOLDER)'),
  ('hunt.xp_per_prey_power',    '0.6', 'XP per point of prey power when you win (PLACEHOLDER)'),
  ('hunt.xp_loss_factor',       '0.25','Share of the XP you still get when you lose (PLACEHOLDER)')
on conflict (key) do update set value = excluded.value, note = excluded.note;

-- ---------- helpers (not callable by clients) ----------
create or replace function slime_skill_bonus(p_character_id uuid, p_kind text, p_stat text default null)
returns numeric language sql stable as $$
  select coalesce(sum(e.value), 0)
    from slime_character_skills cs
    join slime_skill_effects e on e.skill_id = cs.skill_id
   where cs.character_id = p_character_id and e.kind = p_kind and (p_stat is null or e.stat = p_stat)
$$;

create or replace function slime_exp_needed(p_level int)
returns numeric language sql stable as $$
  select round(slime_cfg('level.exp_base', 40) * power(greatest(p_level, 1), slime_cfg('level.exp_exponent', 1.5)))
$$;

create or replace function slime_weight(p_stat text)
returns numeric language sql stable as $$
  select coalesce((select (value ->> p_stat)::numeric from slime_config where key = 'combat.weights'), 1)
$$;

create or replace function slime_species_power(p_species_id text)
returns numeric language sql stable as $$
  select coalesce((select slime_weight('str') * str + slime_weight('vit') * vit + slime_weight('agi') * agi
                          + slime_weight('mag') * mag + slime_weight('wil') * wil
                     from slime_species_stats where species_id = p_species_id), 1)
$$;

-- full stat sheet of a character row
create or replace function slime_calc_stats(p_c slime_characters)
returns jsonb
language plpgsql
stable
as $$
declare
  b slime_species_stats%rowtype;
  v_auto int := (p_c.level - 1) * slime_cfg('level.auto_stat_per_level', 1)::int;
  s text;
  v_base jsonb := '{}'; v_alloc jsonb; v_skill jsonb := '{}'; v_total jsonb := '{}';
  v_t numeric; v_power numeric := 0;
begin
  select * into b from slime_species_stats where species_id = p_c.species_id;
  v_alloc := jsonb_build_object('str', p_c.alloc_str, 'vit', p_c.alloc_vit, 'agi', p_c.alloc_agi,
                                'mag', p_c.alloc_mag, 'wil', p_c.alloc_wil);
  foreach s in array array['str','vit','agi','mag','wil'] loop
    v_base  := v_base  || jsonb_build_object(s, coalesce((to_jsonb(b) ->> s)::int, 5));
    v_skill := v_skill || jsonb_build_object(s, slime_skill_bonus(p_c.id, 'stat_flat', s));
    v_t := (v_base ->> s)::numeric + (v_alloc ->> s)::numeric + v_auto + (v_skill ->> s)::numeric;
    v_total := v_total || jsonb_build_object(s, v_t);
    v_power := v_power + v_t * slime_weight(s);
  end loop;
  return jsonb_build_object(
    'level', p_c.level, 'exp', p_c.exp, 'exp_needed', slime_exp_needed(p_c.level), 'stat_points', p_c.stat_points,
    'auto', v_auto, 'base', v_base, 'alloc', v_alloc, 'skill', v_skill, 'total', v_total,
    'power', round(v_power, 1),
    'bonus', jsonb_build_object(
      'win_pct',           slime_skill_bonus(p_c.id, 'win_pct'),
      'reward_pct',        slime_skill_bonus(p_c.id, 'reward_pct'),
      'xp_pct',            slime_skill_bonus(p_c.id, 'xp_pct'),
      'income_pct',        slime_skill_bonus(p_c.id, 'income_pct'),
      'stamina_regen_pct', slime_skill_bonus(p_c.id, 'stamina_regen_pct')));
end;
$$;

-- give a character the innate skills of a species; returns the ids that were new
create or replace function slime_grant_species_skills(p_character_id uuid, p_species_id text, p_source text)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare v_ids text[];
begin
  with ins as (
    insert into slime_character_skills (character_id, skill_id, source)
    select p_character_id, ss.skill_id, p_source
      from slime_species_skills ss
     where ss.species_id = p_species_id
    on conflict do nothing
    returning skill_id
  )
  select coalesce(array_agg(skill_id), '{}') into v_ids from ins;
  return v_ids;
end;
$$;

revoke all on function slime_skill_bonus(uuid, text, text), slime_exp_needed(int), slime_weight(text),
  slime_species_power(text), slime_calc_stats(slime_characters), slime_grant_species_skills(uuid, text, text)
  from public, anon, authenticated;

-- ---------- stat sheet for the UI ----------
create or replace function slime_char_stats(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_c slime_characters%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_c from slime_characters where id = p_character_id and user_id = auth.uid();
  if not found then raise exception 'character not found'; end if;
  return slime_calc_stats(v_c);
end;
$$;

create or replace function slime_allocate_stat(p_character_id uuid, p_stat text, p_points int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_c slime_characters%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_stat not in ('str','vit','agi','mag','wil') then raise exception 'unknown stat %', p_stat; end if;
  if p_points is null or p_points < 1 then raise exception 'points must be at least 1'; end if;
  select * into v_c from slime_characters where id = p_character_id and user_id = auth.uid() for update;
  if not found then raise exception 'character not found'; end if;
  if v_c.stat_points < p_points then
    raise exception 'not enough stat points (have %, need %)', v_c.stat_points, p_points;
  end if;
  execute format('update slime_characters set alloc_%s = alloc_%s + $1, stat_points = stat_points - $1, updated_at = now() where id = $2', p_stat, p_stat)
    using p_points, v_c.id;
  select * into v_c from slime_characters where id = v_c.id;
  return slime_calc_stats(v_c);
end;
$$;

-- ---------- create character: now also grants the species' innate skills ----------
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
  v_innate  text[];
  v_max     int;
begin
  if v_uid is null then raise exception 'not signed in'; end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text));
  v_max := slime_cfg('characters.max_per_user', 3)::int;
  if (select count(*) from slime_characters where user_id = v_uid) >= v_max then
    raise exception 'all % save slots are used: delete a character first', v_max;
  end if;

  if p_species_id is null then
    v_mode := 'random';
    select * into v_species from slime_species
     where start_weight > 0
     order by -ln(1.0 - random()) / start_weight
     limit 1;
  else
    v_mode := 'chosen';
    select * into v_species from slime_species where id = p_species_id and start_selectable;
    if not found then raise exception 'species % cannot be chosen at start', p_species_id; end if;
  end if;
  if v_species.id is null then raise exception 'no start species available'; end if;

  select (value #>> '{}')::numeric into v_chance
    from slime_config where key = 'start.second_unique_chance.' || v_mode;
  v_chance := coalesce(v_chance, 0);

  insert into slime_characters (user_id, name, start_mode, start_species_id, species_id,
                                biome_id, has_body, magicules, last_tick_at, stamina, stamina_at)
  values (v_uid, p_name, v_mode, v_species.id, v_species.id,
          v_species.primary_biome, v_species.spirit_line is null, 0, now(),
          slime_cfg('hunt.stamina_max', 10), now())
  returning id into v_id;

  select id into v_skill1 from slime_skills where in_unique_pool order by random() limit 1;
  if v_skill1 is null then raise exception 'unique skill pool is empty'; end if;
  insert into slime_character_skills (character_id, skill_id, source) values (v_id, v_skill1, 'start');

  if random() < v_chance then
    select id into v_skill2 from slime_skills where in_unique_pool and id <> v_skill1 order by random() limit 1;
    if v_skill2 is not null then
      insert into slime_character_skills (character_id, skill_id, source) values (v_id, v_skill2, 'start');
    end if;
  end if;

  v_innate := slime_grant_species_skills(v_id, v_species.id, 'species');

  insert into slime_character_events (character_id, kind, detail)
  values (v_id, 'created', jsonb_build_object('mode', v_mode, 'species', v_species.id,
          'skills', to_jsonb(array_remove(array[v_skill1, v_skill2], null)), 'innate', to_jsonb(v_innate)));
  return v_id;
end;
$$;

-- ---------- tick: income now includes skill bonuses ----------
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
  v_rate := slime_rate_per_hour(v_depth) * (1 + slime_skill_bonus(v_c.id, 'income_pct') / 100.0);

  update slime_characters
     set magicules    = magicules + v_rate * extract(epoch from (now() - last_tick_at)) / 3600.0,
         last_tick_at = now()
   where id = v_c.id
   returning * into v_c;

  return jsonb_build_object('magicules', v_c.magicules, 'rate_per_hour', v_rate,
                            'species_id', v_c.species_id, 'synced_at', v_c.last_tick_at);
end;
$$;

-- ---------- evolve: grants the new species' skills ----------
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
  v_new   text[];
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_c from slime_characters where id = p_character_id and user_id = v_uid for update;
  if not found then raise exception 'character not found'; end if;
  v_from := v_c.species_id;

  select depth into v_depth from slime_species where id = v_c.species_id;
  v_rate := slime_rate_per_hour(v_depth) * (1 + slime_skill_bonus(v_c.id, 'income_pct') / 100.0);
  v_c.magicules := v_c.magicules + v_rate * extract(epoch from (now() - v_c.last_tick_at)) / 3600.0;

  select * into v_t from slime_species where id = p_target_species_id and parent_id = v_c.species_id;
  if not found then raise exception 'that form is not an evolution of the current species'; end if;

  v_cost := slime_evolution_cost(v_t.depth);
  if v_c.magicules < v_cost then
    raise exception 'not enough magicules: need %, have %', round(v_cost, 1), round(v_c.magicules, 1);
  end if;

  update slime_characters
     set species_id = v_t.id, magicules = v_c.magicules - v_cost, last_tick_at = now(), updated_at = now()
   where id = v_c.id
   returning * into v_c;

  v_new := slime_grant_species_skills(v_c.id, v_t.id, 'species');

  insert into slime_character_events (character_id, kind, detail)
  values (v_c.id, 'evolved', jsonb_build_object('from', v_from, 'to', v_t.id, 'cost', v_cost, 'new_skills', to_jsonb(v_new)));

  return jsonb_build_object(
    'magicules', v_c.magicules,
    'rate_per_hour', slime_rate_per_hour(v_t.depth) * (1 + slime_skill_bonus(v_c.id, 'income_pct') / 100.0),
    'species_id', v_c.species_id, 'synced_at', v_c.last_tick_at,
    'new_skills', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'game_effect', k.game_effect))
                              from slime_skills k where k.id = any (v_new)), '[]'::jsonb));
end;
$$;

-- ---------- hunt status ----------
create or replace function slime_hunt_status(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_c    slime_characters%rowtype;
  v_max  numeric := slime_cfg('hunt.stamina_max', 10);
  v_reg  numeric;
  v_stam numeric;
  v_dev  jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_c from slime_characters where id = p_character_id and user_id = auth.uid();
  if not found then raise exception 'character not found'; end if;

  v_reg  := slime_cfg('hunt.stamina_regen_per_hour', 6) * (1 + slime_skill_bonus(v_c.id, 'stamina_regen_pct') / 100.0);
  v_stam := least(v_max, v_c.stamina + v_reg * extract(epoch from (now() - v_c.stamina_at)) / 3600.0);

  select coalesce(jsonb_agg(jsonb_build_object('skill', k.name, 'chance', d.gain_chance) order by d.gain_chance desc), '[]'::jsonb)
    into v_dev
    from slime_character_skills cs
    join slime_devour_skills d on d.skill_id = cs.skill_id
    join slime_skills k on k.id = cs.skill_id
   where cs.character_id = v_c.id;

  return jsonb_build_object('stamina', v_stam, 'stamina_max', v_max, 'regen_per_hour', v_reg,
                            'cost', slime_cfg('hunt.stamina_cost', 1), 'biome_id', v_c.biome_id,
                            'devour', v_dev, 'power', (slime_calc_stats(v_c) ->> 'power')::numeric,
                            'level', v_c.level, 'synced_at', now());
end;
$$;

-- ---------- hunt: win chance now comes from POWER (stats + skills) ----------
create or replace function slime_hunt(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_c        slime_characters%rowtype;
  v_stats    jsonb;
  v_depth    int;
  v_max      numeric := slime_cfg('hunt.stamina_max', 10);
  v_reg      numeric;
  v_cost     numeric := slime_cfg('hunt.stamina_cost', 1);
  v_stam     numeric;
  v_passive  numeric;
  v_prey     slime_species%rowtype;
  v_ppow     numeric;
  v_qpow     numeric;
  v_k        numeric := slime_cfg('combat.power_exponent', 2.5);
  v_pwin     numeric;
  v_won      boolean;
  v_reward   numeric := 0;
  v_xp       numeric;
  v_level    int;
  v_exp      numeric;
  v_points   int;
  v_levels   int := 0;
  v_chance   numeric;
  v_devoured boolean := false;
  v_skill    slime_skills%rowtype;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_c from slime_characters where id = p_character_id and user_id = v_uid for update;
  if not found then raise exception 'character not found'; end if;

  v_reg  := slime_cfg('hunt.stamina_regen_per_hour', 6) * (1 + slime_skill_bonus(v_c.id, 'stamina_regen_pct') / 100.0);
  v_stam := least(v_max, v_c.stamina + v_reg * extract(epoch from (now() - v_c.stamina_at)) / 3600.0);
  if v_stam < v_cost then
    raise exception 'not enough stamina (have %, need %)', round(v_stam, 1), v_cost;
  end if;

  select depth into v_depth from slime_species where id = v_c.species_id;
  v_stats := slime_calc_stats(v_c);
  v_ppow  := (v_stats ->> 'power')::numeric;

  select * into v_prey
    from slime_species s
   where s.primary_biome = v_c.biome_id and s.media = 'Main'
     and s.group_name <> 'Humanity' and s.group_name not like 'Spirit%'
     and s.depth <= v_depth + 2
   order by -ln(1.0 - random()) / case when s.depth <= v_depth then 1.0 else 0.35 end
   limit 1;
  if v_prey.id is null then raise exception 'nothing to hunt in this biome yet'; end if;

  v_qpow := slime_species_power(v_prey.id);
  v_pwin := power(v_ppow / greatest(v_qpow, 1), v_k) / (power(v_ppow / greatest(v_qpow, 1), v_k) + 1)
            + (v_stats -> 'bonus' ->> 'win_pct')::numeric / 100.0;
  v_pwin := least(slime_cfg('combat.max_win', 0.95), greatest(slime_cfg('combat.min_win', 0.05), v_pwin));
  v_won  := random() < v_pwin;

  v_xp := v_qpow * slime_cfg('hunt.xp_per_prey_power', 0.6) * (1 + (v_stats -> 'bonus' ->> 'xp_pct')::numeric / 100.0);

  if v_won then
    v_reward := slime_cfg('hunt.base_reward', 10) * power(slime_cfg('hunt.reward_growth_per_depth', 2.2), v_prey.depth)
                * (1 + (v_stats -> 'bonus' ->> 'reward_pct')::numeric / 100.0);

    select max(d.gain_chance) into v_chance
      from slime_character_skills cs join slime_devour_skills d on d.skill_id = cs.skill_id
     where cs.character_id = v_c.id;

    if v_chance is not null then
      v_devoured := true;
      v_reward := v_reward * slime_cfg('hunt.devour_bonus', 1.5);
      if random() < v_chance then
        select k.* into v_skill
          from slime_species_skills ss join slime_skills k on k.id = ss.skill_id
         where ss.species_id = v_prey.id and k.tier_group in ('common', 'extra')
           and not exists (select 1 from slime_character_skills cs where cs.character_id = v_c.id and cs.skill_id = ss.skill_id)
         order by random() limit 1;
        if v_skill.id is not null then
          insert into slime_character_skills (character_id, skill_id, source)
          values (v_c.id, v_skill.id, 'devour:' || v_prey.id);
        end if;
      end if;
    end if;
  else
    v_xp := v_xp * slime_cfg('hunt.xp_loss_factor', 0.25);
  end if;
  v_reward := round(v_reward, 1);
  v_xp := round(v_xp, 1);

  -- level ups
  v_level := v_c.level; v_exp := v_c.exp + v_xp; v_points := v_c.stat_points;
  while v_level < slime_cfg('level.max', 100)::int and v_exp >= slime_exp_needed(v_level) loop
    v_exp := v_exp - slime_exp_needed(v_level);
    v_level := v_level + 1;
    v_points := v_points + slime_cfg('level.points_per_level', 2)::int;
    v_levels := v_levels + 1;
  end loop;

  v_passive := slime_rate_per_hour(v_depth) * (1 + (v_stats -> 'bonus' ->> 'income_pct')::numeric / 100.0)
               * extract(epoch from (now() - v_c.last_tick_at)) / 3600.0;

  update slime_characters
     set magicules = magicules + v_passive + v_reward, last_tick_at = now(),
         stamina = v_stam - v_cost, stamina_at = now(),
         level = v_level, exp = v_exp, stat_points = v_points, updated_at = now()
   where id = v_c.id
   returning * into v_c;

  insert into slime_character_events (character_id, kind, detail)
  values (v_c.id, 'hunt', jsonb_build_object('prey', v_prey.id, 'won', v_won, 'reward', v_reward, 'xp', v_xp,
                                             'devoured', v_devoured, 'skill', v_skill.id, 'levels', v_levels));

  return jsonb_build_object(
    'won', v_won, 'win_chance', round(v_pwin, 3), 'reward', v_reward, 'devoured', v_devoured,
    'xp', v_xp, 'levels_gained', v_levels, 'level', v_c.level, 'exp', v_c.exp,
    'exp_needed', slime_exp_needed(v_c.level), 'stat_points', v_c.stat_points,
    'player_power', v_ppow, 'prey_power', v_qpow,
    'prey', jsonb_build_object('id', v_prey.id, 'name_en', v_prey.name_en, 'name_jp', v_prey.name_jp, 'depth', v_prey.depth),
    'skill', case when v_skill.id is null then null
                  else jsonb_build_object('id', v_skill.id, 'name', v_skill.name, 'effect', v_skill.effect) end,
    'stamina', v_c.stamina, 'magicules', v_c.magicules, 'synced_at', v_c.stamina_at);
end;
$$;

revoke all on function slime_char_stats(uuid), slime_allocate_stat(uuid, text, int) from public, anon;
grant execute on function slime_char_stats(uuid), slime_allocate_stat(uuid, text, int) to authenticated;
