export interface Biome {
  id: string;
  name: string;
}

export interface SpeciesOption {
  id: string;
  name_en: string;
  name_jp: string | null;
  group_name: string;
  primary_biome: string | null;
  secondary_biome: string | null;
  spirit_line: string | null;
  biome_confidence: "High" | "Medium" | "Low" | null;
}

export interface CharacterSpecies {
  id: string;
  name_en: string;
  name_jp: string | null;
  group_name: string;
  parent_id: string | null;
  root_id: string | null;
  depth: number;
  spirit_line: string | null;
  primary_biome: string | null;
  secondary_biome: string | null;
  biome_confidence: "High" | "Medium" | "Low" | null;
}

export interface Character {
  id: string;
  name: string;
  start_mode: "random" | "chosen";
  has_body: boolean;
  body_method: string | null;
  fuel_days: number | null;
  biome_id: string | null;
  created_at: string;
  species: CharacterSpecies;
}

export type TierGroup = "common" | "extra" | "unique" | "ultimate" | "other";

export interface SkillInfo {
  id: string;
  name: string;
  tier_group: TierGroup;
  tier_wiki: string | null;
  effect: string | null;
  game_effect: string | null;
  wiki_url: string | null;
}

export interface CharacterSkill {
  source: string; // start | species | devour:SPxxx
  skill: SkillInfo;
}

export interface CharacterDetail {
  character: Character;
  skills: CharacterSkill[];
}

export interface CharacterListItem {
  id: string;
  name: string;
  created_at: string;
  species: { name_en: string };
}

// result of slime_tick / slime_evolve_character
export interface TickState {
  magicules: number;
  rate_per_hour: number;
  species_id: string;
  synced_at: string;
  new_skills?: { id: string; name: string; game_effect: string | null }[]; // only after an evolution
}

export interface EvolutionOption {
  id: string;
  name_en: string;
  name_jp: string | null;
  group_name: string;
  depth: number;
  primary_biome: string | null;
  evolution_condition: string | null;
  evolution_condition_source: string | null;
  cost: number;
}

export interface LineSpecies {
  id: string;
  name_en: string;
  name_jp: string | null;
  parent_id: string | null;
  depth: number;
  primary_biome: string | null;
  evolution_condition: string | null;
}

export interface HuntStatus {
  stamina: number;
  stamina_max: number;
  regen_per_hour: number;
  cost: number;
  biome_id: string | null;
  devour: { skill: string; chance: number }[];
  power: number;
  level: number;
  synced_at: string;
}

export type StatKey = "str" | "vit" | "agi" | "mag" | "wil";

export interface StatSheet {
  level: number;
  exp: number;
  exp_needed: number;
  stat_points: number;
  auto: number;
  power: number;
  base: Record<StatKey, number>;
  alloc: Record<StatKey, number>;
  skill: Record<StatKey, number>;
  total: Record<StatKey, number>;
  bonus: {
    win_pct: number;
    reward_pct: number;
    xp_pct: number;
    income_pct: number;
    stamina_regen_pct: number;
  };
}

export interface HuntResult {
  won: boolean;
  xp: number;
  levels_gained: number;
  level: number;
  exp: number;
  exp_needed: number;
  stat_points: number;
  player_power: number;
  prey_power: number;
  win_chance: number;
  reward: number;
  devoured: boolean;
  prey: { id: string; name_en: string; name_jp: string | null; depth: number };
  skill: { id: string; name: string; effect: string | null } | null;
  stamina: number;
  magicules: number;
  synced_at: string;
}

export interface PreyPreview {
  id: string;
  name_en: string;
  depth: number;
}
