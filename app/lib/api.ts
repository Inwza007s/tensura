import { supabase } from "./supabase";
import type {
  Biome,
  Character,
  CharacterDetail,
  CharacterListItem,
  CharacterSkill,
  EvolutionOption,
  HuntResult,
  HuntStatus,
  LineSpecies,
  PreyPreview,
  SkillInfo,
  SpeciesOption,
  StatKey,
  StatSheet,
  TickState,
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
        "species:slime_species!species_id(id,name_en,name_jp,group_name,parent_id,root_id,depth,spirit_line,primary_biome,secondary_biome,biome_confidence)",
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const { data: sk, error: skErr } = await supabase
    .from("slime_character_skills")
    .select("source,skill:slime_skills(id,name,tier_group,tier_wiki,effect,game_effect,wiki_url)")
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

// ---------- save slots ----------
export async function fetchMaxSlots(): Promise<number> {
  const { data } = await supabase
    .from("slime_config")
    .select("value")
    .eq("key", "characters.max_per_user")
    .maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

export async function deleteCharacter(id: string): Promise<void> {
  const { data, error } = await supabase.from("slime_characters").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Could not delete this character.");
}

// ---------- evolution ----------
export async function tickCharacter(id: string): Promise<TickState> {
  const { data, error } = await supabase.rpc("slime_tick", { p_character_id: id });
  if (error) throw new Error(error.message);
  return data as TickState;
}

export async function fetchEvolutionOptions(id: string): Promise<EvolutionOption[]> {
  const { data, error } = await supabase.rpc("slime_evolution_options", { p_character_id: id });
  if (error) throw new Error(error.message);
  return (data ?? []) as EvolutionOption[];
}

export async function evolveCharacter(id: string, targetSpeciesId: string): Promise<TickState> {
  const { data, error } = await supabase.rpc("slime_evolve_character", {
    p_character_id: id,
    p_target_species_id: targetSpeciesId,
  });
  if (error) throw new Error(error.message);
  return data as TickState;
}

// every species of one evolution line (same root)
export async function fetchLine(rootId: string): Promise<LineSpecies[]> {
  const { data, error } = await supabase
    .from("slime_species")
    .select("id,name_en,name_jp,parent_id,depth,primary_biome,evolution_condition")
    .eq("root_id", rootId)
    .order("depth")
    .order("name_en");
  if (error) throw new Error(error.message);
  return (data ?? []) as LineSpecies[];
}

// ---------- hunting ----------
export async function fetchHuntStatus(id: string): Promise<HuntStatus> {
  const { data, error } = await supabase.rpc("slime_hunt_status", { p_character_id: id });
  if (error) throw new Error(error.message);
  return data as HuntStatus;
}

export async function hunt(id: string): Promise<HuntResult> {
  const { data, error } = await supabase.rpc("slime_hunt", { p_character_id: id });
  if (error) throw new Error(error.message);
  return data as HuntResult;
}

// creatures that can show up when hunting in a biome (same filter the server uses, without the depth limit)
export async function fetchPreyPreview(biomeId: string): Promise<PreyPreview[]> {
  const { data, error } = await supabase
    .from("slime_species")
    .select("id,name_en,depth")
    .eq("primary_biome", biomeId)
    .eq("media", "Main")
    .neq("group_name", "Humanity")
    .not("group_name", "like", "Spirit%")
    .order("depth")
    .order("name_en");
  if (error) throw new Error(error.message);
  return (data ?? []) as PreyPreview[];
}

// ---------- stats ----------
export async function fetchStats(id: string): Promise<StatSheet> {
  const { data, error } = await supabase.rpc("slime_char_stats", { p_character_id: id });
  if (error) throw new Error(error.message);
  return data as StatSheet;
}

export async function allocateStat(id: string, stat: StatKey, points: number): Promise<StatSheet> {
  const { data, error } = await supabase.rpc("slime_allocate_stat", {
    p_character_id: id,
    p_stat: stat,
    p_points: points,
  });
  if (error) throw new Error(error.message);
  return data as StatSheet;
}

// ---------- skill library ----------
export async function fetchAllSkills(): Promise<SkillInfo[]> {
  const { data, error } = await supabase
    .from("slime_skills")
    .select("id,name,tier_group,tier_wiki,effect,game_effect,wiki_url")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as SkillInfo[];
}
