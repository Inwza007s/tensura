# Slime game database (Supabase, `slime_` prefix)

Run in the Supabase SQL editor, in this order:
1. `001_slime_schema.sql` - tables, RLS policies, `slime_create_character()` function
2. `002_slime_seed.sql` - species (368), skills (294), links, biomes, rules (wrapped in one transaction)
3. `003_slime_evolution.sql` - 3 save slots per user, magicule income, evolution functions (safe to run twice)
4. `004_slime_hunt.sql` - hunting, stamina, devour skills
5. `005_slime_stats_skills.sql` - level, 5 stats, skill effects, species skills, power-based hunt maths
6. `006_slime_stats_seed.sql` - generated: species stats (368), skill effects (761 rows for all 294 skills), species innate skills (71)

Client usage (signed-in user):
- Random start:  `supabase.rpc('slime_create_character', { p_name: 'Rimuru' })`
- Chosen start:  `supabase.rpc('slime_create_character', { p_name: 'Rimuru', p_species_id: 'SP0xx' })`
  (only species with `start_selectable = true`; list them with
  `supabase.from('slime_species').select('*').eq('start_selectable', true)`)

Tuning (no code change needed):
- `slime_species.start_weight` - random-roll weight (0 = not rolled)
- `slime_species.start_selectable` - may be chosen by the player
- `slime_config` keys `start.second_unique_chance.random` (0.01) and `.chosen` (0.001)
- `slime_skills.in_unique_pool` - skills that can be rolled as the start Unique skill (85 main-story skills)

Regenerate the seed after editing the workbook: `python generate_seed.py tensura_reference.xlsx skills_parsed.json 002_slime_seed.sql`

Evolution (003): magicules accrue on the server clock. Placeholder numbers live in `slime_config`:
`evolution.base_rate_per_hour` (20), `evolution.rate_growth_per_depth` (1.8), `evolution.base_cost` (100),
`evolution.cost_growth_per_depth` (4). Save slots: `characters.max_per_user` (3).
Functions: `slime_tick(id)`, `slime_evolution_options(id)`, `slime_evolve_character(id, target_species_id)`.

Stats and skills (005/006): POWER = 1.0 STR + 1.0 MAG + 0.8 VIT + 0.7 AGI + 0.5 WIL (`combat.weights`).
Win chance = P^k / (P^k + Q^k) with k = `combat.power_exponent`, plus skill win bonus, clamped to 5%-95%.
Every skill has rows in `slime_skill_effects` (kinds: stat_flat, win_pct, reward_pct, xp_pct, income_pct,
stamina_regen_pct). The rules that generated them are in `effects_rules.py`; re-run `gen_seed006.py` after changing them.
Species stats come from a group profile x 1.6^depth (edit `slime_species_stats` directly to tune one species).
