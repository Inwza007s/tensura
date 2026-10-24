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
