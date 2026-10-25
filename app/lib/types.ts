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

export interface CharacterSkill {
  source: string;
  skill: {
    id: string;
    name: string;
    tier_wiki: string | null;
    effect: string | null;
    wiki_url: string | null;
  };
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
  synced_at: string;
}

export interface HuntResult {
  won: boolean;
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
