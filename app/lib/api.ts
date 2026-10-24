import { supabase } from "./supabase";
import type {
  Biome,
  Character,
  CharacterDetail,
  CharacterListItem,
  CharacterSkill,
  SpeciesOption,
} from "./types";

export async function fetchBiomes(): Promise<Biome[]> {
  const { data, error } = await supabase.from("slime_biomes").select("id,name").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// species the player may pick at start (start_selectable = true)
export async function fetchSelectableSpecies(): Promise<SpeciesOption[]> {
  const { data, error } = await supabase
    .from("slime_species")
    .select("id,name_en,name_jp,group_name,primary_biome,secondary_biome,spirit_line,biome_confidence")
    .eq("start_selectable", true)
    .order("group_name")
    .order("name_en");
  if (error) throw new Error(error.message);
  return (data ?? []) as SpeciesOption[];
}

// speciesId = null -> random weighted roll on the server
export async function createCharacter(name: string, speciesId: string | null): Promise<string> {
  const { data, error } = await supabase.rpc("slime_create_character", {
    p_name: name,
    p_species_id: speciesId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchCharacter(id: string): Promise<CharacterDetail> {
  const { data: c, error } = await supabase
    .from("slime_characters")
    .select(
      "id,name,start_mode,has_body,body_method,fuel_days,biome_id,created_at," +
        "species:slime_species!species_id(id,name_en,name_jp,group_name,spirit_line,primary_biome,secondary_biome,biome_confidence)",
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const { data: sk, error: skErr } = await supabase
    .from("slime_character_skills")
    .select("source,skill:slime_skills(id,name,tier_wiki,effect,wiki_url)")
    .eq("character_id", id)
    .order("acquired_at");
  if (skErr) throw new Error(skErr.message);

  return {
    character: c as unknown as Character,
    skills: (sk ?? []) as unknown as CharacterSkill[],
  };
}

export async function fetchMyCharacters(): Promise<CharacterListItem[]> {
  const { data, error } = await supabase
    .from("slime_characters")
    .select("id,name,created_at,species:slime_species!species_id(name_en)")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CharacterListItem[];
}
