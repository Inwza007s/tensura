"use client";

import { createContext, useContext } from "react";
import type { Biome, CharacterDetail, StatSheet } from "./types";

export interface CharacterCtx {
  id: string;
  detail: CharacterDetail;
  stats: StatSheet | null;
  biomeNames: Record<string, string>;
  biomes: Biome[];
  refreshKey: number; // bump to make panels resync from the server
  reload: () => Promise<void>; // refetch character, skills and stats
  setStats: (s: StatSheet) => void;
  bump: () => void;
}

export const CharacterContext = createContext<CharacterCtx | null>(null);

export function useCharacter(): CharacterCtx {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error("useCharacter must be used inside CharacterProvider");
  return ctx;
}
