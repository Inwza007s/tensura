-- =====================================================================
-- Slime game - migration 004: hunting
-- Run after 001-003. Safe to run twice.
--  * every character can HUNT in its biome for magicules (costs stamina, which regenerates)
--  * only characters that own a devour-type skill (Predator, Gluttony, ...) can devour prey for skills
--  * prey -> skill links come from the species wiki pages (page mentions: probable, not proven)
-- All numbers are PLACEHOLDERS stored in slime_config.
-- =====================================================================

alter table slime_characters
  add column if not exists stamina    numeric     not null default 10,
  add column if not exists stamina_at timestamptz not null default now();

-- skills a prey can teach when devoured (common / extra tier only)
create table if not exists slime_prey_skills (
  species_id text not null references slime_species(id) on delete cascade,
  skill_id   text not null references slime_skills(id)  on delete cascade,
  evidence   text,
  primary key (species_id, skill_id)
);

-- skills that allow devouring, and how often a devour teaches something
create table if not exists slime_devour_skills (
  skill_id    text primary key references slime_skills(id) on delete cascade,
  gain_chance numeric not null check (gain_chance between 0 and 1),
  note        text
);

do $$
declare t text;
begin
  foreach t in array array['slime_prey_skills','slime_devour_skills']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "read %1$s" on %1$I', t);
    execute format('create policy "read %1$s" on %1$I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

insert into slime_config (key, value, note) values
  ('hunt.stamina_max',            '10',  'Maximum stamina (PLACEHOLDER)'),
  ('hunt.stamina_regen_per_hour', '6',   'Stamina regained per hour, i.e. 1 per 10 minutes (PLACEHOLDER)'),
  ('hunt.stamina_cost',           '1',   'Stamina per hunt (PLACEHOLDER)'),
  ('hunt.base_win_chance',        '0.55','Win chance against prey of the same depth (PLACEHOLDER)'),
  ('hunt.win_per_depth',          '0.15','Win chance change per depth of difference, clamped to 5%-95% (PLACEHOLDER)'),
  ('hunt.base_reward',            '10',  'Magicules for beating depth-0 prey (PLACEHOLDER)'),
  ('hunt.reward_growth_per_depth','2.2', 'Reward multiplier per prey depth (PLACEHOLDER)'),
  ('hunt.devour_bonus',           '1.5', 'Reward multiplier when the character can devour (PLACEHOLDER)')
on conflict (key) do update set value = excluded.value, note = excluded.note;

-- ---------- seed: devour skills (editable) ----------
insert into slime_devour_skills (skill_id, gain_chance, note)
select k.id, v.chance, v.note
from (values
  ('Predator',    0.50, 'Consume targets to gain skills and resistances'),
  ('Gluttony',    0.60, 'Evolved Predator'),
  ('Beelzebuth',  0.70, 'Ultimate form of Gluttony'),
  ('Azathoth',    0.70, 'Merged Raphael + Beelzebuth'),
  ('Scavenger',   0.35, 'Gains the properties of prey eaten'),
  ('Gourmand',    0.25, 'Strips a weakened target of its energy')
) as v(title, chance, note)
join slime_skills k on k.wiki_title = v.title
on conflict (skill_id) do update set gain_chance = excluded.gain_chance, note = excluded.note;

-- ---------- seed: what each prey can teach (from species wiki pages that mention the skill) ----------
insert into slime_prey_skills (species_id, skill_id, evidence)
select s.id, k.id, 'Mentioned on the species wiki page (verify)'
from (values
  ('Armorsaurus','Body Armor'),
  ('Black spider','Steel Thread'), ('Black spider','Sticky Thread'),
  ('Blade tiger','Voice Cannon'),
  ('Evil centipede','Paralyzing Breath'),
  ('Evil dragon beast','Mana Perception'), ('Evil dragon beast','Ultraspeed Regeneration'),
  ('Fascinator elf','Body Double'),
  ('Giant bat','Ultra Sound Waves'),
  ('Gyuuki','Self-Regeneration'),
  ('Harpy','Mana Jamming'),
  ('Lizardman','Scale Armor'),
  ('Megalodon','Mana Jamming'),
  ('Rabbitfolk','Danger Detection'),
  ('Shadow','Shadow Motion'), ('Shadow','Thought Communication'),
  ('Star wolf','Coercion'), ('Star wolf','Fusion'), ('Star wolf','Shadow Motion'),
  ('Star wolf','Thought Communication'), ('Star wolf','Ultra Smell'),
  ('Tempest serpent','Heat Source Perception'), ('Tempest serpent','Poison Breath'),
  ('Tempest star wolf','Coercion'), ('Tempest star wolf','Shadow Motion'),
  ('Tempest star wolf','Thought Communication'), ('Tempest star wolf','Ultra Smell'),
  ('Tempest wolf','Coercion'), ('Tempest wolf','Shadow Motion'),
  ('Tempest wolf','Thought Communication'), ('Tempest wolf','Ultra Smell'),
  ('Vampire','Charm'), ('Vampire','Coercion'), ('Vampire','Self-Regeneration'),
  ('Vampire','Shadow Motion'), ('Vampire','Steel Strength')
) as v(species_name, skill_title)
join slime_species s on s.name_en = v.species_name and s.media = 'Main'
join slime_skills k on k.wiki_title = v.skill_title
where k.tier_group in ('common', 'extra')          -- Unique / Ultimate skills are never devoured
on conflict do nothing;

-- ---------- status: stamina and devour ability (read only) ----------
create or replace function slime_hunt_status(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_c   slime_characters%rowtype;
  v_max numeric := slime_cfg('hunt.stamina_max', 10);
  v_reg numeric := slime_cfg('hunt.stamina_regen_per_hour', 6);
  v_stam numeric;
  v_dev jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_c from slime_characters where id = p_character_id and user_id = auth.uid();
  if not found then raise exception 'character not found'; end if;

  v_stam := least(v_max, v_c.stamina + v_reg * extract(epoch from (now() - v_c.stamina_at)) / 3600.0);

  select coalesce(jsonb_agg(jsonb_build_object('skill', k.name, 'chance', d.gain_chance) order by d.gain_chance desc), '[]'::jsonb)
    into v_dev
    from slime_character_skills cs
    join slime_devour_skills d on d.skill_id = cs.skill_id
    join slime_skills k on k.id = cs.skill_id
   where cs.character_id = v_c.id;

  return jsonb_build_object('stamina', v_stam, 'stamina_max', v_max, 'regen_per_hour', v_reg,
                            'cost', slime_cfg('hunt.stamina_cost', 1), 'biome_id', v_c.biome_id,
                            'devour', v_dev, 'synced_at', now());
end;
$$;

-- ---------- hunt ----------
create or replace function slime_hunt(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_c       slime_characters%rowtype;
  v_depth   int;
  v_max     numeric := slime_cfg('hunt.stamina_max', 10);
  v_reg     numeric := slime_cfg('hunt.stamina_regen_per_hour', 6);
  v_cost    numeric := slime_cfg('hunt.stamina_cost', 1);
  v_stam    numeric;
  v_passive numeric;
  v_prey    slime_species%rowtype;
  v_pwin    numeric;
  v_won     boolean;
  v_reward  numeric := 0;
  v_chance  numeric;
  v_devoured boolean := false;
  v_skill   slime_skills%rowtype;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_c from slime_characters where id = p_character_id and user_id = v_uid for update;
  if not found then raise exception 'character not found'; end if;

  v_stam := least(v_max, v_c.stamina + v_reg * extract(epoch from (now() - v_c.stamina_at)) / 3600.0);
  if v_stam < v_cost then
    raise exception 'not enough stamina (have %, need %)', round(v_stam, 1), v_cost;
  end if;

  select depth into v_depth from slime_species where id = v_c.species_id;

  -- prey: main-story, non-human, non-spirit species living in this biome; weaker prey is more common
  select * into v_prey
    from slime_species s
   where s.primary_biome = v_c.biome_id
     and s.media = 'Main'
     and s.group_name <> 'Humanity'
     and s.group_name not like 'Spirit%'
     and s.depth <= v_depth + 2
   order by -ln(1.0 - random()) / case when s.depth <= v_depth then 1.0 else 0.35 end
   limit 1;
  if v_prey.id is null then
    raise exception 'nothing to hunt in this biome yet';
  end if;

  v_pwin := least(0.95, greatest(0.05,
              slime_cfg('hunt.base_win_chance', 0.55) + slime_cfg('hunt.win_per_depth', 0.15) * (v_depth - v_prey.depth)));
  v_won := random() < v_pwin;

  if v_won then
    v_reward := slime_cfg('hunt.base_reward', 10) * power(slime_cfg('hunt.reward_growth_per_depth', 2.2), v_prey.depth);

    -- devouring: only with a devour-type skill
    select max(d.gain_chance) into v_chance
      from slime_character_skills cs
      join slime_devour_skills d on d.skill_id = cs.skill_id
     where cs.character_id = v_c.id;

    if v_chance is not null then
      v_devoured := true;
      v_reward := v_reward * slime_cfg('hunt.devour_bonus', 1.5);
      if random() < v_chance then
        select k.* into v_skill
          from slime_prey_skills ps
          join slime_skills k on k.id = ps.skill_id
         where ps.species_id = v_prey.id
           and not exists (select 1 from slime_character_skills cs where cs.character_id = v_c.id and cs.skill_id = ps.skill_id)
         order by random() limit 1;
        if v_skill.id is not null then
          insert into slime_character_skills (character_id, skill_id, source)
          values (v_c.id, v_skill.id, 'devour:' || v_prey.id);
        end if;
      end if;
    end if;
  end if;
  v_reward := round(v_reward, 1);

  v_passive := slime_rate_per_hour(v_depth) * extract(epoch from (now() - v_c.last_tick_at)) / 3600.0;

  update slime_characters
     set magicules    = magicules + v_passive + v_reward,
         last_tick_at = now(),
         stamina      = v_stam - v_cost,
         stamina_at   = now(),
         updated_at   = now()
   where id = v_c.id
   returning * into v_c;

  insert into slime_character_events (character_id, kind, detail)
  values (v_c.id, 'hunt', jsonb_build_object('prey', v_prey.id, 'won', v_won, 'reward', v_reward,
                                             'devoured', v_devoured, 'skill', v_skill.id));

  return jsonb_build_object(
    'won', v_won, 'win_chance', round(v_pwin, 3), 'reward', v_reward, 'devoured', v_devoured,
    'prey', jsonb_build_object('id', v_prey.id, 'name_en', v_prey.name_en, 'name_jp', v_prey.name_jp, 'depth', v_prey.depth),
    'skill', case when v_skill.id is null then null
                  else jsonb_build_object('id', v_skill.id, 'name', v_skill.name, 'effect', v_skill.effect) end,
    'stamina', v_c.stamina, 'magicules', v_c.magicules, 'synced_at', v_c.stamina_at);
end;
$$;

revoke all on function slime_hunt_status(uuid), slime_hunt(uuid) from public, anon;
grant execute on function slime_hunt_status(uuid), slime_hunt(uuid) to authenticated;
