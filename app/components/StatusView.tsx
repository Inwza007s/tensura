"use client";

import { useCharacter } from "../lib/CharacterContext";
import CharacterCard from "./CharacterCard";
import StatsPanel from "./StatsPanel";

export default function StatusView() {
  const { id, detail, stats, biomeNames, setStats } = useCharacter();
  return (
    <div className="space-y-8">
      <CharacterCard detail={detail} biomeNames={biomeNames} />
      {stats && <StatsPanel characterId={id} stats={stats} onChange={setStats} />}
    </div>
  );
}
