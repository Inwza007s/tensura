"use client";

import { fetchStats } from "../lib/api";
import { useCharacter } from "../lib/CharacterContext";
import HuntPanel from "./HuntPanel";

export default function HuntView() {
  const { id, detail, biomeNames, setStats, reload, bump } = useCharacter();
  return (
    <HuntPanel
      characterId={id}
      biomeId={detail.character.biome_id}
      biomeNames={biomeNames}
      onHunted={async (r) => {
        bump(); // the evolution page resyncs magicules next time it opens
        if (r.skill) await reload(); // a skill was devoured: refresh skills and stats
        else fetchStats(id).then(setStats).catch(() => undefined); // XP, level, points
      }}
    />
  );
}
